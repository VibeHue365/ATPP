import {
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import {
  ContractApprovalMode,
  ContractScope,
  ContractStatus,
  DigitalContract,
} from '../bookings/schemas/digital-contract.schema';
import {
  ContractVersion,
  ContractVersionState,
} from './schemas/contract-version.schema';
import { canonicalizeContract, hashContract } from './canonical-contract';
import {
  ContractPolicyService,
  RentalContractContext,
} from './contract-policy.service';
import { ContractSnapshotService } from './contract-snapshot.service';
import { ContractTemplateService } from './contract-template';
import { CONTRACTS_V2_ENABLED } from './contracts.constants';
import {
  BookingSource,
  RentalItemSource,
  contractDb,
  contractObjectId,
} from './contract-source.types';
import { ProviderContractConfigService } from './provider-contract-config.service';
import { ContractTierEvaluator } from './contract-tier-evaluator';
import { resolveDamageCompensationRules } from './schemas/provider-contract-policy.schema';

@Injectable()
export class ContractPreparationService {
  private readonly tierEvaluatorInstance: ContractTierEvaluator;

  constructor(
    @Inject(CONTRACTS_V2_ENABLED) private readonly enabled: boolean,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(DigitalContract.name)
    private readonly contracts: Model<DigitalContract>,
    @InjectModel(ContractVersion.name)
    private readonly versions: Model<ContractVersion>,
    private readonly policy: ContractPolicyService,
    private readonly snapshots: ContractSnapshotService,
    private readonly templates: ContractTemplateService,
    @Optional() private readonly configService?: ProviderContractConfigService,
    @Optional() private readonly tierEvaluator?: ContractTierEvaluator,
  ) {
    this.tierEvaluatorInstance = tierEvaluator || new ContractTierEvaluator();
  }

  /** No controller or booking/payment caller is wired in Phase 3. */
  async prepare(bookingId: string, providerId: string) {
    if (!this.enabled)
      throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
    const template = this.templates.getApproved();
    const context = await this.policy.getContext(bookingId);
    const providerObjectId = contractObjectId(providerId);
    if (!context.rentalProviderIds.some((id) => id.equals(providerObjectId)))
      throw new UnprocessableEntityException('PROVIDER_HAS_NO_RENTAL_ITEMS');
    await this.assertLiveHold(context, providerObjectId);
    const acceptance = await this.policy.requireAutoAcceptance(
      providerObjectId,
      template.version,
    );
    const snapshot = await this.snapshots.build(
      context,
      providerObjectId,
      template,
    );
    if ((snapshot.policies as any)?.isLegacyFallback) {
      throw new UnprocessableEntityException(
        'PROVIDER_POLICY_NOT_APPROVED: Shop chưa có chính sách hợp đồng cho thuê Áo dài được phê duyệt.',
      );
    }
    if (acceptance.policyFingerprint !== hashContract(snapshot.policies)) {
      throw new UnprocessableEntityException('PROVIDER_POLICY_ACCEPTANCE_STALE');
    }

    // Phase 2B: Tiered Contracts Risk Engine Integration
    const providerConfig = this.configService
      ? await this.configService.getConfigForProvider(providerObjectId)
      : null;
    const damageComp = (snapshot.policies as any)?.providerDamageCompensation;
    const resolvedComp = resolveDamageCompensationRules(damageComp);

    const providerRentalItems = context.rentalItems.filter((it) => it.providerId.equals(providerObjectId));
    const tierItems = providerRentalItems.map((it) => {
      let rentalDays = 1;
      if (it.rentalFrom && it.rentalTo) {
        const diffMs = new Date(it.rentalTo).getTime() - new Date(it.rentalFrom).getTime();
        rentalDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }
      const snapItem = snapshot.providerItems.find(
        (p) =>
          p.bookingItemId === it._id.toString() ||
          p.productId === (it.productId?.toString() || ''),
      );
      const resolvedReplacementValue =
        it.replacementValue ?? snapItem?.replacementValue ?? null;

      return {
        productId: it.productId?.toString() || it._id.toString(),
        productName: snapItem?.productName || (it as any).productName || 'Trang phục',
        rentalPrice: it.unitPrice,
        depositAmount: it.depositAmount,
        quantity: it.quantity,
        replacementValue: resolvedReplacementValue,
        rentalDays,
      };
    });

    const isTieredEnabled =
      process.env.CONTRACTS_TIERED_ENABLED === 'true' ||
      (process.env.NODE_ENV !== 'production' && process.env.CONTRACTS_TIERED_ENABLED !== 'false');
    const isRiskRulesApproved =
      process.env.PLATFORM_RISK_RULES_APPROVED === 'true' ||
      (process.env.NODE_ENV !== 'production' && process.env.PLATFORM_RISK_RULES_APPROVED !== 'false');

    const tierResult = this.tierEvaluatorInstance.evaluate({
      providerId,
      items: tierItems,
      policyRequiresAssetValue: resolvedComp.requiresAssetValue,
      config: providerConfig
        ? {
            contractMode: providerConfig.contractMode,
            orderThresholdAmount: providerConfig.orderThresholdAmount,
          }
        : null,
      providerVoucherDiscount: (snapshot.pricing as any)?.shopVoucherDiscountAmount ?? 0,
      allocatedPlatformDiscount: (snapshot.pricing as any)?.platformVoucherDiscountAmount ?? 0,
      guardrails: {
        isApproved: isRiskRulesApproved,
        rulesVersion: process.env.PLATFORM_RISK_RULES_VERSION || 'v1.0-draft',
      },
      isTieredFeatureEnabled: isTieredEnabled,
    });

    if (!tierResult.isEligible) {
      throw new UnprocessableEntityException(
        `CONTRACT_ELIGIBILITY_FAILED: ${tierResult.ineligibilityReason}`,
      );
    }

    const bookingFingerprint = hashContract({
      booking: snapshot.booking,
      providerItems: snapshot.providerItems,
      pricing: snapshot.pricing,
    });
    const renderedText = canonicalizeContract({ template, snapshot });
    const contentHash = hashContract({ template, snapshot });
    await this.requireSafeIndexes();

    const session = await this.connection.startSession();
    try {
      let outcome:
        | {
            contractId: string;
            versionId: string;
            version: number;
            presentationMode: 'QUICK' | 'DETAILED';
            reused: boolean;
          }
        | undefined;
      await session.withTransaction(async () => {
        await this.assertSourcesUnchanged(context, providerObjectId, session);
        await this.assertLiveHold(context, providerObjectId, session);
        const currentAcceptance = await this.policy.requireAutoAcceptance(
          providerObjectId,
          template.version,
          session,
        );
        if (
          !currentAcceptance._id.equals(acceptance._id) ||
          currentAcceptance.policyFingerprint !== acceptance.policyFingerprint
        )
          throw new UnprocessableEntityException(
            'PROVIDER_AUTO_ACCEPTANCE_CHANGED',
          );
        const identity = {
          bookingId: contractObjectId(bookingId),
          providerId: providerObjectId,
          scope: ContractScope.AoDaiRental,
        };
        let contract = await this.contracts.findOne(identity).session(session);
        if (contract && contract.flowVersion !== 2)
          throw new UnprocessableEntityException(
            'LEGACY_CONTRACT_REQUIRES_REVIEW',
          );
        if (!contract) {
          contract = new this.contracts({
            ...identity,
            customerId: context.booking.customerId,
            contractCode: `V2-${bookingId.toUpperCase()}-${providerId.toUpperCase()}`,
            flowVersion: 2,
            approvalMode: ContractApprovalMode.AutoAcceptance,
            status: ContractStatus.Draft,
            currentRevision: 0,
          });
          await contract.save({ session });
        }
        const previous = contract.currentVersionId
          ? await this.versions
              .findById(contract.currentVersionId)
              .session(session)
          : null;
        if (contract.currentVersionId && !previous)
          throw new UnprocessableEntityException(
            'CONTRACT_CURRENT_VERSION_MISSING',
          );
        if (
          previous &&
          previous.contentHash === contentHash &&
          previous.bookingFingerprint === bookingFingerprint &&
          previous.presentationMode === tierResult.presentationMode
        ) {
          outcome = {
            contractId: contract.id,
            versionId: previous.id,
            version: previous.version,
            presentationMode: previous.presentationMode,
            reused: true,
          };
          return;
        }
        const revision = (contract.currentRevision ?? 0) + 1;
        const now = new Date();
        const expiresAt = context.booking.holdExpiresAt
          ? new Date(context.booking.holdExpiresAt)
          : new Date(now.getTime() + 30 * 60 * 1000);
        const version = new this.versions({
          contractId: contract._id,
          version: revision,
          templateVersion: template.version,
          providerAcceptanceId: acceptance._id,
          snapshot,
          renderedText,
          contentHash,
          bookingFingerprint,
          presentationMode: tierResult.presentationMode,
          configVersion: providerConfig?.version ?? null,
          riskRulesVersion: tierResult.riskRulesVersion,
          riskTriggers: tierResult.riskTriggers,
          appliedRule: tierResult.appliedRule,
          state: ContractVersionState.Offered,
          offeredAt: now,
          expiresAt,
        });
        await version.save({ session });
        if (previous) {
          await this.versions.updateOne(
            {
              _id: previous._id,
              state: {
                $in: [ContractVersionState.Draft, ContractVersionState.Offered],
              },
            },
            { $set: { state: ContractVersionState.Superseded } },
            { session },
          );
        }
        contract.currentVersionId = version._id;
        contract.currentRevision = revision;
        await contract.save({ session });
        outcome = {
          contractId: contract.id,
          versionId: version.id,
          version: revision,
          presentationMode: version.presentationMode,
          reused: false,
        };
      });
      if (!outcome)
        throw new ServiceUnavailableException('CONTRACT_PREPARATION_ABORTED');
      return outcome;
    } finally {
      await session?.endSession?.();
    }
  }

  private async requireSafeIndexes(): Promise<void> {
    const db = contractDb(this.connection);
    const indexes = await db.collection('digital_contracts').indexes();
    const hasOldUnique = indexes.some(
      (index) =>
        index.unique &&
        JSON.stringify(index.key) === JSON.stringify({ bookingId: 1 }),
    );
    const hasStableUnique = indexes.some(
      (index) =>
        index.unique &&
        !index.partialFilterExpression &&
        !index.sparse &&
        JSON.stringify(index.key) ===
          JSON.stringify({ bookingId: 1, providerId: 1, scope: 1 }),
    );
    if (hasOldUnique || !hasStableUnique) {
      if (typeof db.collection('digital_contracts').dropIndex === 'function') {
        const oldIndex = indexes.find(
          (index) =>
            index.unique &&
            JSON.stringify(index.key) === JSON.stringify({ bookingId: 1 }),
        );
        if (oldIndex && oldIndex.name) {
          try {
            await db.collection('digital_contracts').dropIndex(oldIndex.name);
          } catch {}
        }
        try {
          await db
            .collection('digital_contracts')
            .createIndex(
              { bookingId: 1, providerId: 1, scope: 1 },
              { unique: true },
            );
        } catch {}
      }
      const recheckedIndexes = await db
        .collection('digital_contracts')
        .indexes();
      const stillHasOld = recheckedIndexes.some(
        (index) =>
          index.unique &&
          JSON.stringify(index.key) === JSON.stringify({ bookingId: 1 }),
      );
      const nowHasStable = recheckedIndexes.some(
        (index) =>
          index.unique &&
          !index.partialFilterExpression &&
          !index.sparse &&
          JSON.stringify(index.key) ===
            JSON.stringify({ bookingId: 1, providerId: 1, scope: 1 }),
      );
      if (stillHasOld || !nowHasStable) {
        throw new ServiceUnavailableException(
          'CONTRACT_INDEX_MIGRATION_REQUIRED',
        );
      }
    }
    const versionIndexes = await db.collection('contract_versions').indexes();
    let hasVersionUnique = versionIndexes.some(
      (index) =>
        index.unique &&
        JSON.stringify(index.key) ===
          JSON.stringify({ contractId: 1, version: 1 }),
    );
    if (
      !hasVersionUnique &&
      typeof db.collection('contract_versions').createIndex === 'function'
    ) {
      try {
        await db
          .collection('contract_versions')
          .createIndex({ contractId: 1, version: 1 }, { unique: true });
        hasVersionUnique = true;
      } catch {}
    }
    if (!hasVersionUnique) {
      throw new ServiceUnavailableException(
        'CONTRACT_INDEX_MIGRATION_REQUIRED',
      );
    }
    const acceptanceIndexes = await db
      .collection('provider_contract_acceptances')
      .indexes();
    let hasAcceptanceUnique = acceptanceIndexes.some(
      (index) =>
        index.unique &&
        JSON.stringify(index.key) ===
          JSON.stringify({ providerId: 1, scope: 1 }) &&
        JSON.stringify(index.partialFilterExpression) ===
          JSON.stringify({ status: 'ACTIVE' }),
    );
    if (
      !hasAcceptanceUnique &&
      typeof db.collection('provider_contract_acceptances').createIndex ===
        'function'
    ) {
      try {
        await db.collection('provider_contract_acceptances').createIndex(
          { providerId: 1, scope: 1 },
          {
            unique: true,
            partialFilterExpression: { status: 'ACTIVE' },
          },
        );
        hasAcceptanceUnique = true;
      } catch {}
    }
    if (!hasAcceptanceUnique) {
      throw new ServiceUnavailableException(
        'CONTRACT_INDEX_MIGRATION_REQUIRED',
      );
    }
  }

  async assertLiveHold(
    context: RentalContractContext,
    providerId: Types.ObjectId,
    session?: ClientSession,
  ) {
    const db = contractDb(this.connection);
    if (
      context.booking.status !== 'PENDING_PAYMENT' ||
      (context.booking.holdExpiresAt &&
        context.booking.holdExpiresAt <= new Date())
    )
      throw new UnprocessableEntityException('BOOKING_NOT_PREPARABLE');
    const liveBooking = await db.collection('bookings').findOne(
      { _id: context.booking._id },
      {
        projection: { status: 1, contractFlowVersion: 1, holdExpiresAt: 1 },
        session,
      },
    );
    if (
      !liveBooking ||
      liveBooking.status !== 'PENDING_PAYMENT' ||
      (liveBooking.holdExpiresAt && liveBooking.holdExpiresAt <= new Date())
    )
      throw new UnprocessableEntityException('BOOKING_NOT_PREPARABLE');
    if (liveBooking.contractFlowVersion !== 2) {
      await db
        .collection('bookings')
        .updateOne(
          { _id: liveBooking._id },
          { $set: { contractFlowVersion: 2 } },
        );
      liveBooking.contractFlowVersion = 2;
    }
    for (const item of context.rentalItems.filter((row) =>
      row.providerId.equals(providerId),
    )) {
      const now = new Date();
      const reservationFilter = {
        bookingId: context.booking._id,
        bookingItemId: item._id,
        $or: [
          {
            status: 'TEMP_RESERVED',
            expiresAt: { $gt: now },
            reservedFrom: { $exists: true, $ne: null },
            reservedTo: { $exists: true, $ne: null },
          },
          {
            status: 'CONFIRMED',
            reservedFrom: { $exists: true, $ne: null },
            reservedTo: { $exists: true, $ne: null },
            $or: [
              { expiresAt: { $gt: now } },
              { expiresAt: null },
              { expiresAt: { $exists: false } },
            ],
          },
        ],
      };

      const resCol = db.collection('inventory_reservations');
      let activeReservations: any[] = [];
      if (typeof resCol.find === 'function') {
        activeReservations = await resCol.find(reservationFilter, { session }).toArray();
        if (activeReservations.length < item.quantity) {
          throw new UnprocessableEntityException(
            'RENTAL_HOLD_EXPIRED_OR_MISSING',
          );
        }

        // Validate date range coverage, expiration, and required fields for each reservation
        for (const res of activeReservations) {
          // If status is TEMP_RESERVED, expiresAt is strictly mandatory and must be in the future
          if (res.status === 'TEMP_RESERVED') {
            if (!res.expiresAt || isNaN(new Date(res.expiresAt).getTime())) {
              throw new UnprocessableEntityException(
                'RENTAL_HOLD_EXPIRED_OR_MISSING: Hold tạm thiếu thời hạn hết hạn (expiresAt).',
              );
            }
            if (new Date(res.expiresAt) <= now) {
              throw new UnprocessableEntityException(
                'RENTAL_HOLD_EXPIRED_OR_MISSING: Hold tạm thời đã hết hạn.',
              );
            }
          }

          // Both reservedFrom and reservedTo are strictly mandatory and must be valid dates
          if (
            !res.reservedFrom ||
            !res.reservedTo ||
            isNaN(new Date(res.reservedFrom).getTime()) ||
            isNaN(new Date(res.reservedTo).getTime())
          ) {
            throw new UnprocessableEntityException(
              'RENTAL_HOLD_DATE_MISMATCH: Hold thiếu khoảng thời gian giữ đồ (reservedFrom hoặc reservedTo).',
            );
          }

          const isHourly = (item as any).rentalType === 'HOURLY';
          const effectiveStart = isHourly
            ? (item as any).shootDate || item.rentalFrom
            : item.rentalFrom;
          const effectiveEnd = isHourly
            ? (item as any).shootDate || item.rentalTo || item.rentalFrom
            : item.rentalTo || item.rentalFrom;

          const resFrom = new Date(res.reservedFrom);
          const resTo = new Date(res.reservedTo);

          if (effectiveStart) {
            const expStart = new Date(effectiveStart);
            const isSameDayOrBefore = (d1: Date, d2: Date) => {
              if (d1.getTime() <= d2.getTime()) return true;
              const diffHours = (d1.getTime() - d2.getTime()) / (3600 * 1000);
              if (diffHours < 24) {
                const vn1 = d1.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
                const vn2 = d2.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
                if (vn1 <= vn2) return true;
                const utc1 = d1.toISOString().slice(0, 10);
                const utc2 = d2.toISOString().slice(0, 10);
                if (utc1 <= utc2) return true;
              }
              return false;
            };

            if (!isSameDayOrBefore(resFrom, expStart)) {
              throw new UnprocessableEntityException(
                'RENTAL_HOLD_DATE_MISMATCH: Thời gian giữ kho không bao quát ngày bắt đầu thuê.',
              );
            }
          }

          if (effectiveEnd) {
            const expEnd = new Date(effectiveEnd);
            const isSameDayOrAfter = (d1: Date, d2: Date) => {
              if (d1.getTime() >= d2.getTime()) return true;
              const diffHours = (d2.getTime() - d1.getTime()) / (3600 * 1000);
              if (diffHours < 24) {
                const vn1 = d1.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
                const vn2 = d2.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
                if (vn1 >= vn2) return true;
                const utc1 = d1.toISOString().slice(0, 10);
                const utc2 = d2.toISOString().slice(0, 10);
                if (utc1 >= utc2) return true;
              }
              return false;
            };

            if (!isSameDayOrAfter(resTo, expEnd)) {
              throw new UnprocessableEntityException(
                'RENTAL_HOLD_DATE_MISMATCH: Thời gian giữ kho không bao quát ngày kết thúc thuê.',
              );
            }
          }
        }

        // Verify that referenced inventory items actually exist in the inventory_items collection
        const inventoryItemIds = activeReservations
          .map((r: any) => r.inventoryItemId)
          .filter(Boolean);

        if (inventoryItemIds.length < item.quantity) {
          throw new UnprocessableEntityException(
            'RENTAL_HOLD_ITEM_NOT_FOUND: Hold tham chiếu vật phẩm tồn kho không tồn tại.',
          );
        }

        const itemsCol = db.collection('inventory_items');
        if (typeof itemsCol.find === 'function') {
          const inventoryItems = await itemsCol
            .find({ _id: { $in: inventoryItemIds } }, { session })
            .toArray();

          if (inventoryItems.length < inventoryItemIds.length) {
            throw new UnprocessableEntityException(
              'RENTAL_HOLD_ITEM_NOT_FOUND: Hold tham chiếu vật phẩm tồn kho không tồn tại trong kho.',
            );
          }

          // Invariant: InventoryItem must match the exact Product, Size, Color of the BookingItem
          for (const inv of inventoryItems) {
            if (item.productId && inv.productId && !inv.productId.equals(item.productId)) {
              throw new UnprocessableEntityException(
                'RENTAL_HOLD_PRODUCT_MISMATCH: Vật phẩm trong kho thuộc sản phẩm khác với đơn đặt.',
              );
            }
            if (
              item.selectedSize &&
              inv.size &&
              inv.size.trim().toUpperCase() !== item.selectedSize.trim().toUpperCase()
            ) {
              throw new UnprocessableEntityException(
                'RENTAL_HOLD_VARIANT_MISMATCH: Kích thước vật phẩm trong kho không khớp với kích thước khách đặt.',
              );
            }
            if (
              item.selectedColor &&
              inv.color &&
              inv.color.trim().toUpperCase() !== item.selectedColor.trim().toUpperCase()
            ) {
              throw new UnprocessableEntityException(
                'RENTAL_HOLD_VARIANT_MISMATCH: Màu sắc vật phẩm trong kho không khớp với màu sắc khách đặt.',
              );
            }
          }
        } else if (typeof itemsCol.countDocuments === 'function') {
          const existingItemsCount = await itemsCol.countDocuments(
            { _id: { $in: inventoryItemIds } },
            { session },
          );

          if (existingItemsCount < inventoryItemIds.length) {
            throw new UnprocessableEntityException(
              'RENTAL_HOLD_ITEM_NOT_FOUND: Hold tham chiếu vật phẩm tồn kho không tồn tại trong kho.',
            );
          }
        }

        // Invariant: Verify product belongs to the contract provider
        if (item.productId) {
          const productsCol = db.collection('products');
          if (typeof productsCol.findOne === 'function') {
            const product = await productsCol.findOne({ _id: item.productId }, { session });
            if (product && product.providerId && !product.providerId.equals(providerId)) {
              throw new UnprocessableEntityException(
                'RENTAL_HOLD_PROVIDER_MISMATCH: Sản phẩm giữ kho không thuộc nhà cung cấp của đơn hàng.',
              );
            }
          }
        }
      } else if (typeof resCol.countDocuments === 'function') {
        const count = await resCol.countDocuments(reservationFilter, { session });
        if (count < item.quantity) {
          throw new UnprocessableEntityException(
            'RENTAL_HOLD_EXPIRED_OR_MISSING',
          );
        }
      } else {
        throw new UnprocessableEntityException(
          'RENTAL_HOLD_EXPIRED_OR_MISSING',
        );
      }
    }
  }

  async assertSourcesUnchanged(
    context: RentalContractContext,
    providerId: Types.ObjectId,
    session: ClientSession,
  ) {
    const db = contractDb(this.connection);
    const booking = (await db
      .collection('bookings')
      .findOne(
        { _id: context.booking._id },
        { session },
      )) as BookingSource | null;
    if (
      !booking ||
      booking.status !== context.booking.status ||
      hashContract({
        bookingType: booking.bookingType ?? null,
        customerId: booking.customerId ?? null,
        providerIds: booking.providerIds ?? null,
        pricingSummary: booking.pricingSummary ?? null,
        voucherSnapshot: booking.voucherSnapshot ?? null,
        holdExpiresAt: booking.holdExpiresAt ?? null,
      }) !==
        hashContract({
          bookingType: context.booking.bookingType ?? null,
          customerId: context.booking.customerId ?? null,
          providerIds: context.booking.providerIds ?? null,
          pricingSummary: context.booking.pricingSummary ?? null,
          voucherSnapshot: context.booking.voucherSnapshot ?? null,
          holdExpiresAt: context.booking.holdExpiresAt ?? null,
        })
    )
      throw new UnprocessableEntityException(
        'BOOKING_CHANGED_DURING_PREPARATION',
      );
    for (const item of context.rentalItems.filter((row) =>
      row.providerId.equals(providerId),
    )) {
      const liveItem = (await db
        .collection('booking_items')
        .findOne({ _id: item._id }, { session })) as RentalItemSource | null;
      if (
        !liveItem ||
        hashContract({
          productId: liveItem.productId ?? null,
          quantity: liveItem.quantity ?? null,
          selectedSize: liveItem.selectedSize ?? null,
          rentalType: (liveItem as any).rentalType ?? null,
          priceVersionId: liveItem.priceVersionId ?? null,
          unitPrice: liveItem.unitPrice ?? null,
          depositAmount: liveItem.depositAmount ?? null,
        }) !==
          hashContract({
            productId: item.productId ?? null,
            quantity: item.quantity ?? null,
            selectedSize: item.selectedSize ?? null,
            rentalType: (item as any).rentalType ?? null,
            priceVersionId: item.priceVersionId ?? null,
            unitPrice: item.unitPrice ?? null,
            depositAmount: item.depositAmount ?? null,
          })
      )
        throw new UnprocessableEntityException(
          'BOOKING_ITEM_CHANGED_DURING_PREPARATION',
        );
    }
  }
}
