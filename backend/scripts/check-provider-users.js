const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const providers = await db.collection('users').find({ roles: 'PROVIDER' }).toArray();
  for (const p of providers) {
    console.log(`User ID: ${p._id}, email: ${p.auth?.email || p.email}, phone: ${p.auth?.phone || p.phone}`);
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
