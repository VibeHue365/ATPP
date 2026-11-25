import { Types } from 'mongoose';
import { BookingStatus, BookingType } from '../bookings/schemas/booking.schema';
import {
  BookingScheduleStatus,
  BookingScheduleType,
} from '../bookings/schemas/booking-schedule.schema';
import { ProviderCapability, ProviderStatus } from '../providers/schemas/provider.schema';
import { ProviderStaffStatus } from '../providers/schemas/provider-staff.schema';
import { ChatService } from './chat.service';

type Row = Record<string, any>;

function makeChain(result: unknown) {
  const q: Row = {};
  for (const method of ['select', 'populate', 'sort', 'skip', 'limit', 'lean']) {
    q[method] = jest.fn().mockReturnValue(q);
  }
  q.exec = jest.fn().mockResolvedValue(result);
  return q;
}

describe('ChatService role-aware rooms & partners', () => {
  const ownerUserId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const staffUserId = new Types.ObjectId();
  const staffId = new Types.ObjectId();
  const customerUserId = new Types.ObjectId();
  const otherProviderUserId = new Types.ObjectId();
  const otherProviderId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();
  const roomOwnerStaffId = new Types.ObjectId();
  const roomCustomerStaffId = new Types.ObjectId();
  const roomOwnerCustomerId = new Types.ObjectId();

  function buildService(overrides?: {
    rooms?: Row[];
    existingRoomParticipants?: Types.ObjectId[][];
    providers?: Row[];
    staffDocs?: Row[];
    schedules?: Row[];
    bookings?: Row[];
    users?: Row[];
  }) {
    const rooms = overrides?.rooms ?? [];
    const existingRooms = (overrides?.existingRoomParticipants ?? []).map((p) => ({
      _id: new Types.ObjectId(),
      participants: p,
    }));

    const roomModel = {
      find: jest.fn((filter: Row) => {
        if (filter && Array.isArray(overrides?.existingRoomParticipants)) {
          return makeChain(rooms.length ? rooms : existingRooms);
        }
        return makeChain(rooms);
      }),
      findById: jest.fn().mockReturnValue(makeChain(null)),
      findOne: jest.fn().mockReturnValue(makeChain(null)),
      create: jest.fn(),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };

    const messageModel = {
      aggregate: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockReturnValue(makeChain([])),
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue(undefined),
    };

    const userModel = {
      find: jest.fn().mockReturnValue(makeChain(overrides?.users ?? [])),
      findById: jest.fn().mockReturnValue(makeChain(null)),
    };

    const providerModel = {
      find: jest.fn().mockReturnValue(makeChain(overrides?.providers ?? [])),
      findById: jest.fn().mockReturnValue(makeChain(null)),
    };

    const providerStaffModel = {
      find: jest.fn().mockReturnValue(makeChain(overrides?.staffDocs ?? [])),
      findById: jest.fn().mockReturnValue(makeChain(null)),
    };

    const bookingModel = {
      find: jest.fn().mockReturnValue(makeChain(overrides?.bookings ?? [])),
      findById: jest.fn().mockReturnValue(makeChain(null)),
      findOne: jest.fn().mockReturnValue(makeChain(null)),
    };

    const bookingScheduleModel = {
      find: jest.fn().mockReturnValue(makeChain(overrides?.schedules ?? [])),
      findOne: jest.fn().mockReturnValue(makeChain(null)),
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

    return { service, roomModel, providerModel, providerStaffModel };
  }

  it('pins Studio Owner room first for STAFF and attaches non-financial bookingContext for assigned customer', async () => {
    const newerTime = new Date('2026-11-26T10:00:00Z');
    const olderTime = new Date('2026-11-26T08:00:00Z');

    const { service } = buildService({
      rooms: [
        {
          _id: roomCustomerStaffId,
          participants: [
            { _id: staffUserId, roles: ['STAFF'] },
            {
              _id: customerUserId,
              profile: { fullName: 'Ding Le', avatarUrl: null },
              roles: ['CUSTOMER'],
              defaultRole: 'CUSTOMER',
            },
          ],
          lastMessage: {
            _id: new Types.ObjectId(),
            messageText: 'Em đứng trước cổng Đại Nội ạ',
            senderId: { _id: customerUserId },
            isRead: false,
            createdAt: newerTime,
          },
          lastMessageAt: newerTime,
        },
        {
          _id: roomOwnerStaffId,
          participants: [
            { _id: staffUserId, roles: ['STAFF'] },
            {
              _id: ownerUserId,
              profile: { fullName: 'Chủ Studio Huế', avatarUrl: null },
              roles: ['PROVIDER'],
              defaultRole: 'PROVIDER',
            },
          ],
          lastMessage: {
            _id: new Types.ObjectId(),
            messageText: 'Nhớ mang ống kính 85mm nhé',
            senderId: { _id: ownerUserId },
            isRead: true,
            createdAt: olderTime,
          },
          lastMessageAt: olderTime,
        },
      ],
      providers: [
        {
          _id: providerId,
          userId: ownerUserId,
          businessName: 'Cố Đô Studio',
          capabilities: [ProviderCapability.Photography],
          media: { logoUrl: 'https://cdn.example/logo.jpg' },
        },
      ],
      staffDocs: [
        {
          _id: staffId,
          providerId,
          name: 'Nguyễn Minh Tuấn',
          specialty: 'Cổ phục Hoàng Thành',
          linkedUserId: staffUserId,
          status: ProviderStaffStatus.Active,
        },
      ],
      schedules: [
        {
          bookingId,
          scheduleType: BookingScheduleType.Photoshoot,
          assignedStaffId: staffId,
          startsAt: new Date('2026-11-28T08:00:00Z'),
          timeSlot: '08:00 - 11:00',
          locationSnapshot: { address: 'Ngọ Môn, Đại Nội Huế' },
          status: BookingScheduleStatus.Confirmed,
        },
      ],
      bookings: [
        {
          _id: bookingId,
          bookingCode: '5BEC4A',
          customerId: customerUserId,
          bookingType: BookingType.Photography,
          status: BookingStatus.Confirmed,
        },
      ],
    });

    const result = await service.getRooms(staffUserId.toString(), ['STAFF']);

    expect(result).toHaveLength(2);
    // Pinned Studio Owner room comes first despite older lastMessageAt
    expect(result[0]).toMatchObject({
      id: roomOwnerStaffId,
      roomCategory: 'STAFF_TO_OWNER',
      isPinned: true,
      otherParticipant: {
        id: ownerUserId,
        fullName: 'Cố Đô Studio',
        participantRole: 'PROVIDER',
        roleBadge: 'Chủ Studio',
      },
    });
    expect(result[1]).toMatchObject({
      id: roomCustomerStaffId,
      roomCategory: 'STAFF_TO_CUSTOMER',
      isPinned: false,
      bookingContext: {
        bookingCode: '5BEC4A',
        serviceLabel: 'Lịch chụp ảnh',
        timeSlot: '08:00 - 11:00',
        locationAddress: 'Ngọ Môn, Đại Nội Huế',
      },
      otherParticipant: {
        id: customerUserId,
        fullName: 'Ding Le',
        participantRole: 'CUSTOMER',
        roleBadge: 'Khách chụp của bạn',
      },
    });
    expect((result[1].bookingContext as any)?.grandTotal).toBeUndefined();
    expect((result[1].bookingContext as any)?.depositTotal).toBeUndefined();
  });

  it('categorizes OWNER_TO_STAFF and CUSTOMER_TO_PROVIDER cleanly for PROVIDER', async () => {
    const { service } = buildService({
      rooms: [
        {
          _id: roomOwnerStaffId,
          participants: [
            { _id: ownerUserId, roles: ['PROVIDER'] },
            {
              _id: staffUserId,
              profile: { fullName: 'Minh Tuấn', avatarUrl: null },
              roles: ['STAFF'],
              defaultRole: 'STAFF',
            },
          ],
          lastMessage: null,
          lastMessageAt: new Date(),
        },
        {
          _id: roomOwnerCustomerId,
          participants: [
            { _id: ownerUserId, roles: ['PROVIDER'] },
            {
              _id: customerUserId,
              profile: { fullName: 'Lan Anh', avatarUrl: null },
              roles: ['CUSTOMER'],
              defaultRole: 'CUSTOMER',
            },
          ],
          lastMessage: null,
          lastMessageAt: new Date(),
        },
      ],
      providers: [{ _id: providerId, userId: ownerUserId, businessName: 'Cố Đô Studio' }],
      staffDocs: [
        {
          _id: staffId,
          providerId,
          name: 'Nguyễn Minh Tuấn',
          specialty: 'Chụp ngoại cảnh Đại Nội',
          linkedUserId: staffUserId,
          status: ProviderStaffStatus.Active,
        },
      ],
      bookings: [
        {
          _id: bookingId,
          bookingCode: 'TG-2026',
          customerId: customerUserId,
          providerIds: [providerId],
          bookingType: BookingType.Combo,
          status: BookingStatus.DepositPaid,
        },
      ],
    });

    const result = await service.getRooms(ownerUserId.toString(), ['PROVIDER']);
    expect(result[0]).toMatchObject({
      roomCategory: 'OWNER_TO_STAFF',
      otherParticipant: {
        participantRole: 'STAFF',
        roleBadge: 'Thợ chụp Studio',
        staffSpecialty: 'Chụp ngoại cảnh Đại Nội',
      },
    });
    expect(result[1]).toMatchObject({
      roomCategory: 'CUSTOMER_TO_PROVIDER',
      bookingContext: {
        bookingCode: 'TG-2026',
        serviceLabel: 'Combo Áo Dài & Chụp ảnh',
      },
      otherParticipant: {
        participantRole: 'CUSTOMER',
        roleBadge: 'Khách hàng',
      },
    });
  });

  it('scopes getAvailablePartners differently for STAFF, PROVIDER, and CUSTOMER', async () => {
    // 1. STAFF sees own Studio Owner + assigned Customer (not random studios)
    const staffCtx = buildService({
      existingRoomParticipants: [],
      staffDocs: [
        {
          _id: staffId,
          providerId,
          linkedUserId: staffUserId,
          status: ProviderStaffStatus.Active,
        },
      ],
      providers: [
        {
          _id: providerId,
          userId: ownerUserId,
          businessName: 'Cố Đô Studio',
          capabilities: [ProviderCapability.Photography],
        },
      ],
      schedules: [{ bookingId, assignedStaffId: staffId }],
      bookings: [{ _id: bookingId, customerId: customerUserId, bookingCode: '5BEC4A' }],
      users: [
        { _id: ownerUserId, profile: { fullName: 'Chủ Studio' } },
        { _id: customerUserId, profile: { fullName: 'Ding Le' } },
      ],
    });
    // Ensure first userModel.find returns owner user, second returns customer user
    staffCtx.service = new ChatService(
      { find: jest.fn().mockReturnValue(makeChain([])) } as any,
      { aggregate: jest.fn().mockResolvedValue([]) } as any,
      {
        find: jest
          .fn()
          .mockReturnValueOnce(
            makeChain([{ _id: ownerUserId, profile: { fullName: 'Chủ Studio' } }]),
          )
          .mockReturnValueOnce(
            makeChain([{ _id: customerUserId, profile: { fullName: 'Ding Le' } }]),
          ),
      } as any,
      {
        find: jest.fn().mockReturnValue(
          makeChain([
            {
              _id: providerId,
              userId: ownerUserId,
              businessName: 'Cố Đô Studio',
              capabilities: [ProviderCapability.Photography],
            },
          ]),
        ),
      } as any,
      {
        find: jest.fn().mockReturnValue(
          makeChain([
            {
              _id: staffId,
              providerId,
              linkedUserId: staffUserId,
              status: ProviderStaffStatus.Active,
            },
          ]),
        ),
      } as any,
      {
        find: jest.fn().mockReturnValue(
          makeChain([
            { _id: bookingId, customerId: customerUserId, bookingCode: '5BEC4A' },
          ]),
        ),
      } as any,
      {
        find: jest
          .fn()
          .mockReturnValue(makeChain([{ bookingId, assignedStaffId: staffId }])),
      } as any,
    );

    const staffPartners = await staffCtx.service.getAvailablePartners(
      staffUserId.toString(),
      ['STAFF'],
    );
    expect(staffPartners).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: ownerUserId,
          partnerType: 'STUDIO_OWNER',
        }),
        expect.objectContaining({
          userId: customerUserId,
          partnerType: 'ASSIGNED_CUSTOMER',
          subtitle: 'Khách đơn #5BEC4A',
        }),
      ]),
    );

    // 2. PROVIDER sees own STAFF only
    const providerSvc = new ChatService(
      { find: jest.fn().mockReturnValue(makeChain([])) } as any,
      { aggregate: jest.fn().mockResolvedValue([]) } as any,
      {
        find: jest
          .fn()
          .mockReturnValue(makeChain([{ _id: staffUserId, profile: { fullName: 'Tuấn' } }])),
      } as any,
      {
        find: jest.fn().mockReturnValue(makeChain([{ _id: providerId }])),
      } as any,
      {
        find: jest.fn().mockReturnValue(
          makeChain([
            {
              _id: staffId,
              name: 'Nguyễn Minh Tuấn',
              specialty: 'Cổ phục',
              linkedUserId: staffUserId,
            },
          ]),
        ),
      } as any,
    );
    const providerPartners = await providerSvc.getAvailablePartners(
      ownerUserId.toString(),
      ['PROVIDER'],
    );
    expect(providerPartners).toEqual([
      expect.objectContaining({
        userId: staffUserId,
        businessName: 'Nguyễn Minh Tuấn',
        partnerType: 'STAFF',
        subtitle: 'Cổ phục',
      }),
    ]);

    // 3. CUSTOMER sees active Photography / AoDai studios
    const customerSvc = new ChatService(
      { find: jest.fn().mockReturnValue(makeChain([])) } as any,
      { aggregate: jest.fn().mockResolvedValue([]) } as any,
      {
        find: jest.fn().mockReturnValue(
          makeChain([{ _id: otherProviderUserId, profile: { fullName: 'Shop Huế' } }]),
        ),
      } as any,
      {
        find: jest.fn().mockReturnValue(
          makeChain([
            {
              _id: otherProviderId,
              userId: otherProviderUserId,
              businessName: 'Tiệm Áo Dài Huế',
              status: ProviderStatus.Active,
              capabilities: [ProviderCapability.AoDaiRental],
            },
          ]),
        ),
      } as any,
    );
    const customerPartners = await customerSvc.getAvailablePartners(
      customerUserId.toString(),
      ['CUSTOMER'],
    );
    expect(customerPartners).toEqual([
      expect.objectContaining({
        userId: otherProviderUserId,
        businessName: 'Tiệm Áo Dài Huế',
        partnerType: 'PROVIDER',
        subtitle: 'Tiệm Thuê Áo Dài',
      }),
    ]);
  });
});
