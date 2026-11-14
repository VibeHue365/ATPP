import {
  assertSafeTestMongoUri,
  assertSafeTestConnection,
  sanitizeMongoUriForLogging,
} from './mongo-test-safety-guard';

describe('MongoTestSafetyGuard', () => {
  describe('assertSafeTestMongoUri', () => {
    it('prohibits mongodb+srv:// connection scheme', () => {
      expect(() =>
        assertSafeTestMongoUri('mongodb+srv://admin:secret123@cluster0.mongodb.net/contract_test'),
      ).toThrow(/mongodb\+srv is strictly prohibited/);
    });

    it('prohibits MongoDB Atlas host (*.mongodb.net)', () => {
      expect(() =>
        assertSafeTestMongoUri('mongodb://admin:secret123@cluster0.mongodb.net:27017/slot_lease_test'),
      ).toThrow(/Atlas host \(\*\.mongodb\.net\) is strictly prohibited/);
    });

    it('prohibits remote IP and non-whitelisted hostnames', () => {
      expect(() =>
        assertSafeTestMongoUri('mongodb://192.168.1.50:27017/contract_test'),
      ).toThrow(/NOT an allowed local test host/);

      expect(() =>
        assertSafeTestMongoUri('mongodb://production-db.internal:27017/slot_test'),
      ).toThrow(/NOT an allowed local test host/);
    });

    it('prohibits production and dev databases', () => {
      expect(() =>
        assertSafeTestMongoUri('mongodb://127.0.0.1:27028/vibehue'),
      ).toThrow(/Unsafe database name/);

      expect(() =>
        assertSafeTestMongoUri('mongodb://127.0.0.1:27028/dev'),
      ).toThrow(/Unsafe database name/);

      expect(() =>
        assertSafeTestMongoUri('mongodb://localhost:27028/production_test'),
      ).toThrow(/Unsafe database name/);

      expect(() =>
        assertSafeTestMongoUri('mongodb://localhost:27028/my_database'),
      ).toThrow(/Unsafe database name/);
    });

    it('allows valid local test targets ending in _test', () => {
      const res = assertSafeTestMongoUri('mongodb://127.0.0.1:27028/contract_integration_test');
      expect(res.hostname).toBe('127.0.0.1');
      expect(res.databaseName).toBe('contract_integration_test');
      expect(res.port).toBe('27028');
    });

    it('allows explicit slot_lease_concurrency_test database on localhost', () => {
      const res = assertSafeTestMongoUri('mongodb://localhost:27028/slot_lease_concurrency_test?replicaSet=rsContractTest');
      expect(res.hostname).toBe('localhost');
      expect(res.databaseName).toBe('slot_lease_concurrency_test');
    });

    it('masks credentials for safe logging', () => {
      const masked = sanitizeMongoUriForLogging('mongodb://admin:SuperSecretPass@127.0.0.1:27028/contract_test');
      expect(masked).not.toContain('SuperSecretPass');
      expect(masked).toContain('***:***');
    });
  });

  describe('assertSafeTestConnection', () => {
    it('throws when connection is null', () => {
      expect(() => assertSafeTestConnection(null)).toThrow(/Connection is null or undefined/);
    });

    it('throws when connection host is remote', () => {
      expect(() =>
        assertSafeTestConnection({ host: '192.168.1.100', name: 'app_test' }),
      ).toThrow(/Unsafe connection host/);
    });

    it('throws when connection database name does not end with _test', () => {
      expect(() =>
        assertSafeTestConnection({ host: '127.0.0.1:27028', name: 'vibehue_dev' }),
      ).toThrow(/Unsafe connection database name/);
    });

    it('passes for safe local test connection', () => {
      expect(() =>
        assertSafeTestConnection({ host: '127.0.0.1:27028', name: 'slot_lease_concurrency_test' }),
      ).not.toThrow();

      expect(() =>
        assertSafeTestConnection({ host: 'localhost:27028', name: 'contract_phase5c_test' }),
      ).not.toThrow();
    });
  });
});
