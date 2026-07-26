const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const providerId = '6a5c848063fcd34d25d12632'; // Trần Phú Photography
  
  // Let's add recurring schedules for days 1 to 6 (Monday to Saturday)
  const schedulesToAdd = [];
  for (let day = 1; day <= 6; day++) {
    schedulesToAdd.push({
      providerId: new mongoose.Types.ObjectId(providerId),
      scheduleType: 'RECURRING',
      dayOfWeek: day,
      workingHours: [
        {
          start: '08:00',
          end: '18:00'
        }
      ],
      offDays: [],
      customSlots: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  // Check if they already exist to avoid duplication
  for (const doc of schedulesToAdd) {
    const exists = await db.collection('provider_schedules').findOne({
      providerId: doc.providerId,
      scheduleType: 'RECURRING',
      dayOfWeek: doc.dayOfWeek
    });
    if (!exists) {
      await db.collection('provider_schedules').insertOne(doc);
      console.log(`Added recurring schedule for dayOfWeek: ${doc.dayOfWeek}`);
    } else {
      console.log(`Schedule already exists for dayOfWeek: ${doc.dayOfWeek}`);
    }
  }
  
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(console.error);
