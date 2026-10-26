import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProductSizeChartSection } from "../src/pages/rentals/product-detail/components/ProductSizeChartSection";
import { sizeRecommendationApi } from "../src/features/rentals/services/sizeRecommendationApi";

vi.mock("../src/features/rentals/services/sizeRecommendationApi", async (original) => ({
  ...(await original<typeof import("../src/features/rentals/services/sizeRecommendationApi")>()),
  sizeRecommendationApi: { chart: vi.fn() },
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("public size chart on product detail", () => {
  it("shows confirmed product-specific ranges, exact length, units, and the source image", async () => {
    vi.mocked(sizeRecommendationApi.chart).mockResolvedValue({
      status: "READY",
      sizeChart: {
        version: 3,
        measurementType: "BODY",
        lengthUnit: "CM",
        weightUnit: "KG",
        imageUrl: "https://example.com/chart.png",
        rows: [{
          size: "M",
          chest: { min: 84, max: 88 },
          weight: { min: 50, max: 55 },
          length: { min: 140, max: 140 },
        }],
      },
    });
    render(<ProductSizeChartSection productId="product-1" selectedSize="M" />);
    expect(await screen.findByText("84–88")).toBeTruthy();
    expect(screen.getByText("50–55")).toBeTruthy();
    expect(screen.getByText("140")).toBeTruthy();
    expect(screen.getByText("Đang chọn")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Xem ảnh bảng size gốc" }).getAttribute("href"))
      .toBe("https://example.com/chart.png");
    expect(sizeRecommendationApi.chart).toHaveBeenCalledWith("product-1");
  });

  it("does not expose an unconfirmed chart", async () => {
    vi.mocked(sizeRecommendationApi.chart).mockResolvedValue({
      status: "UNAVAILABLE",
      sizeChart: null,
    });
    render(<ProductSizeChartSection productId="old-product" selectedSize="S" />);
    expect(await screen.findByText(/chưa có bảng size đã xác nhận/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keeps the detail page readable when chart loading fails", async () => {
    vi.mocked(sizeRecommendationApi.chart).mockRejectedValue(new Error("offline"));
    render(<ProductSizeChartSection productId="product-1" selectedSize="" />);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Không tải được bảng size. Hãy tải lại trang để thử lại.",
    );
  });
});
