const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  const packages = await db.collection('photography_packages').find({}).toArray();
  
  console.log(`Found ${packages.length} photography packages:`);
  packages.forEach(p => {
    console.log({
      id: p._id,
      providerId: p.providerId,
      name: p.name,
      slug: p.slug,
      price: p.price,
      status: p.status
    });
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
