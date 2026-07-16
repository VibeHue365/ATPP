import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityLogModule } from '../auth/security-log.module';
import { StorageModule } from '../storage/storage.module';
import { User, UserSchema } from './schemas/user.schema';
import { AdminUsersController } from './controllers/admin-users.controller';
import { UsersController } from './controllers/users.controller';
import { UserProfileMapper } from './mappers/user-profile.mapper';
import { AccountStatusMigrationService } from './services/account-status-migration.service';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './services/users.service';

export const userModels = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema },
]);

@Module({
  imports: [userModels, SecurityLogModule, StorageModule],
  controllers: [UsersController, AdminUsersController],
  providers: [
    UsersService,
    UsersRepository,
    UserProfileMapper,
    AccountStatusMigrationService,
  ],
  exports: [UsersService, UsersRepository, userModels],
})
export class UsersModule {}
