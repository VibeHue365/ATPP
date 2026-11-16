import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';
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

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification | null> {
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

  async registerPushToken(
    userId: string,
    token: string,
    platform: 'android' | 'ios',
  ): Promise<void> {
    // A physical device can only belong to the currently authenticated account.
    await this.userModel
      .updateMany({}, { $pull: { pushTokens: { token } } })
      .exec();
    await this.userModel
      .updateOne(
        { _id: new Types.ObjectId(userId) },
        { $push: { pushTokens: { token, platform, updatedAt: new Date() } } },
      )
      .exec();
  }

  async unregisterPushToken(userId: string, token: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: new Types.ObjectId(userId) },
        { $pull: { pushTokens: { token } } },
      )
      .exec();
  }

  private async sendExpoPush(
    recipient: UserDocument,
    title: string,
    content: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    const tokens = [
      ...new Set((recipient.pushTokens ?? []).map((item) => item.token)),
    ];
    if (tokens.length === 0) return;

    for (let offset = 0; offset < tokens.length; offset += 100) {
      const batch = tokens.slice(offset, offset + 100);
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(
          batch.map((to) => ({
            to,
            title,
            body: content,
            data: metadata,
            sound: 'default',
            priority: 'high',
            channelId: 'booking-updates',
          })),
        ),
      });
      if (!response.ok)
        throw new Error(`Expo Push responded with HTTP ${response.status}`);
      const payload = (await response.json()) as {
        data?: Array<{ status?: string; details?: { error?: string } }>;
      };
      const invalid = batch.filter(
        (_, index) =>
          payload.data?.[index]?.details?.error === 'DeviceNotRegistered',
      );
      if (invalid.length > 0) {
        await this.userModel
          .updateOne(
            { _id: recipient._id },
            { $pull: { pushTokens: { token: { $in: invalid } } } },
          )
          .exec();
      }
    }
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

    let recipient: UserDocument | null = null;
    try {
      recipient = await this.userModel.findById(new Types.ObjectId(userId));
    } catch (userError) {
      console.warn('Unable to load notification recipient:', userError);
    }

    // 1. Send Email Notification. Marketing opt-out never suppresses
    // transactional or critical account emails.
    try {
      const isMarketing = metadata.channel === 'MARKETING';
      const marketingEmailEnabled =
        recipient?.notificationPreferences?.marketingEmail !== false;
      if (recipient?.auth?.email && (!isMarketing || marketingEmailEnabled)) {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e8e2d5; border-radius: 8px;">
            <h2 style="color: #4a0e17; border-bottom: 2px solid #4a0e17; padding-bottom: 10px;">Thông báo từ VibeHue</h2>
            <h3 style="color: #2a2a2a; margin-top: 20px;">${title}</h3>
            <p style="color: #4a4a4a; line-height: 1.6; font-size: 14px;">${content}</p>
            <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 20px 0;">
            <p style="color: #7a7a7a; font-size: 11px;">Đây là thông báo tự động từ hệ thống VibeHue. Vui lòng không trả lời email này.</p>
          </div>
        `;
        await this.mailService.sendMail(
          recipient.auth.email,
          `[VibeHue] Thông báo: ${title}`,
          emailHtml,
        );
      }
    } catch (mailError) {
      console.warn('Email notification delivery failed:', mailError);
    }

    // 2. Emit Realtime WebSocket Event
    try {
      const appPushEnabled =
        recipient?.notificationPreferences?.appPush !== false;
      if (appPushEnabled && this.chatGateway && this.chatGateway.server) {
        const userSockets =
          this.chatGateway.getActiveConnections().get(userId) || [];
        userSockets.forEach((socketId) => {
          this.chatGateway.server
            .to(socketId)
            .emit('new_notification', savedNotification);
        });
      }
    } catch (wsError) {
      console.warn('Realtime notification delivery failed:', wsError);
    }

    // 3. Deliver an OS-level push when the app is backgrounded or closed.
    try {
      const appPushEnabled =
        recipient?.notificationPreferences?.appPush !== false;
      if (recipient && appPushEnabled) {
        await this.sendExpoPush(recipient, title, content, metadata);
      }
    } catch (pushError) {
      console.warn('Push notification delivery failed:', pushError);
    }

    return savedNotification;
  }

  /**
   * Emit a real-time `booking_updated` event to both the customer and all provider sockets.
   * This is used by updateBookingStatus so that the Provider Dashboard and customer Profile
   * page immediately reflect status/photo changes without requiring a manual page refresh.
   */
  emitBookingUpdate(
    payload: {
      bookingId: string;
      bookingCode?: string;
      status: string;
      deliveredPhotos?: string[];
      handoverPhotos?: string[];
      deliveryDriveUrl?: string | null;
    },
    recipientUserIds: string[],
  ): void {
    try {
      if (!this.chatGateway?.server) return;

      const uniqueUserIds = [...new Set(recipientUserIds.filter(Boolean))];

      // Emit strictly to the involved customer and provider user rooms (avoid double emit to socketId)
      for (const userId of uniqueUserIds) {
        this.chatGateway.server.to(`user:${userId}`).emit('booking_updated', payload);
      }

      // Also emit strictly to connected Admins
      this.chatGateway.server.to('role:admin').emit('booking_updated', payload);
    } catch (e) {
      console.warn('emitBookingUpdate failed:', e);
    }
  }
}
