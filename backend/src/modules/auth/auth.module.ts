import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { GoogleStrategy } from '../../common/strategies/google.strategy';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { AuthRepository } from './repositories/auth.repository';
import {
  LoginHistory,
  LoginHistorySchema,
} from './schemas/login-history.schema';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';
import { Role, RoleSchema } from './schemas/role.schema';
import {
  VerificationToken,
  VerificationTokenSchema,
} from './schemas/verification-token.schema';
import { AuthService } from './services/auth.service';
import { MailService } from './services/mail.service';
import { RolesService } from './services/roles.service';

export const authModels = MongooseModule.forFeature([
  { name: RefreshToken.name, schema: RefreshTokenSchema },
  { name: VerificationToken.name, schema: VerificationTokenSchema },
  { name: LoginHistory.name, schema: LoginHistorySchema },
  { name: Role.name, schema: RoleSchema },
  { name: Permission.name, schema: PermissionSchema },
]);

@Module({
  imports: [
    ConfigModule,
    authModels,
    UsersModule,
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'dev-jwt-secret-change-me',
        ),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    MailService,
    RolesService,
    JwtStrategy,
    GoogleStrategy,
  ],
})
export class AuthModule {}
