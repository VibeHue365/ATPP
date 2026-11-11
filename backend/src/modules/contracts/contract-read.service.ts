import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  ContractScope,
  DigitalContract,
} from '../bookings/schemas/digital-contract.schema';
import { ContractVersion } from './schemas/contract-version.schema';
import {
  ContractConsent,
  ContractConsentAction,
} from './schemas/contract-consent.schema';
import { ContractVersionState } from './schemas/contract-version.schema';
import { ContractAccessService } from './contract-access.service';
import { ContractPolicyService } from './contract-policy.service';
import { ContractTemplate, ContractTemplateService } from './contract-template';
import { ContractSnapshotService } from './contract-snapshot.service';
import { ContractPreparationService } from './contract-preparation.service';
import { hashContract } from './canonical-contract';
import { CONTRACTS_V2_ENABLED } from './contracts.constants';
import {
  contractDb,
  contractObjectId,
  parseValidReplacementValue,
} from './contract-source.types';
import { resolveDamageCompensationRules } from './schemas/provider-contract-policy.schema';

@Injectable()
export class ContractReadService {
  constructor(
    @Inject(CONTRACTS_V2_ENABLED) private readonly enabled: boolean,
    @InjectModel(DigitalContract.name)
    private readonly contracts: Model<DigitalContract>,
    @InjectModel(ContractVersion.name)
    private readonly versions: Model<ContractVersion>,
    @InjectModel(ContractConsent.name)
    private readonly consents: Model<ContractConsent>,
    private readonly access: ContractAccessService,
    private readonly policy: ContractPolicyService,
    private readonly templates: ContractTemplateService,
    private readonly snapshots: ContractSnapshotService,
    private readonly preparation: ContractPreparationService,
    @InjectConnection() private readonly connection?: Connection,
  ) {}

  async listForBooking(user: AuthUser, bookingId: string) {
    const booking = await this.access.booking(bookingId);
    const scope = await this.access.assertBookingReader(user, booking);
    const filter: { bookingId: Types.ObjectId; providerId?: Types.ObjectId } = {
      bookingId: booking._id,
    };
    if (scope.kind === 'PROVIDER') filter.providerId = scope.providerId;
    const contracts = await this.contracts.find(filter).lean();
    const summaries = await Promise.all(
      contracts.map(async (contract) => this.summary(contract)),
    );

    // Void unaccepted drafts on cancelled bookings ONLY for CUSTOMER:
    // If the booking was cancelled before the contract was accepted/signed,
    // the draft contract has no legal effect and should not be displayed to the customer.
    // ADMIN and PROVIDER retain full audit visibility.
    // If signed (ACCEPTED, EFFECTIVE, TERMINATED, SUPERSEDED, or consent evidence exists),
    // it is preserved in history for audit and verification.
    if (scope.kind === 'CUSTOMER' && booking.status === 'CANCELLED') {
      return summaries.filter((s) => s.isSigned);
    }

    return summaries;
  }

  async getMyContracts(user: AuthUser) {
    if (!this.enabled) {
      return [];
    }
    const customerId = contractObjectId(user.sub);
    const contracts = await this.contracts
      .find({ customerId })
      .sort({ createdAt: -1 })
      .lean();

    if (contracts.length === 0) {
      return [];
    }

    const bookingIds = contracts.map((c) => c.bookingId);
    const conn = this.connection || (this.snapshots as any)?.connection;
    const db = contractDb(conn);

    const bookings = await db
      .collection('bookings')
      .find({ _id: { $in: bookingIds } })
      .project({
        bookingCode: 1,
        status: 1,
        createdAt: 1,
        startDate: 1,
        endDate: 1,
        rentalStartDate: 1,
        rentalEndDate: 1,
        totalAmount: 1,
        depositAmount: 1,
        bookingType: 1,
      })
      .toArray();

    const bookingMap = new Map<string, any>();
    for (const b of bookings) {
      bookingMap.set(b._id.toString(), b);
    }

    const results = await Promise.all(
      contracts.map(async (contract) => {
        const sum = await this.summary(contract);
        const booking = bookingMap.get(contract.bookingId.toString());
        return {
          ...sum,
          bookingCode:
            booking?.bookingCode ??
            contract.bookingId.toString().slice(-6).toUpperCase(),
          bookingStatus: booking?.status ?? 'UNKNOWN',
          bookingCreatedAt: booking?.createdAt ?? null,
          startDate:
            booking?.startDate ?? booking?.rentalStartDate ?? null,
          endDate: booking?.endDate ?? booking?.rentalEndDate ?? null,
          totalAmount: booking?.totalAmount ?? 0,
          depositAmount: booking?.depositAmount ?? 0,
          bookingType: booking?.bookingType ?? 'AODAI_RENTAL',
        };
      }),
    );

    // Filter out contracts of CANCELLED bookings that were never signed/accepted.
    // (As per Requirement 1 - Case A: CANCELLED before ACCEPT has no legal effect and must not be shown to Customer).
    return results.filter((c) => {
      if (c.bookingStatus === 'CANCELLED') {
        return c.isSigned;
      }
      return true;
    });
  }

