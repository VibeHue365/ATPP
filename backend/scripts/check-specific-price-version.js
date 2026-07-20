const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const pv = await db.collection('price_versions').findOne({ _id: new mongoose.Types.ObjectId('6a5dbb8030ddc806bbcc7cb4') });
  console.log('Price Version:', JSON.stringify(pv, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
