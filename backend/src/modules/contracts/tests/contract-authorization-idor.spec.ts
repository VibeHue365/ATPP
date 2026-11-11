import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContractAccessService } from '../contract-access.service';
import { ContractReadService } from '../contract-read.service';
import { ContractEvidenceService } from '../contract-evidence.service';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ContractDocumentStatus } from '../schemas/contract-version.schema';

describe('Phase 7B.1: Backend Authorization — IDOR & Cross-Provider Isolation Suite', () => {
  const customerA_Id = new Types.ObjectId();
  const customerB_Id = new Types.ObjectId();

  const providerA_UserId = new Types.ObjectId();
  const providerA_Id = new Types.ObjectId();

  const providerB_UserId = new Types.ObjectId();
  const providerB_Id = new Types.ObjectId();

  const adminUserId = new Types.ObjectId();

  const bookingMultiProviderId = new Types.ObjectId();
  const bookingCustomerBId = new Types.ObjectId();

  const contractA_Id = new Types.ObjectId();
  const versionA_Id = new Types.ObjectId();

  const contractB_Id = new Types.ObjectId();
  const versionB_Id = new Types.ObjectId();

  const userCustomerA: AuthUser = {
    sub: customerA_Id.toString(),
    roles: ['CUSTOMER'],
    permissions: [],
    email: 'customera@example.invalid',
  };

  const userCustomerB: AuthUser = {
    sub: customerB_Id.toString(),
    roles: ['CUSTOMER'],
    permissions: [],
    email: 'customerb@example.invalid',
  };

  const userProviderA: AuthUser = {
    sub: providerA_UserId.toString(),
    roles: ['PROVIDER'],
    permissions: [],
    email: 'providera@example.invalid',
  };

  const userProviderB: AuthUser = {
    sub: providerB_UserId.toString(),
    roles: ['PROVIDER'],
    permissions: [],
    email: 'providerb@example.invalid',
  };

  const userAdminValid: AuthUser = {
    sub: adminUserId.toString(),
    roles: ['ADMIN'],
    permissions: ['user:read', 'provider:read'],
    email: 'admin@example.invalid',
  };

  const userAdminUnderprivileged: AuthUser = {
    sub: adminUserId.toString(),
    roles: ['ADMIN'],
    permissions: ['user:read'], // Missing provider:read
    email: 'underprivileged_admin@example.invalid',
  };

  const bookingMulti = {
    _id: bookingMultiProviderId,
    customerId: customerA_Id,
    providerIds: [providerA_Id, providerB_Id],
    bookingType: 'AODAI_RENTAL',
    status: 'PAID',
    contractFlowVersion: 2,
  };

  const bookingCustomerB = {
    _id: bookingCustomerBId,
    customerId: customerB_Id,
    providerIds: [providerA_Id],
    bookingType: 'AODAI_RENTAL',
    status: 'PAID',
    contractFlowVersion: 2,
  };

  const contractA = {
    _id: contractA_Id,
    bookingId: bookingMultiProviderId,
    providerId: providerA_Id,
    customerId: customerA_Id,
    contractCode: 'HD-PROV-A',
    currentVersionId: versionA_Id,
    status: 'ACCEPTED',
  };

  const contractB = {
    _id: contractB_Id,
    bookingId: bookingMultiProviderId,
    providerId: providerB_Id,
    customerId: customerA_Id,
    contractCode: 'HD-PROV-B',
    currentVersionId: versionB_Id,
    status: 'ACCEPTED',
  };

  const versionA = {
    _id: versionA_Id,
    contractId: contractA_Id,
    version: 1,
    state: 'ACCEPTED',
    contentHash: 'content_hash_a',
    bookingFingerprint: 'bfp_a',
    renderedText: 'HỢP ĐỒNG ÁO DÀI ĐỐI TÁC A',
    document: {
      status: ContractDocumentStatus.Ready,
      bucket: 'contracts',
      storageKey: 'pdf_a.pdf',
      sha256: 'sha256_pdf_a',
    },
  };

  const versionB = {
    _id: versionB_Id,
    contractId: contractB_Id,
    version: 1,
    state: 'ACCEPTED',
    contentHash: 'content_hash_b',
    bookingFingerprint: 'bfp_b',
    renderedText: 'HỢP ĐỒNG ÁO DÀI ĐỐI TÁC B',
    document: {
      status: ContractDocumentStatus.Ready,
      bucket: 'contracts',
      storageKey: 'pdf_b.pdf',
      sha256: 'sha256_pdf_b',
    },
  };

  let mockConnection: any;
  let accessService: ContractAccessService;
  let mockContractsModel: any;
  let mockVersionsModel: any;
  let mockConsentsModel: any;
  let readService: ContractReadService;
  let mockStorage: any;
  let evidenceService: ContractEvidenceService;

  beforeEach(() => {
    // Mock DB collection calls for ContractAccessService
    mockConnection = {
      db: {
        collection: (name: string) => ({
          findOne: async (query: any) => {
            if (name === 'bookings') {
              if (query._id?.toString() === bookingMultiProviderId.toString()) {
                return bookingMulti;
              }
              if (query._id?.toString() === bookingCustomerBId.toString()) {
                return bookingCustomerB;
              }
              return null;
            }
            if (name === 'providers') {
              if (query.userId?.toString() === providerA_UserId.toString()) {
                if (query._id?.$in?.some((id: any) => id.toString() === providerA_Id.toString())) {
                  return { _id: providerA_Id, userId: providerA_UserId };
                }
              }
              if (query.userId?.toString() === providerB_UserId.toString()) {
                if (query._id?.$in?.some((id: any) => id.toString() === providerB_Id.toString())) {
                  return { _id: providerB_Id, userId: providerB_UserId };
                }
              }
              return null;
            }
            return null;
          },
        }),
      },
    };

    accessService = new ContractAccessService(mockConnection as any);

    // Mock Models for ReadService
    mockContractsModel = {
      find: (filter: any) => ({
        lean: async () => {
          const list = [contractA, contractB];
          return list.filter((c) => {
            if (filter.bookingId && c.bookingId.toString() !== filter.bookingId.toString()) return false;
            if (filter.providerId && c.providerId.toString() !== filter.providerId.toString()) return false;
            return true;
          });
        },
      }),
      findById: (id: any) => ({
        lean: async () => {
          if (id?.toString() === contractA_Id.toString()) return contractA;
          if (id?.toString() === contractB_Id.toString()) return contractB;
          return null;
        },
      }),
    };

    mockVersionsModel = {
      findById: (id: any) => ({
        lean: async () => {
          if (id?.toString() === versionA_Id.toString()) return versionA;
          if (id?.toString() === versionB_Id.toString()) return versionB;
          return null;
        },
      }),
    };

    mockConsentsModel = {
      findOne: () => ({
        lean: async () => null,
      }),
    };

    readService = new ContractReadService(
      true,
      mockContractsModel,
      mockVersionsModel,
      mockConsentsModel,
      accessService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    mockStorage = {
      readPrivateFile: jest.fn().mockResolvedValue('stream_data'),
    };

    evidenceService = new ContractEvidenceService(
      mockContractsModel,
      mockVersionsModel,
      mockConsentsModel,
      mockStorage,
      accessService,
    );
  });

  describe('1. Customer IDOR Protection', () => {
    it('Customer A can view their own contract details in multi-provider booking', async () => {
      const contractDetails = await readService.get(userCustomerA, contractA_Id.toString());
      expect(contractDetails).toBeDefined();
      expect(contractDetails.contractId).toBe(contractA_Id.toString());
      expect(contractDetails.renderedText).toContain('HỢP ĐỒNG ÁO DÀI ĐỐI TÁC A');
    });

    it('Customer A CANNOT view contracts of Customer B (throws 404 CONTRACT_NOT_FOUND)', async () => {
      // Create a contract belonging to Customer B
      mockContractsModel.findById = (id: any) => ({
        lean: async () => ({
          _id: id,
          bookingId: bookingCustomerBId,
          providerId: providerA_Id,
          customerId: customerB_Id,
          contractCode: 'HD-CUST-B',
          currentVersionId: versionA_Id,
        }),
      });

      await expect(readService.get(userCustomerA, contractA_Id.toString())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Customer A cannot list contracts for Customer B booking', async () => {
      await expect(
        readService.listForBooking(userCustomerA, bookingCustomerBId.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Cross-Provider Isolation in Multi-Provider Bookings', () => {
    it('Provider A only sees their own contract in listForBooking for multi-provider booking', async () => {
      const contracts = await readService.listForBooking(
        userProviderA,
        bookingMultiProviderId.toString(),
      );
      expect(contracts).toHaveLength(1);
      expect(contracts[0].contractId).toBe(contractA_Id.toString());
      expect(contracts[0].providerId).toBe(providerA_Id.toString());
    });

    it('Provider B only sees their own contract in listForBooking for multi-provider booking', async () => {
      const contracts = await readService.listForBooking(
        userProviderB,
        bookingMultiProviderId.toString(),
      );
      expect(contracts).toHaveLength(1);
      expect(contracts[0].contractId).toBe(contractB_Id.toString());
      expect(contracts[0].providerId).toBe(providerB_Id.toString());
    });

    it('Customer A sees ALL contracts in the multi-provider booking', async () => {
      const contracts = await readService.listForBooking(
        userCustomerA,
        bookingMultiProviderId.toString(),
      );
      expect(contracts).toHaveLength(2);
      const provIds = contracts.map((c) => c.providerId);
      expect(provIds).toContain(providerA_Id.toString());
      expect(provIds).toContain(providerB_Id.toString());
    });

    it('Provider A CANNOT access details of Provider B contract (IDOR cross-provider defense)', async () => {
      // Provider A tries to access Provider B's contract directly
      await expect(readService.get(userProviderA, contractB_Id.toString())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Provider A CANNOT access evidence metadata of Provider B contract', async () => {
      await expect(
        evidenceService.getEvidence(userProviderA, contractB_Id.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('Provider A CANNOT access PDF stream of Provider B contract', async () => {
      await expect(
        evidenceService.getPdfStream(userProviderA, contractB_Id.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('3. Admin Privilege Scoping & Fail-Closed Behavior', () => {
    it('Fully privileged Admin (user:read & provider:read) can read contract', async () => {
      const contractDetails = await readService.get(userAdminValid, contractA_Id.toString());
      expect(contractDetails).toBeDefined();
      expect(contractDetails.contractId).toBe(contractA_Id.toString());
    });

    it('Underprivileged Admin (missing provider:read) is rejected with NotFoundException', async () => {
      await expect(
        readService.get(userAdminUnderprivileged, contractA_Id.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Document Readiness & Download Guards', () => {
    it('Throws 422 CONTRACT_PDF_NOT_READY when document is not ready and generation fails', async () => {
      // Mock version where document is pending/failed
      const pendingVersion = {
        _id: versionA_Id,
        contractId: contractA_Id,
        version: 1,
        state: 'ACCEPTED',
        contentHash: 'content_hash_a',
        document: {
          status: ContractDocumentStatus.Generating,
          bucket: null,
          storageKey: null,
        },
      };

      mockVersionsModel.findById = () => ({
        ...pendingVersion,
        lean: async () => pendingVersion,
      });

      // Override generateAndStorePdf to not alter status (simulate worker delay)
      evidenceService.generateAndStorePdf = jest.fn().mockResolvedValue(undefined);

      await expect(
        evidenceService.getPdfStream(userCustomerA, contractA_Id.toString()),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('Returns valid stream, filename, and SHA-256 when document is READY', async () => {
      mockVersionsModel.findById = (id: any) => ({
        lean: async () => versionA,
        // for findById non-lean calls
        _id: versionA._id,
        contractId: versionA.contractId,
        document: versionA.document,
        version: versionA.version,
        contentHash: versionA.contentHash,
      });

      const result = await evidenceService.getPdfStream(userCustomerA, contractA_Id.toString());
      expect(result.filename).toBe('HD-PROV-A-v1.pdf');
      expect(result.sha256).toBe('sha256_pdf_a');
      expect(result.contentHash).toBe('content_hash_a');
    });
  });

  describe('Requirement 1: Authorization for refreshContractsForBooking', () => {
    let mockPrep: any;
    let mockPolicy: any;
    const bookingMultiPending = {
      ...bookingMulti,
      status: 'PENDING_PAYMENT',
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    beforeEach(() => {
      mockPrep = {
        prepare: jest.fn().mockResolvedValue({
          contractId: contractA_Id.toString(),
          versionId: versionA_Id.toString(),
          version: 2,
          reused: false,
        }),
      };
      mockPolicy = {
        getContext: jest.fn().mockResolvedValue({
          booking: bookingMultiPending,
          rentalProviderIds: [providerA_Id, providerB_Id],
        }),
      };
      (readService as any).preparation = mockPrep;
      (readService as any).policy = mockPolicy;
      jest.spyOn(readService, 'readiness').mockResolvedValue({
        requirement: 'REQUIRED',
        bookingId: bookingMultiProviderId.toString(),
        providers: [],
        blockers: [],
        ready: false,
      } as any);
    });

    it('Allows customer owner to refresh contracts and invokes prepare()', async () => {
      jest.spyOn(accessService, 'booking').mockResolvedValue(bookingMultiPending as any);

      const res = await readService.refreshContractsForBooking(
        userCustomerA,
        bookingMultiProviderId.toString(),
      );
      expect(mockPrep.prepare).toHaveBeenCalledTimes(2); // for both providerA and providerB
      expect(res).toBeDefined();
    });

    it('Blocks another customer (IDOR) with NotFoundException, without calling prepare()', async () => {
      jest.spyOn(accessService, 'booking').mockResolvedValue(bookingMultiPending as any);

      await expect(
        readService.refreshContractsForBooking(
          userCustomerB,
          bookingMultiProviderId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrep.prepare).not.toHaveBeenCalled();
    });

    it('Blocks Admin with NotFoundException, without calling prepare()', async () => {
      jest.spyOn(accessService, 'booking').mockResolvedValue(bookingMultiPending as any);

      await expect(
        readService.refreshContractsForBooking(
          userAdminValid,
          bookingMultiProviderId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrep.prepare).not.toHaveBeenCalled();
    });

    it('Blocks Provider A belonging to the multi-shop booking with NotFoundException, without calling prepare()', async () => {
      jest.spyOn(accessService, 'booking').mockResolvedValue(bookingMultiPending as any);

      await expect(
        readService.refreshContractsForBooking(
          userProviderA,
          bookingMultiProviderId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrep.prepare).not.toHaveBeenCalled();
    });

    it('Blocks Provider B belonging to the multi-shop booking with NotFoundException, without calling prepare()', async () => {
      jest.spyOn(accessService, 'booking').mockResolvedValue(bookingMultiPending as any);

      await expect(
        readService.refreshContractsForBooking(
          userProviderB,
          bookingMultiProviderId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrep.prepare).not.toHaveBeenCalled();
    });
  });
});
