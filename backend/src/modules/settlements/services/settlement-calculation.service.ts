import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PolicyCode } from '../../system-policies/constants/policy-code.enum';
import {
  CommissionPolicyValue,
  DEFAULT_POLICY_VALUES,
} from '../../system-policies/services/default-policy-values';
import { PolicyResolverService } from '../../system-policies/services/policy-resolver.service';
import { BookingItemType } from '../../bookings/schemas/booking-item.schema';
import { PaymentStatus } from '../../bookings/schemas/booking.schema';
import { SETTLEMENT_ERROR_CODES } from '../constants/settlement-error-codes';
import { SettlementRateType } from '../constants/settlement-rate-type.enum';
import { SettlementStatus } from '../constants/settlement-status.enum';
import {
  SettlementItemSnapshot,
  SettlementPaymentSnapshot,
  SettlementPolicySnapshot,
} from '../schemas/settlement.schema';

export interface SettlementBookingInput {
  _id: Types.ObjectId;
  bookingCode: string;
  status: string;
  paymentSummary?: {
    totalPaid?: number;
    paymentStatus?: PaymentStatus | string;
  };
}

export interface SettlementPaymentInput {
  _id: Types.ObjectId;
  amount: number;
  status: string;
  paidAt?: Date | null;
}

export interface SettlementItemInput {
  _id: Types.ObjectId;
  providerId: Types.ObjectId;
  itemType: BookingItemType | string;
  productId?: { name?: string } | Types.ObjectId | null;
  photographyPackageId?: { name?: string } | Types.ObjectId | null;
  unitPrice: number;
  quantity: number;
  depositAmount?: number;
  comboDiscountAmount?: number;
}

export interface CalculatedSettlementPayload {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  bookingItemIds: Types.ObjectId[];
  currency: 'VND';
  grossAmount: number;
  commissionBaseAmount: number;
  commissionRate: number;
  commissionAmount: number;
  fixedPlatformFee: number;
  allocatedPlatformFee: number;
  netAmount: number;
  refundAmount: number;
  penaltyAmount: number;
  payableAmount: number;
  status: SettlementStatus;
  holdReason?: string | null;
  policySnapshot: SettlementPolicySnapshot;
  itemSnapshots: SettlementItemSnapshot[];
  paymentSnapshot?: SettlementPaymentSnapshot | null;
}

interface ProviderGroup {
  providerId: Types.ObjectId;
  items: SettlementItemInput[];
  grossAmount: number;
}

@Injectable()
export class SettlementCalculationService {
  constructor(private readonly policyResolver: PolicyResolverService) {}

