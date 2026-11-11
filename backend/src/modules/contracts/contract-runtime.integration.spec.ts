import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { createConnection, Connection, Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ContractAccessService } from './contract-access.service';
import { ContractConsentService } from './contract-consent.service';
import { ContractPolicyService } from './contract-policy.service';
import { ContractPreparationService } from './contract-preparation.service';
import { ContractReadService } from './contract-read.service';
import { ContractCheckoutGuard } from './contract-checkout-guard.service';
import { Payment, PaymentPurpose, PaymentSchema, PaymentStatus } from '../payments/schemas/payment.schema';
import { PaymentRecovery, PaymentRecoverySchema, PaymentRecoveryState } from '../payments/schemas/payment-recovery.schema';
import { Booking, BookingSchema, BookingStatus } from '../bookings/schemas/booking.schema';
import { BookingItem, BookingItemSchema } from '../bookings/schemas/booking-item.schema';
import { BookingSchedule, BookingScheduleSchema } from '../bookings/schemas/booking-schedule.schema';
import { InventoryReservation, InventoryReservationSchema, ReservationStatus } from '../products/schemas/inventory-reservation.schema';
import { BookingEscrow, BookingEscrowSchema } from '../payments/schemas/booking-escrow.schema';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';
import { PaymentRecoveryService } from '../payments/services/payment-recovery.service';
import { V2PaymentFinalizationService } from '../payments/services/v2-payment-finalization.service';
import { contractIntentKey } from '../payments/services/contract-payment-binding';
import { hashContract } from './canonical-contract';
import { contractTestTarget } from './contract-test-target';
import { ContractConsentDto } from './dto/contract-consent.dto';
import {
  DigitalContract,
  DigitalContractSchema,
} from '../bookings/schemas/digital-contract.schema';
import {
  ContractVersion,
  ContractVersionSchema,
  ContractVersionState,
} from './schemas/contract-version.schema';
import {
  ContractConsent,
  ContractConsentAction,
  ContractConsentSchema,
} from './schemas/contract-consent.schema';
import {
  ProviderContractAcceptance,
  ProviderContractAcceptanceSchema,
} from './schemas/provider-contract-acceptance.schema';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();
const mechanismHash = 'a'.repeat(64);
const template = {
  version: 'phase45-test-approved-v1',
  status: 'APPROVED' as const,
  approvedAt: '2026-10-28T00:00:00.000Z',
  title: 'Test only',
  sections: [],
};
const user = (id: Types.ObjectId) => ({
  sub: id.toString(),
  email: 'test@example.invalid',
  sessionId: randomUUID(),
  roles: ['CUSTOMER'],
  permissions: [],
});

interface Seed {
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerIds: Types.ObjectId[];
  providerUserIds: Types.ObjectId[];
  itemIds: Types.ObjectId[];
  snapshots: Map<string, Record<string, unknown>>;
}

