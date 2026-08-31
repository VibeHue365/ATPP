import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus } from '../../bookings/schemas/booking.schema';
import { EscrowStatus } from '../../payments/schemas/booking-escrow.schema';
import { DisputeStatus } from '../schemas/dispute.schema';
import { IncidentStatus } from '../schemas/incident-report.schema';
import { DisputesService } from './disputes.service';

describe('DisputesService', () => {
  let incidentModel: any;
  let disputeModel: any;
  let privateEvidenceUploadModel: any;
  let bookingModel: any;
  let bookingItemModel: any;
  let inventoryModel: any;
  let paymentsService: any;
  let refundWorkflowService: any;
  let bankingService: any;
  let settlementsService: any;
  let policyResolverService: any;
  let privateStorage: any;
  let service: DisputesService;

  const bookingId = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const incidentId = new Types.ObjectId();

  beforeEach(() => {
    incidentModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    disputeModel = { findOneAndUpdate: jest.fn() };
    privateEvidenceUploadModel = { insertMany: jest.fn(), countDocuments: jest.fn(), updateMany: jest.fn(), findOne: jest.fn() };
    bookingItemModel = { findOne: jest.fn().mockResolvedValue(null) };
    inventoryModel = {};
    paymentsService = { executeProfitSplit: jest.fn() };
    refundWorkflowService = { createFromDispute: jest.fn() };
    bankingService = { executeAutoTransfer: jest.fn() };
    settlementsService = {
      holdSettlementsForBooking: jest.fn(),
      releaseSettlementsForBooking: jest.fn(),
      cancelSettlementsForBooking: jest.fn(),
    };
    policyResolverService = {
      getDisputePolicy: jest.fn().mockResolvedValue({
        allowDisputeAfterCompletedHours: 72,
        requireEvidence: true,
        holdSettlementWhenDisputed: true,
      }),
    };
    bookingModel = {
      findById: jest.fn(),
      db: { model: jest.fn() },
    };
    privateStorage = { readPrivateFile: jest.fn(), deletePrivateFile: jest.fn() };

    service = new DisputesService(
      incidentModel,
      disputeModel,
      privateEvidenceUploadModel,
      bookingModel,
      bookingItemModel,
      inventoryModel,
      paymentsService,
      refundWorkflowService,
      bankingService,
      settlementsService,
      policyResolverService,
      privateStorage,
    );
  });

  it('rejects private evidence that is not owned by the reporting provider', async () => {
    privateEvidenceUploadModel.countDocuments.mockResolvedValue(0);

    await expect(
      (service as any).assertEvidenceReferencesOwnedBy(customerId.toString(), [
        'private://dispute-evidence-private/dispute-evidence/2026-07-15/evidence.jpg',
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets the provider preview their unattached evidence before submitting', async () => {
    const reference = 'private://dispute-evidence-private/dispute-evidence/2026-07-15/evidence.jpg';
    incidentModel.findOne.mockResolvedValue(null);
    privateEvidenceUploadModel.findOne.mockResolvedValue({ reference });
    privateStorage.readPrivateFile.mockResolvedValue({ pipe: jest.fn() });

    const result = await service.viewEvidence(customerId.toString(), ['PROVIDER'], reference);

    expect(privateStorage.readPrivateFile).toHaveBeenCalledWith(
      'dispute-evidence-private',
      'dispute-evidence/2026-07-15/evidence.jpg',
    );
    expect(result.mimeType).toBe('image/jpeg');
  });
  it('blocks a user who does not own the booking from viewing an incident', async () => {
    const incident = { bookingId, reportedBy: providerId };
    const query = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(incident),
    };
    incidentModel.findOne.mockReturnValue(query);
    bookingModel.findById.mockResolvedValue({ customerId });

    await expect(
      service.getIncidentByBooking(
        bookingId.toString(),
        new Types.ObjectId().toString(),
        ['CUSTOMER'],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns conflict when customer disagrees with an already processed incident', async () => {
    incidentModel.findById.mockResolvedValue({
      status: IncidentStatus.Accepted,
    });

    await expect(
      service.customerDisagreeIncident(
        incidentId.toString(),
        customerId.toString(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('holds settlements and creates one dispute when customer disagrees', async () => {
    const bookingItemId = new Types.ObjectId();
    const incident = {
      _id: incidentId,
      bookingId,
      bookingItemId,
      reportedBy: providerId,
      description: 'Áo dài bị rách',
      evidencePhotos: ['/uploads/dispute-evidence/evidence.jpg'],
      status: IncidentStatus.PendingCustomer,
    };
    const booking = {
      _id: bookingId,
      customerId,
      status: BookingStatus.ReturnPending,
      statusTimeline: [],
      save: jest.fn(),
    };
    incidentModel.findById.mockResolvedValue(incident);
    incidentModel.findOneAndUpdate.mockResolvedValue({
      ...incident,
      status: IncidentStatus.Disputed,
    });
    bookingModel.findById.mockResolvedValue(booking);
    disputeModel.findOneAndUpdate.mockResolvedValue({
      status: DisputeStatus.Open,
    });

    await service.customerDisagreeIncident(
      incidentId.toString(),
      customerId.toString(),
    );

    expect(settlementsService.holdSettlementsForBooking).toHaveBeenCalledWith(
      bookingId.toString(),
      'Booking is under dispute',
    );
    expect(disputeModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(booking.status).toBe(BookingStatus.Disputed);
  });

  it('does not hold settlements when the active dispute policy disables it', async () => {
    const incident = {
      _id: incidentId,
      bookingId,
      bookingItemId: new Types.ObjectId(),
      reportedBy: providerId,
      description: 'Sự cố dịch vụ',
      evidencePhotos: [],
      status: IncidentStatus.PendingCustomer,
    };
    const booking = {
      _id: bookingId,
      customerId,
      status: BookingStatus.ReturnPending,
      statusTimeline: [],
      save: jest.fn(),
    };
    incidentModel.findById.mockResolvedValue(incident);
    incidentModel.findOneAndUpdate.mockResolvedValue({
      ...incident,
      status: IncidentStatus.Disputed,
    });
    bookingModel.findById.mockResolvedValue(booking);
    disputeModel.findOneAndUpdate.mockResolvedValue({ status: DisputeStatus.Open });
    policyResolverService.getDisputePolicy.mockResolvedValue({
      allowDisputeAfterCompletedHours: 72,
      requireEvidence: false,
      holdSettlementWhenDisputed: false,
    });

    await service.customerDisagreeIncident(
      incidentId.toString(),
      customerId.toString(),
    );

    expect(settlementsService.holdSettlementsForBooking).not.toHaveBeenCalled();
  });

  it('rejects a split resolution that exceeds the held deposit', async () => {
    bookingModel.findById.mockResolvedValue({
      _id: bookingId,
      pricingSummary: { depositTotal: 500_000 },
    });
    incidentModel.findOne.mockResolvedValue({
      status: IncidentStatus.Disputed,
      requestedAmount: 200_000,
    });

    await expect(
      service.adminResolveIncident(
        bookingId.toString(),
        'SPLIT',
        new Types.ObjectId().toString(),
        'Phân chia theo bằng chứng',
        400_000,
        200_000,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns conflict when another request already acquired the escrow', async () => {
    bookingModel.findById.mockResolvedValue({
      _id: bookingId,
      pricingSummary: { depositTotal: 500_000 },
    });
    incidentModel.findOne.mockResolvedValue({
      status: IncidentStatus.Disputed,
      requestedAmount: 200_000,
    });
    bookingModel.db.model.mockReturnValue({
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.adminResolveIncident(
        bookingId.toString(),
        'CUSTOMER_RIGHT',
        new Types.ObjectId().toString(),
        'Khách hàng cung cấp đủ bằng chứng',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refunds customer and cancels settlements without splitting provider profit', async () => {
    const booking = {
      _id: bookingId,
      bookingCode: 'VH-001',
      customerId,
      pricingSummary: { depositTotal: 500_000 },
      status: BookingStatus.Disputed,
      statusTimeline: [],
      save: jest.fn(),
    };
    const incident = {
      _id: incidentId,
      bookingId,
      reportedBy: providerId,
      status: IncidentStatus.Disputed,
      requestedAmount: 200_000,
      save: jest.fn(),
    };
    const escrowModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue({
        status: EscrowStatus.Held,
      }),
      updateOne: jest.fn(),
    };
    bookingModel.findById.mockResolvedValue(booking);
    bookingModel.db.model.mockImplementation((name: string) => {
      if (name === 'BookingEscrow') return escrowModel;
      throw new Error(`Unexpected model ${name}`);
    });
    incidentModel.findOne.mockResolvedValue(incident);
    disputeModel.findOneAndUpdate.mockResolvedValue({
      status: DisputeStatus.Resolved,
    });
    refundWorkflowService.createFromDispute.mockResolvedValue({
      status: 'COMPLETED',
    });

    await service.adminResolveIncident(
      bookingId.toString(),
      'CUSTOMER_RIGHT',
      new Types.ObjectId().toString(),
      'Hoàn toàn bộ cọc cho khách',
    );

    expect(refundWorkflowService.createFromDispute).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500_000 }),
    );
    expect(settlementsService.cancelSettlementsForBooking).toHaveBeenCalledWith(
      bookingId.toString(),
      'Hoàn toàn bộ cọc cho khách',
      expect.any(String),
    );
    expect(paymentsService.executeProfitSplit).not.toHaveBeenCalled();
  });

  it('uses the exact split amounts for refund and provider compensation', async () => {
    const booking = {
      _id: bookingId,
      bookingCode: 'VH-002',
      customerId,
      pricingSummary: { depositTotal: 500_000 },
      status: BookingStatus.Disputed,
      statusTimeline: [],
      save: jest.fn(),
    };
    const incident = {
      _id: incidentId,
      bookingId,
      reportedBy: providerId,
      status: IncidentStatus.Disputed,
      requestedAmount: 300_000,
      save: jest.fn(),
    };
    const escrowModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue({
        status: EscrowStatus.Held,
      }),
      updateOne: jest.fn(),
    };
    const providerModel = {
      findById: jest.fn().mockResolvedValue({
        _id: providerId,
        paymentAccounts: [],
      }),
    };
    bookingModel.findById.mockResolvedValue(booking);
    bookingModel.db.model.mockImplementation((name: string) => {
      if (name === 'BookingEscrow') return escrowModel;
      if (name === 'Provider') return providerModel;
      throw new Error(`Unexpected model ${name}`);
    });
    incidentModel.findOne.mockResolvedValue(incident);
    disputeModel.findOneAndUpdate.mockResolvedValue({
      status: DisputeStatus.Resolved,
    });
    refundWorkflowService.createFromDispute.mockResolvedValue({
      status: 'COMPLETED',
    });
    const compensationSpy = jest
      .spyOn(service as any, 'executeCompensationTransfer')
      .mockResolvedValue({ success: true });

    await service.adminResolveIncident(
      bookingId.toString(),
      'SPLIT',
      new Types.ObjectId().toString(),
      'Mỗi bên chịu một phần trách nhiệm',
      300_000,
      150_000,
    );

    expect(refundWorkflowService.createFromDispute).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 300_000 }),
    );
    expect(compensationSpy).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 150_000 }),
    );
    expect(settlementsService.releaseSettlementsForBooking).toHaveBeenCalled();
    expect(paymentsService.executeProfitSplit).toHaveBeenCalledWith(booking);
  });

  it('does not execute a successful compensation transfer twice', async () => {
    const transferModel = {
      findOne: jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        transactionReference: 'COMPENSATION_VH-001',
      }),
      findOneAndUpdate: jest.fn(),
    };
    bookingModel.db.model.mockReturnValue(transferModel);

    const result = await (service as any).executeCompensationTransfer({
      bookingId,
      providerId,
      amount: 200_000,
      bankName: 'VCB',
      accountNumber: '1234',
      accountHolder: 'SHOP',
      transferRef: 'COMPENSATION_VH-001',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      idempotent: true,
    }));
    expect(bankingService.executeAutoTransfer).not.toHaveBeenCalled();
  });
});
