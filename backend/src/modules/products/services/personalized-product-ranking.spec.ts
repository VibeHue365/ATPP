import {
  matchesPreferredSize,
  normalizePreferences,
  scoreProduct,
} from './personalized-product-ranking';

describe('personalized product ranking', () => {
  const preferences = normalizePreferences({
    preferredAoDaiStyles: ['TRADITIONAL'],
    preferredOccasions: ['WEDDING'],
    favoriteColors: ['RED_GOLD'],
    preferredMaterials: ['SILK'],
    sizeInfo: { preferredSize: 'M' },
    budgetRange: { min: 300_000, max: 900_000 },
  });

  it('maps onboarding values and expands color tones', () => {
    expect(preferences).toEqual(
      expect.objectContaining({
        styles: ['TRADITIONAL'],
        occasions: ['WEDDING'],
        colors: ['RED', 'GOLD'],
        materials: ['SILK'],
        preferredSize: 'M',
      }),
    );
  });

  it('ranks matching active tag and structured attributes highly', () => {
    const result = scoreProduct(preferences, {
      tagCodes: ['TRUYEN_THONG', 'PHU_HOP_LE_CUOI'],
      colors: ['RED'],
      materials: ['SILK'],
      sizes: ['M', 'L'],
      basePrice: 600_000,
      rating: { averageRating: 5 },
    });

    expect(result.matchPercent).toBe(100);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Truyền thống'),
        expect.stringContaining('Lễ cưới'),
        expect.stringContaining('SILK'),
      ]),
    );
  });

  it('does not treat material or color as Smart Tags', () => {
    const result = scoreProduct(preferences, {
      tagCodes: ['SILK', 'RED'],
      colors: [],
      materials: [],
      sizes: ['M'],
      basePrice: 600_000,
      rating: { averageRating: 0 },
    });

    expect(result.reasons).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('chất liệu'),
        expect.stringContaining('màu sắc'),
      ]),
    );
  });

  it('filters products that do not support the preferred size', () => {
    expect(matchesPreferredSize('M', ['S', 'L'])).toBe(false);
    expect(matchesPreferredSize('M', ['m', 'L'])).toBe(true);
    expect(matchesPreferredSize(null, [])).toBe(true);
  });

  it('normalizes weights when optional preferences are absent', () => {
    const result = scoreProduct(normalizePreferences({}), {
      tagCodes: [],
      colors: [],
      materials: [],
      sizes: [],
      basePrice: 1_000_000,
      rating: { averageRating: 4 },
    });

    expect(result.matchPercent).toBe(80);
  });
});
