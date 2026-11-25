import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

const MIN_BASE_PRICE = 50_000;
const MAX_BASE_PRICE = 10_000_000;
const MIN_DEPOSIT = 20_000;
const MAX_DEPOSIT = 5_000_000;
const MIN_HOURLY = 10_000;
const MAX_HOURLY = 2_500_000;
const MIN_REPLACEMENT = 100_000;
const MAX_REPLACEMENT = 50_000_000;

function readMongoUri(): string {
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) {
    return process.env.MONGODB_URI.trim();
  }
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key === 'MONGODB_URI' && val) return val;
    }
  }
  throw new Error('Không tìm thấy MONGODB_URI trong process.env hoặc backend/.env');
}

function roundTo1000(value: number): number {
  return Math.round(value / 1000) * 1000;
}

interface ProposedProductFix {
  id: string;
  name: string;
  reasons: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = readMongoUri();

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Không thể lấy handle cơ sở dữ liệu MongoDB');
  }

  try {
    const products = await db.collection('products').find({}).toArray();
    const fixes: ProposedProductFix[] = [];

    for (const p of products) {
      const reasons: string[] = [];
      const rawBase = Number(p.basePrice ?? 0);
      const rawDeposit = Number(p.depositAmount ?? 0);
      const rawHourly = p.hourlyPrice != null ? Number(p.hourlyPrice) : null;
      const rawReplacement = p.replacementValue != null ? Number(p.replacementValue) : null;

      let nextBase = rawBase;
      if (!Number.isInteger(rawBase) || rawBase < MIN_BASE_PRICE || rawBase > MAX_BASE_PRICE || rawBase % 1000 !== 0) {
        if (rawBase < 10_000) {
          reasons.push(`basePrice test/quá thấp (${rawBase}đ -> 150.000đ)`);
          nextBase = 150_000;
        } else {
          const rounded = roundTo1000(rawBase);
          nextBase = Math.min(MAX_BASE_PRICE, Math.max(MIN_BASE_PRICE, rounded));
          reasons.push(`basePrice ngoài chuẩn (${rawBase}đ -> ${nextBase}đ)`);
        }
      }

      let nextDeposit = rawDeposit;
      const depositInvalid =
        !Number.isInteger(rawDeposit) ||
        rawDeposit < 0 ||
        rawDeposit > MAX_DEPOSIT ||
        rawDeposit % 1000 !== 0 ||
        (rawDeposit > 0 && rawDeposit < MIN_DEPOSIT) ||
        rawDeposit >= nextBase;

      if (depositInvalid) {
        if (rawDeposit === 0) {
          nextDeposit = 0;
        } else if (rawDeposit > 0 && rawDeposit < MIN_DEPOSIT) {
          nextDeposit = Math.min(MIN_DEPOSIT, nextBase - 1000);
          if (nextDeposit < MIN_DEPOSIT) nextDeposit = 0;
          reasons.push(`depositAmount dưới sàn 20k (${rawDeposit}đ -> ${nextDeposit}đ)`);
        } else if (rawDeposit >= nextBase || rawDeposit > MAX_DEPOSIT) {
          const suggested = Math.min(
            MAX_DEPOSIT,
            Math.max(MIN_DEPOSIT, roundTo1000(nextBase * 0.4)),
            nextBase - 1000,
          );
          nextDeposit = suggested >= MIN_DEPOSIT ? roundTo1000(suggested) : 0;
          reasons.push(`depositAmount >= basePrice hoặc vượt trần (${rawDeposit}đ -> ${nextDeposit}đ)`);
        } else {
          const rounded = roundTo1000(rawDeposit);
          nextDeposit = Math.min(rounded, nextBase - 1000, MAX_DEPOSIT);
          if (nextDeposit > 0 && nextDeposit < MIN_DEPOSIT) nextDeposit = MIN_DEPOSIT;
          reasons.push(`depositAmount không chẵn 1.000đ (${rawDeposit}đ -> ${nextDeposit}đ)`);
        }
      }

      let nextHourly = rawHourly;
      if (rawHourly !== null) {
        const maxHourly = Math.min(MAX_HOURLY, Math.floor((nextBase * 0.25) / 1000) * 1000);
        if (
          !Number.isInteger(rawHourly) ||
          rawHourly < MIN_HOURLY ||
          rawHourly > maxHourly ||
          rawHourly % 1000 !== 0
        ) {
          const clamped = Math.min(maxHourly, Math.max(MIN_HOURLY, roundTo1000(rawHourly)));
          nextHourly = clamped;
          reasons.push(`hourlyPrice ngoài chuẩn (${rawHourly}đ -> ${nextHourly}đ)`);
        }
      }

      let nextReplacement = rawReplacement;
      if (rawReplacement !== null) {
        const minAllowedRep = Math.max(MIN_REPLACEMENT, nextBase, nextDeposit);
        if (
          !Number.isInteger(rawReplacement) ||
          rawReplacement < minAllowedRep ||
          rawReplacement > MAX_REPLACEMENT
        ) {
          nextReplacement = Math.min(
            MAX_REPLACEMENT,
            Math.max(minAllowedRep, roundTo1000(nextBase * 3)),
          );
          reasons.push(`replacementValue ngoài chuẩn (${rawReplacement}đ -> ${nextReplacement}đ)`);
        }
      }

      if (reasons.length > 0) {
        fixes.push({
          id: String(p._id),
          name: String(p.name || '(không tên)'),
          reasons,
          before: {
            basePrice: p.basePrice,
            depositAmount: p.depositAmount,
            ...(rawHourly !== null ? { hourlyPrice: p.hourlyPrice } : {}),
            ...(rawReplacement !== null ? { replacementValue: p.replacementValue } : {}),
          },
          after: {
            basePrice: nextBase,
            depositAmount: nextDeposit,
            ...(nextHourly !== null ? { hourlyPrice: nextHourly } : {}),
            ...(nextReplacement !== null ? { replacementValue: nextReplacement } : {}),
          },
        });
      }
    }

    const photoAnomalies = await db
      .collection('photography_packages')
      .find({ $or: [{ price: { $lt: 50_000 } }, { price: { $gt: 20_000_000 } }] })
      .project({ _id: 1, name: 1, price: 1 })
      .toArray();

    const comboAnomalies = await db
      .collection('combo_promotions')
      .find({ $or: [{ comboPrice: { $lt: 50_000 } }, { comboPrice: { $gt: 25_000_000 } }] })
      .project({ _id: 1, name: 1, comboPrice: 1 })
      .toArray();

    console.log(`\n=== CHUẨN HÓA GIÁ THỊ TRƯỜNG ÁO DÀI HUẾ (${apply ? 'APPLY MODE' : 'DRY RUN ONLY'}) ===`);
    console.log(`Tổng products đã quét: ${products.length}`);
    console.log(`Products cần chuẩn hóa: ${fixes.length}`);
    for (const f of fixes) {
      console.log(`- [${f.id}] "${f.name}"`);
      console.log(`  Lý do: ${f.reasons.join('; ')}`);
      console.log(`  Trước: ${JSON.stringify(f.before)} -> Sau đề xuất: ${JSON.stringify(f.after)}`);
    }

    console.log(`\nPhotography packages ngoài chuẩn (<50k hoặc >20M): ${photoAnomalies.length}`);
    for (const pkg of photoAnomalies) {
      console.log(`  - [${String(pkg._id)}] "${pkg.name}": ${pkg.price}đ`);
    }
    console.log(`Combo promotions ngoài chuẩn (<50k hoặc >25M): ${comboAnomalies.length}`);
    for (const c of comboAnomalies) {
      console.log(`  - [${String(c._id)}] "${c.name}": ${c.comboPrice}đ`);
    }

    if (!apply) {
      console.log('\nDRY RUN ONLY - NO DATABASE WRITES PERFORMED.');
    } else if (fixes.length > 0) {
      for (const f of fixes) {
        await db.collection('products').updateOne(
          { _id: new mongoose.Types.ObjectId(f.id) },
          { $set: f.after },
        );
      }
      console.log(`\nĐã cập nhật ${fixes.length} bản ghi products (KHÔNG chạm bookings/payments).`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Lỗi chạy normalize-market-pricing:', err);
  process.exit(1);
});
