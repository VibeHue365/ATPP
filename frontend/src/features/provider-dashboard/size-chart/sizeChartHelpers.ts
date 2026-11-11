import { dimensions, fitDimensions } from "./sizeChartApi";
import type {
  ChartInput,
  Dimension,
  Fit,
  FitDimension,
  FitRule,
  Range,
  Row,
} from "./sizeChartApi";

export type RawRow = { size: string } & Record<Dimension, string>;
export const labels: Record<Dimension, string> = {
  chest: "Ngực",
  waist: "Eo",
  hip: "Mông",
  shoulder: "Ngang vai",
  bicep: "Vòng bắp tay",
  height: "Chiều cao người",
  weight: "Cân nặng người",
  length: "Dài áo",
};
export const fits: Record<Fit, string> = {
  SLIM: "Ôm",
  REGULAR: "Vừa",
  COMFORT: "Thoải mái",
};
export function formatRange(range?: Range): string {
  return range ? `${range.min}..${range.max}` : "";
}
export function formatLength(range?: Range): string {
  return range ? range.min === range.max ? String(range.min) : formatRange(range) : "";
}
export function rangeBounds(value: string): [string, string] {
  const separator = value.indexOf("..");
  return separator < 0
    ? [value, ""]
    : [value.slice(0, separator), value.slice(separator + 2)];
}
export function withRangeBound(
  value: string,
  bound: "min" | "max",
  next: string,
): string {
  const [min, max] = rangeBounds(value);
  const updated: [string, string] = bound === "min" ? [next, max] : [min, next];
  return updated.every((part) => !part) ? "" : updated.join("..");
}
export function parseRange(value: string): Range | undefined {
  const text = value.trim().replaceAll(",", ".");
  if (!text) return undefined;
  const match = text.match(
    /^(-?\d+(?:\.\d+)?)\s*(?:\.\.|–|—|-)\s*(-?\d+(?:\.\d+)?)$/,
  );
  if (!match)
    throw new Error(
      `Số đo “${value}” chưa đúng. Nhập khoảng từ–đến, ví dụ 86..89; không nhập một số đơn lẻ.`,
    );
  const range = { min: Number(match[1]), max: Number(match[2]) };
  if (range.min >= range.max)
    throw new Error(
      "Giá trị đầu khoảng phải nhỏ hơn giá trị cuối khoảng.",
    );
  return range;
}
export function parseLength(value: string): Range | undefined {
  const text = value.trim().replaceAll(",", ".");
  if (!text) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const exact = Number(text);
    if (exact <= 0 || exact > 1000) throw new Error("Dài áo phải lớn hơn 0 và không quá 1000.");
    return { min: exact, max: exact };
  }
  return parseRange(text);
}
export function rawRows(sizes: string[], chart?: Pick<ChartInput, "rows"> | null): RawRow[] {
  return [...new Set(sizes.map((size) => size.trim().toUpperCase()))].map(
    (size) => {
      const stored = chart?.rows.find((row) => row.size === size);
      return Object.fromEntries([
        ["size", size],
        ...dimensions.map((key) => [key, key === "length" ? formatLength(stored?.[key]) : formatRange(stored?.[key])]),
      ]) as RawRow;
    },
  );
}
export function serializeRows(rows: RawRow[]): Row[] {
  return rows.map((row) => ({
    size: row.size,
    ...Object.fromEntries(
      dimensions.flatMap((key) => {
        const range = key === "length" ? parseLength(row[key]) : parseRange(row[key]);
        if (!range) return [];
        if (range.min <= 0) throw new Error(`${labels[key]} phải lớn hơn 0.`);
        return [[key, range]];
      }),
    ),
  }));
}
export function cleanChart(chart: ChartInput): ChartInput {
  // Explicit whitelist prevents resending server-managed confirmation metadata.
  return {
    source: chart.source,
    measurementType: chart.measurementType,
    lengthUnit: chart.lengthUnit,
    weightUnit: chart.weightUnit,
    imageUrl: chart.source === "IMAGE" ? chart.imageUrl : undefined,
    rows: chart.rows,
    requiredMeasurements: chart.requiredMeasurements,
    fitRules: chart.measurementType === "GARMENT" ? chart.fitRules : [],
    stretchAllowanceCm:
      chart.measurementType === "GARMENT"
        ? chart.stretchAllowanceCm
        : undefined,
  };
}
export function serializeFitRules(
  values: Record<Fit, Record<FitDimension, string>>,
): FitRule[] {
  return (Object.keys(fits) as Fit[]).flatMap((preference) => {
    const ranges = Object.fromEntries(
      fitDimensions.flatMap((key) => {
        const range = parseRange(values[preference][key]);
        return range ? [[key, range]] : [];
      }),
    );
    return Object.keys(ranges).length ? [{ preference, ...ranges }] : [];
  });
}
