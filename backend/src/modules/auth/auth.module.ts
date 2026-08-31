import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { getJwtSecret } from '../../common/config/jwt-secret';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { GoogleStrategy } from '../../common/strategies/google.strategy';
import { GoogleAuthGuard } from '../../common/guards/google-auth.guard';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { AdminRolesController } from './controllers/admin-roles.controller';
import { AuthRepository } from './repositories/auth.repository';
import {
  LoginHistory,
  LoginHistorySchema,
} from './schemas/login-history.schema';
import { OAuthState, OAuthStateSchema } from './schemas/oauth-state.schema';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import { RateLimit, RateLimitSchema } from './schemas/rate-limit.schema';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';
import { Role, RoleSchema } from './schemas/role.schema';
import {
  VerificationToken,
  VerificationTokenSchema,
} from './schemas/verification-token.schema';
import { SecurityLogModule } from './security-log.module';
import { AuthService } from './services/auth.service';
import { BootstrapAdminService } from './services/bootstrap-admin.service';
import { EmailQueueService } from './services/email-queue.service';
import { MailService } from './services/mail.service';
import { OAuthService } from './services/oauth.service';
import { OtpService } from './services/otp.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { PasswordResetService } from './services/password-reset.service';
import { RateLimitService } from './services/rate-limit.service';
import { RolesService } from './services/roles.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';

export const authModels = MongooseModule.forFeature([
  { name: RefreshToken.name, schema: RefreshTokenSchema },
  { name: VerificationToken.name, schema: VerificationTokenSchema },
  { name: LoginHistory.name, schema: LoginHistorySchema },
  { name: OAuthState.name, schema: OAuthStateSchema },
  { name: Role.name, schema: RoleSchema },
  { name: Permission.name, schema: PermissionSchema },
  { name: RateLimit.name, schema: RateLimitSchema },
]);

@Module({
  imports: [
    ConfigModule,
    authModels,
    SecurityLogModule,
    UsersModule,
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtSecret(configService),
      }),
    }),
  ],
  controllers: [AuthController, AdminRolesController],
  providers: [
    AuthService,
    BootstrapAdminService,
    AuthRepository,
    MailService,
    EmailQueueService,
    RolesService,
    RateLimitService,
    TokenService,
    OtpService,
    PasswordPolicyService,
    SessionService,
    PasswordResetService,
    OAuthService,
    JwtStrategy,
    GoogleStrategy,
    GoogleAuthGuard,
  ],
  exports: [JwtModule, SecurityLogModule, MailService, RateLimitService],
})
export class AuthModule {}
