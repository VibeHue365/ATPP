const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  const reviews = await db.collection('customerreviews').find({}).toArray();
  
  console.log(`Found ${reviews.length} reviews:`);
  reviews.forEach(r => {
    console.log({
      id: r._id,
      providerId: r.providerId,
      customerId: r.customerId,
      rating: r.rating,
      comment: r.comment
    });
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
