const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const customerId = '6a5c848063fcd34d25d1262d';
  const bookings = await db.collection('bookings').find({ customerId: new mongoose.Types.ObjectId(customerId) }).toArray();
  
  console.log(`Found ${bookings.length} bookings for customer ${customerId}:`);
  for (const b of bookings) {
    const items = await db.collection('booking_items').find({ bookingId: b._id }).toArray();
    console.log(`- Booking ID: ${b._id}, status: ${b.status}, type: ${b.bookingType}`);
    items.forEach(i => {
      console.log(`  * Item type: ${i.itemType}, shootDate: ${i.shootDate}, shootTimeSlot: ${i.shootTimeSlot}`);
    });
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
