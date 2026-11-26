/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DEMO_EMAIL = 'provider.demo@example.com';
const DEMO_PASSWORD = 'VibeHue@2026';
const NOW = new Date();

function copyDemoAsset(fileName) {
  const source = path.resolve(__dirname, `../../frontend/public/${fileName}`);
  const destinationDir = path.resolve(__dirname, '../uploads/products/demo');
  const destination = path.join(destinationDir, fileName);
  fs.mkdirSync(destinationDir, { recursive: true });
  fs.copyFileSync(source, destination);
  return `/uploads/products/demo/${fileName}`;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const users = db.collection('users');
  const providers = db.collection('providers');
  const categories = db.collection('categories');
  const products = db.collection('products');
  const inventoryItems = db.collection('inventory_items');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const existingUser = await users.findOne({ 'auth.emailNormalized': DEMO_EMAIL });
  const userId = existingUser?._id ?? new mongoose.Types.ObjectId();
  const existingProvider = await providers.findOne({ userId });
  const providerId = existingProvider?._id ?? new mongoose.Types.ObjectId();

  await users.updateOne(
    { _id: userId },
    {
      $set: {
        auth: {
          email: DEMO_EMAIL,
          emailNormalized: DEMO_EMAIL,
          phone: '0900002026',
          phoneNormalized: '0900002026',
          passwordHash,
          emailVerified: true,
          phoneVerified: true,
          authProviders: [{ provider: 'LOCAL', providerUserId: null }],
        },
        roles: ['CUSTOMER', 'PROVIDER'],
        defaultRole: 'PROVIDER',
        accountStatus: 'ACTIVE',
        isRestricted: false,
        hasCompletedOnboarding: true,
        profile: {
          fullName: 'Nguyễn An Demo',
          avatarUrl: '/uploads/products/demo/tuyet_mai.webp',
          gender: null,
          dateOfBirth: null,
        },
        provider: { providerId, providerStatus: 'ACTIVE' },
        updatedAt: NOW,
      },
      $setOnInsert: {
        createdAt: NOW,
        preferences: {
          stylePreferences: [],
          favoriteColors: [],
          preferredMaterials: [],
          preferredAoDaiStyles: [],
          preferredPhotographyStyles: [],
          sizeInfo: {},
          budgetRange: {},
          preferredLocations: [],
          preferredOccasions: [],
          note: null,
        },
        notificationPreferences: { marketingEmail: false, appPush: true },
        favorites: [],
        addresses: [],
        security: { failedLoginAttempts: 0, passwordChangedAt: NOW },
      },
    },
    { upsert: true },
  );

  const coverImage = copyDemoAsset('partner_cover.jpg');
  const productOneImage = copyDemoAsset('tuyet_mai.webp');
  const productTwoImage = copyDemoAsset('phuong_hoang.webp');

  await providers.updateOne(
    { _id: providerId },
    {
      $set: {
        userId,
        businessName: 'Nhã Uyển Cổ Phục Huế',
        capabilities: ['AODAI_RENTAL'],
        contact: {
          email: DEMO_EMAIL,
          phone: '0900002026',
          website: null,
        },
        address: {
          addressLine: '15 Lê Lợi',
          ward: 'Phú Hội',
          district: 'Thuận Hóa',
          city: 'Huế',
          geo: { type: 'Point', coordinates: [107.592, 16.466] },
        },
        rentalSettings: {
          useBusinessAddressForPickup: true,
          pickupLocation: null,
          turnaroundSlots: 1,
        },
        media: {
          logoUrl: productOneImage,
          coverUrl: coverImage,
          images: [productOneImage, productTwoImage],
        },
        policies: {
          cancellationPolicy: 'Hủy trước 48 giờ để được hoàn 100% tiền thuê.',
          rentalPolicy: 'Trang phục được kiểm tra cùng khách khi nhận và hoàn trả.',
        },
        rating: { averageRating: 4.9, totalReviews: 18 },
        status: 'ACTIVE',
        approvedAt: NOW,
        updatedAt: NOW,
      },
      $setOnInsert: { createdAt: NOW, comboDiscountPercent: 0 },
    },
    { upsert: true },
  );

  let category = await categories.findOne({
    type: 'AODAI_CATEGORY',
    status: 'ACTIVE',
    deletedAt: { $exists: false },
  });
  if (!category) {
    const categoryId = new mongoose.Types.ObjectId();
    category = {
      _id: categoryId,
      name: 'Áo dài truyền thống',
      slug: 'ao-dai-truyen-thong-demo',
      type: 'AODAI_CATEGORY',
      description: 'Danh mục áo dài truyền thống dùng cho dữ liệu demo.',
      status: 'ACTIVE',
      displayOrder: 1,
      metadata: {},
      createdAt: NOW,
      updatedAt: NOW,
    };
    await categories.insertOne(category);
  }

  const demoProducts = [
    {
      name: 'Áo dài Tuyết Mai',
      slug: 'demo-ao-dai-tuyet-mai',
      description:
        'Áo dài lụa trắng thêu hoa mai thanh nhã, phù hợp chụp ảnh tại Đại Nội và các dịp lễ truyền thống.',
      images: [productOneImage],
      colorImages: [{ color: 'WHITE', images: [productOneImage] }],
      basePrice: 320000,
      hourlyPrice: 120000,
      depositAmount: 800000,
      replacementValue: 2800000,
      sizes: ['S', 'M', 'L'],
      colors: ['WHITE'],
      materials: ['SILK'],
      style: 'TRADITIONAL',
      occasions: ['CHUP_ANH', 'LE_HOI'],
      variants: [
        ['S', 'WHITE'],
        ['M', 'WHITE'],
        ['L', 'WHITE'],
      ],
    },
    {
      name: 'Nhật Bình Phượng Hoàng',
      slug: 'demo-nhat-binh-phuong-hoang',
      description:
        'Nhật Bình gấm đỏ họa tiết phượng hoàng, phom trang trọng dành cho concept cung đình Huế.',
      images: [productTwoImage],
      colorImages: [{ color: 'RED', images: [productTwoImage] }],
      basePrice: 480000,
      hourlyPrice: 180000,
      depositAmount: 1200000,
      replacementValue: 4500000,
      sizes: ['M', 'L'],
      colors: ['RED'],
      materials: ['BROCADE'],
      style: 'ROYAL',
      occasions: ['CHUP_ANH', 'LE_HOI', 'CUOI_HOI'],
      variants: [
        ['M', 'RED'],
        ['L', 'RED'],
      ],
    },
  ];

  const seeded = [];
  for (const item of demoProducts) {
    const existingProduct = await products.findOne({ slug: item.slug });
    const productId = existingProduct?._id ?? new mongoose.Types.ObjectId();
    await products.updateOne(
      { _id: productId },
      {
        $set: {
          providerId,
          categoryId: category._id,
          styleCategoryIds: [],
          eventCategoryIds: [],
          name: item.name,
          slug: item.slug,
          description: item.description,
          images: item.images,
          colorImages: item.colorImages,
          videos: [],
          basePrice: item.basePrice,
          hourlyPrice: item.hourlyPrice,
          depositAmount: item.depositAmount,
          replacementValue: item.replacementValue,
          sizes: item.sizes,
          sizeChartPolicyVersion: 1,
          sizeChartVersion: 0,
          sizeChart: null,
          colors: item.colors,
          materials: item.materials,
          style: item.style,
          occasions: item.occasions,
          customTags: [],
          taggingRevision: 1,
          taggingDecisionVersion: 0,
          specifications: {},
          status: 'ACTIVE',
          moderationStatus: 'APPROVED',
          moderationReason: null,
          moderatedAt: NOW,
          rating: { averageRating: 4.9, totalReviews: 9 },
          skuCounters: {},
          updatedAt: NOW,
        },
        $setOnInsert: { createdAt: NOW, moderationHistory: [] },
      },
      { upsert: true },
    );

    await inventoryItems.deleteMany({ productId, sku: /^DEMO-/ });
    const inventory = item.variants.flatMap(([size, color]) =>
      [1, 2].map((sequence) => ({
        productId,
        sku: `DEMO-${item.slug.replace('demo-', '').toUpperCase()}-${size}-${sequence}`,
        size,
        color,
        material: item.materials[0],
        conditionStatus: 'NEW',
        status: 'AVAILABLE',
        notes: 'Dữ liệu mẫu',
        variantRemovedAt: null,
        operationalAvailableFrom: null,
        activeTurnaroundBookingItemId: null,
        createdAt: NOW,
        updatedAt: NOW,
      })),
    );
    await inventoryItems.insertMany(inventory);
    seeded.push({ id: productId.toString(), name: item.name, inventory: inventory.length });
  }

  console.log(JSON.stringify({
    account: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    provider: { id: providerId.toString(), businessName: 'Nhã Uyển Cổ Phục Huế' },
    products: seeded,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
