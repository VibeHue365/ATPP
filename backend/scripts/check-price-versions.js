const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const priceVersions = await db.collection('price_versions').find({ targetId: new mongoose.Types.ObjectId('6a5c848063fcd34d25d12639') }).toArray();
  console.log('Price Versions:', JSON.stringify(priceVersions, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
