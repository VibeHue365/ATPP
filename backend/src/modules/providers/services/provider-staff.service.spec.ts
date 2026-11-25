import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { ProviderCapability } from '../schemas/provider.schema';
import { ProviderStaffStatus } from '../schemas/provider-staff.schema';
import { BookingStatus } from '../../bookings/schemas/booking.schema';
import { UserStatus } from '../../users/schemas/user.schema';
import { ProviderStaffService } from './provider-staff.service';

function makeChain<T>(value: T) {
  return {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('ProviderStaffService (Phase 1 Core)', () => {
  const userId = new Types.ObjectId();
  const providerId = new Types.ObjectId();

  function buildFixture(opts: {
    activeCount?: number;
    staffDoc?: any;
    futureSchedules?: Array<any>;
    activeBookings?: Array<any>;
    maxConcurrentSessions?: number | null;
    existingEmailUser?: any;
    existingPhoneUser?: any;
    activeTokens?: Array<{ _id: Types.ObjectId }>;
    withRedis?: boolean;
  }) {
    const providerDoc = {
      _id: providerId,
      userId,
      capabilities: [ProviderCapability.AoDaiRental, ProviderCapability.Photography],
      photographySettings: {
        serviceRadiusKm: 15,
        maxConcurrentSessions: opts.maxConcurrentSessions ?? null,
      },
    };

    const providerModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(providerDoc),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const staffDoc = opts.staffDoc
      ? {
          ...opts.staffDoc,
          save: jest.fn().mockResolvedValue(opts.staffDoc),
        }
      : null;

    const staffModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(staffDoc),
      }),
      countDocuments: jest.fn().mockResolvedValue(opts.activeCount ?? 2),
      create: jest.fn().mockImplementation(async (doc) => ({
        _id: new Types.ObjectId(),
        ...doc,
        save: jest.fn().mockResolvedValue(undefined),
        toObject() {
          return { ...this };
        },
      })),
    };

    const bookingScheduleModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.futureSchedules ?? [])),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const bookingModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.activeBookings ?? [])),
    };

    const userModel = {
      findOne: jest.fn().mockImplementation((query: Record<string, any>) => {
        if ('auth.emailNormalized' in query) {
          return makeChain(opts.existingEmailUser ?? null);
        }
        if ('auth.phoneNormalized' in query) {
          return makeChain(opts.existingPhoneUser ?? null);
        }
        return makeChain(null);
      }),
      create: jest.fn().mockImplementation(async (doc) => ({
        _id: new Types.ObjectId(),
        ...doc,
      })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const refreshTokenModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.activeTokens ?? [])),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const redisService = opts.withRedis
      ? { del: jest.fn().mockResolvedValue(undefined) }
      : undefined;

    const service = new ProviderStaffService(
      providerModel as any,
      staffModel as any,
      bookingScheduleModel as any,
      bookingModel as any,
      { find: jest.fn().mockReturnValue(makeChain([])) } as any,
      userModel as any,
      refreshTokenModel as any,
      redisService as any,
    );

    return {
      service,
      providerModel,
      staffModel,
      bookingScheduleModel,
      userModel,
      refreshTokenModel,
      redisService,
      staffDoc,
    };
  }

  it('rejects maxConcurrentSessions exceeding active staff count and accepts valid bounds', async () => {
    const { service, providerModel } = buildFixture({ activeCount: 2 });

    await expect(
      service.updateCapacity(userId.toString(), { maxConcurrentSessions: 3 }),
    ).rejects.toThrow(BadRequestException);

    const res = await service.updateCapacity(userId.toString(), {
      maxConcurrentSessions: 2,
      maxDailySessions: 6,
    });

    expect(res).toEqual({
      activeStaffCount: 2,
      maxConcurrentSessions: 2,
      maxDailySessions: 6,
      effectiveCapacity: 2,
    });
    expect(providerModel.updateOne).toHaveBeenCalledWith(
      { _id: providerId },
      {
        $set: {
          photographySettings: {
            serviceRadiusKm: 15,
            maxConcurrentSessions: 2,
            maxDailySessions: 6,
          },
        },
      },
    );
  });

  it('blocks setting staff INACTIVE when they still have upcoming bookings, and revokes tokens when deactivated cleanly', async () => {
    const staffId = new Types.ObjectId();
    const linkedUserId = new Types.ObjectId();
    const bId = new Types.ObjectId();

    const blockedFixture = buildFixture({
      activeCount: 2,
      staffDoc: {
        _id: staffId,
        providerId,
        name: 'Minh Khoa',
        status: ProviderStaffStatus.Active,
        linkedUserId,
      },
      futureSchedules: [{ bookingId: bId, providerLocalDate: '2026-12-10' }],
      activeBookings: [
        { _id: bId, bookingCode: 'BK100', status: BookingStatus.Confirmed },
      ],
    });

    await expect(
      blockedFixture.service.updateStatus(
        userId.toString(),
        staffId.toString(),
        ProviderStaffStatus.Inactive,
      ),
    ).rejects.toThrow(BadRequestException);

    const clearFixture = buildFixture({
      activeCount: 1,
      maxConcurrentSessions: 2,
      staffDoc: {
        _id: staffId,
        providerId,
        name: 'Minh Khoa',
        status: ProviderStaffStatus.Active,
        linkedUserId,
      },
      futureSchedules: [],
      activeBookings: [],
    });

    await clearFixture.service.updateStatus(
      userId.toString(),
      staffId.toString(),
      ProviderStaffStatus.Inactive,
    );

    expect(clearFixture.staffDoc?.status).toBe(ProviderStaffStatus.Inactive);
    expect(clearFixture.refreshTokenModel.updateMany).toHaveBeenCalledWith(
      { userId: linkedUserId, revokedAt: null },
      expect.objectContaining({ $set: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
    expect(clearFixture.providerModel.updateOne).toHaveBeenCalledWith(
      { _id: providerId },
      { $set: { 'photographySettings.maxConcurrentSessions': 1 } },
    );
  });

  it('rejects adding an off-day block that overlaps an assigned confirmed shoot', async () => {
    const staffId = new Types.ObjectId();
    const bId = new Types.ObjectId();

    const { service } = buildFixture({
      staffDoc: {
        _id: staffId,
        providerId,
        name: 'Minh Khoa',
        status: ProviderStaffStatus.Active,
        blockedSlots: [],
      },
      futureSchedules: [
        {
          bookingId: bId,
          startsAt: new Date('2026-12-10T08:00:00+07:00'),
          endsAt: new Date('2026-12-10T10:00:00+07:00'),
        },
      ],
      activeBookings: [{ _id: bId, bookingCode: 'BK205' }],
    });

    await expect(
      service.addBlockedSlot(userId.toString(), staffId.toString(), {
        date: '2026-12-10',
        startTime: '09:00',
        endTime: '12:00',
        reason: 'Nghỉ đột xuất',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates an off-day block when staff schedule is clear in that time window', async () => {
    const staffId = new Types.ObjectId();
    const { service, staffDoc } = buildFixture({
      staffDoc: {
        _id: staffId,
        providerId,
        name: 'Minh Khoa',
        status: ProviderStaffStatus.Active,
        blockedSlots: [],
      },
      futureSchedules: [],
    });

    const created = await service.addBlockedSlot(
      userId.toString(),
      staffId.toString(),
      {
        date: '2026-12-11',
        startTime: '13:00',
        endTime: '17:00',
        reason: 'Lịch cá nhân',
      },
    );

    expect(created.date).toBe('2026-12-11');
    expect(created.startTime).toBe('13:00');
    expect(staffDoc?.blockedSlots).toHaveLength(1);
    expect(staffDoc?.save).toHaveBeenCalled();
  });

  it('provisions isolated STAFF user, handles phone collision safely, and rejects duplicate email', async () => {
    const staffId = new Types.ObjectId();
    const { service, userModel, bookingScheduleModel, staffDoc } = buildFixture({
      staffDoc: {
        _id: staffId,
        providerId,
        name: 'Quốc Bảo',
        phone: '+84 912 345 678',
        avatarUrl: 'https://cdn.test/bao.jpg',
        status: ProviderStaffStatus.Active,
        linkedUserId: null,
      },
      existingPhoneUser: { _id: new Types.ObjectId() },
    });

    const res = await service.provisionAccount(
      userId.toString(),
      staffId.toString(),
      { email: '  QuocBao.Staff@studio.vn ' },
    );

    expect(res.email).toBe('QuocBao.Staff@studio.vn');
    expect(res.temporaryPassword).toBeTruthy();
    expect(res.temporaryPassword!.length).toBe(12);
    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ['STAFF'],
        defaultRole: 'STAFF',
        accountStatus: UserStatus.Active,
        auth: expect.objectContaining({
          emailNormalized: 'quocbao.staff@studio.vn',
          phone: '+84 912 345 678',
          phoneNormalized: null,
          emailVerified: true,
        }),
      }),
    );
    expect(staffDoc?.linkedUserId).toBeDefined();
    expect(bookingScheduleModel.updateMany).toHaveBeenCalled();

    const dupEmailFixture = buildFixture({
      staffDoc: {
        _id: staffId,
        providerId,
        name: 'Quốc Bảo',
        phone: '0912345678',
        status: ProviderStaffStatus.Active,
        linkedUserId: null,
      },
      existingEmailUser: { _id: new Types.ObjectId() },
    });

    await expect(
      dupEmailFixture.service.provisionAccount(
        userId.toString(),
        staffId.toString(),
        { email: 'dup@studio.vn' },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('resets STAFF password, revokes refresh tokens, and evicts Redis session cache', async () => {
    const staffId = new Types.ObjectId();
    const linkedUserId = new Types.ObjectId();
    const sessionId1 = new Types.ObjectId();
    const sessionId2 = new Types.ObjectId();

    const { service, userModel, refreshTokenModel, redisService } =
      buildFixture({
        staffDoc: {
          _id: staffId,
          providerId,
          name: 'Minh Khoa',
          status: ProviderStaffStatus.Active,
          linkedUserId,
        },
        activeTokens: [{ _id: sessionId1 }, { _id: sessionId2 }],
        withRedis: true,
      });

    const res = await service.resetStaffPassword(
      userId.toString(),
      staffId.toString(),
      { newPassword: 'NewStaffPassword99' },
    );

    expect(res.passwordReset).toBe(true);
    expect(res.temporaryPassword).toBeNull();
    const updatePayload = userModel.updateOne.mock.calls[0][1].$set;
    expect(
      await bcrypt.compare('NewStaffPassword99', updatePayload['auth.passwordHash']),
    ).toBe(true);
    expect(refreshTokenModel.updateMany).toHaveBeenCalledWith(
      { userId: linkedUserId, revokedAt: null },
      expect.any(Object),
    );
    expect(redisService?.del).toHaveBeenCalledWith(
      `auth:session:${sessionId1.toString()}`,
    );
    expect(redisService?.del).toHaveBeenCalledWith(
      `auth:session:${sessionId2.toString()}`,
    );
  });

  it('locks and unlocks STAFF account cleanly and prevents unlocking INACTIVE roster member', async () => {
    const staffId = new Types.ObjectId();
    const linkedUserId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();

    const lockFixture = buildFixture({
      staffDoc: {
        _id: staffId,
        providerId,
        name: 'Minh Khoa',
        status: ProviderStaffStatus.Active,
        linkedUserId,
      },
      activeTokens: [{ _id: sessionId }],
      withRedis: true,
    });

    const lockRes = await lockFixture.service.setStaffAccountLocked(
      userId.toString(),
      staffId.toString(),
      { locked: true, reason: 'Nghỉ dài hạn' },
    );
    expect(lockRes.accountStatus).toBe(UserStatus.Suspended);
    expect(lockFixture.redisService?.del).toHaveBeenCalledWith(
      `auth:session:${sessionId.toString()}`,
    );

    const inactiveUnlockFixture = buildFixture({
      staffDoc: {
        _id: staffId,
        providerId,
        name: 'Minh Khoa',
        status: ProviderStaffStatus.Inactive,
        linkedUserId,
      },
    });
    await expect(
      inactiveUnlockFixture.service.setStaffAccountLocked(
        userId.toString(),
        staffId.toString(),
        { locked: false },
      ),
    ).rejects.toThrow(BadRequestException);

    const missingFixture = buildFixture({ staffDoc: null });
    await expect(
      missingFixture.service.setStaffAccountLocked(
        userId.toString(),
        staffId.toString(),
        { locked: true },
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
