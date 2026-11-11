/** A hard gate for integration tests with writes. No implicit application URI fallback. */
export function contractTestTarget(): {
  uri: string;
  databaseName: string;
} | null {
  const uri = process.env.CONTRACT_TEST_MONGODB_URI;
  const databaseName = process.env.CONTRACT_TEST_DB_NAME;
  if (!uri && !databaseName) return null;
  if (!uri || !databaseName)
    throw new Error(
      'Both CONTRACT_TEST_MONGODB_URI and CONTRACT_TEST_DB_NAME are required',
    );
  const parsed = new URL(uri);
  const uriDatabase = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.port !== '27028' ||
    !databaseName.includes('contract') ||
    !databaseName.endsWith('_test') ||
    uriDatabase !== databaseName ||
    parsed.searchParams.get('replicaSet') !== 'rsContractTest'
  )
    throw new Error(
      'Contract tests require the isolated local replica set on port 27028 and an explicit contract *_test database',
    );
  return { uri, databaseName };
}
