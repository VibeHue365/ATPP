import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { PolicyCode } from '../../system-policies/constants/policy-code.enum';
import { BookingItemType } from '../../bookings/schemas/booking-item.schema';
import { PaymentStatus } from '../../bookings/schemas/booking.schema';
import { SettlementRateType } from '../constants/settlement-rate-type.enum';
import { SettlementCalculationService } from './settlement-calculation.service';

describe('SettlementCalculationService', () => {
  const policyResolver = {
    getActivePolicyByCode: jest.fn(),
  };

  beforeEach(() => {
    policyResolver.getActivePolicyByCode.mockResolvedValue({
      version: 2,
      value: {
        defaultCommissionRate: 0.1,
        sameProviderComboCommissionRate: 0.08,
        crossProviderComboCommissionRate: 0.12,
        fixedPlatformFee: 1000,
        minCommissionAmount: 0,
      },
    });
  });

  it('uses cross-provider combo rate and allocates fixed platform fee', async () => {
    const service = new SettlementCalculationService(policyResolver as never);
    const providerA = new Types.ObjectId();
    const providerB = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const result = await service.calculateSettlementsForBooking(
      {
        _id: bookingId,
        bookingCode: 'BK001',
        status: 'COMPLETED',
        paymentSummary: {
          totalPaid: 30000,
          paymentStatus: PaymentStatus.Paid,
        },
      },
      [
        {
          _id: new Types.ObjectId(),
          providerId: providerA,
          itemType: BookingItemType.Product,
          unitPrice: 10000,
          quantity: 1,
          depositAmount: 5000,
        },
        {
          _id: new Types.ObjectId(),
          providerId: providerB,
          itemType: BookingItemType.PhotographyPackage,
          unitPrice: 20000,
          quantity: 1,
          depositAmount: 0,
        },
      ],
      null,
    );

    expect(policyResolver.getActivePolicyByCode).toHaveBeenCalledWith(
      PolicyCode.CommissionPolicy,
    );
    expect(result).toHaveLength(2);
    expect(result[0].policySnapshot.appliedRateType).toBe(
      SettlementRateType.CrossProviderCombo,
    );
    expect(result[0].commissionRate).toBe(0.12);
    expect(
      result.reduce((sum, item) => sum + item.allocatedPlatformFee, 0),
    ).toBe(1000);
    expect(result[0].policySnapshot.policyVersion).toBe(2);
  });

  it('does not calculate commission on deposit amount', async () => {
    const service = new SettlementCalculationService(policyResolver as never);
    const providerId = new Types.ObjectId();
    const result = await service.calculateSettlementsForBooking(
      {
        _id: new Types.ObjectId(),
        bookingCode: 'BK002',
        status: 'COMPLETED',
        paymentSummary: {
          totalPaid: 15000,
          paymentStatus: PaymentStatus.Paid,
        },
      },
      [
        {
          _id: new Types.ObjectId(),
          providerId,
          itemType: BookingItemType.Product,
          unitPrice: 10000,
          quantity: 1,
          depositAmount: 5000,
        },
      ],
      null,
    );

    expect(result[0].grossAmount).toBe(10000);
    expect(result[0].commissionAmount).toBe(1000);
    expect(result[0].itemSnapshots[0].depositAmount).toBe(5000);
  });

  it('subtracts provider-funded combo discount before calculating commission', async () => {
    const service = new SettlementCalculationService(policyResolver as never);
    const providerId = new Types.ObjectId();
    const result = await service.calculateSettlementsForBooking(
      {
        _id: new Types.ObjectId(),
        bookingCode: 'BK003',
        status: 'COMPLETED',
        paymentSummary: {
          totalPaid: 9000,
          paymentStatus: PaymentStatus.Paid,
        },
      },
      [
        {
          _id: new Types.ObjectId(),
          providerId,
          itemType: BookingItemType.Product,
          unitPrice: 10000,
          quantity: 1,
          comboDiscountAmount: 1000,
        },
      ],
      null,
    );

    expect(result[0].grossAmount).toBe(9000);
    expect(result[0].commissionBaseAmount).toBe(9000);
    expect(result[0].commissionAmount).toBe(900);
    expect(result[0].itemSnapshots[0]).toMatchObject({
      serviceAmount: 10000,
      providerDiscountAmount: 1000,
      commissionBaseAmount: 9000,
      commissionAmount: 900,
    });
  });

  it('rejects a provider discount greater than the service amount', async () => {
    const service = new SettlementCalculationService(policyResolver as never);

    await expect(
      service.calculateSettlementsForBooking(
        {
          _id: new Types.ObjectId(),
          bookingCode: 'BK004',
          status: 'COMPLETED',
        },
        [
          {
            _id: new Types.ObjectId(),
            providerId: new Types.ObjectId(),
            itemType: BookingItemType.Product,
            unitPrice: 10000,
            quantity: 1,
            comboDiscountAmount: 10001,
          },
        ],
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the policy snapshot of an existing calculation when policy changes', async () => {
    const service = new SettlementCalculationService(policyResolver as never);
    const item = {
      _id: new Types.ObjectId(),
      providerId: new Types.ObjectId(),
      itemType: BookingItemType.Product,
      unitPrice: 10000,
      quantity: 1,
    };
    const booking = {
      _id: new Types.ObjectId(),
      bookingCode: 'BK005',
      status: 'COMPLETED',
    };
    const first = await service.calculateSettlementsForBooking(booking, [item], null);

    policyResolver.getActivePolicyByCode.mockResolvedValueOnce({
      version: 3,
      value: {
        defaultCommissionRate: 0.15,
        sameProviderComboCommissionRate: 0.11,
        crossProviderComboCommissionRate: 0.16,
        fixedPlatformFee: 1000,
        minCommissionAmount: 0,
      },
    });
    const second = await service.calculateSettlementsForBooking(booking, [item], null);

    expect(first[0].commissionRate).toBe(0.1);
    expect(first[0].policySnapshot.policyVersion).toBe(2);
    expect(second[0].commissionRate).toBe(0.15);
    expect(second[0].policySnapshot.policyVersion).toBe(3);
  });
});
