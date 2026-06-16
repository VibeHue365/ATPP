import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  Booking = 'BOOKING',
  Payment = 'PAYMENT',
  Handover = 'HANDOVER',
  Refund = 'REFUND',
  Dispute = 'DISPUTE',
  System = 'SYSTEM',
}

@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({
    type: String,
    enum: Object.values(NotificationType),
    required: true,
    index: true,
  })
  type: NotificationType;

  @Prop({ type: Boolean, default: false, index: true })
  isRead: boolean;

  @Prop({ type: Date, default: null })
  readAt?: Date | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
