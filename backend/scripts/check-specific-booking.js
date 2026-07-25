const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const booking = await db.collection('bookings').findOne({ _id: new mongoose.Types.ObjectId('6a5d1982e9a1fd05d2cfe9bc') });
  console.log('Booking:', JSON.stringify(booking, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
