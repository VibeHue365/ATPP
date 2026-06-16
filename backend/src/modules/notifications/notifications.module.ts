import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './schemas/notification.schema';

export const notificationModels = MongooseModule.forFeature([
  { name: Notification.name, schema: NotificationSchema },
]);

@Module({
  imports: [notificationModels],
  exports: [notificationModels],
})
export class NotificationsModule {}
