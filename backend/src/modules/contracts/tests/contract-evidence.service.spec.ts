import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { Types } from 'mongoose';
import { ContractEvidenceService } from '../contract-evidence.service';
import { ContractDocumentStatus, ContractVersionState } from '../schemas/contract-version.schema';
import { ContractConsentAction } from '../schemas/contract-consent.schema';

describe('ContractEvidenceService Unit Tests', () => {
  let service: ContractEvidenceService;

  let mockContracts: any;
  let mockVersions: any;
  let mockConsents: any;
  let mockStorage: any;
  let mockAccess: any;

  const contractId = new Types.ObjectId();
  const versionId = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();

  const sampleSnapshot = {
    bookingId: bookingId.toString(),
    customerId: customerId.toString(),
    providerId: providerId.toString(),
    bookingType: 'AODAI_RENTAL',
    bookingItemIds: ['item-1'],
    booking: { bookingCode: 'VH-1234' },
    customer: { fullName: 'Tran Thi B', email: 'b@example.com' },
    provider: { businessName: 'Ao Dai Hue Xua', address: 'Hue' },
    providerItems: [
      {
        productName: 'Ao Dai Nhat Binh',
        size: 'M',
        quantity: 1,
        rentalFrom: '2026-11-10T08:00:00.000Z',
        rentalTo: '2026-11-12T18:00:00.000Z',
        rentalPrice: 600000,
        depositAmount: 1200000,
      },
    ],
    pricing: { rentalTotal: 600000, depositTotal: 1200000, grandTotal: 1800000 },
    policies: { cancellationPolicy: 'standard' },
    template: { version: 'ao-dai-rental-v1' },
  };

  const sampleContract = {
    _id: contractId,
    bookingId,
    providerId,
    customerId,
    contractCode: 'DC-2026-0099',
    currentVersionId: versionId,
  };

  const sampleVersion = {
    _id: versionId,
    contractId,
    version: 1,
    contentHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    bookingFingerprint: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    renderedText: 'Dieu 1: Thue ao dai Nhat Binh dung thoi gian.\nDieu 2: Hoan tra ao dai sach se.',
    snapshot: sampleSnapshot,
    state: ContractVersionState.Accepted,
    document: {
      status: ContractDocumentStatus.Pending,
      retryCount: 0,
    },
  };

  const sampleConsent = {
    contractId,
    contractVersionId: versionId,
    actorUserId: customerId,
    action: ContractConsentAction.Accept,
    authenticationMethod: 'APP_SESSION',
    contentHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    occurredAt: new Date('2026-10-28T12:00:00.000Z'),
  };

  beforeEach(() => {
    mockContracts = {
      findById: jest.fn().mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue({ ...sampleContract }),
        ...sampleContract,
      })),
    };

    mockVersions = {
      findById: jest.fn().mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue({ ...sampleVersion }),
        ...sampleVersion,
      })),
      findOneAndUpdate: jest.fn().mockImplementation((query, update) => {
        return { ...sampleVersion, document: { ...sampleVersion.document, ...(update.$set?.document || {}) } };
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      find: jest.fn().mockImplementation(() => ({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      })),
    };

    mockConsents = {
      findOne: jest.fn().mockImplementation(() => ({
        lean: jest.fn().mockResolvedValue({ ...sampleConsent }),
        ...sampleConsent,
      })),
    };

    const storageFiles = new Map<string, Buffer>();
    mockStorage = {
      uploadPrivateFile: jest.fn().mockImplementation(async (bucket, key, buf) => {
        storageFiles.set(`${bucket}:${key}`, buf);
        return { storageProvider: 'gridfs', bucket, storageKey: key };
      }),
      readPrivateFile: jest.fn().mockImplementation(async (bucket, key) => {
        const buf = storageFiles.get(`${bucket}:${key}`) || Buffer.from('%PDF-1.4 mock content %%EOF');
        return Readable.from(buf);
      }),
      exists: jest.fn().mockImplementation(async (bucket, key) => storageFiles.has(`${bucket}:${key}`)),
      deletePrivateFile: jest.fn().mockResolvedValue(undefined),
    };

    mockAccess = {
      booking: jest.fn().mockResolvedValue({ _id: bookingId, customerId, providerIds: [providerId] }),
      assertContractReader: jest.fn().mockResolvedValue({ kind: 'CUSTOMER' }),
    };

    service = new ContractEvidenceService(
      mockContracts,
      mockVersions,
      mockConsents,
      mockStorage,
      mockAccess,
    );
  });

  it('1. Generates and stores immutable PDF document with SHA-256 metadata', async () => {
    const doc = await service.generateAndStorePdf(versionId);

    expect(doc.status).toBe(ContractDocumentStatus.Ready);
    expect(doc.storageProvider).toBe('gridfs');
    expect(doc.bucket).toBe('contracts');
    expect(doc.storageKey).toContain(versionId.toString());
    expect(doc.sha256).toMatch(/^[a-f0-9]{64}$/);

    expect(mockStorage.uploadPrivateFile).toHaveBeenCalledWith(
      'contracts',
      expect.stringContaining(`${versionId.toString()}/${sampleVersion.contentHash}.pdf`),
      expect.any(Buffer),
      'application/pdf',
    );

    expect(mockVersions.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: versionId }),
      expect.objectContaining({
        $set: expect.objectContaining({
          document: expect.objectContaining({
            status: ContractDocumentStatus.Ready,
            sha256: expect.any(String),
          }),
        }),
      }),
      expect.anything(),
    );
  });

  it('2. Idempotency: Returns existing document if already READY and stored in storage', async () => {
    // Simulate already generated document
    mockStorage.exists.mockResolvedValueOnce(true);
    mockVersions.findById.mockResolvedValueOnce({
      ...sampleVersion,
      document: {
        status: ContractDocumentStatus.Ready,
        bucket: 'contracts',
        storageKey: `contracts/${contractId}/${versionId}/test.pdf`,
        sha256: 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
        generatedAt: new Date(),
        retryCount: 0,
      },
    });

    const doc = await service.generateAndStorePdf(versionId);
    expect(doc.status).toBe(ContractDocumentStatus.Ready);
    expect(mockStorage.uploadPrivateFile).not.toHaveBeenCalled();
  });

  it('3. Error Handling: Records FAILED state and error message without breaking caller transaction', async () => {
    mockStorage.uploadPrivateFile.mockRejectedValueOnce(new Error('STORAGE_TIMEOUT'));

    await expect(service.generateAndStorePdf(versionId)).rejects.toThrow('STORAGE_TIMEOUT');

    expect(mockVersions.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: versionId }),
      {
        $set: {
          document: expect.objectContaining({
            status: ContractDocumentStatus.Failed,
            lastError: 'STORAGE_TIMEOUT',
            retryCount: 1,
          }),
        },
      },
    );
  });

  it('4. Access Control: Throws NotFoundException if user is not authorized to read the contract PDF', async () => {
    const unauthorizedUser = { sub: '64b0f0000000000000000999', roles: ['CUSTOMER'], permissions: [] };
    mockAccess.assertContractReader.mockRejectedValueOnce(new NotFoundException('CONTRACT_NOT_FOUND'));

    await expect(
      service.getPdfStream(unauthorizedUser as any, contractId.toString()),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Integrity Verification: Verifies stored PDF content matches stored SHA-256 hash', async () => {
    // Generate first
    const generated = await service.generateAndStorePdf(versionId);

    // Mock findById for verifyIntegrity
    mockVersions.findById.mockImplementation(() => ({
      lean: jest.fn().mockResolvedValue({
        ...sampleVersion,
        document: generated,
      }),
    }));

    const result = await service.verifyIntegrity(versionId);
    expect(result.valid).toBe(true);
    expect(result.storedSha256).toBe(generated.sha256);
    expect(result.actualSha256).toBe(generated.sha256);
  });

  it('6. Durable PDF Recovery: Recovers FAILED document with exponential backoff', async () => {
    const failedDoc = {
      ...sampleVersion,
      _id: versionId,
      document: {
        status: ContractDocumentStatus.Failed,
        retryCount: 1,
        generatedAt: new Date(Date.now() - 60_000), // 60s ago > 10s delay
      },
    };

    mockVersions.find.mockReturnValueOnce({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([failedDoc]),
      }),
    });

    const res = await service.recoverFailedPdfs();
    expect(res.scanned).toBe(1);
    expect(res.recovered).toBe(1);
    expect(res.failed).toBe(0);
  });
});