(target ? describe : describe.skip)(
  'Phase 4.5 contracts on isolated MongoDB replica set',
  () => {
    jest.setTimeout(30000);
    let connection: Connection;
    let contracts: Model<DigitalContract>;
    let versions: Model<ContractVersion>;
    let consents: Model<ContractConsent>;
    let acceptances: Model<ProviderContractAcceptance>;
    let bookings: Model<Booking>;
    let bookingItems: Model<BookingItem>;
    let schedules: Model<BookingSchedule>;
    let reservations: Model<InventoryReservation>;
    let payments: Model<Payment>;
    let recoveries: Model<PaymentRecovery>;
    let escrows: Model<BookingEscrow>;
    let notifications: Model<Notification>;
    let scratchName: string;

    beforeAll(async () => {
      scratchName = `contract_runtime_${oid().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchName}`;
      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 8000,
      }).asPromise();
      const hello = await connection.db!.admin().command({ hello: 1 });
      if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary)
        throw new Error('Isolated contract test replica set is not primary');
      contracts = connection.model(DigitalContract.name, DigitalContractSchema);
      versions = connection.model(ContractVersion.name, ContractVersionSchema);
      consents = connection.model(ContractConsent.name, ContractConsentSchema);
      acceptances = connection.model(
        ProviderContractAcceptance.name,
        ProviderContractAcceptanceSchema,
      );
      bookings = connection.model(Booking.name, BookingSchema);
      bookingItems = connection.model(BookingItem.name, BookingItemSchema);
      schedules = connection.model(BookingSchedule.name, BookingScheduleSchema);
      reservations = connection.model(InventoryReservation.name, InventoryReservationSchema);
      payments = connection.model(Payment.name, PaymentSchema);
      recoveries = connection.model(PaymentRecovery.name, PaymentRecoverySchema);
      escrows = connection.model(BookingEscrow.name, BookingEscrowSchema);
      notifications = connection.model(Notification.name, NotificationSchema);
      await connection.db!.collection('payment_recoveries').createIndex({ paymentId: 1 }, { unique: true });
      await connection.db!.collection('booking_escrows').createIndex({ bookingId: 1 }, { unique: true });
      await connection
        .db!.collection('digital_contracts')
        .createIndex(
          { bookingId: 1, providerId: 1, scope: 1 },
          { unique: true, name: 'booking_provider_scope_unique' },
        );
      await connection
        .db!.collection('contract_versions')
        .createIndex({ contractId: 1, version: 1 }, { unique: true });
      await connection
        .db!.collection('contract_consents')
        .createIndex(
          { contractVersionId: 1, actorUserId: 1 },
          { unique: true },
        );
      await connection
        .db!.collection('contract_consents')
        .createIndex({ actorUserId: 1, idempotencyKey: 1 }, { unique: true });
      await connection
        .db!.collection('provider_contract_acceptances')
        .createIndex(
          { providerId: 1, scope: 1 },
          { unique: true, partialFilterExpression: { status: 'ACTIVE' } },
        );
    }, 30000);

    afterAll(async () => {
      if (!connection) return;
      if (
        scratchName.startsWith('contract_runtime_') &&
        scratchName.endsWith('_test')
      )
        await connection.dropDatabase();
      await connection.close();
    }, 30000);

    async function seed(providerCount = 1): Promise<Seed> {
      const bookingId = oid();
      const customerId = oid();
      const providerIds = Array.from({ length: providerCount }, oid);
      const providerUserIds = providerIds.map(oid);
      const itemIds = providerIds.map(oid);
      const snapshots = new Map<string, Record<string, unknown>>();
      const now = new Date();
      await connection.db!.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: `T-${randomUUID()}`,
        bookingType: 'AODAI_RENTAL',
        status: 'PENDING_PAYMENT',
        contractFlowVersion: 2,
        customerId,
        providerIds,
        pricingSummary: {},
        holdExpiresAt: new Date(now.getTime() + 60000),
        updatedAt: now,
      });
      for (let index = 0; index < providerCount; index++) {
        const providerId = providerIds[index];
        const itemId = itemIds[index];
        const owner = providerUserIds[index];
        await connection.db!.collection('providers').insertOne({
          _id: providerId,
          userId: owner,
          status: 'ACTIVE',
          capabilities: ['AODAI_RENTAL'],
        });
        const prodId = oid();
        const invItemId = oid();
        await connection.db!.collection('booking_items').insertOne({
          _id: itemId,
          bookingId,
          providerId,
          itemType: 'PRODUCT',
          productId: prodId,
          quantity: 1,
          selectedSize: 'M',
          selectedColor: 'Đỏ',
          rentalFrom: now,
          rentalTo: new Date(now.getTime() + 86400000),
          updatedAt: now,
        });
        await connection.db!.collection('products').insertOne({
          _id: prodId,
          providerId,
          name: 'Áo Dài Test',
          sizes: ['M'],
          colors: ['Đỏ'],
        });
        await connection.db!.collection('inventory_items').insertOne({
          _id: invItemId,
          productId: prodId,
          providerId,
          size: 'M',
          color: 'Đỏ',
          status: 'AVAILABLE',
        });
        await connection.db!.collection('inventory_reservations').insertOne({
          bookingId,
          bookingItemId: itemId,
          inventoryItemId: invItemId,
          status: 'TEMP_RESERVED',
          reservedFrom: now,
          reservedTo: new Date(now.getTime() + 86400000),
          expiresAt: new Date(now.getTime() + 60000),
        });
        const snapshot = {
          bookingId: bookingId.toString(),
          customerId: customerId.toString(),
          providerId: providerId.toString(),
          bookingType: 'AODAI_RENTAL',
          bookingItemIds: [itemId.toString()],
          booking: { bookingCode: `T-${bookingId.toString()}` },
          customer: { fullName: 'Test customer' },
          provider: { businessName: 'Test provider' },
          providerItems: [{ bookingItemId: itemId.toString(), size: 'M' }],
          pricing: {},
          policies: {},
          template: { version: template.version },
        };
        snapshots.set(providerId.toString(), snapshot);
        await acceptances.create({
          providerId,
          acceptedByUserId: owner,
          scope: 'AO_DAI_RENTAL',
          mechanismVersion: 'phase45-test',
          templateVersion: template.version,
          mechanismHash,
          policyFingerprint: hashContract(snapshot.policies),
          status: 'ACTIVE',
          acceptedAt: new Date(now.getTime() - 1000),
        });
      }
      return {
        bookingId,
        customerId,
        providerIds,
        providerUserIds,
        itemIds,
        snapshots,
      };
    }

    function services(seedData: Seed) {
      const access = new ContractAccessService(connection);
      const policy = new ContractPolicyService(connection, acceptances);
      const snapshotService = {
        build: jest
          .fn()
          .mockImplementation((_context: unknown, providerId: Types.ObjectId) =>
            Promise.resolve(seedData.snapshots.get(providerId.toString())),
          ),
      };
      const templateService = { getApproved: () => template };
      const preparation = new ContractPreparationService(
        true,
        connection,
        contracts,
        versions,
        policy,
        snapshotService as never,
        templateService as never,
      );
      const consent = new ContractConsentService(
        true,
        connection,
        contracts,
        versions,
        consents,
        access,
        policy,
        preparation,
        snapshotService as never,
        templateService as never,
        { getApproved: () => ({ hash: mechanismHash }) } as never,
      );
      const read = new ContractReadService(
        true,
        contracts,
        versions,
        consents,
        access,
        policy,
        templateService as never,
        snapshotService as never,
        preparation,
      );
      const checkout = new ContractCheckoutGuard(
        true,
        contracts,
        versions,
        consents,
        policy,
        snapshotService as never,
        preparation,
        templateService as never,
        {
          getApproved: () => ({ hash: mechanismHash, version: 'phase45-test' }),
        } as never,
      );
      return {
        access,
        policy,
        preparation,
        consent,
        read,
        snapshotService,
        checkout,
      };
    }

    async function offered(seedData: Seed, providerIndex = 0) {
      const service = services(seedData);
      const result = await service.preparation.prepare(
        seedData.bookingId.toString(),
        seedData.providerIds[providerIndex].toString(),
      );
      await versions.updateOne(
        { _id: new Types.ObjectId(result.versionId) },
        {
          $set: {
            state: ContractVersionState.Offered,
            offeredAt: new Date(),
            expiresAt: new Date(Date.now() + 60000),
          },
        },
      );
      const version = await versions.findById(result.versionId).lean();
      if (!version) throw new Error('Test version missing');
      return { service, result, version };
    }

    const dto = (
      version: ContractVersion & { _id: Types.ObjectId },
      action: ContractConsentAction,
      idempotencyKey = randomUUID(),
    ) => ({
      contractVersionId: version._id.toString(),
      action,
      contentHash: version.contentHash,
      bookingFingerprint: version.bookingFingerprint,
      idempotencyKey,
    });

    it('guards missing consent, incomplete multi-provider acceptance and stale version', async () => {
      const data = await seed(2);
      const first = await offered(data, 0);
      await expect(
        first.service.checkout.evaluate(
          data.bookingId.toString(),
          100,
          PaymentPurpose.FullPayment,
        ),
      ).rejects.toThrow('CONTRACT_VERSION_NOT_ACCEPTED');
      await first.service.consent.decide(
        user(data.customerId),
        first.result.contractId,
        dto(first.version, ContractConsentAction.Accept),
      );
      await expect(
        first.service.checkout.evaluate(
          data.bookingId.toString(),
          100,
          PaymentPurpose.FullPayment,
        ),
      ).rejects.toThrow('CONTRACT_MISSING');

      const second = await offered(data, 1);
      await second.service.consent.decide(
        user(data.customerId),
        second.result.contractId,
        dto(second.version, ContractConsentAction.Accept),
      );
      const ready = await first.service.checkout.evaluate(
        data.bookingId.toString(),
        100,
        PaymentPurpose.FullPayment,
      );
      expect(ready.binding?.versions).toHaveLength(2);

      await connection
        .db!.collection('digital_contracts')
        .updateOne(
          { _id: new Types.ObjectId(first.result.contractId) },
          { $set: { currentVersionId: oid() } },
        );
      await expect(
        first.service.checkout.evaluate(
          data.bookingId.toString(),
          100,
          PaymentPurpose.FullPayment,
        ),
      ).rejects.toThrow('CONTRACT_VERSION_NOT_ACCEPTED');
    });

    it('rejects a changed booking fingerprint and revoked AUTO acceptance', async () => {
      const data = await seed();
      const offer = await offered(data);
      await offer.service.consent.decide(
        user(data.customerId),
        offer.result.contractId,
        dto(offer.version, ContractConsentAction.Accept),
      );
      await expect(
        offer.service.checkout.evaluate(
          data.bookingId.toString(),
          100,
          PaymentPurpose.FullPayment,
        ),
      ).resolves.toMatchObject({ binding: { flowVersion: 2 } });
      const providerId = data.providerIds[0];
      const original = data.snapshots.get(providerId.toString())!;
      data.snapshots.set(providerId.toString(), {
        ...original,
        providerItems: [
          { bookingItemId: data.itemIds[0].toString(), size: 'XL' },
        ],
      });
      await expect(
        offer.service.checkout.evaluate(
          data.bookingId.toString(),
          100,
          PaymentPurpose.FullPayment,
        ),
      ).rejects.toThrow('CONTRACT_SNAPSHOT_STALE');
      data.snapshots.set(providerId.toString(), original);
      await acceptances.updateOne(
        { providerId, status: 'ACTIVE' },
        { $set: { status: 'REVOKED', revokedAt: new Date() } },
      );
      await expect(
        offer.service.checkout.evaluate(
          data.bookingId.toString(),
          100,
          PaymentPurpose.FullPayment,
        ),
      ).rejects.toThrow('PROVIDER_AUTO_ACCEPTANCE_MISSING');
    });

    it('finalizes a paid V2 booking once with inventory, escrow and in-app notification in one transaction', async () => {
      const data = await seed();
      await bookings.updateOne({ _id: data.bookingId }, { $set: {
        pricingSummary: { grandTotal: 100, depositTotal: 0 },
        paymentSummary: { totalPaid: 0, totalRefunded: 0, paymentStatus: 'UNPAID' },
      } });
      const snapshot = data.snapshots.get(data.providerIds[0].toString())!;
      data.snapshots.set(data.providerIds[0].toString(), {
        ...snapshot,
        pricing: { grandTotal: 100 },
      });
      const offer = await offered(data);
      await offer.service.consent.decide(
        user(data.customerId), offer.result.contractId,
        dto(offer.version, ContractConsentAction.Accept),
      );
      const decision = await offer.service.checkout.evaluate(
        data.bookingId.toString(), 100, PaymentPurpose.FullPayment,
      );
      const binding = decision.binding!;
      const paymentId = oid();
      const key = contractIntentKey(binding);
      await payments.create({
        _id: paymentId, bookingId: data.bookingId,
        paymentCode: `FINAL-${paymentId.toString()}`,
        amount: 100, purpose: PaymentPurpose.FullPayment,
        status: PaymentStatus.Success, paidAt: new Date(),
        contractBinding: binding, contractIntentKey: key,
      });
      await bookings.updateOne({ _id: data.bookingId }, { $set: {
        paymentExpiryClaim: {
          phase: 'FINALIZING', token: randomUUID(),
          claimedAt: new Date(), leaseUntil: new Date(Date.now() + 60000),
          paymentId,
        },
      } });
      const recovery = new PaymentRecoveryService(true, recoveries, payments, bookings);
      await recovery.recordAcknowledged(paymentId, data.bookingId, key);
      const finalizer = new V2PaymentFinalizationService(
        true, bookings, bookingItems, schedules, reservations, payments,
        recoveries, escrows, notifications, contracts, versions, consents,
        { confirmForBooking: jest.fn().mockResolvedValue({ confirmed: true }) } as never,
        { findRedemptionByBooking: jest.fn().mockResolvedValue(null) } as never,
        recovery, offer.service.policy, offer.service.preparation,
        offer.service.snapshotService as never,
        { getApproved: () => template } as never,
      );
      expect(await finalizer.processDue()).toBe(1);
      expect((await bookings.findById(data.bookingId).lean())?.status).toBe(BookingStatus.Confirmed);
      expect((await recoveries.findOne({ paymentId }).lean())?.state).toBe(PaymentRecoveryState.Completed);
      expect((await reservations.findOne({ bookingId: data.bookingId }).lean())?.status).toBe(ReservationStatus.Confirmed);
      expect(await escrows.countDocuments({ bookingId: data.bookingId })).toBe(1);
      expect(await notifications.countDocuments({ userId: data.customerId, 'metadata.paymentId': paymentId })).toBe(1);
      expect(await finalizer.processDue()).toBe(0);
      expect(await notifications.countDocuments({ userId: data.customerId, 'metadata.paymentId': paymentId })).toBe(1);
    });

    it('prepares one and two provider contracts, reuses versions and preserves prior snapshot on change', async () => {
      const data = await seed(2);
      const { preparation } = services(data);
      const first = await preparation.prepare(
        data.bookingId.toString(),
        data.providerIds[0].toString(),
      );
      const retry = await preparation.prepare(
        data.bookingId.toString(),
        data.providerIds[0].toString(),
      );
      const second = await preparation.prepare(
        data.bookingId.toString(),
        data.providerIds[1].toString(),
      );
      expect(retry).toMatchObject({ versionId: first.versionId, reused: true });
      expect(second.contractId).not.toBe(first.contractId);
      const oldVersion = await versions.findById(first.versionId).lean();
      await connection.db!.collection('bookings').updateOne(
        { _id: data.bookingId },
        {
          $set: {
            pricingSummary: { rentalTotal: 200000 },
            updatedAt: new Date(),
          },
        },
      );
      await connection
        .db!.collection('booking_items')
        .updateOne(
          { _id: data.itemIds[0] },
          { $set: { selectedSize: 'L', updatedAt: new Date() } },
        );
      const changed = {
        ...data.snapshots.get(data.providerIds[0].toString())!,
        providerItems: [
          { bookingItemId: data.itemIds[0].toString(), size: 'L' },
        ],
        pricing: { rentalTotal: 200000 },
      };
      data.snapshots.set(data.providerIds[0].toString(), changed);
      const next = await preparation.prepare(
        data.bookingId.toString(),
        data.providerIds[0].toString(),
      );
      expect(next).toMatchObject({
        contractId: first.contractId,
        version: 2,
        reused: false,
      });
      expect(
        (await versions.findById(first.versionId).lean())?.snapshot,
      ).toEqual(oldVersion?.snapshot);
      expect(
        await contracts.countDocuments({ bookingId: data.bookingId }),
      ).toBe(2);
      expect(
        await versions.countDocuments({
          contractId: new Types.ObjectId(first.contractId),
        }),
      ).toBe(2);
    });

    it('refuses prepare when the stable index is missing, then survives concurrent prepare without duplicates', async () => {
      const data = await seed();
      const { preparation } = services(data);
      await connection
        .db!.collection('digital_contracts')
        .dropIndex('booking_provider_scope_unique');
      try {
        await expect(
          preparation.prepare(
            data.bookingId.toString(),
            data.providerIds[0].toString(),
          ),
        ).rejects.toThrow('CONTRACT_INDEX_MIGRATION_REQUIRED');
        expect(
          await contracts.countDocuments({ bookingId: data.bookingId }),
        ).toBe(0);
      } finally {
        await connection
          .db!.collection('digital_contracts')
          .createIndex(
            { bookingId: 1, providerId: 1, scope: 1 },
            { unique: true, name: 'booking_provider_scope_unique' },
          );
      }
      const raced = await Promise.allSettled([
        preparation.prepare(
          data.bookingId.toString(),
          data.providerIds[0].toString(),
        ),
        preparation.prepare(
          data.bookingId.toString(),
          data.providerIds[0].toString(),
        ),
      ]);
      expect(raced.some((entry) => entry.status === 'fulfilled')).toBe(true);
      expect(
        await contracts.countDocuments({ bookingId: data.bookingId }),
      ).toBe(1);
      expect(
        await versions.countDocuments({
          contractId: (await contracts.findOne({ bookingId: data.bookingId }))!
            ._id,
        }),
      ).toBe(1);
    });

    it('commits ACCEPT once, returns same-key retry, and rejects new key or opposite decision', async () => {
      const data = await seed();
      const { service, result, version } = await offered(data);
      const request = dto(version, ContractConsentAction.Accept);
      const first = await service.consent.decide(
        user(data.customerId),
        result.contractId,
        request,
      );
      expect(
        await service.consent.decide(
          user(data.customerId),
          result.contractId,
          request,
        ),
      ).toEqual(first);
      await expect(
        service.consent.decide(user(data.customerId), result.contractId, {
          ...request,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow('CONTRACT_CONSENT_ALREADY_DECIDED');
      await expect(
        service.consent.decide(user(data.customerId), result.contractId, {
          ...request,
          action: ContractConsentAction.Decline,
        }),
      ).rejects.toThrow('CONTRACT_CONSENT_ALREADY_DECIDED');
      expect(
        await consents.countDocuments({ contractVersionId: version._id }),
      ).toBe(1);
      expect((await versions.findById(version._id).lean())?.state).toBe(
        ContractVersionState.Accepted,
      );
      const audit = await consents
        .findOne({ contractVersionId: version._id })
        .lean();
      expect(audit).toMatchObject({
        actorUserId: data.customerId,
        action: 'ACCEPT',
        authenticationMethod: 'APP_SESSION',
      });
      expect(JSON.stringify(audit)).not.toMatch(/jwt|refreshToken|bearer/i);
    });

    it('commits DECLINE and prevents a later ACCEPT on that version', async () => {
      const data = await seed();
      const { service, result, version } = await offered(data);
      const declined = dto(version, ContractConsentAction.Decline);
      const decision = await service.consent.decide(
        user(data.customerId),
        result.contractId,
        declined,
      );
      expect(decision.action).toBe(ContractConsentAction.Decline);
      await expect(
        service.consent.decide(
          user(data.customerId),
          result.contractId,
          dto(version, ContractConsentAction.Accept),
        ),
      ).rejects.toThrow('CONTRACT_CONSENT_ALREADY_DECIDED');
      expect(
        await consents.countDocuments({ contractVersionId: version._id }),
      ).toBe(1);
      expect((await versions.findById(version._id).lean())?.state).toBe(
        ContractVersionState.Declined,
      );
    });

    it('permits only one decision for concurrent ACCEPT/ACCEPT and ACCEPT/DECLINE', async () => {
      for (const actions of [
        [ContractConsentAction.Accept, ContractConsentAction.Accept],
        [ContractConsentAction.Accept, ContractConsentAction.Decline],
      ]) {
        const data = await seed();
        const { service, result, version } = await offered(data);
        const raced = await Promise.allSettled(
          actions.map((action) =>
            service.consent.decide(
              user(data.customerId),
              result.contractId,
              dto(version, action),
            ),
          ),
        );
        expect(raced.some((entry) => entry.status === 'fulfilled')).toBe(true);
        const saved = await consents
          .find({ contractVersionId: version._id })
          .lean();
        expect(saved).toHaveLength(1);
        expect((await versions.findById(version._id).lean())?.state).toBe(
          saved[0].action === ContractConsentAction.Accept
            ? ContractVersionState.Accepted
            : ContractVersionState.Declined,
        );
      }
    });

    it('rejects stale version/fingerprint, wrong customer and revoked provider without consent rows', async () => {
      const data = await seed();
      const { service, result, version } = await offered(data);
      const base = dto(version, ContractConsentAction.Accept);
      await expect(
        service.consent.decide(user(oid()), result.contractId, base),
      ).rejects.toThrow('CONTRACT_NOT_FOUND');
      await expect(
        service.consent.decide(user(data.customerId), result.contractId, {
          ...base,
          bookingFingerprint: '0'.repeat(64),
        }),
      ).rejects.toThrow('CONTRACT_CONTENT_CHANGED');
      await expect(
        service.consent.decide(user(data.customerId), result.contractId, {
          ...base,
          contentHash: '0'.repeat(64),
        }),
      ).rejects.toThrow('CONTRACT_CONTENT_CHANGED');
      await expect(
        service.consent.decide(user(data.customerId), result.contractId, {
          ...base,
          contractVersionId: oid().toString(),
        }),
      ).rejects.toThrow('CONTRACT_VERSION_STALE');
      await acceptances.updateOne(
        { providerId: data.providerIds[0] },
        { $set: { status: 'REVOKED', revokedAt: new Date() } },
      );
      await expect(
        service.consent.decide(user(data.customerId), result.contractId, base),
      ).rejects.toThrow('PROVIDER_AUTO_ACCEPTANCE_MISSING');
      expect(
        await consents.countDocuments({ contractVersionId: version._id }),
      ).toBe(0);
      expect((await versions.findById(version._id).lean())?.state).toBe(
        ContractVersionState.Offered,
      );
    });

    it('rolls back when booking expires after first read or a transaction write throws', async () => {
      const data = await seed();
      const { service, result, version } = await offered(data);
      const base = dto(version, ContractConsentAction.Accept);
      service.snapshotService.build.mockImplementationOnce(async () => {
        await connection
          .db!.collection('bookings')
          .updateOne(
            { _id: data.bookingId },
            { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
          );
        return data.snapshots.get(data.providerIds[0].toString());
      });
      await expect(
        service.consent.decide(user(data.customerId), result.contractId, base),
      ).rejects.toThrow();
      expect(
        await consents.countDocuments({ contractVersionId: version._id }),
      ).toBe(0);
      expect((await versions.findById(version._id).lean())?.state).toBe(
        ContractVersionState.Offered,
      );
      await connection
        .db!.collection('bookings')
        .updateOne(
          { _id: data.bookingId },
          { $set: { holdExpiresAt: new Date(Date.now() + 60000) } },
        );
      const failure = jest
        .spyOn(versions, 'updateOne')
        .mockRejectedValueOnce(new Error('TEST_WRITE_FAILURE'));
      try {
        await expect(
          service.consent.decide(
            user(data.customerId),
            result.contractId,
            base,
          ),
        ).rejects.toThrow('TEST_WRITE_FAILURE');
      } finally {
        failure.mockRestore();
      }
      expect(
        await consents.countDocuments({ contractVersionId: version._id }),
      ).toBe(0);
      expect((await versions.findById(version._id).lean())?.state).toBe(
        ContractVersionState.Offered,
      );
    });

    it('blocks cross-booking/provider reads and rejects a forged actor field', async () => {
      const data = await seed(2);
      const first = await offered(data, 0);
      const second = await offered(data, 1);
      await expect(
        first.service.read.get(user(oid()), first.result.contractId),
      ).rejects.toThrow('CONTRACT_NOT_FOUND');
      await expect(
        first.service.read.get(
          user(data.providerUserIds[0]),
          second.result.contractId,
        ),
      ).rejects.toThrow('CONTRACT_NOT_FOUND');
      await expect(
        first.service.consent.decide(
          user(data.providerUserIds[0]),
          first.result.contractId,
          dto(first.version, ContractConsentAction.Accept),
        ),
      ).rejects.toThrow('CONTRACT_NOT_FOUND');
      const pipe = new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      await expect(
        pipe.transform(
          {
            ...dto(first.version, ContractConsentAction.Accept),
            actorUserId: data.customerId.toString(),
          },
          { type: 'body', metatype: ContractConsentDto },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(
        await consents.countDocuments({ contractVersionId: first.version._id }),
      ).toBe(0);
    });

    it('scopes idempotency keys to the authenticated customer', async () => {
      const firstData = await seed();
      const secondData = await seed();
      const first = await offered(firstData);
      const second = await offered(secondData);
      const sharedKey = randomUUID();
      await first.service.consent.decide(
        user(firstData.customerId),
        first.result.contractId,
        dto(first.version, ContractConsentAction.Accept, sharedKey),
      );
      await second.service.consent.decide(
        user(secondData.customerId),
        second.result.contractId,
        dto(second.version, ContractConsentAction.Accept, sharedKey),
      );
      expect(await consents.countDocuments({ idempotencyKey: sharedKey })).toBe(
        2,
      );
      expect(
        await consents.countDocuments({
          actorUserId: firstData.customerId,
          idempotencyKey: sharedKey,
        }),
      ).toBe(1);
      expect(
        await consents.countDocuments({
          actorUserId: secondData.customerId,
          idempotencyKey: sharedKey,
        }),
      ).toBe(1);
    });
  },
);
