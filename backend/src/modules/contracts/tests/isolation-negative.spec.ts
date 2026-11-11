import { contractTestTarget } from '../contract-test-target';
import { installNetworkGuard } from './fixtures/synthetic-contract.fixture';
import { ContractPreparationService } from '../contract-preparation.service';
import { ContractCheckoutGuard } from '../contract-checkout-guard.service';
import { V2PaymentFinalizationService } from '../../payments/services/v2-payment-finalization.service';
import { ServiceUnavailableException, FinalizationReviewError } from '@nestjs/common';
import { Types } from 'mongoose';

describe('P0 Environment Isolation Negative Tests', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. MongoDB Hard Gate (contractTestTarget)', () => {
    it('rejects MongoDB Atlas sentinel URI with remote host', () => {
      process.env.CONTRACT_TEST_MONGODB_URI =
        'mongodb+srv://sentinel_user:fake_password@cluster0.fake.mongodb.net/vibehue_db?replicaSet=rsContractTest';
      process.env.CONTRACT_TEST_DB_NAME = 'vibehue_db';

      expect(() => contractTestTarget()).toThrow(
        /Contract tests require the isolated local replica set on port 27028/,
      );
    });

    it('rejects standard MongoDB port 27017 instead of isolated port 27028', () => {
      process.env.CONTRACT_TEST_MONGODB_URI =
        'mongodb://127.0.0.1:27017/contract_unit_test?replicaSet=rsContractTest';
      process.env.CONTRACT_TEST_DB_NAME = 'contract_unit_test';

      expect(() => contractTestTarget()).toThrow(
        /Contract tests require the isolated local replica set on port 27028/,
      );
    });

    it('rejects incorrect replica set name (e.g. rsDefault instead of rsContractTest)', () => {
      process.env.CONTRACT_TEST_MONGODB_URI =
        'mongodb://127.0.0.1:27028/contract_unit_test?replicaSet=rsDefault';
      process.env.CONTRACT_TEST_DB_NAME = 'contract_unit_test';

      expect(() => contractTestTarget()).toThrow(
        /Contract tests require the isolated local replica set on port 27028/,
      );
    });

    it('rejects production database name (vibehue_db)', () => {
      process.env.CONTRACT_TEST_MONGODB_URI =
        'mongodb://127.0.0.1:27028/vibehue_db?replicaSet=rsContractTest';
      process.env.CONTRACT_TEST_DB_NAME = 'vibehue_db';

      expect(() => contractTestTarget()).toThrow(
        /explicit contract \*_test database/,
      );
    });

    it('rejects mismatched databaseName and URI pathname', () => {
      process.env.CONTRACT_TEST_MONGODB_URI =
        'mongodb://127.0.0.1:27028/contract_a_test?replicaSet=rsContractTest';
      process.env.CONTRACT_TEST_DB_NAME = 'contract_b_test';

      expect(() => contractTestTarget()).toThrow(
        /Contract tests require the isolated local replica set on port 27028/,
      );
    });
  });

  describe('2. In-Process Outbound Network Guard', () => {
    let uninstall: () => void;

    beforeAll(() => {
      uninstall = installNetworkGuard();
    });

    afterAll(() => {
      if (uninstall) uninstall();
    });

    it('blocks outbound fetch to PayOS production domain', () => {
      expect(() =>
        globalThis.fetch('https://api-merchant.payos.vn/v2/payment-requests', {
          method: 'POST',
        }),
      ).toThrow(/BLOCKED_OUTBOUND_NETWORK_ATTEMPT.*payos\.vn/);
    });

    it('blocks outbound fetch to MongoDB Atlas hostname', () => {
      expect(() =>
        globalThis.fetch('https://cluster0.fake.mongodb.net/health'),
      ).toThrow(/BLOCKED_OUTBOUND_NETWORK_ATTEMPT.*cluster0/);
    });
  });

  describe('3. Feature Flag Fail-Closed Hard Gates', () => {
    it('ContractPreparationService fails closed when CONTRACTS_V2_ENABLED=false', async () => {
      const service = new ContractPreparationService(
        false, // enabled = false
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
      );

      await expect(
        service.prepare('any-booking-id', 'any-provider-id'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('ContractCheckoutGuard fails closed when CONTRACTS_V2_ENABLED=false', async () => {
      const mockPolicy = {
        getContext: jest.fn().mockResolvedValue({
          booking: { contractFlowVersion: 2, bookingType: 'AODAI_RENTAL' },
          rentalProviderIds: [new Types.ObjectId()],
        }),
      };
      const guard = new ContractCheckoutGuard(
        false, // enabled = false
        null as never,
        null as never,
        null as never,
        mockPolicy as never,
        null as never,
        null as never,
        null as never,
        null as never,
      );

      await expect(
        guard.evaluate('any-booking-id', 100000, 'DEPOSIT' as never),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('V2PaymentFinalizationService fails closed when CONTRACTS_V2_ENABLED=false', async () => {
      const finalization = new V2PaymentFinalizationService(
        false, // enabled = false
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
      );

      expect(await finalization.processPayment(new Types.ObjectId())).toBe(false);
      expect(await finalization.processDue()).toBe(0);
      await expect(
        finalization.finalize(new Types.ObjectId(), 'token'),
      ).rejects.toThrow(FinalizationReviewError);
    });
  });
});
