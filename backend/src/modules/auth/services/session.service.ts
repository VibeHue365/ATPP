import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { UsersRepository } from '../../users/repositories/users.repository';
import { UserStatus } from '../../users/schemas/user.schema';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { SecurityEventType } from '../schemas/security-event.schema';
import { IssuedTokens, RequestContext } from '../types/auth.types';
import { SecurityLogService } from './security-log.service';
import { TokenService } from './token.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
    private readonly securityLogService: SecurityLogService,
    private readonly tokenService: TokenService,
  ) {}

  async refreshToken(
    dto: RefreshTokenDto,
    context: RequestContext,
  ): Promise<IssuedTokens> {
    const { refreshTokenId } = this.tokenService.parseRefreshToken(
      dto.refreshToken,
    );
    const refreshToken =
      await this.authRepository.findRefreshTokenById(refreshTokenId);

    if (!refreshToken || refreshToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    if (refreshToken.revokedAt) {
      await this.securityLogService.recordSecurityEvent({
        type: SecurityEventType.RefreshTokenReused,
        userId: refreshToken.userId,
        metadata: {
          refreshTokenId,
          revokedAt: refreshToken.revokedAt,
        },
        context,
      });
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const validToken = await bcrypt.compare(
      dto.refreshToken,
      refreshToken.tokenHash,
    );
    if (!validToken) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const nextRefreshTokenId = new Types.ObjectId();
    const revoked = await this.authRepository.revokeRefreshTokenIfActive(
      new Types.ObjectId(refreshTokenId),
      refreshToken.userId,
      nextRefreshTokenId,
    );
    if (!revoked) {
      await this.securityLogService.recordSecurityEvent({
        type: SecurityEventType.RefreshTokenReused,
        userId: refreshToken.userId,
        metadata: {
          refreshTokenId,
          reason: 'ATOMIC_ROTATION_CONFLICT',
        },
        context,
      });
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const user = await this.usersRepository.findUserById(refreshToken.userId);
    if (!user || user.accountStatus !== UserStatus.Active) {
      throw new UnauthorizedException('User is not active');
    }

    return this.tokenService.issueTokens(
      user._id,
      user.auth.emailNormalized,
      context,
      {
        refreshTokenId: nextRefreshTokenId,
        familyId: refreshToken.familyId ?? refreshTokenId,
      },
    );
  }

  async logout(
    userId: string,
    sessionId: string,
  ): Promise<Record<string, unknown>> {
    const userObjectId = new Types.ObjectId(userId);
    await this.authRepository.revokeRefreshToken(
      new Types.ObjectId(sessionId),
      userObjectId,
    );

    return { message: 'Logout success' };
  }
}
