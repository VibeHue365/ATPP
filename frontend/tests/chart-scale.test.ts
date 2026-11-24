import { describe, expect, it } from 'vitest';
import {
  computeNiceScale,
  formatCompactVnd,
  formatExactVnd,
} from '../src/features/admin-dashboard/utils/chartScale';

describe('Admin chart dynamic scale (chartScale)', () => {
  it('scales small booking counts without forcing a 600 ceiling', () => {
    const scale = computeNiceScale(5, 4, { integerOnly: true, minMax: 4 });
    expect(scale.max).toBe(8);
    expect(scale.ticks).toEqual([8, 6, 4, 2, 0]);
    expect(new Set(scale.ticks).size).toBe(5);
  });

  it('scales zero values safely for both integer and VND charts', () => {
    const intScale = computeNiceScale(0, 4, { integerOnly: true, minMax: 4 });
    expect(intScale.ticks).toEqual([4, 3, 2, 1, 0]);

    const vndScale = computeNiceScale(0, 4, { minMax: 400_000 });
    expect(vndScale.ticks).toEqual([400_000, 300_000, 200_000, 100_000, 0]);
  });

  it('scales low VND revenue (e.g., 350k) smoothly without forcing 4M ceiling', () => {
    const scale = computeNiceScale(350_000, 4);
    expect(scale.max).toBe(400_000);
    expect(scale.ticks).toEqual([400_000, 300_000, 200_000, 100_000, 0]);
  });

  it('scales large VND volumes (e.g., 180M and 1.2B)', () => {
    const medium = computeNiceScale(180_000_000, 4);
    expect(medium.max).toBe(200_000_000);
    expect(medium.ticks[0]).toBeGreaterThanOrEqual(180_000_000);

    const large = computeNiceScale(1_200_000_000, 4);
    expect(large.max).toBe(2_000_000_000);
    expect(large.ticks[0]).toBeGreaterThanOrEqual(1_200_000_000);
  });

  it('formats compact and exact VND cleanly without decimal-dot corruption', () => {
    expect(formatCompactVnd(0)).toBe('0đ');
    expect(formatCompactVnd(250_000)).toBe('250k');
    expect(formatCompactVnd(1_500_000)).toBe('1.5tr');
    expect(formatCompactVnd(1_200_000_000)).toBe('1.2 tỷ');

    expect(formatExactVnd(1_250_000).replace(/\s/g, '')).toBe('1.250.000đ');
    expect(formatExactVnd(0).replace(/\s/g, '')).toBe('0đ');
  });
});
