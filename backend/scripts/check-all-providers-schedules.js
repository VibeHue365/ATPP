const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const providers = await db.collection('users').find({ roles: 'PROVIDER' }).toArray();
  console.log(`Found ${providers.length} providers:`);
  
  for (const p of providers) {
    const schedules = await db.collection('provider_schedules').find({ providerId: p._id }).toArray();
    console.log(`- Provider ID: ${p._id}, name: ${p.fullName || p.businessName || 'N/A'}`);
    console.log(`  * Number of schedules: ${schedules.length}`);
    schedules.forEach(s => {
      console.log(`    - Day ${s.dayOfWeek} (${s.scheduleType}): ${JSON.stringify(s.workingHours)}`);
    });
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