  async calculateSettlementsForBooking(
    booking: SettlementBookingInput,
    items: SettlementItemInput[],
    payment?: SettlementPaymentInput | null,
    forceHold = false,
  ): Promise<CalculatedSettlementPayload[]> {
    if (items.length === 0) {
      throw new BadRequestException(SETTLEMENT_ERROR_CODES.NoBookingItems);
    }

    const policyDoc = await this.resolveCommissionPolicyDoc();
    const policy = policyDoc.value;
    const rateType = this.detectRateType(items);
    const commissionRate = this.resolveCommissionRate(policy, rateType);
    const groups = this.groupItemsByProvider(items);
    const feeAllocations = this.allocateFixedPlatformFee(
      policy.fixedPlatformFee,
      groups,
    );
    const paymentSnapshot = this.buildPaymentSnapshot(booking, payment);

    return groups.map((group) => {
      const allocatedPlatformFee =
        feeAllocations.get(group.providerId.toString()) ?? 0;
      const commissionBaseAmount = group.grossAmount;
      const commissionAmount =
        commissionBaseAmount === 0
          ? 0
          : Math.max(
              this.moneyRound(commissionBaseAmount * commissionRate),
              policy.minCommissionAmount,
            );
      const netAmount =
        commissionBaseAmount - commissionAmount - allocatedPlatformFee;
      const refundAmount = 0;
      const penaltyAmount = 0;
      const payableAmount = netAmount - refundAmount - penaltyAmount;

      this.assertValidAmount('netAmount', netAmount, group.providerId);
      this.assertValidAmount('payableAmount', payableAmount, group.providerId);

      const itemSnapshots = this.buildItemSnapshots(
        group,
        commissionRate,
        commissionAmount,
        allocatedPlatformFee,
      );

      return {
        bookingId: booking._id,
        providerId: group.providerId,
        bookingItemIds: group.items.map((item) => item._id),
        currency: 'VND',
        grossAmount: group.grossAmount,
        commissionBaseAmount,
        commissionRate,
        commissionAmount,
        fixedPlatformFee: policy.fixedPlatformFee,
        allocatedPlatformFee,
        netAmount,
        refundAmount,
        penaltyAmount,
        payableAmount,
        status: forceHold
          ? SettlementStatus.OnHold
          : SettlementStatus.ReadyToSettle,
        holdReason: forceHold ? 'DISPUTE_OPEN' : null,
        policySnapshot: {
          policyCode: PolicyCode.CommissionPolicy,
          policyVersion: policyDoc.version,
          defaultCommissionRate: policy.defaultCommissionRate,
          sameProviderComboCommissionRate:
            policy.sameProviderComboCommissionRate,
          crossProviderComboCommissionRate:
            policy.crossProviderComboCommissionRate,
          fixedPlatformFee: policy.fixedPlatformFee,
          minCommissionAmount: policy.minCommissionAmount,
          appliedRateType: rateType,
        },
        itemSnapshots,
        paymentSnapshot,
      };
    });
  }

  detectRateType(items: SettlementItemInput[]): SettlementRateType {
    const providerIds = new Set(
      items.map((item) => item.providerId.toString()),
    );
    const itemTypes = new Set(items.map((item) => item.itemType));
    const hasProduct = itemTypes.has(BookingItemType.Product);
    const hasPhotography = itemTypes.has(BookingItemType.PhotographyPackage);

    if (!hasProduct || !hasPhotography) {
      return SettlementRateType.Default;
    }

    return providerIds.size === 1
      ? SettlementRateType.SameProviderCombo
      : SettlementRateType.CrossProviderCombo;
  }

  resolveCommissionRate(
    policy: CommissionPolicyValue,
    rateType: SettlementRateType,
  ): number {
    const rate =
      rateType === SettlementRateType.SameProviderCombo
        ? policy.sameProviderComboCommissionRate
        : rateType === SettlementRateType.CrossProviderCombo
          ? policy.crossProviderComboCommissionRate
          : policy.defaultCommissionRate;

    if (rate < 0 || rate > 1) {
      throw new BadRequestException(SETTLEMENT_ERROR_CODES.PolicyInvalid);
    }

    return rate;
  }

  groupItemsByProvider(items: SettlementItemInput[]): ProviderGroup[] {
    const grouped = new Map<string, ProviderGroup>();

    for (const item of items) {
      const key = item.providerId.toString();
      const serviceAmount = this.getServiceAmount(item);
      const providerDiscountAmount = this.getProviderDiscountAmount(item);
      const grossAmount = serviceAmount - providerDiscountAmount;

      if (providerDiscountAmount < 0 || providerDiscountAmount > serviceAmount) {
        throw new BadRequestException(SETTLEMENT_ERROR_CODES.AmountInvalid);
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          providerId: item.providerId,
          items: [],
          grossAmount: 0,
        });
      }

