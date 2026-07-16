import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserStatus } from '../schemas/user.schema';

@Injectable()
export class AccountStatusMigrationService implements OnModuleInit {
  private readonly logger = new Logger(AccountStatusMigrationService.name);

  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async onModuleInit(): Promise<void> {
    const farFutureLock = new Date('9999-01-01T00:00:00.000Z');
    const now = new Date();

    const bannedResult = await this.userModel.updateMany(
      {
        deletedAt: null,
        'security.lockedUntil': { $gte: farFutureLock },
        accountStatus: { $ne: UserStatus.Banned },
      },
      {
        $set: {
          accountStatus: UserStatus.Banned,
          'security.lockedUntil': null,
          'security.lockedReason': 'Migrated permanent lock',
        },
      },
    );

    const suspendedResult = await this.userModel.updateMany(
      {
        deletedAt: null,
        'security.lockedUntil': { $gt: now, $lt: farFutureLock },
        accountStatus: UserStatus.Active,
      },
      {
        $set: {
          accountStatus: UserStatus.Suspended,
          'security.lockedReason': 'Migrated temporary lock',
        },
      },
    );

    if (bannedResult.modifiedCount || suspendedResult.modifiedCount) {
      this.logger.warn(
        `Migrated account statuses: banned=${bannedResult.modifiedCount}, suspended=${suspendedResult.modifiedCount}`,
      );
    }
  }
}
