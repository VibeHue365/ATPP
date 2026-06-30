const { MongoClient } = require('mongodb');

async function main() {
  const uri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    // Tìm user provider.demo@vibehue.com
    const user = await db.collection('users').findOne({ 'auth.emailNormalized': 'provider.demo@vibehue.com' });
    if (!user) {
      console.error('User provider.demo@vibehue.com not found');
      return;
    }
    
    console.log(`Found user: ${user.profile?.fullName || user.email} with ID: ${user._id}`);
    
    // Cập nhật capabilities của provider này thành combo
    const result = await db.collection('providers').updateOne(
      { userId: user._id },
      { $set: { capabilities: ['AODAI_RENTAL', 'PHOTOGRAPHY'] } }
    );
    
    if (result.matchedCount > 0) {
      console.log('Successfully updated provider capabilities to ["AODAI_RENTAL", "PHOTOGRAPHY"] (Combo)');
    } else {
      console.log('Provider document not found for this userId. Let us check all providers:');
      const allProviders = await db.collection('providers').find({}).toArray();
      allProviders.forEach(p => {
        console.log(`- Provider ID: ${p._id}, UserID: ${p.userId}, Capabilities: ${JSON.stringify(p.capabilities)}`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
