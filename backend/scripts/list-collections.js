const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('Collections:');
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`- ${c.name} (${count} documents)`);
    if (count > 0) {
      const doc = await db.collection(c.name).findOne({});
      console.log(`  * Sample:`, JSON.stringify(doc, null, 2).slice(0, 300));
    }
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
