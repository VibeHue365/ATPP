const mongoose = require('mongoose');

async function run() {
  // Thay thế email tài khoản mới của bạn vào đây
  const targetEmail = "longdaibui@gmail.com"; 

  const uri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';
  await mongoose.connect(uri);
  
  const User = mongoose.connection.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Provider = mongoose.connection.model('Provider', new mongoose.Schema({}, { strict: false }), 'providers');
  
  const user = await User.findOne({ "auth.emailNormalized": targetEmail.toLowerCase().trim() });
  
  if (!user) {
    console.log(`\n❌ Không tìm thấy User nào có email: ${targetEmail}`);
    console.log(`👉 Vui lòng đăng ký tài khoản này trên Web trước khi chạy script.\n`);
    await mongoose.disconnect();
    return;
  }
  
  const providerId = new mongoose.Types.ObjectId();
  
  // Tạo thông tin Provider mới
  await Provider.create({
    _id: providerId,
    userId: user._id,
    businessName: user.profile.fullName + " Studio",
    capabilities: ["AODAI_RENTAL", "PHOTOGRAPHY"],
    contact: {
      email: user.auth.email,
      phone: user.auth.phone || "0901234567"
    },
    address: {
      addressLine: "123 Phố Huế, Quận Hai Bà Trưng",
      city: "Hà Nội",
      district: "Hai Bà Trưng",
      ward: "Phố Huế"
    },
    media: {
      images: ["/hong_lien_hoa.png", "/cuc_hoa_mi.png"],
      logoUrl: "/avatar_hanna.png",
      coverUrl: "/hero_bg.png"
    },
    policies: {
      cancellationPolicy: "Hủy lịch trước 24 giờ hoàn cọc 100%. Hủy trễ phạt 50% tiền cọc.",
      rentalPolicy: "Thời gian thuê tối đa 3 ngày. Trả trễ hạn phạt 100.000đ/ngày."
    },
    paymentAccounts: [],
    rating: {
      averageRating: 5.0,
      totalReviews: 1
    },
    status: "APPROVED",
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // Cập nhật User thành Provider
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        roles: ["PROVIDER"],
        defaultRole: "PROVIDER",
        provider: {
          providerId: providerId,
          providerStatus: "APPROVED"
        }
      }
    }
  );
  
  console.log(`\n✅ Nâng cấp thành công tài khoản ${targetEmail} thành PROVIDER!`);
  console.log(`👉 Hãy đăng xuất và đăng nhập lại tài khoản trên web.\n`);
  
  await mongoose.disconnect();
}

run().catch(console.error);