  async get(user: AuthUser, contractId: string) {
    const contract = await this.contracts
      .findById(contractObjectId(contractId))
      .lean();
    if (!contract) throw new NotFoundException('CONTRACT_NOT_FOUND');
    const booking = await this.access.booking(contract.bookingId.toString());
    await this.access.assertContractReader(user, booking, contract.providerId);
    const version = contract.currentVersionId
      ? await this.versions.findById(contract.currentVersionId).lean()
      : null;
    if (version && version.contractId.toString() !== contract._id.toString())
      throw new NotFoundException('CONTRACT_VERSION_NOT_FOUND');
    return {
      ...(await this.summary(contract)),
      renderedText: version?.renderedText ?? contract.contractTerms ?? null,
      versionState: version?.state ?? null,
      expiresAt: version?.expiresAt ?? null,
      snapshot: version?.snapshot ?? null,
    };
  }

  async readiness(user: AuthUser, bookingId: string) {
    const booking = await this.access.booking(bookingId);
    const scope = await this.access.assertBookingReader(user, booking);

    if (await this.reconcileErroneousLegacyBooking(booking)) {
      booking.contractFlowVersion = null;
      booking.holdExpiresAt = null;
    }

    if (
      booking.contractFlowVersion !== 2 ||
      booking.bookingType === 'PHOTOGRAPHY'
    ) {
      return {
        requirement: 'NOT_REQUIRED',
        bookingId,
        providers: [],
        blockers: [],
        ready: true,
        flow: 'LEGACY',
      };
    }

    const context = await this.policy.getContext(bookingId);
    const providerIds =
      scope.kind === 'PROVIDER'
        ? context.rentalProviderIds.filter((id) => id.equals(scope.providerId))
        : context.rentalProviderIds;
    if (scope.kind === 'PROVIDER' && providerIds.length === 0)
      return {
        requirement: 'NOT_REQUIRED',
        bookingId,
        providers: [],
        blockers: [],
        ready: true,
        flow: 'LEGACY',
      };
    const blockers: string[] = [];
    if (!this.enabled) blockers.push('FEATURE_DISABLED');
    if (
      booking.status !== 'PENDING_PAYMENT' ||
      (booking.holdExpiresAt && booking.holdExpiresAt <= new Date())
    )
      blockers.push('BOOKING_NOT_PREPARABLE');
    let template: ContractTemplate | undefined;
    try {
      template = this.templates.getApproved();
    } catch {
      blockers.push('TEMPLATE_NOT_APPROVED');
    }
    const providers = await Promise.all(
      providerIds.map(async (providerId) => {
        let contract = await this.contracts
          .findOne({
            bookingId: booking._id,
            providerId,
            scope: ContractScope.AoDaiRental,
          })
          .lean();

        // Auto-prepare draft contract on demand when V2 is active
        if (
          (!contract || !contract.currentVersionId) &&
          this.enabled &&
          typeof this.preparation?.prepare === 'function'
        ) {
          try {
            await this.preparation.prepare(
              booking._id.toString(),
              providerId.toString(),
            );
            contract = await this.contracts
              .findOne({
                bookingId: booking._id,
                providerId,
                scope: ContractScope.AoDaiRental,
              })
              .lean();
          } catch (prepareErr: any) {
            console.error(
              `[ContractReadService] Auto-prepare failed: ${prepareErr?.message}`,
              prepareErr?.stack,
            );
            const errCode = prepareErr?.message || 'CONTRACT_PREPARATION_FAILED';
            blockers.push(errCode);
            return {
              providerId: providerId.toString(),
              status:
                errCode.startsWith('PROVIDER_AUTO_ACCEPTANCE') ||
                errCode === 'PROVIDER_POLICY_ACCEPTANCE_STALE'
                  ? 'PROVIDER_ACCEPTANCE_MISSING'
                  : 'MISSING_CONTRACT',
              version: null,
            };
          }
        }

        if (!contract || !contract.currentVersionId)
          return {
            providerId: providerId.toString(),
            status: 'MISSING_CONTRACT',
            version: null,
          };
        const version = await this.versions
          .findById(contract.currentVersionId)
          .lean();
        if (
          !version ||
          version.contractId.toString() !== contract._id.toString()
        )
          return {
            providerId: providerId.toString(),
            status: 'MISSING_VERSION',
            version: null,
          };
        const consent = await this.consents
          .findOne({
            contractVersionId: version._id,
            actorUserId: booking.customerId,
          })
          .lean();
        let status =
          consent?.action === ContractConsentAction.Accept &&
          version.state === ContractVersionState.Accepted
            ? 'ACCEPTED'
            : consent?.action === ContractConsentAction.Decline
              ? 'DECLINED'
              : version.expiresAt && version.expiresAt <= new Date()
                ? 'EXPIRED'
                : 'AWAITING_CUSTOMER';
        if (status === 'ACCEPTED' && template) {
          try {
            await this.preparation.assertLiveHold(context, providerId);
            if (!version.providerAcceptanceId)
              status = 'PROVIDER_ACCEPTANCE_MISSING';
            else {
              const snapshot = await this.snapshots.build(
                context,
                providerId,
                template,
              );
              const fingerprint = hashContract({
                booking: snapshot.booking,
                providerItems: snapshot.providerItems,
                pricing: snapshot.pricing,
              });
              if (
                fingerprint !== version.bookingFingerprint ||
                hashContract({ template, snapshot }) !== version.contentHash
              )
                status = 'STALE_SNAPSHOT';
            }
          } catch {
            status = 'SOURCE_NOT_READY';
          }
        }
        return {
          providerId: providerId.toString(),
          contractId: contract._id.toString(),
          versionId: version._id.toString(),
          version: version.version,
          presentationMode: (version as any)?.presentationMode || 'DETAILED',
          status,
        };
      }),
    );

    const overallPresentationMode =
      providers.length > 0 &&
      providers.every((p: any) => p.presentationMode === 'QUICK')
        ? 'QUICK'
        : 'DETAILED';

    return {
      requirement: 'REQUIRED',
      bookingId,
      presentationMode: overallPresentationMode,
      providers,
      blockers,
      ready:
        blockers.length === 0 &&
        providers.length > 0 &&
        providers.every((entry) => entry.status === 'ACCEPTED'),
      flow: 'CONTRACT_V2',
    };
  }

