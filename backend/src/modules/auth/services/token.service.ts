import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { AuthRepository } from '../repositories/auth.repository';
import {
  AuthorizationContext,
  IssuedTokens,
  RequestContext,
} from '../types/auth.types';
import { RolesService } from './roles.service';

@Injectable()
export class TokenService {
  private readonly accessTokenTtlSeconds = 15 * 60;
  private readonly refreshTokenTtlDays = 30;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly rolesService: RolesService,
  ) {}

  async issueTokens(
    userId: Types.ObjectId,
    email: string,
    context: RequestContext,
    options: {
      refreshTokenId?: Types.ObjectId;
      familyId?: string;
      authorization?: AuthorizationContext;
    } = {},
  ): Promise<IssuedTokens> {
    const refreshTokenId = options.refreshTokenId ?? new Types.ObjectId();
    const refreshToken = `${refreshTokenId.toString()}.${randomBytes(48).toString('hex')}`;
    const tokenHash = await bcrypt.hash(refreshToken, 12);
    const expiresAt = new Date(
      Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    await this.authRepository.createRefreshToken({
      _id: refreshTokenId,
      userId,
      tokenHash,
      familyId: options.familyId ?? refreshTokenId.toString(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.userAgent,
      expiresAt,
    });

    const { roles, permissions } =
      options.authorization ??
      (await this.rolesService.getRoleCodesAndPermissions(userId));
    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId.toString(),
        email,
        sessionId: refreshTokenId.toString(),
        roles,
        permissions,
      },
      { expiresIn: this.accessTokenTtlSeconds },
    );

    return { accessToken, refreshToken, expiresIn: this.accessTokenTtlSeconds };
  }

  parseRefreshToken(refreshToken: string): { refreshTokenId: string } {
    const [refreshTokenId] = refreshToken.split('.');
    if (!Types.ObjectId.isValid(refreshTokenId)) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    return { refreshTokenId };
  }

  parseOAuthCode(code: string): { tokenId: string } {
    const [tokenId] = code.split('.');
    if (!Types.ObjectId.isValid(tokenId)) {
      throw new UnauthorizedException('OAuth code is expired or invalid');
    }

    return { tokenId };
  }

  parseOAuthState(state: string): { stateId: string } {
    const [stateId] = state.split('.');
    if (!Types.ObjectId.isValid(stateId)) {
      throw new UnauthorizedException('OAuth state is expired or invalid');
    }

    return { stateId };
  }
}
