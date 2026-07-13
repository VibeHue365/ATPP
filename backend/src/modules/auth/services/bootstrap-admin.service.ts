import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from '../../users/repositories/users.repository';
import { AuthProviderType, UserStatus } from '../../users/schemas/user.schema';
import { PasswordPolicyService } from './password-policy.service';

@Injectable()
export class BootstrapAdminService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService
      .get<string>('BOOTSTRAP_ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();
    const password = this.configService.get<string>('BOOTSTRAP_ADMIN_PASSWORD');

    if (!email || !password) {
      return;
    }

    const activeAdmins = await this.usersRepository.countActiveAdmins();
    if (activeAdmins > 0) {
      return;
    }

    this.passwordPolicyService.assertAcceptablePassword(password);
    const existing = await this.usersRepository.findUserByEmail(email);
    if (existing) {
      await this.usersRepository.updateAccountStatus(
        existing._id,
        UserStatus.Active,
        'Bootstrap admin',
      );
      await this.usersRepository.addRole(existing._id, 'ADMIN');
      this.logger.warn(`Promoted existing user ${email} to ADMIN`);
      return;
    }

    await this.usersRepository.createUser({
      auth: {
        email,
        emailNormalized: email,
        passwordHash: await this.passwordPolicyService.hashPassword(password),
        emailVerified: true,
        phoneVerified: false,
        authProviders: [
          {
            provider: AuthProviderType.Local,
            providerUserId: null,
          },
        ],
      },
      roles: ['ADMIN'],
      defaultRole: 'ADMIN',
      accountStatus: UserStatus.Active,
      profile: {
        fullName:
          this.configService.get<string>('BOOTSTRAP_ADMIN_NAME') ??
          'Bootstrap Admin',
      },
      security: {
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
      },
    });
    this.logger.warn(`Created bootstrap ADMIN account ${email}`);
  }
}
