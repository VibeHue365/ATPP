const mongoose = require('./node_modules/mongoose');
const uri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

mongoose.connect(uri).then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const admin = await User.findOne({ 'auth.emailNormalized': 'admin@vibehue.com' }).lean();
  if (admin) {
    console.log('auth keys:', Object.keys(admin.auth || {}));
    console.log('passwordHash exists:', !!admin.auth?.passwordHash);
    console.log('auth.emailVerified:', admin.auth?.emailVerified);
    console.log('accountStatus:', admin.accountStatus);
  } else {
    console.log('Admin not found!');
  }
  mongoose.disconnect();
}).catch(e => console.error('DB Error:', e.message));
