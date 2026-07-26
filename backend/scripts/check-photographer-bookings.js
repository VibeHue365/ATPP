const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const providerId = '6a5ca04a2e25fb0befb0be4a';
  
  // Find all active booking items for this provider on July 20th, 2026
  const startOfDay = new Date('2026-07-20T00:00:00.000Z');
  const endOfDay = new Date('2026-07-20T23:59:59.999Z');
  
  const items = await db.collection('booking_items').find({
    providerId: new mongoose.Types.ObjectId(providerId),
    itemType: 'PHOTOGRAPHY_PACKAGE',
    shootDate: { $gte: startOfDay, $lte: endOfDay }
  }).toArray();
  
  console.log(`Found ${items.length} booking items on July 20th, 2026:`);
  for (const item of items) {
    const booking = await db.collection('bookings').findOne({ _id: item.bookingId });
    console.log(JSON.stringify({
      bookingId: item.bookingId,
      bookingStatus: booking?.status,
      shootTimeSlot: item.shootTimeSlot,
      quantity: item.quantity
    }, null, 2));
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
