export type RentalCondition = 'NEW' | 'GOOD' | 'MINOR_DAMAGE' | 'LOCKED' | 'RETIRED';

export interface RentalPriceSuggestion {
  rentalCount: number;
  condition: RentalCondition | null;
  eligible: boolean;
  discountPercent: number;
  suggestedPrice: number | null;
  reason: string | null;
  reminderNumber: 1 | 2 | 3 | null;
}

const CONDITION_DISCOUNT: Record<RentalCondition, number> = {
  NEW: 5,
  GOOD: 10,
  MINOR_DAMAGE: 20,
  LOCKED: 25,
  RETIRED: 30,
};

/** Provider-facing recommendation only. It never changes a price automatically. */
export function buildRentalPriceSuggestion(
  basePrice: number,
  rentalCount: number,
  condition: RentalCondition | null,
): RentalPriceSuggestion {
  const reminderNumber = ({ 5: 1, 10: 2, 50: 3 } as const)[rentalCount as 5 | 10 | 50] ?? null;
  if (reminderNumber === null) {
    return { rentalCount, condition, eligible: false, discountPercent: 0, suggestedPrice: null, reason: null, reminderNumber: null };
  }

  const resolvedCondition = condition ?? 'GOOD';
  const discountPercent = CONDITION_DISCOUNT[resolvedCondition];
  const rawPrice = basePrice * (1 - discountPercent / 100);
  const suggestedPrice = Math.max(1000, Math.round(rawPrice / 1000) * 1000);
  return {
    rentalCount,
    condition: resolvedCondition,
    eligible: true,
    discountPercent,
    suggestedPrice,
    reason: `Sản phẩm đã được thuê ${rentalCount} lần; tình trạng hiện tại: ${resolvedCondition}.`,
    reminderNumber,
  };
}
