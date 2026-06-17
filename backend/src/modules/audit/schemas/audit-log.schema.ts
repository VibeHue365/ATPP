import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ collection: 'audit_logs', timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  actorId?: Types.ObjectId | null; // Null indicates system action

  @Prop({ required: true, trim: true, index: true })
  action: string; // e.g., 'BOOKING_STATUS_CHANGED', 'PAYMENT_WEBHOOK_PROCESSED', etc.

  @Prop({ required: true, trim: true, index: true })
  resource: string; // e.g., 'bookings', 'payments', 'users'

  @Prop({ type: Types.ObjectId, required: true, index: true })
  resourceId: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  oldValues: Record<string, any>;

  @Prop({ type: Object, default: {} })
  newValues: Record<string, any>;

  @Prop({ type: String, default: null, trim: true })
  ipAddress?: string | null;

  @Prop({ type: String, default: null, trim: true })
  userAgent?: string | null;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
