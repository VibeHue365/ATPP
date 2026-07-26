const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  const providers = await db.collection('providers').find({}).toArray();
  
  console.log(`Found ${providers.length} providers:`);
  providers.forEach(p => {
    console.log(JSON.stringify(p, null, 2));
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
