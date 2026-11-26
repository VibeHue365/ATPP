import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus } from '../schemas/booking.schema';
import {
  BookingScheduleStatus,
  BookingScheduleType,
} from '../schemas/booking-schedule.schema';
import { ProviderStaffStatus } from '../../providers/schemas/provider-staff.schema';
import { StaffAvailabilityService } from './staff-availability.service';

function makeChain<T>(value: T) {
  return {
    session: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('StaffAvailabilityService (Phase 1 Core)', () => {
  const providerId = new Types.ObjectId();
  const ownerUserId = new Types.ObjectId();

  function buildFixture(opts: {
    providerSettings?: { maxConcurrentSessions?: number | null; maxDailySessions?: number | null };
    activeStaff?: Array<any>;
    v2Schedules?: Array<any>;
    bookingItems?: Array<any>;
    activeBookings?: Array<any>;
    singleBooking?: any;
    singleSchedule?: any;
    providerOwns?: boolean;
  }) {
    const mongoSession = {
      withTransaction: jest.fn(async (cb: () => Promise<void>) => cb()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    const providerModel = {
      findById: jest.fn().mockReturnValue(
        makeChain({
          _id: providerId,
          businessName: 'Studio Huế Xưa',
          photographySettings: opts.providerSettings ?? {},
        }),
      ),
      exists: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(opts.providerOwns !== false),
      }),
    };

    const staffModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.activeStaff ?? [])),
    };

    const scheduleDoc = opts.singleSchedule
      ? {
          ...opts.singleSchedule,
          save: jest.fn().mockResolvedValue(opts.singleSchedule),
          toObject: jest.fn().mockImplementation(function (this: any) {
            return { ...this };
          }),
        }
      : null;

    const bookingScheduleModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.v2Schedules ?? [])),
      findOne: jest.fn().mockReturnValue(makeChain(scheduleDoc)),
    };

    const bookingItemModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.bookingItems ?? [])),
    };

    const bookingModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.activeBookings ?? [])),
      findById: jest.fn().mockReturnValue(makeChain(opts.singleBooking ?? null)),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      db: { startSession: jest.fn().mockResolvedValue(mongoSession) },
    };

    const scheduleLockModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      }),
    };

    const notificationsService = {
      createNotification: jest.fn().mockResolvedValue({}),
    };

    const service = new StaffAvailabilityService(
      providerModel as any,
      staffModel as any,
      bookingScheduleModel as any,
      bookingItemModel as any,
      bookingModel as any,
      scheduleLockModel as any,
      notificationsService as any,
    );

    return {
      service,
      providerModel,
      staffModel,
      bookingScheduleModel,
      bookingItemModel,
      bookingModel,
      scheduleLockModel,
      notificationsService,
      scheduleDoc,
    };
  }

  it('keeps legacy capacity = 1 when studio has 0 staff records', async () => {
    const { service } = buildFixture({ activeStaff: [] });
    const first = await service.evaluateSessions(providerId, [
      { clientId: 's1', dateKey: '2026-12-10', startMin: 480, endMin: 600 },
    ]);
    expect(first.valid).toBe(true);
    expect(first.configuredCapacity).toBe(1);
    expect(first.assignmentsByClientId.get('s1')?.assignedStaffId).toBeNull();

    const { service: occupiedService } = buildFixture({
      activeStaff: [],
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-12-10',
          startsAt: new Date('2026-12-10T08:00:00+07:00'),
          endsAt: new Date('2026-12-10T10:00:00+07:00'),
        },
      ],
    });
    const second = await occupiedService.evaluateSessions(providerId, [
      { clientId: 's2', dateKey: '2026-12-10', startMin: 510, endMin: 630 },
    ]);
    expect(second.valid).toBe(false);
    expect(second.errors[0].code).toBe('SLOT_UNAVAILABLE');
  });

  it('respects maxConcurrentSessions <= activeStaffCount, load-balances across staff, and saturates at limit', async () => {
    const s1 = { _id: new Types.ObjectId(), name: 'Minh Khoa', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = { _id: new Types.ObjectId(), name: 'Quốc Bảo', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };
    const s3 = { _id: new Types.ObjectId(), name: 'Gia Huy', phone: '0903', status: ProviderStaffStatus.Active, sortOrder: 2, blockedSlots: [] };

    // 3 active staff, but owner sets maxConcurrentSessions = 2; Minh Khoa already has 1 morning booking at 06:00-07:30 and 1 at 08:00-10:00
    const b1Id = new Types.ObjectId();
    const { service } = buildFixture({
      providerSettings: { maxConcurrentSessions: 2 },
      activeStaff: [s1, s2, s3],
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: b1Id,
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-12-10',
          startsAt: new Date('2026-12-10T08:00:00+07:00'),
          endsAt: new Date('2026-12-10T10:00:00+07:00'),
          assignedStaffId: s1._id,
        },
      ],
    });

    // 2nd overlapping booking at 08:00-10:00 should succeed and assign Quốc Bảo (least loaded free staff)
    const second = await service.evaluateSessions(providerId, [
      { clientId: 'req2', dateKey: '2026-12-10', startMin: 480, endMin: 600 },
    ]);
    expect(second.valid).toBe(true);
    expect(second.configuredCapacity).toBe(2);
    expect(second.assignmentsByClientId.get('req2')?.assignedStaffId?.toString()).toBe(s2._id.toString());
    expect(second.assignmentsByClientId.get('req2')?.remainingSlotsAfterAssign).toBe(0);

    // When 2 bookings occupy 08:00-10:00 (capacity = 2), 3rd booking must be rejected even though 3rd staff exists
    const { service: fullService } = buildFixture({
      providerSettings: { maxConcurrentSessions: 2 },
      activeStaff: [s1, s2, s3],
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: b1Id,
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-12-10',
          startsAt: new Date('2026-12-10T08:00:00+07:00'),
          endsAt: new Date('2026-12-10T10:00:00+07:00'),
          assignedStaffId: s1._id,
        },
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-12-10',
          startsAt: new Date('2026-12-10T08:00:00+07:00'),
          endsAt: new Date('2026-12-10T10:00:00+07:00'),
          assignedStaffId: s2._id,
        },
      ],
    });
    const third = await fullService.evaluateSessions(providerId, [
      { clientId: 'req3', dateKey: '2026-12-10', startMin: 480, endMin: 600 },
    ]);
    expect(third.valid).toBe(false);

    const summary = await fullService.computeBusyScheduleSummary(providerId);
    expect(summary.effectiveCapacity).toBe(2);
    expect(summary.bookedDates).toEqual(['2026-12-10']);
    expect(summary.bookedSlots).toEqual([
      expect.objectContaining({ date: '2026-12-10', timeSlot: '08:00-10:00' }),
    ]);
  });

  it('prevents V2 double-counting when same bookingItemId appears in both BookingSchedule and BookingItem', async () => {
    const s1 = { _id: new Types.ObjectId(), name: 'Khoa', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = { _id: new Types.ObjectId(), name: 'Bảo', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };
    const bId = new Types.ObjectId();
    const itemId = new Types.ObjectId();

    const { service } = buildFixture({
      activeStaff: [s1, s2],
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: bId,
          bookingItemId: itemId,
          providerLocalDate: '2026-12-10',
          startsAt: new Date('2026-12-10T08:00:00+07:00'),
          endsAt: new Date('2026-12-10T10:00:00+07:00'),
          assignedStaffId: s1._id,
        },
      ],
      bookingItems: [
        {
          _id: itemId,
          bookingId: bId,
          shootDate: new Date('2026-12-10T00:00:00+07:00'),
          shootTimeSlot: '08:00-10:00',
        },
      ],
      activeBookings: [{ _id: bId }],
    });

    // Should still allow 2nd booking (1/2 used, NOT 2/2 double-counted)
    const evalRes = await service.evaluateSessions(providerId, [
      { clientId: 'second', dateKey: '2026-12-10', startMin: 480, endMin: 600 },
    ]);
    expect(evalRes.valid).toBe(true);
    expect(evalRes.remainingByClientId.get('second')).toBe(1);

    const summary = await service.computeBusyScheduleSummary(providerId);
    expect(summary.bookedSlots).toHaveLength(0);
    expect(summary.slotAvailability).toEqual([
      {
        date: '2026-12-10',
        timeSlot: '08:00-10:00',
        occupiedCount: 1,
        capacity: 2,
        remainingSlots: 1,
      },
    ]);
  });

  it('deducts legacy unassigned schedules from effectiveCapacity and handles staff blockedSlots', async () => {
    const s1 = {
      _id: new Types.ObjectId(),
      name: 'Khoa',
      phone: '0901',
      status: ProviderStaffStatus.Active,
      sortOrder: 0,
      blockedSlots: [{ _id: new Types.ObjectId(), date: '2026-12-10', startTime: '08:00', endTime: '12:00', reason: 'Nghỉ sáng' }],
    };
    const s2 = { _id: new Types.ObjectId(), name: 'Bảo', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };

    // s1 blocked 08:00-12:00 -> effective working staff at 08:00-10:00 = 1 (only s2),
    // and there is already 1 legacy unassigned booking at 08:00-10:00 -> 0 slots remaining!
    const { service } = buildFixture({
      activeStaff: [s1, s2],
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-12-10',
          startsAt: new Date('2026-12-10T08:00:00+07:00'),
          endsAt: new Date('2026-12-10T10:00:00+07:00'),
          assignedStaffId: null,
        },
      ],
    });

    const morning = await service.evaluateSessions(providerId, [
      { clientId: 'am', dateKey: '2026-12-10', startMin: 480, endMin: 600 },
    ]);
    expect(morning.valid).toBe(false);

    // Afternoon 14:00-16:00 both s1 and s2 are working -> valid!
    const afternoon = await service.evaluateSessions(providerId, [
      { clientId: 'pm', dateKey: '2026-12-10', startMin: 840, endMin: 960 },
    ]);
    expect(afternoon.valid).toBe(true);
    expect(afternoon.remainingByClientId.get('pm')).toBe(2);
  });

  it('rejects preferredStaffId if busy even when another staff member is free', async () => {
    const s1 = { _id: new Types.ObjectId(), name: 'Khoa', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = { _id: new Types.ObjectId(), name: 'Bảo', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };

    const { service } = buildFixture({
      activeStaff: [s1, s2],
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-12-10',
          startsAt: new Date('2026-12-10T08:00:00+07:00'),
          endsAt: new Date('2026-12-10T10:00:00+07:00'),
          assignedStaffId: s1._id,
        },
      ],
    });

    const pickBusy = await service.evaluateSessions(
      providerId,
      [{ clientId: 'c1', dateKey: '2026-12-10', startMin: 480, endMin: 600 }],
      { preferredStaffId: s1._id.toString() },
    );
    expect(pickBusy.valid).toBe(false);

    const pickFree = await service.evaluateSessions(
      providerId,
      [{ clientId: 'c1', dateKey: '2026-12-10', startMin: 480, endMin: 600 }],
      { preferredStaffId: s2._id.toString() },
    );
    expect(pickFree.valid).toBe(true);
  });

  it('reassigns staff safely before IN_PROGRESS, acquires lock, notifies customer, and blocks when already IN_PROGRESS', async () => {
    const bookingId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const s1 = { _id: new Types.ObjectId(), name: 'Khoa', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = { _id: new Types.ObjectId(), name: 'Bảo', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };
    const schId = new Types.ObjectId();

    const { service, scheduleLockModel, notificationsService, scheduleDoc } =
      buildFixture({
        activeStaff: [s1, s2],
        singleBooking: {
          _id: bookingId,
          bookingCode: 'BK999',
          customerId,
          status: BookingStatus.Confirmed,
        },
        singleSchedule: {
          _id: schId,
          bookingId,
          providerId,
          scheduleType: BookingScheduleType.Photoshoot,
          providerLocalDate: '2026-12-10',
          startsAt: new Date('2026-12-10T08:00:00+07:00'),
          endsAt: new Date('2026-12-10T10:00:00+07:00'),
          assignedStaffId: s1._id,
          assignedStaffSnapshot: { name: 'Khoa', phone: '0901' },
          status: BookingScheduleStatus.Confirmed,
        },
      });

    await service.assignStaffToSchedule(
      bookingId.toString(),
      schId.toString(),
      s2._id.toString(),
      ownerUserId.toString(),
      ['PROVIDER'],
      'Khoa bị ốm',
    );

    expect(scheduleLockModel.findOneAndUpdate).toHaveBeenCalled();
    expect(scheduleDoc?.assignedStaffId.toString()).toBe(s2._id.toString());
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      customerId.toString(),
      expect.stringContaining('cập nhật thợ chụp'),
      expect.stringContaining('Bảo'),
      expect.anything(),
      expect.anything(),
    );

    // Block when IN_PROGRESS
    const { service: lockedService } = buildFixture({
      activeStaff: [s1, s2],
      singleBooking: {
        _id: bookingId,
        bookingCode: 'BK999',
        customerId,
        status: BookingStatus.InProgress,
      },
    });
    await expect(
      lockedService.assignStaffToSchedule(
        bookingId.toString(),
        schId.toString(),
        s2._id.toString(),
        ownerUserId.toString(),
        ['PROVIDER'],
      ),
    ).rejects.toThrow(BadRequestException);

    // Block unauthorized non-owner
    const { service: forbiddenService } = buildFixture({
      activeStaff: [s1, s2],
      providerOwns: false,
      singleBooking: {
        _id: bookingId,
        bookingCode: 'BK999',
        customerId,
        status: BookingStatus.Confirmed,
      },
      singleSchedule: {
        _id: schId,
        bookingId,
        providerId,
        scheduleType: BookingScheduleType.Photoshoot,
        providerLocalDate: '2026-12-10',
        startsAt: new Date('2026-12-10T08:00:00+07:00'),
        endsAt: new Date('2026-12-10T10:00:00+07:00'),
        status: BookingScheduleStatus.Confirmed,
      },
    });
    await expect(
      forbiddenService.assignStaffToSchedule(
        bookingId.toString(),
        schId.toString(),
        s2._id.toString(),
        ownerUserId.toString(),
        ['PROVIDER'],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects assigning a staff member who is blocked by an off-day', async () => {
    const bookingId = new Types.ObjectId();
    const s1 = { _id: new Types.ObjectId(), name: 'Khoa', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = {
      _id: new Types.ObjectId(),
      name: 'Bảo',
      phone: '0902',
      status: ProviderStaffStatus.Active,
      sortOrder: 1,
      blockedSlots: [{ _id: new Types.ObjectId(), date: '2026-12-10', startTime: null, endTime: null, reason: 'Nghỉ phép' }],
    };
    const schId = new Types.ObjectId();

    const { service } = buildFixture({
      activeStaff: [s1, s2],
      singleBooking: {
        _id: bookingId,
        bookingCode: 'BK777',
        customerId: new Types.ObjectId(),
        status: BookingStatus.Confirmed,
      },
      singleSchedule: {
        _id: schId,
        bookingId,
        providerId,
        scheduleType: BookingScheduleType.Photoshoot,
        providerLocalDate: '2026-12-10',
        startsAt: new Date('2026-12-10T08:00:00+07:00'),
        endsAt: new Date('2026-12-10T10:00:00+07:00'),
        assignedStaffId: s1._id,
        status: BookingScheduleStatus.Confirmed,
      },
    });

    await expect(
      service.assignStaffToSchedule(
        bookingId.toString(),
        schId.toString(),
        s2._id.toString(),
        ownerUserId.toString(),
        ['PROVIDER'],
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('surfaces reduced studio capacity in slotAvailability when 1 of 2 staff self-blocks a window and fully saturates when all block', async () => {
    const s1 = {
      _id: new Types.ObjectId(),
      name: 'Tuấn',
      phone: '0901',
      status: ProviderStaffStatus.Active,
      sortOrder: 0,
      blockedSlots: [
        {
          _id: new Types.ObjectId(),
          date: '2026-12-20',
          startTime: '08:00',
          endTime: '12:00',
          reason: 'Bận sáng',
        },
      ],
    };
    const s2 = {
      _id: new Types.ObjectId(),
      name: 'Nam',
      phone: '0902',
      status: ProviderStaffStatus.Active,
      sortOrder: 1,
      blockedSlots: [],
    };

    const { service } = buildFixture({ activeStaff: [s1, s2] });

    // Overall studio summary: 08:00-12:00 has capacity reduced from 2 -> 1 even with 0 bookings
    const summaryAll = await service.computeBusyScheduleSummary(providerId);
    expect(summaryAll.bookedSlots).toHaveLength(0);
    expect(summaryAll.slotAvailability).toEqual([
      {
        date: '2026-12-20',
        timeSlot: '08:00-12:00',
        occupiedCount: 0,
        capacity: 1,
        remainingSlots: 1,
      },
    ]);

    // Specific staff summary for s1: 08:00-12:00 is fully saturated (blocked)
    const summaryS1 = await service.computeBusyScheduleSummary(
      providerId,
      s1._id.toString(),
    );
    expect(summaryS1.bookedDates).toContain('2026-12-20');
    expect(summaryS1.bookedSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-12-20',
          timeSlot: '08:00-12:00',
        }),
      ]),
    );
  });

  it('defers staff assignment (Option 1A) while accurately enforcing concurrent slot capacity across 3 staff', async () => {
    const s1 = { _id: new Types.ObjectId(), name: 'Tuấn', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = { _id: new Types.ObjectId(), name: 'Nam', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };
    const s3 = { _id: new Types.ObjectId(), name: 'Lan', phone: '0903', status: ProviderStaffStatus.Active, sortOrder: 2, blockedSlots: [] };

    // Already 1 unassigned booking at 11:00-12:00 -> 2 slots left out of 3
    const { service } = buildFixture({
      activeStaff: [s1, s2, s3],
      providerSettings: { maxConcurrentSessions: null },
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T11:00:00+07:00'),
          endsAt: new Date('2026-11-27T12:00:00+07:00'),
          assignedStaffId: null,
        },
      ],
    });

    const second = await service.evaluateSessions(
      providerId,
      [{ clientId: 'b2', dateKey: '2026-11-27', startMin: 660, endMin: 720 }],
      { deferStaffAssignment: true },
    );
    expect(second.valid).toBe(true);
    expect(second.configuredCapacity).toBe(3);
    expect(second.remainingByClientId.get('b2')).toBe(2);
    expect(second.assignmentsByClientId.get('b2')?.assignedStaffId).toBeNull();
    expect(second.assignmentsByClientId.get('b2')?.assignedStaffSnapshot).toBeNull();
    expect(second.assignmentsByClientId.get('b2')?.remainingSlotsAfterAssign).toBe(1);

    const summary = await service.computeBusyScheduleSummary(providerId);
    expect(summary.effectiveCapacity).toBe(3);
    expect(summary.bookedSlots).toHaveLength(0);
    expect(summary.slotAvailability).toEqual([
      {
        date: '2026-11-27',
        timeSlot: '11:00-12:00',
        occupiedCount: 1,
        capacity: 3,
        remainingSlots: 2,
      },
    ]);
  });

  it('returns structured ScheduleAvailableStaffResponse with staffId and conflictReason from getAvailableStaffForSchedule', async () => {
    const bookingId = new Types.ObjectId();
    const schId = new Types.ObjectId();
    const s1 = { _id: new Types.ObjectId(), name: 'Tuấn', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = { _id: new Types.ObjectId(), name: 'Nam', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };

    const { service } = buildFixture({
      activeStaff: [s1, s2],
      singleSchedule: {
        _id: schId,
        bookingId,
        providerId,
        scheduleType: BookingScheduleType.Photoshoot,
        providerLocalDate: '2026-11-27',
        startsAt: new Date('2026-11-27T11:00:00+07:00'),
        endsAt: new Date('2026-11-27T12:00:00+07:00'),
        assignedStaffId: null,
        status: BookingScheduleStatus.Confirmed,
      },
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T11:00:00+07:00'),
          endsAt: new Date('2026-11-27T12:00:00+07:00'),
          assignedStaffId: s1._id,
        },
      ],
    });

    const res = await service.getAvailableStaffForSchedule(
      bookingId.toString(),
      schId.toString(),
      ownerUserId.toString(),
      ['PROVIDER'],
    );
    expect(res.scheduleId).toBe(schId.toString());
    expect(res.dateKey).toBe('2026-11-27');
    expect(res.timeSlot).toBe('11:00 - 12:00');
    expect(res.activeStaffCount).toBe(2);
    expect(res.currentAssignedStaffId).toBeNull();
    expect(res.staff).toHaveLength(2);
    expect(res.staff[0]).toMatchObject({
      staffId: s1._id.toString(),
      available: false,
      conflictReason: 'Đang bận đơn chụp khác cùng giờ',
      isCurrentAssigned: false,
    });
    expect(res.staff[1]).toMatchObject({
      staffId: s2._id.toString(),
      available: true,
      conflictReason: null,
      isCurrentAssigned: false,
    });
  });

  it('keeps per-slot stock accurate while reporting dailyAvailability and locks full day once maxDailySessions is reached', async () => {
    const s1 = { _id: new Types.ObjectId(), name: 'Tuấn', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = { _id: new Types.ObjectId(), name: 'Nam', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };
    const s3 = { _id: new Types.ObjectId(), name: 'Lan', phone: '0903', status: ProviderStaffStatus.Active, sortOrder: 2, blockedSlots: [] };

    // 3 staff (3 concurrent), maxDailySessions = 3, already 2 bookings on 2026-11-27 -> dailyRemaining = 1
    const { service: almostFull } = buildFixture({
      activeStaff: [s1, s2, s3],
      providerSettings: { maxConcurrentSessions: null, maxDailySessions: 3 },
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T08:00:00+07:00'),
          endsAt: new Date('2026-11-27T09:00:00+07:00'),
          assignedStaffId: s1._id,
        },
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T11:00:00+07:00'),
          endsAt: new Date('2026-11-27T12:00:00+07:00'),
          assignedStaffId: s2._id,
        },
      ],
    });

    const partialSummary = await almostFull.computeBusyScheduleSummary(providerId);
    expect(partialSummary.bookedSlots).toHaveLength(0);
    expect(partialSummary.dailyAvailability).toEqual([
      { date: '2026-11-27', used: 2, limit: 3, remaining: 1 },
    ]);
    // Per-slot stock only drops on the actual booked windows (08:00-09:00 and 11:00-12:00)
    expect(partialSummary.slotAvailability).toEqual([
      { date: '2026-11-27', timeSlot: '08:00-09:00', occupiedCount: 1, capacity: 3, remainingSlots: 2 },
      { date: '2026-11-27', timeSlot: '11:00-12:00', occupiedCount: 1, capacity: 3, remainingSlots: 2 },
    ]);

    // Now 3 distinct bookings on 2026-11-27 -> dailyRemaining = 0 -> full day locked!
    const { service: dailyFull } = buildFixture({
      activeStaff: [s1, s2, s3],
      providerSettings: { maxConcurrentSessions: null, maxDailySessions: 3 },
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T08:00:00+07:00'),
          endsAt: new Date('2026-11-27T09:00:00+07:00'),
          assignedStaffId: s1._id,
        },
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T11:00:00+07:00'),
          endsAt: new Date('2026-11-27T12:00:00+07:00'),
          assignedStaffId: s2._id,
        },
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T14:00:00+07:00'),
          endsAt: new Date('2026-11-27T15:00:00+07:00'),
          assignedStaffId: s3._id,
        },
      ],
    });

    const fullSummary = await dailyFull.computeBusyScheduleSummary(providerId);
    expect(fullSummary.bookedDates).toContain('2026-11-27');
    expect(fullSummary.bookedSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-11-27', timeSlot: '00:00-24:00' }),
      ]),
    );
    expect(fullSummary.dailyAvailability).toEqual([
      { date: '2026-11-27', used: 3, limit: 3, remaining: 0 },
    ]);
  });

  it('allows assigning free active staff to already-existing bookings even when maxConcurrentSessions is lowered, while still blocking overlapping staff and new bookings', async () => {
    const booking1Id = new Types.ObjectId();
    const booking2Id = new Types.ObjectId();
    const sch1Id = new Types.ObjectId();
    const sch2Id = new Types.ObjectId();
    const s1 = { _id: new Types.ObjectId(), name: 'Tuấn', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = { _id: new Types.ObjectId(), name: 'Nam', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };

    const sch1Base = {
      _id: sch1Id,
      bookingId: booking1Id,
      bookingItemId: new Types.ObjectId(),
      providerId,
      scheduleType: BookingScheduleType.Photoshoot,
      providerLocalDate: '2026-11-27',
      startsAt: new Date('2026-11-27T11:00:00+07:00'),
      endsAt: new Date('2026-11-27T12:00:00+07:00'),
      assignedStaffId: null,
      status: BookingScheduleStatus.Confirmed,
    };
    const sch2Base = {
      _id: sch2Id,
      bookingId: booking2Id,
      bookingItemId: new Types.ObjectId(),
      providerId,
      scheduleType: BookingScheduleType.Photoshoot,
      providerLocalDate: '2026-11-27',
      startsAt: new Date('2026-11-27T11:00:00+07:00'),
      endsAt: new Date('2026-11-27T12:00:00+07:00'),
      assignedStaffId: null,
      status: BookingScheduleStatus.Confirmed,
    };

    // Studio owner lowered maxConcurrentSessions = 1 while 2 existing bookings overlap at 11:00-12:00.
    // Assigning s1 (free) to sch1 must succeed despite remainingSlots = 0 for studio cap.
    const { service: assignFirst } = buildFixture({
      activeStaff: [s1, s2],
      providerSettings: { maxConcurrentSessions: 1 },
      singleBooking: {
        _id: booking1Id,
        bookingCode: 'BK801',
        customerId: new Types.ObjectId(),
        status: BookingStatus.Confirmed,
      },
      singleSchedule: sch1Base,
      v2Schedules: [sch1Base, sch2Base],
    });
    const firstAssigned = await assignFirst.assignStaffToSchedule(
      booking1Id.toString(),
      sch1Id.toString(),
      s1._id.toString(),
      ownerUserId.toString(),
      ['PROVIDER'],
    );
    expect(firstAssigned.assignedStaffId?.toString()).toBe(s1._id.toString());

    // Now sch1 has s1; assigning free s2 to existing sch2 must also succeed under maxConcurrentSessions = 1.
    const sch1WithS1 = { ...sch1Base, assignedStaffId: s1._id };
    const { service: assignSecond } = buildFixture({
      activeStaff: [s1, s2],
      providerSettings: { maxConcurrentSessions: 1 },
      singleBooking: {
        _id: booking2Id,
        bookingCode: 'BK802',
        customerId: new Types.ObjectId(),
        status: BookingStatus.Confirmed,
      },
      singleSchedule: sch2Base,
      v2Schedules: [sch1WithS1, sch2Base],
    });
    const secondAssigned = await assignSecond.assignStaffToSchedule(
      booking2Id.toString(),
      sch2Id.toString(),
      s2._id.toString(),
      ownerUserId.toString(),
      ['PROVIDER'],
    );
    expect(secondAssigned.assignedStaffId?.toString()).toBe(s2._id.toString());

    // Assigning busy s1 to sch2 must STILL be rejected with ConflictException.
    await expect(
      assignSecond.assignStaffToSchedule(
        booking2Id.toString(),
        sch2Id.toString(),
        s1._id.toString(),
        ownerUserId.toString(),
        ['PROVIDER'],
      ),
    ).rejects.toThrow(ConflictException);

    // A NEW 3rd booking at 11:00-12:00 must STILL be blocked by maxConcurrentSessions = 1.
    const newBookingEval = await assignSecond.evaluateSessions(
      providerId,
      [{ clientId: 'new3', dateKey: '2026-11-27', startMin: 660, endMin: 720 }],
      { deferStaffAssignment: true },
    );
    expect(newBookingEval.valid).toBe(false);
    expect(newBookingEval.errors[0]?.code).toBe('SLOT_UNAVAILABLE');
  });

  it('allows reassigning free active staff on an existing booking even when maxDailySessions is lower than current bookings', async () => {
    const booking1Id = new Types.ObjectId();
    const sch1Id = new Types.ObjectId();
    const s1 = { _id: new Types.ObjectId(), name: 'Tuấn', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = { _id: new Types.ObjectId(), name: 'Nam', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };
    const s3 = { _id: new Types.ObjectId(), name: 'Lan', phone: '0903', status: ProviderStaffStatus.Active, sortOrder: 2, blockedSlots: [] };

    const sch1 = {
      _id: sch1Id,
      bookingId: booking1Id,
      bookingItemId: new Types.ObjectId(),
      providerId,
      scheduleType: BookingScheduleType.Photoshoot,
      providerLocalDate: '2026-11-27',
      startsAt: new Date('2026-11-27T08:00:00+07:00'),
      endsAt: new Date('2026-11-27T09:00:00+07:00'),
      assignedStaffId: s1._id,
      status: BookingScheduleStatus.Confirmed,
    };

    const { service } = buildFixture({
      activeStaff: [s1, s2, s3],
      providerSettings: { maxConcurrentSessions: null, maxDailySessions: 2 },
      singleBooking: {
        _id: booking1Id,
        bookingCode: 'BK901',
        customerId: new Types.ObjectId(),
        status: BookingStatus.Confirmed,
      },
      singleSchedule: sch1,
      v2Schedules: [
        sch1,
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T11:00:00+07:00'),
          endsAt: new Date('2026-11-27T12:00:00+07:00'),
          assignedStaffId: s2._id,
        },
        {
          _id: new Types.ObjectId(),
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T14:00:00+07:00'),
          endsAt: new Date('2026-11-27T15:00:00+07:00'),
          assignedStaffId: s1._id,
        },
      ],
    });

    const reassigned = await service.assignStaffToSchedule(
      booking1Id.toString(),
      sch1Id.toString(),
      s3._id.toString(),
      ownerUserId.toString(),
      ['PROVIDER'],
    );
    expect(reassigned.assignedStaffId?.toString()).toBe(s3._id.toString());

    const newEval = await service.evaluateSessions(
      providerId,
      [{ clientId: 'new4', dateKey: '2026-11-27', startMin: 960, endMin: 1020 }],
      { deferStaffAssignment: true },
    );
    expect(newEval.valid).toBe(false);
    expect(newEval.errors[0]?.message).toMatch(/đã nhận đủ giới hạn 2 ca chụp/i);
  });

  it('counts multi-session bookings accurately by total sessions on day against maxDailySessions', async () => {
    const multiBookingId = new Types.ObjectId();
    const s1 = { _id: new Types.ObjectId(), name: 'Tuấn', phone: '0901', status: ProviderStaffStatus.Active, sortOrder: 0, blockedSlots: [] };
    const s2 = { _id: new Types.ObjectId(), name: 'Nam', phone: '0902', status: ProviderStaffStatus.Active, sortOrder: 1, blockedSlots: [] };

    // 1 MULTI booking already occupies 2 distinct sessions on 2026-11-27 (08:00-09:00 and 15:00-16:00).
    // With maxDailySessions = 3, remaining quota is strictly 1 session (not 2).
    const { service } = buildFixture({
      activeStaff: [s1, s2],
      providerSettings: { maxConcurrentSessions: null, maxDailySessions: 3 },
      v2Schedules: [
        {
          _id: new Types.ObjectId(),
          bookingId: multiBookingId,
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T08:00:00+07:00'),
          endsAt: new Date('2026-11-27T09:00:00+07:00'),
          assignedStaffId: s1._id,
        },
        {
          _id: new Types.ObjectId(),
          bookingId: multiBookingId,
          bookingItemId: new Types.ObjectId(),
          providerLocalDate: '2026-11-27',
          startsAt: new Date('2026-11-27T15:00:00+07:00'),
          endsAt: new Date('2026-11-27T16:00:00+07:00'),
          assignedStaffId: s1._id,
        },
      ],
    });

    const summary = await service.computeBusyScheduleSummary(providerId);
    expect(summary.dailyAvailability).toEqual([
      { date: '2026-11-27', used: 2, limit: 3, remaining: 1 },
    ]);
    expect(summary.bookedSlots).toHaveLength(0);

    // Requesting 2 new sessions on the same day (2 + 2 = 4 > 3) must fail cleanly.
    const twoMore = await service.evaluateSessions(
      providerId,
      [
        { clientId: 'm1', dateKey: '2026-11-27', startMin: 600, endMin: 660 },
        { clientId: 'm2', dateKey: '2026-11-27', startMin: 780, endMin: 840 },
      ],
      { deferStaffAssignment: true },
    );
    expect(twoMore.valid).toBe(false);
    expect(twoMore.errors[0]?.message).toMatch(/chỉ còn nhận được thêm tối đa 1 ca chụp/i);

    // Requesting 1 new session on the same day (2 + 1 = 3 <= 3) must succeed.
    const oneMore = await service.evaluateSessions(
      providerId,
      [{ clientId: 's1', dateKey: '2026-11-27', startMin: 600, endMin: 660 }],
      { deferStaffAssignment: true },
    );
    expect(oneMore.valid).toBe(true);
  });
});
