const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const product = await db.collection('products').findOne({ _id: new mongoose.Types.ObjectId('6a5c848063fcd34d25d12639') });
  console.log('Product:', JSON.stringify(product, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
