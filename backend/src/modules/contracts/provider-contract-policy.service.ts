import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { hashContract } from './canonical-contract';
import { ContractAccessService } from './contract-access.service';
import { contractDb, contractObjectId } from './contract-source.types';
import { CONTRACTS_V2_ENABLED } from './contracts.constants';
import {
  AdminReviewPolicyDto,
  SaveProviderPolicyDraftDto,
} from './dto/provider-contract-policy.dto';
import {
  IncidentCompensationMethod,
  ProviderContractPolicyVersion,
  ProviderPolicyReviewStatus,
  resolveDamageCompensationRules,
} from './schemas/provider-contract-policy.schema';
import { validateDisputeResolutionClause } from './validators/dispute-terms-guardrail';

@Injectable()
export class ProviderContractPolicyService {
  constructor(
    @Inject(CONTRACTS_V2_ENABLED) private readonly enabled: boolean,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ProviderContractPolicyVersion.name)
    private readonly policyModel: Model<ProviderContractPolicyVersion>,
    private readonly access: ContractAccessService,
  ) {}

  async getCurrentPolicy(user: AuthUser) {
    const provider = await this.access.ownProvider(user);
    const versions = await this.policyModel
      .find({ providerId: provider._id })
      .sort({ versionNumber: -1 })
      .lean();

    const active = versions.find((v) => v.status === ProviderPolicyReviewStatus.Approved) || null;
    const pending = versions.find((v) => v.status === ProviderPolicyReviewStatus.PendingReview) || null;
    const draft = versions.find(
      (v) => v.status === ProviderPolicyReviewStatus.Draft || v.status === ProviderPolicyReviewStatus.Rejected,
    ) || null;

    return {
      providerId: provider._id.toString(),
      active,
      pending,
      draft,
      totalVersions: versions.length,
    };
  }

  async getVersions(user: AuthUser) {
    const provider = await this.access.ownProvider(user);
    return this.policyModel
      .find({ providerId: provider._id })
      .sort({ versionNumber: -1 })
      .lean();
  }

  async saveDraft(user: AuthUser, dto: SaveProviderPolicyDraftDto) {
    if (!this.enabled) throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
    const provider = await this.access.ownProvider(user);

    // Validate platform guardrails before saving draft
    this.assertGuardrails(dto);

    const latest = await this.policyModel
      .findOne({ providerId: provider._id })
      .sort({ versionNumber: -1 });

    if (latest && latest.status === ProviderPolicyReviewStatus.PendingReview) {
      throw new ConflictException(
        'POLICY_PENDING_REVIEW_LOCKED: Chính sách đang chờ Ban Quản trị phê duyệt, không thể chỉnh sửa.',
      );
    }

    const businessApprovalRequired = this.checkBusinessApprovalRequired(dto);

    if (
      latest &&
      (latest.status === ProviderPolicyReviewStatus.Draft ||
        latest.status === ProviderPolicyReviewStatus.Rejected)
    ) {
      // Update existing draft / rejected version
      latest.garmentCare = dto.garmentCare;
      latest.lateReturn = dto.lateReturn;
      latest.damageCompensation = dto.damageCompensation;
      latest.cancellationPolicy = dto.cancellationPolicy;
      latest.supportContact = dto.supportContact;
      latest.customTermsText = dto.customTermsText ?? null;
      latest.status = ProviderPolicyReviewStatus.Draft;
      latest.reviewNote = null;
      latest.businessApprovalRequired = businessApprovalRequired;
      return latest.save();
    }

    // Otherwise create a new draft version
    const nextVersionNumber = latest ? latest.versionNumber + 1 : 1;
    return this.policyModel.create({
      providerId: provider._id,
      versionNumber: nextVersionNumber,
      status: ProviderPolicyReviewStatus.Draft,
      garmentCare: dto.garmentCare,
      lateReturn: dto.lateReturn,
      damageCompensation: dto.damageCompensation,
      cancellationPolicy: dto.cancellationPolicy,
      supportContact: dto.supportContact,
      customTermsText: dto.customTermsText ?? null,
      businessApprovalRequired,
    });
  }

  async submitForReview(user: AuthUser, dto?: SaveProviderPolicyDraftDto) {
    if (!this.enabled) throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
    const provider = await this.access.ownProvider(user);

    if (dto) {
      await this.saveDraft(user, dto);
    }

    const draft = await this.policyModel
      .findOne({
        providerId: provider._id,
        status: {
          $in: [
            ProviderPolicyReviewStatus.Draft,
            ProviderPolicyReviewStatus.Rejected,
          ],
        },
      })
      .sort({ versionNumber: -1 });

    if (!draft) {
      throw new BadRequestException('NO_DRAFT_POLICY_TO_SUBMIT');
    }

    // Rigorous submission readiness and guardrails check
    this.assertSubmissionReadiness(draft);

    const plain = typeof draft.toObject === 'function' ? draft.toObject() : draft;
    const canonicalData = {
      garmentCare: plain.garmentCare,
      lateReturn: plain.lateReturn,
      damageCompensation: plain.damageCompensation,
      cancellationPolicy: plain.cancellationPolicy,
      supportContact: plain.supportContact,
      customTermsText: plain.customTermsText || null,
    };
    const policyFingerprint = hashContract(canonicalData);

    draft.status = ProviderPolicyReviewStatus.PendingReview;
    draft.submittedAt = new Date();
    draft.policyFingerprint = policyFingerprint;
    draft.reviewNote = null;

    return draft.save();
  }

  async adminReview(adminUser: AuthUser, versionId: string, dto: AdminReviewPolicyDto) {
    if (!adminUser.roles.includes('ADMIN')) {
      throw new ForbiddenException('ADMIN_ROLE_REQUIRED');
    }

    const versionObjId = Types.ObjectId.isValid(versionId)
      ? new Types.ObjectId(versionId)
      : versionId;
    const version = await this.policyModel.findById(versionObjId);
    if (!version) throw new NotFoundException('POLICY_VERSION_NOT_FOUND');

    if (version.status !== ProviderPolicyReviewStatus.PendingReview) {
      throw new ConflictException('POLICY_NOT_PENDING_REVIEW');
    }

    const now = new Date();
    const adminObjectId = new Types.ObjectId(adminUser.sub);

    if (dto.action === 'APPROVE') {
      // Backend re-verifies dispute resolution guardrail of the exact policy version being approved
      const rawDispute =
        version.damageCompensation?.disputeResolutionTerms ||
        version.damageCompensation?.disputeResolutionNotes;
      const disputeCheck = validateDisputeResolutionClause(rawDispute);
      if (!disputeCheck.isValid) {
        throw new UnprocessableEntityException(
          `GUARDRAIL_UNAUTHORIZED_DISPUTE_POWERS: Không thể phê duyệt chính sách chứa điều khoản tranh chấp trái thẩm quyền: ${disputeCheck.errorMessage}`,
        );
      }
    } else {
      if (!dto.reviewNote || !dto.reviewNote.trim()) {
        throw new BadRequestException('REVIEW_NOTE_REQUIRED: Bắt buộc cung cấp lý do từ chối để Shop điều chỉnh.');
      }
    }

    // Atomic conditional update to prevent approve/reject race condition
    let updatedVersion: any = null;
    if (typeof this.policyModel.findOneAndUpdate === 'function') {
      updatedVersion = await this.policyModel.findOneAndUpdate(
        {
          _id: versionObjId,
          status: ProviderPolicyReviewStatus.PendingReview,
        },
        {
          $set: {
            status:
              dto.action === 'APPROVE'
                ? ProviderPolicyReviewStatus.Approved
                : ProviderPolicyReviewStatus.Rejected,
            reviewedAt: now,
            reviewedByUserId: adminObjectId,
            approvedAt: dto.action === 'APPROVE' ? now : null,
            reviewNote:
              dto.action === 'APPROVE'
                ? (dto.reviewNote ?? null)
                : (dto.reviewNote?.trim() || null),
          },
        },
        { new: true },
      );
    } else {
      version.status =
        dto.action === 'APPROVE'
          ? ProviderPolicyReviewStatus.Approved
          : ProviderPolicyReviewStatus.Rejected;
      version.reviewedAt = now;
      version.reviewedByUserId = adminObjectId;
      version.approvedAt = dto.action === 'APPROVE' ? now : null;
      version.reviewNote =
        dto.action === 'APPROVE'
          ? (dto.reviewNote ?? null)
          : (dto.reviewNote?.trim() || null);
      updatedVersion =
        typeof (version as any).save === 'function'
          ? await (version as any).save()
          : version;
    }

    if (!updatedVersion) {
      // Version was already transitioned by a concurrent review request
      throw new ConflictException('POLICY_NOT_PENDING_REVIEW');
    }

    if (dto.action === 'APPROVE') {
      // Mark previously approved version as SUPERSEDED
      await this.policyModel.updateMany(
        {
          providerId: updatedVersion.providerId,
          _id: { $ne: updatedVersion._id },
          status: ProviderPolicyReviewStatus.Approved,
        },
        {
          $set: { status: ProviderPolicyReviewStatus.Superseded },
        },
      );

      // Touch provider updatedAt to trigger policy freshness / drift awareness
      await contractDb(this.connection)
        .collection('providers')
        .updateOne(
          { _id: updatedVersion.providerId },
          { $set: { updatedAt: now } },
        );
    }

    // Gửi thông báo đến tài khoản Provider khi chính sách được duyệt hoặc từ chối
    try {
      const providerCol = contractDb(this.connection).collection('providers');
      if (providerCol && typeof providerCol.findOne === 'function') {
        const provider = await providerCol.findOne(
          { _id: updatedVersion.providerId },
          { projection: { userId: 1 } },
        );

        if (provider?.userId) {
          const notifCol = contractDb(this.connection).collection('notifications');
          if (notifCol && typeof notifCol.insertOne === 'function') {
            await notifCol.insertOne({
              userId: provider.userId,
              title:
                dto.action === 'APPROVE'
                  ? 'Chính sách hợp đồng đã được phê duyệt'
                  : 'Chính sách hợp đồng cần điều chỉnh lại',
              content:
                dto.action === 'APPROVE'
                  ? `Chính sách hợp đồng phiên bản v${updatedVersion.versionNumber} của bạn đã được Ban Quản trị VibeHue phê duyệt thành công.${dto.reviewNote ? ` Ghi chú: ${dto.reviewNote}` : ''}`
                  : `Chính sách hợp đồng phiên bản v${updatedVersion.versionNumber} chưa được phê duyệt. Lý do: ${dto.reviewNote?.trim() || ''}. Vui lòng chỉnh sửa lại bản thảo và gửi duyệt lại.`,
              type: 'SYSTEM',
              isRead: false,
              readAt: null,
              metadata: {
                type: 'PROVIDER_POLICY_REVIEW',
                policyVersionId: updatedVersion._id,
                versionNumber: updatedVersion.versionNumber,
                action: dto.action,
                reviewNote: dto.reviewNote?.trim() || null,
              },
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    } catch {
      // Non-blocking notification emission
    }

    return updatedVersion;
  }

  async getPendingPoliciesForAdmin(adminUser: AuthUser) {
    if (!adminUser.roles.includes('ADMIN')) {
      throw new ForbiddenException('ADMIN_ROLE_REQUIRED: Chỉ Quản trị viên sàn mới có quyền xem danh sách chờ duyệt.');
    }

    const pendingList = await this.policyModel
      .find({ status: ProviderPolicyReviewStatus.PendingReview })
      .sort({ submittedAt: -1 })
      .lean();

    if (pendingList.length === 0) return [];

    const providerIds = pendingList.map((p) => p.providerId);
    const providers = await contractDb(this.connection)
      .collection('providers')
      .find({ _id: { $in: providerIds } })
      .project({ _id: 1, userId: 1, name: 1, shopName: 1, businessName: 1, email: 1, phone: 1 })
      .toArray();

    const providerMap = new Map(providers.map((pr) => [pr._id.toString(), pr]));

    return pendingList.map((policy) => {
      const prov = providerMap.get(policy.providerId.toString());
      return {
        ...policy,
        id: policy._id.toString(),
        providerInfo: {
          id: policy.providerId.toString(),
          shopName: prov?.shopName || prov?.businessName || prov?.name || 'Shop đối tác',
          email: prov?.email || null,
          phone: prov?.phone || null,
        },
      };
    });
  }

  async getPolicyDetailForAdmin(adminUser: AuthUser, versionId: string) {
    if (!adminUser.roles.includes('ADMIN')) {
      throw new ForbiddenException('ADMIN_ROLE_REQUIRED: Chỉ Quản trị viên sàn mới có quyền xem chi tiết chính sách.');
    }

    const policy = await this.policyModel.findById(versionId).lean();
    if (!policy) throw new NotFoundException('POLICY_VERSION_NOT_FOUND');

    const provider = await contractDb(this.connection)
      .collection('providers')
      .findOne(
        { _id: policy.providerId },
        { projection: { _id: 1, name: 1, shopName: 1, businessName: 1, email: 1, phone: 1 } },
      );

    const activePolicy = await this.policyModel
      .findOne({
        providerId: policy.providerId,
        status: ProviderPolicyReviewStatus.Approved,
      })
      .sort({ versionNumber: -1 })
      .lean();

    const allVersions = await this.policyModel
      .find({ providerId: policy.providerId })
      .sort({ versionNumber: -1 })
      .select({ versionNumber: 1, status: 1, submittedAt: 1, approvedAt: 1, reviewedAt: 1, reviewNote: 1 })
      .lean();

    return {
      current: {
        ...policy,
        id: policy._id.toString(),
      },
      activeApproved: activePolicy ? { ...activePolicy, id: activePolicy._id.toString() } : null,
      history: allVersions.map((v) => ({ ...v, id: v._id.toString() })),
      providerInfo: {
        id: policy.providerId.toString(),
        shopName: provider?.shopName || provider?.businessName || provider?.name || 'Shop đối tác',
        email: provider?.email || null,
        phone: provider?.phone || null,
      },
    };
  }

  async getActiveApprovedPolicy(providerId: Types.ObjectId) {
    return this.policyModel
      .findOne({
        providerId,
        status: ProviderPolicyReviewStatus.Approved,
      })
      .sort({ versionNumber: -1 })
      .lean();
  }

  private assertSubmissionReadiness(draft: any) {
    this.assertGuardrails(draft);

    const damageComp = draft.damageCompensation;
    if (!damageComp) {
      throw new UnprocessableEntityException(
        'MISSING_DAMAGE_COMPENSATION_POLICY: Chính sách bồi thường hư hỏng chưa được thiết lập.',
      );
    }

    const hasV2Tiers = Boolean(
      damageComp.minorDamage?.method ||
      damageComp.moderateDamage?.method ||
      damageComp.severeDamage?.method ||
      damageComp.totalLoss?.method,
    );

    if (hasV2Tiers) {
      const tiers = [
        { key: 'minorDamage', name: 'Hư hỏng nhẹ', rule: damageComp.minorDamage },
        { key: 'moderateDamage', name: 'Hư hỏng vừa', rule: damageComp.moderateDamage },
        { key: 'severeDamage', name: 'Hư hỏng nặng', rule: damageComp.severeDamage },
        { key: 'totalLoss', name: 'Mất trang phục', rule: damageComp.totalLoss },
      ];

      for (const t of tiers) {
        if (!t.rule || !t.rule.method) {
          throw new UnprocessableEntityException(
            `INCOMPLETE_TIER_COMPENSATION: Cần hoàn tất thiết lập phương thức cho '${t.name}' trước khi gửi duyệt.`,
          );
        }

        if (t.rule.method === IncidentCompensationMethod.FIXED_FEE) {
          if (typeof t.rule.fixedFeeAmount !== 'number' || t.rule.fixedFeeAmount < 0) {
            throw new UnprocessableEntityException(
              `INVALID_TIER_FIXED_FEE: Mức phí cố định cho '${t.name}' phải là số tiền hợp lệ (>= 0).`,
            );
          }
        } else if (t.rule.method === IncidentCompensationMethod.PERCENTAGE_ON_ASSET) {
          if (
            typeof t.rule.percentageOfAsset !== 'number' ||
            t.rule.percentageOfAsset < 1 ||
            t.rule.percentageOfAsset > 100
          ) {
            throw new UnprocessableEntityException(
              `INVALID_TIER_PERCENTAGE: Tỷ lệ bồi thường cho '${t.name}' phải từ 1% đến 100%.`,
            );
          }
        } else if (
          t.rule.method === IncidentCompensationMethod.ACTUAL_REPAIR_COST ||
          t.rule.method === IncidentCompensationMethod.INCIDENT_NEGOTIATION
        ) {
          const evidence = (t.rule.conditionsAndEvidence || '').trim();
          if (evidence.length < 5) {
            throw new UnprocessableEntityException(
              `MISSING_TIER_EVIDENCE_CONDITIONS: Cần nêu rõ căn cứ và chứng từ xác minh cho '${t.name}'.`,
            );
          }
        }
      }
    }
  }

  private assertGuardrails(data: any) {
    const { lateReturn, damageCompensation, cancellationPolicy, customTermsText } = data;

    // Technical non-negative validation
    if (lateReturn) {
      if (lateReturn.gracePeriodHours < 0) {
        throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Thời gian ân hạn không được âm.');
      }
      if (lateReturn.hourlyLateFee < 0) {
        throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Phí trễ mỗi giờ không được âm.');
      }
      if (lateReturn.dailyLateFee < 0) {
        throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Phí trễ mỗi ngày không được âm.');
      }
      if (lateReturn.maxLateDaysAllowed < 1) {
        throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Số ngày trễ tối đa phải từ 1 ngày.');
      }
    }

    if (damageCompensation) {
      // Legacy bounds check if present
      if (typeof damageCompensation.minorDamageFee === 'number' && damageCompensation.minorDamageFee < 0) {
        throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Phí lỗi nhỏ không được âm.');
      }
      if (
        typeof damageCompensation.moderateDamagePercent === 'number' &&
        (damageCompensation.moderateDamagePercent < 0 || damageCompensation.moderateDamagePercent > 100)
      ) {
        throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Tỷ lệ bồi thường hư hỏng vừa phải từ 0% đến 100%.');
      }
      if (
        typeof damageCompensation.severeDamageOrLossPercent === 'number' &&
        (damageCompensation.severeDamageOrLossPercent < 0 || damageCompensation.severeDamageOrLossPercent > 100)
      ) {
        throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Tỷ lệ bồi thường mất đồ phải từ 0% đến 100%.');
      }

      // V2 bounds check
      const v2Tiers = [
        damageCompensation.minorDamage,
        damageCompensation.moderateDamage,
        damageCompensation.severeDamage,
        damageCompensation.totalLoss,
      ].filter(Boolean);

      for (const t of v2Tiers) {
        if (typeof t.fixedFeeAmount === 'number' && t.fixedFeeAmount < 0) {
          throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Phí bồi thường không được âm.');
        }
        if (
          typeof t.percentageOfAsset === 'number' &&
          (t.percentageOfAsset < 0 || t.percentageOfAsset > 100)
        ) {
          throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Tỷ lệ bồi thường phải từ 0% đến 100%.');
        }
        if (t.conditionsAndEvidence && t.conditionsAndEvidence.length > 500) {
          throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Điều kiện chứng minh tối đa 500 ký tự.');
        }
      }

      if (
        typeof damageCompensation.incidentNotificationHours === 'number' &&
        damageCompensation.incidentNotificationHours < 1
      ) {
        throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Thời hạn thông báo sự cố phải từ 1 giờ.');
      }
      const rawDispute = damageCompensation.disputeResolutionTerms || damageCompensation.disputeResolutionNotes;
      if (rawDispute && rawDispute.length > 1000) {
        throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Điều khoản giải quyết tranh chấp tối đa 1000 ký tự.');
      }
      const disputeCheck = validateDisputeResolutionClause(rawDispute);
      if (!disputeCheck.isValid) {
        throw new UnprocessableEntityException(
          `GUARDRAIL_UNAUTHORIZED_DISPUTE_POWERS: ${disputeCheck.errorMessage}`,
        );
      }
    }

    // Cancellation refund rules: must have at least 1 rule, each rule percentage 0 - 100%
    if (cancellationPolicy) {
      if (!Array.isArray(cancellationPolicy.refundRules) || cancellationPolicy.refundRules.length === 0) {
        throw new UnprocessableEntityException('GUARDRAIL_CANCELLATION_RULES_EMPTY: Cần ít nhất 1 mốc hoàn tiền khi hủy đơn.');
      }
      for (const rule of cancellationPolicy.refundRules) {
        if (rule.daysBeforeRental < 0 || rule.refundPercentage < 0 || rule.refundPercentage > 100) {
          throw new UnprocessableEntityException('TECHNICAL_VALIDATION_ERROR: Mốc hoàn tiền hoặc tỷ lệ phần trăm hủy đơn không hợp lệ.');
        }
      }
    }

    // Custom terms text: max 1000 chars
    if (customTermsText && customTermsText.length > 1000) {
      throw new UnprocessableEntityException('GUARDRAIL_CUSTOM_TERMS_TOO_LONG: Điều khoản tùy chỉnh tối đa 1000 ký tự.');
    }
  }

  private checkBusinessApprovalRequired(data: any): boolean {
    const { lateReturn, damageCompensation } = data;
    if (!lateReturn || !damageCompensation) return false;
    return (
      (lateReturn.gracePeriodHours ?? 0) > 6 ||
      (lateReturn.hourlyLateFee ?? 0) > 50000 ||
      (lateReturn.dailyLateFee ?? 0) > 200000 ||
      (lateReturn.maxLateDaysAllowed ?? 0) > 7 ||
      (damageCompensation.minorDamageFee != null && damageCompensation.minorDamageFee > 100000) ||
      (damageCompensation.moderateDamagePercent != null &&
        (damageCompensation.moderateDamagePercent < 10 || damageCompensation.moderateDamagePercent > 30)) ||
      (damageCompensation.severeDamageOrLossPercent != null && damageCompensation.severeDamageOrLossPercent < 50)
    );
  }
}
