import { Types } from 'mongoose';
import { ProductAvailabilityService } from './product-availability.service';
import { TimeSlotEngineService } from '../../bookings/services/time-slot-engine.service';
import { ScheduleCapability, ScheduleType } from '../schemas/provider-schedule.schema';

describe('ProductAvailabilityService - Phase 1 Availability & Cleaning', () => {
  let productId: Types.ObjectId;
  let providerId: Types.ObjectId;
  let mockProducts: any;
  let mockInventory: any;
  let mockReservations: any;
  let mockProviderSchedule: any;
  let mockProviderModel: any;
  let mockLeaseModel: any;
  let timeEngine: TimeSlotEngineService;
  let service: ProductAvailabilityService;

  beforeEach(() => {
    productId = new Types.ObjectId();
    providerId = new Types.ObjectId();

    mockProducts = {
      findPublicById: jest.fn().mockResolvedValue({
        _id: productId,
        providerId,
      }),
    };

    // Default: provider has standard daily schedule
    mockProviderSchedule = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              providerId,
              capability: ScheduleCapability.AodaiRental,
              scheduleType: ScheduleType.Recurring,
              dayOfWeek: 0, // Sunday
            },
            {
              providerId,
              capability: ScheduleCapability.AodaiRental,
              scheduleType: ScheduleType.Recurring,
              dayOfWeek: 1, // Monday
            },
            {
              providerId,
              capability: ScheduleCapability.AodaiRental,
              scheduleType: ScheduleType.Recurring,
              dayOfWeek: 2, // Tuesday
            },
            {
              providerId,
              capability: ScheduleCapability.AodaiRental,
              scheduleType: ScheduleType.Recurring,
              dayOfWeek: 3, // Wednesday
            },
            {
              providerId,
              capability: ScheduleCapability.AodaiRental,
              scheduleType: ScheduleType.Recurring,
              dayOfWeek: 4, // Thursday
            },
            {
              providerId,
              capability: ScheduleCapability.AodaiRental,
              scheduleType: ScheduleType.Recurring,
              dayOfWeek: 5, // Friday
            },
            {
              providerId,
              capability: ScheduleCapability.AodaiRental,
              scheduleType: ScheduleType.Recurring,
              dayOfWeek: 6, // Saturday
            },
          ]),
        }),
      }),
    };

    mockProviderModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: providerId, useSlotLeases: false }),
          }),
        }),
      }),
    };

    mockReservations = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    mockLeaseModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    mockInventory = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    timeEngine = new TimeSlotEngineService();

    service = new ProductAvailabilityService(
      mockProducts,
      mockInventory,
      mockReservations,
      mockProviderSchedule,
      mockProviderModel,
      mockLeaseModel,
      timeEngine,
    );
  });

  it('rejects an invalid hourly range or non-2h multiple', async () => {
    await expect(
      service.check(productId.toString(), 'M', 'RED', '2026-08-01', '2026-08-01', 1, 'HOURLY', '12:00', '10:00'),
    ).rejects.toThrow();

    await expect(
      service.check(productId.toString(), 'M', 'RED', '2026-08-01', '2026-08-01', 1, 'HOURLY', '07:00', '10:00'),
    ).rejects.toThrow();

    await expect(
      service.check(productId.toString(), 'M', 'RED', '2026-08-01', '2026-08-01', 1, 'HOURLY', '08:00', '10:00'),
    ).rejects.toThrow();
  });

  it('filters candidate items in Inventory: excludes MAINTENANCE, LOCKED, RETIRED; allows AVAILABLE', async () => {
    const item1 = { _id: new Types.ObjectId(), status: 'AVAILABLE' };
    mockInventory.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue([item1]),
    });

    const result = await service.check(productId.toString(), 'M', 'RED', '2026-08-01', '2026-08-02', 1);

    expect(result.available).toBe(true);
    expect(result.availableQuantity).toBe(1);

    // Verify find query strictly enforces conditionStatus and status
    const query = mockInventory.find.mock.calls[0][0];
    expect(query.conditionStatus).toEqual({ $nin: ['LOCKED', 'RETIRED'] });
    expect(query.$or).toEqual([
      { status: 'AVAILABLE' },
      {
        status: 'CLEANING',
        operationalAvailableFrom: { $ne: null, $lte: expect.any(Date) },
      },
    ]);
  });

  it('allows CLEANING item if operationalAvailableFrom <= requested start time', async () => {
    // Customer requests rental starting at 11:00 on 2026-08-01
    // Item is CLEANING and finishes at 10:00 on 2026-08-01 -> Available!
    const cleaningItem = {
      _id: new Types.ObjectId(),
      status: 'CLEANING',
      operationalAvailableFrom: new Date('2026-08-01T03:00:00.000Z'), // 10:00 VN
    };

    mockInventory.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue([cleaningItem]),
    });

    const result = await service.check(
      productId.toString(),
      'M',
      'RED',
      '2026-08-01',
      '2026-08-01',
      1,
      'HOURLY',
      '11:00',
      '13:00',
    );

    expect(result.available).toBe(true);
    expect(result.availableQuantity).toBe(1);
  });

  it('rejects CLEANING item if operationalAvailableFrom > requested start time', async () => {
    // Customer requests rental starting at 11:00 on 2026-08-01
    // Item is CLEANING and finishes at 12:00 on 2026-08-01 -> Cannot be checked out!
    // The Mongo query excludes items where operationalAvailableFrom > requestedFrom
    mockInventory.find = jest.fn().mockImplementation((query: any) => {
      const item = {
        _id: new Types.ObjectId(),
        status: 'CLEANING',
        operationalAvailableFrom: new Date('2026-08-01T05:00:00.000Z'), // 12:00 VN
      };
      const maxAllowed = query?.$or?.[1]?.operationalAvailableFrom?.$lte;
      const resultItems = (maxAllowed && item.operationalAvailableFrom > maxAllowed) ? [] : [item];
      return {
        exec: jest.fn().mockResolvedValue(resultItems),
      };
    });

    const result = await service.check(
      productId.toString(),
      'M',
      'RED',
      '2026-08-01',
      '2026-08-01',
      1,
      'HOURLY',
      '11:00',
      '13:00',
    );

    expect(result.available).toBe(false);
    expect(result.availableQuantity).toBe(0);
  });

  it('rejects 07:00-11:00 rental if slot 09:00-11:00 is busy in slot leases', async () => {
    mockProviderModel.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: providerId, useSlotLeases: true }),
        }),
      }),
    });

    const item1 = { _id: new Types.ObjectId(), status: 'AVAILABLE' };
    mockInventory.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue([item1]),
    });

    // Mock lease search: slotIndex query must check [1, 2] (07:00-09:00 and 09:00-11:00)
    mockLeaseModel.find.mockImplementation((query: any) => {
      expect(query.slotIndex).toEqual({ $in: [1, 2] });
      return {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([{ inventoryItemId: item1._id }]),
          }),
        }),
      };
    });

    const result = await service.check(
      productId.toString(),
      'M',
      'RED',
      '2026-08-01',
      '2026-08-01',
      1,
      'HOURLY',
      '07:00',
      '11:00',
    );

    expect(result.available).toBe(false);
    expect(result.availableQuantity).toBe(0);
  });

  it('blocks availability when active slot leases exist for HOURLY with useSlotLeases = true', async () => {
    mockProviderModel.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: providerId, useSlotLeases: true }),
        }),
      }),
    });

    const item1 = { _id: new Types.ObjectId(), status: 'AVAILABLE' };
    mockInventory.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue([item1]),
    });

    // Item 1 has an active slot lease
    mockLeaseModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([{ inventoryItemId: item1._id }]),
        }),
      }),
    });

    const result = await service.check(
      productId.toString(),
      'M',
      'RED',
      '2026-08-01',
      '2026-08-01',
      1,
      'HOURLY',
      '09:00',
      '11:00',
    );

    expect(result.available).toBe(false);
    expect(result.availableQuantity).toBe(0);
    expect(mockLeaseModel.find).toHaveBeenCalled();
  });

  it('returns OFF_DAY if provider is scheduled off on the requested date', async () => {
    mockProviderSchedule.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            providerId,
            capability: ScheduleCapability.AodaiRental,
            scheduleType: ScheduleType.SpecificDate,
            offDays: ['2026-08-01'],
          },
        ]),
      }),
    });

    const result = await service.check(productId.toString(), 'M', 'RED', '2026-08-01', '2026-08-02', 1);

    expect(result.available).toBe(false);
    expect(result.reason).toBe('OFF_DAY');
    expect(result.message).toContain('Cửa hàng nghỉ làm việc');
  });

  describe('Turnaround Auto-Open Lifecycle Requirements (a, b, c, d, e)', () => {
    const testItemId = new Types.ObjectId();
    const availableFromUtc = new Date('2026-08-01T04:00:00.000Z'); // 11:00 VN

    it('Requirement a: Trước availableFrom: không đặt được (slot 09:00-11:00 bắt đầu trước 11:00)', async () => {
      mockInventory.find = jest.fn().mockImplementation((query: any) => {
        const item = {
          _id: testItemId,
          status: 'CLEANING',
          conditionStatus: 'GOOD',
          operationalAvailableFrom: availableFromUtc,
        };
        const maxAllowed = query?.$or?.[1]?.operationalAvailableFrom?.$lte;
        const match = !maxAllowed || item.operationalAvailableFrom <= maxAllowed;
        return {
          exec: jest.fn().mockResolvedValue(match ? [item] : []),
        };
      });

      const res = await service.check(
        productId.toString(),
        'M',
        'RED',
        '2026-08-01',
        '2026-08-01',
        1,
        'HOURLY',
        '09:00',
        '11:00',
      );
      expect(res.available).toBe(false);
      expect(res.availableQuantity).toBe(0);
    });

    it('Requirement b: Đúng availableFrom: đặt được (slot 11:00-13:00 bắt đầu đúng 11:00)', async () => {
      mockInventory.find = jest.fn().mockImplementation((query: any) => {
        const item = {
          _id: testItemId,
          status: 'CLEANING',
          conditionStatus: 'GOOD',
          operationalAvailableFrom: availableFromUtc,
        };
        const maxAllowed = query?.$or?.[1]?.operationalAvailableFrom?.$lte;
        const match = !maxAllowed || item.operationalAvailableFrom <= maxAllowed;
        return {
          exec: jest.fn().mockResolvedValue(match ? [item] : []),
        };
      });

      const res = await service.check(
        productId.toString(),
        'M',
        'RED',
        '2026-08-01',
        '2026-08-01',
        1,
        'HOURLY',
        '11:00',
        '13:00',
      );
      expect(res.available).toBe(true);
      expect(res.availableQuantity).toBe(1);
    });

    it('Requirement c: Sau availableFrom: đặt được dù provider chưa bấm cleaning-completed (vẫn CLEANING)', async () => {
      mockInventory.find = jest.fn().mockImplementation((query: any) => {
        const item = {
          _id: testItemId,
          status: 'CLEANING',
          conditionStatus: 'GOOD',
          operationalAvailableFrom: availableFromUtc,
        };
        const maxAllowed = query?.$or?.[1]?.operationalAvailableFrom?.$lte;
        const match = !maxAllowed || item.operationalAvailableFrom <= maxAllowed;
        return {
          exec: jest.fn().mockResolvedValue(match ? [item] : []),
        };
      });

      const res = await service.check(
        productId.toString(),
        'M',
        'RED',
        '2026-08-01',
        '2026-08-01',
        1,
        'HOURLY',
        '13:00',
        '15:00',
      );
      expect(res.available).toBe(true);
      expect(res.availableQuantity).toBe(1);
    });

    it('Requirement d: cleaning-completed sớm đổi status AVAILABLE, clear operationalAvailableFrom và giải phóng turnaround còn lại', async () => {
      const itemCompleted = {
        _id: testItemId,
        status: 'AVAILABLE',
        conditionStatus: 'GOOD',
        operationalAvailableFrom: null,
      };

      mockInventory.find = jest.fn().mockImplementation((query: any) => {
        const isExcluded =
          query.conditionStatus?.$nin?.includes(itemCompleted.conditionStatus);
        if (isExcluded) return { exec: jest.fn().mockResolvedValue([]) };

        const matchesStatus = query.$or?.some((cond: any) => {
          if (cond.status === 'AVAILABLE') return itemCompleted.status === 'AVAILABLE';
          if (cond.status === 'CLEANING') return itemCompleted.status === 'CLEANING';
          return false;
        });

        return {
          exec: jest.fn().mockResolvedValue(matchesStatus ? [itemCompleted] : []),
        };
      });

      const res = await service.check(
        productId.toString(),
        'M',
        'RED',
        '2026-08-01',
        '2026-08-01',
        1,
        'HOURLY',
        '09:00',
        '11:00',
      );
      expect(res.available).toBe(true);
      expect(res.availableQuantity).toBe(1);
    });

    it('Requirement e: MAINTENANCE/RETIRED không bao giờ tự mở', async () => {
      const pastTime = new Date('2026-08-01T00:00:00.000Z');
      const maintenanceItem = {
        _id: new Types.ObjectId(),
        status: 'MAINTENANCE',
        conditionStatus: 'GOOD',
        operationalAvailableFrom: pastTime,
      };
      const retiredItem = {
        _id: new Types.ObjectId(),
        status: 'CLEANING',
        conditionStatus: 'RETIRED',
        operationalAvailableFrom: pastTime,
      };

      mockInventory.find = jest.fn().mockImplementation((query: any) => {
        const items = [maintenanceItem, retiredItem].filter((it) => {
          if (query.conditionStatus?.$nin?.includes(it.conditionStatus)) {
            return false;
          }
          const matchesStatus = query.$or?.some((cond: any) => {
            if (cond.status === it.status) {
              if (cond.status === 'CLEANING') {
                return cond.operationalAvailableFrom?.$lte >= it.operationalAvailableFrom;
              }
              return true;
            }
            return false;
          });
          return matchesStatus;
        });
        return {
          exec: jest.fn().mockResolvedValue(items),
        };
      });

      const res = await service.check(
        productId.toString(),
        'M',
        'RED',
        '2026-08-01',
        '2026-08-01',
        1,
        'HOURLY',
        '13:00',
        '15:00',
      );
      expect(res.available).toBe(false);
      expect(res.availableQuantity).toBe(0);
    });
  });
});