      const group = grouped.get(key)!;
      group.items.push(item);
      group.grossAmount += grossAmount;
    }

    return [...grouped.values()].sort((a, b) =>
      a.providerId.toString().localeCompare(b.providerId.toString()),
    );
  }

  allocateFixedPlatformFee(
    fixedPlatformFee: number,
    groups: ProviderGroup[],
  ): Map<string, number> {
    const allocations = new Map<string, number>();

    if (fixedPlatformFee <= 0) {
      groups.forEach((group) => allocations.set(group.providerId.toString(), 0));
      return allocations;
    }

    const bookingGrossAmount = groups.reduce(
      (total, group) => total + group.grossAmount,
      0,
    );

    if (bookingGrossAmount <= 0) {
      groups.forEach((group) => allocations.set(group.providerId.toString(), 0));
      return allocations;
    }

    let allocatedTotal = 0;
    groups.forEach((group) => {
      const amount = this.moneyRound(
        (fixedPlatformFee * group.grossAmount) / bookingGrossAmount,
      );
      allocations.set(group.providerId.toString(), amount);
      allocatedTotal += amount;
    });

    const diff = fixedPlatformFee - allocatedTotal;
    if (diff !== 0) {
      const receiver = this.pickLargestGrossGroup(groups);
      const key = receiver.providerId.toString();
      allocations.set(key, (allocations.get(key) ?? 0) + diff);
    }

    return allocations;
  }

  private async resolveCommissionPolicyDoc(): Promise<{
    version: number;
    value: CommissionPolicyValue;
  }> {
    try {
      const policy = await this.policyResolver.getActivePolicyByCode(
        PolicyCode.CommissionPolicy,
      );
      return {
        version: policy.version,
        value: policy.value as unknown as CommissionPolicyValue,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          version: 0,
          value: DEFAULT_POLICY_VALUES[
            PolicyCode.CommissionPolicy
          ] as CommissionPolicyValue,
        };
      }
      throw error;
    }
  }

  private buildPaymentSnapshot(
    booking: SettlementBookingInput,
    payment?: SettlementPaymentInput | null,
  ): SettlementPaymentSnapshot {
    return {
      paymentId: payment?._id ?? null,
      totalPaid: booking.paymentSummary?.totalPaid ?? payment?.amount ?? 0,
      paymentStatus: String(
        booking.paymentSummary?.paymentStatus ?? payment?.status ?? 'UNKNOWN',
      ),
      paidAt: payment?.paidAt ?? null,
    };
  }

  private buildItemSnapshots(
    group: ProviderGroup,
    commissionRate: number,
    settlementCommissionAmount: number,
    settlementAllocatedPlatformFee: number,
  ): SettlementItemSnapshot[] {
    const itemGrossAmounts = group.items.map((item) => ({
      item,
      grossAmount:
        this.getServiceAmount(item) - this.getProviderDiscountAmount(item),
    }));

    if (group.grossAmount <= 0) {
      return itemGrossAmounts.map(({ item }) => this.itemSnapshot(item, 0, 0, 0));
    }

    const commissionAllocations = this.allocateAmountToItems(
      settlementCommissionAmount,
      itemGrossAmounts,
    );
    const platformFeeAllocations = this.allocateAmountToItems(
      settlementAllocatedPlatformFee,
      itemGrossAmounts,
    );

    return itemGrossAmounts.map(({ item, grossAmount }) => {
      const key = item._id.toString();
      const commissionAmount = commissionAllocations.get(key) ?? 0;
      const allocatedPlatformFee = platformFeeAllocations.get(key) ?? 0;
      const netAmount = grossAmount - commissionAmount - allocatedPlatformFee;
      return this.itemSnapshot(
        item,
        commissionRate,
        commissionAmount,
        allocatedPlatformFee,
        netAmount,
      );
    });
  }

  private allocateAmountToItems(
    amount: number,
    itemGrossAmounts: Array<{ item: SettlementItemInput; grossAmount: number }>,
  ): Map<string, number> {
    const allocations = new Map<string, number>();
    const totalGross = itemGrossAmounts.reduce(
      (total, item) => total + item.grossAmount,
      0,
    );

    if (amount <= 0 || totalGross <= 0) {
      itemGrossAmounts.forEach(({ item }) => allocations.set(item._id.toString(), 0));
      return allocations;
    }

    let allocatedTotal = 0;
    itemGrossAmounts.forEach(({ item, grossAmount }) => {
      const allocation = this.moneyRound((amount * grossAmount) / totalGross);
      allocations.set(item._id.toString(), allocation);
      allocatedTotal += allocation;
    });

    const diff = amount - allocatedTotal;
    if (diff !== 0) {
      const receiver = [...itemGrossAmounts].sort((a, b) => {
        if (b.grossAmount !== a.grossAmount) {
          return b.grossAmount - a.grossAmount;
        }
        return a.item._id.toString().localeCompare(b.item._id.toString());
      })[0];
      const key = receiver.item._id.toString();
      allocations.set(key, (allocations.get(key) ?? 0) + diff);
    }

    return allocations;
  }

  private itemSnapshot(
    item: SettlementItemInput,
    commissionRate: number,
    commissionAmount: number,
    allocatedPlatformFee: number,
    netAmount?: number,
  ): SettlementItemSnapshot {
    const serviceAmount = this.getServiceAmount(item);
    const providerDiscountAmount = this.getProviderDiscountAmount(item);
    const platformDiscountAmount = 0;
    const commissionBaseAmount = serviceAmount - providerDiscountAmount;

    return {
      bookingItemId: item._id,
      itemType: this.mapItemType(item.itemType),
      providerId: item.providerId,
      itemName: this.resolveItemName(item),
      serviceAmount,
      providerDiscountAmount,
      platformDiscountAmount,
      depositAmount: item.depositAmount ?? 0,
      commissionBaseAmount,
      commissionRate,
      commissionAmount,
      allocatedPlatformFee,
      netAmount:
        netAmount ??
        commissionBaseAmount - commissionAmount - allocatedPlatformFee,
    };
  }

  private getServiceAmount(item: SettlementItemInput): number {
    return this.moneyRound((item.unitPrice ?? 0) * (item.quantity ?? 1));
  }

  private getProviderDiscountAmount(item: SettlementItemInput): number {
    return this.moneyRound(item.comboDiscountAmount ?? 0);
  }

  private resolveItemName(item: SettlementItemInput): string | null {
    const productName =
      item.productId &&
      typeof item.productId === 'object' &&
      'name' in item.productId
        ? item.productId.name
        : null;
    const packageName =
      item.photographyPackageId &&
      typeof item.photographyPackageId === 'object' &&
      'name' in item.photographyPackageId
        ? item.photographyPackageId.name
        : null;

    return productName ?? packageName ?? null;
  }

  private mapItemType(itemType: BookingItemType | string): string {
    if (itemType === BookingItemType.Product) {
      return 'AODAI_RENTAL';
    }
    if (itemType === BookingItemType.PhotographyPackage) {
      return 'PHOTOGRAPHY_PACKAGE';
    }
    return 'OTHER';
  }

  private pickLargestGrossGroup(groups: ProviderGroup): ProviderGroup;
  private pickLargestGrossGroup(groups: ProviderGroup[]): ProviderGroup;
  private pickLargestGrossGroup(groups: ProviderGroup | ProviderGroup[]) {
    const list = Array.isArray(groups) ? groups : [groups];
    return [...list].sort((a, b) => {
      if (b.grossAmount !== a.grossAmount) {
        return b.grossAmount - a.grossAmount;
      }
      return a.providerId.toString().localeCompare(b.providerId.toString());
    })[0];
  }

  private moneyRound(value: number): number {
    return Math.round(value);
  }

  private assertValidAmount(
    field: string,
    value: number,
    providerId: Types.ObjectId,
  ): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException({
        errorCode: SETTLEMENT_ERROR_CODES.AmountInvalid,
        message: 'Settlement amount is invalid',
        details: {
          providerId: providerId.toString(),
          field,
          actualValue: value,
          expectedRule: `${field} >= 0`,
        },
      });
    }
  }
}
