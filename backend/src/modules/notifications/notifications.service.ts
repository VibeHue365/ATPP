import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async findAll(userId: string): Promise<Notification[]> {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    return this.notificationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          userId: new Types.ObjectId(userId),
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();
  }

  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel
      .updateMany(
        {
          userId: new Types.ObjectId(userId),
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        },
      )
      .exec();
    return { modifiedCount: result.modifiedCount };
  }

  async createNotification(
    userId: string,
    title: string,
    content: string,
    type: NotificationType,
    metadata: Record<string, any> = {},
  ): Promise<Notification> {
    const newNotification = new this.notificationModel({
      userId: new Types.ObjectId(userId),
      title,
      content,
      type,
      isRead: false,
      metadata,
    });
    return newNotification.save();
  }
}
