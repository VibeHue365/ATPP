const mongoose = require('./node_modules/mongoose');
const bcrypt = require('./node_modules/bcryptjs');
const uri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

const TEST_PASSWORD = 'Test@123456';

mongoose.connect(uri).then(async () => {
  const hash = await bcrypt.hash(TEST_PASSWORD, 12);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

  // Set password + ensure emailVerified for customer@vibehue.com
  const r1 = await User.updateOne(
    { 'auth.emailNormalized': 'customer@vibehue.com' },
    { $set: { 'auth.passwordHash': hash, 'auth.emailVerified': true, accountStatus: 'ACTIVE' } }
  );
  console.log('customer@vibehue.com updated:', r1.modifiedCount);

  // Set password + ensure emailVerified for provider.demo@vibehue.com
  const r2 = await User.updateOne(
    { 'auth.emailNormalized': 'provider.demo@vibehue.com' },
    { $set: { 'auth.passwordHash': hash, 'auth.emailVerified': true, accountStatus: 'ACTIVE' } }
  );
  console.log('provider.demo@vibehue.com updated:', r2.modifiedCount);

  console.log('\n✅ TÀI KHOẢN TEST MỚI:');
  console.log('👤 Khách hàng: customer@vibehue.com | Mật khẩu:', TEST_PASSWORD);
  console.log('🏪 Đối tác:    provider.demo@vibehue.com | Mật khẩu:', TEST_PASSWORD);

  mongoose.disconnect();
}).catch(e => console.error('DB Error:', e.message));
