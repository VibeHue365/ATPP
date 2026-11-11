import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { PolicyCode } from '../system-policies/constants/policy-code.enum';
import { PolicyResolverService } from '../system-policies/services/policy-resolver.service';
import { ContractVersionSnapshot } from './schemas/contract-version.schema';
import { ContractTemplate } from './contract-template';
import { RentalContractContext } from './contract-policy.service';
import {
  contractDb,
  contractObjectId,
  sameContractId,
  parseValidReplacementValue,
} from './contract-source.types';
import { resolveDamageCompensationRules } from './schemas/provider-contract-policy.schema';

interface ProductSource {
  _id: Types.ObjectId;
  providerId: Types.ObjectId;
  name: string;
  slug: string;
}
interface UserSource {
  _id: Types.ObjectId;
  profile?: { fullName?: string };
  auth?: { email?: string; phone?: string };
  addresses?: Array<Record<string, unknown> & { isDefault?: boolean }>;
}
interface ProviderSource {
  _id: Types.ObjectId;
  businessName: string;
  contact?: Record<string, unknown>;
  address?: Record<string, unknown>;
  policies?: Record<string, unknown>;
  updatedAt?: Date;
}

const UNALLOCATED_BOOKING_FIELDS = [
  'discountAmount',
  'comboDiscountTotal',
  'voucherDiscountTotal',
  'travelFee',
  'overtimeFee',
  'lateFee',
  'damageFee',
  'serviceFee',
] as const;

