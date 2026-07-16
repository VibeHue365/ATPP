const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const permissions = [
  ['profile:read', 'Read Profile', 'USER', 'Read personal profile'],
  ['profile:update', 'Update Profile', 'USER', 'Update personal profile'],
  ['avatar:update', 'Update Avatar', 'USER', 'Update avatar'],
  ['auth:login', 'Login', 'AUTH', 'Login to system'],
  ['auth:logout', 'Logout', 'AUTH', 'Logout from system'],
  ['user:read', 'Read Users', 'USER', 'Read user accounts'],
  ['user:manage', 'Manage Users', 'USER', 'Manage users'],
  ['role:read', 'Read Roles', 'AUTH', 'Read roles'],
  ['role:manage', 'Manage Roles', 'AUTH', 'Manage roles'],
  ['permission:read', 'Read Permissions', 'AUTH', 'Read permissions'],
  ['permission:manage', 'Manage Permissions', 'AUTH', 'Manage permissions'],
  ['category:read', 'Read Categories', 'CATEGORY', 'Read service categories'],
  ['category:manage', 'Manage Categories', 'CATEGORY', 'Manage service categories'],
  ['system:read', 'Read System Policies', 'SYSTEM', 'Read system policies'],
  ['system:manage', 'Manage System Policies', 'SYSTEM', 'Manage system policies'],
  ['settlement:read', 'Read Settlements', 'SETTLEMENT', 'Read provider settlements'],
  ['settlement:manage', 'Manage Settlements', 'SETTLEMENT', 'Manage provider settlements'],
  ['provider:update_own', 'Update Own Provider', 'PROVIDER', 'Update own provider profile'],
  ['product:manage_own', 'Manage Own Products', 'PRODUCT', 'Manage own products'],
  ['refund:read', 'Read Refunds', 'REFUND', 'Read refund requests'],
  ['refund:manage', 'Manage Refunds', 'REFUND', 'Approve and process refunds'],
  ['dispute:read', 'Read Disputes', 'DISPUTE', 'Read dispute cases'],
  ['dispute:manage', 'Manage Disputes', 'DISPUTE', 'Resolve dispute cases'],
  ['moderation:read', 'Read Moderation Queue', 'MODERATION', 'Read content moderation queue'],
  ['moderation:manage', 'Manage Moderation', 'MODERATION', 'Approve, reject, or hide moderated content'],
  ['booking:create', 'Create Booking', 'BOOKING', 'Allow customer to create booking'],
  ['booking:view_provider', 'View Provider Bookings', 'BOOKING', 'View provider bookings'],
  ['booking:update_provider', 'Update Provider Bookings', 'BOOKING', 'Update provider bookings'],
  ['wallet:view_provider', 'View Provider Wallet', 'WALLET', 'View provider wallet'],
  ['review:reply', 'Reply Review', 'REVIEW', 'Reply to reviews'],
];

function readEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return process.env;

  const values = { ...process.env };
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      values[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
    }
  }
  return values;
}

async function syncAdminPermissions() {
  const env = readEnv();
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  const permissionCollection = db.collection('permissions');
  const roleCollection = db.collection('roles');
  const now = new Date();

  for (const [code, name, module, description] of permissions) {
    await permissionCollection.updateOne(
      { code },
      {
        $set: { code, name, module, description, status: 'ACTIVE', updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  const adminRole = await roleCollection.findOne({ code: 'ADMIN' });
  if (!adminRole) {
    throw new Error('ADMIN role was not found');
  }

  const currentPermissions = new Set(adminRole.permissions || []);
  const missingPermissions = permissions
    .map(([code]) => code)
    .filter((code) => !currentPermissions.has(code));

  if (missingPermissions.length > 0) {
    await roleCollection.updateOne(
      { _id: adminRole._id },
      {
        $addToSet: { permissions: { $each: missingPermissions } },
        $set: { updatedAt: now },
      },
    );
  }

  console.log(JSON.stringify({
    adminRoleUpdated: missingPermissions.length > 0,
    permissionsAdded: missingPermissions,
    permissionCount: permissions.length,
  }));
}

syncAdminPermissions()
  .catch((error) => {
    console.error(`Admin permission sync failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
