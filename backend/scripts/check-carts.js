const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const carts = await db.collection('carts').find({}).toArray();
  console.log(`Found ${carts.length} carts:`);
  carts.forEach(c => {
    console.log(JSON.stringify(c, null, 2));
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
