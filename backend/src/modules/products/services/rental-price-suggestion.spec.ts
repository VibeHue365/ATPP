import { buildRentalPriceSuggestion } from './rental-price-suggestion';

describe('buildRentalPriceSuggestion', () => {
  it('only reminds at the 5, 10 and 50 rental milestones', () => {
    expect(buildRentalPriceSuggestion(500_000, 4, 'GOOD').eligible).toBe(false);
    expect(buildRentalPriceSuggestion(500_000, 5, 'GOOD').reminderNumber).toBe(1);
    expect(buildRentalPriceSuggestion(500_000, 10, 'GOOD').reminderNumber).toBe(2);
    expect(buildRentalPriceSuggestion(500_000, 50, 'GOOD').reminderNumber).toBe(3);
    expect(buildRentalPriceSuggestion(500_000, 51, 'GOOD')).toMatchObject({ eligible: false, reminderNumber: null });
  });

  it('recommends a condition-based price while leaving the decision to the provider', () => {
    expect(buildRentalPriceSuggestion(500_000, 50, 'MINOR_DAMAGE')).toEqual({
      rentalCount: 50,
      condition: 'MINOR_DAMAGE',
      eligible: true,
      discountPercent: 20,
      suggestedPrice: 400_000,
      reason: 'Sản phẩm đạt trung bình 50 lượt thuê/áo; tình trạng hiện tại: MINOR_DAMAGE.',
      reminderNumber: 3,
    });
  });
});
