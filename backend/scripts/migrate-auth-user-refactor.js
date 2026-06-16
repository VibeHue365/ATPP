const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const apply = process.argv.includes('--apply');
const dropOld = process.argv.includes('--drop-old');

function readEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return process.env;
  }

  const values = { ...process.env };
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) {
      continue;
    }
    values[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return values;
}

async function collectionExists(db, name) {
  return Boolean(await db.listCollections({ name }).next());
}

async function readAll(db, name) {
  if (!(await collectionExists(db, name))) {
    return [];
  }
  return db.collection(name).find({}).toArray();
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : null;
}

function normalizePhone(phone) {
  return typeof phone === 'string' ? phone.replace(/\s/g, '') : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function migrateUsers(db) {
  const users = await readAll(db, 'users');
  const profiles = await readAll(db, 'user_profiles');
  const userRoles = await readAll(db, 'user_roles');
  const roles = await readAll(db, 'roles');
  const authProviders = await readAll(db, 'auth_providers');

  const profileByUserId = new Map(
    profiles.map((profile) => [String(profile.userId), profile]),
  );
  const roleCodeById = new Map(
    roles.map((role) => [String(role._id), role.code]),
  );
  const roleCodesByUserId = new Map();
  const providersByUserId = new Map();

  for (const map of userRoles) {
    const userId = String(map.userId);
    const roleCode = roleCodeById.get(String(map.roleId));
    roleCodesByUserId.set(userId, [
      ...(roleCodesByUserId.get(userId) || []),
      roleCode,
    ]);
  }

  for (const provider of authProviders) {
    const userId = String(provider.userId);
    providersByUserId.set(userId, [
      ...(providersByUserId.get(userId) || []),
      {
        provider: provider.provider,
        providerUserId: provider.providerUserId || null,
      },
    ]);
  }

  let migrated = 0;
  for (const user of users) {
    if (user.auth && user.profile && user.accountStatus) {
      continue;
    }

    const userId = String(user._id);
    const profile = profileByUserId.get(userId);
    const roles = unique(roleCodesByUserId.get(userId) || ['CUSTOMER']);
    const authProviders = providersByUserId.get(userId) || [];
    if (user.passwordHash) {
      authProviders.unshift({ provider: 'LOCAL', providerUserId: null });
    }

    const update = {
      $set: {
        auth: {
          email: user.email,
          emailNormalized: user.emailNormalized || normalizeEmail(user.email),
          phone: profile?.phone || null,
          phoneNormalized: normalizePhone(profile?.phone),
          passwordHash: user.passwordHash || null,
          emailVerified: Boolean(user.emailVerified),
          phoneVerified: false,
          authProviders: unique(
            authProviders.map((provider) => JSON.stringify(provider)),
          ).map((provider) => JSON.parse(provider)),
        },
        roles,
        defaultRole: roles[0] || 'CUSTOMER',
        accountStatus: user.status || 'PENDING_EMAIL_VERIFICATION',
        profile: {
          fullName: profile?.fullName || user.email || 'Unknown User',
          avatarUrl: profile?.avatarUrl || null,
          gender: profile?.gender || null,
          dateOfBirth: profile?.dateOfBirth || null,
        },
        preferences: user.preferences || {},
        addresses: user.addresses || [],
        favorites: user.favorites || [],
        loyalty: user.loyalty || {},
        provider: user.provider || {},
        security: {
          lastLoginAt: user.lastLoginAt || null,
          passwordChangedAt: user.passwordUpdatedAt || null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        deletedAt: user.deletedAt || null,
      },
      $unset: {
        email: '',
        emailNormalized: '',
        passwordHash: '',
        emailVerified: '',
        status: '',
        lastLoginAt: '',
        passwordUpdatedAt: '',
      },
    };

    migrated += 1;
    if (apply) {
      await db.collection('users').updateOne({ _id: user._id }, update);
    }
  }

  console.log(`users: ${migrated} document(s) need migration`);
}

async function migrateRoles(db) {
  const roles = await readAll(db, 'roles');
  const rolePermissions = await readAll(db, 'role_permissions');
  const permissions = await readAll(db, 'permissions');
  const permissionCodeById = new Map(
    permissions.map((permission) => [String(permission._id), permission.code]),
  );
  const permissionsByRoleId = new Map();

  for (const map of rolePermissions) {
    const roleId = String(map.roleId);
    permissionsByRoleId.set(roleId, [
      ...(permissionsByRoleId.get(roleId) || []),
      permissionCodeById.get(String(map.permissionId)),
    ]);
  }

  let migrated = 0;
  for (const role of roles) {
    if (Array.isArray(role.permissions) && role.permissions.length > 0) {
      continue;
    }

    const permissions = unique(permissionsByRoleId.get(String(role._id)) || []);
    migrated += 1;
    if (apply) {
      await db.collection('roles').updateOne(
        { _id: role._id },
        {
          $set: {
            permissions,
            status: role.status || 'ACTIVE',
          },
          $unset: { isSystem: '', permissionIds: '' },
        },
      );
    }
  }

  console.log(`roles: ${migrated} document(s) need migration`);
}

async function migratePermissions(db) {
  const permissions = await readAll(db, 'permissions');
  let migrated = 0;

  for (const permission of permissions) {
    if (permission.name && permission.status) {
      continue;
    }

    migrated += 1;
    if (apply) {
      await db.collection('permissions').updateOne(
        { _id: permission._id },
        {
          $set: {
            name: permission.name || permission.code,
            status: permission.status || 'ACTIVE',
          },
          $unset: { action: '' },
        },
      );
    }
  }

  console.log(`permissions: ${migrated} document(s) need migration`);
}

async function migrateRefreshTokens(db) {
  const tokens = await readAll(db, 'refresh_tokens');
  let migrated = 0;

  for (const token of tokens) {
    if (token.tokenHash) {
      continue;
    }

    migrated += 1;
    if (apply) {
      await db.collection('refresh_tokens').updateOne(
        { _id: token._id },
        {
          $set: { tokenHash: token.refreshTokenHash },
          $unset: { refreshTokenHash: '' },
        },
      );
    }
  }

  console.log(`refresh_tokens: ${migrated} document(s) need migration`);
}

async function migrateVerificationTokens(db) {
  const otpTokens = await readAll(db, 'otp_tokens');
  const passwordResetTokens = await readAll(db, 'password_reset_tokens');
  const operations = [];

  for (const token of otpTokens) {
    operations.push({
      replaceOne: {
        filter: { _id: token._id },
        replacement: {
          _id: token._id,
          userId: token.userId,
          target: token.email,
          targetType: 'EMAIL',
          purpose: 'VERIFY_EMAIL',
          codeHash: token.otpHash,
          expiresAt: token.expiresAt,
          verifiedAt: token.usedAt || null,
          attemptCount: token.attemptCount || 0,
          maxAttempts: token.maxAttempts || 5,
          createdAt: token.createdAt,
          updatedAt: token.updatedAt,
        },
        upsert: true,
      },
    });
  }

  for (const token of passwordResetTokens) {
    operations.push({
      replaceOne: {
        filter: { _id: token._id },
        replacement: {
          _id: token._id,
          userId: token.userId,
          target: token.email,
          targetType: 'EMAIL',
          purpose: 'PASSWORD_RESET',
          codeHash: token.tokenHash,
          expiresAt: token.expiresAt,
          verifiedAt: token.usedAt || null,
          attemptCount: 0,
          maxAttempts: 5,
          createdAt: token.createdAt,
          updatedAt: token.updatedAt,
        },
        upsert: true,
      },
    });
  }

  console.log(
    `verification_tokens: ${operations.length} document(s) to upsert`,
  );
  if (apply && operations.length > 0) {
    await db.collection('verification_tokens').bulkWrite(operations, {
      ordered: false,
    });
  }
}

async function migrateLoginHistories(db) {
  const histories = await readAll(db, 'login_histories');
  let migrated = 0;

  for (const history of histories) {
    if (history.emailOrPhone && history.loggedInAt) {
      continue;
    }

    migrated += 1;
    if (apply) {
      await db.collection('login_histories').updateOne(
        { _id: history._id },
        {
          $set: {
            emailOrPhone: history.emailOrPhone || history.email,
            loggedInAt: history.loggedInAt || history.createdAt || new Date(),
          },
          $unset: { email: '' },
        },
      );
    }
  }

  console.log(`login_histories: ${migrated} document(s) need migration`);
}

async function dropOldCollections(db) {
  if (!apply || !dropOld) {
    return;
  }

  for (const name of [
    'user_profiles',
    'user_activity_logs',
    'auth_providers',
    'user_roles',
    'role_permissions',
    'otp_tokens',
    'password_reset_tokens',
  ]) {
    if (await collectionExists(db, name)) {
      await db.collection(name).drop();
      console.log(`dropped ${name}`);
    }
  }
}

async function migrate() {
  const env = readEnv();
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing');
  }

  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log(
    apply
      ? 'Applying auth/user refactor migration...'
      : 'Dry run only. Add --apply to migrate.',
  );

  await migrateUsers(db);
  await migrateRoles(db);
  await migratePermissions(db);
  await migrateRefreshTokens(db);
  await migrateVerificationTokens(db);
  await migrateLoginHistories(db);
  await dropOldCollections(db);

  const names = await db.listCollections().toArray();
  console.log('Current collections:');
  console.log(
    names
      .map((collection) => collection.name)
      .sort()
      .join('\n'),
  );

  await mongoose.disconnect();
}

migrate().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
