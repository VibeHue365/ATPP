import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

export const notificationModels = MongooseModule.forFeature([
  { name: Notification.name, schema: NotificationSchema },
]);

@Module({
  imports: [notificationModels],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [notificationModels, NotificationsService],
})
export class NotificationsModule {}

