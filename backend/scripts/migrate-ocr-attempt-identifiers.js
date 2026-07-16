const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function readEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return process.env;

  const values = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return { ...values, ...process.env };
}

async function migrate() {
  const env = readEnv();
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  await mongoose.connect(env.MONGODB_URI);
  const attempts = mongoose.connection.db.collection('provider_verification_ocr_attempts');
  const invalid = [];
  let migrated = 0;

  const cursor = attempts.find({ verificationId: { $type: 'string' } });
  for await (const attempt of cursor) {
    if (!mongoose.Types.ObjectId.isValid(attempt.verificationId)) {
      invalid.push(attempt._id.toString());
      continue;
    }
    const result = await attempts.updateOne(
      { _id: attempt._id, verificationId: attempt.verificationId },
      { $set: { verificationId: new mongoose.Types.ObjectId(attempt.verificationId) } },
    );
    migrated += result.modifiedCount;
  }

  await Promise.all([
    attempts.createIndex({ verificationId: 1, documentType: 1, versionNo: 1, startedAt: -1 }),
    attempts.createIndex({ outcome: 1, startedAt: -1 }),
    attempts.createIndex({ attemptId: 1 }, { unique: true }),
  ]);

  console.log(JSON.stringify({ migrated, invalidAttemptIds: invalid }));
  if (invalid.length) process.exitCode = 1;
}

migrate()
  .catch((error) => {
    console.error(`OCR attempt identifier migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });