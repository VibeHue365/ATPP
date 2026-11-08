import { clampPagination } from './pagination.util';

describe('clampPagination', () => {
  it('returns default values when input is empty or undefined', () => {
    const res = clampPagination();
    expect(res.page).toBe(1);
    expect(res.limit).toBe(20);
    expect(res.skip).toBe(0);
  });

  it('clamps excessive limit to maxLimit (default 100)', () => {
    const res = clampPagination({ page: 2, limit: 999999 });
    expect(res.page).toBe(2);
    expect(res.limit).toBe(100);
    expect(res.skip).toBe(100);
  });

  it('handles negative or invalid numbers safely', () => {
    const res = clampPagination({ page: -5, limit: -10 });
    expect(res.page).toBe(1);
    expect(res.limit).toBe(20);
    expect(res.skip).toBe(0);
  });

  it('calculates correct skip for valid inputs', () => {
    const res = clampPagination({ page: 3, limit: 15 });
    expect(res.page).toBe(3);
    expect(res.limit).toBe(15);
    expect(res.skip).toBe(30);
  });
});
