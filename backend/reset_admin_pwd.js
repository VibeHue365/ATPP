const mongoose = require('./node_modules/mongoose');
const bcrypt = require('./node_modules/bcryptjs');

const uri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

// Set a new password for admin@vibehue.com
const NEW_PASSWORD = 'Admin@vibehue2026';

mongoose.connect(uri).then(async () => {
  const hash = await bcrypt.hash(NEW_PASSWORD, 12);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const result = await User.updateOne(
    { 'auth.emailNormalized': 'admin@vibehue.com' },
    { $set: { 'auth.passwordHash': hash } }
  );
  console.log('Updated:', result.modifiedCount, 'document(s)');
  console.log('New password for admin@vibehue.com is:', NEW_PASSWORD);
  mongoose.disconnect();
}).catch(e => console.error('DB Error:', e.message));
