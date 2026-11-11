import { httpClient } from "../../../services/httpClient";

export const bodyKeys = ["height", "weight", "chest", "waist", "hip", "shoulder", "bicep"] as const;
export type BodyKey = (typeof bodyKeys)[number];
export type Measurements = Record<BodyKey, number | null> & {
  fitPreference: "SLIM" | "REGULAR" | "COMFORT" | null;
};
export interface Recommendation {
  status:
    | "UNAVAILABLE"
    | "MATCH"
    | "MULTIPLE_MATCHES"
    | "PRELIMINARY"
    | "NO_MATCH"
    | "INSUFFICIENT_DATA";
  chartVersion: number | null;
  recommendedSize: string | null;
  candidates: string[];
  closestSizes: string[];
  missingMeasurements: (BodyKey | "fitPreference")[];
  missingChartMeasurements: BodyKey[];
  evaluations: {
    size: string;
    outcome: "MATCH" | "PRELIMINARY" | "REJECTED" | "MISSING";
    reasons: string[];
    missing: string[];
    violations: {
      measurement: BodyKey;
      kind: "BODY_RANGE" | "GARMENT_EASE";
      actual: number | { min: number; max: number };
      expected: { min: number; max: number };
      deviation: number;
      unit: "cm" | "kg";
      coverage?: "PARTIAL_OVERLAP" | "NO_FIT";
    }[];
    referenceOutliers: BodyKey[];
  }[];
  warnings: string[];
}
export interface PublicChart {
  version: number;
  imageUrl?: string;
  measurementType: "BODY" | "GARMENT";
  lengthUnit: "CM" | "IN";
  weightUnit: "KG" | "LB";
  rows: ({ size: string } & Partial<
    Record<BodyKey | "length", { min: number; max: number }>
  >)[];
}
export const sizeRecommendationApi = {
  chart: (id: string) =>
    httpClient.get<{
      status: "READY" | "UNAVAILABLE";
      sizeChart: PublicChart | null;
    }>(`/products/${id}/size-chart`),
  recommend: (id: string, data: Measurements) =>
    httpClient.post<Recommendation>(
      `/products/${id}/size-recommendation`,
      data,
    ),
};
