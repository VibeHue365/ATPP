const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const booking = await db.collection('bookings').findOne({ bookingCode: 'B2774406173' });
  if (!booking) {
    console.log('Booking B2774406173 not found.');
    await mongoose.disconnect();
    return;
  }
  
  console.log('Booking document:');
  console.log(JSON.stringify(booking, null, 2));
  
  const items = await db.collection('booking_items').find({ bookingId: booking._id }).toArray();
  console.log('\nBooking items:');
  console.log(JSON.stringify(items, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