  async refreshContractsForBooking(user: AuthUser, bookingId: string) {
    const booking = await this.access.booking(bookingId);
    this.access.assertCustomer(user, booking);

    if (booking.contractFlowVersion !== 2) {
      throw new BadRequestException('LEGACY_BOOKING_NO_CONTRACT');
    }

    if (booking.status === 'CANCELLED') {
      throw new ConflictException('BOOKING_ALREADY_CANCELLED');
    }
    if (booking.status !== 'PENDING_PAYMENT') {
      throw new ConflictException('BOOKING_NOT_PREPARABLE');
    }
    if (booking.holdExpiresAt && new Date(booking.holdExpiresAt) <= new Date()) {
      throw new BadRequestException('BOOKING_EXPIRED: Đơn hàng đã hết thời gian giữ chỗ, vui lòng đặt lại đơn mới.');
    }

    const context = await this.policy.getContext(bookingId);
    for (const providerId of context.rentalProviderIds) {
      if (typeof this.preparation?.prepare === 'function') {
        await this.preparation.prepare(bookingId, providerId.toString());
      }
    }

    return this.readiness(user, bookingId);
  }

  private async summary(contract: {
    _id: Types.ObjectId;
    bookingId: Types.ObjectId;
    providerId: Types.ObjectId;
    scope?: string | null;
    status: string;
    currentVersionId?: Types.ObjectId | null;
    currentRevision?: number | null;
  }) {
    const version = contract.currentVersionId
      ? await this.versions.findById(contract.currentVersionId).lean()
      : null;

    // Determine immutable signing / acceptance status
    let hasConsent = false;
    try {
      if (typeof this.consents?.exists === 'function') {
        hasConsent = Boolean(
          await this.consents.exists({
            contractId: contract._id,
            action: ContractConsentAction.Accept,
          }),
        );
      } else if (typeof this.consents?.findOne === 'function') {
        const found = await this.consents.findOne({
          contractId: contract._id,
          action: ContractConsentAction.Accept,
        });
        hasConsent = Boolean(found);
      }
    } catch {
      hasConsent = false;
    }
    const isSigned =
      Boolean(hasConsent) ||
      Boolean(version?.customerAcceptedAt) ||
      ['ACCEPTED', 'EFFECTIVE', 'TERMINATED', 'SUPERSEDED'].includes(
        version?.state as string,
      ) ||
      contract.status === 'SIGNED' ||
      ((contract as any).signatures && (contract as any).signatures.length > 0);

    return {
      contractId: contract._id.toString(),
      contractCode: (contract as any).contractCode ?? null,
      bookingId: contract.bookingId.toString(),
      providerId: contract.providerId.toString(),
      providerName: (version as any)?.snapshot?.provider?.businessName ?? null,
      scope: contract.scope ?? null,
      legacyStatus: contract.status,
      versionId: version?._id.toString() ?? null,
      version: version?.version ?? null,
      state: version?.state ?? null,
      contentHash: version?.contentHash ?? null,
      bookingFingerprint: version?.bookingFingerprint ?? null,
      presentationMode: (version as any)?.presentationMode || 'DETAILED',
      riskTriggers: (version as any)?.riskTriggers || [],
      isSigned: Boolean(isSigned),
      customerAcceptedAt: version?.customerAcceptedAt ?? null,
      hasPdf: (version as any)?.document?.status === 'READY',
      pdfStatus: (version as any)?.document?.status ?? 'PENDING',
    };
  }

