import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ProductAiSizeModal } from "../src/pages/rentals/product-detail/components/ProductAiSizeModal";
import { sizeRecommendationApi } from "../src/features/rentals/services/sizeRecommendationApi";
import { httpClient } from "../src/services/httpClient";
import type { Recommendation } from "../src/features/rentals/services/sizeRecommendationApi";

vi.mock(
  "../src/features/rentals/services/sizeRecommendationApi",
  async (original) => ({
    ...(await original<
      typeof import("../src/features/rentals/services/sizeRecommendationApi")
    >()),
    sizeRecommendationApi: { chart: vi.fn(), recommend: vi.fn() },
  }),
);
vi.mock("../src/services/httpClient", () => ({
  httpClient: { get: vi.fn(), patch: vi.fn() },
}));
const chart = {
  version: 2,
  measurementType: "BODY" as const,
  lengthUnit: "CM" as const,
  weightUnit: "KG" as const,
  rows: [{ size: "M", chest: { min: 86, max: 89 } }],
};
const result: Recommendation = {
  status: "MATCH",
  chartVersion: 2,
  candidates: ["M"],
  closestSizes: [],
  missingMeasurements: [],
  missingChartMeasurements: [],
  recommendedSize: "M",
  evaluations: [
    {
      size: "M",
      outcome: "MATCH",
      reasons: ["Ngực 87 trong khoảng 86..89"],
      missing: [],
      violations: [],
      referenceOutliers: [],
    },
  ],
  warnings: [],
};
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(sizeRecommendationApi.chart).mockResolvedValue({
    status: "READY",
    sizeChart: chart,
  });
  vi.mocked(sizeRecommendationApi.recommend).mockResolvedValue(result);
  vi.mocked(httpClient.get).mockResolvedValue({
    preferences: { sizeInfo: { chest: 87, waist: 70, hip: 94 } },
  });
});
function view(authenticated = false) {
  const apply = vi.fn();
  render(
    <ProductAiSizeModal
      isOpen
      onClose={vi.fn()}
      productId="p"
      productName="Áo dài kiểm thử"
      isAuthenticated={authenticated}
      onApplySize={apply}
    />,
  );
  return apply;
}
describe("product-specific recommendation UI", () => {
  it("prefills real profile values and only applies after the user chooses", async () => {
    const apply = view(true);
    expect(await screen.findByDisplayValue("87")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Gợi ý size theo bảng của mẫu áo" }),
    );
    const choose = await screen.findByRole("button", { name: "Chọn size M" });
    expect(apply).not.toHaveBeenCalled();
    expect(sizeRecommendationApi.recommend).toHaveBeenCalledWith(
      "p",
      expect.objectContaining({
        chest: 87,
        waist: 70,
        hip: 94,
        height: null,
        weight: null,
        fitPreference: null,
      }),
    );
    fireEvent.click(choose);
    await waitFor(() => expect(apply).toHaveBeenCalledWith("M"));
  });
  it("does not fill in fabricated default measurements for a guest", async () => {
    view();
    await screen.findByRole("button", {
      name: "Gợi ý size theo bảng của mẫu áo",
    });
    expect(
      (screen.getByLabelText("Vòng ngực (cm)") as HTMLInputElement).value,
    ).toBe("");
    expect(httpClient.get).not.toHaveBeenCalled();
  });
  it("does not pretend a BODY chart can interpret fit preference", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      preferences: { sizeInfo: { chest: 87, waist: 70, hip: 94, fitPreference: "COMFORT" } },
    });
    view(true);
    expect(await screen.findByText(/Sở thích mặc chỉ được tính/)).toBeTruthy();
    expect(screen.queryByLabelText("Sở thích mặc")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gợi ý size theo bảng của mẫu áo" }));
    await waitFor(() => expect(sizeRecommendationApi.recommend).toHaveBeenCalledWith(
      "p", expect.objectContaining({ fitPreference: null }),
    ));
  });
  it("refuses to apply a result after the provider replaces or edits the chart", async () => {
    const apply = view();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Gợi ý size theo bảng của mẫu áo",
      }),
    );
    const choose = await screen.findByRole("button", { name: "Chọn size M" });
    vi.mocked(sizeRecommendationApi.chart).mockResolvedValue({
      status: "UNAVAILABLE",
      sizeChart: null,
    });
    fireEvent.click(choose);
    await screen.findByText(/Bảng size đã thay đổi hoặc chưa xác nhận/);
    expect(apply).not.toHaveBeenCalled();
  });
  it.each([
    "PRELIMINARY",
    "NO_MATCH",
    "INSUFFICIENT_DATA",
    "UNAVAILABLE",
  ] as const)("never offers apply for %s", async (status) => {
    vi.mocked(sizeRecommendationApi.recommend).mockResolvedValue({
      ...result,
      status,
      recommendedSize: null,
    });
    view();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Gợi ý size theo bảng của mẫu áo",
      }),
    );
    await screen.findByRole("region", { name: "Kết quả tư vấn size" });
    expect(screen.queryByRole("button", { name: "Chọn size M" })).toBeNull();
  });
  it("explains the closest chart size without offering an invalid size for booking", async () => {
    vi.mocked(sizeRecommendationApi.recommend).mockResolvedValue({
      ...result,
      status: "NO_MATCH",
      recommendedSize: null,
      candidates: [],
      closestSizes: ["M"],
      evaluations: [{
        size: "M",
        outcome: "REJECTED",
        reasons: ["Dữ liệu giải thích vẫn hiển thị ở chi tiết."],
        missing: [],
        violations: [{
          measurement: "chest",
          kind: "BODY_RANGE",
          actual: 90,
          expected: { min: 86, max: 89 },
          deviation: 1,
          unit: "cm",
        }],
        referenceOutliers: [],
      }],
    });
    view();
    fireEvent.click(await screen.findByRole("button", { name: "Gợi ý size theo bảng của mẫu áo" }));
    expect(await screen.findByText("Size lệch ít nhất để bạn đối chiếu")).toBeTruthy();
    expect(screen.getAllByText(/Vòng ngực 90 cm nằm ngoài/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Chọn size M" })).toBeNull();
  });
  it("shows shoulder and upper-arm inputs only when this chart declares them", async () => {
    view();
    await screen.findByRole("button", { name: "Gợi ý size theo bảng của mẫu áo" });
    expect(screen.queryByLabelText("Ngang vai (cm)")).toBeNull();
    cleanup();
    vi.mocked(sizeRecommendationApi.chart).mockResolvedValue({
      status: "READY",
      sizeChart: { ...chart, rows: [{ ...chart.rows[0], shoulder: { min: 38, max: 40 }, bicep: { min: 27, max: 30 } }] },
    });
    view();
    expect(await screen.findByLabelText("Ngang vai (cm)")).toBeTruthy();
    expect(screen.getByLabelText("Vòng bắp tay (cm)")).toBeTruthy();
  });
  it("names missing customer measurements and highlights the matching inputs", async () => {
    vi.mocked(sizeRecommendationApi.recommend).mockResolvedValue({
      ...result,
      status: "INSUFFICIENT_DATA",
      candidates: [],
      recommendedSize: null,
      missingMeasurements: ["hip"],
    });
    view();
    fireEvent.click(await screen.findByRole("button", { name: "Gợi ý size theo bảng của mẫu áo" }));
    expect(await screen.findByText(/Hãy bổ sung vòng mông/)).toBeTruthy();
    expect(screen.getByLabelText("Vòng mông (cm)").getAttribute("aria-invalid")).toBe("true");
  });
  it("allows viewing an old product without claiming a size when no confirmed chart exists", async () => {
    vi.mocked(sizeRecommendationApi.chart).mockResolvedValue({
      status: "UNAVAILABLE",
      sizeChart: null,
    });
    view();
    expect(
      await screen.findByText(/Cửa hàng chưa có bảng size đã xác nhận/),
    ).toBeTruthy();
    expect(sizeRecommendationApi.recommend).not.toHaveBeenCalled();
  });
  it("invalidates old results when measurements change", async () => {
    view();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Gợi ý size theo bảng của mẫu áo",
      }),
    );
    await screen.findByRole("button", { name: "Chọn size M" });
    fireEvent.change(screen.getByLabelText("Vòng ngực (cm)"), {
      target: { value: "91" },
    });
    expect(screen.queryByRole("button", { name: "Chọn size M" })).toBeNull();
  });
  it("surfaces API failures without using the old local calculator or chatbot fallback", async () => {
    vi.mocked(sizeRecommendationApi.recommend).mockRejectedValue(
      new Error("Không có kết nối"),
    );
    view();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Gợi ý size theo bảng của mẫu áo",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Không có kết nối",
      ),
    );
    expect(screen.queryByRole("button", { name: "Chọn size M" })).toBeNull();
  });
});
