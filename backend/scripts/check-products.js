const mongoose = require('mongoose');

async function main() {
  const uri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const products = await db.collection('products').find({}).toArray();
    console.log('--- PRODUCTS IN DB ---');
    products.forEach(p => {
      console.log(`ID: ${p._id}, Name: ${p.name}, Colors: ${JSON.stringify(p.colors)}, Images: ${JSON.stringify(p.images)}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
main();
