import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './controllers/users.controller';
import { UserProfileMapper } from './mappers/user-profile.mapper';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './services/users.service';

export const userModels = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema },
]);

@Module({
  imports: [userModels],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserProfileMapper],
  exports: [UsersService, UsersRepository, userModels],
})
export class UsersModule {}
