const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('Collections in DB:', collections.map(c => c.name));

  // Let's find schedule collection
  const scheduleCollectionName = collections.find(c => c.name.includes('schedule'))?.name || 'provider_schedules';
  console.log('Using schedule collection:', scheduleCollectionName);

  const schedules = await db.collection(scheduleCollectionName).find({}).toArray();
  console.log(`Found ${schedules.length} schedules:`);
  schedules.forEach(s => {
    console.log(JSON.stringify(s, null, 2));
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
