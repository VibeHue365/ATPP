export interface NiceScaleResult {
  max: number;
  step: number;
  ticks: number[]; // Descending: [max, ..., 0]
}

export interface ComputeNiceScaleOptions {
  integerOnly?: boolean;
  minMax?: number;
}

/**
 * Tính thang đo trục Y "đẹp" (1 / 2 / 2.5 / 5 × 10^n) theo volume thực tế,
 * đảm bảo không bao giờ ép trần quá lớn (như 600 đơn / 120M / 4M) hoặc trùng nhãn trục.
 */
export function computeNiceScale(
  maxValue: number,
  tickCount = 4,
  options: ComputeNiceScaleOptions = {},
): NiceScaleResult {
  const safeTickCount = Math.max(1, Math.floor(tickCount));
  const { integerOnly = false, minMax } = options;

  const rawMax = Number.isFinite(maxValue) ? Math.max(0, maxValue) : 0;
  const effectiveDefaultMin = integerOnly ? safeTickCount : 400_000;
  const targetMax = rawMax > 0 ? Math.max(rawMax, minMax ?? 0) : (minMax ?? effectiveDefaultMin);

  const roughStep = targetMax / safeTickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(roughStep, 1e-9))));
  const normalized = roughStep / magnitude;

  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 2.5) niceNormalized = 2.5;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;

  let step = niceNormalized * magnitude;

  if (integerOnly) {
    step = Math.max(1, Math.ceil(step));
  }

  let niceMax = step * safeTickCount;
  while (niceMax < rawMax) {
    step = integerOnly ? step + 1 : step * 1.25;
    niceMax = step * safeTickCount;
  }

  const ticks: number[] = [];
  for (let i = safeTickCount; i >= 0; i -= 1) {
    const val = i === 0 ? 0 : Math.round(step * i * 100) / 100;
    ticks.push(val);
  }

  return {
    max: ticks[0] || safeTickCount,
    step,
    ticks,
  };
}

/** Format rút gọn giá trị VNĐ cho nhãn trục Y: 0đ, 250k, 1.5tr, 1.2 tỷ. */
export function formatCompactVnd(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  if (v <= 0) return '0đ';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const num = abs / 1_000_000_000;
    return `${sign}${Number.isInteger(num) ? num : num.toFixed(1).replace(/\.0$/, '')} tỷ`;
  }
  if (abs >= 1_000_000) {
    const num = abs / 1_000_000;
    return `${sign}${Number.isInteger(num) ? num : num.toFixed(1).replace(/\.0$/, '')}tr`;
  }
  if (abs >= 1_000) {
    const num = abs / 1_000;
    return `${sign}${Number.isInteger(num) ? num : num.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${sign}${Math.round(abs)}đ`;
}

/** Format chính xác VNĐ cho tooltip: 1.250.000đ. */
export function formatExactVnd(value: number): string {
  const v = Number.isFinite(value) ? Math.round(value) : 0;
  return `${new Intl.NumberFormat('vi-VN').format(v)}đ`;
}
