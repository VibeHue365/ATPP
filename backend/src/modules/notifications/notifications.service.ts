import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { MailService } from '../auth/services/mail.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
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
    const savedNotification = await newNotification.save();

    // 1. Send Email Notification
    try {
      const user = await this.userModel.findById(new Types.ObjectId(userId));
      if (user && user.auth && user.auth.email) {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e8e2d5; border-radius: 8px;">
            <h2 style="color: #4a0e17; border-bottom: 2px solid #4a0e17; padding-bottom: 10px;">VibeHue Notification</h2>
            <h3 style="color: #2a2a2a; margin-top: 20px;">${title}</h3>
            <p style="color: #4a4a4a; line-height: 1.6; font-size: 14px;">${content}</p>
            <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 20px 0;">
            <p style="color: #7a7a7a; font-size: 11px;">Đây là thông báo tự động từ hệ thống VibeHue. Vui lòng không trả lời email này.</p>
          </div>
        `;
        await this.mailService.sendMail(user.auth.email, `[VibeHue] ${title}`, emailHtml);
      }
    } catch (mailError) {
      console.warn('Email notification delivery failed:', mailError);
    }

    // 2. Emit Realtime WebSocket Event
    try {
      if (this.chatGateway && this.chatGateway.server) {
        const userSockets = this.chatGateway.getActiveConnections().get(userId) || [];
        userSockets.forEach((socketId) => {
          this.chatGateway.server.to(socketId).emit('new_notification', savedNotification);
        });
      }
    } catch (wsError) {
      console.warn('Realtime notification delivery failed:', wsError);
    }

    return savedNotification;
  }
}
