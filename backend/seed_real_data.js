const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const uri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    console.log('--- SEEDING REAL DATA FOR DEMO PROVIDER ---');
    
    // 1. Tìm user provider.demo@vibehue.com
    const user = await db.collection('users').findOne({ 'auth.emailNormalized': 'provider.demo@vibehue.com' });
    if (!user) {
      console.error('User provider.demo@vibehue.com not found');
      return;
    }
    const userId = user._id;
    
    // 2. Tìm hoặc tạo provider document
    let provider = await db.collection('providers').findOne({ userId });
    if (!provider) {
      const newProv = {
        _id: new ObjectId(),
        userId,
        businessName: 'Tiệm Áo Dài VibeHue Demo',
        capabilities: ['AODAI_RENTAL', 'PHOTOGRAPHY'],
        contact: { email: 'provider.demo@vibehue.com', phone: '0901234567' },
        address: { addressLine: '123 Phố Huế', city: 'Hà Nội', district: 'Hai Bà Trưng', ward: 'Phố Huế' },
        status: 'ACTIVE',
        rating: { averageRating: 4.8, totalReviews: 12 },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection('providers').insertOne(newProv);
      provider = newProv;
      console.log('Created new provider document.');
    }
    const providerId = provider._id;
    console.log(`Provider ID: ${providerId}`);
    
    // Clear old seeded products & bookings to avoid duplicates
    await db.collection('products').deleteMany({ providerId });
    await db.collection('photography_packages').deleteMany({ providerId });
    
    // 3. Tạo 3 sản phẩm áo dài
    const productsList = [
      {
        _id: new ObjectId(),
        providerId,
        name: 'Áo dài Phượng Bào Hoàng Cung',
        slug: 'ao-da-phuong-bao-hoang-cung-demo',
        basePrice: 800000,
        depositAmount: 400000,
        images: ['/hong_lien_hoa.png'],
        status: 'ACTIVE',
        createdAt: new Date()
      },
      {
        _id: new ObjectId(),
        providerId,
        name: 'Áo dài Cổ phục Nhật Bình đỏ',
        slug: 'ao-dai-co-phuc-nhat-binh-do-demo',
        basePrice: 500000,
        depositAmount: 250000,
        images: ['/cuc_hoa_mi.png'],
        status: 'ACTIVE',
        createdAt: new Date()
      },
      {
        _id: new ObjectId(),
        providerId,
        name: 'Áo dài Lụa Hà Đông Truyền Thống',
        slug: 'ao-dai-lua-ha-dong-truyen-thong-demo',
        basePrice: 350000,
        depositAmount: 150000,
        images: ['/hong_lien_hoa.png'],
        status: 'ACTIVE',
        createdAt: new Date()
      }
    ];
    await db.collection('products').insertMany(productsList);
    console.log('Inserted 3 products.');

    // 4. Tạo 3 photography packages
    const packagesList = [
      {
        _id: new ObjectId(),
        providerId,
        name: 'Chụp ảnh Cổ phục Nhật Bình',
        slug: 'chup-anh-co-phuc-nhat-binh-demo',
        price: 2500000,
        status: 'ACTIVE',
        createdAt: new Date()
      },
      {
        _id: new ObjectId(),
        providerId,
        name: 'Chụp ảnh Ngoại cảnh Huế',
        slug: 'chup-anh-ngoai-canh-hue-demo',
        price: 1800000,
        status: 'ACTIVE',
        createdAt: new Date()
      },
      {
        _id: new ObjectId(),
        providerId,
        name: 'Concept Nàng thơ Studio',
        slug: 'concept-nang-tho-studio-demo',
        price: 3000000,
        status: 'ACTIVE',
        createdAt: new Date()
      }
    ];
    await db.collection('photography_packages').insertMany(packagesList);
    console.log('Inserted 3 photography packages.');

    // 5. Tạo 1 customer user để đặt lịch
    let customer = await db.collection('users').findOne({ 'auth.emailNormalized': 'customer@vibehue.com' });
    if (!customer) {
      customer = await db.collection('users').findOne({ roles: 'CUSTOMER' });
    }
    const customerId = customer ? customer._id : userId;

    // Clear old bookings of this provider
    const oldBookings = await db.collection('bookings').find({ providerIds: providerId }).toArray();
    const oldBookingIds = oldBookings.map(b => b._id);
    await db.collection('bookings').deleteMany({ providerIds: providerId });
    await db.collection('booking_items').deleteMany({ bookingId: { $in: oldBookingIds } });
    await db.collection('booking_schedules').deleteMany({ bookingId: { $in: oldBookingIds } });

    // Tạo bookings & items cho 6 tháng (từ tháng 1 đến tháng 6 năm 2026)
    const baseDate = new Date();
    const monthlyRevenues = [4500000, 8200000, 3300000, 12500000, 18000000, 24500000];

    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(baseDate.getMonth() - (5 - i));
      
      const revenue = monthlyRevenues[i];
      const bookingId = new ObjectId();
      const code = 'BK_' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // Tạo booking
      await db.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: code,
        customerId,
        providerIds: [providerId],
        status: 'COMPLETED',
        pricingSummary: {
          grandTotal: revenue
        },
        createdAt: date,
        updatedAt: date
      });

      // Tạo booking item (chia nhỏ doanh thu)
      await db.collection('booking_items').insertOne({
        _id: new ObjectId(),
        bookingId,
        providerId,
        productId: productsList[i % 3]._id,
        photographyPackageId: packagesList[i % 3]._id,
        unitPrice: revenue,
        quantity: 1,
        createdAt: date
      });
    }
    console.log('Inserted 6 monthly bookings for historical revenue growth chart.');

    // 6. Tạo 4 lịch hẹn tương lai (upcoming schedules) trong tháng 7/2026
    const scheduleData = [
      { custName: 'Hoàng Lê', dateOffset: 2, time: '08:00 - 11:30', status: 'DEPOSIT_PAID', pkgIdx: 0 },
      { custName: 'Quốc Khánh', dateOffset: 5, time: '14:00 - 17:00', status: 'PENDING', pkgIdx: 1 },
      { custName: 'Minh Thảo', dateOffset: 9, time: '09:00 - 12:00', status: 'DEPOSIT_PAID', pkgIdx: 2 },
      { custName: 'Ngọc Vy', dateOffset: 12, time: '15:00 - 18:00', status: 'DEPOSIT_PAID', pkgIdx: 0 }
    ];

    for (const s of scheduleData) {
      const bId = new ObjectId();
      const biId = new ObjectId();
      const sDate = new Date();
      sDate.setDate(sDate.getDate() + s.dateOffset);
      const code = 'BK_' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // Tạo booking
      await db.collection('bookings').insertOne({
        _id: bId,
        bookingCode: code,
        customerId,
        providerIds: [providerId],
        status: s.status,
        pricingSummary: {
          grandTotal: packagesList[s.pkgIdx].price
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Tạo booking item
      await db.collection('booking_items').insertOne({
        _id: biId,
        bookingId: bId,
        providerId,
        photographyPackageId: packagesList[s.pkgIdx]._id,
        unitPrice: packagesList[s.pkgIdx].price,
        quantity: 1,
        createdAt: new Date()
      });

      // Tạo schedule
      await db.collection('booking_schedules').insertOne({
        _id: new ObjectId(),
        bookingId: bId,
        bookingItemId: biId,
        scheduleType: 'PHOTOSHOOT',
        scheduledDate: sDate,
        timeSlot: s.time,
        status: 'SCHEDULED',
        notes: s.custName // Lưu tạm customerName ở notes để populator lấy ra
      });
    }
    console.log('Inserted 4 upcoming photoshoot schedules in database.');
    console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
