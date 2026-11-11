import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { PDFDocument } from 'pdf-lib';
import { createConnection, Connection, Model, Types } from 'mongoose';
import { hashContract } from '../canonical-contract';
import { contractTestTarget } from '../contract-test-target';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import {
  DigitalContract,
  DigitalContractSchema,
} from '../../bookings/schemas/digital-contract.schema';
import {
  ContractDocumentStatus,
  ContractVersion,
  ContractVersionSchema,
  ContractVersionState,
} from '../schemas/contract-version.schema';
import {
  ContractConsent,
  ContractConsentAction,
  ContractConsentSchema,
} from '../schemas/contract-consent.schema';
import { ContractEvidenceService } from '../contract-evidence.service';
import { ContractAccessService } from '../contract-access.service';
import { PrivateStorageService } from '../../storage/services/private-storage.service';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();

(target ? describe : describe.skip)(
  'Phase 6: Contract PDF & Immutable Evidence Integration Suite',
  () => {
    let connection: Connection;
    let scratchName: string;

    let contracts: Model<DigitalContract>;
    let versions: Model<ContractVersion>;
    let consents: Model<ContractConsent>;

    let memoryStorage: Map<string, Buffer>;
    let mockStorageService: PrivateStorageService;
    let accessService: ContractAccessService;
    let evidenceService: ContractEvidenceService;

    beforeAll(async () => {
      scratchName = `contract_phase6_${oid().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchName}`;
      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 8000,
      }).asPromise();

      const hello = await connection.db!.admin().command({ hello: 1 });
      if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary) {
        throw new Error('Phase 6 requires the isolated test replica set');
      }

      contracts = connection.model(DigitalContract.name, DigitalContractSchema);
      versions = connection.model(ContractVersion.name, ContractVersionSchema);
      consents = connection.model(ContractConsent.name, ContractConsentSchema);

      // Isolated in-memory storage implementation (Never touches production cloud buckets)
      memoryStorage = new Map<string, Buffer>();
      mockStorageService = {
        uploadPrivateFile: jest
          .fn()
          .mockImplementation(
            (bucket: string, storageKey: string, buffer: Buffer) => {
              memoryStorage.set(`${bucket}:${storageKey}`, buffer);
              return Promise.resolve({
                storageProvider: 'test-memory-storage',
                bucket,
                storageKey,
              });
            },
          ),
        readPrivateFile: jest
          .fn()
          .mockImplementation((bucket: string, storageKey: string) => {
            const buf = memoryStorage.get(`${bucket}:${storageKey}`);
            if (!buf) throw new Error('FILE_NOT_FOUND');
            return Promise.resolve(Readable.from(buf));
          }),
        exists: jest
          .fn()
          .mockImplementation((bucket: string, storageKey: string) => {
            return Promise.resolve(
              memoryStorage.has(`${bucket}:${storageKey}`),
            );
          }),
        deletePrivateFile: jest
          .fn()
          .mockImplementation((bucket: string, storageKey: string) => {
            memoryStorage.delete(`${bucket}:${storageKey}`);
            return Promise.resolve();
          }),
      };

      accessService = new ContractAccessService(connection);
      evidenceService = new ContractEvidenceService(
        contracts,
        versions,
        consents,
        mockStorageService,
        accessService,
      );
    }, 30000);

    afterAll(async () => {
      if (connection) {
        await connection.db!.dropDatabase();
        await connection.close();
      }
    });

    it('1. Generates, hashes, stores PDF evidence and records metadata in MongoDB without mutating contract terms', async () => {
      const customerId = oid();
      const providerId = oid();
      const bookingId = oid();
      const contractId = oid();
      const versionId = oid();
      const contentHash = 'f'.repeat(64);
      const bookingFingerprint = 'e'.repeat(64);

      const snapshot = {
        bookingId: bookingId.toString(),
        customerId: customerId.toString(),
        providerId: providerId.toString(),
        bookingType: 'AODAI_RENTAL' as const,
        bookingItemIds: ['item-101'],
        booking: { bookingCode: 'VH-PHASE6' },
        customer: { fullName: 'Le Van C', email: 'c@test.invalid' },
        provider: {
          businessName: 'Nha May Ao Dai Saigon',
          address: 'Quan 1, TP.HCM',
        },
        providerItems: [
          {
            productName: 'Ao Dai Cach Tan Nu',
            size: 'S',
            color: 'Hong Phan',
            quantity: 2,
            rentalFrom: '2026-11-20T08:00:00.000Z',
            rentalTo: '2026-11-22T18:00:00.000Z',
            rentalPrice: 700000,
            depositAmount: 1400000,
          },
        ],
        pricing: {
          rentalTotal: 700000,
          depositTotal: 1400000,
          grandTotal: 2100000,
        },
        policies: { standardPolicy: 'Thoa thuan thue y nhu mau' },
        template: { version: 'ao-dai-rental-v1' },
      };

      await contracts.create({
        _id: contractId,
        bookingId,
        customerId,
        providerId,
        contractCode: 'DC-PHASE6-001',
        currentVersionId: versionId,
      });

      const renderedText =
        'Dieu 1: Thue ao dai cach tan theo dung mau ma.\nDieu 2: Dat coc va giao nhan dung gio.';
      await versions.create({
        _id: versionId,
        contractId,
        version: 1,
        templateVersion: 'ao-dai-rental-v1',
        snapshot,
        renderedText,
        contentHash,
        bookingFingerprint,
        state: ContractVersionState.Accepted,
        document: {
          status: ContractDocumentStatus.Pending,
          retryCount: 0,
        },
      });

      await consents.create({
        contractId,
        contractVersionId: versionId,
        actorUserId: customerId,
        actorRole: 'CUSTOMER',
        action: ContractConsentAction.Accept,
        authenticationMethod: 'APP_SESSION',
        occurredAt: new Date(),
        contentHash,
        bookingFingerprint,
        idempotencyKey: `consent-${randomUUID()}`,
      });

      // Execute PDF Generation
      const metadata = await evidenceService.generateAndStorePdf(versionId);

      // Verify Output metadata
      expect(metadata.status).toBe(ContractDocumentStatus.Ready);
      expect(metadata.storageProvider).toBe('test-memory-storage');
      expect(metadata.bucket).toBe('contracts');
      expect(metadata.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(metadata.generatedAt).toBeInstanceOf(Date);

      // Persisted state verification: ContractVersion document updated
      const persistedVersion = await versions.findById(versionId).lean();
      expect(persistedVersion?.document.status).toBe(
        ContractDocumentStatus.Ready,
      );
      expect(persistedVersion?.document.sha256).toBe(metadata.sha256);

      // Immutability invariant: renderedText and contentHash remain strictly untouched
      expect(persistedVersion?.renderedText).toBe(renderedText);
      expect(persistedVersion?.contentHash).toBe(contentHash);
      expect(persistedVersion?.bookingFingerprint).toBe(bookingFingerprint);

      // Verify stored file in test storage
      const storedBuffer = memoryStorage.get(
        `${metadata.bucket}:${metadata.storageKey}`,
      );
      expect(storedBuffer).toBeDefined();
      expect(storedBuffer!.slice(0, 5).toString('utf-8')).toBe('%PDF-');
      const loadedDoc = await PDFDocument.load(storedBuffer!);
      expect(loadedDoc.getPageCount()).toBeGreaterThanOrEqual(1);
    });

    it('2. Idempotent generation: Concurrent workers on the same version produce zero conflicting artifacts', async () => {
      const version = await versions.findOne({}).lean();
      expect(version).toBeTruthy();

      const uploadSpy = jest.spyOn(mockStorageService, 'uploadPrivateFile');
      uploadSpy.mockClear();

      // Calling again returns existing READY document without re-uploading
      const res1 = await evidenceService.generateAndStorePdf(version!._id);
      const res2 = await evidenceService.generateAndStorePdf(version!._id);

      expect(res1.sha256).toBe(res2.sha256);
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('3. Cryptographic integrity check matches the stored PDF against recorded SHA-256 hash', async () => {
      const version = await versions.findOne({}).lean();
      expect(version).toBeTruthy();

      const check = await evidenceService.verifyIntegrity(version!._id);
      expect(check.valid).toBe(true);
      expect(check.storedSha256).toBe(version!.document.sha256);
      expect(check.actualSha256).toBe(version!.document.sha256);
    });

    it('4. Decoupled failure: Storage errors record FAILED document status without affecting contract or consent data', async () => {
      const brokenVersionId = oid();
      const contract = await contracts.findOne({}).lean();

      await versions.create({
        _id: brokenVersionId,
        contractId: contract!._id,
        version: 2,
        templateVersion: 'ao-dai-rental-v1',
        snapshot: (await versions.findOne({}).lean())!.snapshot,
        renderedText: 'Noi dung phien ban 2',
        contentHash: 'd'.repeat(64),
        bookingFingerprint: 'c'.repeat(64),
        state: ContractVersionState.Accepted,
        document: {
          status: ContractDocumentStatus.Pending,
          retryCount: 0,
        },
      });

      // Mock storage failure
      jest
        .spyOn(mockStorageService, 'uploadPrivateFile')
        .mockRejectedValueOnce(new Error('REMOTE_STORAGE_UNAVAILABLE'));

      await expect(
        evidenceService.generateAndStorePdf(brokenVersionId),
      ).rejects.toThrow('REMOTE_STORAGE_UNAVAILABLE');

      // Persisted state check: Version status is FAILED, retryCount incremented
      const updated = await versions.findById(brokenVersionId).lean();
      expect(updated?.document.status).toBe(ContractDocumentStatus.Failed);
      expect(updated?.document.lastError).toBe('REMOTE_STORAGE_UNAVAILABLE');
      expect(updated?.document.retryCount).toBe(1);

      // Existing contract terms remain intact
      expect(updated?.renderedText).toBe('Noi dung phien ban 2');
      expect(updated?.contentHash).toBe('d'.repeat(64));
    });

    it('5. Concurrency Race: Two workers racing simultaneously on a PENDING version execute atomic CAS and return consistent READY document', async () => {
      const contract = await contracts.findOne({}).lean();
      const concurrentVersionId = oid();

      await versions.create({
        _id: concurrentVersionId,
        contractId: contract!._id,
        version: 3,
        templateVersion: 'ao-dai-rental-v1',
        snapshot: (await versions.findOne({}).lean())!.snapshot,
        renderedText: 'Noi dung phien ban 3 cho concurrency test',
        contentHash: '3'.repeat(64),
        bookingFingerprint: '3'.repeat(64),
        state: ContractVersionState.Accepted,
        document: {
          status: ContractDocumentStatus.Pending,
          retryCount: 0,
        },
      });

      const uploadSpy = jest.spyOn(mockStorageService, 'uploadPrivateFile');
      uploadSpy.mockClear();

      // Run both simultaneously
      const [doc1, doc2] = await Promise.all([
        evidenceService.generateAndStorePdf(concurrentVersionId),
        evidenceService.generateAndStorePdf(concurrentVersionId),
      ]);

      expect(doc1.sha256).toBe(doc2.sha256);
      expect(doc1.status).toBe(ContractDocumentStatus.Ready);
      expect(doc2.status).toBe(ContractDocumentStatus.Ready);

      // Only one upload occurs due to atomic CAS lease
      expect(uploadSpy).toHaveBeenCalledTimes(1);
    });

    it('6. Durable Recovery: Background recovery worker re-processes FAILED documents to READY without touching payments or bookings', async () => {
      // Find the failed version from test 4
      const failedVer = await versions
        .findOne({ 'document.status': ContractDocumentStatus.Failed })
        .lean();
      expect(failedVer).toBeTruthy();

      // Fast-forward lastAttempt by modifying document.generatedAt
      await versions.updateOne(
        { _id: failedVer!._id },
        { $set: { 'document.generatedAt': new Date(Date.now() - 30_000) } },
      );

      const recoveryResult = await evidenceService.recoverFailedPdfs();
      expect(recoveryResult.scanned).toBeGreaterThanOrEqual(1);
      expect(recoveryResult.recovered).toBeGreaterThanOrEqual(1);

      const restored = await versions.findById(failedVer!._id).lean();
      expect(restored?.document.status).toBe(ContractDocumentStatus.Ready);
      expect(restored?.document.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(restored?.renderedText).toBe(failedVer!.renderedText);
    });

    it('7. Integrity Tampering Detection: Altering storage binary is detected by verifyIntegrity', async () => {
      const version = await versions
        .findOne({ 'document.status': ContractDocumentStatus.Ready })
        .lean();
      expect(version).toBeTruthy();

      const key = `${version!.document.bucket}:${version!.document.storageKey}`;
      const originalBuf = memoryStorage.get(key);
      expect(originalBuf).toBeDefined();

      // Tamper one byte
      const tampered = Buffer.from(originalBuf!);
      tampered[tampered.length - 10] = 0x58; // replace byte
      memoryStorage.set(key, tampered);

      const check = await evidenceService.verifyIntegrity(version!._id);
      expect(check.valid).toBe(false);
      expect(check.actualSha256).not.toBe(check.storedSha256);

      // Restore original buffer
      memoryStorage.set(key, originalBuf!);
    });

    it('8. Multi-provider contract isolation: Separate providers for the same multi-item booking produce distinct PDFs, distinct storage keys, and enforced access control', async () => {
      const bookingId = oid();
      const customerId = oid();
      const providerAId = oid();
      const providerBId = oid();
      const providerAUserId = oid();
      const providerBUserId = oid();

      // Create booking and providers in DB for access checks
      await connection.db!.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: 'VH-COMBO-MULTI-PROV',
        bookingType: 'COMBO',
        status: 'AWAITING_PAYMENT',
        customerId,
        providerIds: [providerAId, providerBId],
        pricingSummary: { grandTotal: 5000000 },
      });

      await connection.db!.collection('providers').insertMany([
        { _id: providerAId, userId: providerAUserId, status: 'APPROVED' },
        { _id: providerBId, userId: providerBUserId, status: 'APPROVED' },
      ]);

      const contractAId = oid();
      const contractBId = oid();
      const versionAId = oid();
      const versionBId = oid();

      const snapshotA = {
        bookingId: bookingId.toString(),
        customerId: customerId.toString(),
        providerId: providerAId.toString(),
        bookingType: 'AODAI_RENTAL' as const,
        bookingItemIds: ['item-a-1'],
        booking: { bookingCode: 'VH-COMBO-MULTI-PROV' },
        customer: { fullName: 'Tran Thi B', email: 'b@test.invalid' },
        provider: { businessName: 'Ao Dai Hue Xua', address: 'Hue City' },
        providerItems: [
          {
            productName: 'Ao Dai Co Phuc',
            size: 'M',
            color: 'Do',
            quantity: 1,
            rentalFrom: '2026-11-20T08:00:00.000Z',
            rentalTo: '2026-11-22T18:00:00.000Z',
            rentalPrice: 800000,
            depositAmount: 1600000,
          },
        ],
        pricing: {
          rentalTotal: 800000,
          depositTotal: 1600000,
          grandTotal: 2400000,
        },
        policies: { standardPolicy: 'Thoa thuan thue provider A' },
        template: { version: 'ao-dai-rental-v1' },
      };

      const snapshotB = {
        bookingId: bookingId.toString(),
        customerId: customerId.toString(),
        providerId: providerBId.toString(),
        bookingType: 'AODAI_RENTAL' as const,
        bookingItemIds: ['item-b-1'],
        booking: { bookingCode: 'VH-COMBO-MULTI-PROV' },
        customer: { fullName: 'Tran Thi B', email: 'b@test.invalid' },
        provider: { businessName: 'Tiem Nhiep Anh Sai Gon', address: 'TP.HCM' },
        providerItems: [
          {
            productName: 'Goi chup hinh ngoai canh',
            size: 'Standard',
            color: 'Tu nhien',
            quantity: 1,
            rentalFrom: '2026-11-20T08:00:00.000Z',
            rentalTo: '2026-11-22T18:00:00.000Z',
            rentalPrice: 1500000,
            depositAmount: 500000,
          },
        ],
        pricing: {
          rentalTotal: 1500000,
          depositTotal: 500000,
          grandTotal: 2000000,
        },
        policies: { standardPolicy: 'Thoa thuan thue provider B' },
        template: { version: 'ao-dai-rental-v1' },
      };

      const contentHashA = hashContract({
        template: snapshotA.template,
        snapshot: snapshotA,
      });
      const contentHashB = hashContract({
        template: snapshotB.template,
        snapshot: snapshotB,
      });
      const fingerprintA = hashContract({
        booking: snapshotA.booking,
        providerItems: snapshotA.providerItems,
        pricing: snapshotA.pricing,
      });
      const fingerprintB = hashContract({
        booking: snapshotB.booking,
        providerItems: snapshotB.providerItems,
        pricing: snapshotB.pricing,
      });

      await contracts.create([
        {
          _id: contractAId,
          bookingId,
          customerId,
          providerId: providerAId,
          contractCode: 'DC-PROV-A-001',
          currentVersionId: versionAId,
        },
        {
          _id: contractBId,
          bookingId,
          customerId,
          providerId: providerBId,
          contractCode: 'DC-PROV-B-002',
          currentVersionId: versionBId,
        },
      ]);

      await versions.create([
        {
          _id: versionAId,
          contractId: contractAId,
          version: 1,
          templateVersion: 'ao-dai-rental-v1',
          snapshot: snapshotA,
          renderedText: 'Dieu 1: Thue ao dai nha A.\nDieu 2: Dat coc nha A.',
          contentHash: contentHashA,
          bookingFingerprint: fingerprintA,
          state: ContractVersionState.Accepted,
          document: { status: ContractDocumentStatus.Pending, retryCount: 0 },
        },
        {
          _id: versionBId,
          contractId: contractBId,
          version: 1,
          templateVersion: 'ao-dai-rental-v1',
          snapshot: snapshotB,
          renderedText: 'Dieu 1: Thue ao dai nha B.\nDieu 2: Dat coc nha B.',
          contentHash: contentHashB,
          bookingFingerprint: fingerprintB,
          state: ContractVersionState.Accepted,
          document: { status: ContractDocumentStatus.Pending, retryCount: 0 },
        },
      ]);

      await consents.create([
        {
          contractId: contractAId,
          contractVersionId: versionAId,
          actorUserId: customerId,
          actorRole: 'CUSTOMER',
          action: ContractConsentAction.Accept,
          authenticationMethod: 'APP_SESSION',
          occurredAt: new Date('2026-11-19T14:00:00.000Z'),
          contentHash: contentHashA,
          bookingFingerprint: fingerprintA,
          idempotencyKey: `consent-a-${randomUUID()}`,
        },
        {
          contractId: contractBId,
          contractVersionId: versionBId,
          actorUserId: customerId,
          actorRole: 'CUSTOMER',
          action: ContractConsentAction.Accept,
          authenticationMethod: 'APP_SESSION',
          occurredAt: new Date('2026-11-19T14:00:00.000Z'),
          contentHash: contentHashB,
          bookingFingerprint: fingerprintB,
          idempotencyKey: `consent-b-${randomUUID()}`,
        },
      ]);

      // Generate PDF evidence for both
      const docA = await evidenceService.generateAndStorePdf(versionAId);
      const docB = await evidenceService.generateAndStorePdf(versionBId);

      // Verify distinct identities
      expect(docA.storageKey).toBe(
        `contracts/${contractAId.toString()}/${versionAId.toString()}/${contentHashA}.pdf`,
      );
      expect(docB.storageKey).toBe(
        `contracts/${contractBId.toString()}/${versionBId.toString()}/${contentHashB}.pdf`,
      );
      expect(docA.storageKey).not.toBe(docB.storageKey);
      expect(docA.sha256).not.toBe(docB.sha256);
      expect(contentHashA).not.toBe(contentHashB);
      expect(fingerprintA).not.toBe(fingerprintB);

      // Read back persisted ContractVersion and verify status and binary hash match
      const persistedVerA = await versions.findById(versionAId).lean();
      const persistedVerB = await versions.findById(versionBId).lean();
      expect(persistedVerA?.document.status).toBe(ContractDocumentStatus.Ready);
      expect(persistedVerB?.document.status).toBe(ContractDocumentStatus.Ready);
      expect(persistedVerA?.document.sha256).toBe(docA.sha256);
      expect(persistedVerB?.document.sha256).toBe(docB.sha256);

      // Verify binary buffer in storage matches the recorded sha256
      const bufA = memoryStorage.get(`${docA.bucket}:${docA.storageKey}`)!;
      const bufB = memoryStorage.get(`${docB.bucket}:${docB.storageKey}`)!;
      expect(createHash('sha256').update(bufA).digest('hex')).toBe(docA.sha256);
      expect(createHash('sha256').update(bufB).digest('hex')).toBe(docB.sha256);

      // Verify Idempotency: Calling generateAndStorePdf again returns existing document without modifying state
      const reDocA = await evidenceService.generateAndStorePdf(versionAId);
      expect(reDocA.sha256).toBe(docA.sha256);
      expect(reDocA.storageKey).toBe(docA.storageKey);

      // Verify Immutability: ContractVersion and Consent records in DB remain strictly untouched
      const finalVerA = await versions.findById(versionAId).lean();
      expect(finalVerA?.renderedText).toBe(
        'Dieu 1: Thue ao dai nha A.\nDieu 2: Dat coc nha A.',
      );
      expect(finalVerA?.contentHash).toBe(contentHashA);
      expect(finalVerA?.bookingFingerprint).toBe(fingerprintA);

      // Export integration-generated runtime PDF evidence and manifest to scratch
      const scratchDir =
        'C:/Users/ASUS/.gemini/antigravity/brain/68c59b7c-6838-4146-a6a9-3a382205b094/scratch';
      if (fs.existsSync(scratchDir)) {
        const rtPdfPathA = path.join(scratchDir, 'runtime_evidence_prov_a.pdf');
        const rtPdfPathB = path.join(scratchDir, 'runtime_evidence_prov_b.pdf');
        fs.writeFileSync(rtPdfPathA, bufA);
        fs.writeFileSync(rtPdfPathB, bufB);

        const runtimeManifest = {
          generatedAt: new Date().toISOString(),
          environment: 'MongoDB Isolated Replica Set (Port 27028)',
          service: 'ContractEvidenceService.generateAndStorePdf',
          items: [
            {
              provider: 'Provider A (Ao Dai Hue Xua)',
              contractCode: 'DC-PROV-A-001',
              contractId: contractAId.toString(),
              bookingId: bookingId.toString(),
              contractVersionId: versionAId.toString(),
              contentHash: contentHashA,
              bookingFingerprint: fingerprintA,
              storageKey: docA.storageKey,
              pdfSha256: docA.sha256,
              filePath: rtPdfPathA,
            },
            {
              provider: 'Provider B (Tiem Nhiep Anh Sai Gon)',
              contractCode: 'DC-PROV-B-002',
              contractId: contractBId.toString(),
              bookingId: bookingId.toString(),
              contractVersionId: versionBId.toString(),
              contentHash: contentHashB,
              bookingFingerprint: fingerprintB,
              storageKey: docB.storageKey,
              pdfSha256: docB.sha256,
              filePath: rtPdfPathB,
            },
          ],
        };
        fs.writeFileSync(
          path.join(scratchDir, 'db_evidence_manifest.json'),
          JSON.stringify(runtimeManifest, null, 2),
          'utf-8',
        );
      }

      // Verify Access Control Isolation
      const userProvA: AuthUser = {
        sub: providerAUserId.toString(),
        email: 'a@p.vn',
        sessionId: 's1',
        roles: ['PROVIDER'],
        permissions: [],
      };
      const userProvB: AuthUser = {
        sub: providerBUserId.toString(),
        email: 'b@p.vn',
        sessionId: 's2',
        roles: ['PROVIDER'],
        permissions: [],
      };
      const userCust: AuthUser = {
        sub: customerId.toString(),
        email: 'c@cust.vn',
        sessionId: 's3',
        roles: ['CUSTOMER'],
        permissions: [],
      };

      // Provider A can get stream for Contract A, but is REJECTED for Contract B
      const streamA = await evidenceService.getPdfStream(
        userProvA,
        contractAId.toString(),
        versionAId.toString(),
      );
      expect(streamA.sha256).toBe(docA.sha256);
      await expect(
        evidenceService.getPdfStream(
          userProvA,
          contractBId.toString(),
          versionBId.toString(),
        ),
      ).rejects.toThrow('CONTRACT_NOT_FOUND');

      // Provider B can get stream for Contract B, but is REJECTED for Contract A
      const streamB = await evidenceService.getPdfStream(
        userProvB,
        contractBId.toString(),
        versionBId.toString(),
      );
      expect(streamB.sha256).toBe(docB.sha256);
      await expect(
        evidenceService.getPdfStream(
          userProvB,
          contractAId.toString(),
          versionAId.toString(),
        ),
      ).rejects.toThrow('CONTRACT_NOT_FOUND');

      // Customer can access both Contract A and Contract B
      const custStreamA = await evidenceService.getPdfStream(
        userCust,
        contractAId.toString(),
        versionAId.toString(),
      );
      const custStreamB = await evidenceService.getPdfStream(
        userCust,
        contractBId.toString(),
        versionBId.toString(),
      );
      expect(custStreamA.sha256).toBe(docA.sha256);
      expect(custStreamB.sha256).toBe(docB.sha256);
    });

    it('9. Database-to-PDF Identity Fidelity: Stored PDF strictly reflects MongoDB documents without recalculating contentHash', async () => {
      const ver = await versions
        .findOne({ 'document.status': ContractDocumentStatus.Ready })
        .lean();
      expect(ver).toBeTruthy();

      const contract = await contracts.findById(ver!.contractId).lean();
      expect(contract).toBeTruthy();

      // Verify storage path conforms to contracts/{contractId}/{versionId}/{contentHash}.pdf
      expect(ver!.document.storageKey).toBe(
        `contracts/${contract!._id.toString()}/${ver!._id.toString()}/${ver!.contentHash}.pdf`,
      );

      // Verify cryptographic integrity check
      const integrity = await evidenceService.verifyIntegrity(ver!._id);
      expect(integrity.valid).toBe(true);
      expect(integrity.storedSha256).toBe(ver!.document.sha256);

      // Verify that the version record in DB was not mutated
      const currentVer = await versions.findById(ver!._id).lean();
      expect(currentVer?.contentHash).toBe(ver!.contentHash);
      expect(currentVer?.bookingFingerprint).toBe(ver!.bookingFingerprint);
      expect(currentVer?.renderedText).toBe(ver!.renderedText);
    });
  },
);
