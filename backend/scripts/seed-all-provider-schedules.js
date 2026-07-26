const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  // Find all providers with PHOTOGRAPHY capability
  const providers = await db.collection('providers').find({ capabilities: 'PHOTOGRAPHY' }).toArray();
  console.log(`Found ${providers.length} photography providers.`);
  
  let createdCount = 0;
  for (const p of providers) {
    const existingCount = await db.collection('provider_schedules').countDocuments({ providerId: p._id });
    if (existingCount === 0) {
      console.log(`Provider ${p.businessName} (${p._id}) has 0 schedules. Seeding default recurring schedules...`);
      
      // Seed Monday (1) to Friday (5)
      for (let day = 1; day <= 5; day++) {
        await db.collection('provider_schedules').insertOne({
          providerId: p._id,
          scheduleType: 'RECURRING',
          dayOfWeek: day,
          workingHours: [
            {
              start: '07:00',
              end: '17:00'
            }
          ],
          customSlots: [],
          offDays: [],
          specificDate: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        createdCount++;
      }
    } else {
      console.log(`Provider ${p.businessName} (${p._id}) already has ${existingCount} schedules. Skipping.`);
    }
  }
  
  console.log(`Successfully seeded ${createdCount} recurring schedules for photographers.`);
  await mongoose.disconnect();
}

main().catch(console.error);