  async checkEligibility(items: Array<{ productId: string }>) {
    if (!this.enabled || !Array.isArray(items) || items.length === 0) {
      return { eligible: true, ineligibleItems: [], flow: 'LEGACY' };
    }
    const conn = this.connection || (this.snapshots as any)?.connection;
    if (!conn) {
      return { eligible: true, ineligibleItems: [], flow: 'LEGACY' };
    }
    const db = contractDb(conn);
    const ineligibleItems: Array<{
      productId: string;
      productName: string;
      providerId: string;
      providerName: string;
      reason: string;
      message: string;
    }> = [];
    const itemFlows: Array<{ productId: string; flow: 'LEGACY' | 'CONTRACT_V2' }> = [];

    for (const item of items) {
      if (!item?.productId) continue;
      let prodObjId: Types.ObjectId;
      try {
        prodObjId = contractObjectId(item.productId);
      } catch {
        ineligibleItems.push({
          productId: item.productId,
          productName: 'Trang phục',
          providerId: '',
          providerName: 'Không xác định',
          reason: 'PRODUCT_ID_INVALID',
          message: 'Mã trang phục trong giỏ hàng không hợp lệ. Vui lòng xóa và thêm lại sản phẩm.',
        });
        continue;
      }

      const product = (await db.collection('products').findOne({ _id: prodObjId })) as any;
      if (!product) {
        ineligibleItems.push({
          productId: item.productId,
          productName: 'Trang phục',
          providerId: '',
          providerName: 'Không xác định',
          reason: 'PRODUCT_NOT_FOUND',
          message: 'Trang phục không còn tồn tại trên hệ thống. Vui lòng xóa khỏi giỏ hàng.',
        });
        continue;
      }

      const provider = (await db.collection('providers').findOne({ _id: product.providerId })) as any;
      const providerName = provider?.businessName || 'Nhà cung cấp';
      const productName = product?.name || 'Trang phục';
      const providerIdStr = product.providerId?.toString() || '';

      // 1. Check provider rental capability & status
      const providerStatus = String(provider?.status || '').toUpperCase();
      const caps = Array.isArray(provider?.capabilities)
        ? provider.capabilities.map((c: string) => String(c).toUpperCase())
        : [];
      const isRental = caps.includes('AODAI_RENTAL') || caps.includes('RENTAL');

      if (providerStatus !== 'ACTIVE' || !isRental) {
        ineligibleItems.push({
          productId: item.productId,
          productName,
          providerId: providerIdStr,
          providerName,
          reason: 'PROVIDER_RENTAL_NOT_ACTIVE',
          message: `Shop '${providerName}' chưa được kích hoạt quyền cho thuê Áo dài trên sàn VibeHue. Quý khách vui lòng chọn trang phục từ Shop khác hoặc liên hệ Shop.`,
        });
        continue;
      }

      // 2. Check provider contract participation status
      let participation: any;
      if (
        this.policy &&
        typeof this.policy.getProviderContractParticipationStatus === 'function'
      ) {
        participation =
          await this.policy.getProviderContractParticipationStatus(
            product.providerId,
          );
      } else {
        // Fallback for mocks / unit tests where policy service is not mocked
        const col = db.collection('provider_contract_acceptances');
        let records: any[] = [];
        if (typeof col.find === 'function') {
          const res = col.find({
            providerId: product.providerId,
            scope: ContractScope.AoDaiRental,
          });
          records =
            typeof res?.toArray === 'function' ? await res.toArray() : [];
        } else if (typeof col.findOne === 'function') {
          const single = await col.findOne({
            providerId: product.providerId,
            scope: ContractScope.AoDaiRental,
          });
          if (single) records = [single];
        }

        if (!records || records.length === 0) {
          participation = { status: 'LEGACY' };
        } else {
          const active = records.find(
            (r: any) =>
              r.status === 'ACTIVE' &&
              (!r.revokedAt || new Date(r.revokedAt) > new Date()),
          );
          if (!active) {
            participation = { status: 'CONTRACT_SUSPENDED', reason: 'REVOKED' };
          } else {
            participation = { status: 'CONTRACT_ACTIVE', acceptance: active };
          }
        }
      }

      if (participation.status === 'LEGACY') {
        // Shop has never participated in electronic contracts -> LEGACY flow
        itemFlows.push({ productId: item.productId, flow: 'LEGACY' });
        continue; // Eligible! No contract v2 checks.
      }

      if (participation.status === 'CONTRACT_SUSPENDED') {
        const reason =
          participation.reason === 'POLICY_STALE'
            ? 'PROVIDER_ACCEPTANCE_STALE'
            : 'PROVIDER_ACCEPTANCE_SUSPENDED';
        ineligibleItems.push({
          productId: item.productId,
          productName,
          providerId: providerIdStr,
          providerName,
          reason,
          message: `Shop '${providerName}' cần cập nhật và xác nhận lại quy chế sàn giao dịch điện tử trước khi nhận đơn thuê trang phục này.`,
        });
        continue;
      }

      // 3. Shop is CONTRACT_ACTIVE: Perform Contract V2 checks
      itemFlows.push({ productId: item.productId, flow: 'CONTRACT_V2' });

      let policies: any;
      try {
        policies = await this.snapshots.currentPoliciesForProvider(product.providerId);
      } catch (err: any) {
        ineligibleItems.push({
          productId: item.productId,
          productName,
          providerId: providerIdStr,
          providerName,
          reason: 'PROVIDER_POLICY_MISSING',
          message: `Chính sách cho thuê của Shop '${providerName}' chưa được thiết lập. Vui lòng liên hệ Shop để được hỗ trợ.`,
        });
        continue;
      }

      if (policies?.isLegacyFallback) {
        ineligibleItems.push({
          productId: item.productId,
          productName,
          providerId: providerIdStr,
          providerName,
          reason: 'PROVIDER_POLICY_NOT_APPROVED',
          message: `Chính sách cho thuê của Shop '${providerName}' chưa được Ban Quản trị phê duyệt. Vui lòng liên hệ Shop để hoàn tất trước khi đặt thuê.`,
        });
        continue;
      }

      const damageComp = policies?.providerDamageCompensation as any;
      const resolvedComp = resolveDamageCompensationRules(damageComp);

      if (resolvedComp.requiresAssetValue) {
        const parsedVal = parseValidReplacementValue(product.replacementValue);
        const hasValidValue = parsedVal !== null && parsedVal > 0;
        if (!hasValidValue) {
          ineligibleItems.push({
            productId: item.productId,
            productName,
            providerId: providerIdStr,
            providerName,
            reason: 'CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING',
            message: `Trang phục '${productName}' của Shop '${providerName}' chưa có Giá trị bồi hoàn được thiết lập. Vui lòng liên hệ Shop để cập nhật thông tin trước khi đặt thuê.`,
          });
          continue;
        }

        const isApproved =
          product.moderationStatus === 'APPROVED' ||
          product.moderationStatus === undefined;
        if (!isApproved) {
          ineligibleItems.push({
            productId: item.productId,
            productName,
            providerId: providerIdStr,
            providerName,
            reason: 'CONTRACT_PRODUCT_REPLACEMENT_VALUE_UNAPPROVED',
            message: `Giá trị bồi hoàn của trang phục '${productName}' (Shop '${providerName}') đang chờ Quản trị viên sàn phê duyệt. Vui lòng liên hệ Shop để được hỗ trợ.`,
          });
          continue;
        }
      }
    }

    if (ineligibleItems.length > 0) {
      return {
        eligible: false,
        ineligibleItems,
        flow: 'BLOCKED' as const,
      };
    }

    const uniqueFlows = new Set(itemFlows.map((i) => i.flow));
    if (uniqueFlows.has('LEGACY') && uniqueFlows.has('CONTRACT_V2')) {
      return {
        eligible: false,
        ineligibleItems: [
          {
            productId: items[0].productId,
            productName: 'Đơn hàng đa cửa hàng',
            providerId: '',
            providerName: 'Hệ thống',
            reason: 'MIXED_CONTRACT_FLOW_UNSUPPORTED',
            message:
              'Đơn hàng không thể kết hợp giữa Shop truyền thống và Shop áp dụng Hợp đồng điện tử. Quý khách vui lòng đặt hàng riêng cho từng Shop.',
          },
        ],
        flow: 'MIXED' as const,
      };
    }

    const flow = uniqueFlows.has('CONTRACT_V2')
      ? ('CONTRACT_V2' as const)
      : ('LEGACY' as const);

    return {
      eligible: true,
      ineligibleItems: [],
      flow,
    };
  }

