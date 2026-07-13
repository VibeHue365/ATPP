import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';

export const notificationModels = MongooseModule.forFeature([
  { name: Notification.name, schema: NotificationSchema },
]);

@Module({
  imports: [
    notificationModels,
    UsersModule,
    AuthModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [notificationModels, NotificationsService],
})
export class NotificationsModule {}

