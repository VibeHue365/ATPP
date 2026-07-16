/*
 * Usage:
 *   npm run migrate:legacy-uploads                 # report only (safe default)
 *   npm run migrate:legacy-uploads -- --apply      # upload and rewrite MongoDB references
 *
 * Existing files are never deleted. After the report is clean and clients have
 * been verified, set SERVE_LEGACY_UPLOADS=false and archive the local uploads folder.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Client } = require('minio');

const apply = process.argv.includes('--apply');
const root = path.resolve(__dirname, '..');
const uploadsRoot = path.join(root, 'uploads');
const demoAssetsRoot = path.resolve(root, '..', 'frontend', 'public');
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibehue_auth';
const publicBucket = process.env.MINIO_PUBLIC_BUCKET || 'public-media';
const privateBucket = 'dispute-evidence-private';
const endpoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
const port = Number(process.env.MINIO_PORT || 9000);
const useSSL = ['1', 'true', 'yes', 'on'].includes(String(process.env.MINIO_USE_SSL || '').toLowerCase());
const publicBaseUrl = (process.env.MINIO_PUBLIC_BASE_URL || `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`).replace(/\/$/, '');

const minio = new Client({
  endPoint: endpoint,
  port,
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
});

const stats = { scanned: 0, migrated: 0, migratedFromDemoAssets: 0, missing: 0, missingFiles: [], unchanged: 0, errors: [] };

function legacyRelative(value) {
  if (typeof value !== 'string') return null;
  let pathname = value;
  try { if (/^https?:\/\//i.test(value)) pathname = new URL(value).pathname; } catch {}
  const marker = '/uploads/';
  const index = pathname.indexOf(marker);
  if (index < 0) return null;
  const relative = decodeURIComponent(pathname.slice(index + marker.length)).replace(/\\/g, '/');
  if (!relative || relative.includes('..')) return null;
  return relative;
}

function contentType(relative) {
  const extension = path.extname(relative).toLowerCase();
  return extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
}

async function ensureBucket(bucket, publicRead) {
  if (!(await minio.bucketExists(bucket))) await minio.makeBucket(bucket);
  if (publicRead) {
    await minio.setBucketPolicy(bucket, JSON.stringify({
      Version: '2012-10-17',
      Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${bucket}/*`] }],
    }));
  }
}

async function migrateValue(value, visibility) {
  const relative = legacyRelative(value);
  if (!relative) return value;
  const uploadedSource = path.resolve(uploadsRoot, relative);
  const demoSource = path.resolve(demoAssetsRoot, path.basename(relative));
  const source = uploadedSource.startsWith(uploadsRoot + path.sep) && fs.existsSync(uploadedSource)
    ? uploadedSource
    : demoSource.startsWith(demoAssetsRoot + path.sep) && fs.existsSync(demoSource)
      ? demoSource
      : null;
  if (!source) {
    stats.missing += 1;
    if (stats.missingFiles.length < 100) stats.missingFiles.push(relative);
    return value;
  }
  if (source === demoSource) stats.migratedFromDemoAssets += 1;
  const bucket = visibility === 'private' ? privateBucket : publicBucket;
  const prefix = visibility === 'private' ? 'dispute-evidence/legacy' : 'legacy';
  const key = `${prefix}/${relative}`;
  const migratedValue = visibility === 'private'
    ? `private://${bucket}/${key}`
    : `${publicBaseUrl}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  if (!apply) { stats.migrated += 1; return migratedValue; }
  await minio.putObject(bucket, key, fs.createReadStream(source), fs.statSync(source).size, { 'Content-Type': contentType(relative) });
  stats.migrated += 1;
  return migratedValue;
}

function getPath(object, dotted) { return dotted.split('.').reduce((value, key) => value && value[key], object); }
function setPath(object, dotted, value) {
  const keys = dotted.split('.'); let target = object;
  for (const key of keys.slice(0, -1)) target = target[key] ||= {};
  target[keys.at(-1)] = value;
}

async function migrateField(collection, field, visibility, array = false) {
  const cursor = mongoose.connection.db.collection(collection).find({ [field]: { $exists: true, $ne: null } });
  for await (const document of cursor) {
    stats.scanned += 1;
    const current = getPath(document, field);
    const next = array
      ? await Promise.all((Array.isArray(current) ? current : []).map((value) => migrateValue(value, visibility)))
      : await migrateValue(current, visibility);
    if (JSON.stringify(next) === JSON.stringify(current)) { stats.unchanged += 1; continue; }
    if (apply) await mongoose.connection.db.collection(collection).updateOne({ _id: document._id }, { $set: { [field]: next } });
  }
}

async function main() {
  await mongoose.connect(mongoUri);
  await ensureBucket(publicBucket, true);
  await ensureBucket(privateBucket, false);
  const publicFields = [
    ['users', 'profile.avatarUrl', false], ['products', 'images', true], ['reviews', 'images', true],
    ['booking_items', 'referenceImage', false], ['providers', 'media.logoUrl', false],
    ['providers', 'media.coverUrl', false], ['providers', 'media.images', true], ['portfolio_items', 'images', true],
  ];
  for (const [collection, field, array] of publicFields) await migrateField(collection, field, 'public', array);
  await migrateField('incident_reports', 'evidencePhotos', 'private', true);
  await migrateField('disputes', 'evidencePhotos', 'private', true);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...stats }, null, 2));
  if (!apply) console.log('No file or database record was changed. Re-run with -- --apply after reviewing this report.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());