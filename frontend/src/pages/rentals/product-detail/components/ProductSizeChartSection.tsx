import { useEffect, useState } from "react";
import {
  sizeRecommendationApi,
  type PublicChart,
} from "../../../../features/rentals/services/sizeRecommendationApi";
import { ProductSizeChartTable } from "./ProductSizeChartTable";
import "./productSizeChart.css";

type ChartState = {
  productId: string;
  chart: PublicChart | null;
  loading: boolean;
  error: boolean;
};

export function ProductSizeChartSection({
  productId,
  selectedSize,
}: {
  productId: string;
  selectedSize: string;
}) {
  const [state, setState] = useState<ChartState>({
    productId,
    chart: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;
    sizeRecommendationApi.chart(productId).then(
      (response) => {
        if (!cancelled)
          setState({
            productId,
            chart: response.status === "READY" ? response.sizeChart : null,
            loading: false,
            error: false,
          });
      },
      () => {
        if (!cancelled)
          setState({ productId, chart: null, loading: false, error: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const current = state.productId === productId ? state : null;
  const chart = current?.chart;

  return (
    <section id="product-size-chart" className="product-chart-section" aria-labelledby="product-size-chart-title">
      <div className="product-chart-heading">
        <div>
          <h2 id="product-size-chart-title">Bảng size của mẫu áo</h2>
          <p>Đối chiếu trực tiếp số đo do cửa hàng xác nhận trước khi chọn kích cỡ.</p>
        </div>
        {chart?.imageUrl && (
          <a href={chart.imageUrl} target="_blank" rel="noopener noreferrer">
            Xem ảnh bảng size gốc
          </a>
        )}
      </div>
      {!current || current.loading ? (
        <p role="status">Đang tải bảng size…</p>
      ) : current.error ? (
        <p role="alert">Không tải được bảng size. Hãy tải lại trang để thử lại.</p>
      ) : !chart ? (
        <p role="status">Cửa hàng chưa có bảng size đã xác nhận cho mẫu áo này. Bạn vẫn có thể xem và đặt thuê sản phẩm.</p>
      ) : (
        <>
          <p className="product-chart-type">
            {chart.measurementType === "BODY" ? "Số đo cơ thể phù hợp" : "Số đo thực tế của áo"}
            {chart.measurementType === "GARMENT" && ". Đây là số đo áo, không phải số đo cơ thể."}
          </p>
          <ProductSizeChartTable chart={chart} selectedSize={selectedSize} />
        </>
      )}
    </section>
  );
}
