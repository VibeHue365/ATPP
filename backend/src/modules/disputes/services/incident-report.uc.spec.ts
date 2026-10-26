import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus } from '../../bookings/schemas/booking.schema';
import { IncidentStatus } from '../schemas/incident-report.schema';
import { DisputesService } from './disputes.service';

type Row = Record<string, any>;

const providerUserId = new Types.ObjectId().toString();
const providerId = new Types.ObjectId();
const HOUR = 60 * 60 * 1000;

function createService(
  options: {
    booking?: Row | null;
    item?: Row | null;
    existing?: Row | null;
    provider?: Row | null;
    requireEvidence?: boolean;
    createError?: unknown;
  } = {},
) {
  const bookingId = new Types.ObjectId();
  const booking =
    options.booking === undefined
      ? {
          _id: bookingId,
          bookingCode: 'BK-2026',
          customerId: new Types.ObjectId(),
          status: BookingStatus.Returned,
          pricingSummary: { depositTotal: 300000 },
          statusTimeline: [],
          save: jest.fn().mockResolvedValue(undefined),
        }
      : options.booking;
  const item =
    options.item === undefined
      ? {
          _id: new Types.ObjectId(),
          bookingId: booking?._id ?? bookingId,
          providerId,
          productId: new Types.ObjectId(),
          inventoryItemId: new Types.ObjectId(),
        }
      : options.item;
  const escrowModel = { updateOne: jest.fn().mockResolvedValue(undefined) };
  const notificationModel = { create: jest.fn().mockResolvedValue(undefined) };
  const providerModel = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        options.provider === undefined
          ? { _id: providerId, businessName: 'Hue Shop' }
          : options.provider,
      ),
  };
  const bookingModel = {
    findById: jest.fn().mockResolvedValue(booking),
    db: {
      model: jest.fn((name: string) =>
        name === 'Provider'
          ? providerModel
          : name === 'BookingEscrow'
            ? escrowModel
            : notificationModel,
      ),
    },
  };
  const incidentModel = {
    findOne: jest.fn().mockResolvedValue(options.existing ?? null),
    create: options.createError
      ? jest.fn().mockRejectedValue(options.createError)
      : jest.fn(async (data: Row) => ({ _id: new Types.ObjectId(), ...data })),
  };
  const inventoryModel = {
    findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
  };
  const service = new DisputesService(
    incidentModel as any,
    {} as any,
    {} as any,
    bookingModel as any,
    { findById: jest.fn().mockResolvedValue(item) } as any,
    inventoryModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {
      getDisputePolicy: jest
        .fn()
        .mockResolvedValue({
          requireEvidence: options.requireEvidence ?? true,
          allowDisputeAfterCompletedHours: 72,
        }),
    } as any,
    {} as any,
  );
  jest
    .spyOn(service as any, 'validateEvidenceReferences')
    .mockReturnValue(undefined);
  jest
    .spyOn(service as any, 'assertEvidenceReferencesOwnedBy')
    .mockResolvedValue(undefined);
  jest
    .spyOn(service as any, 'attachPrivateEvidenceUploads')
    .mockResolvedValue(undefined);
  return {
    service,
    booking,
    item,
    incidentModel,
    inventoryModel,
    escrowModel,
    notificationModel,
  };
}

function dto(booking: Row | null, item: Row | null, overrides: Row = {}): any {
  return {
    bookingId: booking?._id?.toString() ?? new Types.ObjectId().toString(),
    bookingItemId: item?._id?.toString() ?? new Types.ObjectId().toString(),
    description: 'Rách tà áo',
    evidencePhotos: ['private://evidence-1'],
    requestedAmount: 150000,
    actionType: 'CLEANING',
    ...overrides,
  };
}

afterEach(() => jest.restoreAllMocks());

