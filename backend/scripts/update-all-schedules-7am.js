const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  // Find all recurring schedules
  const schedules = await db.collection('provider_schedules').find({ scheduleType: 'RECURRING' }).toArray();
  console.log(`Found ${schedules.length} recurring schedules to update.`);
  
  let updatedCount = 0;
  for (const s of schedules) {
    if (s.workingHours && s.workingHours.length > 0) {
      const updatedWorkingHours = s.workingHours.map(hours => ({
        ...hours,
        start: '07:00' // Set start to 07:00
      }));
      
      await db.collection('provider_schedules').updateOne(
        { _id: s._id },
        { $set: { workingHours: updatedWorkingHours, updatedAt: new Date() } }
      );
      updatedCount++;
    }
  }
  
  console.log(`Successfully updated ${updatedCount} recurring schedules to start at 07:00.`);
  await mongoose.disconnect();
}

main().catch(console.error);
