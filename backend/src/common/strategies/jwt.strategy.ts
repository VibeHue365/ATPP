import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Types } from 'mongoose';
import type { Request } from 'express';

import { getJwtSecret } from '../config/jwt-secret';
import { AuthRepository } from '../../modules/auth/repositories/auth.repository';
import { AuthUser } from '../decorators/current-user.decorator';
import { RolesService } from '../../modules/auth/services/roles.service';
import { UsersRepository } from '../../modules/users/repositories/users.repository';
import { UserStatus } from '../../modules/users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
    private readonly rolesService: RolesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: AuthUser): Promise<AuthUser> {
    if (!Types.ObjectId.isValid(payload.sub)) {
      throw new UnauthorizedException('User is invalid');
    }

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

    const userId = new Types.ObjectId(payload.sub);
    let user = await this.usersRepository.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    if (
      user.accountStatus === UserStatus.Suspended &&
      user.security?.lockedUntil &&
      user.security.lockedUntil.getTime() <= Date.now()
    ) {
      user =
        (await this.usersRepository.restoreExpiredSuspension(userId)) ?? user;
    }

    if (user.accountStatus === UserStatus.Banned) {
      throw new UnauthorizedException('Tài khoản đã bị khóa bởi quản trị viên');
    }

    if (user.accountStatus !== UserStatus.Active) {
      throw new UnauthorizedException('User is not active');
    }

    if (user.provider?.providerStatus === 'SUSPENDED') {
      const url = req.originalUrl || req.url || '';
      const method = req.method || 'GET';

      const isProviderRoute =
        url.includes('/providers') ||
        url.includes('/bookings/provider') ||
        (url.includes('/products') &&
          (method !== 'GET' || url.includes('/my-listings'))) ||
        (url.includes('/bookings') && url.includes('/status'));

      if (isProviderRoute) {
        throw new ForbiddenException(
          'Tài khoản đối tác của bạn đã bị tạm đình chỉ hoạt động. Vui lòng liên hệ Admin.',
        );
      }
    }

    const { roles, permissions } =
      await this.rolesService.getRoleCodesAndPermissions(userId);

    return {
      ...payload,
      roles,
      permissions,
    };
  }
}
