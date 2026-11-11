import { MongoClient, ObjectId } from 'mongodb';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DigitalContractSchema } from '../bookings/schemas/digital-contract.schema';
import { ContractVersionSchema } from './schemas/contract-version.schema';
import { ContractConsentSchema } from './schemas/contract-consent.schema';
import { ProviderContractAcceptanceSchema } from './schemas/provider-contract-acceptance.schema';
import { contractTestTarget } from './contract-test-target';

// An explicit, dedicated test database is required. This test never reads
// backend/.env and cannot run against the application's configured database.
const target = contractTestTarget();
const uri = target?.uri;
const databaseName = target?.databaseName;

(target ? describe : describe.skip)(
  'Phase 2 contract indexes on a test database',
  () => {
    it('allows two providers for one booking and rejects a duplicate provider or version', async () => {
      const client = new MongoClient(uri!, { serverSelectionTimeoutMS: 8000 });
      const suffix = new ObjectId().toHexString();
      const contractCollectionName = `contract_phase2_${suffix}`;
      const versionCollectionName = `contract_version_phase2_${suffix}`;
      const consentCollectionName = `contract_consent_phase3_${suffix}`;
      const acceptanceCollectionName = `contract_acceptance_phase3_${suffix}`;
      let connected = false;
      try {
        await client.connect();
        connected = true;
        const db = client.db(databaseName);
        const contracts = db.collection(contractCollectionName);
        const versions = db.collection(versionCollectionName);
        const consents = db.collection(consentCollectionName);
        const acceptances = db.collection(acceptanceCollectionName);
        const [contractKey, contractOptions] =
          DigitalContractSchema.indexes().find(
            ([key]) =>
              key.bookingId === 1 && key.providerId === 1 && key.scope === 1,
          )!;
        const [versionKey, versionOptions] =
          ContractVersionSchema.indexes().find(
            ([key]) => key.contractId === 1 && key.version === 1,
          )!;
        await contracts.createIndex(contractKey, contractOptions);
        await versions.createIndex(versionKey, versionOptions);
        for (const [key, options] of ContractConsentSchema.indexes())
          await consents.createIndex(key, options);
        for (const [key, options] of ProviderContractAcceptanceSchema.indexes())
          await acceptances.createIndex(key, options);
        const bookingId = new ObjectId();
        const firstProvider = new ObjectId();
        await contracts.insertMany([
          { bookingId, providerId: firstProvider, scope: 'AO_DAI_RENTAL' },
          { bookingId, providerId: new ObjectId(), scope: 'AO_DAI_RENTAL' },
        ]);
        await expect(
          contracts.insertOne({
            bookingId,
            providerId: firstProvider,
            scope: 'AO_DAI_RENTAL',
          }),
        ).rejects.toMatchObject({ code: 11000 });
        const contractId = new ObjectId();
        await versions.insertOne({ contractId, version: 1 });
        await expect(
          versions.insertOne({ contractId, version: 1 }),
        ).rejects.toMatchObject({ code: 11000 });
        await versions.insertOne({ contractId, version: 2 });
        const racingVersion = await Promise.allSettled([
          versions.insertOne({ contractId, version: 3 }),
          versions.insertOne({ contractId, version: 3 }),
        ]);
        expect(
          racingVersion.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          racingVersion.filter((result) => result.status === 'rejected'),
        ).toHaveLength(1);
        const actorUserId = new ObjectId();
        const versionId = new ObjectId();
        await consents.insertOne({
          contractVersionId: versionId,
          actorUserId,
          action: 'ACCEPT',
          idempotencyKey: 'accept-1',
        });
        await expect(
          consents.insertOne({
            contractVersionId: versionId,
            actorUserId,
            action: 'DECLINE',
            idempotencyKey: 'accept-2',
          }),
        ).rejects.toMatchObject({ code: 11000 });
        const racingConsentVersion = new ObjectId();
        const racingConsent = await Promise.allSettled([
          consents.insertOne({
            contractVersionId: racingConsentVersion,
            actorUserId,
            action: 'ACCEPT',
            idempotencyKey: 'race-1',
          }),
          consents.insertOne({
            contractVersionId: racingConsentVersion,
            actorUserId,
            action: 'ACCEPT',
            idempotencyKey: 'race-2',
          }),
        ]);
        expect(
          racingConsent.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          racingConsent.filter((result) => result.status === 'rejected'),
        ).toHaveLength(1);
        await consents.insertOne({
          contractVersionId: new ObjectId(),
          actorUserId,
          action: 'ACCEPT',
          idempotencyKey: 'accept-2',
        });
        await expect(
          consents.insertOne({
            contractVersionId: new ObjectId(),
            actorUserId,
            action: 'ACCEPT',
            idempotencyKey: 'accept-2',
          }),
        ).rejects.toMatchObject({ code: 11000 });
        await acceptances.insertOne({
          providerId: firstProvider,
          scope: 'AO_DAI_RENTAL',
          status: 'ACTIVE',
        });
        await expect(
          acceptances.insertOne({
            providerId: firstProvider,
            scope: 'AO_DAI_RENTAL',
            status: 'ACTIVE',
          }),
        ).rejects.toMatchObject({ code: 11000 });
        await acceptances.insertOne({
          providerId: firstProvider,
          scope: 'AO_DAI_RENTAL',
          status: 'REVOKED',
        });
        await contracts.insertOne({
          bookingId: new ObjectId(),
          providerId: firstProvider,
          status: 'SIGNED',
          contractCode: 'LEGACY-SIGNED',
        });
      } finally {
        if (connected) {
          const db = client.db(databaseName);
          await db
            .collection(contractCollectionName)
            .drop()
            .catch(() => undefined);
          await db
            .collection(versionCollectionName)
            .drop()
            .catch(() => undefined);
          await db
            .collection(consentCollectionName)
            .drop()
            .catch(() => undefined);
          await db
            .collection(acceptanceCollectionName)
            .drop()
            .catch(() => undefined);
        }
        await client.close();
      }
    });

    it('dry-runs, applies, resumes, and rejects invalid legacy data only in a scratch test database', async () => {
      const scratchName = `contract_phase3_${new ObjectId().toHexString()}_test`;
      const scratchUri = new URL(uri!);
      scratchUri.pathname = `/${scratchName}`;
      const client = new MongoClient(scratchUri.toString(), {
        serverSelectionTimeoutMS: 8000,
      });
      const run = (args: string[]) => {
        const result = spawnSync(
          process.execPath,
          [
            resolve(__dirname, '../../../scripts/migrate-contract-v2.js'),
            ...args,
          ],
          {
            env: {
              ...process.env,
              CONTRACT_MIGRATION_URI: scratchUri.toString(),
            },
            encoding: 'utf8',
            timeout: 30000,
          },
        );
        return {
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
        };
      };
      await client.connect();
      try {
        const db = client.db(scratchName);
        const bookingId = new ObjectId();
        const providerId = new ObjectId();
        const customerId = new ObjectId();
        const contractId = new ObjectId();
        await db.collection('bookings').insertOne({
          _id: bookingId,
          bookingType: 'AODAI_RENTAL',
          customerId,
          providerIds: [providerId],
          contractId,
        });
        await db
          .collection('booking_items')
          .insertOne({ bookingId, providerId, itemType: 'PRODUCT' });
        await db.collection('digital_contracts').insertOne({
          _id: contractId,
          bookingId,
          providerId,
          customerId,
          contractCode: 'LEGACY-1',
          status: 'SIGNED',
          contractTerms: 'original',
          signatures: [{ signedBy: customerId }],
        });
        const recoveryBookingId = new ObjectId();
        const recoveryContractId = new ObjectId();
        await db.collection('bookings').insertOne({
          _id: recoveryBookingId,
          bookingType: 'AODAI_RENTAL',
          customerId,
          providerIds: [providerId],
          contractId: recoveryContractId,
        });
        await db.collection('booking_items').insertOne({
          bookingId: recoveryBookingId,
          providerId,
          itemType: 'PRODUCT',
        });
        await db.collection('digital_contracts').insertOne({
          _id: recoveryContractId,
          bookingId: recoveryBookingId,
          providerId,
          customerId,
          contractCode: 'LEGACY-RECOVERY',
          status: 'DRAFT',
        });
        await db
          .collection('digital_contracts')
          .createIndex({ bookingId: 1 }, { unique: true, name: 'bookingId_1' });
        const invalidId = new ObjectId();
        await db
          .collection('digital_contracts')
          .insertOne({ _id: invalidId, contractCode: 'INVALID' });
        expect(run(['--dry-run']).status).toBe(1);
        expect(
          await db.collection('digital_contracts').findOne({ _id: contractId }),
        ).not.toHaveProperty('flowVersion');
        await db.collection('digital_contracts').deleteOne({ _id: invalidId });
        const dry = run(['--dry-run']);
        expect(dry.status).toBe(0);
        const fingerprint = (JSON.parse(dry.stdout) as { fingerprint: string })
          .fingerprint;
        const interrupted = run([
          '--apply',
          `--test-db=${scratchName}`,
          '--allow-test-write',
          `--expected-fingerprint=${fingerprint}`,
          '--test-fail-after=1',
        ]);
        expect(interrupted.status).toBe(1);
        expect(interrupted.stderr).toContain('TEST_INJECTED_MIGRATION_FAILURE');
        expect(
          await db
            .collection('digital_contracts')
            .countDocuments({ flowVersion: 1 }),
        ).toBe(1);
        const recoveryDry = run(['--dry-run']);
        expect(recoveryDry.status).toBe(0);
        const recoveryFingerprint = (
          JSON.parse(recoveryDry.stdout) as { fingerprint: string }
        ).fingerprint;
        const applied = run([
          '--apply',
          `--test-db=${scratchName}`,
          '--allow-test-write',
          `--expected-fingerprint=${recoveryFingerprint}`,
        ]);
        expect(applied.status).toBe(0);
        const signed = await db
          .collection('digital_contracts')
          .findOne({ _id: contractId });
        expect(signed).toMatchObject({
          flowVersion: 1,
          scope: 'AO_DAI_RENTAL',
          status: 'SIGNED',
          contractTerms: 'original',
        });
        expect(signed?.signatures).toHaveLength(1);
        // The backfill deliberately does not alter indexes. Verify the reviewed
        // index switch separately, using only this scratch database.
        expect(
          (await db.collection('digital_contracts').indexes()).some(
            (index) => index.name === 'bookingId_1',
          ),
        ).toBe(true);
        await db.collection('digital_contracts').dropIndex('bookingId_1');
        await db
          .collection('digital_contracts')
          .createIndex(
            { bookingId: 1, providerId: 1, scope: 1 },
            { unique: true, name: 'booking_provider_scope_unique' },
          );
        const newIndex = (
          await db.collection('digital_contracts').indexes()
        ).find((index) => index.name === 'booking_provider_scope_unique');
        expect(newIndex).toMatchObject({
          unique: true,
          key: { bookingId: 1, providerId: 1, scope: 1 },
        });
        const secondProviderId = new ObjectId();
        await db
          .collection('bookings')
          .updateOne(
            { _id: bookingId },
            { $push: { providerIds: secondProviderId } },
          );
        await db.collection('booking_items').insertOne({
          bookingId,
          providerId: secondProviderId,
          itemType: 'PRODUCT',
        });
        await db.collection('digital_contracts').insertOne({
          bookingId,
          providerId: secondProviderId,
          customerId,
          scope: 'AO_DAI_RENTAL',
          flowVersion: 2,
          approvalMode: 'AUTO_ACCEPTANCE',
          status: 'DRAFT',
          contractCode: 'V2-SECOND',
        });
        await expect(
          db.collection('digital_contracts').insertOne({
            bookingId,
            providerId: secondProviderId,
            customerId,
            scope: 'AO_DAI_RENTAL',
            contractCode: 'V2-DUPLICATE',
          }),
        ).rejects.toMatchObject({ code: 11000 });
        expect(
          await db.collection('digital_contracts').findOne({ _id: contractId }),
        ).toMatchObject({
          status: 'SIGNED',
          contractTerms: 'original',
          signatures: [{ signedBy: customerId }],
        });
        const secondDry = run(['--dry-run']);
        expect(secondDry.status).toBe(0);
        const secondFingerprint = (
          JSON.parse(secondDry.stdout) as { fingerprint: string }
        ).fingerprint;
        expect(
          run([
            '--apply',
            `--test-db=${scratchName}`,
            '--allow-test-write',
            `--expected-fingerprint=${secondFingerprint}`,
          ]).status,
        ).toBe(0);
        expect(
          await db
            .collection('digital_contracts')
            .countDocuments({ flowVersion: 1 }),
        ).toBe(2);
      } finally {
        if (
          scratchName.startsWith('contract_phase3_') &&
          scratchName.endsWith('_test')
        )
          await client.db(scratchName).dropDatabase();
        await client.close();
      }
    }, 90000);
  },
);
