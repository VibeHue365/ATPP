const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  // Let's find booking schedules for recent bookings
  const recentBookings = await db.collection('bookings').find({}).sort({ createdAt: -1 }).limit(3).toArray();
  
  for (const b of recentBookings) {
    console.log(`\nBooking ID: ${b._id} (${b.bookingType})`);
    const schedules = await db.collection('booking_schedules').find({ bookingId: b._id }).toArray();
    console.log(`Found ${schedules.length} schedules:`);
    schedules.forEach(s => {
      console.log(JSON.stringify(s, null, 2));
    });
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
