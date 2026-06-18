const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

function readEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return process.env;
  }
  const values = { ...process.env };
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    values[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return values;
}

async function run() {
  const env = readEnv();
  const mongoUri = env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected successfully!');

  const db = mongoose.connection.db;

  const email = 'provider_test@vibehue.com';
  const phone = '+84999999999';
  const password = 'password123';

  // 1. Check if email already exists
  const existingUser = await db.collection('users').findOne({ 'auth.emailNormalized': email.toLowerCase() });
  if (existingUser) {
    console.log(`User already exists with email: ${email}`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = new mongoose.Types.ObjectId();
  const providerProfileId = new mongoose.Types.ObjectId();

  // 2. Insert User Document
  const userDoc = {
    _id: userId,
    auth: {
      email: email,
      emailNormalized: email.toLowerCase(),
      phone: phone,
      phoneNormalized: phone,
      passwordHash: passwordHash,
      emailVerified: true,
      phoneVerified: true,
      authProviders: [{ provider: 'LOCAL', providerUserId: null }]
    },
    roles: ['PROVIDER'],
    defaultRole: 'PROVIDER',
    accountStatus: 'ACTIVE',
    profile: {
      fullName: 'Test Provider User',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      gender: 'MALE',
      dateOfBirth: new Date('1990-01-01')
    },
    provider: {
      providerId: providerProfileId,
      providerStatus: 'APPROVED'
    },
    security: {
      failedLoginAttempts: 0,
      passwordChangedAt: new Date()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('users').insertOne(userDoc);
  console.log('Created user document in users collection.');

  // 3. Insert Provider Document
  const providerDoc = {
    _id: providerProfileId,
    userId: userId,
    businessName: 'VibeHue Partner Test Studio',
    capabilities: ['PHOTOGRAPHY', 'AODAI_RENTAL'],
    contact: {
      email: email,
      phone: phone,
      website: 'https://partner.vibehue.com'
    },
    address: {
      addressLine: '100 Lê Lợi',
      ward: 'Phú Hội',
      district: 'Thành phố Huế',
      city: 'Thừa Thiên Huế'
    },
    media: {
      logoUrl: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19',
      coverUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
      images: []
    },
    policies: {
      cancellationPolicy: 'Hủy trước 24h hoàn tiền 100%.',
      rentalPolicy: 'Thuê tối đa 3 ngày.'
    },
    rating: { averageRating: 5.0, totalReviews: 1 },
    status: 'APPROVED',
    approvedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('providers').insertOne(providerDoc);
  console.log('Created provider profile document in providers collection.');

  console.log('\n======================================================');
  console.log('  PROVIDER ACCOUNT CREATED SUCCESSFULLY!');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Error creating provider:', error);
  await mongoose.disconnect().catch(() => undefined);
});
