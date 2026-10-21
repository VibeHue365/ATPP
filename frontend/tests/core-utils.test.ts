import { beforeEach, describe, expect, it } from 'vitest';
import type { CartItem } from '../src/context/CartContext';
import { findCombos, isSameCity, normalizeCity } from '../src/utils/comboHelper';
import { formatDateRange, formatSingleDate, getDayMonth } from '../src/utils/dateHelper';
import { translateError } from '../src/utils/errorTranslator';
import { calculateRecommendedSize } from '../src/utils/sizeHelper';
import { tokenStorage } from '../src/services/tokenStorage';

describe('Ao Dai size recommendation', () => {
  it.each([
    [160, 47, 'S'],
    [160, 48, 'M'],
    [160, 53, 'M'],
    [160, 54, 'L'],
    [160, 58, 'L'],
    [160, 59, 'XL'],
    [160, 66, 'XL'],
    [160, 67, 'XXL'],
  ])('maps %scm/%skg to %s', (height, weight, expected) => {
    expect(calculateRecommendedSize(height, weight)).toBe(expected);
  });

  it('accepts height in metres and numeric strings', () => {
    expect(calculateRecommendedSize('1.62', '52')).toBe('M');
  });

  it.each([[0, 50], [129, 50], ['invalid', 50], [160, '']])(
    'rejects invalid measurements (%s, %s)',
    (height, weight) => expect(calculateRecommendedSize(height, weight)).toBeNull(),
  );
});

describe('API error translation', () => {
  it.each([
    ['Invalid email or password', 'Email hoặc mật khẩu không chính xác.'],
    ['OTP is expired', 'Mã OTP đã hết hạn.'],
    ['Too many requests', 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'],
    ['Photography package not found', 'Không tìm thấy gói chụp ảnh.'],
    ['Internal server error', 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.'],
  ])('translates "%s"', (message, expected) => {
    expect(translateError(message)).toBe(expected);
  });

  it('preserves unknown messages and handles missing input', () => {
    expect(translateError('Custom provider error')).toBe('Custom provider error');
    expect(translateError()).toBe('');
  });
});

describe('date display helpers', () => {
  it('formats ISO date ranges and single dates', () => {
    expect(formatDateRange('2026-09-21', '2026-09-23')).toBe('21/09 - 23/09/2026');
    expect(formatSingleDate('2026-09-21')).toBe('21/09/2026');
    expect(getDayMonth('2026-09-21')).toBe('21/09');
  });

  it('supports slash dates and empty values', () => {
    expect(formatDateRange('21/09/2026')).toBe('09/21');
    expect(formatSingleDate('21/09/2026')).toBe('21/09/2026');
    expect(getDayMonth(null)).toBe('');
  });
});

describe('combo matching', () => {
  const product = (overrides: Partial<CartItem> = {}) => ({
    id: 'product-1',
    itemType: 'PRODUCT',
    rentalFrom: '2026-09-20',
    rentalTo: '2026-09-22',
    providerCity: 'Thành phố Huế',
    ...overrides,
  }) as CartItem;

  const photography = (overrides: Partial<CartItem> = {}) => ({
    id: 'photo-1',
    itemType: 'PHOTOGRAPHY_PACKAGE',
    shootDate: '2026-09-21',
    photographerCity: 'Hue',
    ...overrides,
  }) as CartItem;

  it('normalizes Vietnamese city prefixes and diacritics', () => {
    expect(normalizeCity('Thành phố Huế')).toBe('hue');
    expect(isSameCity('TP. Huế', 'Hue')).toBe(true);
    expect(isSameCity('Đà Nẵng', 'Hội An')).toBe(false);
  });

  it('groups matching product and photography schedules', () => {
    const result = findCombos([product(), photography()], 1);
    expect(result.listGroups).toHaveLength(1);
    expect(result.listGroups[0]).toMatchObject({ type: 'SUCCESS', syncDate: '2026-09-20' });
    expect(result.remaining).toEqual([]);
    expect(result.nextIndex).toBe(2);
  });

  it('flags location mismatches instead of producing a successful combo', () => {
    const result = findCombos([
      product({ providerCity: 'Huế' }),
      photography({ photographerCity: 'Đà Nẵng' }),
    ], 3);
    expect(result.listGroups[0]).toMatchObject({ type: 'MISMATCH', isCityMismatch: true });
    expect(result.listGroups[0].warning).toContain('Không thể đi chung Combo');
  });

  it('keeps unmatched items as standalone entries', () => {
    const result = findCombos([product()], 1);
    expect(result.listGroups).toEqual([]);
    expect(result.remaining).toHaveLength(1);
  });

  it('requires an hourly photo slot to fit inside the rental window', () => {
    const result = findCombos([
      product({ rentalFrom: '2026-09-21', startTime: '09:00', endTime: '11:00' }),
      photography({ shootTimeSlot: '10:30 - 12:00' }),
    ], 1);
    expect(result.listGroups[0]).toMatchObject({ type: 'MISMATCH' });
    expect(result.listGroups[0].warning).toContain('Khung giờ thuê Áo dài');
  });
});

describe('token storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('stores remembered sessions persistently and clears stale session tokens', () => {
    window.sessionStorage.setItem('accessToken', 'stale');
    tokenStorage.saveTokens('access-persistent', 'refresh-persistent', true);
    expect(window.localStorage.getItem('accessToken')).toBe('access-persistent');
    expect(window.sessionStorage.getItem('accessToken')).toBeNull();
    expect(tokenStorage.hasPersistentSession()).toBe(true);
  });

  it('stores temporary sessions in sessionStorage', () => {
    tokenStorage.saveTokens('access-session', 'refresh-session', false);
    expect(tokenStorage.getAccessToken()).toBe('access-session');
    expect(tokenStorage.getRefreshToken()).toBe('refresh-session');
    expect(tokenStorage.hasPersistentSession()).toBe(false);
  });

  it('replaces tokens in the existing storage mode', () => {
    tokenStorage.saveTokens('old-access', 'old-refresh', true);
    tokenStorage.replaceTokens('new-access', 'new-refresh');
    expect(window.localStorage.getItem('accessToken')).toBe('new-access');
    expect(window.localStorage.getItem('refreshToken')).toBe('new-refresh');
  });

  it('clears both persistent and temporary tokens', () => {
    window.localStorage.setItem('accessToken', 'one');
    window.sessionStorage.setItem('refreshToken', 'two');
    tokenStorage.clearTokens();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });
});
