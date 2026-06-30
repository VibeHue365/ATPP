const { MongoClient } = require('mongodb');

async function main() {
  const uri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const users = await db.collection('users').find({}).toArray();
    console.log('--- USER ACCOUNTS IN DATABASE ---');
    users.forEach(u => {
      const email = u.auth?.email;
      const fullName = u.profile?.fullName;
      console.log(`- Email: ${email}`);
      console.log(`  Full Name: ${fullName}`);
      console.log(`  Roles: ${JSON.stringify(u.roles)}`);
      console.log(`  Account Status: ${u.accountStatus}`);
      console.log('-------------------------------');
    });
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
