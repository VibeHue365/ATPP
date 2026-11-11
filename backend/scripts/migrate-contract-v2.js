/*
 * Phase 2 legacy audit/backfill. This script never creates or drops indexes.
 * It never reads backend/.env as its target connection. Supply an explicit URI:
 *   CONTRACT_MIGRATION_URI=... node scripts/migrate-contract-v2.js --dry-run
 * Test database only, after reviewing the dry-run output:
 *   CONTRACT_MIGRATION_URI=... node scripts/migrate-contract-v2.js --apply --test-db=NAME --allow-test-write --expected-fingerprint=HASH
 * Do not use the configured application database for --apply.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

const RENTAL_SCOPE = 'AO_DAI_RENTAL';

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right);
}

function classifyLegacyContract(contract, booking, productItemCount) {
  if (
    !contract._id ||
    !contract.bookingId ||
    !contract.providerId ||
    !contract.customerId ||
    !contract.contractCode
  ) {
    throw new Error('Legacy contract lacks required identity fields');
  }
  if (!booking || !['AODAI_RENTAL', 'COMBO'].includes(booking.bookingType)) {
    throw new Error('Legacy contract has no eligible rental booking');
  }
  if (!sameId(booking.customerId, contract.customerId)) {
    throw new Error('Legacy contract customer does not match booking');
  }
  if (
    !booking.providerIds?.some((providerId) =>
      sameId(providerId, contract.providerId),
    )
  ) {
    throw new Error('Legacy contract provider does not belong to booking');
  }
  if (
    contract.flowVersion !== 2 &&
    booking.contractId &&
    !sameId(booking.contractId, contract._id)
  ) {
    throw new Error('Booking.contractId points to another contract');
  }
  if (productItemCount < 1) {
    throw new Error('Legacy contract provider has no rental item in booking');
  }
  if (contract.flowVersion === 2) {
    if (contract.scope !== RENTAL_SCOPE || !contract.approvalMode)
      throw new Error('V2 contract lacks scope or approval mode');
    return 'V2_UNCHANGED';
  }
  if (contract.flowVersion === 1 && contract.scope === RENTAL_SCOPE) {
    return 'LEGACY_ALREADY_MARKED';
  }
  if (contract.flowVersion != null || contract.scope != null) {
    throw new Error(
      'Legacy contract has a partial or unexpected migration marker',
    );
  }
  if (!['DRAFT', 'SIGNED', 'VOID'].includes(contract.status)) {
    throw new Error('Legacy contract has an unknown status');
  }
  return 'MARK_LEGACY';
}

function configuredApplicationUri() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return null;
  return dotenv.parse(fs.readFileSync(envPath)).MONGODB_URI || null;
}

function assertTestApplyTarget(targetUri, databaseName, args, applicationUri) {
  if (!args.includes('--allow-test-write'))
    throw new Error('--apply requires --allow-test-write');
  const expectedName = args
    .find((arg) => arg.startsWith('--test-db='))
    ?.slice('--test-db='.length);
  if (!expectedName || expectedName !== databaseName)
    throw new Error(
      '--apply requires --test-db=NAME matching the connected database',
    );
  if (!databaseName.includes('contract') || !databaseName.endsWith('_test'))
    throw new Error('--apply requires a dedicated contract *_test database');
  if (applicationUri && targetUri === applicationUri)
    throw new Error('Refusing to write to backend/.env database');
  if (applicationUri) {
    const applicationName = new URL(applicationUri).pathname
      .replace(/^\//, '')
      .split('?')[0];
    if (applicationName && applicationName === databaseName)
      throw new Error('Refusing to write to application database name');
  }
}

function fingerprintContracts(rows) {
  const identities = rows.map((row) => [
    String(row._id),
    String(row.bookingId),
    String(row.providerId),
    row.scope ?? null,
    row.flowVersion ?? null,
    row.status ?? null,
    row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  ]);
  identities.sort((left, right) => left[0].localeCompare(right[0]));
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(identities))
    .digest('hex');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--apply') && args.includes('--dry-run'))
    throw new Error('Choose either --apply or --dry-run');
  const apply = args.includes('--apply');
  const testFailAfterArg = args.find((arg) =>
    arg.startsWith('--test-fail-after='),
  );
  if (testFailAfterArg && !apply)
    throw new Error('--test-fail-after is only valid with test database --apply');
  const testFailAfter = testFailAfterArg
    ? Number(testFailAfterArg.slice('--test-fail-after='.length))
    : null;
  if (testFailAfter !== null && (!Number.isInteger(testFailAfter) || testFailAfter < 1))
    throw new Error('--test-fail-after must be a positive integer');
  const uri = process.env.CONTRACT_MIGRATION_URI;
  if (!uri)
    throw new Error(
      'Set CONTRACT_MIGRATION_URI explicitly; backend/.env is never used as a target',
    );
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 8000,
  });
  try {
    await client.connect();
    const db = client.db();
    if (apply)
      assertTestApplyTarget(
        uri,
        db.databaseName,
        args,
        configuredApplicationUri(),
      );
    const contracts = db.collection('digital_contracts');
    const bookings = db.collection('bookings');
    const items = db.collection('booking_items');
    const rows = await contracts.find({}, { maxTimeMS: 10000 }).toArray();
    const fingerprint = fingerprintContracts(rows);
    const report = {
      mode: apply ? 'TEST_DATABASE_APPLY' : 'DRY_RUN',
      database: db.databaseName,
      contracts: rows.length,
      fingerprint,
      legacyToMark: 0,
      legacyAlreadyMarked: 0,
      v2Unchanged: 0,
      conflicts: [],
      existingIndexNames: (await contracts.indexes({ maxTimeMS: 10000 })).map(
        (index) => index.name,
      ),
      indexesChanged: false,
    };
    const seenKeys = new Set();
    const updates = [];
    for (const row of rows) {
      const booking = await bookings.findOne(
        { _id: row.bookingId },
        { maxTimeMS: 10000 },
      );
      const productItemCount = await items.countDocuments(
        {
          bookingId: row.bookingId,
          providerId: row.providerId,
          itemType: 'PRODUCT',
        },
        { maxTimeMS: 10000 },
      );
      try {
        const classification = classifyLegacyContract(
          row,
          booking,
          productItemCount,
        );
        const key = `${row.bookingId}:${row.providerId}:${RENTAL_SCOPE}`;
        if (seenKeys.has(key))
          throw new Error('Duplicate booking-provider-scope candidate');
        seenKeys.add(key);
        if (classification === 'MARK_LEGACY') {
          report.legacyToMark++;
          updates.push(row._id);
        } else if (classification === 'LEGACY_ALREADY_MARKED')
          report.legacyAlreadyMarked++;
        else report.v2Unchanged++;
      } catch (error) {
        // The report intentionally omits customer information and document contents.
        report.conflicts.push({
          contractCode: row.contractCode || null,
          reason: error.message,
        });
      }
    }
    console.log(JSON.stringify(report, null, 2));
    if (report.conflicts.length)
      throw new Error('Validation failed; no writes performed');
    if (!apply) return;
    const expected = args
      .find((arg) => arg.startsWith('--expected-fingerprint='))
      ?.slice('--expected-fingerprint='.length);
    if (!expected || expected !== fingerprint)
      throw new Error(
        'Dataset changed or dry-run fingerprint was not supplied; no writes performed',
      );
    let applied = 0;
    for (const id of updates) {
      const result = await contracts.updateOne(
        { _id: id, scope: { $exists: false }, flowVersion: { $exists: false } },
        { $set: { scope: RENTAL_SCOPE, flowVersion: 1 } },
      );
      if (result.modifiedCount !== 1)
        throw new Error(
          'Contract changed during backfill; stop and rerun dry-run',
        );
      applied++;
      // Deliberate failure injection is restricted to an explicit scratch test
      // database by assertTestApplyTarget above. It verifies rerun recovery.
      if (testFailAfter === applied)
        throw new Error('TEST_INJECTED_MIGRATION_FAILURE');
    }
    console.log(
      JSON.stringify({
        appliedLegacyMarkers: updates.length,
        indexesChanged: false,
      }),
    );
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  classifyLegacyContract,
  assertTestApplyTarget,
  fingerprintContracts,
};
