const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const providers = await db.collection('providers').find({}).toArray();
  console.log(`Found ${providers.length} providers in providers collection:`);
  for (const p of providers) {
    console.log(`Provider ID: ${p._id}, userId: ${p.userId}, businessName: ${p.businessName}, capabilities: ${p.capabilities}`);
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
