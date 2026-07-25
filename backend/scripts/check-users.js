const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  const users = await db.collection('users').find({}).toArray();
  console.log(`Found ${users.length} users:`);
  users.forEach(u => {
    console.log(`ID: ${u._id}, name: ${u.fullName}, email: ${u.email}, roles: ${u.roles}`);
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
