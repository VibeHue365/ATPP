import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Types } from 'mongoose';
import { getJwtSecret } from '../config/jwt-secret';
import { AuthRepository } from '../../modules/auth/repositories/auth.repository';
import { AuthUser } from '../decorators/current-user.decorator';
import { UsersRepository } from '../../modules/users/repositories/users.repository';
import { UserStatus } from '../../modules/users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: AuthUser): Promise<AuthUser> {
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

    // Enforce ban and suspension
    if (Types.ObjectId.isValid(payload.sub)) {
      const user = await this.usersRepository.findUserById(
        new Types.ObjectId(payload.sub),
      );
      if (!user) {
        throw new UnauthorizedException('Tài khoản không tồn tại');
      }

      if (user.accountStatus === UserStatus.Banned) {
        throw new UnauthorizedException('Tài khoản đã bị khóa bởi quản trị viên');
      }

      // Check if provider is suspended and trying to access provider APIs
      if (user.provider?.providerStatus === 'SUSPENDED') {
        const url = req.originalUrl || req.url || '';
        const method = req.method || 'GET';

        const isProviderRoute =
          url.includes('/providers') ||
          url.includes('/bookings/provider') ||
          (url.includes('/products') && (method !== 'GET' || url.includes('/my-listings'))) ||
          (url.includes('/bookings') && url.includes('/status'));

        if (isProviderRoute) {
          throw new ForbiddenException('Tài khoản đối tác của bạn đã bị tạm đình chỉ hoạt động. Vui lòng liên hệ Admin.');
        }
      }
    }

    return payload;
  }
}
