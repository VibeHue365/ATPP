import { describe, expect, it } from 'vitest';
import { heroBudgetRange } from '../src/features/combos/mappers/heroBudget';

const MIN = 500000;
const MAX = 5000000;

describe('Combo hero budget filter (VIB-48)', () => {
  it('"under 2m" resets the minimum and highlights no sidebar preset', () => {
    expect(heroBudgetRange('under_2m', MIN, MAX)).toEqual({ minPrice: MIN, maxPrice: 2000000, presetPrice: null });
  });

  it('switching from 2-3m to under 2m no longer keeps the 2m minimum', () => {
    const afterStandard = heroBudgetRange('2m_3m', MIN, MAX);
    const afterSaving = { ...afterStandard, ...heroBudgetRange('under_2m', MIN, MAX) };
    expect(afterSaving.minPrice).toBeLessThan(afterSaving.maxPrice);
    expect(afterSaving.minPrice).toBe(MIN);
  });

  it('maps the other budgets to their sidebar presets', () => {
    expect(heroBudgetRange('2m_3m', MIN, MAX)).toEqual({ minPrice: 2000000, maxPrice: 3000000, presetPrice: '2m_3m' });
    expect(heroBudgetRange('above_3m', MIN, MAX)).toEqual({ minPrice: 3000000, maxPrice: MAX, presetPrice: 'above_3m' });
  });

  it('"all" clears the budget filter', () => {
    expect(heroBudgetRange('all', MIN, MAX)).toEqual({ minPrice: MIN, maxPrice: MAX, presetPrice: null });
  });
});
