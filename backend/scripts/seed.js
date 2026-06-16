const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Helper to read .env file
function readEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return process.env;
  }

  const values = { ...process.env };
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) {
      continue;
    }
    values[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return values;
}

async function seed() {
  const env = readEnv();
  const mongoUri = env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibehue_auth';
  
  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]+)@/, ':***@')}`);
  await mongoose.connect(mongoUri);
  console.log('Connected successfully!');

  const db = mongoose.connection.db;

  // Clear existing collections if they exist to start fresh
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log(`Found ${collectionNames.length} existing collections. Clearing for fresh seed...`);
  
  for (const name of collectionNames) {
    await db.collection(name).deleteMany({});
    console.log(`Cleared collection: ${name}`);
  }

  // Define realistic IDs
  const adminId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const providerAoDaiId = new mongoose.Types.ObjectId();
  const providerPhotoId = new mongoose.Types.ObjectId();
  const providerBothId = new mongoose.Types.ObjectId();
  
  const providerAoDaiProfileId = new mongoose.Types.ObjectId();
  const providerPhotoProfileId = new mongoose.Types.ObjectId();
  const providerBothProfileId = new mongoose.Types.ObjectId();

  const categoryRentalId = new mongoose.Types.ObjectId();
  const categoryPhotoId = new mongoose.Types.ObjectId();

  const productWhiteId = new mongoose.Types.ObjectId();
  const productRedId = new mongoose.Types.ObjectId();

  const priceProductWhiteId = new mongoose.Types.ObjectId();
  const priceProductRedId = new mongoose.Types.ObjectId();
  const pricePhotoPkgId = new mongoose.Types.ObjectId();

  const inventoryItem1Id = new mongoose.Types.ObjectId();
  const inventoryItem2Id = new mongoose.Types.ObjectId();
  const inventoryItem3Id = new mongoose.Types.ObjectId();

  const photoPkgId = new mongoose.Types.ObjectId();

  const bookingId = new mongoose.Types.ObjectId();
  const bookingItemProdId = new mongoose.Types.ObjectId();
  const bookingItemPhotoId = new mongoose.Types.ObjectId();

  const contractId = new mongoose.Types.ObjectId();
  const handoverPickupId = new mongoose.Types.ObjectId();
  const handoverReturnId = new mongoose.Types.ObjectId();

  const paymentDepositId = new mongoose.Types.ObjectId();
  const paymentRemainingId = new mongoose.Types.ObjectId();

  const refundRequestId = new mongoose.Types.ObjectId();
  const settlementId = new mongoose.Types.ObjectId();

  const reviewId = new mongoose.Types.ObjectId();
  const disputeId = new mongoose.Types.ObjectId();

  console.log('Inserting seed data...');

  // ==========================================
  // 1. users
  // ==========================================
  const users = [
    {
      _id: adminId,
      auth: {
        email: 'admin@vibehue.com',
        emailNormalized: 'admin@vibehue.com',
        phone: '+84900000001',
        phoneNormalized: '+84900000001',
        passwordHash: '$2a$10$X87q8P6xVv1.K5n6WkS/Uu4d4u3l.6r9gHjTj5kL4U5v6w7x8y9z0', // dummy bcrypt hash
        emailVerified: true,
        phoneVerified: true,
        authProviders: [{ provider: 'LOCAL', providerUserId: null }]
      },
      roles: ['ADMIN'],
      defaultRole: 'ADMIN',
      accountStatus: 'ACTIVE',
      profile: {
        fullName: 'System Admin',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
        gender: 'MALE',
        dateOfBirth: new Date('1990-01-01')
      },
      preferences: {
        stylePreferences: [],
        favoriteColors: [],
        preferredAoDaiStyles: [],
        preferredPhotographyStyles: [],
        sizeInfo: {},
        budgetRange: {},
        preferredLocations: []
      },
      addresses: [],
      favorites: [],
      loyalty: { pointsBalance: 0, membershipLevel: 'BRONZE' },
      provider: {},
      security: { failedLoginAttempts: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: customerId,
      auth: {
        email: 'customer@vibehue.com',
        emailNormalized: 'customer@vibehue.com',
        phone: '+84900000002',
        phoneNormalized: '+84900000002',
        passwordHash: '$2a$10$X87q8P6xVv1.K5n6WkS/Uu4d4u3l.6r9gHjTj5kL4U5v6w7x8y9z0',
        emailVerified: true,
        phoneVerified: true,
        authProviders: [{ provider: 'LOCAL', providerUserId: null }]
      },
      roles: ['CUSTOMER'],
      defaultRole: 'CUSTOMER',
      accountStatus: 'ACTIVE',
      profile: {
        fullName: 'Nguyễn Văn A',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
        gender: 'FEMALE',
        dateOfBirth: new Date('1998-05-15')
      },
      preferences: {
        stylePreferences: ['TRADITIONAL', 'ELEGANT'],
        favoriteColors: ['WHITE', 'RED'],
        preferredAoDaiStyles: ['TRADITIONAL_SILK'],
        preferredPhotographyStyles: ['OUTDOOR_PORTRAIT'],
        sizeInfo: { height: 165, weight: 52, preferredSize: 'M', bodyShape: 'HOURGLASS' },
        budgetRange: { min: 200000, max: 1000000 },
        preferredLocations: ['Hanoi Old Quarter', 'Hoan Kiem Lake']
      },
      addresses: [
        {
          label: 'Nhà riêng',
          addressLine: '123 Đường Láng',
          ward: 'Láng Hạ',
          district: 'Đống Đa',
          city: 'Hà Nội',
          isDefault: true
        }
      ],
      favorites: [
        { targetType: 'PRODUCT', targetId: productWhiteId, addedAt: new Date() }
      ],
      loyalty: { pointsBalance: 150, membershipLevel: 'SILVER' },
      provider: {},
      security: { failedLoginAttempts: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: providerAoDaiId,
      auth: {
        email: 'aodai@vibehue.com',
        emailNormalized: 'aodai@vibehue.com',
        phone: '+84900000003',
        phoneNormalized: '+84900000003',
        passwordHash: '$2a$10$X87q8P6xVv1.K5n6WkS/Uu4d4u3l.6r9gHjTj5kL4U5v6w7x8y9z0',
        emailVerified: true,
        phoneVerified: true,
        authProviders: [{ provider: 'LOCAL', providerUserId: null }]
      },
      roles: ['PROVIDER'],
      defaultRole: 'PROVIDER',
      accountStatus: 'ACTIVE',
      profile: {
        fullName: 'Lê Studio Áo Dài',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
        gender: 'FEMALE',
        dateOfBirth: new Date('1985-10-20')
      },
      preferences: {
        stylePreferences: [],
        favoriteColors: [],
        preferredAoDaiStyles: [],
        preferredPhotographyStyles: [],
        sizeInfo: {},
        budgetRange: {},
        preferredLocations: []
      },
      addresses: [],
      favorites: [],
      loyalty: { pointsBalance: 0, membershipLevel: 'BRONZE' },
      provider: { providerId: providerAoDaiProfileId, providerStatus: 'APPROVED' },
      security: { failedLoginAttempts: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: providerPhotoId,
      auth: {
        email: 'photo@vibehue.com',
        emailNormalized: 'photo@vibehue.com',
        phone: '+84900000004',
        phoneNormalized: '+84900000004',
        passwordHash: '$2a$10$X87q8P6xVv1.K5n6WkS/Uu4d4u3l.6r9gHjTj5kL4U5v6w7x8y9z0',
        emailVerified: true,
        phoneVerified: true,
        authProviders: [{ provider: 'LOCAL', providerUserId: null }]
      },
      roles: ['PROVIDER'],
      defaultRole: 'PROVIDER',
      accountStatus: 'ACTIVE',
      profile: {
        fullName: 'Trần Photographer',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
        gender: 'MALE',
        dateOfBirth: new Date('1992-03-25')
      },
      preferences: {
        stylePreferences: [],
        favoriteColors: [],
        preferredAoDaiStyles: [],
        preferredPhotographyStyles: [],
        sizeInfo: {},
        budgetRange: {},
        preferredLocations: []
      },
      addresses: [],
      favorites: [],
      loyalty: { pointsBalance: 0, membershipLevel: 'BRONZE' },
      provider: { providerId: providerPhotoProfileId, providerStatus: 'APPROVED' },
      security: { failedLoginAttempts: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  await db.collection('users').insertMany(users);

  // ==========================================
  // 2. roles
  // ==========================================
  const roles = [
    {
      code: 'ADMIN',
      name: 'Administrator',
      description: 'System Admin with full permissions',
      permissions: ['*'],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      code: 'CUSTOMER',
      name: 'Customer',
      description: 'Renter/Client user',
      permissions: ['booking:create_own', 'booking:view_own', 'reviews:create_own'],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      code: 'PROVIDER',
      name: 'Provider',
      description: 'Ao Dai shops and Photographers',
      permissions: ['booking:view_provider', 'product:create_own', 'inventory:update_own'],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  await db.collection('roles').insertMany(roles);

  // ==========================================
  // 3. permissions
  // ==========================================
  const permissionsList = [
    { code: 'booking:create_own', name: 'Create Own Booking', module: 'BOOKINGS', description: 'Allow customer to create booking', status: 'ACTIVE', createdAt: new Date() },
    { code: 'booking:view_own', name: 'View Own Booking', module: 'BOOKINGS', description: 'Allow customer to view own bookings', status: 'ACTIVE', createdAt: new Date() },
    { code: 'booking:view_provider', name: 'View Provider Booking', module: 'BOOKINGS', description: 'Allow provider to view assigned bookings', status: 'ACTIVE', createdAt: new Date() },
    { code: 'product:create_own', name: 'Create Own Product', module: 'PRODUCTS', description: 'Allow provider to register items', status: 'ACTIVE', createdAt: new Date() },
    { code: 'inventory:update_own', name: 'Update Own Inventory', module: 'PRODUCTS', description: 'Allow provider to update SKU statuses', status: 'ACTIVE', createdAt: new Date() },
    { code: 'refund:manage_all', name: 'Manage All Refunds', module: 'PAYMENTS', description: 'Allow admin to process refunds', status: 'ACTIVE', createdAt: new Date() },
    { code: 'dispute:resolve_all', name: 'Resolve All Disputes', module: 'DISPUTES', description: 'Allow admin to resolve disputes', status: 'ACTIVE', createdAt: new Date() }
  ];
  await db.collection('permissions').insertMany(permissionsList);

  // ==========================================
  // 4. refresh_tokens
  // ==========================================
  const refreshTokens = [
    {
      userId: customerId,
      tokenHash: 'sha256hashedrefreshtokenstringexample',
      deviceId: 'iphone_15_pro',
      deviceName: 'iPhone 15 Pro',
      ipAddress: '192.168.1.5',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      createdAt: new Date()
    }
  ];
  await db.collection('refresh_tokens').insertMany(refreshTokens);

  // ==========================================
  // 5. verification_tokens
  // ==========================================
  const verificationTokens = [
    {
      userId: customerId,
      target: 'customer@vibehue.com',
      targetType: 'EMAIL',
      purpose: 'VERIFY_EMAIL',
      codeHash: 'hashedotpcode123456',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: new Date()
    }
  ];
  await db.collection('verification_tokens').insertMany(verificationTokens);

  // ==========================================
  // 6. providers
  // ==========================================
  const providers = [
    {
      _id: providerAoDaiProfileId,
      userId: providerAoDaiId,
      businessName: 'Huế Áo Dài Studio',
      capabilities: ['AODAI_RENTAL'],
      contact: {
        email: 'info@hueaodai.vn',
        phone: '+84988777666',
        website: 'https://hueaodai.vn'
      },
      address: {
        addressLine: '45 Lê Lợi',
        ward: 'Phú Hội',
        district: 'Thành phố Huế',
        city: 'Thừa Thiên Huế'
      },
      media: {
        logoUrl: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19',
        coverUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
        images: ['https://images.unsplash.com/photo-1512436991641-6745cdb1723f']
      },
      policies: {
        cancellationPolicy: 'Hủy trước 48h hoàn trả 100% cọc. Sau 48h mất cọc.',
        rentalPolicy: 'Thời gian thuê tối đa 3 ngày. Trả muộn phạt 100,000đ/ngày.'
      },
      paymentAccounts: [
        {
          accountType: 'BANK_ACCOUNT',
          bankName: 'Vietcombank',
          accountNumberMasked: '******6789',
          accountHolder: 'HUE AO DAI STUDIO',
          isDefault: true,
          status: 'ACTIVE'
        }
      ],
      rating: { averageRating: 4.8, totalReviews: 24 },
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: providerPhotoProfileId,
      userId: providerPhotoId,
      businessName: 'Trần Phú Photography',
      capabilities: ['PHOTOGRAPHY'],
      contact: {
        email: 'tranphu.photo@gmail.com',
        phone: '+84911222333',
        website: null
      },
      address: {
        addressLine: '88 Nguyễn Huệ',
        ward: 'Bến Nghé',
        district: 'Quận 1',
        city: 'Hồ Chí Minh'
      },
      media: {
        logoUrl: 'https://images.unsplash.com/photo-1554080353-a576cf803bda',
        coverUrl: 'https://images.unsplash.com/photo-1452780212940-6f5c0d14d84a',
        images: []
      },
      policies: {
        cancellationPolicy: 'Hủy lịch trước 7 ngày để đổi lịch miễn phí. Hủy sau 7 ngày mất cọc chụp.',
        rentalPolicy: 'Giao ảnh chỉnh sửa sau 7 ngày làm việc. Quá hạn bù 5% giá trị hợp đồng.'
      },
      paymentAccounts: [
        {
          accountType: 'BANK_ACCOUNT',
          bankName: 'Techcombank',
          accountNumberMasked: '******1234',
          accountHolder: 'TRAN PHU',
          isDefault: true,
          status: 'ACTIVE'
        }
      ],
      rating: { averageRating: 4.9, totalReviews: 12 },
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  await db.collection('providers').insertMany(providers);

  // ==========================================
  // 7. provider_verifications
  // ==========================================
  const providerVerifications = [
    {
      providerId: providerAoDaiProfileId,
      identityCard: {
        cardNumber: '012345678912',
        issuedDate: new Date('2020-05-10'),
        frontImageUrl: 'https://example.com/cccd-front.jpg',
        backImageUrl: 'https://example.com/cccd-back.jpg'
      },
      businessLicense: {
        licenseNumber: 'GPKD-987654321',
        imageUrl: 'https://example.com/license.jpg'
      },
      shopPhotos: ['https://example.com/shop1.jpg', 'https://example.com/shop2.jpg'],
      portfolioProof: ['https://example.com/portfolio1.jpg'],
      status: 'APPROVED',
      rejectionReason: null,
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      reviewedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      reviewedBy: adminId,
      createdAt: new Date()
    }
  ];
  await db.collection('provider_verifications').insertMany(providerVerifications);

  // ==========================================
  // 8. categories
  // ==========================================
  const categories = [
    {
      _id: categoryRentalId,
      name: 'Thuê Áo Dài',
      slug: 'thue-ao-dai',
      description: 'Các mẫu áo dài truyền thống, cách tân cho thuê',
      parentId: null,
      status: 'ACTIVE',
      createdAt: new Date()
    },
    {
      _id: categoryPhotoId,
      name: 'Gói Chụp Ảnh',
      slug: 'goi-chup-anh',
      description: 'Dịch vụ chụp ảnh áo dài chuyên nghiệp',
      parentId: null,
      status: 'ACTIVE',
      createdAt: new Date()
    }
  ];
  await db.collection('categories').insertMany(categories);

  // ==========================================
  // 9. products
  // ==========================================
  const products = [
    {
      _id: productWhiteId,
      providerId: providerAoDaiProfileId,
      categoryId: categoryRentalId,
      name: 'Áo Dài Trắng Nữ Truyền Thống Lụa Hà Đông',
      slug: 'ao-dai-trang-nu-truyen-thong-lua-ha-dong',
      description: 'Chất liệu lụa tơ tằm Hà Đông mềm mại, tôn dáng nữ tính Việt Nam.',
      images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'],
      basePrice: 250000, // 250k / day
      depositAmount: 500000, // 500k deposit
      sizes: ['S', 'M', 'L'],
      colors: ['WHITE'],
      materials: ['SILK'],
      specifications: { 'Hãng sản xuất': 'Hà Đông Silk', 'Độ co giãn': 'Ít co giãn' },
      status: 'ACTIVE',
      rating: { averageRating: 4.8, totalReviews: 10 },
      createdAt: new Date()
    },
    {
      _id: productRedId,
      providerId: providerAoDaiProfileId,
      categoryId: categoryRentalId,
      name: 'Áo Dài Gấm Đỏ Hoàng Gia Thêu Phượng',
      slug: 'ao-dai-gam-do-hoang-gia-theu-phuong',
      description: 'Thích hợp cho ngày cưới hỏi, lễ hội truyền thống, gấm thêu sang trọng.',
      images: ['https://images.unsplash.com/photo-1596462502278-27bfdc403348'],
      basePrice: 400000,
      depositAmount: 1000000,
      sizes: ['M', 'L', 'XL'],
      colors: ['RED', 'GOLD'],
      materials: ['BROCADE'],
      specifications: { 'Phong cách': 'Hoàng Gia', 'Chi tiết': 'Thêu chỉ vàng' },
      status: 'ACTIVE',
      rating: { averageRating: 4.9, totalReviews: 5 },
      createdAt: new Date()
    }
  ];
  await db.collection('products').insertMany(products);

  // ==========================================
  // 10. price_versions
  // ==========================================
  const priceVersions = [
    {
      _id: priceProductWhiteId,
      targetType: 'PRODUCT',
      targetId: productWhiteId,
      price: 250000,
      depositAmount: 500000,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      note: 'Giá khởi chạy năm 2026',
      createdAt: new Date()
    },
    {
      _id: priceProductRedId,
      targetType: 'PRODUCT',
      targetId: productRedId,
      price: 400000,
      depositAmount: 1000000,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      note: 'Giá lễ cưới cưới hỏi gấm cao cấp',
      createdAt: new Date()
    },
    {
      _id: pricePhotoPkgId,
      targetType: 'PHOTOGRAPHY_PACKAGE',
      targetId: photoPkgId,
      price: 1500000,
      depositAmount: 0,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      note: 'Giá chụp ngoại cảnh mặc định',
      createdAt: new Date()
    }
  ];
  await db.collection('price_versions').insertMany(priceVersions);

  // ==========================================
  // 11. promotions
  // ==========================================
  const promotions = [
    {
      providerId: null, // Platform-wide promotion
      code: 'VIBEHUE10',
      name: 'Chào Mừng VibeHue',
      description: 'Giảm 10% cho toàn bộ các hóa đơn booking đầu tiên',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxDiscountAmount: 100000, // max 100k
      minOrderValue: 200000,
      usageLimit: 1000,
      usedCount: 150,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-12-31'),
      status: 'ACTIVE',
      createdAt: new Date()
    }
  ];
  await db.collection('promotions').insertMany(promotions);

  // ==========================================
  // 12. inventory_items
  // ==========================================
  const inventoryItems = [
    {
      _id: inventoryItem1Id,
      productId: productWhiteId,
      sku: 'AD-WHITE-M-001',
      size: 'M',
      color: 'WHITE',
      conditionStatus: 'GOOD',
      status: 'AVAILABLE',
      notes: 'Lên dáng đẹp, lụa ít nhăn',
      createdAt: new Date()
    },
    {
      _id: inventoryItem2Id,
      productId: productWhiteId,
      sku: 'AD-WHITE-M-002',
      size: 'M',
      color: 'WHITE',
      conditionStatus: 'NEW',
      status: 'AVAILABLE',
      notes: 'Mới may tháng 5/2026',
      createdAt: new Date()
    },
    {
      _id: inventoryItem3Id,
      productId: productRedId,
      sku: 'AD-RED-S-001',
      size: 'S',
      color: 'RED',
      conditionStatus: 'NEW',
      status: 'AVAILABLE',
      notes: 'Thêu phượng tỉ mỉ',
      createdAt: new Date()
    }
  ];
  await db.collection('inventory_items').insertMany(inventoryItems);

  // ==========================================
  // 13. inventory_reservations
  // ==========================================
  const inventoryReservations = [
    {
      inventoryItemId: inventoryItem1Id,
      bookingId: bookingId,
      bookingItemId: bookingItemProdId,
      reservedFrom: new Date('2026-06-10T08:00:00.000Z'),
      reservedTo: new Date('2026-06-13T18:00:00.000Z'),
      status: 'CONFIRMED',
      expiresAt: new Date('2026-06-13T18:00:00.000Z'),
      createdAt: new Date()
    }
  ];
  await db.collection('inventory_reservations').insertMany(inventoryReservations);

  // ==========================================
  // 14. photography_packages
  // ==========================================
  const photographyPackages = [
    {
      _id: photoPkgId,
      providerId: providerPhotoProfileId,
      name: 'Gói Chụp Ảnh Huế Cổ Kính Ngoại Cảnh',
      slug: 'goi-chup-anh-hue-co-kinh-ngoai-canh',
      description: 'Chụp ảnh dạo quanh Đại Nội Huế, Chùa Thiên Mụ, Lăng Tẩm trong 3 giờ.',
      price: 1500000,
      durationHours: 3,
      editedPhotosCount: 20,
      rawPhotosCount: 150,
      deliveryDays: 5,
      travelFeeNotes: 'Đã bao gồm chi phí di chuyển của thợ ảnh trong nội thành Huế.',
      overtimeFeePerHour: 200000,
      images: ['https://images.unsplash.com/photo-1542038784456-1ea8e935640e'],
      status: 'ACTIVE',
      rating: { averageRating: 4.9, totalReviews: 8 },
      createdAt: new Date()
    }
  ];
  await db.collection('photography_packages').insertMany(photographyPackages);

  // ==========================================
  // 15. provider_schedules
  // ==========================================
  const providerSchedules = [
    {
      providerId: providerPhotoProfileId,
      scheduleType: 'RECURRING',
      dayOfWeek: 0, // Sunday
      workingHours: [{ start: '08:00', end: '18:00' }],
      offDays: [],
      customSlots: [],
      createdAt: new Date()
    },
    {
      providerId: providerPhotoProfileId,
      scheduleType: 'SPECIFIC_DATE',
      specificDate: new Date('2026-06-11T00:00:00.000Z'),
      workingHours: [], // Day off
      offDays: [new Date('2026-06-11T00:00:00.000Z')],
      customSlots: [],
      createdAt: new Date()
    }
  ];
  await db.collection('provider_schedules').insertMany(providerSchedules);

  // ==========================================
  // 16. carts
  // ==========================================
  const carts = [
    {
      customerId: customerId,
      items: [
        {
          itemType: 'PRODUCT',
          productId: productWhiteId,
          inventoryItemId: inventoryItem1Id,
          quantity: 1,
          rentalFrom: new Date('2026-06-20T08:00:00.000Z'),
          rentalTo: new Date('2026-06-22T18:00:00.000Z'),
          addedAt: new Date()
        }
      ],
      createdAt: new Date()
    }
  ];
  await db.collection('carts').insertMany(carts);

  // ==========================================
  // 17. bookings
  // ==========================================
  const booking = {
    _id: bookingId,
    bookingCode: 'BK10001',
    customerId: customerId,
    providerIds: [providerAoDaiProfileId, providerPhotoProfileId],
    bookingType: 'COMBO',
    status: 'DEPOSIT_PAID',
    pricingSummary: {
      subTotal: 1750000, // 250k (product) * 1 day + 1.5M (photo pkg)
      depositTotal: 500000, // deposit for ao dai
      discountAmount: 100000, // Promo discount
      travelFee: 0,
      overtimeFee: 0,
      lateFee: 0,
      damageFee: 0,
      grandTotal: 2150000 // (1.75M - 100k) + 500k deposit = 2.15M
    },
    paymentSummary: {
      totalPaid: 500000, // only deposit paid for now
      totalRefunded: 0,
      paymentStatus: 'PARTIALLY_PAID'
    },
    contractId: contractId,
    cancellation: {},
    statusTimeline: [
      { status: 'DRAFT', changedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), note: 'Booking initiated' },
      { status: 'PENDING_PAYMENT', changedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000), note: 'Awaiting deposit payment' },
      { status: 'DEPOSIT_PAID', changedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), note: 'Deposit payment validated via PayOS' }
    ],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date()
  };
  await db.collection('bookings').insertOne(booking);

  // ==========================================
  // 18. booking_items
  // ==========================================
  const bookingItems = [
    {
      _id: bookingItemProdId,
      bookingId: bookingId,
      providerId: providerAoDaiProfileId,
      itemType: 'PRODUCT',
      productId: productWhiteId,
      inventoryItemId: inventoryItem1Id,
      priceVersionId: priceProductWhiteId,
      unitPrice: 250000,
      depositAmount: 500000,
      quantity: 1,
      rentalFrom: new Date('2026-06-10T08:00:00.000Z'),
      rentalTo: new Date('2026-06-13T18:00:00.000Z')
    },
    {
      _id: bookingItemPhotoId,
      bookingId: bookingId,
      providerId: providerPhotoProfileId,
      itemType: 'PHOTOGRAPHY_PACKAGE',
      photographyPackageId: photoPkgId,
      priceVersionId: pricePhotoPkgId,
      unitPrice: 1500000,
      depositAmount: 0,
      quantity: 1,
      shootDate: new Date('2026-06-11T00:00:00.000Z'),
      shootTimeSlot: '08:00-11:00'
    }
  ];
  await db.collection('booking_items').insertMany(bookingItems);

  // ==========================================
  // 19. booking_schedules
  // ==========================================
  const bookingSchedules = [
    {
      bookingId: bookingId,
      bookingItemId: bookingItemProdId,
      scheduleType: 'RENTAL_PERIOD',
      scheduledDate: new Date('2026-06-10T08:00:00.000Z'),
      timeSlot: '3_DAYS',
      status: 'SCHEDULED'
    },
    {
      bookingId: bookingId,
      bookingItemId: bookingItemProdId,
      scheduleType: 'PICKUP',
      scheduledDate: new Date('2026-06-10T08:00:00.000Z'),
      status: 'SCHEDULED'
    },
    {
      bookingId: bookingId,
      bookingItemId: bookingItemProdId,
      scheduleType: 'RETURN',
      scheduledDate: new Date('2026-06-13T18:00:00.000Z'),
      status: 'SCHEDULED'
    },
    {
      bookingId: bookingId,
      bookingItemId: bookingItemPhotoId,
      scheduleType: 'PHOTOSHOOT',
      scheduledDate: new Date('2026-06-11T08:00:00.000Z'),
      timeSlot: '08:00-11:00',
      status: 'SCHEDULED'
    }
  ];
  await db.collection('booking_schedules').insertMany(bookingSchedules);

  // ==========================================
  // 20. digital_contracts
  // ==========================================
  const digitalContract = {
    _id: contractId,
    bookingId: bookingId,
    contractCode: 'DC-BK10001',
    customerId: customerId,
    providerId: providerAoDaiProfileId,
    contractTerms: 'Bên thuê cam kết giữ gìn áo dài sạch sẽ, không hư tổn tự nhiên. Hoàn trả cọc sau khi kiểm tra áo.',
    policySnapshot: {
      cancellationPolicy: 'Hủy trước 48h hoàn cọc.',
      refundPolicy: 'Hoàn trả tài khoản ngân hàng trong 3 ngày.',
      lateFeeRate: 100000, // 100k / day
      damagePolicy: 'Rách nhẹ đền 150k. Hỏng hoàn toàn đền 500k.'
    },
    signatures: [
      { signedBy: customerId, signedAt: new Date(Date.now() - 1.8 * 60 * 60 * 1000), ipAddress: '192.168.1.5' },
      { signedBy: providerAoDaiId, signedAt: new Date(Date.now() - 1.7 * 60 * 60 * 1000), ipAddress: '192.168.1.10' }
    ],
    status: 'SIGNED',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date()
  };
  await db.collection('digital_contracts').insertOne(digitalContract);

  // ==========================================
  // 21. rental_handovers
  // ==========================================
  const rentalHandovers = [
    {
      _id: handoverPickupId,
      bookingId: bookingId,
      bookingItemId: bookingItemProdId,
      inventoryItemId: inventoryItem1Id,
      handoverType: 'PICKUP',
      actualTime: new Date('2026-06-10T08:15:00.000Z'),
      handledBy: providerAoDaiId,
      conditionPhotos: ['https://example.com/handover-pickup.jpg'],
      conditionNotes: 'Áo dài mới, đủ cúc, sạch sẽ.',
      accessoriesHanded: ['Mấn trắng', 'Quần lụa'],
      depositDeduction: { depositAmount: 500000, deductionAmount: 0, refundableAmount: 500000, deductionReasons: [] },
      status: 'COMPLETED',
      createdAt: new Date('2026-06-10T08:15:00.000Z')
    }
  ];
  await db.collection('rental_handovers').insertMany(rentalHandovers);

  // ==========================================
  // 22. payments
  // ==========================================
  const payments = [
    {
      _id: paymentDepositId,
      bookingId: bookingId,
      paymentCode: 'PAY-DEP-10001',
      amount: 500000,
      purpose: 'DEPOSIT_PAYMENT',
      paymentMethod: 'PAYOS',
      status: 'SUCCESS',
      payos: {
        orderCode: 20261010001,
        paymentLinkId: 'payos_payment_link_id',
        checkoutUrl: 'https://pay.payos.vn/web/payos_payment_link_id',
        qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=payos_qr_payload',
        returnUrl: 'http://localhost:5173/payment/return',
        cancelUrl: 'http://localhost:5173/payment/cancel',
        description: 'BK10001 DEPOSIT'
      },
      paidAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000)
    }
  ];
  await db.collection('payments').insertMany(payments);

  // ==========================================
  // 23. payment_webhook_events
  // ==========================================
  const webhookEvents = [
    {
      webhookId: 'payos_evt_99887766',
      provider: 'PAYOS',
      payload: {
        orderCode: 20261010001,
        amount: 500000,
        description: 'BK10001 DEPOSIT',
        reference: 'FT26100987654321',
        transactionDateTime: new Date().toISOString()
      },
      signature: 'calculated_signature_hash_string',
      isValid: true,
      processed: true,
      processedAt: new Date(),
      createdAt: new Date()
    }
  ];
  await db.collection('payment_webhook_events').insertMany(webhookEvents);

  // ==========================================
  // 24. refund_requests
  // ==========================================
  const refundRequests = [
    {
      _id: refundRequestId,
      bookingId: bookingId,
      paymentId: paymentDepositId,
      requestedBy: customerId,
      amount: 500000,
      reason: 'Hủy lịch đột xuất theo đúng chính sách hoàn tiền 48h',
      status: 'PENDING',
      adminNotes: null,
      transactions: [],
      createdAt: new Date()
    }
  ];
  await db.collection('refund_requests').insertMany(refundRequests);

  // ==========================================
  // 25. booking_settlements
  // ==========================================
  const settlements = [
    {
      _id: settlementId,
      bookingId: bookingId,
      providerId: providerAoDaiProfileId,
      grossAmount: 250000,
      platformCommission: 25000, // 10% commission
      providerReceivable: 225000,
      commissionCollection: {
        method: 'MONTHLY_INVOICE',
        status: 'PENDING',
        dueAt: new Date('2026-07-05')
      },
      settlementStatus: 'CALCULATED',
      createdAt: new Date()
    }
  ];
  await db.collection('booking_settlements').insertMany(settlements);

  // ==========================================
  // 26. reviews
  // ==========================================
  const reviews = [
    {
      _id: reviewId,
      bookingId: bookingId,
      bookingItemId: bookingItemProdId,
      customerId: customerId,
      providerId: providerAoDaiProfileId,
      rating: 5,
      comment: 'Áo rất mới, vải lụa tơ tằm sờ siêu mượt. Chủ shop phục vụ nhiệt tình.',
      images: ['https://example.com/review1.jpg'],
      reply: 'Cảm ơn quý khách đã tin tưởng và sử dụng sản phẩm của Huế Áo Dài Studio!',
      repliedAt: new Date(),
      createdAt: new Date()
    }
  ];
  await db.collection('reviews').insertMany(reviews);

  // ==========================================
  // 27. disputes
  // ==========================================
  const disputes = [
    {
      _id: disputeId,
      bookingId: bookingId,
      bookingItemId: bookingItemProdId,
      openedBy: customerId,
      againstProviderId: providerAoDaiProfileId,
      handoverId: handoverPickupId,
      refundRequestId: null,
      reason: 'Bị lỗi chỉ thêu mặt sau tà áo mà shop không báo trước lúc nhận hàng.',
      evidencePhotos: ['https://example.com/dispute-evidence.jpg'],
      status: 'OPEN',
      adminDecision: null,
      obligation: null,
      createdAt: new Date()
    }
  ];
  await db.collection('disputes').insertMany(disputes);

  // ==========================================
  // 28. notifications
  // ==========================================
  const notifications = [
    {
      userId: customerId,
      title: 'Thanh toán cọc thành công!',
      content: 'Hệ thống đã nhận được 500,000đ thanh toán đặt cọc cho booking BK10001.',
      type: 'PAYMENT',
      isRead: false,
      metadata: { bookingId: bookingId },
      createdAt: new Date()
    },
    {
      userId: providerAoDaiId,
      title: 'Lịch Booking Mới',
      content: 'Bạn có một booking mới mã số BK10001 lịch thuê từ ngày 10/06 đến 13/06.',
      type: 'BOOKING',
      isRead: true,
      readAt: new Date(),
      metadata: { bookingId: bookingId },
      createdAt: new Date()
    }
  ];
  await db.collection('notifications').insertMany(notifications);

  // ==========================================
  // 29. audit_logs
  // ==========================================
  const auditLogs = [
    {
      actorId: adminId,
      action: 'PROVIDER_VERIFICATION_APPROVED',
      resource: 'providers',
      resourceId: providerAoDaiProfileId,
      oldValues: { status: 'PENDING' },
      newValues: { status: 'APPROVED' },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      createdAt: new Date()
    }
  ];
  await db.collection('audit_logs').insertMany(auditLogs);

  console.log('Seed data successfully inserted!');
  console.log('Seeded 29 collections successfully!');
  await mongoose.disconnect();
  console.log('Database disconnected successfully!');
}

seed().catch(async (error) => {
  console.error('Error seeding database:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
