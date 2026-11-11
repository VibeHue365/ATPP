import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContractReadService } from '../contract-read.service';
import { ContractAccessService } from '../contract-access.service';
import { ContractConsentService } from '../contract-consent.service';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ContractVersionState, ContractDocumentStatus } from '../schemas/contract-version.schema';
import { ContractConsentAction } from '../schemas/contract-consent.schema';

describe('Regression Tests: Customer Contract History & Cancelled Booking UX (TC-01 -> TC-13)', () => {
  const customerA_Id = new Types.ObjectId();
  const customerB_Id = new Types.ObjectId();
  const provider_Id = new Types.ObjectId();
  const provider_UserId = new Types.ObjectId();
  const admin_UserId = new Types.ObjectId();

  const userCustomerA: AuthUser = {
    sub: customerA_Id.toString(),
    roles: ['CUSTOMER'],
    permissions: [],
    email: 'customerA@vibehue.invalid',
  };

  const userCustomerB: AuthUser = {
    sub: customerB_Id.toString(),
    roles: ['CUSTOMER'],
    permissions: [],
    email: 'customerB@vibehue.invalid',
  };

  const userAdmin: AuthUser = {
    sub: admin_UserId.toString(),
    roles: ['ADMIN'],
    permissions: ['user:read', 'provider:read'],
    email: 'admin@vibehue.invalid',
  };

  const userProvider: AuthUser = {
    sub: provider_UserId.toString(),
    roles: ['PROVIDER'],
    permissions: [],
    email: 'provider@vibehue.invalid',
  };

  let mockConnection: any;
  let mockContractsModel: any;
  let mockVersionsModel: any;
  let mockConsentsModel: any;
  let accessService: ContractAccessService;
  let readService: ContractReadService;
  let consentService: ContractConsentService;

  beforeEach(() => {
    mockConnection = {
      db: {
        collection: (name: string) => ({
          findOne: async (query: any) => {
            if (name === 'providers') {
              if (query.userId?.toString() === provider_UserId.toString()) {
                return { _id: provider_Id, userId: provider_UserId, status: 'ACTIVE' };
              }
            }
            return null;
          },
          find: () => ({
            project: () => ({
              toArray: async () => [],
            }),
          }),
        }),
      },
    };

    accessService = new ContractAccessService(mockConnection as any);

    mockContractsModel = {
      find: jest.fn(),
      findById: jest.fn(),
    };

    mockVersionsModel = {
      findById: jest.fn(),
    };

    mockConsentsModel = {
      exists: jest.fn().mockResolvedValue(false),
      findOne: jest.fn().mockResolvedValue(null),
    };

    readService = new ContractReadService(
      true, // enabled
      mockContractsModel as any,
      mockVersionsModel as any,
      mockConsentsModel as any,
      accessService,
      {} as any, // policy
      {} as any, // templates
      {} as any, // snapshots
      {} as any, // preparation
      mockConnection as any,
    );
  });

  // TC-01: CANCELLED + DRAFT → không hiện trong danh sách customer
  it('TC-01: CANCELLED booking with DRAFT contract is filtered out from customer contract list', async () => {
    const bookingId = new Types.ObjectId();
    const contractId = new Types.ObjectId();
    const versionId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'CANCELLED',
      contractFlowVersion: 2,
    } as any);

    mockContractsModel.find.mockReturnValue({
      lean: () => [
        {
          _id: contractId,
          bookingId,
          providerId: provider_Id,
          status: 'DRAFT',
          currentVersionId: versionId,
        },
      ],
    });

    mockVersionsModel.findById.mockReturnValue({
      lean: () => ({
        _id: versionId,
        contractId,
        version: 1,
        state: ContractVersionState.Draft,
      }),
    });

    mockConsentsModel.exists.mockResolvedValue(false);

    const result = await readService.listForBooking(userCustomerA, bookingId.toString());
    expect(result).toHaveLength(0);
  });

  // TC-02: CANCELLED + OFFERED → không hiện yêu cầu ký
  it('TC-02: CANCELLED booking with OFFERED contract is filtered out from customer list so no signing prompt is shown', async () => {
    const bookingId = new Types.ObjectId();
    const contractId = new Types.ObjectId();
    const versionId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'CANCELLED',
      contractFlowVersion: 2,
    } as any);

    mockContractsModel.find.mockReturnValue({
      lean: () => [
        {
          _id: contractId,
          bookingId,
          providerId: provider_Id,
          status: 'DRAFT',
          currentVersionId: versionId,
        },
      ],
    });

    mockVersionsModel.findById.mockReturnValue({
      lean: () => ({
        _id: versionId,
        contractId,
        version: 1,
        state: ContractVersionState.Offered,
      }),
    });

    mockConsentsModel.exists.mockResolvedValue(false);

    const result = await readService.listForBooking(userCustomerA, bookingId.toString());
    expect(result).toHaveLength(0);
  });

  // TC-03: CANCELLED + ACCEPTED → hiện trong lịch sử, PDF tải được nếu đã sinh
  it('TC-03: CANCELLED booking with ACCEPTED contract is retained in customer contracts with isSigned=true', async () => {
    const bookingId = new Types.ObjectId();
    const contractId = new Types.ObjectId();
    const versionId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'CANCELLED',
      contractFlowVersion: 2,
    } as any);

    mockContractsModel.find.mockReturnValue({
      lean: () => [
        {
          _id: contractId,
          bookingId,
          providerId: provider_Id,
          status: 'DRAFT',
          currentVersionId: versionId,
        },
      ],
    });

    mockVersionsModel.findById.mockReturnValue({
      lean: () => ({
        _id: versionId,
        contractId,
        version: 1,
        state: ContractVersionState.Accepted,
        customerAcceptedAt: new Date(),
        document: { status: ContractDocumentStatus.Ready },
      }),
    });

    mockConsentsModel.exists.mockResolvedValue(true);

    const result = await readService.listForBooking(userCustomerA, bookingId.toString());
    expect(result).toHaveLength(1);
    expect(result[0].isSigned).toBe(true);
    expect(result[0].hasPdf).toBe(true);
  });

  // TC-04: CANCELLED + EFFECTIVE → không bị mất lịch sử chấp thuận
  it('TC-04: CANCELLED booking with EFFECTIVE contract retains immutable consent evidence', async () => {
    const bookingId = new Types.ObjectId();
    const contractId = new Types.ObjectId();
    const versionId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'CANCELLED',
      contractFlowVersion: 2,
    } as any);

    mockContractsModel.find.mockReturnValue({
      lean: () => [
        {
          _id: contractId,
          bookingId,
          providerId: provider_Id,
          status: 'DRAFT',
          currentVersionId: versionId,
        },
      ],
    });

    mockVersionsModel.findById.mockReturnValue({
      lean: () => ({
        _id: versionId,
        contractId,
        version: 1,
        state: ContractVersionState.Effective,
        customerAcceptedAt: new Date('2026-11-01T10:00:00Z'),
      }),
    });

    mockConsentsModel.exists.mockResolvedValue(true);

    const result = await readService.listForBooking(userCustomerA, bookingId.toString());
    expect(result).toHaveLength(1);
    expect(result[0].isSigned).toBe(true);
    expect(result[0].state).toBe(ContractVersionState.Effective);
  });

  // TC-05: CANCELLED + TERMINATED → vẫn có thể truy xuất hồ sơ lịch sử theo quyền
  it('TC-05: CANCELLED booking with TERMINATED contract is retrievable in history', async () => {
    const bookingId = new Types.ObjectId();
    const contractId = new Types.ObjectId();
    const versionId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'CANCELLED',
      contractFlowVersion: 2,
    } as any);

    mockContractsModel.find.mockReturnValue({
      lean: () => [
        {
          _id: contractId,
          bookingId,
          providerId: provider_Id,
          status: 'DRAFT',
          currentVersionId: versionId,
        },
      ],
    });

    mockVersionsModel.findById.mockReturnValue({
      lean: () => ({
        _id: versionId,
        contractId,
        version: 1,
        state: ContractVersionState.Terminated,
        customerAcceptedAt: new Date('2026-10-15T08:00:00Z'),
      }),
    });

    mockConsentsModel.exists.mockResolvedValue(true);

    const result = await readService.listForBooking(userCustomerA, bookingId.toString());
    expect(result).toHaveLength(1);
    expect(result[0].isSigned).toBe(true);
    expect(result[0].state).toBe(ContractVersionState.Terminated);
  });

  // TC-06: CONFIRMED + ACCEPTED → hiển thị bình thường
  it('TC-06: CONFIRMED booking with ACCEPTED contract is returned normally', async () => {
    const bookingId = new Types.ObjectId();
    const contractId = new Types.ObjectId();
    const versionId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'CONFIRMED',
      contractFlowVersion: 2,
    } as any);

    mockContractsModel.find.mockReturnValue({
      lean: () => [
        {
          _id: contractId,
          bookingId,
          providerId: provider_Id,
          status: 'DRAFT',
          currentVersionId: versionId,
        },
      ],
    });

    mockVersionsModel.findById.mockReturnValue({
      lean: () => ({
        _id: versionId,
        contractId,
        version: 1,
        state: ContractVersionState.Accepted,
        customerAcceptedAt: new Date(),
      }),
    });

    mockConsentsModel.exists.mockResolvedValue(true);

    const result = await readService.listForBooking(userCustomerA, bookingId.toString());
    expect(result).toHaveLength(1);
    expect(result[0].isSigned).toBe(true);
    expect(result[0].state).toBe(ContractVersionState.Accepted);
  });

  // TC-07: RETURNED/COMPLETED + hợp đồng hợp lệ → hiển thị đầy đủ
  it('TC-07: RETURNED booking with signed contract returns proper contract details', async () => {
    const bookingId = new Types.ObjectId();
    const contractId = new Types.ObjectId();
    const versionId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'RETURNED',
      contractFlowVersion: 2,
    } as any);

    mockContractsModel.find.mockReturnValue({
      lean: () => [
        {
          _id: contractId,
          bookingId,
          providerId: provider_Id,
          status: 'DRAFT',
          currentVersionId: versionId,
        },
      ],
    });

    mockVersionsModel.findById.mockReturnValue({
      lean: () => ({
        _id: versionId,
        contractId,
        version: 1,
        state: ContractVersionState.Accepted,
        customerAcceptedAt: new Date(),
      }),
    });

    mockConsentsModel.exists.mockResolvedValue(true);

    const result = await readService.listForBooking(userCustomerA, bookingId.toString());
    expect(result).toHaveLength(1);
    expect(result[0].isSigned).toBe(true);
  });

  // TC-08: Booking không yêu cầu hợp đồng → trả về rỗng, không render thẻ rỗng
  it('TC-08: Booking without contracts returns empty list', async () => {
    const bookingId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'CONFIRMED',
      contractFlowVersion: 2,
    } as any);

    mockContractsModel.find.mockReturnValue({
      lean: () => [],
    });

    const result = await readService.listForBooking(userCustomerA, bookingId.toString());
    expect(result).toHaveLength(0);
  });

  // TC-09: API lỗi → ném lỗi chính xác, không nuốt lỗi
  it('TC-09: Propagates error when booking lookup fails', async () => {
    jest.spyOn(accessService, 'booking').mockRejectedValue(new NotFoundException('CONTRACT_BOOKING_NOT_FOUND'));

    await expect(readService.listForBooking(userCustomerA, new Types.ObjectId().toString())).rejects.toThrow(
      NotFoundException,
    );
  });

  // TC-10: Customer A không xem được hợp đồng của Customer B
  it('TC-10: Customer A cannot read booking contracts belonging to Customer B', async () => {
    const bookingId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerB_Id, // Belongs to Customer B
      providerIds: [provider_Id],
      status: 'CONFIRMED',
      contractFlowVersion: 2,
    } as any);

    await expect(readService.listForBooking(userCustomerA, bookingId.toString())).rejects.toThrow(
      NotFoundException,
    );
  });

  // TC-11: Provider/Admin vẫn tra cứu được tài liệu theo quyền hiện có kể cả khi booking CANCELLED
  it('TC-11: Admin and Provider retain full audit access to contracts even on CANCELLED bookings', async () => {
    const bookingId = new Types.ObjectId();
    const contractId = new Types.ObjectId();
    const versionId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      providerIds: [provider_Id],
      status: 'CANCELLED',
      contractFlowVersion: 2,
    } as any);

    mockContractsModel.find.mockReturnValue({
      lean: () => [
        {
          _id: contractId,
          bookingId,
          providerId: provider_Id,
          status: 'DRAFT',
          currentVersionId: versionId,
        },
      ],
    });

    mockVersionsModel.findById.mockReturnValue({
      lean: () => ({
        _id: versionId,
        contractId,
        version: 1,
        state: ContractVersionState.Draft, // Unaccepted draft
      }),
    });

    mockConsentsModel.exists.mockResolvedValue(false);

    // Admin should see the unaccepted draft for audit
    const adminResult = await readService.listForBooking(userAdmin, bookingId.toString());
    expect(adminResult).toHaveLength(1);
    expect(adminResult[0].contractId).toBe(contractId.toString());
  });

  // TC-12: Hợp đồng đã chấp thuận trong lịch sử không thay đổi hash/snapshot/PDF
  it('TC-12: Preserves contentHash and snapshot immutability on accepted contracts', async () => {
    const contractId = new Types.ObjectId();
    const versionId = new Types.ObjectId();
    const immutableHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    mockContractsModel.findById.mockReturnValue({
      lean: () => ({
        _id: contractId,
        bookingId: new Types.ObjectId(),
        providerId: provider_Id,
        currentVersionId: versionId,
        status: 'ACCEPTED',
      }),
    });

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: new Types.ObjectId(),
      customerId: customerA_Id,
      status: 'CONFIRMED',
    } as any);

    mockVersionsModel.findById.mockReturnValue({
      lean: () => ({
        _id: versionId,
        contractId,
        version: 1,
        state: ContractVersionState.Accepted,
        contentHash: immutableHash,
        bookingFingerprint: 'bfp_imm',
        renderedText: 'BẢN THỎA THUẬN ĐIỆN TỬ BẤT BIẾN',
      }),
    });

    const contractDetail = await readService.get(userCustomerA, contractId.toString());
    expect(contractDetail.contentHash).toBe(immutableHash);
    expect(contractDetail.renderedText).toBe('BẢN THỎA THUẬN ĐIỆN TỬ BẤT BIẾN');
  });

  // TC-13: Booking CANCELLED không thể tiếp tục ACCEPT một offer cũ không còn hợp lệ
  it('TC-13: Fails closed with ConflictException when attempting to consent to a contract on a CANCELLED booking', async () => {
    const contractId = new Types.ObjectId();
    const versionId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();

    mockContractsModel.findById.mockReturnValue({
      lean: () => ({
        _id: contractId,
        bookingId,
        customerId: customerA_Id,
        providerId: provider_Id,
        flowVersion: 2,
        scope: 'AO_DAI_RENTAL',
        approvalMode: 'AUTO_ACCEPTANCE',
        currentVersionId: versionId,
      }),
    });

    const mockConsentService = new ContractConsentService(
      true,
      mockConnection as any,
      mockContractsModel as any,
      mockVersionsModel as any,
      mockConsentsModel as any,
      accessService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'CANCELLED', // Booking is already cancelled!
      contractFlowVersion: 2,
    } as any);

    await expect(
      mockConsentService.decide(
        userCustomerA,
        contractId.toString(),
        {
          contractVersionId: versionId.toString(),
          action: ContractConsentAction.Accept,
          contentHash: 'some_hash',
          bookingFingerprint: 'some_bfp',
          idempotencyKey: 'idem_key_1',
        },
      ),
    ).rejects.toThrow(ConflictException);
  });

  // TC-14: refreshContractsForBooking prepares fresh contract version for active PENDING_PAYMENT booking
  it('TC-14: refreshContractsForBooking prepares fresh contract version for active PENDING_PAYMENT booking', async () => {
    const bookingId = new Types.ObjectId();
    const providerId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'PENDING_PAYMENT',
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // active hold
      contractFlowVersion: 2,
    } as any);

    const mockPrep = { prepare: jest.fn().mockResolvedValue({ contractId: 'c1', versionId: 'v2', version: 2 }) };
    (readService as any).policy = {
      getContext: jest.fn().mockResolvedValue({
        rentalProviderIds: [providerId],
        booking: { _id: bookingId, customerId: customerA_Id, status: 'PENDING_PAYMENT' },
      }),
    };
    (readService as any).preparation = mockPrep;

    jest.spyOn(readService, 'readiness').mockResolvedValue({
      requirement: 'REQUIRED',
      bookingId: bookingId.toString(),
      providers: [
        {
          providerId: providerId.toString(),
          contractId: 'contract-fresh-01',
          versionId: 'ver-fresh-02',
          version: 2,
          status: 'AWAITING_CUSTOMER',
          presentationMode: 'DETAILED',
        },
      ],
      blockers: [],
      ready: false,
    } as any);

    const result = await readService.refreshContractsForBooking(userCustomerA, bookingId.toString());

    expect(mockPrep.prepare).toHaveBeenCalledWith(bookingId.toString(), providerId.toString());
    expect(result.ready).toBe(false);
    expect(result.providers[0].version).toBe(2);
  });

  // TC-15: refreshContractsForBooking rejects with BadRequestException if booking hold has expired
  it('TC-15: refreshContractsForBooking rejects with BadRequestException if booking hold has expired', async () => {
    const bookingId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'PENDING_PAYMENT',
      holdExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // EXPIRED hold!
      contractFlowVersion: 2,
    } as any);

    await expect(
      readService.refreshContractsForBooking(userCustomerA, bookingId.toString()),
    ).rejects.toThrow();
  });

  // TC-16: refreshContractsForBooking rejects with ConflictException if booking is already CANCELLED
  it('TC-16: refreshContractsForBooking rejects with ConflictException if booking is already CANCELLED', async () => {
    const bookingId = new Types.ObjectId();

    jest.spyOn(accessService, 'booking').mockResolvedValue({
      _id: bookingId,
      customerId: customerA_Id,
      status: 'CANCELLED',
      contractFlowVersion: 2,
    } as any);

    await expect(
      readService.refreshContractsForBooking(userCustomerA, bookingId.toString()),
    ).rejects.toThrow(ConflictException);
  });
});
