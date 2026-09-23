/*
 * Aligns Smart Tag taxonomy with customer onboarding.
 * Only STYLE and OCCASION definitions remain active. Legacy definitions are
 * retained as inactive records so existing assignments remain auditable.
 *
 * Dry-run (default): npm run migrate:smart-tag-taxonomy:v2
 * Apply:             npm run migrate:smart-tag-taxonomy:v2:apply
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const apply = process.argv.includes('--apply');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');

  const definitions = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, 'data', 'smart-tag-taxonomy.default.json'),
      'utf8',
    ),
  );
  const active = definitions.filter((definition) => definition.status === 'ACTIVE');
  if (
    active.some(
      (definition) =>
        definition.group !== 'STYLE' && definition.group !== 'OCCASION',
    )
  ) {
    throw new Error('Every active definition must belong to STYLE or OCCASION.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collection = db.collection('smart_tag_definitions');
  const metadata = db.collection('smart_tag_taxonomy_metadata');
  const existing = await collection
    .find({ code: { $in: definitions.map((definition) => definition.code) } })
    .project({ code: 1, group: 1, status: 1, ruleConfig: 1 })
    .toArray();
  const existingByCode = new Map(existing.map((definition) => [definition.code, definition]));
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    definitions: definitions.length,
    activeDefinitions: active.length,
    creates: [],
    updates: [],
  };

  for (const definition of definitions) {
    const previous = existingByCode.get(definition.code);
    if (!previous) report.creates.push(definition.code);
    else report.updates.push(definition.code);
    if (!apply) continue;

    const now = new Date();
    await collection.updateOne(
      { code: definition.code },
      {
        $set: { ...definition, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  if (apply) {
    await metadata.updateOne(
      { scope: 'GLOBAL' },
      {
        $inc: { taxonomyRevision: 1 },
        $set: { updatedAt: new Date() },
        $setOnInsert: { scope: 'GLOBAL', createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
