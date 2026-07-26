import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AdminAuditAction } from '../../auth/schemas/admin-audit-log.schema';
import {
  SecurityLogService,
  SecurityRequestContext,
} from '../../auth/services/security-log.service';
import { PolicyCode } from '../constants/policy-code.enum';
import { PolicyErrorCode } from '../constants/policy-error-codes';
import { PolicyStatus } from '../constants/policy-status.enum';
import {
  ActivatePolicyDto,
  CreateSystemPolicyDto,
  DeactivatePolicyDto,
  QuerySystemPoliciesDto,
  UpdateSystemPolicyDto,
} from '../dto/system-policy.dto';
import {
  SystemPolicy,
  SystemPolicyDocument,
} from '../schemas/system-policy.schema';
import {
  DEFAULT_POLICY_NAMES,
  DEFAULT_POLICY_VALUES,
  POLICY_CODE_TYPE_MAP,
} from './default-policy-values';
import { PolicyActivationLockService } from './policy-activation-lock.service';
import { PolicyResolverService } from './policy-resolver.service';
import { PolicyValidationService } from './policy-validation.service';

type ActivationMode = 'TRANSACTION' | 'COMPENSATION';

@Injectable()
export class SystemPoliciesService implements OnModuleInit {
  constructor(
    @InjectModel(SystemPolicy.name)
    private readonly policyModel: Model<SystemPolicy>,
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
    private readonly validationService: PolicyValidationService,
    private readonly resolverService: PolicyResolverService,
    private readonly activationLockService: PolicyActivationLockService,
    private readonly securityLogService: SecurityLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultPolicies();
  }

