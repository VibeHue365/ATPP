import { createHash } from 'node:crypto';
import { Types } from 'mongoose';

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

function normalize(value: unknown): CanonicalValue {
  if (value === null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('Invalid contract date');
    return value.toISOString();
  }
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite contract number');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    const result: { [key: string]: CanonicalValue } = {};
    for (const [key, part] of entries) {
      if (part === undefined)
        throw new Error(`Undefined contract field: ${key}`);
      result[key] = normalize(part);
    }
    return result;
  }
  throw new Error('Unsupported contract value');
}

export function canonicalizeContract(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function hashContract(value: unknown): string {
  return createHash('sha256')
    .update(canonicalizeContract(value), 'utf8')
    .digest('hex');
}
