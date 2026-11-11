import type { PublicChart } from "../../../../features/rentals/services/sizeRecommendationApi";
import "./productSizeChart.css";

type Measurement = "chest" | "waist" | "hip" | "shoulder" | "bicep" | "height" | "weight" | "length";

const measurements: { key: Measurement; label: string; weight: boolean }[] = [
  { key: "chest", label: "Ngực", weight: false },
  { key: "waist", label: "Eo", weight: false },
  { key: "hip", label: "Mông", weight: false },
  { key: "shoulder", label: "Ngang vai", weight: false },
  { key: "bicep", label: "Bắp tay", weight: false },
  { key: "height", label: "Chiều cao", weight: false },
  { key: "weight", label: "Cân nặng", weight: true },
  { key: "length", label: "Dài áo", weight: false },
];

function formatRange(range?: { min: number; max: number }) {
  if (!range) return "—";
  return range.min === range.max ? String(range.min) : `${range.min}–${range.max}`;
}

export function ProductSizeChartTable({
  chart,
  selectedSize,
}: {
  chart: PublicChart;
  selectedSize?: string;
}) {
  const visibleMeasurements = measurements.filter(
    ({ key }) =>
      (key !== "shoulder" && key !== "bicep") ||
      chart.rows.some((row) => row[key]),
  );
  return (
    <div className="product-chart-table-wrap">
      <table className="product-chart-table">
        <thead>
          <tr>
            <th scope="col">Size</th>
            {visibleMeasurements.map(({ key, label, weight }) => (
              <th scope="col" key={key}>
                {label} ({weight ? chart.weightUnit.toLowerCase() : chart.lengthUnit.toLowerCase()})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row) => (
            <tr key={row.size} className={row.size === selectedSize ? "product-chart-selected" : undefined}>
              <th scope="row">{row.size}{row.size === selectedSize && <span className="product-chart-selected-label">Đang chọn</span>}</th>
              {visibleMeasurements.map(({ key, label, weight }) => (
                <td key={key} data-label={`${label} (${weight ? chart.weightUnit.toLowerCase() : chart.lengthUnit.toLowerCase()})`}>
                  {formatRange(row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="product-chart-empty-note">— nghĩa là cửa hàng chưa khai báo số đo đó.</p>
    </div>
  );
}