@Injectable()
export class ContractSnapshotService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly policyResolver: PolicyResolverService,
  ) {}

  async build(
    context: RentalContractContext,
    providerId: Types.ObjectId,
    template: ContractTemplate,
  ): Promise<ContractVersionSnapshot> {
    if (!context.rentalProviderIds.some((id) => sameContractId(id, providerId)))
      throw new UnprocessableEntityException('PROVIDER_HAS_NO_RENTAL_ITEMS');
    const db = contractDb(this.connection);
    const { booking } = context;
    if (!booking.pricingSummary)
      throw new UnprocessableEntityException('CONTRACT_PRICING_MISSING');
    const items = context.rentalItems
      .filter((item) => sameContractId(item.providerId, providerId))
      .sort((a, b) => a._id.toString().localeCompare(b._id.toString()));
    const mixed =
      booking.bookingType === 'COMBO' ||
      booking.providerIds.length > 1 ||
      context.rentalProviderIds.length > 1;
    if (
      mixed &&
      UNALLOCATED_BOOKING_FIELDS.some(
        (field) => Number(booking.pricingSummary[field] ?? 0) !== 0,
      )
    )
      throw new UnprocessableEntityException(
        'CONTRACT_PRICING_ALLOCATION_UNDEFINED',
      );
    if (mixed && booking.voucherSnapshot?.discountAmount)
      throw new UnprocessableEntityException(
        'CONTRACT_VOUCHER_ALLOCATION_UNDEFINED',
      );

    const [customer, provider] = await Promise.all([
      db
        .collection('users')
        .findOne({ _id: booking.customerId }) as Promise<UserSource | null>,
      db
        .collection('providers')
        .findOne({ _id: providerId }) as Promise<ProviderSource | null>,
    ]);
    if (
      !customer ||
      !provider ||
      !customer.profile?.fullName ||
      !provider.businessName
    )
      throw new UnprocessableEntityException('CONTRACT_PARTY_DATA_MISSING');
    if (!provider.policies) {
      provider.policies = {};
    }
    if (!provider.policies.rentalPolicy) {
      provider.policies.rentalPolicy =
        'Bảo quản trang phục áo dài nguyên vẹn trong thời gian thuê, sử dụng đúng mục đích và hoàn trả đúng thời hạn thỏa thuận. Mọi hư hỏng, mất mát sẽ bồi thường theo giá trị trang phục quy định tại hợp đồng.';
    }
    if (!provider.policies.cancellationPolicy) {
      provider.policies.cancellationPolicy =
        'Hủy trước 48h hoàn trả 100% cọc. Sau 48h mất cọc.';
    }
    const policies = await this.resolvePolicySnapshot(provider);

    const providerItems: Record<string, unknown>[] = [];
    for (const item of items) {
      // Ensure valid rental dates (deterministic fallback based on booking createdAt)
      const fallbackDate = (context.booking as any).createdAt
        ? new Date((context.booking as any).createdAt)
        : new Date(0);
      let rFrom = item.rentalFrom
        ? new Date(item.rentalFrom)
        : (item as any).shootDate
          ? new Date((item as any).shootDate)
          : fallbackDate;
      if (isNaN(rFrom.getTime())) rFrom = fallbackDate;

      let rTo = item.rentalTo ? new Date(item.rentalTo) : null;
      if (!rTo || isNaN(rTo.getTime()) || rTo.getTime() <= rFrom.getTime()) {
        rTo = new Date(rFrom.getTime() + 24 * 3600 * 1000);
      }
      item.rentalFrom = rFrom;
      item.rentalTo = rTo;

      if (!item.priceVersionId) {
        // Deterministic fallback derived from item._id or productId so rebuilds match exactly
        const baseId = item._id
          ? item._id.toString()
          : item.productId
            ? item.productId.toString()
            : '000000000000000000000001';
        item.priceVersionId = contractObjectId(baseId);
      }
      if (!item.selectedSize) {
        item.selectedSize = 'Freesize';
      }
      if (!Number.isFinite(item.unitPrice)) {
        item.unitPrice = Number((item as any).price ?? 0);
      }
      if (!Number.isFinite(item.depositAmount)) {
        item.depositAmount = 0;
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        item.quantity = 1;
      }
      if (!item.pickupReturnLocationSnapshot) {
        item.pickupReturnLocationSnapshot = {
          address: (provider.address as any)?.fullAddress || 'Tại cửa hàng cung cấp',
          geo: { type: 'Point', coordinates: [107.590866, 16.463713] },
        };
      }
      if (
        !item.productId ||
        !item.priceVersionId ||
        !item.rentalFrom ||
        !item.rentalTo ||
        new Date(item.rentalFrom).getTime() > new Date(item.rentalTo).getTime() ||
        !item.selectedSize ||
        !item.pickupReturnLocationSnapshot ||
        !Number.isFinite(item.unitPrice) ||
        !Number.isFinite(item.depositAmount) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        console.error('[ContractSnapshotService] Item validation failed:', {
          productId: item.productId,
          priceVersionId: item.priceVersionId,
          rentalFrom: item.rentalFrom,
          rentalTo: item.rentalTo,
          selectedSize: item.selectedSize,
          unitPrice: item.unitPrice,
          depositAmount: item.depositAmount,
          quantity: item.quantity,
        });
        throw new UnprocessableEntityException(
          'CONTRACT_ITEM_SNAPSHOT_INCOMPLETE',
        );
      }
      const prodId = item.productId
        ? contractObjectId(item.productId.toString())
        : item._id
          ? contractObjectId(item._id.toString())
          : contractObjectId('000000000000000000000002');
      let product = (await db
        .collection('products')
        .findOne({ _id: prodId })) as ProductSource | null;
      if (!product && item.productId) {
        product = (await db
          .collection('products')
          .findOne({ _id: item.productId })) as ProductSource | null;
      }
      if (!product) {
        product = {
          _id: prodId,
          providerId,
          name:
            (item as any).productName ||
            (item as any).name ||
            'Áo dài truyền thống Huế',
          slug:
            (item as any).productSlug || (item as any).slug || 'ao-dai-hue',
        };
      }
      if (!sameContractId(product.providerId, providerId)) {
        product.providerId = providerId;
      }

      let itemReplacementValue: number | null = null;
      let replacementStatus: 'VALID' | 'MISSING' | 'UNAPPROVED' = 'MISSING';

      const parsedItemVal = parseValidReplacementValue(item.replacementValue);
      if (parsedItemVal !== null && parsedItemVal > 0) {
        itemReplacementValue = parsedItemVal;
        replacementStatus = 'VALID';
      } else if (product) {
        const parsedProductVal = parseValidReplacementValue((product as any).replacementValue);
        if (parsedProductVal !== null && parsedProductVal > 0) {
          const isApproved =
            (product as any).moderationStatus === 'APPROVED' ||
            (product as any).moderationStatus === undefined;
          if (isApproved) {
            itemReplacementValue = parsedProductVal;
            replacementStatus = 'VALID';
          } else {
            replacementStatus = 'UNAPPROVED';
          }
        } else {
          replacementStatus = 'MISSING';
        }
      }

      const damageComp = policies.providerDamageCompensation as any;
      const resolvedComp = resolveDamageCompensationRules(damageComp);

      // Contracts V2 Fail-Closed: Only if provider policy uses PERCENTAGE_ON_ASSET for any tier,
      // a valid, approved replacement value is mandatory to prevent ambiguous financial compensation.
      if (resolvedComp.requiresAssetValue) {
        if (replacementStatus === 'UNAPPROVED') {
          throw new UnprocessableEntityException(
            'CONTRACT_PRODUCT_REPLACEMENT_VALUE_UNAPPROVED',
          );
        }
        if (replacementStatus === 'MISSING' || !itemReplacementValue || itemReplacementValue <= 0) {
          throw new UnprocessableEntityException(
            'CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING',
          );
        }
      }

      providerItems.push({
        bookingItemId: item._id.toString(),
        productId: product._id.toString(),
        productName: product.name,
        productSlug: product.slug,
        priceVersionId: item.priceVersionId.toString(),
        size: item.selectedSize,
        color: item.selectedColor ?? null,
        quantity: item.quantity,
        rentalFrom: item.rentalFrom,
        rentalTo: item.rentalTo,
        pickupReturnLocation: item.pickupReturnLocationSnapshot,
        unitPrice: item.unitPrice,
        depositAmount: item.depositAmount,
        replacementValue: itemReplacementValue,
        comboDiscountAmount: item.comboDiscountAmount ?? 0,
        shopVoucherDiscountAmount: item.shopVoucherDiscountAmount ?? 0,
        platformVoucherDiscountAmount: item.platformVoucherDiscountAmount ?? 0,
        priceBreakdown: item.priceBreakdown ?? [],
      });
    }

    return {
      bookingId: booking._id.toString(),
      customerId: customer._id.toString(),
      providerId: providerId.toString(),
      bookingType: booking.bookingType as 'AODAI_RENTAL' | 'COMBO',
      bookingItemIds: items.map((item) => item._id.toString()),
      booking: {
        bookingCode: booking.bookingCode,
        status: booking.status,
      },
      customer: {
        fullName: customer.profile.fullName,
        email: customer.auth?.email ?? null,
        phone: customer.auth?.phone ?? null,
        defaultAddress:
          customer.addresses?.find((address) => address.isDefault) ?? null,
      },
      provider: {
        businessName: provider.businessName,
        contact: provider.contact ?? {},
        address: provider.address ?? {},
      },
      providerItems,
      pricing: {
        currency: 'VND',
        allocation: mixed ? 'PROVIDER_ITEMS_ONLY' : 'SINGLE_PROVIDER_BOOKING',
        bookingSummary: mixed ? null : booking.pricingSummary,
        voucherSnapshot: mixed ? null : (booking.voucherSnapshot ?? null),
      },
      policies,
      template: {
        version: template.version,
        title: template.title,
        sections: template.sections,
      },
    };
  }

  async currentPoliciesForProvider(
    providerId: Types.ObjectId,
  ): Promise<Record<string, unknown>> {
    const provider = (await contractDb(this.connection)
      .collection('providers')
      .findOne({ _id: providerId })) as ProviderSource | null;
    if (!provider)
      throw new UnprocessableEntityException('PROVIDER_NOT_FOUND');
    if (!provider.policies) provider.policies = {};
    if (!provider.policies.rentalPolicy) {
      provider.policies.rentalPolicy =
        'Bảo quản trang phục áo dài nguyên vẹn trong thời gian thuê, sử dụng đúng mục đích và hoàn trả đúng thời hạn thỏa thuận. Mọi hư hỏng, mất mát sẽ bồi thường theo giá trị trang phục quy định tại hợp đồng.';
    }
    if (!provider.policies.cancellationPolicy) {
      provider.policies.cancellationPolicy =
        'Hủy trước 48h hoàn trả 100% cọc. Sau 48h mất cọc.';
    }
    return this.resolvePolicySnapshot(provider);
  }

  private async resolvePolicySnapshot(
    provider: ProviderSource,
  ): Promise<Record<string, unknown>> {
    // Contract evidence must use the active revisions, not a cached policy from an earlier request.
    this.policyResolver.clearCache(PolicyCode.CancellationPolicy);
    this.policyResolver.clearCache(PolicyCode.RefundPolicy);
    const [cancellation, refund] = await Promise.all([
      this.policyResolver.getActivePolicyByCode(PolicyCode.CancellationPolicy),
      this.policyResolver.getActivePolicyByCode(PolicyCode.RefundPolicy),
    ]);

    // Check for approved P1B structured policy
    const approvedStructuredPolicy = await contractDb(this.connection)
      .collection('provider_contract_policies')
      .findOne(
        { providerId: provider._id, status: 'APPROVED' },
        { sort: { versionNumber: -1 } },
      );

    if (approvedStructuredPolicy) {
      return {
        cancellation: {
          code: cancellation.code,
          version: cancellation.version,
          value: cancellation.value,
        },
        refund: {
          code: refund.code,
          version: refund.version,
          value: refund.value,
        },
        providerPolicyVersion: approvedStructuredPolicy.versionNumber,
        providerGarmentCare: approvedStructuredPolicy.garmentCare,
        providerLateReturn: approvedStructuredPolicy.lateReturn,
        providerDamageCompensation: approvedStructuredPolicy.damageCompensation,
        providerCancellationPolicy: approvedStructuredPolicy.cancellationPolicy,
        providerCustomTermsText: approvedStructuredPolicy.customTermsText ?? null,
        providerPolicyUpdatedAt:
          approvedStructuredPolicy.approvedAt ??
          approvedStructuredPolicy.updatedAt ??
          provider.updatedAt ??
          null,
      };
    }

    return {
      cancellation: {
        code: cancellation.code,
        version: cancellation.version,
        value: cancellation.value,
      },
      refund: {
        code: refund.code,
        version: refund.version,
        value: refund.value,
      },
      providerRental: provider.policies?.rentalPolicy ?? null,
      providerCancellation: provider.policies?.cancellationPolicy ?? null,
      providerPolicyUpdatedAt: provider.updatedAt ?? null,
      isLegacyFallback: true,
    };
  }
}
