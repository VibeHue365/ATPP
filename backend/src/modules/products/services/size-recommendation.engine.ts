import {
  CIRCUMFERENCES,
  FIT_DIMENSIONS,
  FitPreference,
  MeasurementType,
} from '../dto/size-chart.dto';
import { SizeChart } from '../schemas/size-chart.schema';
import { isSizeChartReady } from './size-chart.rules';

export type BodyKey = 'chest' | 'waist' | 'hip' | 'shoulder' | 'bicep' | 'height' | 'weight';
export type Measurements = Partial<Record<BodyKey, number | null>> & {
  fitPreference?: FitPreference | string | null;
};
export interface SizeViolation {
  measurement: BodyKey;
  kind: 'BODY_RANGE' | 'GARMENT_EASE';
  actual: number | { min: number; max: number };
  expected: { min: number; max: number };
  deviation: number;
  unit: 'cm' | 'kg';
  coverage?: 'PARTIAL_OVERLAP' | 'NO_FIT';
}
export interface SizeEvaluation {
  size: string;
  outcome: 'MATCH' | 'PRELIMINARY' | 'REJECTED' | 'MISSING';
  reasons: string[];
  missing: string[];
  violations: SizeViolation[];
  referenceOutliers: BodyKey[];
}
export interface SizeRecommendation {
  status:
    | 'UNAVAILABLE'
    | 'MATCH'
    | 'MULTIPLE_MATCHES'
    | 'PRELIMINARY'
    | 'NO_MATCH'
    | 'INSUFFICIENT_DATA';
  chartVersion: number | null;
  candidates: string[];
  closestSizes: string[];
  recommendedSize: string | null;
  evaluations: SizeEvaluation[];
  missingMeasurements: Array<BodyKey | 'fitPreference'>;
  missingChartMeasurements: BodyKey[];
  warnings: string[];
}
const labels: Record<BodyKey, string> = {
  chest: 'Vòng ngực',
  waist: 'Vòng eo',
  hip: 'Vòng mông',
  shoulder: 'Ngang vai',
  bicep: 'Vòng bắp tay',
  height: 'Chiều cao',
  weight: 'Cân nặng',
};
const present = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const inRange = (value: number, min: number, max: number) =>
  value >= min - 1e-8 && value <= max + 1e-8;
const rounded = (value: number) => Math.round(value * 100) / 100;
const distanceToRange = (value: number, min: number, max: number) =>
  value < min ? min - value : value > max ? value - max : 0;

