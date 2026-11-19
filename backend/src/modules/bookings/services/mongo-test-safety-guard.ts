export interface SafeMongoTarget {
  sanitizedUri: string;
  hostname: string;
  port: number | string;
  databaseName: string;
}

export const ALLOWED_LOCAL_TEST_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'contract-mongo',
  'mongo',
]);

/**
 * Mask credentials in MongoDB connection string for safe logging.
 */
export function sanitizeMongoUriForLogging(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return uri.replace(/\/\/[^@]+@/, '//***:***@');
  }
}

/**
 * Assert that the MongoDB URI is strictly pointing to an isolated local test instance.
 * Prohibits Atlas, remote hosts, non-test database names, and mongodb+srv.
 */
export function assertSafeTestMongoUri(uriString: string): SafeMongoTarget {
  if (!uriString || typeof uriString !== 'string') {
    throw new Error(
      '[DB SAFETY GUARD] MongoDB test URI is required and must be a string.',
    );
  }

  // 1. Prohibit remote scheme mongodb+srv
  if (uriString.startsWith('mongodb+srv://')) {
    throw new Error(
      `[DB SAFETY GUARD] Remote connection scheme mongodb+srv is strictly prohibited for integration tests: ${sanitizeMongoUriForLogging(uriString)}`,
    );
  }

  // 2. Prohibit Atlas and known remote domains
  if (uriString.includes('mongodb.net')) {
    throw new Error(
      `[DB SAFETY GUARD] MongoDB Atlas host (*.mongodb.net) is strictly prohibited for integration tests!`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(uriString);
  } catch (err: any) {
    throw new Error(`[DB SAFETY GUARD] Malformed MongoDB URI: ${err.message}`);
  }

  if (parsed.protocol !== 'mongodb:') {
    throw new Error(
      `[DB SAFETY GUARD] Invalid scheme "${parsed.protocol}". Only mongodb: is allowed.`,
    );
  }

  // 3. Prohibit non-local hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_LOCAL_TEST_HOSTS.has(hostname)) {
    throw new Error(
      `[DB SAFETY GUARD] Host "${hostname}" is NOT an allowed local test host. Allowed: ${Array.from(ALLOWED_LOCAL_TEST_HOSTS).join(', ')}. Remote database access is forbidden!`,
    );
  }

  // 4. Validate database name: must end with _test or be exactly slot_lease_concurrency_test
  const rawDb = decodeURIComponent(parsed.pathname.replace(/^\//, '')).trim();
  if (!rawDb) {
    throw new Error(
      '[DB SAFETY GUARD] Integration test URI must specify a target database name in pathname.',
    );
  }

  const isDevOrProd =
    rawDb.includes('prod') ||
    rawDb.includes('production') ||
    rawDb === 'vibehue' ||
    rawDb === 'dev' ||
    rawDb.startsWith('dev_');

  const isValidDbName =
    !isDevOrProd &&
    (rawDb === 'slot_lease_concurrency_test' || rawDb.endsWith('_test'));

  if (!isValidDbName) {
    throw new Error(
      `[DB SAFETY GUARD] Unsafe database name "${rawDb}". Integration test database name MUST end with "_test" or equal "slot_lease_concurrency_test", and must NOT be dev/prod database.`,
    );
  }

  return {
    sanitizedUri: sanitizeMongoUriForLogging(uriString),
    hostname,
    port: parsed.port || 27017,
    databaseName: rawDb,
  };
}

/**
 * Assert that an active connection points to a safe local test database before destructive operations (e.g. dropDatabase).
 */
export function assertSafeTestConnection(
  connection: { host?: string; name?: string } | null | undefined,
): void {
  if (!connection) {
    throw new Error('[DB SAFETY GUARD] Connection is null or undefined.');
  }

  const host = (connection.host || '').toLowerCase();
  const hostWithoutPort = host.split(':')[0];
  if (!ALLOWED_LOCAL_TEST_HOSTS.has(hostWithoutPort)) {
    throw new Error(
      `[DB SAFETY GUARD] Unsafe connection host "${connection.host}". Refusing destructive operation.`,
    );
  }

  const dbName = (connection.name || '').trim();
  const isDevOrProd =
    dbName.includes('prod') ||
    dbName.includes('production') ||
    dbName === 'vibehue' ||
    dbName === 'dev' ||
    dbName.startsWith('dev_');

  const isValidDbName =
    !isDevOrProd &&
    (dbName === 'slot_lease_concurrency_test' || dbName.endsWith('_test'));

  if (!isValidDbName) {
    throw new Error(
      `[DB SAFETY GUARD] Unsafe connection database name "${connection.name}". Refusing destructive operation.`,
    );
  }
}
