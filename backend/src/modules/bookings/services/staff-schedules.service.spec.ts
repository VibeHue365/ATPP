import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ProviderStaffStatus } from '../../providers/schemas/provider-staff.schema';
import { ProvidersController } from '../../providers/controllers/providers.controller';
import { ProviderStaffController } from '../../providers/controllers/provider-staff.controller';
import { PhotographersController } from '../../photographers/controllers/photographers.controller';
import { ChatController } from '../../chat/chat.controller';
import { BookingsController } from '../controllers/bookings.controller';
import { StaffSchedulesController } from '../controllers/staff-schedules.controller';
import { BookingStatus } from '../schemas/booking.schema';
import { BookingScheduleStatus } from '../schemas/booking-schedule.schema';
import { StaffSchedulesService } from './staff-schedules.service';

function makeChain<T>(value: T) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
  return chain;
}

describe('StaffSchedulesService & STAFF Role Isolation (Phase 2)', () => {
  const staffUserId = new Types.ObjectId();
  const otherStaffUserId = new Types.ObjectId();
  const ownerUserId = new Types.ObjectId();
  const customerUserId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const staffId = new Types.ObjectId();
  const otherStaffId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();
  const bookingItemId = new Types.ObjectId();
  const scheduleId = new Types.ObjectId();

  function buildFixture(opts: {
    staffStatus?: ProviderStaffStatus;
    blockedSlots?: any[];
    schedulesList?: any[];
    scheduleDoc?: any;
    bookingDoc?: any;
    bookingsList?: any[];
    bookingItemsList?: any[];
  } = {}) {
    const staffDoc: any = {
      _id: staffId,
      providerId,
      name: 'Minh Khoa',
      phone: '0901234567',
      avatarUrl: null,
      specialty: 'Áo dài Đại Nội',
      bio: null,
      experienceYears: 4,
      status: opts.staffStatus ?? ProviderStaffStatus.Active,
      linkedUserId: staffUserId,
      blockedSlots: opts.blockedSlots ?? [],
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    const staffModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(staffDoc),
      }),
    };

    const studioDoc = {
      _id: providerId,
      userId: ownerUserId,
      businessName: 'Hue Heritage Studio',
      contact: { phone: '0234888999' },
      address: { addressLine: '12 Lê Lợi' },
      media: { logoUrl: 'https://cdn.test/logo.jpg' },
    };

    const providerModel = {
      findById: jest.fn().mockReturnValue(makeChain(studioDoc)),
    };

    const bookingScheduleModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.schedulesList ?? [])),
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(opts.scheduleDoc ?? null),
      }),
    };

    const bookingModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.bookingsList ?? [])),
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(opts.bookingDoc ?? null),
      }),
    };

    const bookingItemModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.bookingItemsList ?? [])),
    };

    const notificationsService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    const service = new StaffSchedulesService(
      staffModel as any,
      providerModel as any,
      bookingScheduleModel as any,
      bookingModel as any,
      bookingItemModel as any,
      notificationsService as any,
    );

    return {
      service,
      staffModel,
      bookingScheduleModel,
      bookingModel,
      notificationsService,
    };
  }

  it('lists only own assigned schedules and omits all financial/price fields', async () => {
    const { service, bookingScheduleModel } = buildFixture({
      schedulesList: [
        {
          _id: scheduleId,
          bookingId,
          bookingItemId,
          providerId,
          assignedStaffId: staffId,
          providerLocalDate: '2026-12-20',
          startsAt: new Date('2026-12-20T08:00:00+07:00'),
          endsAt: new Date('2026-12-20T10:00:00+07:00'),
          status: BookingScheduleStatus.Confirmed,
          locationAddress: 'Ngọ Môn, Huế',
          locationSnapshot: { address: 'Ngọ Môn, Huế', geo: null },
          checkedInAt: null,
          shootFinishedAt: null,
          staffFieldNote: null,
        },
      ],
      bookingsList: [
        {
          _id: bookingId,
          bookingCode: 'TG-2026-888',
          status: BookingStatus.Confirmed,
          customerId: {
            _id: customerUserId,
            profile: { fullName: 'Nguyễn An', avatarUrl: null },
            auth: { phone: '0911222333' },
          },
          customerNote: 'Thích góc hoàng cung',
          pricingSummary: { grandTotal: 2500000, depositTotal: 500000 },
        },
      ],
      bookingItemsList: [
        {
          _id: bookingItemId,
          photographyPackageId: { name: 'Gói Đại Nội Classic' },
          unitPrice: 2500000,
        },
      ],
    });

    const res = await service.getMySchedules(staffUserId.toString(), {
      scope: 'all',
    });

    expect(bookingScheduleModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedStaffId: staffId,
        providerId,
      }),
    );
    expect(res.items).toHaveLength(1);
    const item = res.items[0] as Record<string, unknown>;
    expect(item).toMatchObject({
      bookingCode: 'TG-2026-888',
      packageName: 'Gói Đại Nội Classic',
      canCheckIn: true,
      canFinishShoot: false,
    });
    expect(item.pricingSummary).toBeUndefined();
    expect(item.grandTotal).toBeUndefined();
    expect(item.subTotal).toBeUndefined();
    expect(item.depositTotal).toBeUndefined();
    expect(item.depositAmount).toBeUndefined();
    expect(item.commission).toBeUndefined();
    expect(item.platformFee).toBeUndefined();
    expect(item.unitPrice).toBeUndefined();
  });

  it('rejects INACTIVE staff from reading schedules or profile', async () => {
    const { service } = buildFixture({
      staffStatus: ProviderStaffStatus.Inactive,
    });

    await expect(
      service.getMySchedules(staffUserId.toString()),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.getProfile(staffUserId.toString())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('prevents STAFF A from checking in or finishing STAFF B schedule', async () => {
    const foreignSchedule = {
      _id: scheduleId,
      bookingId,
      providerId,
      assignedStaffId: otherStaffId,
      status: BookingScheduleStatus.Confirmed,
      save: jest.fn(),
    };
    const { service } = buildFixture({ scheduleDoc: foreignSchedule });

    await expect(
      service.checkIn(staffUserId.toString(), scheduleId.toString(), {
        note: 'Đến nơi',
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.finishShoot(staffUserId.toString(), scheduleId.toString(), {
        note: 'Chụp xong',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(foreignSchedule.save).not.toHaveBeenCalled();
  });

  it('transitions booking to IN_PROGRESS on check-in and preserves status on finish-shoot', async () => {
    const scheduleDoc: any = {
      _id: scheduleId,
      bookingId,
      providerId,
      assignedStaffId: staffId,
      status: BookingScheduleStatus.Confirmed,
      checkedInAt: null,
      shootFinishedAt: null,
      staffFieldNote: null,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    const bookingDoc: any = {
      _id: bookingId,
      bookingCode: 'TG-2026-999',
      customerId: customerUserId,
      status: BookingStatus.Confirmed,
      statusTimeline: [],
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    const { service, notificationsService } = buildFixture({
      scheduleDoc,
      bookingDoc,
    });

    // Cannot finish before check-in
    await expect(
      service.finishShoot(staffUserId.toString(), scheduleId.toString(), {}),
    ).rejects.toThrow(BadRequestException);

    // Check-in transitions to IN_PROGRESS
    const checkInRes = await service.checkIn(
      staffUserId.toString(),
      scheduleId.toString(),
      { note: 'Đã gặp khách tại cổng Ngọ Môn' },
    );
    expect(checkInRes.bookingStatus).toBe(BookingStatus.InProgress);
    expect(scheduleDoc.checkedInAt).toBeInstanceOf(Date);
    expect(bookingDoc.status).toBe(BookingStatus.InProgress);
    expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);

    // Reject duplicate check-in
    await expect(
      service.checkIn(staffUserId.toString(), scheduleId.toString(), {}),
    ).rejects.toThrow(BadRequestException);

    // Finish shoot preserves IN_PROGRESS (owner handles photo delivery -> AWAITING_REVIEW)
    const finishRes = await service.finishShoot(
      staffUserId.toString(),
      scheduleId.toString(),
      { note: 'Đã chụp đủ 180 ảnh gốc' },
    );
    expect(finishRes.bookingStatus).toBe(BookingStatus.InProgress);
    expect(bookingDoc.status).toBe(BookingStatus.InProgress);
    expect(scheduleDoc.shootFinishedAt).toBeInstanceOf(Date);
    expect(scheduleDoc.staffFieldNote).toContain('Đã chụp đủ 180 ảnh gốc');
  });

  it('enforces hard RolesGuard isolation between STAFF and PROVIDER routes', () => {
    const guard = new RolesGuard(new Reflector());
    const check = (ctrl: any, method: string, roles: string[]) => {
      const ctx = {
        getClass: () => ctrl,
        getHandler: () => ctrl.prototype[method],
        switchToHttp: () => ({
          getRequest: () => ({ user: { sub: otherStaffUserId.toString(), roles } }),
        }),
      } as unknown as ExecutionContext;
      return guard.canActivate(ctx);
    };

    // STAFF blocked (403 Forbidden) from all owner/provider routes
    expect(() => check(ProvidersController, 'getWallet', ['STAFF'])).toThrow(
      ForbiddenException,
    );
    expect(() =>
      check(ProviderStaffController, 'listMine', ['STAFF']),
    ).toThrow(ForbiddenException);
    expect(() =>
      check(PhotographersController, 'getEarnings', ['STAFF']),
    ).toThrow(ForbiddenException);
    expect(() =>
      check(PhotographersController, 'getCalendar', ['STAFF']),
    ).toThrow(ForbiddenException);
    expect(() =>
      check(BookingsController, 'getProvider', ['STAFF']),
    ).toThrow(ForbiddenException);
    expect(() =>
      check(ChatController, 'getStaffChatForBookingSupervision', ['STAFF']),
    ).toThrow(ForbiddenException);

    // STAFF allowed on StaffSchedulesController
    expect(
      check(StaffSchedulesController, 'getMySchedules', ['STAFF']),
    ).toBe(true);
    expect(
      check(StaffSchedulesController, 'addMyBlockedSlot', ['STAFF']),
    ).toBe(true);
    expect(
      check(StaffSchedulesController, 'removeMyBlockedSlot', ['STAFF']),
    ).toBe(true);

    // PROVIDER blocked from StaffSchedulesController
    expect(() =>
      check(StaffSchedulesController, 'getMySchedules', ['PROVIDER']),
    ).toThrow(ForbiddenException);
    expect(() =>
      check(StaffSchedulesController, 'addMyBlockedSlot', ['PROVIDER']),
    ).toThrow(ForbiddenException);
    expect(() =>
      check(StaffSchedulesController, 'removeMyBlockedSlot', ['PROVIDER']),
    ).toThrow(ForbiddenException);
  });

  it('lets STAFF self-register and remove blocked slots with past-date, overlap, and assigned-shoot guards + owner notifications', async () => {
    const existingBlockId = new Types.ObjectId();
    const { service, notificationsService } = buildFixture({
      blockedSlots: [
        {
          _id: existingBlockId,
          date: '2026-12-15',
          startTime: '08:00',
          endTime: '11:00',
          reason: 'Khám răng',
          createdAt: new Date(),
        },
      ],
    });

    // 1. Reject past date
    await expect(
      service.addMyBlockedSlot(staffUserId.toString(), {
        date: '2020-01-01',
      }),
    ).rejects.toThrow(BadRequestException);

    // 2. Reject invalid time range / mismatched pair
    await expect(
      service.addMyBlockedSlot(staffUserId.toString(), {
        date: '2026-12-16',
        startTime: '09:00',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.addMyBlockedSlot(staffUserId.toString(), {
        date: '2026-12-16',
        startTime: '14:00',
        endTime: '12:00',
      }),
    ).rejects.toThrow(BadRequestException);

    // 3. Reject overlapping existing blocked slot on same date
    await expect(
      service.addMyBlockedSlot(staffUserId.toString(), {
        date: '2026-12-15',
        startTime: '10:00',
        endTime: '12:00',
      }),
    ).rejects.toThrow(ConflictException);

    // 4. Reject conflicting active assigned shoot and include booking code
    const conflictFixture = buildFixture({
      schedulesList: [
        {
          bookingId,
          startsAt: new Date('2026-12-18T09:00:00+07:00'),
          endsAt: new Date('2026-12-18T11:00:00+07:00'),
        },
      ],
      bookingsList: [{ _id: bookingId, bookingCode: 'BK-CONFLICT-01' }],
    });
    await expect(
      conflictFixture.service.addMyBlockedSlot(staffUserId.toString(), {
        date: '2026-12-18',
        startTime: '10:00',
        endTime: '13:00',
      }),
    ).rejects.toThrow(/BK-CONFLICT-01/);

    // 5. Succeed on free afternoon window and notify Studio Owner
    const created = await service.addMyBlockedSlot(staffUserId.toString(), {
      date: '2026-12-15',
      startTime: '14:00',
      endTime: '17:00',
      reason: 'Bận việc gia đình',
    });
    expect(created).toMatchObject({
      date: '2026-12-15',
      startTime: '14:00',
      endTime: '17:00',
      reason: 'Bận việc gia đình',
    });
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      ownerUserId.toString(),
      expect.stringContaining('lịch bận'),
      expect.stringContaining('Minh Khoa'),
      expect.anything(),
      expect.objectContaining({ date: '2026-12-15' }),
    );

    // 6. Reject removing unknown blockId
    await expect(
      service.removeMyBlockedSlot(
        staffUserId.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(NotFoundException);

    // 7. Remove existing blockId and notify Studio Owner
    const removed = await service.removeMyBlockedSlot(
      staffUserId.toString(),
      existingBlockId.toString(),
    );
    expect(removed).toEqual({
      removed: true,
      blockId: existingBlockId.toString(),
    });
    expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
  });

  it('locks check-in on DEPOSIT_PAID until Studio Owner confirms, and allows check-in on CONFIRMED and Combo PICKED_UP', async () => {
    const depositBookingId = new Types.ObjectId();
    const comboBookingId = new Types.ObjectId();
    const depositSchedId = new Types.ObjectId();
    const comboSchedId = new Types.ObjectId();

    const listFixture = buildFixture({
      schedulesList: [
        {
          _id: depositSchedId,
          bookingId: depositBookingId,
          bookingItemId,
          providerId,
          assignedStaffId: staffId,
          providerLocalDate: '2026-12-20',
          startsAt: new Date('2026-12-20T09:00:00+07:00'),
          endsAt: new Date('2026-12-20T10:00:00+07:00'),
          status: BookingScheduleStatus.Confirmed,
          checkedInAt: null,
          shootFinishedAt: null,
        },
        {
          _id: comboSchedId,
          bookingId: comboBookingId,
          bookingItemId,
          providerId,
          assignedStaffId: staffId,
          providerLocalDate: '2026-12-20',
          startsAt: new Date('2026-12-20T14:00:00+07:00'),
          endsAt: new Date('2026-12-20T16:00:00+07:00'),
          status: BookingScheduleStatus.Confirmed,
          checkedInAt: null,
          shootFinishedAt: null,
        },
      ],
      bookingsList: [
        {
          _id: depositBookingId,
          bookingCode: 'BK-WAIT-01',
          status: BookingStatus.DepositPaid,
          customerId: { _id: customerUserId, profile: { fullName: 'Ding Le' } },
        },
        {
          _id: comboBookingId,
          bookingCode: 'BK-COMBO-02',
          status: BookingStatus.PickedUp,
          customerId: { _id: customerUserId, profile: { fullName: 'Lan Anh' } },
        },
      ],
    });

    const listed = await listFixture.service.getMySchedules(
      staffUserId.toString(),
      { scope: 'all' },
    );
    const depositItem = listed.items.find((i) => i.bookingCode === 'BK-WAIT-01');
    const comboItem = listed.items.find((i) => i.bookingCode === 'BK-COMBO-02');

    expect(depositItem?.canCheckIn).toBe(false);
    expect(depositItem?.checkInBlockedReason).toContain('Chờ Chủ Studio duyệt');
    expect(comboItem?.canCheckIn).toBe(true);
    expect(comboItem?.checkInBlockedReason).toBeNull();

    // Direct check-in attempt on DEPOSIT_PAID must fail
    const depositCheckInFixture = buildFixture({
      scheduleDoc: {
        _id: depositSchedId,
        bookingId: depositBookingId,
        providerId,
        assignedStaffId: staffId,
        status: BookingScheduleStatus.Confirmed,
        checkedInAt: null,
        shootFinishedAt: null,
        save: jest.fn(),
      },
      bookingDoc: {
        _id: depositBookingId,
        bookingCode: 'BK-WAIT-01',
        status: BookingStatus.DepositPaid,
        statusTimeline: [],
        save: jest.fn(),
      },
    });

    await expect(
      depositCheckInFixture.service.checkIn(
        staffUserId.toString(),
        depositSchedId.toString(),
        {},
      ),
    ).rejects.toThrow(/chờ Chủ Studio duyệt/i);

    // Direct check-in attempt on Combo PICKED_UP succeeds -> IN_PROGRESS
    const comboBookingDoc: any = {
      _id: comboBookingId,
      bookingCode: 'BK-COMBO-02',
      customerId: customerUserId,
      status: BookingStatus.PickedUp,
      statusTimeline: [],
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    const comboScheduleDoc: any = {
      _id: comboSchedId,
      bookingId: comboBookingId,
      providerId,
      assignedStaffId: staffId,
      status: BookingScheduleStatus.Confirmed,
      checkedInAt: null,
      shootFinishedAt: null,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    const comboCheckInFixture = buildFixture({
      scheduleDoc: comboScheduleDoc,
      bookingDoc: comboBookingDoc,
    });

    const comboRes = await comboCheckInFixture.service.checkIn(
      staffUserId.toString(),
      comboSchedId.toString(),
      { note: 'Khách đã mặc áo dài, bắt đầu chụp' },
    );
    expect(comboRes.bookingStatus).toBe(BookingStatus.InProgress);
    expect(comboBookingDoc.status).toBe(BookingStatus.InProgress);
  });
});
