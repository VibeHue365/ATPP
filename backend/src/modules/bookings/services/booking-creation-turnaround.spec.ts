import { Types } from 'mongoose';
import {
  BookingCreationService,
  createBookingCreationServiceForTest,
} from './booking-creation.service';
import { SlotLeaseStatus } from '../schemas/inventory-slot-lease.schema';
import { TurnaroundStatus } from '../schemas/rental-fulfillment.types';
import { TimeSlotEngineService } from './time-slot-engine.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ScheduleCapability,
  ScheduleType,
} from '../../products/schemas/provider-schedule.schema';

describe('BookingCreationService - Turnaround Integration (Phase 1)', () => {
  // The scenarios use fixed dates in November 2026: freeze the clock (Date only) before them so the
  // "date in the past" rules do not depend on the day the suite runs.
  beforeAll(() => {
    jest.useFakeTimers({
      now: new Date('2026-11-10T01:00:00.000Z'),
      doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval',
        'clearInterval', 'queueMicrotask', 'hrtime', 'performance'],
    });
  });
  afterAll(() => jest.useRealTimers());

  let service: BookingCreationService;
  let mockBookingsRepo: any;
  let mockProductModel: any;
  let mockProviderModel: any;
  let mockInventoryItemModel: any;
  let mockInventoryReservationModel: any;
  let mockBookingItemModel: any;
  let mockBookingModel: any;
  let mockVoucherPricingService: any;
  let mockSlotLeaseService: any;
  let mockProviderScheduleModel: any;
  let timeEngineService: TimeSlotEngineService;

  beforeEach(() => {
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    mockBookingsRepo = {
      startSession: jest.fn().mockResolvedValue(session),
      createBooking: jest.fn().mockImplementation((doc) => ({
        _id: new Types.ObjectId(),
        ...doc,
      })),
      createBookingItem: jest.fn().mockImplementation((doc) => ({
        _id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue(this),
        ...doc,
      })),
      createSchedule: jest.fn().mockResolvedValue({}),
      findBookings: jest.fn().mockResolvedValue([]),
      findBookingItems: jest.fn().mockResolvedValue([]),
    };

    mockBookingModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      db: {
        collection: () => ({
          find: () => ({
            toArray: async () => [],
          }),
        }),
      },
    };

    mockProductModel = {
      findById: jest.fn(),
    };

    mockProviderModel = {
      findById: jest.fn(),
    };

    mockProviderScheduleModel = {
      find: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    mockInventoryItemModel = jest.fn().mockImplementation((doc) => ({
      _id: new Types.ObjectId(),
      save: jest.fn().mockResolvedValue(this),
      ...doc,
    }));
    mockInventoryItemModel.find = jest.fn();

    mockInventoryReservationModel = jest.fn().mockImplementation((doc) => ({
      _id: new Types.ObjectId(),
      save: jest.fn().mockResolvedValue(this),
      ...doc,
    }));
    const queryMock = Promise.resolve([]) as any;
    queryMock.sort = jest.fn().mockResolvedValue([]);
    mockInventoryReservationModel.find = jest.fn().mockReturnValue({
      session: jest.fn().mockReturnValue(queryMock),
    });
    mockInventoryReservationModel.deleteOne = jest.fn().mockResolvedValue({});

    mockBookingItemModel = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockVoucherPricingService = {
      calculatePricing: jest.fn().mockReturnValue({
        isValid: true,
        subTotal: 100000,
        depositTotal: 50000,
        comboDiscountTotal: 0,
        voucherDiscountTotal: 0,
        platformSubsidyAmount: 0,
        amountDueNow: 150000,
        travelFee: 0,
        serviceFee: 0,
        grandTotal: 150000,
        voucherSnapshot: null,
        itemAllocations: [{}],
      }),
    };

    mockSlotLeaseService = {
      acquireUpfrontBlockLease: jest.fn().mockResolvedValue([]),
    };

    const mockLeaseModel = {
      find: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    timeEngineService = new TimeSlotEngineService();

    service = createBookingCreationServiceForTest({
      bookingsRepository: mockBookingsRepo,
      bookingModel: mockBookingModel,
      productModel: mockProductModel,
      photoPackageModel: {} as any,
      priceVersionModel: {} as any,
      inventoryItemModel: mockInventoryItemModel,
      inventoryReservationModel: mockInventoryReservationModel,
      promotionsService: { reserveVoucher: jest.fn() } as any,
      paymentsService: {} as any,
      productsService: {} as any,
      notificationsService: { createNotification: jest.fn() } as any,
      providerModel: mockProviderModel,
      voucherPricingService: mockVoucherPricingService,
      leaseModel: mockLeaseModel as any,
      slotLeaseService: mockSlotLeaseService,
      timeEngineService,
      providerScheduleModel: mockProviderScheduleModel,
    });
  });

  it('DAILY rental: extends reservedTo on InventoryReservation by 1 day while preserving contractual rentalTo on BookingItem', async () => {
    const productId = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const invItemId = new Types.ObjectId();

    mockProductModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: productId,
        providerId,
        basePrice: 100000,
        depositAmount: 50000,
        name: 'Áo dài đỏ',
      }),
    });

    mockProviderModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: providerId,
        status: 'ACTIVE',
        useSlotLeases: false,
      }),
    });

    mockInventoryItemModel.find.mockReturnValue({
      session: jest.fn().mockResolvedValue([
        {
          _id: invItemId,
          productId,
          size: 'M',
          color: 'RED',
          status: 'AVAILABLE',
        },
      ]),
    });

    // Customer books 2026-11-20 to 2026-11-21
    const rentalFrom = '2026-11-20T00:00:00.000Z';
    const rentalTo = '2026-11-21T00:00:00.000Z';

    await service.createBooking('666666666666666666666666', {
      bookingType: 'AODAI_RENTAL' as any,
      items: [
        {
          productId: productId.toString(),
          rentalType: 'DAILY',
          rentalFrom,
          rentalTo,
          selectedSize: 'M',
          selectedColor: 'RED',
          quantity: 1,
        },
      ],
    });

    // 1. Verify InventoryReservation was created with reservedTo extended by 1 day
    expect(mockInventoryReservationModel).toHaveBeenCalled();
    const reservationArgs = mockInventoryReservationModel.mock.calls[0][0];
    const reservedToDate = new Date(reservationArgs.reservedTo);

    // rentalTo was 2026-11-21. Turnaround extends to 2026-11-22 23:59:59.999
    expect(reservedToDate.toISOString()).toContain('2026-11-22');

    // 2. Verify BookingItem retains contractual rentalTo (2026-11-21)
    const bookingItemArgs = mockBookingsRepo.createBookingItem.mock.calls[0][0];
    const contractualTo = new Date(bookingItemArgs.rentalTo);
    expect(contractualTo.toISOString()).toContain('2026-11-21');

    // 3. Verify slot lease service was NOT called for DAILY
    expect(
      mockSlotLeaseService.acquireUpfrontBlockLease,
    ).not.toHaveBeenCalled();
  });

  it('HOURLY rental with useSlotLeases = true: acquires upfront block lease and populates turnaround snapshot', async () => {
    const productId = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const invItemId = new Types.ObjectId();

    mockProductModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: productId,
        providerId,
        basePrice: 100000,
        hourlyPrice: 50000,
        depositAmount: 50000,
        name: 'Áo dài lụa xanh',
      }),
    });

    mockProviderModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: providerId,
        status: 'ACTIVE',
        useSlotLeases: true,
        rentalSettings: { turnaroundSlots: 2 },
      }),
    });

    mockInventoryItemModel.find.mockReturnValue({
      session: jest.fn().mockResolvedValue([
        {
          _id: invItemId,
          productId,
          size: 'L',
          color: 'BLUE',
          status: 'AVAILABLE',
        },
      ]),
    });

    const shootDate = '2026-11-25T00:00:00.000Z';
    const shootTimeSlot = '09:00 - 11:00'; // Slot 2

    await service.createBooking('666666666666666666666666', {
      bookingType: 'AODAI_RENTAL' as any,
      items: [
        {
          productId: productId.toString(),
          rentalType: 'HOURLY',
          shootDate,
          shootTimeSlot,
          selectedSize: 'L',
          selectedColor: 'BLUE',
          quantity: 1,
        },
      ],
    });

    // 1. Verify upfront block lease was acquired
    expect(mockSlotLeaseService.acquireUpfrontBlockLease).toHaveBeenCalledTimes(
      1,
    );
    const leaseCall =
      mockSlotLeaseService.acquireUpfrontBlockLease.mock.calls[0][0];

    expect(leaseCall.inventoryItemId.toString()).toBe(invItemId.toString());
    expect(leaseCall.providerId.toString()).toBe(providerId.toString());
    expect(leaseCall.rentalSlots).toHaveLength(1);
    expect(leaseCall.rentalSlots[0].slotIndex).toBe(2); // 09:00-11:00
    expect(leaseCall.turnaroundSlots).toHaveLength(2); // turnaroundSlots = 2 -> Slot 3, Slot 4
    expect(leaseCall.turnaroundSlots[0].slotIndex).toBe(3);
    expect(leaseCall.turnaroundSlots[1].slotIndex).toBe(4);
    expect(leaseCall.status).toBe(SlotLeaseStatus.Temp);

    // 2. Verify snapshot fields saved to BookingItem.rentalFulfillment
    const createdItem =
      mockBookingsRepo.createBookingItem.mock.results[0].value;
    expect(createdItem.rentalFulfillment).toBeDefined();
    expect(createdItem.rentalFulfillment.turnaroundStatus).toBe(
      TurnaroundStatus.Scheduled,
    );
    expect(createdItem.rentalFulfillment.turnaroundSlotsSnapshot).toBe(2);
    expect(createdItem.rentalFulfillment.availableFrom).toBeDefined();
  });

  it('HOURLY rental: aborts transaction and rethrows when slot collision occurs (HTTP 409)', async () => {
    const productId = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const invItemId = new Types.ObjectId();

    mockProductModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: productId,
        providerId,
        basePrice: 100000,
        hourlyPrice: 50000,
        depositAmount: 50000,
        name: 'Áo dài cưới',
      }),
    });

    mockProviderModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: providerId,
        status: 'ACTIVE',
        useSlotLeases: true,
        rentalSettings: { turnaroundSlots: 1 },
      }),
    });

    mockInventoryItemModel.find.mockReturnValue({
      session: jest.fn().mockResolvedValue([
        {
          _id: invItemId,
          productId,
          size: 'M',
          color: 'RED',
          status: 'AVAILABLE',
        },
      ]),
    });

    mockSlotLeaseService.acquireUpfrontBlockLease.mockRejectedValueOnce(
      new ConflictException(
        'Một hoặc nhiều khung giờ đã được giữ chỗ bởi khách hàng khác.',
      ),
    );

    await expect(
      service.createBooking('666666666666666666666666', {
        bookingType: 'AODAI_RENTAL' as any,
        items: [
          {
            productId: productId.toString(),
            rentalType: 'HOURLY',
            shootDate: '2026-11-25T00:00:00.000Z',
            shootTimeSlot: '09:00 - 11:00',
            selectedSize: 'M',
            selectedColor: 'RED',
            quantity: 1,
          },
        ],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('multi-slot booking 07:00-11:00 creates 2 RENTAL leases before TURNAROUND lease', async () => {
    const productId = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const invItemId = new Types.ObjectId();

    mockProductModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: productId,
        providerId,
        basePrice: 100000,
        hourlyPrice: 50000,
        depositAmount: 50000,
        name: 'Áo dài đỏ 4h',
      }),
    });

    mockProviderModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: providerId,
        status: 'ACTIVE',
        useSlotLeases: true,
        rentalSettings: { turnaroundSlots: 1 },
      }),
    });

    mockInventoryItemModel.find.mockReturnValue({
      session: jest.fn().mockResolvedValue([
        {
          _id: invItemId,
          productId,
          size: 'M',
          color: 'RED',
          status: 'AVAILABLE',
        },
      ]),
    });

    await service.createBooking('666666666666666666666666', {
      bookingType: 'AODAI_RENTAL' as any,
      items: [
        {
          productId: productId.toString(),
          rentalType: 'HOURLY',
          shootDate: '2026-11-20T00:00:00.000Z',
          shootTimeSlot: '07:00 - 11:00', // 2 slots: slot 1 (07-09) and slot 2 (09-11)
          selectedSize: 'M',
          selectedColor: 'RED',
          quantity: 1,
        },
      ],
    });

    expect(mockSlotLeaseService.acquireUpfrontBlockLease).toHaveBeenCalledTimes(
      1,
    );
    const leaseCall =
      mockSlotLeaseService.acquireUpfrontBlockLease.mock.calls[0][0];

    // Must have 2 RENTAL slots
    expect(leaseCall.rentalSlots).toHaveLength(2);
    expect(leaseCall.rentalSlots[0].slotIndex).toBe(1); // 07:00 - 09:00
    expect(leaseCall.rentalSlots[1].slotIndex).toBe(2); // 09:00 - 11:00

    // Followed by 1 TURNAROUND slot
    expect(leaseCall.turnaroundSlots).toHaveLength(1);
    expect(leaseCall.turnaroundSlots[0].slotIndex).toBe(3); // 11:00 - 13:00
  });

  it('rejects checkout of CLEANING item when operationalAvailableFrom > requestedFrom', async () => {
    const productId = new Types.ObjectId();
    const providerId = new Types.ObjectId();

    mockProductModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: productId,
        providerId,
        basePrice: 100000,
        hourlyPrice: 50000,
        depositAmount: 50000,
        name: 'Áo dài lụa',
      }),
    });

    mockProviderModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: providerId,
        status: 'ACTIVE',
        useSlotLeases: true,
        rentalSettings: { turnaroundSlots: 1 },
      }),
    });

    // Item in CLEANING status with operationalAvailableFrom finishing at 12:00 VN
    // Customer requests rental starting at 11:00 VN -> candidate query excludes this item!
    mockInventoryItemModel.find.mockImplementation((query: any) => {
      const item = {
        _id: new Types.ObjectId(),
        productId,
        size: 'M',
        color: 'RED',
        status: 'CLEANING',
        operationalAvailableFrom: new Date('2026-11-20T05:00:00.000Z'), // 12:00 VN
      };
      const maxAllowed = query?.$or?.[1]?.operationalAvailableFrom?.$lte;
      const resultItems =
        maxAllowed && item.operationalAvailableFrom > maxAllowed ? [] : [item];
      return {
        session: jest.fn().mockResolvedValue(resultItems),
      };
    });

    await expect(
      service.createBooking('666666666666666666666666', {
        bookingType: 'AODAI_RENTAL' as any,
        items: [
          {
            productId: productId.toString(),
            rentalType: 'HOURLY',
            shootDate: '2026-11-20T00:00:00.000Z',
            shootTimeSlot: '11:00 - 13:00', // 11:00 VN start
            selectedSize: 'M',
            selectedColor: 'RED',
            quantity: 1,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rolls over turnaround slots across scheduled off-days', async () => {
    const productId = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const invItemId = new Types.ObjectId();

    mockProductModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: productId,
        providerId,
        basePrice: 100000,
        hourlyPrice: 50000,
        depositAmount: 50000,
        name: 'Áo dài gấm',
      }),
    });

    mockProviderModel.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: providerId,
        status: 'ACTIVE',
        useSlotLeases: true,
        rentalSettings: { turnaroundSlots: 1 },
      }),
    });

    // Saturday 2026-11-21 is an off day for this shop
    mockProviderScheduleModel.find.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              providerId,
              capability: ScheduleCapability.AodaiRental,
              scheduleType: ScheduleType.SpecificDate,
              offDays: ['2026-11-21'],
            },
          ]),
        }),
      }),
    });

    mockInventoryItemModel.find.mockReturnValue({
      session: jest.fn().mockResolvedValue([
        {
          _id: invItemId,
          productId,
          size: 'M',
          color: 'RED',
          status: 'AVAILABLE',
        },
      ]),
    });

    // Customer rents Friday 2026-11-20 at 19:00 - 21:00 (Slot 7, the last slot of the day)
    await service.createBooking('666666666666666666666666', {
      bookingType: 'AODAI_RENTAL' as any,
      items: [
        {
          productId: productId.toString(),
          rentalType: 'HOURLY',
          shootDate: '2026-11-20T00:00:00.000Z',
          shootTimeSlot: '19:00 - 21:00', // Slot 7
          selectedSize: 'M',
          selectedColor: 'RED',
          quantity: 1,
        },
      ],
    });

    expect(mockSlotLeaseService.acquireUpfrontBlockLease).toHaveBeenCalledTimes(
      1,
    );
    const leaseCall =
      mockSlotLeaseService.acquireUpfrontBlockLease.mock.calls[0][0];

    // Rental slot is on 2026-11-20 slot 7
    expect(leaseCall.rentalSlots).toHaveLength(1);
    expect(leaseCall.rentalSlots[0].slotIndex).toBe(7);
    expect(leaseCall.rentalSlots[0].dateStr).toBe('2026-11-20');

    // Turnaround rolls over Saturday 2026-11-21 (off-day) to Sunday 2026-11-22 slot 1 (07:00-09:00)!
    expect(leaseCall.turnaroundSlots).toHaveLength(1);
    expect(leaseCall.turnaroundSlots[0].dateStr).toBe('2026-11-22');
    expect(leaseCall.turnaroundSlots[0].slotIndex).toBe(1);
  });
});
