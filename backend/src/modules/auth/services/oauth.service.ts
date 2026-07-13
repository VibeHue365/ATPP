import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { GoogleOAuthProfile } from '../../../common/strategies/google.strategy';
import { UsersRepository } from '../../users/repositories/users.repository';
import { AuthProviderType, UserStatus } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/services/users.service';
import { OAuthExchangeDto } from '../dto/oauth-exchange.dto';
import { AuthRepository } from '../repositories/auth.repository';
import {
  VerificationPurpose,
  VerificationTargetType,
} from '../schemas/verification-token.schema';
import {
  AuthSession,
  OAuthLoginCode,
  RequestContext,
} from '../types/auth.types';
import { RolesService } from './roles.service';
import { TokenService } from './token.service';
import { LoginProvider, LoginStatus } from '../schemas/login-history.schema';
import { SecurityEventType } from '../schemas/security-event.schema';
import { SecurityLogService } from './security-log.service';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class OAuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly securityLogService: SecurityLogService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async createGoogleOAuthState(context: RequestContext): Promise<string> {
    const stateId = new Types.ObjectId();
    const state = `${stateId.toString()}.${randomBytes(48).toString('hex')}`;
    const stateHash = await bcrypt.hash(state, 12);

    await this.authRepository.createOAuthState({
      _id: stateId,
      stateHash,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    return state;
  }

  async validateGoogleOAuthState(state: string): Promise<void> {
    const { stateId } = this.tokenService.parseOAuthState(state);
    const oauthState = await this.authRepository.findOAuthStateById(stateId);

    if (
      !oauthState ||
      oauthState.usedAt ||
      oauthState.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('OAuth state is expired or invalid');
    }

    const validState = await bcrypt.compare(state, oauthState.stateHash);
    if (!validState) {
      throw new UnauthorizedException('OAuth state is expired or invalid');
    }

    const markedUsed = await this.authRepository.markOAuthStateUsedIfActive(
      new Types.ObjectId(stateId),
    );
    if (!markedUsed) {
      throw new UnauthorizedException('OAuth state is expired or invalid');
    }
  }

  async handleGoogleLogin(
    profile: GoogleOAuthProfile,
    _context: RequestContext,
  ): Promise<OAuthLoginCode> {
    if (profile.emailVerified === false) {
      throw new ForbiddenException('Google email is not verified');
    }

    const email = this.normalizeEmail(profile.email);
    const providerUserId = profile.providerUserId;
    let user = await this.usersRepository.findUserByAuthProvider(
      AuthProviderType.Google,
      providerUserId,
    );

    user ??= await this.usersRepository.findUserByEmail(email);
    const hasGoogleProvider = Boolean(
      user?.auth.authProviders.some(
        (authProvider) =>
          authProvider.provider === AuthProviderType.Google &&
          authProvider.providerUserId === providerUserId,
      ),
    );

    if (!user) {
      user = await this.usersRepository.createUser({
        auth: {
          email: profile.email,
          emailNormalized: email,
          passwordHash: null,
          emailVerified: true,
          phoneVerified: false,
          authProviders: [
            {
              provider: AuthProviderType.Google,
              providerUserId,
            },
          ],
        },
        roles: ['CUSTOMER'],
        defaultRole: 'CUSTOMER',
        accountStatus: UserStatus.Active,
        profile: {
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
        },
        security: {
          failedLoginAttempts: 0,
        },
      });
      await this.rolesService.assignDefaultCustomerRole(user._id);
    } else if (user.accountStatus !== UserStatus.Active) {
      throw new ForbiddenException('Account is not active');
    } else if (!hasGoogleProvider) {
      await this.usersRepository.addAuthProvider(user._id, {
        provider: AuthProviderType.Google,
        providerUserId,
      });
    }

    await this.usersRepository.activateEmail(user._id);

    return {
      code: await this.createOAuthExchangeCode(user._id, email),
    };
  }

  async exchangeOAuthCode(
    dto: OAuthExchangeDto,
    context: RequestContext,
  ): Promise<AuthSession> {
    await this.rateLimitService.assertRateLimit(
      `auth:oauth-exchange:ip:${this.rateLimitService.ipKey(context.ipAddress)}`,
      10,
      5 * 60,
    );
    const { tokenId } = this.tokenService.parseOAuthCode(dto.code);
    const token = await this.authRepository.findVerificationTokenById(tokenId);

    if (
      !token ||
      token.purpose !== VerificationPurpose.OAuthLogin ||
      token.verifiedAt ||
      token.revokedAt ||
      token.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('OAuth code is expired or invalid');
    }

    const validCode = await bcrypt.compare(dto.code, token.codeHash);
    if (!validCode) {
      throw new UnauthorizedException('OAuth code is expired or invalid');
    }

    const verified =
      await this.authRepository.markVerificationTokenVerifiedIfActive(
        new Types.ObjectId(tokenId),
      );
    if (!verified) {
      throw new UnauthorizedException('OAuth code is expired or invalid');
    }

    const user = await this.usersRepository.findUserById(token.userId);
    if (!user || user.accountStatus !== UserStatus.Active) {
      throw new UnauthorizedException('User is not active');
    }

    const tokens = await this.tokenService.issueTokens(
      user._id,
      user.auth.emailNormalized,
      context,
    );
    const { roles } = await this.rolesService.getRoleCodesAndPermissions(
      user._id,
    );
    await Promise.all([
      this.usersRepository.markLoggedIn(user._id),
      this.authRepository.recordLogin(
        user._id,
        user.auth.emailNormalized,
        LoginProvider.Google,
        LoginStatus.Success,
        null,
        context.ipAddress,
        context.userAgent,
      ),
      this.securityLogService.recordSecurityEvent({
        type: SecurityEventType.LoginSuccess,
        userId: user._id,
        email: user.auth.emailNormalized,
        metadata: {
          provider: LoginProvider.Google,
          failureReason: null,
        },
        context,
      }),
    ]);

    return {
      ...tokens,
      user: await this.usersService.getMe(user._id.toString(), roles),
    };
  }

  private async createOAuthExchangeCode(
    userId: Types.ObjectId,
    email: string,
  ): Promise<string> {
    const tokenId = new Types.ObjectId();
    const code = `${tokenId.toString()}.${randomBytes(48).toString('hex')}`;
    const codeHash = await bcrypt.hash(code, 12);

    await this.authRepository.createVerificationToken({
      _id: tokenId,
      userId,
      target: email,
      targetType: VerificationTargetType.Email,
      codeHash,
      purpose: VerificationPurpose.OAuthLogin,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000),
    });

    return code;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