  private async reconcileErroneousLegacyBooking(
    booking: {
      _id: Types.ObjectId;
      bookingType: string;
      status: string;
      contractFlowVersion?: 2 | null;
      providerIds?: Types.ObjectId[];
      holdExpiresAt?: Date | null;
    },
  ): Promise<boolean> {
    if (
      booking.contractFlowVersion !== 2 ||
      booking.bookingType !== 'AODAI_RENTAL' ||
      booking.status !== 'PENDING_PAYMENT' ||
      !booking.providerIds?.length ||
      !this.connection
    ) {
      return false;
    }

    const db = contractDb(this.connection);
    const [acceptanceCount, contractCount, paymentCount] = await Promise.all([
      db.collection('provider_contract_acceptances').countDocuments({
        providerId: { $in: booking.providerIds },
        scope: ContractScope.AoDaiRental,
      }),
      db.collection('digital_contracts').countDocuments({
        bookingId: booking._id,
      }),
      db.collection('payments').countDocuments({ bookingId: booking._id }),
    ]);

    if (acceptanceCount > 0 || contractCount > 0 || paymentCount > 0) {
      return false;
    }

    const result = await db.collection<any>('bookings').updateOne(
      {
        _id: booking._id,
        bookingType: 'AODAI_RENTAL',
        status: 'PENDING_PAYMENT',
        contractFlowVersion: 2,
        contractId: null,
        finalizedPaymentId: null,
        finalizedContractKey: null,
        paymentExpiryClaim: null,
      },
      {
        $set: {
          contractFlowVersion: null,
          holdExpiresAt: null,
          paymentExpiryClaim: null,
        },
        $push: {
          statusTimeline: {
            status: 'PENDING_PAYMENT',
            changedAt: new Date(),
            note: 'RECONCILED_ERRONEOUS_CONTRACT_V2_TO_LEGACY',
          },
        },
      } as any,
    );

    return result.modifiedCount === 1;
  }
}
