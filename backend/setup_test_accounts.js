const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ACCOUNT_EMAILS = [
  'admin@vibehue.com',
  'customer@vibehue.com',
  'aodai@vibehue.com',
  'photo@vibehue.com',
  'provider.demo@vibehue.com',
];

function readEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return process.env;
  }

  const values = { ...process.env };
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      values[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
    }
  }
  return values;
}

async function setupTestAccounts() {
  const env = readEnv();
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  const password = env.LOCAL_TEST_PASSWORD || 'Password@123';
  await mongoose.connect(env.MONGODB_URI);
  const users = mongoose.connection.db.collection('users');

  for (const email of ACCOUNT_EMAILS) {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await users.updateOne(
      { 'auth.emailNormalized': email },
      {
        $set: {
          'auth.passwordHash': passwordHash,
          'auth.emailVerified': true,
          accountStatus: 'ACTIVE',
          'security.passwordChangedAt': new Date(),
          updatedAt: new Date(),
        },
      },
    );

    const status = result.matchedCount === 1 ? 'updated' : 'not found';
    console.log(`${email}: ${status}`);
  }
}

setupTestAccounts()
  .catch((error) => {
    console.error(`Failed to set up test accounts: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
