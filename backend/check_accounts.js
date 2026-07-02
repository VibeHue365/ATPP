const mongoose = require('./node_modules/mongoose');
const uri = 'mongodb+srv://tiendat5604:Dattien5604@cluster0.9tc4itm.mongodb.net/vibehue_db?appName=Cluster0';

mongoose.connect(uri).then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Provider = mongoose.model('Provider', new mongoose.Schema({}, { strict: false }));

  // Find a customer with password
  const customer = await User.findOne({
    roles: 'CUSTOMER',
    roles: { $nin: ['ADMIN', 'PROVIDER'] },
    'auth.passwordHash': { $exists: true, $ne: null },
    accountStatus: 'ACTIVE'
  }).lean();

  // Find a provider (look for users with PROVIDER role or find provider docs)
  const providerUser = await User.findOne({
    roles: 'PROVIDER',
    'auth.passwordHash': { $exists: true, $ne: null },
    accountStatus: 'ACTIVE'
  }).lean();

  // Also check Provider collection for context
  const providers = await Provider.find({}).limit(3).select('businessName userId status').lean();

  console.log('=== CUSTOMER ===');
  if (customer) {
    console.log('Email:', customer.auth?.email);
    console.log('Name:', customer.profile?.fullName);
    console.log('Status:', customer.accountStatus);
    console.log('Roles:', customer.roles);
    console.log('Has password:', !!customer.auth?.passwordHash);
  } else {
    console.log('No customer with password found');
  }

  console.log('\n=== CUSTOMERS (all, show email) ===');
  const allCustomers = await User.find({
    roles: 'CUSTOMER',
    'auth.passwordHash': { $exists: true, $ne: null }
  }).limit(5).lean();
  allCustomers.forEach(c => {
    console.log('-', c.auth?.email, '| status:', c.accountStatus, '| roles:', c.roles);
  });

  console.log('\n=== PROVIDER USER ===');
  if (providerUser) {
    console.log('Email:', providerUser.auth?.email);
    console.log('Name:', providerUser.profile?.fullName);
    console.log('Status:', providerUser.accountStatus);
    console.log('Roles:', providerUser.roles);
  } else {
    console.log('No provider user with password found');
  }

  console.log('\n=== PROVIDERS (collection) ===');
  providers.forEach(p => console.log('-', p.businessName, '| status:', p.status, '| userId:', p.userId));

  mongoose.disconnect();
}).catch(e => console.error('DB Error:', e.message));
