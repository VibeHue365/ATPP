const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  // Find recent bookings
  const bookings = await db.collection('bookings').find({}).sort({ createdAt: -1 }).limit(5).toArray();
  console.log(`Found ${bookings.length} recent bookings:`);
  
  for (const b of bookings) {
    console.log(JSON.stringify({
      id: b._id,
      customerName: b.customerName,
      createdAt: b.createdAt,
      status: b.status,
      bookingType: b.bookingType,
      items: b.items?.map(i => ({
        itemId: i.itemId,
        name: i.name,
        price: i.price,
        itemType: i.itemType,
        rentalType: i.rentalType,
        rentalFrom: i.rentalFrom,
        rentalTo: i.rentalTo,
        startTime: i.startTime,
        endTime: i.endTime,
        shootDate: i.shootDate,
        shootTimeSlot: i.shootTimeSlot,
        quantity: i.quantity
      }))
    }, null, 2));
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