/** Deterministic, product-specific matching. No AI calls, gender tables or inferred measurements. */
export function recommendSize(
  chart: SizeChart | null | undefined,
  sizes: string[],
  body: Measurements,
): SizeRecommendation {
  const result: SizeRecommendation = {
    status: 'UNAVAILABLE',
    chartVersion: chart?.version ?? null,
    candidates: [],
    closestSizes: [],
    recommendedSize: null,
    evaluations: [],
    missingMeasurements: [],
    missingChartMeasurements: [],
    warnings: [],
  };
  if (!chart || !isSizeChartReady(chart, sizes)) {
    result.warnings.push(
      'Cửa hàng chưa có bảng size đã xác nhận phù hợp với các size hiện tại.',
    );
    return result;
  }
  const factor = chart.lengthUnit === 'IN' ? 2.54 : 1;
  const massFactor = chart.weightUnit === 'LB' ? 0.45359237 : 1;
  const critical = FIT_DIMENSIONS.filter((key) =>
    chart.rows.some((row) => row[key]),
  );
  const hasDetailedInput = critical.some((key) => present(body[key]));
  const fitRule = (chart.fitRules ?? []).find(
    (rule) => rule.preference === body.fitPreference,
  );
  const ranks = new Map<string, { failures: number; gap: number }>();
  for (const row of chart.rows) {
    const evaluation: SizeEvaluation = {
      size: row.size,
      outcome: 'MATCH',
      reasons: [],
      missing: [],
      violations: [],
      referenceOutliers: [],
    };
    let rejected = false;
    let failures = 0;
    let gap = 0;
    // Only provider-selected fields are mandatory. Check other declared
    // circumferences when supplied, without asking the customer for them.
    const keys = new Set<BodyKey>([
      ...chart.requiredMeasurements,
      ...critical.filter((key) => present(body[key])),
    ]);
    for (const key of ['height', 'weight'] as const)
      if (row[key] && present(body[key])) keys.add(key);
    for (const key of keys) {
      const range = row[key];
      const value = body[key];
      if (!range) {
        evaluation.missing.push(`CHART_${key}`);
        evaluation.reasons.push(
          `Bảng chưa có ${labels[key].toLowerCase()} cho size ${row.size}.`,
        );
        continue;
      }
      if (!present(value)) {
        evaluation.missing.push(key);
        evaluation.reasons.push(`Cần bổ sung ${labels[key].toLowerCase()}.`);
        continue;
      }
      const unit = key === 'weight' ? 'kg' : 'cm';
      const multiplier = key === 'weight' ? massFactor : factor;
      const min = range.min * multiplier,
        max = range.max * multiplier;
      if (
        chart.measurementType === MeasurementType.Garment &&
        (FIT_DIMENSIONS as readonly string[]).includes(key)
      ) {
        const dimension = key as (typeof FIT_DIMENSIONS)[number];
        const ease = fitRule?.[dimension];
        if (!ease) {
          evaluation.missing.push(
            body.fitPreference ? 'CHART_fitPreference' : 'fitPreference',
          );
          evaluation.reasons.push(
            `Chưa có quy tắc độ vừa ${labels[key].toLowerCase()} cho sở thích đã chọn.`,
          );
          continue;
        }
        const easeMin = min - value,
          easeMax = max - value;
        const fits =
          inRange(easeMin, ease.min, ease.max) &&
          inRange(easeMax, ease.min, ease.max);
        const coverage =
          easeMax >= ease.min && easeMin <= ease.max
            ? 'PARTIAL_OVERLAP'
            : 'NO_FIT';
        const difference = Math.max(
          distanceToRange(easeMin, ease.min, ease.max),
          distanceToRange(easeMax, ease.min, ease.max),
        );
        if (!fits) {
          rejected = true;
          failures += 1;
          gap += difference / (ease.max - ease.min);
          evaluation.violations.push({
            measurement: key,
            kind: 'GARMENT_EASE',
            actual: { min: rounded(easeMin), max: rounded(easeMax) },
            expected: { min: ease.min, max: ease.max },
            deviation: rounded(difference),
            unit: 'cm',
            coverage,
          });
        }
        evaluation.reasons.push(
          `${labels[key]}: độ cử động ${rounded(easeMin)}..${rounded(easeMax)} cm ${fits ? 'nằm trong' : 'ngoài'} khoảng ${ease.min}..${ease.max} cm do cửa hàng khai báo${fits ? '' : ` (lệch tối đa ${rounded(difference)} cm)`}.`,
        );
      } else {
        const fits = inRange(value, min, max);
        // Height and weight are rough references once actual body circumferences exist.
        const isReference =
          hasDetailedInput && (key === 'height' || key === 'weight');
        const difference = distanceToRange(value, min, max);
        if (!fits && isReference) evaluation.referenceOutliers.push(key);
        if (!fits && !isReference) {
          rejected = true;
          failures += 1;
          gap += difference / (max - min);
          evaluation.violations.push({
            measurement: key,
            kind: 'BODY_RANGE',
            actual: value,
            expected: { min: rounded(min), max: rounded(max) },
            deviation: rounded(difference),
            unit,
          });
        }
        evaluation.reasons.push(
          fits
            ? `${labels[key]} ${value} ${unit} nằm trong khoảng ${rounded(min)}..${rounded(max)} ${unit} của size ${row.size}.`
            : isReference
              ? `${labels[key]} ${value} ${unit} ngoài khoảng tham khảo ${rounded(min)}..${rounded(max)} ${unit} của size ${row.size} (${rounded(difference)} ${unit}); cần đối chiếu thêm, không dùng riêng chỉ số này để loại size.`
              : `${labels[key]} ${value} ${unit} ngoài khoảng ${rounded(min)}..${rounded(max)} ${unit} của size ${row.size}, lệch ${rounded(difference)} ${unit}.`,
        );
      }
    }
    evaluation.missing = [...new Set(evaluation.missing)];
    if (rejected) evaluation.outcome = 'REJECTED';
    else if (evaluation.missing.length) {
      // A preliminary result may skip unknown circumferences, but never a known mismatch,
      // missing chart constraint, missing height/weight or undeclared garment fit rule.
      const canBePreliminary =
        row.height &&
        row.weight &&
        present(body.height) &&
        present(body.weight) &&
        evaluation.missing.every((key) =>
          (FIT_DIMENSIONS as readonly string[]).includes(key),
        );
      evaluation.outcome = canBePreliminary ? 'PRELIMINARY' : 'MISSING';
    } else if (!hasDetailedInput) evaluation.outcome = 'PRELIMINARY';
    result.evaluations.push(evaluation);
    ranks.set(row.size, { failures, gap });
  }
  const matches = result.evaluations.filter((row) => row.outcome === 'MATCH');
  const preliminary = result.evaluations.filter(
    (row) => row.outcome === 'PRELIMINARY',
  );
  if (matches.length) {
    result.candidates = matches.map((row) => row.size);
    result.status = matches.length === 1 ? 'MATCH' : 'MULTIPLE_MATCHES';
    result.recommendedSize = matches.length === 1 ? matches[0].size : null;
  } else if (preliminary.length) {
    result.status = 'PRELIMINARY';
    result.candidates = preliminary.map((row) => row.size);
    result.warnings.push(
      critical.length
        ? 'Chỉ tham khảo theo chiều cao/cân nặng và các số đo đã kiểm tra; chưa đủ dữ liệu để xác nhận độ vừa. Hãy bổ sung số đo trước khi áp dụng.'
        : 'Bảng chỉ có chiều cao/cân nặng nên không thể xác nhận độ vừa. Hãy hỏi cửa hàng về số đo chi tiết của mẫu áo.',
    );
  } else
    result.status = result.evaluations.some((row) => row.outcome === 'MISSING')
      ? 'INSUFFICIENT_DATA'
      : 'NO_MATCH';
  if (result.status === 'INSUFFICIENT_DATA' || result.status === 'PRELIMINARY') {
    const viable = result.evaluations.filter(
      (row) => row.outcome === 'MISSING' || row.outcome === 'PRELIMINARY',
    );
    const customerKeys = [
      'chest',
      'waist',
      'hip',
      'shoulder',
      'bicep',
      'height',
      'weight',
      'fitPreference',
    ] as const;
    const needed = new Set(viable.flatMap((row) => row.missing));
    if (result.status === 'PRELIMINARY' && !hasDetailedInput)
      for (const key of critical)
        if (chart.rows.every((row) => row[key])) needed.add(key);
    result.missingMeasurements = customerKeys.filter((key) => needed.has(key));
    result.missingChartMeasurements = (
      [...FIT_DIMENSIONS, 'height', 'weight'] as const
    ).filter((key) => needed.has(`CHART_${key}`));
    if (needed.has('CHART_fitPreference'))
      result.warnings.push(
        'Cửa hàng chưa khai báo độ cử động cho sở thích mặc đã chọn. Hãy chọn kiểu mặc có trong bảng hoặc hỏi cửa hàng.',
      );
    if (result.missingChartMeasurements.length)
      result.warnings.push(
        'Một số size thiếu số đo để đối chiếu. Hãy hỏi cửa hàng trước khi chọn.',
      );
  }
  if (
    result.status === 'NO_MATCH' &&
    critical.length > 0
  ) {
    result.closestSizes = result.evaluations
      .filter((row) => row.outcome === 'REJECTED' && row.missing.length === 0)
      .sort((a, b) => {
        const first = ranks.get(a.size)!;
        const second = ranks.get(b.size)!;
        return first.failures - second.failures || first.gap - second.gap;
      })
      .slice(0, 2)
      .map((row) => row.size);
  }
  if (matches.some((row) => row.referenceOutliers.length > 0))
    result.warnings.push(
      'Size khớp số đo vòng nhưng chiều cao hoặc cân nặng ngoài khoảng tham khảo. Hãy kiểm tra chiều dài áo và trao đổi với cửa hàng nếu cần.',
    );
  const unmodelled = CIRCUMFERENCES.filter((key) => !critical.includes(key));
  if (unmodelled.length)
    result.warnings.push(
      `Bảng không mô tả ${unmodelled.map((key) => labels[key].toLowerCase()).join(', ')}; kết quả chỉ dựa trên các số đo được khai báo.`,
    );
  if (chart.measurementType === MeasurementType.Body && body.fitPreference)
    result.warnings.push(
      'Bảng số đo cơ thể chưa mô hình hóa sở thích mặc; hệ thống không tự tăng/giảm size.',
    );
  if (chart.rows.some((row) => row.length))
    result.warnings.push(
      'Chiều dài áo cần được kiểm tra riêng; không so trực tiếp với chiều cao cơ thể.',
    );
  if (result.status === 'MULTIPLE_MATCHES')
    result.warnings.push(
      'Có nhiều size phù hợp. Hãy xem từng khoảng số đo và chủ động chọn; hệ thống không tự chọn thay bạn.',
    );
  result.warnings.push('Kết quả độ vừa không xác nhận tồn kho hoặc lịch thuê.');
  return result;
}
