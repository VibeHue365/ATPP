import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus } from '../bookings/schemas/booking.schema';
import {
  BookingScheduleStatus,
  BookingScheduleType,
} from '../bookings/schemas/booking-schedule.schema';
import { ChatService } from './chat.service';

function makeChain<T>(result: T) {
  const q: any = {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  };
  return q;
}

describe('ChatService Staff Rooms & Owner Read-Only Supervision (Phase 2)', () => {
  const ownerUserId = new Types.ObjectId();
  const foreignOwnerUserId = new Types.ObjectId();
  const customerUserId = new Types.ObjectId();
  const unassignedCustomerId = new Types.ObjectId();
  const staffUserId = new Types.ObjectId();
  const staffId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();
  const roomId = new Types.ObjectId();

  function createFixture(opts: {
    ownedProviderIds?: Types.ObjectId[];
    schedules?: any[];
    room?: any;
    messages?: any[];
    staffDoc?: any;
    bookingStaffMatch?: any;
  } = {}) {
    const roomModel = {
      findOne: jest.fn().mockReturnValue(makeChain(opts.room ?? null)),
      findById: jest.fn().mockReturnValue(makeChain(opts.room ?? null)),
      find: jest.fn(),
      create: jest.fn().mockImplementation(async (doc) => ({
        _id: roomId,
        ...doc,
        populate: jest.fn().mockResolvedValue({
          _id: roomId,
          participants: [
            { _id: customerUserId, profile: { fullName: 'Khách A' } },
            { _id: staffUserId, profile: { fullName: 'Minh Khoa' }, roles: ['STAFF'] },
          ],
          lastMessageAt: new Date(),
        }),
      })),
      updateOne: jest.fn(),
    };

    const messageModel = {
      find: jest.fn().mockReturnValue(makeChain(opts.messages ?? [])),
      create: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn().mockResolvedValue([]),
    };

    const userModel = {
      findById: jest.fn().mockImplementation((id: Types.ObjectId | string) => {
        const idStr = id.toString();
        if (
          [
            staffUserId.toString(),
            customerUserId.toString(),
            ownerUserId.toString(),
            unassignedCustomerId.toString(),
          ].includes(idStr)
        ) {
          return makeChain({ _id: new Types.ObjectId(idStr) });
        }
        return makeChain(null);
      }),
    };

    const providerModel = {
      findById: jest.fn().mockImplementation((id: Types.ObjectId | string) => {
        if (id.toString() === providerId.toString()) {
          return makeChain({ _id: providerId, userId: ownerUserId });
        }
        return makeChain(null);
      }),
      find: jest.fn().mockReturnValue(
        makeChain(
          (opts.ownedProviderIds ?? [providerId]).map((_id) => ({ _id })),
        ),
      ),
    };

    const providerStaffModel = {
      findById: jest.fn().mockReturnValue(
        makeChain(
          opts.staffDoc !== undefined
            ? opts.staffDoc
            : {
                _id: staffId,
                providerId,
                name: 'Minh Khoa',
                phone: '0901112222',
                avatarUrl: null,
                linkedUserId: staffUserId,
              },
        ),
      ),
      findOne: jest.fn().mockReturnValue(
        makeChain({ _id: staffId, providerId }),
      ),
    };

    const bookingModel = {
      findById: jest.fn().mockReturnValue(
        makeChain({
          _id: bookingId,
          bookingCode: 'TG-SUP-001',
          customerId: {
            _id: customerUserId,
            profile: { fullName: 'Khách A', avatarUrl: null },
            auth: { phone: '0911111111' },
          },
          providerIds: [providerId],
          status: BookingStatus.Confirmed,
        }),
      ),
      findOne: jest
        .fn()
        .mockReturnValue(makeChain(opts.bookingStaffMatch ?? null)),
    };

    const bookingScheduleModel = {
      find: jest.fn().mockReturnValue(
        makeChain(
          opts.schedules ?? [
            {
              _id: new Types.ObjectId(),
              bookingId,
              providerId,
              assignedStaffId: staffId,
              assignedStaffSnapshot: {
                name: 'Minh Khoa',
                phone: '0901112222',
                linkedUserId: staffUserId.toString(),
              },
              scheduleType: BookingScheduleType.Photoshoot,
              status: BookingScheduleStatus.Confirmed,
            },
          ],
        ),
      ),
    };

    const service = new ChatService(
      roomModel as any,
      messageModel as any,
      userModel as any,
      providerModel as any,
      providerStaffModel as any,
      bookingModel as any,
      bookingScheduleModel as any,
    );

    return {
      service,
      roomModel,
      messageModel,
      providerModel,
      providerStaffModel,
    };
  }

  it('allows Studio Owner to inspect Customer <-> Staff messages in read-only mode without marking read', async () => {
    const sampleMsgs = [
      { _id: new Types.ObjectId(), senderId: customerUserId, messageText: 'Em đứng cổng Ngọ Môn ạ' },
      { _id: new Types.ObjectId(), senderId: staffUserId, messageText: 'Anh đang tới ngay' },
    ];
    const { service, messageModel } = createFixture({
      room: { _id: roomId, participants: [customerUserId, staffUserId] },
      messages: sampleMsgs,
    });

    const result = await service.getStaffChatForBookingSupervision(
      bookingId.toString(),
      ownerUserId.toString(),
      ['PROVIDER'],
    );

    expect(result.readOnly).toBe(true);
    expect(result.bookingCode).toBe('TG-SUP-001');
    expect(result.roomId).toBe(roomId.toString());
    expect(result.messages).toEqual(sampleMsgs);
    expect(messageModel.updateMany).not.toHaveBeenCalled();
  });

  it('blocks foreign Studio Owner from reading supervision chat and blocks non-participants from sending messages', async () => {
    const { service, messageModel } = createFixture({
      ownedProviderIds: [],
      room: { _id: roomId, participants: [customerUserId, staffUserId] },
    });

    await expect(
      service.getStaffChatForBookingSupervision(
        bookingId.toString(),
        foreignOwnerUserId.toString(),
        ['PROVIDER'],
      ),
    ).rejects.toThrow(ForbiddenException);

    // Even the legitimate Studio Owner cannot impersonate/send in Customer <-> Staff room
    await expect(
      service.createMessage(
        roomId.toString(),
        ownerUserId.toString(),
        'Nhắn xen ngang',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(messageModel.create).not.toHaveBeenCalled();
  });

  it('allows STAFF to open chat with assigned customer or Studio Owner, and rejects unassigned customers', async () => {
    const { service } = createFixture({
      bookingStaffMatch: null,
    });

    // Cannot chat with an unassigned customer
    await expect(
      service.getOrCreateRoom(
        staffUserId.toString(),
        unassignedCustomerId.toString(),
        ['STAFF'],
      ),
    ).rejects.toThrow(ForbiddenException);

    // Can chat with own Studio Owner
    await expect(
      service.getOrCreateRoom(
        staffUserId.toString(),
        ownerUserId.toString(),
        ['STAFF'],
      ),
    ).resolves.toMatchObject({ id: roomId });

    // Can chat with assigned customer
    const assignedFixture = createFixture({
      bookingStaffMatch: { _id: bookingId },
    });
    await expect(
      assignedFixture.service.getOrCreateRoom(
        staffUserId.toString(),
        customerUserId.toString(),
        ['STAFF'],
      ),
    ).resolves.toMatchObject({ id: roomId });
  });

  it('lets customer resolve chat room directly by ProviderStaff id, or returns clear message if staff lacks account', async () => {
    const { service } = createFixture();
    await expect(
      service.getOrCreateRoom(customerUserId.toString(), staffId.toString(), [
        'CUSTOMER',
      ]),
    ).resolves.toMatchObject({ id: roomId });

    const noAccountFixture = createFixture({
      staffDoc: { _id: staffId, name: 'Thợ Mới', linkedUserId: null },
    });
    await expect(
      noAccountFixture.service.getOrCreateRoom(
        customerUserId.toString(),
        staffId.toString(),
        ['CUSTOMER'],
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