  async findPolicies(
    query: QuerySystemPoliciesDto,
  ): Promise<Record<string, unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};

    if (query.code) filter.code = query.code;
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      this.policyModel
        .find(filter)
        .sort({ code: 1, version: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.policyModel.countDocuments(filter),
    ]);

    return {
      data: items.map((policy) => this.toResponse(policy)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findVersionsByCode(code: string): Promise<Record<string, unknown>> {
    const normalizedCode = this.parsePolicyCode(code);
    const items = await this.policyModel
      .find({ code: normalizedCode })
      .sort({ version: -1 })
      .lean();

    return { data: items.map((policy) => this.toResponse(policy)) };
  }

  async findById(id: string): Promise<Record<string, unknown>> {
    return this.toResponse(await this.loadPolicy(id));
  }

  async createPolicy(
    actorId: string,
    dto: CreateSystemPolicyDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId, 'INVALID_ACTOR_ID');
    this.validationService.validateCodeAndType(dto.code, dto.type);
    this.validationService.validatePolicyValue(dto.code, dto.value);

    const policy = await this.createDraftWithVersionRetry(actorObjectId, dto, 0);

    await this.recordAudit({
      actorId: actorObjectId,
      action: AdminAuditAction.SystemPolicyCreated,
      targetSystemPolicyId: policy._id,
      after: this.toAuditState(policy),
      reason: 'Create system policy draft',
      context,
    });

    return this.toResponse(policy);
  }

  async updatePolicy(
    actorId: string,
    id: string,
    dto: UpdateSystemPolicyDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId, 'INVALID_ACTOR_ID');
    const policy = await this.loadPolicy(id);

    if (policy.status === PolicyStatus.Active) {
      throw new BadRequestException(PolicyErrorCode.ActiveCannotBeUpdated);
    }

    const before = this.toAuditState(policy);

    if (dto.name !== undefined) {
      policy.name = this.normalizeName(dto.name);
    }
    if (dto.description !== undefined) {
      policy.description = this.nullableTrim(dto.description);
    }
    if (dto.value !== undefined) {
      this.validationService.validatePolicyValue(policy.code, dto.value);
      policy.value = dto.value;
    }

    policy.updatedBy = actorObjectId;
    policy.reason = dto.reason ?? policy.reason ?? null;
    await policy.save();
    this.resolverService.clearCache(policy.code);

    await this.recordAudit({
      actorId: actorObjectId,
      action: AdminAuditAction.SystemPolicyUpdated,
      targetSystemPolicyId: policy._id,
      before,
      after: this.toAuditState(policy),
      reason: dto.reason ?? null,
      context,
    });

    return this.toResponse(policy);
  }

  async activatePolicy(
    actorId: string,
    id: string,
    dto: ActivatePolicyDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId, 'INVALID_ACTOR_ID');
    const target = await this.loadPolicy(id);
    this.assertReason(dto.reason);
    this.assertActivatable(target);
    this.validationService.validatePolicyValue(target.code, target.value);

    if (!this.activationLockService.acquire(target.code, actorId)) {
      throw new BadRequestException(PolicyErrorCode.ConcurrentActivation);
    }

    try {
      const activated =
        this.activationMode() === 'TRANSACTION'
          ? await this.activateWithTransaction(target._id, actorObjectId, dto.reason)
          : await this.activateWithCompensation(target._id, actorObjectId, dto.reason);

      this.resolverService.clearCache(activated.code);

      await this.recordAudit({
        actorId: actorObjectId,
        action: AdminAuditAction.SystemPolicyActivated,
        targetSystemPolicyId: activated._id,
        after: this.toAuditState(activated),
        reason: dto.reason,
        context,
      });

      return this.toResponse(activated);
    } finally {
      this.activationLockService.release(target.code, actorId);
    }
  }

  async deactivateByAdmin(
    actorId: string,
    id: string,
    dto: DeactivatePolicyDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId, 'INVALID_ACTOR_ID');
    const policy = await this.loadPolicy(id);
    this.assertReason(dto.reason);

    if (policy.status === PolicyStatus.Active) {
      throw new BadRequestException(
        PolicyErrorCode.LastActiveCannotBeDeactivated,
      );
    }

    if (policy.status === PolicyStatus.Inactive) {
      return this.toResponse(policy);
    }

    const before = this.toAuditState(policy);
    policy.status = PolicyStatus.Inactive;
    policy.deactivatedBy = actorObjectId;
    policy.deactivatedAt = new Date();
    policy.reason = dto.reason;
    policy.updatedBy = actorObjectId;
    await policy.save();
    this.resolverService.clearCache(policy.code);

    await this.recordAudit({
      actorId: actorObjectId,
      action: AdminAuditAction.SystemPolicyDeactivated,
      targetSystemPolicyId: policy._id,
      before,
      after: this.toAuditState(policy),
      reason: dto.reason,
      context,
    });

    return this.toResponse(policy);
  }

  async seedDefaultPolicies(): Promise<void> {
    for (const code of Object.values(PolicyCode)) {
      const exists = await this.policyModel.exists({ code });
      if (exists) continue;

      try {
        const policy = await new this.policyModel({
          code,
          type: POLICY_CODE_TYPE_MAP[code],
          name: DEFAULT_POLICY_NAMES[code],
          description: 'Default system policy seeded at bootstrap',
          value: DEFAULT_POLICY_VALUES[code] as unknown as Record<
            string,
            unknown
          >,
          status: PolicyStatus.Active,
          version: 1,
          createdBy: null,
          activatedBy: null,
          activatedAt: new Date(),
          reason: 'Bootstrap default policy',
        }).save();
        this.resolverService.clearCache(code);
        await this.recordAudit({
          actorId: null,
          action: AdminAuditAction.SystemPolicySeeded,
          targetSystemPolicyId: policy._id,
          after: this.toAuditState(policy),
          reason: 'Bootstrap default policy',
        });
      } catch (error) {
        if (!this.isDuplicateKeyError(error)) {
          throw error;
        }
      }
    }
  }

  private async createDraftWithVersionRetry(
    actorId: Types.ObjectId,
    dto: CreateSystemPolicyDto,
    attempt: number,
  ): Promise<SystemPolicyDocument> {
    const latest = await this.policyModel
      .findOne({ code: dto.code })
      .sort({ version: -1 })
      .lean();
    const version = (latest?.version ?? 0) + 1;

    try {
      return await this.policyModel.create({
        code: dto.code,
        type: dto.type,
        name: this.normalizeName(dto.name),
        description: this.nullableTrim(dto.description),
        value: dto.value,
        status: PolicyStatus.Draft,
        version,
        createdBy: actorId,
        updatedBy: actorId,
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error) && attempt < 1) {
        return this.createDraftWithVersionRetry(actorId, dto, attempt + 1);
      }

      if (this.isDuplicateKeyError(error)) {
        throw new BadRequestException(PolicyErrorCode.VersionConflict);
      }

      throw error;
    }
  }

  private async activateWithTransaction(
    targetId: Types.ObjectId,
    actorId: Types.ObjectId,
    reason: string,
  ): Promise<SystemPolicyDocument> {
    const session = await this.connection.startSession();

    try {
      let activated: SystemPolicyDocument | null = null;
      await session.withTransaction(async () => {
        const target = await this.policyModel.findById(targetId).session(session);
        if (!target) throw new NotFoundException(PolicyErrorCode.NotFound);
        this.assertActivatable(target);

        const oldActive = await this.policyModel
          .findOne({
            code: target.code,
            status: PolicyStatus.Active,
            _id: { $ne: target._id },
          })
          .session(session);

        await this.deactivateInternalForActivation(
          oldActive,
          actorId,
          session,
        );
        target.status = PolicyStatus.Active;
        target.activatedBy = actorId;
        target.activatedAt = new Date();
        target.deactivatedBy = null;
        target.deactivatedAt = null;
        target.updatedBy = actorId;
        target.reason = reason;
        await target.save({ session });
        activated = target;
      });

      if (!activated) {
        throw new BadRequestException(PolicyErrorCode.ActivateFailed);
      }

      return activated;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new BadRequestException(PolicyErrorCode.ConcurrentActivation);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async activateWithCompensation(
    targetId: Types.ObjectId,
    actorId: Types.ObjectId,
    reason: string,
  ): Promise<SystemPolicyDocument> {
    const target = await this.policyModel.findById(targetId);
    if (!target) throw new NotFoundException(PolicyErrorCode.NotFound);
    this.assertActivatable(target);

    const oldActive = await this.policyModel.findOne({
      code: target.code,
      status: PolicyStatus.Active,
      _id: { $ne: target._id },
    });

    await this.deactivateInternalForActivation(oldActive, actorId);

    try {
      target.status = PolicyStatus.Active;
      target.activatedBy = actorId;
      target.activatedAt = new Date();
      target.deactivatedBy = null;
      target.deactivatedAt = null;
      target.updatedBy = actorId;
      target.reason = reason;
      await target.save();
      return target;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const activePolicy = await this.policyModel.findOne({
          code: target.code,
          status: PolicyStatus.Active,
          _id: { $ne: oldActive?._id },
        });
        if (!activePolicy) {
          await this.rollbackOldActivePolicy(oldActive);
        }
        throw new BadRequestException(PolicyErrorCode.ConcurrentActivation);
      }

      await this.rollbackOldActivePolicy(oldActive);
      throw new BadRequestException(PolicyErrorCode.ActivateFailed);
    }
  }

  private async deactivateInternalForActivation(
    policy: SystemPolicyDocument | null,
    actorId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    if (!policy) return;

    policy.status = PolicyStatus.Inactive;
    policy.deactivatedBy = actorId;
    policy.deactivatedAt = new Date();
    policy.updatedBy = actorId;
    policy.reason = 'Replaced by newer active policy';
    await policy.save(session ? { session } : undefined);
  }

  private async rollbackOldActivePolicy(
    policy: SystemPolicyDocument | null,
  ): Promise<void> {
    if (!policy) return;

    const otherActive = await this.policyModel.exists({
      code: policy.code,
      status: PolicyStatus.Active,
      _id: { $ne: policy._id },
    });
    if (otherActive) return;

    policy.status = PolicyStatus.Active;
    policy.deactivatedBy = null;
    policy.deactivatedAt = null;
    policy.reason = 'Rollback after failed policy activation';
    await policy.save();
  }

  private assertActivatable(policy: SystemPolicyDocument): void {
    if (
      ![PolicyStatus.Draft, PolicyStatus.Inactive].includes(policy.status)
    ) {
      throw new BadRequestException(PolicyErrorCode.ActivateStatusInvalid);
    }
  }

  private assertReason(reason?: string): void {
    if (!reason?.trim()) {
      throw new BadRequestException(PolicyErrorCode.ReasonRequired);
    }
  }

  private activationMode(): ActivationMode {
    const configured = this.configService
      .get<string>('POLICY_ACTIVATION_MODE', 'COMPENSATION')
      .toUpperCase();
    return configured === 'TRANSACTION' ? 'TRANSACTION' : 'COMPENSATION';
  }

  private async loadPolicy(id: string): Promise<SystemPolicyDocument> {
    const policy = await this.policyModel.findById(
      this.toObjectId(id, PolicyErrorCode.InvalidId),
    );
    if (!policy) {
      throw new NotFoundException(PolicyErrorCode.NotFound);
    }
    return policy;
  }

  private parsePolicyCode(code: string): PolicyCode {
    if (!Object.values(PolicyCode).includes(code as PolicyCode)) {
      throw new BadRequestException('SYSTEM_POLICY_CODE_INVALID');
    }

    return code as PolicyCode;
  }

  private toObjectId(value: string, errorMessage: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(errorMessage);
    }
    return new Types.ObjectId(value);
  }

  private normalizeName(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      throw new BadRequestException('SYSTEM_POLICY_NAME_REQUIRED');
    }
    return normalized;
  }

  private nullableTrim(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private toResponse(policy: SystemPolicy | Record<string, any>) {
    const value = policy as Record<string, any>;
    return {
      id: value._id?.toString?.() ?? value.id,
      code: value.code,
      type: value.type,
      name: value.name,
      description: value.description ?? null,
      value: value.value,
      status: value.status,
      version: value.version,
      createdBy: value.createdBy?.toString?.() ?? value.createdBy ?? null,
      updatedBy: value.updatedBy?.toString?.() ?? value.updatedBy ?? null,
      activatedBy: value.activatedBy?.toString?.() ?? value.activatedBy ?? null,
      activatedAt: value.activatedAt ?? null,
      deactivatedBy:
        value.deactivatedBy?.toString?.() ?? value.deactivatedBy ?? null,
      deactivatedAt: value.deactivatedAt ?? null,
      reason: value.reason ?? null,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }

  private toAuditState(policy: SystemPolicy | SystemPolicyDocument) {
    return this.toResponse(policy);
  }

  private async recordAudit(input: {
    actorId: Types.ObjectId | null;
    action: AdminAuditAction;
    targetSystemPolicyId?: Types.ObjectId | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string | null;
    context?: SecurityRequestContext;
  }): Promise<void> {
    await this.securityLogService.recordAdminAudit(input);
  }
}
