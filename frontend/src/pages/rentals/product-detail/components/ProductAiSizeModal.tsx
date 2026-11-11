import { useEffect, useRef, useState } from "react";
import { Modal } from "../../../../components/common/Modal";
import { httpClient } from "../../../../services/httpClient";
import {
  bodyKeys,
  sizeRecommendationApi,
} from "../../../../features/rentals/services/sizeRecommendationApi";
import type {
  BodyKey,
  Measurements,
  PublicChart,
  Recommendation,
} from "../../../../features/rentals/services/sizeRecommendationApi";
import { ProductSizeChartTable } from "./ProductSizeChartTable";
import "./productSizeRecommendation.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  isAuthenticated: boolean;
  onApplySize: (size: string) => void;
};
const labels: Record<BodyKey, string> = {
  height: "Chiều cao",
  weight: "Cân nặng",
  chest: "Vòng ngực",
  waist: "Vòng eo",
  hip: "Vòng mông",
  shoulder: "Ngang vai",
  bicep: "Vòng bắp tay",
};
const empty = (): Record<BodyKey, string> => ({ height: "", weight: "", chest: "", waist: "", hip: "", shoulder: "", bicep: "" });
const statusLabels: Record<Recommendation["status"], string> = {
  UNAVAILABLE: "Chưa có dữ liệu tư vấn đáng tin cậy",
  MATCH: "Size phù hợp với các số đo đã kiểm tra",
  MULTIPLE_MATCHES: "Có nhiều size phù hợp",
  PRELIMINARY: "Gợi ý sơ bộ — chưa xác nhận độ vừa",
  NO_MATCH: "Chưa có size phù hợp",
  INSUFFICIENT_DATA: "Chưa đủ dữ liệu để chọn size",
};
const missingLabel = (key: BodyKey | "fitPreference") =>
  key === "fitPreference" ? "sở thích mặc" : labels[key].toLowerCase();
const describeViolation = (
  violation: Recommendation["evaluations"][number]["violations"][number],
) => {
  const name = labels[violation.measurement];
  const { min, max } = violation.expected;
  if (violation.kind === "BODY_RANGE")
    return `${name} ${violation.actual} ${violation.unit} nằm ngoài ${min}–${max} ${violation.unit}, lệch ${violation.deviation} ${violation.unit}.`;
  const actual = violation.actual as { min: number; max: number };
  const overlap = violation.coverage === "PARTIAL_OVERLAP";
  return `${name}: độ cử động ${actual.min}–${actual.max} cm ${overlap ? "chỉ giao một phần với" : "không giao với"} khoảng ${min}–${max} cm cửa hàng khai báo; lệch tối đa ${violation.deviation} cm. Cần hỏi cửa hàng trước khi chọn.`;
};

export function ProductAiSizeModal(props: Props) {
  if (!props.isOpen) return null;
  return <ProductAiSizeModalContent key={`${props.productId}:${props.isAuthenticated}`} {...props} />;
}

