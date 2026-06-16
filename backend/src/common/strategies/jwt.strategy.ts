import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Types } from 'mongoose';
import { AuthRepository } from '../../modules/auth/repositories/auth.repository';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'dev-jwt-secret-change-me',
      ),
    });
  }

  async validate(payload: AuthUser): Promise<AuthUser> {
    if (!Types.ObjectId.isValid(payload.sessionId)) {
      throw new UnauthorizedException('Session is invalid');
    }

    const refreshToken = await this.authRepository.findRefreshTokenById(
      payload.sessionId,
    );

    if (
      !refreshToken ||
      refreshToken.revokedAt ||
      refreshToken.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Session is expired or revoked');
    }

    return payload;
  }
}
