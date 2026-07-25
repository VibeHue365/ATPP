const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const providerId = '6a5c848063fcd34d25d12632'; // Trần Phú Photography
  
  // Update or insert recurring schedules for days 0 to 6 (Sunday to Saturday) with 07:00 - 21:00 working hours
  for (let day = 0; day <= 6; day++) {
    const filter = {
      providerId: new mongoose.Types.ObjectId(providerId),
      scheduleType: 'RECURRING',
      dayOfWeek: day
    };
    
    const update = {
      $set: {
        workingHours: [
          {
            start: '07:00',
            end: '21:00'
          }
        ],
        updatedAt: new Date()
      }
    };
    
    const result = await db.collection('provider_schedules').updateOne(filter, update, { upsert: true });
    console.log(`Updated schedule for dayOfWeek: ${day}. Match count: ${result.matchedCount}, Upserted count: ${result.upsertedCount}`);
  }
  
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(console.error);
