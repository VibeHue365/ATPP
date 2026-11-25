import { buildRentalPriceSuggestion } from './rental-price-suggestion';

describe('buildRentalPriceSuggestion', () => {
  it('does not recommend a reduction until the product has more than 10 rentals', () => {
    expect(buildRentalPriceSuggestion(500_000, 10, 'GOOD')).toMatchObject({ eligible: false, suggestedPrice: null });
  });

  it('recommends a condition-based price while leaving the decision to the provider', () => {
    expect(buildRentalPriceSuggestion(500_000, 12, 'MINOR_DAMAGE')).toEqual({
      rentalCount: 12,
      condition: 'MINOR_DAMAGE',
      eligible: true,
      discountPercent: 20,
      suggestedPrice: 400_000,
      reason: 'Sản phẩm đã được thuê 12 lần; tình trạng hiện tại: MINOR_DAMAGE.',
    });
  });
});
