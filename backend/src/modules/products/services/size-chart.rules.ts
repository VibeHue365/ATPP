import { BadRequestException } from '@nestjs/common';
import {
  ChartSource,
  CIRCUMFERENCES,
  FIT_DIMENSIONS,
  MEASUREMENTS,
  MeasurementType,
  SaveSizeChartDto,
} from '../dto/size-chart.dto';
import { SizeChart } from '../schemas/size-chart.schema';

export function validateSizeChart(
  chart: SaveSizeChartDto | SizeChart,
  sizes: string[],
  confirming = false,
): void {
  const fail = (message: string): never => {
    throw new BadRequestException(message);
  };
  if (chart.source === ChartSource.Image && !chart.imageUrl)
    fail('Image source requires imageUrl');
  if (chart.source === ChartSource.Manual && chart.imageUrl)
    fail('Manual source cannot reference an image');
  const labels = sizes.map((size) => size.trim().toUpperCase());
  const seen = new Set<string>();
  for (const row of chart.rows) {
    if (!row.size || !labels.includes(row.size) || seen.has(row.size))
      fail('Size rows must be unique and match product sizes');
    seen.add(row.size);
    for (const key of MEASUREMENTS) {
      const range = row[key];
      if (
        range &&
        (!Number.isFinite(range.min) ||
          !Number.isFinite(range.max) ||
          range.min <= 0 ||
          (key === 'length' ? range.min > range.max : range.min >= range.max))
      )
        fail(`Invalid ${key} range for ${row.size}`);
    }
  }
  if (
    chart.measurementType === MeasurementType.Body &&
    ((chart.fitRules?.length ?? 0) > 0 ||
      Object.values(chart.stretchAllowanceCm ?? {}).some(
        (value) => value != null,
      ))
  )
    fail('Body charts cannot declare garment ease/stretch rules');
  for (const rule of chart.fitRules ?? []) {
    for (const key of FIT_DIMENSIONS) {
      const range = rule[key];
      if (!range) continue;
      if (
        !Number.isFinite(range.min) ||
        !Number.isFinite(range.max) ||
        range.min >= range.max
      )
        fail(`Invalid ease range for ${key}`);
      const stretch = chart.stretchAllowanceCm?.[key] ?? 0;
      if (range.min < -stretch)
        fail(
          `Negative ease for ${key} exceeds declared stretch allowance in cm`,
        );
    }
  }
  if (!confirming) return;
  if (
    !labels.length ||
    !chart.rows.length ||
    new Set(labels).size !== seen.size
  )
    fail('Bảng size phải có số đo cho mọi size đang bán của sản phẩm.');
  if (!chart.requiredMeasurements.length)
    fail('Hãy chọn số đo bắt buộc khi tư vấn rồi lưu bảng nháp trước khi xác nhận.');
  const detailed = chart.requiredMeasurements.some((key) =>
    (CIRCUMFERENCES as readonly string[]).includes(key),
  );
  if (
    !detailed &&
    !(
      chart.requiredMeasurements.includes('height') &&
      chart.requiredMeasurements.includes('weight')
    )
  )
    fail('Hãy chọn ít nhất một vòng Ngực/Eo/Mông hoặc cả Chiều cao và Cân nặng.');
  for (const row of chart.rows) {
    for (const key of chart.requiredMeasurements) {
      if (!row[key]) fail(`Size ${row.size} còn thiếu số đo ${key} đã chọn để tư vấn.`);
    }
  }
  if (chart.measurementType === MeasurementType.Garment) {
    const dimensions = FIT_DIMENSIONS.filter((key) =>
      chart.rows.some((row) => row[key]),
    );
    if (!CIRCUMFERENCES.some((key) => chart.rows.some((row) => row[key])) || !chart.fitRules?.length)
      fail(
        'Bảng số đo áo cần ít nhất một vòng đo và quy tắc độ cử động do cửa hàng khai báo.',
      );
    for (const rule of chart.fitRules ?? []) {
      for (const key of dimensions)
        if (!rule[key]) fail(`Kiểu mặc ${rule.preference} còn thiếu độ cử động cho ${key}.`);
    }
  }
}

export function isSizeChartReady(
  chart: SizeChart | null | undefined,
  sizes: string[],
): boolean {
  if (!chart || chart.status !== 'CONFIRMED') return false;
  try {
    validateSizeChart(chart, sizes, true);
    return true;
  } catch {
    return false;
  }
}
