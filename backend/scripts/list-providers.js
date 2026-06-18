const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

function readEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return process.env;
  const values = { ...process.env };
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      values[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
    }
  }
  return values;
}

async function run() {
  const env = readEnv();
  const mongoUri = env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibehue_auth';
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  
  const providers = await db.collection('providers').find({}).toArray();
  console.log('--- PROVIDERS IN DB ---');
  for (const p of providers) {
    console.log(`ID: ${p._id}, Name: ${p.businessName}, capabilities: ${JSON.stringify(p.capabilities)}, status: ${p.status}`);
  }
  
  const packages = await db.collection('photography_packages').find({}).toArray();
  console.log('--- PACKAGES IN DB ---');
  for (const pkg of packages) {
    console.log(`ID: ${pkg._id}, Name: ${pkg.name}, ProviderId: ${pkg.providerId}`);
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
