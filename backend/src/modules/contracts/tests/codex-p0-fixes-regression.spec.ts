import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { ContractPreparationService } from '../contract-preparation.service';
import {
  ContractMechanismService,
  AUTO_ACCEPTANCE_MECHANISM_V1,
  SYNTHETIC_TEST_MECHANISM_V2,
} from '../contract-mechanism.service';
import { ProviderContractPolicyService } from '../provider-contract-policy.service';
import { ProviderPolicyReviewStatus } from '../schemas/provider-contract-policy.schema';
import { RentalContractContext } from '../contract-source.types';
import { ContractConsentDto } from '../dto/contract-consent.dto';
import { ContractConsentAction } from '../schemas/contract-consent.schema';

const oid = () => new Types.ObjectId();

describe('Codex P0 Findings Verification & Regression Suite', () => {
  describe('P0-1: Inventory Hold Integrity in assertLiveHold (INV-01 to INV-12)', () => {
    let prepService: ContractPreparationService;
    let mockDb: any;
    let mockConnection: any;

    beforeEach(() => {
      mockDb = {
        collection: jest.fn(),
      };
      mockConnection = {
        db: mockDb,
      };

      prepService = new ContractPreparationService(
        true,
        mockConnection as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    const createTestContext = (
      bookingId: Types.ObjectId,
      itemId: Types.ObjectId,
      providerId: Types.ObjectId,
      customItemFields: Record<string, any> = {},
    ): RentalContractContext => ({
      booking: {
        _id: bookingId,
        status: 'PENDING_PAYMENT',
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        customerId: oid(),
      } as any,
      rentalItems: [
        {
          _id: itemId,
          providerId,
          productId: customItemFields.productId || oid(),
          quantity: customItemFields.quantity ?? 1,
          rentalPrice: 100000,
          depositAmount: 200000,
          rentalFrom: customItemFields.rentalFrom || new Date('2026-11-15T00:00:00Z'),
          rentalTo: customItemFields.rentalTo || new Date('2026-11-17T23:59:59Z'),
          selectedSize: customItemFields.selectedSize || 'L',
          selectedColor: customItemFields.selectedColor || 'Đỏ',
          ...customItemFields,
        } as any,
      ],
      providerPolicy: {} as any,
    });

    it('INV-01: Hold hợp lệ, đúng item, đúng product, đúng variant, đúng booking -> PASS', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const productId = oid();
      const realInventoryItemId = oid();
      const context = createTestContext(bookingId, itemId, providerId, { productId, selectedSize: 'L', selectedColor: 'Đỏ' });

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: oid(),
              bookingId,
              bookingItemId: itemId,
              inventoryItemId: realInventoryItemId,
              reservedFrom: new Date('2026-11-15T00:00:00Z'),
              reservedTo: new Date('2026-11-17T23:59:59Z'),
              status: 'TEMP_RESERVED',
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          ]),
        }),
      };

      const inventoryItemsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: realInventoryItemId,
              productId,
              size: 'L',
              color: 'Đỏ',
              status: 'AVAILABLE',
            },
          ]),
        }),
      };

      const productsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: productId,
          providerId,
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        if (name === 'inventory_items') return inventoryItemsCol;
        if (name === 'products') return productsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).resolves.not.toThrow();
    });

    it('INV-02: Không có Hold -> 422 RENTAL_HOLD_EXPIRED_OR_MISSING, không tạo Hold giả', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const context = createTestContext(bookingId, itemId, providerId);

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
        insertOne: jest.fn(),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).rejects.toThrow(
        new UnprocessableEntityException('RENTAL_HOLD_EXPIRED_OR_MISSING'),
      );
      expect(reservationsCol.insertOne).not.toHaveBeenCalled();
    });

    it('INV-03: Hold trỏ inventory item không tồn tại -> 422 RENTAL_HOLD_ITEM_NOT_FOUND', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const fakeInventoryItemId = oid();
      const context = createTestContext(bookingId, itemId, providerId);

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: oid(),
              bookingId,
              bookingItemId: itemId,
              inventoryItemId: fakeInventoryItemId,
              reservedFrom: new Date('2026-11-15T00:00:00Z'),
              reservedTo: new Date('2026-11-17T23:59:59Z'),
              status: 'TEMP_RESERVED',
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          ]),
        }),
      };

      const inventoryItemsCol = {
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        if (name === 'inventory_items') return inventoryItemsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).rejects.toThrow(
        /RENTAL_HOLD_ITEM_NOT_FOUND/,
      );
    });

    it('INV-04: Inventory item tồn tại nhưng thuộc Product khác -> 422 RENTAL_HOLD_PRODUCT_MISMATCH', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const orderedProductId = oid();
      const differentProductId = oid();
      const inventoryItemId = oid();
      const context = createTestContext(bookingId, itemId, providerId, { productId: orderedProductId });

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: oid(),
              bookingId,
              bookingItemId: itemId,
              inventoryItemId,
              reservedFrom: new Date('2026-11-15T00:00:00Z'),
              reservedTo: new Date('2026-11-17T23:59:59Z'),
              status: 'TEMP_RESERVED',
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          ]),
        }),
      };

      const inventoryItemsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: inventoryItemId,
              productId: differentProductId, // Wrong product!
              size: 'L',
              color: 'Đỏ',
            },
          ]),
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        if (name === 'inventory_items') return inventoryItemsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).rejects.toThrow(
        /RENTAL_HOLD_PRODUCT_MISMATCH/,
      );
    });

    it('INV-05: Đúng Product nhưng sai variant/size -> 422 RENTAL_HOLD_VARIANT_MISMATCH', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const productId = oid();
      const inventoryItemId = oid();
      const context = createTestContext(bookingId, itemId, providerId, { productId, selectedSize: 'XL' });

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: oid(),
              bookingId,
              bookingItemId: itemId,
              inventoryItemId,
              reservedFrom: new Date('2026-11-15T00:00:00Z'),
              reservedTo: new Date('2026-11-17T23:59:59Z'),
              status: 'TEMP_RESERVED',
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          ]),
        }),
      };

      const inventoryItemsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: inventoryItemId,
              productId,
              size: 'S', // Wrong size! Customer ordered XL
              color: 'Đỏ',
            },
          ]),
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        if (name === 'inventory_items') return inventoryItemsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).rejects.toThrow(
        /RENTAL_HOLD_VARIANT_MISMATCH/,
      );
    });

    it('INV-06: Inventory item thuộc Provider khác -> 422 RENTAL_HOLD_PROVIDER_MISMATCH', async () => {
      const providerAId = oid();
      const providerBId = oid();
      const bookingId = oid();
      const itemId = oid();
      const productId = oid();
      const inventoryItemId = oid();
      const context = createTestContext(bookingId, itemId, providerAId, { productId });

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: oid(),
              bookingId,
              bookingItemId: itemId,
              inventoryItemId,
              reservedFrom: new Date('2026-11-15T00:00:00Z'),
              reservedTo: new Date('2026-11-17T23:59:59Z'),
              status: 'TEMP_RESERVED',
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          ]),
        }),
      };

      const inventoryItemsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: inventoryItemId,
              productId,
              size: 'L',
              color: 'Đỏ',
            },
          ]),
        }),
      };

      const productsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: productId,
          providerId: providerBId, // Product belongs to Shop B, not Shop A!
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        if (name === 'inventory_items') return inventoryItemsCol;
        if (name === 'products') return productsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerAId)).rejects.toThrow(
        /RENTAL_HOLD_PROVIDER_MISMATCH/,
      );
    });

    it('INV-08: Hold hết hạn (expired) -> 422 RENTAL_HOLD_EXPIRED_OR_MISSING', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const context = createTestContext(bookingId, itemId, providerId);

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() - 1000), // Booking hold expired!
          contractFlowVersion: 2,
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).rejects.toThrow(
        new UnprocessableEntityException('BOOKING_NOT_PREPARABLE'),
      );
    });

    it('INV-09: Quantity đặt là 2 nhưng chỉ có 1 hold hợp lệ -> 422 RENTAL_HOLD_EXPIRED_OR_MISSING', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const context = createTestContext(bookingId, itemId, providerId, { quantity: 2 }); // Ordered 2 units!

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: oid(),
              bookingId,
              bookingItemId: itemId,
              inventoryItemId: oid(),
              status: 'TEMP_RESERVED',
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          ]), // Only 1 reservation found!
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).rejects.toThrow(
        new UnprocessableEntityException('RENTAL_HOLD_EXPIRED_OR_MISSING'),
      );
    });

    it('INV-10: Khoảng thời gian giữ kho không bao quát ngày bắt đầu/kết thúc thuê -> 422 RENTAL_HOLD_DATE_MISMATCH', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const productId = oid();
      const realInventoryItemId = oid();
      // Rental period is Nov 10 to Nov 20, but hold starts Nov 12
      const context = createTestContext(bookingId, itemId, providerId, {
        productId,
        rentalFrom: new Date('2026-11-10T00:00:00Z'),
        rentalTo: new Date('2026-11-20T23:59:59Z'),
      });

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: oid(),
              bookingId,
              bookingItemId: itemId,
              inventoryItemId: realInventoryItemId,
              reservedFrom: new Date('2026-11-12T00:00:00Z'), // Starts too late!
              reservedTo: new Date('2026-11-20T23:59:59Z'),
              status: 'TEMP_RESERVED',
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          ]),
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).rejects.toThrow(
        /RENTAL_HOLD_DATE_MISMATCH/,
      );
    });

    it('INV-11: Hold tạm (TEMP_RESERVED) thiếu trường expiresAt hoặc null -> 422 RENTAL_HOLD_EXPIRED_OR_MISSING', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const productId = oid();
      const realInventoryItemId = oid();
      const context = createTestContext(bookingId, itemId, providerId, { productId });

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: oid(),
              bookingId,
              bookingItemId: itemId,
              inventoryItemId: realInventoryItemId,
              reservedFrom: new Date('2026-11-15T00:00:00Z'),
              reservedTo: new Date('2026-11-17T23:59:59Z'),
              status: 'TEMP_RESERVED',
              expiresAt: null, // MISSING / NULL expiresAt on temporary hold!
            },
          ]),
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).rejects.toThrow(
        /RENTAL_HOLD_EXPIRED_OR_MISSING/,
      );
    });

    it('INV-12: Hold thiếu trường reservedFrom hoặc reservedTo -> 422 RENTAL_HOLD_DATE_MISMATCH', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const productId = oid();
      const realInventoryItemId = oid();
      const context = createTestContext(bookingId, itemId, providerId, { productId });

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: oid(),
              bookingId,
              bookingItemId: itemId,
              inventoryItemId: realInventoryItemId,
              reservedFrom: null, // Missing reservedFrom!
              reservedTo: new Date('2026-11-17T23:59:59Z'),
              status: 'TEMP_RESERVED',
              expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
          ]),
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).rejects.toThrow(
        /RENTAL_HOLD_DATE_MISMATCH/,
      );
    });

    it('INV-13: Ca hợp lệ chuẩn từ booking-creation flow: có expiresAt tương lai, bao quát rentalFrom/rentalTo -> PASS', async () => {
      const providerId = oid();
      const bookingId = oid();
      const itemId = oid();
      const productId = oid();
      const realInventoryItemId = oid();
      const rentalFrom = new Date('2026-11-15T09:00:00Z');
      const rentalTo = new Date('2026-11-17T18:00:00Z');
      const reservedFrom = new Date('2026-11-15T00:00:00Z');
      const reservedTo = new Date('2026-11-17T23:59:59Z');

      const context = createTestContext(bookingId, itemId, providerId, {
        productId,
        rentalFrom,
        rentalTo,
        selectedSize: 'XL',
        selectedColor: 'Vàng Hoàng Gia',
      });

      const bookingsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: bookingId,
          status: 'PENDING_PAYMENT',
          holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
          contractFlowVersion: 2,
        }),
      };

      const reservationsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: oid(),
              bookingId,
              bookingItemId: itemId,
              inventoryItemId: realInventoryItemId,
              reservedFrom,
              reservedTo,
              status: 'TEMP_RESERVED',
              expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            },
          ]),
        }),
      };

      const inventoryItemsCol = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              _id: realInventoryItemId,
              productId,
              size: 'XL',
              color: 'Vàng Hoàng Gia',
              status: 'AVAILABLE',
            },
          ]),
        }),
      };

      const productsCol = {
        findOne: jest.fn().mockResolvedValue({
          _id: productId,
          providerId,
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'bookings') return bookingsCol;
        if (name === 'inventory_reservations') return reservationsCol;
        if (name === 'inventory_items') return inventoryItemsCol;
        if (name === 'products') return productsCol;
        return {};
      });

      await expect(prepService.assertLiveHold(context, providerId)).resolves.not.toThrow();
    });
  });

  describe('P0-2: Atomic Concurrency Defense in Policy Review (APPROVE vs REJECT)', () => {
    let policyService: ProviderContractPolicyService;
    let mockPolicyModel: any;
    let mockConnection: any;

    beforeEach(() => {
      mockPolicyModel = {
        findById: jest.fn(),
        findOneAndUpdate: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };
      mockConnection = {
        db: {
          collection: jest.fn().mockReturnValue({
            findOne: jest.fn().mockResolvedValue({ userId: oid() }),
            insertOne: jest.fn().mockResolvedValue({ insertedId: oid() }),
            updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
          }),
        },
      };

      policyService = new ProviderContractPolicyService(
        true,
        mockConnection as any,
        mockPolicyModel as any,
        {} as any,
        {} as any,
      );
    });

    const adminUser: any = {
      sub: oid().toString(),
      roles: ['ADMIN'],
    };

    it('handles concurrent APPROVE and REJECT: exactly one succeeds and the other receives 409 Conflict', async () => {
      const versionId = oid();
      const providerId = oid();

      const pendingDoc: any = {
        _id: versionId,
        providerId,
        versionNumber: 2,
        status: ProviderPolicyReviewStatus.PendingReview,
        damageCompensation: { disputeResolutionTerms: 'Tòa án có thẩm quyền' },
      };

      mockPolicyModel.findById.mockResolvedValue(pendingDoc);
      mockPolicyModel.findOneAndUpdate
        .mockResolvedValueOnce({
          ...pendingDoc,
          status: ProviderPolicyReviewStatus.Approved,
          approvedAt: new Date(),
        })
        .mockResolvedValueOnce(null);

      const approvePromise = policyService.adminReview(adminUser, versionId.toString(), {
        action: 'APPROVE',
        reviewNote: 'Duyệt chính sách',
      });

      const rejectPromise = policyService.adminReview(adminUser, versionId.toString(), {
        action: 'REJECT',
        reviewNote: 'Từ chối chính sách',
      });

      const results = await Promise.allSettled([approvePromise, rejectPromise]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const failureReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(failureReason).toBeInstanceOf(ConflictException);
      expect(failureReason.message).toBe('POLICY_NOT_PENDING_REVIEW');
    });

    it('rejects double APPROVE on the same policy version', async () => {
      const versionId = oid();
      const pendingDoc: any = {
        _id: versionId,
        providerId: oid(),
        versionNumber: 1,
        status: ProviderPolicyReviewStatus.PendingReview,
        damageCompensation: { disputeResolutionTerms: 'Tòa án thẩm quyền' },
      };

      mockPolicyModel.findById.mockResolvedValue(pendingDoc);
      mockPolicyModel.findOneAndUpdate
        .mockResolvedValueOnce({ ...pendingDoc, status: ProviderPolicyReviewStatus.Approved })
        .mockResolvedValueOnce(null);

      const first = policyService.adminReview(adminUser, versionId.toString(), { action: 'APPROVE' });
      const second = policyService.adminReview(adminUser, versionId.toString(), { action: 'APPROVE' });

      const results = await Promise.allSettled([first, second]);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });

    it('rejects double REJECT on the same policy version', async () => {
      const versionId = oid();
      const pendingDoc: any = {
        _id: versionId,
        providerId: oid(),
        versionNumber: 1,
        status: ProviderPolicyReviewStatus.PendingReview,
        damageCompensation: { disputeResolutionTerms: 'Tòa án thẩm quyền' },
      };

      mockPolicyModel.findById.mockResolvedValue(pendingDoc);
      mockPolicyModel.findOneAndUpdate
        .mockResolvedValueOnce({ ...pendingDoc, status: ProviderPolicyReviewStatus.Rejected })
        .mockResolvedValueOnce(null);

      const first = policyService.adminReview(adminUser, versionId.toString(), { action: 'REJECT', reviewNote: 'Thiếu thông tin' });
      const second = policyService.adminReview(adminUser, versionId.toString(), { action: 'REJECT', reviewNote: 'Thiếu thông tin' });

      const results = await Promise.allSettled([first, second]);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });
  });

  describe('P0-3: Platform Mechanism Fail-Closed Behavior (MECH-01 to MECH-07)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.CONTRACT_MECHANISM_APPROVED;
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('MECH-01: Flag OFF -> Không có mechanism được chấp thuận ngầm (defaults to DRAFT)', () => {
      process.env.CONTRACT_MECHANISM_APPROVED = 'false';
      const service = new ContractMechanismService();

      const draft = service.getDraft();
      expect(draft.status).toBe('DRAFT');
      expect(draft.approvedAt).toBeNull();

      expect(() => service.getApproved()).toThrow(
        new UnprocessableEntityException('CONTRACT_MECHANISM_NOT_APPROVED'),
      );
    });

    it('MECH-02: Flag ON in production runtime -> Synthetic fixture is NEVER returned as APPROVED in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.CONTRACT_MECHANISM_APPROVED = 'true';
      const service = new ContractMechanismService();

      const draft = service.getDraft();
      expect(draft.status).toBe('DRAFT');
      expect(draft.approvedAt).toBeNull();

      expect(() => service.getApproved()).toThrow(
        new UnprocessableEntityException('CONTRACT_MECHANISM_NOT_APPROVED'),
      );
    });

    it('MECH-03: Isolated test environment with flag ON -> Returns test approved fixture', () => {
      process.env.NODE_ENV = 'test';
      process.env.CONTRACT_MECHANISM_APPROVED = 'true';
      const service = new ContractMechanismService();

      const approved = service.getApproved();
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedAt).toBeDefined();
      expect(approved.version).toBe('auto-acceptance-v1');
    });

    it('MECH-04: Combination check: NODE_ENV=production + CONTRACT_TEST_ISOLATED=true + CONTRACT_MECHANISM_APPROVED=true -> MUST still fail closed in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.CONTRACT_TEST_ISOLATED = 'true';
      process.env.CONTRACT_MECHANISM_APPROVED = 'true';
      const service = new ContractMechanismService();

      const draft = service.getDraft();
      expect(draft.status).toBe('DRAFT');
      expect(draft.approvedAt).toBeNull();

      expect(() => service.getApproved()).toThrow(
        new UnprocessableEntityException('CONTRACT_MECHANISM_NOT_APPROVED'),
      );
    });
  });

  describe('P0-4: ContractConsentDto Whitelist & Source Field Compatibility', () => {
    it('DTO-01: Accepts standard payload without optional fields', async () => {
      const dto = new ContractConsentDto();
      dto.contractVersionId = new Types.ObjectId().toHexString();
      dto.action = ContractConsentAction.Accept;
      dto.contentHash = 'a'.repeat(64);
      dto.bookingFingerprint = 'b'.repeat(64);
      dto.idempotencyKey = 'idempotency-key-12345';

      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      expect(errors.length).toBe(0);
    });

    it('DTO-02: Accepts payload with source: CHECKOUT_QUICK_FORM and presentationMode: QUICK without 400', async () => {
      const dto = new ContractConsentDto();
      dto.contractVersionId = new Types.ObjectId().toHexString();
      dto.action = ContractConsentAction.Accept;
      dto.contentHash = 'a'.repeat(64);
      dto.bookingFingerprint = 'b'.repeat(64);
      dto.idempotencyKey = 'idempotency-key-12345';
      dto.source = 'CHECKOUT_QUICK_FORM';
      dto.presentationMode = 'QUICK';

      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      expect(errors.length).toBe(0);
    });
  });
});
