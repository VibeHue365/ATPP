/**
 * Calculates a recommended Ao Dai size based on height (cm) and weight (kg).
 */
export const calculateRecommendedSize = (height: number | string, weight: number | string): 'S' | 'M' | 'L' | 'XL' | 'XXL' | null => {
  const hNum = Number(height);
  const wNum = Number(weight);
  
  if (!hNum || !wNum || isNaN(hNum) || isNaN(wNum)) return null;

  // Convert height in meters (e.g. 1.6) to cm (160)
  const h = hNum < 3 ? hNum * 100 : hNum;
  const w = wNum;

  // Validate height for standard adult sizing (minimum 130cm)
  if (h < 130) return null;

  if (w < 48) return 'S';
  if (w >= 48 && w <= 53) return 'M';
  if (w >= 54 && w <= 58) return 'L';
  if (w >= 59 && w <= 66) return 'XL';
  return 'XXL';
};
