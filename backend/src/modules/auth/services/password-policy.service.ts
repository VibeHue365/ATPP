import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

const weakPasswords = new Set([
  '12345678',
  'password',
  'password123',
  'qwerty123',
  'admin1234',
  'letmein123',
]);

@Injectable()
export class PasswordPolicyService {
  constructor(private readonly configService: ConfigService) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds());
  }

  async assertDifferentPassword(
    newPassword: string,
    currentPasswordHash: string,
  ): Promise<void> {
    const samePassword = await bcrypt.compare(newPassword, currentPasswordHash);
    if (samePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }
  }

  assertAcceptablePassword(password: string): void {
    const normalized = password.trim().toLowerCase();
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one letter and one number',
      );
    }

    if (weakPasswords.has(normalized)) {
      throw new BadRequestException('Password is too weak');
    }
  }

  private saltRounds(): number {
    const configured = Number(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS', '12'),
    );

    if (!Number.isInteger(configured) || configured < 10 || configured > 14) {
      return 12;
    }

    return configured;
  }
}
