/**
 * Sidebar price filter for the combo hero "Ngân sách" choice (VIB-48).
 * Every choice sets both bounds, so switching budgets never keeps the previous minimum.
 * "Under 2m" has no matching sidebar preset (those are 1m wide), so none is highlighted.
 */
export function heroBudgetRange(
  budget: string,
  defaultMin: number,
  defaultMax: number,
): { minPrice: number; maxPrice: number; presetPrice: string | null } {
  switch (budget) {
    case 'under_2m':
      return { minPrice: defaultMin, maxPrice: 2000000, presetPrice: null };
    case '2m_3m':
      return { minPrice: 2000000, maxPrice: 3000000, presetPrice: '2m_3m' };
    case 'above_3m':
      return { minPrice: 3000000, maxPrice: defaultMax, presetPrice: 'above_3m' };
    default:
      return { minPrice: defaultMin, maxPrice: defaultMax, presetPrice: null };
  }
}
