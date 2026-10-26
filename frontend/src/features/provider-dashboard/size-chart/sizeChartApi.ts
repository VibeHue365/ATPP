import { httpClient } from "../../../services/httpClient";

export const dimensions = [
  "chest",
  "waist",
  "hip",
  "shoulder",
  "bicep",
  "height",
  "weight",
  "length",
] as const;
export type Dimension = (typeof dimensions)[number];
export const fitDimensions = ["chest", "waist", "hip", "shoulder", "bicep"] as const;
export type FitDimension = (typeof fitDimensions)[number];
export type Fit = "SLIM" | "REGULAR" | "COMFORT";
export type Range = { min: number; max: number };
export type Row = { size: string } & Partial<Record<Dimension, Range>>;
export type FitRule = { preference: Fit } & Partial<
  Record<FitDimension, Range>
>;
export interface ChartInput {
  source: "MANUAL" | "IMAGE";
  measurementType: "BODY" | "GARMENT";
  lengthUnit: "CM" | "IN";
  weightUnit: "KG" | "LB";
  imageUrl?: string;
  rows: Row[];
  requiredMeasurements: Exclude<Dimension, "length">[];
  fitRules?: FitRule[];
  stretchAllowanceCm?: Partial<Record<FitDimension, number>>;
}
export interface Chart extends ChartInput {
  version: number;
  sourceRevision: number;
  status: "DRAFT" | "CONFIRMED";
}
export interface ChartResponse {
  version: number;
  sizeChart: Chart | null;
  sizes?: string[];
  ready?: boolean;
  warnings?: string[];
  extractionFailed?: boolean;
}
export const sizeChartApi = {
  get: (id: string) =>
    httpClient.get<ChartResponse & { sizes: string[] }>(
      `/products/my-listings/${id}/size-chart`,
    ),
  save: (id: string, expectedVersion: number, chart: ChartInput) =>
    httpClient.patch<ChartResponse>(`/products/${id}/size-chart`, {
      ...chart,
      expectedVersion,
    }),
  confirm: (id: string, expectedVersion: number) =>
    httpClient.post<ChartResponse>(`/products/${id}/size-chart/confirm`, {
      expectedVersion,
    }),
  upload: (
    id: string,
    expectedVersion: number,
    file: File,
    chart: ChartInput,
  ) => {
    const body = new FormData();
    body.append("image", file);
    body.append("expectedVersion", String(expectedVersion));
    body.append("measurementType", chart.measurementType);
    body.append("lengthUnit", chart.lengthUnit);
    body.append("weightUnit", chart.weightUnit);
    return httpClient.post<ChartResponse>(
      `/products/${id}/size-chart/image`,
      body,
      { timeoutMs: 105_000 },
    );
  },
};
