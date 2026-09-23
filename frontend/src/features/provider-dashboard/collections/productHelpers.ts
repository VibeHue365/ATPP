
import type { VariantRow } from '../types';

export const normalizeCategoryIds = (items?: Array<string | { _id?: string; id?: string }>) =>
  (items || [])
    .map(item => typeof item === 'string' ? item : item._id || item.id || '')
    .filter(Boolean);

export const emptyVariant = (): VariantRow => ({ size: 'M', color: 'RED', material: 'SILK', quantity: 1, condition: 'GOOD' });

export const normalizeVariants = (rows: VariantRow[]) => {
  const map = new Map<string, { size: string; color: string; material: string; quantity: number; conditionStatus: string }>();
  for (const v of rows) {
    const size = (v.size || '').trim().toUpperCase();
    const color = (v.color || '').trim().toUpperCase();
    const material = (v.material || '').trim();
    const quantity = Math.max(1, Number(v.quantity) || 1);
    if (!size || !color) continue;
    const key = `${size}|${color}|${material.toUpperCase()}`;
    const existing = map.get(key);
    if (existing) existing.quantity += quantity;
    else map.set(key, { size, color, material, quantity, conditionStatus: v.condition || 'GOOD' });
  }
  return Array.from(map.values());
};