function ProductAiSizeModalContent({
  isOpen,
  onClose,
  productId,
  productName,
  isAuthenticated,
  onApplySize,
}: Props) {
  const [values, setValues] = useState(empty);
  const [fit, setFit] = useState<Measurements["fitPreference"]>(null);
  const [chart, setChart] = useState<PublicChart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileNote, setProfileNote] = useState("");
  const [result, setResult] = useState<Recommendation | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const requestGeneration = useRef(0);

  useEffect(() => {
    requestGeneration.current += 1;
    let cancelled = false;
    Promise.all([
      sizeRecommendationApi.chart(productId),
      isAuthenticated
        ? httpClient
            .get<{
              preferences?: { sizeInfo?: Partial<Measurements> };
            }>("/users/me")
            .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([response, profile]) => {
        if (cancelled) return;
        setChart(response.sizeChart);
        setLoaded(true);
        const info = profile?.preferences?.sizeInfo;
        if (info) {
          setValues(
            Object.fromEntries(
              bodyKeys.map((key) => [
                key,
                typeof info[key] === "number" &&
                Number.isFinite(info[key]) &&
                info[key]! > 0
                  ? String(info[key])
                  : "",
              ]),
            ) as ReturnType<typeof empty>,
          );
          setFit(
            info.fitPreference &&
              ["SLIM", "REGULAR", "COMFORT"].includes(info.fitPreference)
              ? info.fitPreference
              : null,
          );
          setProfileNote(
            "Đã điền số đo từ hồ sơ. Bạn có thể sửa cho lần tư vấn này.",
          );
        } else
          setProfileNote(
            "Bạn có thể nhập số đo trực tiếp. Hệ thống không tự ước tính ba vòng.",
          );
      })
      .catch(() => {
        if (!cancelled)
          setError("Không tải được bảng size. Hãy đóng và mở lại để thử lại.");
      });
    return () => {
      cancelled = true;
      requestGeneration.current += 1;
    };
  }, [productId, isAuthenticated]);

  const input = (): Measurements => {
    const data = Object.fromEntries(
      bodyKeys.map((key) => {
        const text = values[key].trim();
        if (!text) return [key, null];
        const value = Number(text);
        if (
          !Number.isFinite(value) ||
          value <= 0 ||
          value > (key === "weight" ? 1000 : 300)
        )
          throw new Error(
            `${labels[key]} chưa hợp lệ. Hãy nhập số dương theo đơn vị hiển thị.`,
          );
        return [key, value];
      }),
    ) as Record<BodyKey, number | null>;
    return { ...data, fitPreference: fit };
  };
  const calculate = async () => {
    const generation = requestGeneration.current;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await sizeRecommendationApi.recommend(
        productId,
        {
          ...input(),
          fitPreference: chart?.measurementType === "GARMENT" ? fit : null,
        },
      );
      if (generation !== requestGeneration.current) return;
      if (response.chartVersion !== chart?.version) {
        const latest = await sizeRecommendationApi.chart(productId);
        if (generation !== requestGeneration.current) return;
        setChart(latest.sizeChart);
        setError(
          "Bảng size đã thay đổi. Hãy kiểm tra bảng mới và bấm gợi ý lại.",
        );
        return;
      }
      setResult(response);
    } catch (err) {
      if (generation === requestGeneration.current)
        setError(
          err instanceof Error
            ? err.message
            : "Không lấy được gợi ý. Không có size nào được tự chọn.",
        );
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  };
  const applySize = async (size: string) => {
    const generation = requestGeneration.current;
    setLoading(true);
    setError("");
    try {
      const latest = await sizeRecommendationApi.chart(productId);
      if (generation !== requestGeneration.current) return;
      if (
        latest.status !== "READY" ||
        latest.sizeChart?.version !== result?.chartVersion
      ) {
        setChart(latest.sizeChart);
        setResult(null);
        setError(
          "Bảng size đã thay đổi hoặc chưa xác nhận. Hãy lấy gợi ý mới trước khi chọn size.",
        );
        return;
      }
      onApplySize(size);
    } catch {
      if (generation === requestGeneration.current)
        setError("Không kiểm tra được bảng size hiện tại. Chưa áp dụng size.");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  };
  const saveProfile = async () => {
    setSavingProfile(true);
    setError("");
    try {
      await httpClient.patch("/users/me/preferences", {
        preferences: { sizeInfo: input() },
      });
      setProfileNote("Đã cập nhật số đo vào hồ sơ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được số đo.");
    } finally {
      setSavingProfile(false);
    }
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gợi ý size cho bạn"
      maxWidth="720px"
    >
      <div className="product-size-recommendation">
        <p>
          Đối chiếu số đo với bảng size đã được cửa hàng xác nhận cho{" "}
          <strong>{productName}</strong>. Hãy kiểm tra số đo và chiều dài áo trước
          khi chọn kích cỡ.
        </p>
        {error && (
          <p role="alert" className="size-recommendation-error">
            {error}
          </p>
        )}
        {!loaded && !error && <p role="status">Đang tải bảng size và hồ sơ…</p>}
        {loaded && !chart && (
          <p role="status">
            Cửa hàng chưa có bảng size đã xác nhận. Bạn vẫn xem và đặt thuê
            được, nhưng hiện chưa đủ dữ liệu để tư vấn size.
          </p>
        )}
        {chart && (
          <>
            <p>{profileNote}</p>
            <fieldset
              disabled={loading || savingProfile}
              className="size-recommendation-fields"
            >
              {bodyKeys.filter((key) =>
                (key !== "shoulder" && key !== "bicep") ||
                chart.rows.some((row) => row[key]),
              ).map((key) => (
                <label key={key}>
                  {labels[key]} ({key === "weight" ? "kg" : "cm"})
                  <input
                    aria-label={`${labels[key]} (${key === "weight" ? "kg" : "cm"})`}
                    type="number"
                    min="1"
                    max={key === "weight" ? 1000 : 300}
                    step="0.1"
                    placeholder="Chưa khai báo"
                    value={values[key]}
                    aria-invalid={result?.missingMeasurements?.includes(key) || undefined}
                    onChange={(e) => {
                      setValues({ ...values, [key]: e.target.value });
                      setResult(null);
                    }}
                  />
                  {result?.missingMeasurements?.includes(key) && (
                    <span className="size-recommendation-field-hint">Cần bổ sung để kiểm tra bảng size này.</span>
                  )}
                </label>
              ))}
              {chart.measurementType === "GARMENT" && (
                <label>
                  Sở thích mặc
                  <select
                    value={fit ?? ""}
                    aria-invalid={result?.missingMeasurements?.includes("fitPreference") || undefined}
                    onChange={(e) => {
                      setFit(
                        (e.target.value || null) as Measurements["fitPreference"],
                      );
                      setResult(null);
                    }}
                  >
                    <option value="">Chưa chọn</option>
                    <option value="SLIM">Ôm</option>
                    <option value="REGULAR">Vừa</option>
                    <option value="COMFORT">Thoải mái</option>
                  </select>
                  {result?.missingMeasurements?.includes("fitPreference") && (
                    <span className="size-recommendation-field-hint">Cần chọn kiểu mặc có quy tắc được cửa hàng khai báo.</span>
                  )}
                </label>
              )}
            </fieldset>
            {chart.measurementType === "BODY" && (
              <p>Sở thích mặc chỉ được tính khi cửa hàng khai báo quy tắc độ cử động cho bảng số đo áo.</p>
            )}
            <details>
              <summary>Hướng dẫn đo cơ thể</summary>
              <p>
                Dùng thước dây đo cả vòng: ngực tại phần nở nhất, eo tại phần
                nhỏ nhất và mông tại phần nở nhất. Giữ thước ngang, không siết.
                Nhập số đo cơ thể; không nhập chiều ngang áo hoặc tự cộng độ
                rộng. Ngang vai đo từ mỏm vai này sang mỏm vai kia; vòng bắp tay đo quanh phần rộng nhất của bắp tay.
              </p>
            </details>
            <div className="size-recommendation-actions">
              <button
                type="button"
                disabled={loading || savingProfile}
                onClick={() => void calculate()}
              >
                {loading
                  ? "Đang đối chiếu…"
                  : "Gợi ý size theo bảng của mẫu áo"}
              </button>
              {isAuthenticated && (
                <button
                  type="button"
                  disabled={savingProfile || loading}
                  onClick={() => void saveProfile()}
                >
                  {savingProfile ? "Đang lưu…" : "Lưu số đo vào hồ sơ"}
                </button>
              )}
            </div>
            {result && (
              <section aria-label="Kết quả tư vấn size" aria-live="polite">
                <h3>{statusLabels[result.status]}</h3>
                {!!result.missingMeasurements?.length && (
                  <p className="size-recommendation-guidance">
                    Hãy bổ sung {result.missingMeasurements.map(missingLabel).join(", ")} để kiểm tra đầy đủ. Hệ thống không tự suy đoán các số đo còn thiếu.
                  </p>
                )}
                {!!result.missingChartMeasurements?.length && (
                  <p className="size-recommendation-guidance">
                    Bảng của cửa hàng còn thiếu {result.missingChartMeasurements.map(missingLabel).join(", ")} ở một số size. Hãy liên hệ cửa hàng để bổ sung.
                  </p>
                )}
                {result.candidates.length > 0 && (
                  <p>Size: {result.candidates.join(", ")}</p>
                )}
                {result.status === "NO_MATCH" && result.closestSizes?.length > 0 && (
                  <div className="size-recommendation-nearest">
                    <h4>Size lệch ít nhất để bạn đối chiếu</h4>
                    <p>Chưa size nào đáp ứng đủ các số đo. Các size dưới đây chỉ để tham khảo; hệ thống không tự chọn size để đặt thuê.</p>
                    {result.closestSizes.map((size) => {
                      const evaluation = result.evaluations.find((row) => row.size === size);
                      return (
                        <div key={size}>
                          <strong>Size {size}</strong>
                          <ul>
                            {evaluation?.violations?.map((violation) => (
                              <li key={`${violation.measurement}:${violation.kind}`}>{describeViolation(violation)}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
                {result.warnings.length > 0 && (
                  <ul>
                    {result.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                )}
                {result.evaluations.map((row) => (
                  <details key={row.size}>
                    <summary>
                      Size {row.size}:{" "}
                      {row.outcome === "MATCH"
                        ? "phù hợp theo bảng"
                        : row.outcome === "REJECTED"
                          ? "có số đo không phù hợp"
                          : "chưa đủ dữ liệu xác nhận"}
                    </summary>
                    <ul>
                      {row.reasons.map((reason, index) => (
                        <li key={index}>{reason}</li>
                      ))}
                    </ul>
                  </details>
                ))}
                {(result.status === "MATCH" ||
                  result.status === "MULTIPLE_MATCHES") && (
                  <div className="size-recommendation-actions">
                    {result.candidates.map((size) => (
                      <button
                        key={size}
                        type="button"
                        disabled={loading || savingProfile}
                        onClick={() => void applySize(size)}
                      >
                        Chọn size {size}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
            <details>
              <summary>
                Bảng size của mẫu áo (phiên bản {chart.version})
              </summary>
              <p>
                {chart.measurementType === "BODY"
                  ? "Số đo cơ thể phù hợp"
                  : "Số đo thực tế của áo"}
                . Chiều dài: {chart.lengthUnit.toLowerCase()}, cân nặng:{" "}
                {chart.weightUnit.toLowerCase()}.
              </p>
              <ProductSizeChartTable chart={chart} />
            </details>
          </>
        )}
      </div>
    </Modal>
  );
}