describe('UC-39 Incident Report (NgocL)', () => {
  it('UT-39 UTCID03 returns not found for a missing booking', async () => {
    const { service } = createService({ booking: null });

    await expect(
      service.createIncidentReport(providerUserId, dto(null, null)),
    ).rejects.toThrow(new NotFoundException('Không tìm thấy đơn hàng'));
  });

  it('UT-39 UTCID04 returns not found for a missing booking item', async () => {
    const { service, booking } = createService({ item: null });

    await expect(
      service.createIncidentReport(providerUserId, dto(booking, null)),
    ).rejects.toThrow(
      new NotFoundException('Không tìm thấy sản phẩm trong đơn hàng'),
    );
  });

  it('UT-39 UTCID05 rejects an item that belongs to another booking', async () => {
    const foreignItem = {
      _id: new Types.ObjectId(),
      bookingId: new Types.ObjectId(),
      providerId,
    };
    const { service, booking } = createService({ item: foreignItem });

    await expect(
      service.createIncidentReport(providerUserId, dto(booking, foreignItem)),
    ).rejects.toThrow(
      new BadRequestException('Sản phẩm không thuộc đơn đặt lịch này'),
    );
  });

  it('UT-39 UTCID06 rejects a second incident for the same booking item', async () => {
    const { service, booking, item } = createService({
      existing: { _id: new Types.ObjectId() },
    });

    await expect(
      service.createIncidentReport(providerUserId, dto(booking, item)),
    ).rejects.toThrow(
      new ConflictException('Sự cố của sản phẩm này đã được báo cáo trước đó'),
    );
  });

  it('UT-39 UTCID07 rejects compensation above the held rental deposit', async () => {
    const { service, booking, item, incidentModel } = createService();

    await expect(
      service.createIncidentReport(
        providerUserId,
        dto(booking, item, { requestedAmount: 300001 }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(incidentModel.create).not.toHaveBeenCalled();
  });

  it('UT-39 UTCID08 accepts compensation equal to the held rental deposit', async () => {
    const { service, booking, item } = createService();

    await expect(
      service.createIncidentReport(
        providerUserId,
        dto(booking, item, { requestedAmount: 300000 }),
      ),
    ).resolves.toMatchObject({ requestedAmount: 300000 });
  });

  it('UT-39 UTCID09 forbids reporting an item of another provider', async () => {
    const { service, booking, item } = createService({
      provider: { _id: new Types.ObjectId(), businessName: 'Other' },
    });

    await expect(
      service.createIncidentReport(providerUserId, dto(booking, item)),
    ).rejects.toThrow(
      new ForbiddenException(
        'Bạn không có quyền báo cáo sản phẩm của provider khác',
      ),
    );
  });

  it('UT-39 UTCID10 requires at least one evidence photo when the policy demands it', async () => {
    const { service, booking, item } = createService();

    await expect(
      service.createIncidentReport(
        providerUserId,
        dto(booking, item, { evidencePhotos: [] }),
      ),
    ).rejects.toThrow(
      new BadRequestException('Vui lòng cung cấp ít nhất một bằng chứng'),
    );
  });

  it('UT-39 UTCID11 does not allow an incident before the costume is picked up', async () => {
    const { service, booking, item } = createService();
    booking!.status = BookingStatus.Confirmed;

    await expect(
      service.createIncidentReport(providerUserId, dto(booking, item)),
    ).rejects.toThrow(
      new BadRequestException(
        'Trạng thái đơn hàng chưa cho phép báo cáo sự cố',
      ),
    );
  });

  it('UT-39 UTCID12 closes the incident window 72 hours after completion', async () => {
    const { service, booking, item } = createService();
    booking!.status = BookingStatus.Completed;
    booking!.statusTimeline = [
      {
        status: BookingStatus.Completed,
        changedAt: new Date(Date.now() - 73 * HOUR),
      },
    ];

    await expect(
      service.createIncidentReport(providerUserId, dto(booking, item)),
    ).rejects.toThrow(new BadRequestException('Đã quá thời hạn mở khiếu nại'));
  });

  it('UT-39 UTCID13 records the incident, moves the costume to cleaning and asks the customer to respond', async () => {
    const {
      service,
      booking,
      item,
      inventoryModel,
      escrowModel,
      notificationModel,
    } = createService();

    const incident = await service.createIncidentReport(
      providerUserId,
      dto(booking, item),
    );

    expect(incident).toMatchObject({
      status: IncidentStatus.PendingCustomer,
      reportedBy: providerId,
      actionType: 'CLEANING',
    });
    expect(inventoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
      item!.inventoryItemId,
      { $set: { status: 'CLEANING' } },
    );
    expect(booking!.status).toBe(BookingStatus.ReturnPending);
    expect(escrowModel.updateOne).toHaveBeenCalledWith(
      { bookingId: booking!._id },
      { $set: { status: 'HELD' } },
    );
    expect(notificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DISPUTE' }),
    );
  });

  it('UT-39 UTCID14 maps a concurrent duplicate insert to a conflict', async () => {
    const { service, booking, item } = createService({
      createError: Object.assign(new Error('dup'), { code: 11000 }),
    });

    await expect(
      service.createIncidentReport(providerUserId, dto(booking, item)),
    ).rejects.toThrow(
      new ConflictException('Sự cố của sản phẩm này đã được báo cáo trước đó'),
    );
  });
});
