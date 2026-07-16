const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const defaultTaxonomy = require('./data/smart-tag-taxonomy.default.json');

function readEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return process.env;

  const values = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      values[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
    }
  }
  return { ...values, ...process.env };
}

async function migrate() {
  const env = readEnv();
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  await mongoose.connect(env.MONGODB_URI);
  const products = mongoose.connection.db.collection('products');
  const portfolioItems = mongoose.connection.db.collection('portfolio_items');
  const definitions = mongoose.connection.db.collection(
    'smart_tag_definitions',
  );
  const taxonomyMetadata = mongoose.connection.db.collection(
    'smart_tag_taxonomy_metadata',
  );
  const now = new Date();

  const taggingRevision = await products.updateMany(
    { taggingRevision: { $exists: false } },
    { $set: { taggingRevision: 1, updatedAt: now } },
  );
  const taggingDecisionVersion = await products.updateMany(
    { taggingDecisionVersion: { $exists: false } },
    { $set: { taggingDecisionVersion: 0, updatedAt: now } },
  );
  const portfolioTaggingRevision = await portfolioItems.updateMany(
    { taggingRevision: { $exists: false } },
    { $set: { taggingRevision: 1, updatedAt: now } },
  );
  const portfolioTaggingDecisionVersion = await portfolioItems.updateMany(
    { taggingDecisionVersion: { $exists: false } },
    { $set: { taggingDecisionVersion: 0, updatedAt: now } },
  );

  await Promise.all([
    definitions.createIndex({ code: 1 }, { unique: true }),
    definitions.createIndex({ status: 1, displayPriority: 1 }),
    taxonomyMetadata.createIndex({ scope: 1 }, { unique: true }),
    mongoose.connection.db
      .collection('smart_tag_generation_runs')
      .createIndex(
        { entityType: 1, entityId: 1, inputFingerprint: 1 },
        { unique: true },
      ),
    mongoose.connection.db
      .collection('smart_tag_generation_runs')
      .createIndex({ status: 1, lockExpiresAt: 1 }),
    mongoose.connection.db
      .collection('smart_tag_assignments')
      .createIndex(
        { entityType: 1, entityId: 1, tagCode: 1 },
        { unique: true },
      ),
    mongoose.connection.db
      .collection('smart_tag_assignments')
      .createIndex({
        entityType: 1,
        entityId: 1,
        entityRevision: 1,
        status: 1,
      }),
    mongoose.connection.db
      .collection('smart_tag_assignments')
      .createIndex({ status: 1, updatedAt: -1 }),
  ]);

  await taxonomyMetadata.updateOne(
    { scope: 'GLOBAL' },
    {
      $setOnInsert: {
        scope: 'GLOBAL',
        taxonomyRevision: 1,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  let seededDefinitions = 0;
  for (const definition of defaultTaxonomy) {
    const result = await definitions.updateOne(
      { code: definition.code },
      {
        $setOnInsert: {
          ...definition,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount > 0) seededDefinitions += 1;
  }

  console.log(
    JSON.stringify({
      taggingRevision: {
        matched: taggingRevision.matchedCount,
        modified: taggingRevision.modifiedCount,
      },
      taggingDecisionVersion: {
        matched: taggingDecisionVersion.matchedCount,
        modified: taggingDecisionVersion.modifiedCount,
      },
      portfolioTaggingRevision: {
        matched: portfolioTaggingRevision.matchedCount,
        modified: portfolioTaggingRevision.modifiedCount,
      },
      portfolioTaggingDecisionVersion: {
        matched: portfolioTaggingDecisionVersion.matchedCount,
        modified: portfolioTaggingDecisionVersion.modifiedCount,
      },
      taxonomy: {
        source: 'scripts/data/smart-tag-taxonomy.default.json',
        insertedDefinitions: seededDefinitions,
        totalDefaultDefinitions: defaultTaxonomy.length,
      },
    }),
  );
}

migrate()
  .catch((error) => {
    console.error(`VIB-95 smart tagging migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
