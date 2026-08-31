/**
 * Helper utility for advanced anthropometric estimations and size confidence calculations
 * optimized for Vietnamese body shapes and Ao Dai garments.
 */

export interface EstimatedMeasurements {
  chest: number;
  waist: number;
}

export interface ConfidenceResult {
  score: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  alertMessage: string | null;
}

/**
 * Estimates female chest (vòng ngực) and waist (vòng eo) in cm
 * based on height, weight, and body shape.
 */
export const estimateMeasurements = (
  height: number,
  weight: number,
  bodyShape: string
): EstimatedMeasurements => {
  // Base formulas derived from Vietnamese anthropometry statistics
  // baseChest = 0.5 * height + 0.12 * weight + 8
  // baseWaist = 0.38 * height + 0.28 * weight - 12
  const baseChest = Math.round(0.5 * height + 0.12 * weight + 8);
  const baseWaist = Math.round(0.38 * height + 0.28 * weight - 12);

  let chest = baseChest;
  let waist = baseWaist;

  switch (bodyShape.toUpperCase()) {
    case 'HOURGLASS': // Đồng hồ cát: ngực nở, eo thon
      chest += 3;
      waist -= 4;
      break;
    case 'PEAR': // Quả lê: ngực nhỏ, eo nhỏ/trung bình, mông nở
      chest -= 3;
      waist -= 1;
      break;
    case 'APPLE': // Quả táo: ngực to, eo to
      chest += 2;
      waist += 5;
      break;
    case 'RECTANGLE': // Thước kẻ: eo không thon, các vòng bằng phẳng
      chest -= 1;
      waist += 1;
      break;
    case 'INVERTED_TRIANGLE': // Tam giác ngược: vai ngực rộng, eo hông nhỏ
      chest += 4;
      waist -= 2;
      break;
    default:
      break;
  }

  // Bound within realistic boundaries
  chest = Math.max(70, Math.min(130, chest));
  waist = Math.max(50, Math.min(120, waist));

  return { chest, waist };
};

/**
 * Defines size range boundaries for matching.
 */
const SIZE_BOUNDS: Record<string, {
  chest: [number, number];
  waist: [number, number];
}> = {
  XS: { chest: [75, 81], waist: [55, 63] },
  S: { chest: [82, 85], waist: [64, 67] },
  M: { chest: [86, 89], waist: [68, 71] },
  L: { chest: [90, 93], waist: [72, 75] },
  XL: { chest: [94, 97], waist: [76, 79] },
  XXL: { chest: [98, 105], waist: [80, 88] },
};

/**
 * Calculates a confidence score (0-100) indicating how well the user fits into
 * the recommended size and returns a custom warning message if they are borderline.
 */
export const calculateConfidenceScore = (
  chest: number,
  waist: number,
  recommendedSize: string,
  fitPref: 'SLIM' | 'COMFORT'
): ConfidenceResult => {
  if (recommendedSize === 'CUSTOM') {
    return {
      score: 100,
      level: 'HIGH',
      alertMessage: 'Số đo vượt quá bảng size chuẩn. Bạn nên liên hệ shop để được đặt may hoặc chỉnh sửa riêng.'
    };
  }

  const bounds = SIZE_BOUNDS[recommendedSize];
  if (!bounds) {
    return { score: 80, level: 'MEDIUM', alertMessage: null };
  }

  // Calculate proximity factor (0.5 to 1.0)
  const calculateProximity = (val: number, range: [number, number]): number => {
    const [min, max] = range;
    if (val < min) {
      // Below min, calculate distance factor
      const dist = min - val;
      return Math.max(0.2, 0.5 - (dist / 4) * 0.3);
    }
    if (val > max) {
      // Above max, calculate distance factor
      const dist = val - max;
      return Math.max(0.2, 0.5 - (dist / 4) * 0.3);
    }
    const span = max - min;
    if (span === 0) return 1.0;
    const distToEdge = Math.min(val - min, max - val);
    return 0.6 + (distToEdge / (span / 2)) * 0.4;
  };

  const proxC = calculateProximity(chest, bounds.chest);
  const proxW = calculateProximity(waist, bounds.waist);

  // Average proximity with weight: Waist (60%) and Chest (40%) since Ao Dai fit is highly waist-critical
  const avgProximity = proxW * 0.6 + proxC * 0.4;
  let score = Math.round(avgProximity * 100);

  // Adjust score slightly based on fit preference
  // If user likes comfort and they are on the upper edge, or slim and they are on the lower edge
  let alertMessage: string | null = null;
  const isCloseToWaistMax = bounds.waist[1] - waist <= 1 && bounds.waist[1] - waist >= 0;
  const isCloseToChestMax = bounds.chest[1] - chest <= 1 && bounds.chest[1] - chest >= 0;

  if (isCloseToWaistMax || isCloseToChestMax) {
    score = Math.max(60, score - 8); // drop score slightly as it's borderline
    if (fitPref === 'SLIM') {
      alertMessage = `Số đo của bạn đang cận trên của Size ${recommendedSize}. Nếu bạn thích mặc ôm dáng vừa vặn, size này rất đẹp. Nếu muốn cử động thoải mái hơn khi ngồi, hãy cân nhắc chọn nhảy lên 1 size.`;
    } else {
      alertMessage = `Số đo của bạn sát mép giới hạn của Size ${recommendedSize}. Vì bạn thích mặc thoải mái, chúng tôi khuyên bạn nên chọn nhảy lên 1 size hoặc liên hệ shop để nới rộng eo thêm 1-2 cm.`;
    }
  }

  let level: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  if (score < 70) {
    level = 'LOW';
    if (!alertMessage) {
      alertMessage = `Số đo của bạn nằm ở biên giới giữa các size. Vui lòng nhắn tin trực tiếp với shop để được hỗ trợ may đo thủ công nhằm có phom dáng đẹp nhất.`;
    }
  } else if (score < 85) {
    level = 'MEDIUM';
  }

  return { score, level, alertMessage };
};
