const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  // Find all providers with status/role or from the provider collection
  const db = mongoose.connection.db;
  const providers = await db.collection('providers').find({}).toArray();
  
  console.log(`Found ${providers.length} providers:`);
  providers.forEach(p => {
    console.log({
      id: p._id,
      businessName: p.businessName,
      providerType: p.providerType,
      equipment: p.equipment,
      rating: p.rating,
      packages: p.packages?.map(pkg => ({ name: pkg.name, price: pkg.price }))
    });
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
