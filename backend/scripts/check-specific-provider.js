const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const provider = await db.collection('providers').findOne({ _id: new mongoose.Types.ObjectId('6a5c848063fcd34d25d12631') });
  console.log('Provider:', JSON.stringify(provider, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
