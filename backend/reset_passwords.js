const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function main() {
  const uri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const plainPassword = 'Test@123456';
    const hash = await bcrypt.hash(plainPassword, 10);
    
    console.log(`Generated bcryptjs hash for "${plainPassword}": ${hash}`);
    
    const targetEmails = [
      'admin@vibehue.com',
      'customer@vibehue.com',
      'aodai@vibehue.com',
      'photo@vibehue.com',
      'provider.demo@vibehue.com'
    ];
    
    for (const email of targetEmails) {
      const result = await db.collection('users').updateOne(
        { 'auth.emailNormalized': email.toLowerCase() },
        { $set: { 'auth.passwordHash': hash } }
      );
      if (result.matchedCount > 0) {
        console.log(`Successfully reset password for ${email} to "Test@123456"`);
      } else {
        // Try without normalized check
        const res2 = await db.collection('users').updateOne(
          { 'auth.email': email },
          { $set: { 'auth.passwordHash': hash } }
        );
        if (res2.matchedCount > 0) {
          console.log(`Successfully reset password for ${email} (via auth.email) to "Test@123456"`);
        } else {
          console.log(`User not found: ${email}`);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
