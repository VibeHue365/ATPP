const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function readEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return process.env;
  }

  const values = { ...process.env };
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      values[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
    }
  }
  return values;
}

async function migrate() {
  const env = readEnv();
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  const categories = db.collection('categories');
  const packages = db.collection('photography_packages');
  const permissions = db.collection('permissions');
  const roles = db.collection('roles');
  const now = new Date();

  const categoryPermissions = [
    {
      code: 'category:read',
      name: 'Read Categories',
      module: 'CATEGORY',
      description: 'Read service categories',
    },
    {
      code: 'category:manage',
      name: 'Manage Categories',
      module: 'CATEGORY',
      description: 'Manage service categories',
    },
  ];

  for (const permission of categoryPermissions) {
    await permissions.updateOne(
      { code: permission.code },
      {
        $set: { ...permission, status: 'ACTIVE', updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  await roles.updateOne(
    { code: 'ADMIN' },
    {
      $addToSet: {
        permissions: {
          $each: categoryPermissions.map((permission) => permission.code),
        },
      },
      $set: { updatedAt: now },
    },
  );

  const legacyAodaiCategory = await categories.findOne({
    slug: 'thue-ao-dai',
    deletedAt: { $exists: false },
  });
  let aodaiCategoryUpdated = false;
  if (legacyAodaiCategory && legacyAodaiCategory.type !== 'AODAI_CATEGORY') {
    await categories.updateOne(
      { _id: legacyAodaiCategory._id },
      {
        $set: {
          type: 'AODAI_CATEGORY',
          status: 'ACTIVE',
          displayOrder: legacyAodaiCategory.displayOrder ?? 0,
          metadata: legacyAodaiCategory.metadata ?? {},
          updatedAt: now,
        },
      },
    );
    aodaiCategoryUpdated = true;
  }

  let photographyCategory = await categories.findOne({
    type: 'PHOTOGRAPHY_CATEGORY',
    status: 'ACTIVE',
    deletedAt: { $exists: false },
  });

  if (!photographyCategory) {
    const legacyCategory = await categories.findOne({
      slug: 'goi-chup-anh',
      deletedAt: { $exists: false },
    });

    if (legacyCategory) {
      await categories.updateOne(
        { _id: legacyCategory._id },
        {
          $set: {
            type: 'PHOTOGRAPHY_CATEGORY',
            status: 'ACTIVE',
            displayOrder: legacyCategory.displayOrder ?? 0,
            metadata: legacyCategory.metadata ?? {},
            updatedAt: new Date(),
          },
        },
      );
      photographyCategory = await categories.findOne({
        _id: legacyCategory._id,
      });
    }
  }

  if (!photographyCategory) {
    const result = await categories.insertOne({
      name: 'Gói chụp ảnh',
      slug: 'goi-chup-anh',
      type: 'PHOTOGRAPHY_CATEGORY',
      description: 'Danh mục mặc định cho các gói chụp ảnh',
      parentId: null,
      status: 'ACTIVE',
      displayOrder: 0,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
    photographyCategory = await categories.findOne({
      _id: result.insertedId,
    });
  }

  const result = await packages.updateMany(
    {
      $or: [
        { categoryId: { $exists: false } },
        { categoryId: null },
      ],
    },
    {
      $set: {
        categoryId: photographyCategory._id,
        updatedAt: new Date(),
      },
    },
  );

  console.log(
    JSON.stringify({
      categoryId: photographyCategory._id.toString(),
      matchedPackages: result.matchedCount,
      modifiedPackages: result.modifiedCount,
      aodaiCategoryUpdated,
      adminPermissions: categoryPermissions.map(
        (permission) => permission.code,
      ),
    }),
  );
}

migrate()
  .catch((error) => {
    console.error(`VIB-15 category migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
