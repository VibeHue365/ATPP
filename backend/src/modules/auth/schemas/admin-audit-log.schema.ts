import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AdminAuditLogDocument = HydratedDocument<AdminAuditLog>;

export enum AdminAuditAction {
  UserRoleUpdated = 'USER_ROLE_UPDATED',
  UserStatusUpdated = 'USER_STATUS_UPDATED',
  UserLocked = 'USER_LOCKED',
  UserUnlocked = 'USER_UNLOCKED',
  RolePermissionUpdated = 'ROLE_PERMISSION_UPDATED',
  CategoryCreated = 'CATEGORY_CREATED',
  CategoryUpdated = 'CATEGORY_UPDATED',
  CategoryStatusUpdated = 'CATEGORY_STATUS_UPDATED',
  CategoryReordered = 'CATEGORY_REORDERED',
  CategoryDeleted = 'CATEGORY_DELETED',
  SystemPolicyCreated = 'SYSTEM_POLICY_CREATED',
  SystemPolicyUpdated = 'SYSTEM_POLICY_UPDATED',
  SystemPolicyActivated = 'SYSTEM_POLICY_ACTIVATED',
  SystemPolicyDeactivated = 'SYSTEM_POLICY_DEACTIVATED',
  SystemPolicySeeded = 'SYSTEM_POLICY_SEEDED',
  SettlementCreated = 'SETTLEMENT_CREATED',
  SettlementHeld = 'SETTLEMENT_HELD',
  SettlementReleased = 'SETTLEMENT_RELEASED',
  SettlementMarkedSettled = 'SETTLEMENT_MARKED_SETTLED',
  SettlementCancelled = 'SETTLEMENT_CANCELLED',
  SettlementRegenerated = 'SETTLEMENT_REGENERATED',
}

@Schema({ collection: 'admin_audit_logs', timestamps: { createdAt: true, updatedAt: false } })
export class AdminAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  actorId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  targetUserId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, trim: true, uppercase: true, index: true })
  targetRoleCode?: string | null;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  targetCategoryId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  targetSystemPolicyId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  targetSettlementId?: Types.ObjectId | null;

  @Prop({ enum: AdminAuditAction, required: true, index: true })
  action: AdminAuditAction;

  @Prop({ type: Object, default: null })
  before?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  after?: Record<string, unknown> | null;

  @Prop({ type: String, default: null, trim: true })
  reason?: string | null;

  @Prop({ type: String, default: null })
  ip?: string | null;

  @Prop({ type: String, default: null })
  userAgent?: string | null;

  createdAt?: Date;
}

export const AdminAuditLogSchema =
  SchemaFactory.createForClass(AdminAuditLog);
AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ actorId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetUserId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetRoleCode: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetCategoryId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetSystemPolicyId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetSettlementId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ action: 1, createdAt: -1 });
