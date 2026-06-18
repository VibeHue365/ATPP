const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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

  // Define names and capabilities
  const photograhersData = [
    {
      name: 'Minh Anh Lê',
      email: 'minhanhle@vibehue.com',
      phone: '+84911122201',
      city: 'Thừa Thiên Huế',
      district: 'Thành phố Huế',
      addressLine: '12 Đại Nội',
      quote: '"Lưu giữ nét kiêu sa cung đình Huế qua lăng kính độc bản"',
      gear: ['Sony A7R V', 'Lens 85mm f/1.4 GM', 'Flash Profoto A10'],
      experience: '5 năm kinh nghiệm',
      packages: [
        {
          name: 'Gói Cơ Bản (Heritage Minimal)',
          slug: 'goi-co-ban-heritage-minimal-minhanh',
          description: 'Chụp ngoại cảnh Đại Nội 2 giờ, 15 ảnh chỉnh sửa chất lượng cao, giao ảnh sau 3 ngày.',
          price: 1500000,
          durationHours: 2,
          editedPhotosCount: 15,
          rawPhotosCount: 120,
          deliveryDays: 3,
        },
        {
          name: 'Gói Nghệ Thuật (Fine-Art Heritage)',
          slug: 'goi-nghe-thuat-fine-art-minhanh',
          description: 'Chụp Đại Nội + Cung An Định 4 giờ, hỗ trợ concept trang phục, makeup chuyên nghiệp, 35 ảnh chỉnh sửa + album ảnh cao cấp.',
          price: 3500000,
          durationHours: 4,
          editedPhotosCount: 35,
          rawPhotosCount: 250,
          deliveryDays: 5,
        }
      ],
      portfolio: [
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
        'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f',
        'https://images.unsplash.com/photo-1542038784456-1ea8e935640e'
      ]
    },
    {
      name: 'Hoàng Minh',
      email: 'hoangminh@vibehue.com',
      phone: '+84911122202',
      city: 'Thừa Thiên Huế',
      district: 'Thành phố Huế',
      addressLine: '88 Lê Lợi',
      quote: '"Vẻ đẹp vĩnh cửu qua lăng kính đương đại"',
      gear: ['Canon R5', 'Lens 50mm f/1.2 L', 'Flash Godox V1'],
      experience: '6 năm kinh nghiệm',
      packages: [
        {
          name: 'Gói Chụp Studio Cổ Phục',
          slug: 'goi-chup-studio-co-phuc-hoangminh',
          description: 'Chụp tại studio phông nền nghệ thuật, trang phục tự chọn, 15 ảnh chỉnh sửa.',
          price: 1200000,
          durationHours: 1.5,
          editedPhotosCount: 15,
          rawPhotosCount: 100,
          deliveryDays: 2,
        },
        {
          name: 'Gói Ngoại Cảnh Cung Đình Cao Cấp',
          slug: 'goi-ngoai-canh-cung-dinh-hoangminh',
          description: 'Chụp ngoại cảnh Đại Nội, Lăng Khải Định, 4 giờ chụp, makeup + làm tóc, 40 ảnh chỉnh sửa chuyên sâu.',
          price: 3800000,
          durationHours: 4,
          editedPhotosCount: 40,
          rawPhotosCount: 300,
          deliveryDays: 4,
        }
      ],
      portfolio: [
        'https://images.unsplash.com/photo-1517841905240-472988babdf9',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1',
        'https://images.unsplash.com/photo-1542038784456-1ea8e935640e'
      ]
    },
    {
      name: 'Lê Thảo',
      email: 'lethao@vibehue.com',
      phone: '+84911122203',
      city: 'Thừa Thiên Huế',
      district: 'Thành phố Huế',
      addressLine: '15 Vỹ Dạ',
      quote: '"Ghi lại những khoảnh khắc dịu dàng nhất"',
      gear: ['Sony A7IV', 'Lens 35mm f/1.4 GM', 'Flash Godox AD200'],
      experience: '3 năm kinh nghiệm',
      packages: [
        {
          name: 'Gói Nàng Thơ Trữ Tình',
          slug: 'goi-nang-tho-tru-tinh-lethao',
          description: 'Chụp tại đồi Thiên An hoặc bờ sông Hương thơ mộng, phong cách lãng mạn nhẹ nhàng, 20 ảnh chỉnh sửa.',
          price: 1800000,
          durationHours: 3,
          editedPhotosCount: 20,
          rawPhotosCount: 150,
          deliveryDays: 3,
        },
        {
          name: 'Gói Nàng Thơ Cổ Phong',
          slug: 'goi-nang-tho-co-phong-lethao',
          description: 'Phong cách cổ phong nhẹ nhàng trữ tình tại lăng tẩm Huế, 3 giờ chụp, 25 ảnh chỉnh sửa.',
          price: 2400000,
          durationHours: 3,
          editedPhotosCount: 25,
          rawPhotosCount: 200,
          deliveryDays: 4,
        }
      ],
      portfolio: [
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
        'https://images.unsplash.com/photo-1542038784456-1ea8e935640e',
        'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f'
      ]
    },
    {
      name: 'Trần Bảo',
      email: 'tranbao@vibehue.com',
      phone: '+84911122204',
      city: 'Quảng Nam',
      district: 'Hội An',
      addressLine: '90 Trần Phú',
      quote: '"Kể chuyện cổ phục bằng ngôn ngữ điện ảnh"',
      gear: ['Fujifilm GFX', 'Lens 110mm f/2.0 GF', 'Elinchrom One'],
      experience: '7 năm kinh nghiệm',
      packages: [
        {
          name: 'Gói Phố Cổ Film Look',
          slug: 'goi-pho-co-film-look-tranbao',
          description: 'Màu phim hoài niệm đặc trưng phố cổ Hội An, 3 giờ chụp, 20 ảnh chỉnh sửa, giao ảnh sau 3 ngày.',
          price: 2000000,
          durationHours: 3,
          editedPhotosCount: 20,
          rawPhotosCount: 180,
          deliveryDays: 3,
        },
        {
          name: 'Gói Fine-Art Cinematic',
          slug: 'goi-fine-art-cinematic-tranbao',
          description: 'Gói chụp ảnh nghệ thuật đỉnh cao kết hợp ánh sáng điện ảnh, 5 giờ chụp ngoại cảnh Hội An + biển An Bàng, 45 ảnh chỉnh sửa.',
          price: 4500000,
          durationHours: 5,
          editedPhotosCount: 45,
          rawPhotosCount: 350,
          deliveryDays: 5,
        }
      ],
      portfolio: [
        'https://images.unsplash.com/photo-1517841905240-472988babdf9',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1',
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'
      ]
    }
  ];

  console.log('Seeding photographers and packages...');

  for (const item of photograhersData) {
    // 1. Check if user already exists
    let user = await db.collection('users').findOne({ 'auth.email': item.email });
    let userId;

    if (!user) {
      userId = new mongoose.Types.ObjectId();
      await db.collection('users').insertOne({
        _id: userId,
        auth: {
          email: item.email,
          emailNormalized: item.email.toLowerCase(),
          phone: item.phone,
          phoneNormalized: item.phone,
          passwordHash: '$2a$10$X87q8P6xVv1.K5n6WkS/Uu4d4u3l.6r9gHjTj5kL4U5v6w7x8y9z0', // dummy
          emailVerified: true,
          phoneVerified: true,
          authProviders: [{ provider: 'LOCAL', providerUserId: null }]
        },
        roles: ['PROVIDER'],
        defaultRole: 'PROVIDER',
        accountStatus: 'ACTIVE',
        profile: {
          fullName: item.name,
          avatarUrl: item.portfolio[0],
          gender: 'MALE',
          dateOfBirth: new Date('1990-01-01')
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Created user for: ${item.name}`);
    } else {
      userId = user._id;
    }

    // 2. Check if provider profile exists
    let provider = await db.collection('providers').findOne({ userId: userId });
    let providerId;

    if (!provider) {
      providerId = new mongoose.Types.ObjectId();
      await db.collection('providers').insertOne({
        _id: providerId,
        userId: userId,
        businessName: item.name,
        capabilities: ['PHOTOGRAPHY'],
        contact: {
          email: item.email,
          phone: item.phone,
          website: null
        },
        address: {
          addressLine: item.addressLine,
          ward: null,
          district: item.district,
          city: item.city
        },
        media: {
          logoUrl: null,
          coverUrl: null,
          images: item.portfolio
        },
        equipment: item.gear,
        portfolio: item.portfolio,
        policies: {
          cancellationPolicy: 'Hủy trước 48h hoàn trả cọc. Sau 48h phạt cọc.',
          rentalPolicy: 'Giao ảnh đúng hạn.'
        },
        rating: { averageRating: 4.9, totalReviews: 45 },
        status: 'APPROVED',
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Created provider profile for: ${item.name}`);
    } else {
      providerId = provider._id;
      // Ensure businessName and capabilities match
      await db.collection('providers').updateOne(
        { _id: providerId },
        { 
          $set: { 
            businessName: item.name, 
            capabilities: ['PHOTOGRAPHY'],
            'media.images': item.portfolio,
            equipment: item.gear,
            portfolio: item.portfolio
          } 
        }
      );
    }

    // 3. Insert packages
    for (const pkg of item.packages) {
      let existingPkg = await db.collection('photography_packages').findOne({ slug: pkg.slug });
      if (!existingPkg) {
        await db.collection('photography_packages').insertOne({
          providerId: providerId,
          name: pkg.name,
          slug: pkg.slug,
          description: pkg.description,
          price: pkg.price,
          durationHours: pkg.durationHours,
          editedPhotosCount: pkg.editedPhotosCount,
          rawPhotosCount: pkg.rawPhotosCount,
          deliveryDays: pkg.deliveryDays,
          travelFeeNotes: 'Đã bao gồm chi phí di chuyển trong nội thành.',
          overtimeFeePerHour: 150000,
          images: [item.portfolio[1] || item.portfolio[0]],
          status: 'ACTIVE',
          rating: { averageRating: 4.9, totalReviews: 20 },
          createdAt: new Date()
        });
        console.log(`Created package ${pkg.name} for ${item.name}`);
      } else {
        // Update package price and provider ID
        await db.collection('photography_packages').updateOne(
          { _id: existingPkg._id },
          { $set: { price: pkg.price, providerId: providerId, status: 'ACTIVE' } }
        );
      }
    }
  }

  console.log('Seeding completed successfully!');
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Error seeding data:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
