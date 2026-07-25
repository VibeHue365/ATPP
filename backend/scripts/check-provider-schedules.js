const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const providerId = '6a5ca04a2e25fb0befb0be4a';
  const schedules = await db.collection('provider_schedules').find({ providerId: new mongoose.Types.ObjectId(providerId) }).toArray();
  
  console.log(`Schedules for provider ${providerId}:`);
  schedules.forEach(s => {
    console.log(JSON.stringify(s, null, 2));
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
