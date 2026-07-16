import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AdminAuditAction,
  AdminAuditLog,
} from '../schemas/admin-audit-log.schema';
import {
  SecurityEvent,
  SecurityEventType,
} from '../schemas/security-event.schema';

export interface SecurityRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

interface AdminAuditInput {
  actorId: Types.ObjectId | null;
  action: AdminAuditAction;
  targetUserId?: Types.ObjectId | null;
  targetRoleCode?: string | null;
  targetCategoryId?: Types.ObjectId | null;
  targetSystemPolicyId?: Types.ObjectId | null;
  targetSettlementId?: Types.ObjectId | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  context?: SecurityRequestContext;
}

interface SecurityEventInput {
  type: SecurityEventType;
  userId?: Types.ObjectId | null;
  email?: string | null;
  metadata?: Record<string, unknown> | null;
  context?: SecurityRequestContext;
}

@Injectable()
export class SecurityLogService {
  private readonly logger = new Logger(SecurityLogService.name);

  constructor(
    @InjectModel(AdminAuditLog.name)
    private readonly adminAuditLogModel: Model<AdminAuditLog>,
    @InjectModel(SecurityEvent.name)
    private readonly securityEventModel: Model<SecurityEvent>,
  ) {}

  async recordAdminAudit(input: AdminAuditInput): Promise<void> {
    try {
      await this.adminAuditLogModel.create({
        actorId: input.actorId,
        targetUserId: input.targetUserId ?? null,
        targetRoleCode: input.targetRoleCode ?? null,
        targetCategoryId: input.targetCategoryId ?? null,
        targetSystemPolicyId: input.targetSystemPolicyId ?? null,
        targetSettlementId: input.targetSettlementId ?? null,
        action: input.action,
        before: input.before ?? null,
        after: input.after ?? null,
        reason: input.reason ?? null,
        ip: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
      });
    } catch (error) {
      this.logger.error('Failed to record admin audit log', error);
    }
  }

  async recordSecurityEvent(input: SecurityEventInput): Promise<void> {
    try {
      await this.securityEventModel.create({
        type: input.type,
        userId: input.userId ?? null,
        email: input.email ?? null,
        metadata: input.metadata ?? null,
        ip: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
      });
    } catch (error) {
      this.logger.error('Failed to record security event', error);
    }
  }
}
