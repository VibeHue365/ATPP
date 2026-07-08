/**
 * Script tạo tài khoản Provider mới vào MongoDB
 * Chạy: node scripts/create-provider-account.js
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Helper đọc .env
function readEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return process.env;

  const values = { ...process.env };
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    values[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return values;
}

async function createProviderAccount() {
  const env = readEnv();
  const mongoUri = env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibehue_db';

  console.log(`\n🔌 Kết nối MongoDB: ${mongoUri.replace(/:([^:@]+)@/, ':***@')}`);
  await mongoose.connect(mongoUri);
  console.log('✅ Kết nối thành công!\n');

  const db = mongoose.connection.db;

  // ──────────────────────────────────────────
  // Thông tin tài khoản Provider
  // ──────────────────────────────────────────
  const PROVIDER_EMAIL = 'provider.demo@vibehue.com';
  const PROVIDER_PASSWORD = 'Provider@123';
  const PROVIDER_NAME = 'Nguyễn Thị Hương';
  const BUSINESS_NAME = 'Tiệm Áo Dài VibeHue Demo';

  // Kiểm tra email đã tồn tại chưa
  const usersCol = db.collection('users');
  const existing = await usersCol.findOne({
    'auth.emailNormalized': PROVIDER_EMAIL.toLowerCase(),
  });

  if (existing) {
    console.log(`⚠️  Email "${PROVIDER_EMAIL}" đã tồn tại trong hệ thống!`);
    console.log(`   User ID: ${existing._id}`);
    await mongoose.disconnect();
    return;
  }

  // Hash mật khẩu
  const passwordHash = await bcrypt.hash(PROVIDER_PASSWORD, 10);

  // Tạo ObjectId
  const userId = new mongoose.Types.ObjectId();
  const providerId = new mongoose.Types.ObjectId();
  const now = new Date();

  // ──────────────────────────────────────────
  // 1. Tạo bản ghi User
  // ──────────────────────────────────────────
  const userDoc = {
    _id: userId,
    auth: {
      email: PROVIDER_EMAIL,
      emailNormalized: PROVIDER_EMAIL.toLowerCase(),
      phone: '0901234567',
      phoneNormalized: '0901234567',
      passwordHash: passwordHash,
      emailVerified: true,
      phoneVerified: false,
      authProviders: [{ provider: 'LOCAL' }],
    },
    roles: ['CUSTOMER', 'PROVIDER'],
    defaultRole: 'PROVIDER',
    accountStatus: 'ACTIVE',
    profile: {
      fullName: PROVIDER_NAME,
      avatarUrl: null,
      gender: null,
      dateOfBirth: null,
    },
    preferences: {
      stylePreferences: [],
      favoriteColors: [],
      preferredAoDaiStyles: [],
      preferredPhotographyStyles: [],
      sizeInfo: {
        height: null,
        weight: null,
        preferredSize: null,
        bodyShape: null,
      },
      budgetRange: { min: null, max: null },
      preferredLocations: [],
    },
    addresses: [],
    favorites: [],
    loyalty: {
      pointsBalance: 0,
      membershipLevel: 'BRONZE',
    },
    provider: {
      providerId: providerId,
      providerStatus: 'ACTIVE',
    },
    security: {
      lastLoginAt: null,
      passwordChangedAt: now,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  // ──────────────────────────────────────────
  // 2. Tạo bản ghi Provider
  // ──────────────────────────────────────────
  const providerDoc = {
    _id: providerId,
    userId: userId,
    businessName: BUSINESS_NAME,
    capabilities: ['AODAI_RENTAL'],
    contact: {
      email: PROVIDER_EMAIL,
      phone: '0901234567',
      website: null,
    },
    address: {
      addressLine: '123 Lê Lợi',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
    },
    media: {
      logoUrl: null,
      coverUrl: null,
      images: [],
    },
    policies: {
      cancellationPolicy: null,
      rentalPolicy: null,
    },
    paymentAccounts: [],
    rating: {
      averageRating: 0,
      totalReviews: 0,
    },
    status: 'ACTIVE',
    approvedAt: now,
    approvedBy: null,
    createdAt: now,
    updatedAt: now,
  };

  // ──────────────────────────────────────────
  // Insert vào MongoDB
  // ──────────────────────────────────────────
  const providersCol = db.collection('providers');

  await usersCol.insertOne(userDoc);
  console.log(`✅ Đã tạo User: ${userId}`);

  await providersCol.insertOne(providerDoc);
  console.log(`✅ Đã tạo Provider: ${providerId}`);

  // ──────────────────────────────────────────
  // In thông tin đăng nhập
  // ──────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log('🎉 TÀI KHOẢN PROVIDER ĐÃ TẠO THÀNH CÔNG!');
  console.log('='.repeat(50));
  console.log(`📧 Email    : ${PROVIDER_EMAIL}`);
  console.log(`🔑 Mật khẩu : ${PROVIDER_PASSWORD}`);
  console.log(`👤 Họ tên   : ${PROVIDER_NAME}`);
  console.log(`🏢 Shop     : ${BUSINESS_NAME}`);
  console.log(`🆔 User ID  : ${userId}`);
  console.log(`🆔 Provider ID: ${providerId}`);
  console.log(`⚡ Trạng thái: ACTIVE`);
  console.log('='.repeat(50) + '\n');

  await mongoose.disconnect();
  console.log('🔌 Đã ngắt kết nối MongoDB.');
}

createProviderAccount().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
