import { resolveDamageCompensationRules } from '@/types/contract';
import type { Booking } from '@/types/booking';
import { translateApiMessage } from '@/utils/apiError';
import {
  bookingStatus,
  formatDepositSettlementLabel,
  getRentalEvidenceTimestamps,
} from '@/utils/booking';
import {
  formatDamageTierValue,
  getContractReadinessMeta,
  getContractStateBadge,
} from '@/utils/contractFormat';

describe('rental evidence & contract helpers', () => {
  it('translates RETURN_PENDING clearly as return incident pending', () => {
    expect(bookingStatus.RETURN_PENDING).toEqual({
      label: 'Chờ duyệt sự cố trả đồ',
      tone: 'error',
    });
  });

  it('extracts evidence timestamps from rentalFulfillment and falls back to statusTimeline', () => {
    const booking: Booking = {
      _id: 'bk-1',
      bookingCode: 'VH-101',
      bookingType: 'AODAI_RENTAL',
      status: 'RETURNED',
      updatedAt: '2026-11-15T12:00:00.000Z',
      items: [
        {
          _id: 'item-1',
          itemType: 'PRODUCT',
          unitPrice: 300000,
          quantity: 1,
          rentalFulfillment: {
            pickedUpAt: '2026-11-14T09:00:00.000Z',
          },
        },
      ],
      statusTimeline: [
        { status: 'PICKUP_PENDING', changedAt: '2026-11-14T08:00:00.000Z' },
        { status: 'PICKED_UP', changedAt: '2026-11-14T09:00:00.000Z' },
        { status: 'RETURNED', changedAt: '2026-11-15T11:30:00.000Z' },
      ],
    };

    const result = getRentalEvidenceTimestamps(booking);
    expect(result).toEqual({
      readyAt: '2026-11-14T08:00:00.000Z',
      pickedUpAt: '2026-11-14T09:00:00.000Z',
      returnedAt: '2026-11-15T11:30:00.000Z',
    });
  });

  it('formats deposit settlement statuses into Vietnamese', () => {
    expect(formatDepositSettlementLabel('FULLY_RELEASED')).toContain('Hoàn trả');
    expect(formatDepositSettlementLabel('PARTIALLY_RELEASED')).toContain('khấu trừ');
    expect(formatDepositSettlementLabel('DISPUTED')).toContain('tranh chấp');
    expect(formatDepositSettlementLabel('HELD')).toContain('TàGo Escrow');
  });

  it('resolves V2 and V1 damage compensation rules and formats tier values', () => {
    const v2 = resolveDamageCompensationRules({
      minorDamage: { method: 'FIXED_FEE', fixedFeeAmount: 50000 },
      moderateDamage: { method: 'PERCENTAGE_ON_ASSET', percentageOfAsset: 30 },
      severeDamage: { method: 'ACTUAL_REPAIR_COST' },
      totalLoss: { method: 'PERCENTAGE_ON_ASSET', percentageOfAsset: 100 },
    });
    expect(v2.requiresAssetValue).toBe(true);
    expect(formatDamageTierValue(v2.minorDamage)).toBe('50.000 đ');
    expect(formatDamageTierValue(v2.moderateDamage, 2000000)).toContain('600.000 đ');

    const v1 = resolveDamageCompensationRules({
      minorDamageFee: 40000,
      moderateDamagePercent: 25,
      severeDamageOrLossPercent: 80,
    });
    expect(v1.isLegacyV1).toBe(true);
    expect(v1.requiresAssetValue).toBe(true);
    expect(v1.minorDamage.fixedFeeAmount).toBe(40000);
  });

  it('maps contract states, readiness labels, and V2 API error codes', () => {
    expect(getContractStateBadge({ state: 'EFFECTIVE' }).tone).toBe('success');
    expect(getContractStateBadge({ state: 'OFFERED' }).tone).toBe('warning');
    expect(getContractReadinessMeta('AWAITING_CUSTOMER').label).toBe('Chờ bạn xác nhận');
    expect(translateApiMessage('CONTRACT_VERSION_NOT_ACCEPTED')).toContain('Hợp đồng điện tử');
    expect(translateApiMessage('CONTRACT_PDF_NOT_READY')).toContain('PDF');
    expect(translateApiMessage('BOOKING_HOLD_EXPIRED')).toContain('15 phút');
  });
});
