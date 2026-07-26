const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const bookingId = '6a5d1982e9a1fd05d2cfe9bc';
  const items = await db.collection('booking_items').find({ bookingId: new mongoose.Types.ObjectId(bookingId) }).toArray();
  
  console.log(`Found ${items.length} items for booking ${bookingId}:`);
  items.forEach(i => {
    console.log(JSON.stringify(i, null, 2));
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
