import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, RefreshCw, UploadCloud } from "lucide-react";
import { dimensions, fitDimensions, sizeChartApi } from "./sizeChartApi";
import type { ChartInput, ChartResponse, Dimension, Fit } from "./sizeChartApi";
import {
  cleanChart,
  fits,
  formatRange,
  labels,
  rawRows,
  rangeBounds,
  serializeFitRules,
  serializeRows,
  withRangeBound,
} from "./sizeChartHelpers";
import type { RawRow } from "./sizeChartHelpers";
import "./sizeChart.css";

const empty: ChartInput = {
  source: "MANUAL",
  measurementType: "BODY",
  lengthUnit: "CM",
  weightUnit: "KG",
  rows: [],
  requiredMeasurements: [],
  fitRules: [],
};
const emptyRules = () => ({
  SLIM: { chest: "", waist: "", hip: "", shoulder: "", bicep: "" },
  REGULAR: { chest: "", waist: "", hip: "", shoulder: "", bicep: "" },
  COMFORT: { chest: "", waist: "", hip: "", shoulder: "", bicep: "" },
});
type Props = { productId: string; onPendingChange: (pending: boolean) => void };
function RangePair({ value, label, onChange }: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const [min, max] = rangeBounds(value);
  const invalid = min !== "" && max !== "" && Number(min) >= Number(max);
  return <div className={`size-chart-range-pair${invalid ? " is-invalid" : ""}`}>
    <input type="number" step="any" aria-label={`${label} từ`} aria-invalid={invalid} placeholder="Từ" value={min}
      onChange={(event) => onChange(withRangeBound(value, "min", event.target.value))} />
    <span aria-hidden="true">–</span>
    <input type="number" step="any" aria-label={`${label} đến`} aria-invalid={invalid} placeholder="Đến" value={max}
      onChange={(event) => onChange(withRangeBound(value, "max", event.target.value))} />
    {invalid && <small>Từ phải nhỏ hơn Đến</small>}
  </div>;
}
function LengthField({ value, label, onChange }: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const [rangeMode, setRangeMode] = useState(value.includes(".."));
  return <div className="size-chart-length-field">
    {rangeMode
      ? <RangePair value={value} label={label} onChange={onChange} />
      : <input type="number" step="any" min="0.01" max="1000" aria-label={label}
          placeholder="Một giá trị" value={value} onChange={(event) => onChange(event.target.value)} />}
    <button type="button" className="size-chart-length-mode" onClick={() => {
      setRangeMode(!rangeMode);
      onChange("");
    }}>{rangeMode ? "Dùng một giá trị" : "Dùng khoảng"}</button>
  </div>;
}
export function SizeChartEditor({ productId, onPendingChange }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const uploadInFlightRef = useRef(false);
  const [chart, setChart] = useState<ChartInput>(empty);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [version, setVersion] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [staleConfirmed, setStaleConfirmed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [rules, setRules] = useState(emptyRules);
  const [stretch, setStretch] = useState({ chest: "", waist: "", hip: "", shoulder: "", bicep: "" });
  const [sizes, setSizes] = useState<string[]>([]);
  const visibleRows = rows.length
    ? rows
    : chart.rows.length
      ? rawRows(chart.rows.map((row) => row.size), chart)
      : [];

  const apply = useCallback((response: ChartResponse, fallbackSizes: string[]) => {
    const stored = response.sizeChart;
    const productSizes = response.sizes ?? fallbackSizes;
    // A saved OCR draft must stay visible even if a stale client had no sizes yet.
    // Only server-provided product sizes are used to decide whether confirmation is allowed.
    const displaySizes = productSizes.length
      ? productSizes
      : stored?.rows.map((row) => row.size) ?? [];
    setSizes(productSizes);
    const persistedChart = stored ? cleanChart(stored) : { ...empty };
    // The backend discards an image when OCR fails. Keep the image picker open
    // locally so the provider can retry without changing the saved chart.
    setChart(response.extractionFailed ? { ...persistedChart, source: "IMAGE" } : persistedChart);
    setRows(rawRows(displaySizes, stored));
    setVersion(response.version);
    setConfirmed(stored?.status === "CONFIRMED" && response.ready !== false);
    setStaleConfirmed(stored?.status === "CONFIRMED" && response.ready === false);
    setDirty(false);
    setWarnings(response.warnings ?? []);
    setExtractionFailed(response.extractionFailed === true);
    const nextRules = emptyRules();
    for (const rule of stored?.fitRules ?? [])
      for (const key of fitDimensions)
        nextRules[rule.preference][key] = formatRange(rule[key]);
    setRules(nextRules);
    setStretch(
      Object.fromEntries(
        fitDimensions.map((key) => [
          key,
          stored?.stretchAllowanceCm?.[key] != null
            ? String(stored.stretchAllowanceCm[key])
            : "",
        ]),
      ) as typeof stretch,
    );
  }, []);
  // Fetch the persisted sizes, not unsaved variant edits elsewhere in the wizard.
  useEffect(() => {
    let cancelled = false;
    sizeChartApi
      .get(productId)
      .then((response) => {
        if (cancelled) return;
        const persistedSizes = response.sizes;
        apply(response, persistedSizes);
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Không tải được bảng size.",
          );
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, apply]);
  useEffect(() => {
    onPendingChange(dirty || busy || !loaded);
  }, [dirty, busy, loaded, onPendingChange]);
  const edit = () => {
    setDirty(true);
    setError("");
  };
  const run = async (action: () => Promise<ChartResponse>) => {
    setBusy(true);
    setError("");
    try {
      const response = await action();
      apply(response, response.sizes ?? sizes);
      return response;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không lưu được bảng size. Hãy tải lại nếu phiên bản đã thay đổi.",
      );
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      const stretchAllowanceCm = Object.fromEntries(
        fitDimensions.flatMap((key) => {
          const value = stretch[key].trim();
          if (!value) return [];
          const number = Number(value.replace(",", "."));
          if (!Number.isFinite(number) || number < 0)
            throw new Error("Độ giãn phải là số cm không âm.");
          return [[key, number]];
        }),
      );
      return sizeChartApi.save(
        productId,
        version,
        cleanChart({
          ...chart,
          rows: serializeRows(visibleRows),
          fitRules: serializeFitRules(rules),
          stretchAllowanceCm,
        }),
      );
    });

  const uploadImage = (file?: File) => {
    if (!file || uploadInFlightRef.current) return;
    if (dirty) {
      setError("Bảng đang có thay đổi chưa lưu. Hãy lưu bảng nháp hoặc tải lại bảng đã lưu trước khi đọc ảnh khác, để không mất số đo bạn vừa sửa.");
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size === 0 ||
      file.size > 8 * 1024 * 1024
    ) {
      setError("Chọn ảnh JPG, PNG hoặc WebP không quá 8 MB.");
      return;
    }
    uploadInFlightRef.current = true;
    setImageUploading(true);
    void run(async () => {
      const conflictMessage = "Bảng size đã thay đổi ở nơi khác. Mình đã tải phiên bản mới nhất; hãy kiểm tra rồi chọn ảnh lại.";
      const latest = await sizeChartApi.get(productId);
      if (latest.version !== version) {
        if (!dirty) apply(latest, latest.sizes ?? sizes);
        throw new Error(dirty
          ? "Bảng size đã thay đổi. Bạn đang có chỉnh sửa chưa lưu; hãy kiểm tra và bấm Tải lại bảng đã lưu trước khi chọn ảnh lại."
          : conflictMessage);
      }
      let uploaded: ChartResponse;
      try {
        uploaded = await sizeChartApi.upload(productId, version, file, chart);
      } catch (error) {
        // A concurrent write can still happen between the preflight read and POST.
        // Keep the server's version check; never silently retry over newer data.
        let current: ChartResponse | undefined;
        try {
          current = await sizeChartApi.get(productId);
        } catch { /* Keep the original upload error if refresh is unavailable. */ }
        if (current && current.version !== version) {
          if (!dirty) apply(current, current.sizes ?? sizes);
          throw new Error(dirty
            ? "Bảng size đã thay đổi. Bạn đang có chỉnh sửa chưa lưu; hãy kiểm tra và bấm Tải lại bảng đã lưu trước khi chọn ảnh lại."
            : conflictMessage, { cause: error });
        }
        throw error;
      }
      if (uploaded.extractionFailed) return uploaded;
      // The saved chart is authoritative. Re-read it after OCR so a response
      // missing rows/sizes cannot leave a successful extraction invisible.
      try {
        const saved = await sizeChartApi.get(productId);
        if (saved.version === uploaded.version)
          return {
            ...saved,
            warnings: uploaded.warnings,
            extractionFailed: false,
          };
      } catch {
        // Keep the successful upload response if the follow-up read fails.
      }
      return uploaded;
    })
      .then((response) => {
        if (!response || response.extractionFailed || !response.sizeChart?.rows.length) return;
        requestAnimationFrame(() => reviewRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" }));
      })
      .finally(() => {
        uploadInFlightRef.current = false;
        setImageUploading(false);
      });
  };

  const required = chart.requiredMeasurements;
  const hasCircumference = required.some((key) =>
    key === "chest" || key === "waist" || key === "hip",
  );
  const missingSize = sizes.find((size) => !chart.rows.some((row) => row.size === size));
  const missingMeasurement = chart.rows.find((row) =>
    required.some((key) => !row[key]),
  );
  const missingFitRule = chart.fitRules?.find((rule) =>
    fitDimensions.some((key) => chart.rows.some((row) => row[key]) && !rule[key]),
  );
  const confirmBlockReason = !sizes.length
    ? "Sản phẩm chưa có size đã lưu. Hãy lưu biến thể và tải lại bảng size."
    : !chart.rows.length || missingSize
    ? "Bảng cần có số đo cho từng size đã chọn của sản phẩm."
    : !required.length || (!hasCircumference && !(required.includes("height") && required.includes("weight")))
      ? "Hãy chọn ít nhất một vòng Ngực/Eo/Mông, hoặc cả Chiều cao và Cân nặng trong phần Số đo bắt buộc khi tư vấn."
      : missingMeasurement
        ? `Size ${missingMeasurement.size} còn thiếu một số đo bắt buộc đã chọn.`
        : chart.measurementType === "GARMENT" && !chart.fitRules?.length
          ? "Bảng số đo áo cần quy tắc độ cử động do cửa hàng khai báo."
          : chart.measurementType === "GARMENT" && missingFitRule
            ? `Kiểu mặc ${fits[missingFitRule.preference]} còn thiếu độ cử động cho một số số đo áo.`
          : "";

  return (
    <section
      className="size-chart-editor"
      aria-label="Bảng size riêng của sản phẩm"
    >
      <div className="size-chart-header">
        <div>
          <h4>Bảng size của mẫu áo dài</h4>
          <p>Nhập khoảng số đo của từng size hoặc tải ảnh để AI trích xuất. Khách chỉ nhận tư vấn sau khi bạn xác nhận.</p>
        </div>
        <p role="status" className={`size-chart-status ${confirmed && !dirty ? "confirmed" : "draft"}`}>
          {busy ? <RefreshCw size={15} className="size-chart-spin" aria-hidden="true" />
            : confirmed && !dirty ? <CheckCircle2 size={15} aria-hidden="true" />
              : <AlertCircle size={15} aria-hidden="true" />}
          <span>{busy ? "Đang xử lý…" : staleConfirmed
            ? "Bảng đã xác nhận không còn phù hợp với các size hiện tại; hãy cập nhật rồi xác nhận lại."
            : dirty && confirmed
            ? "Có thay đổi chưa lưu; bảng đã xác nhận trước đó vẫn được giữ nguyên."
            : extractionFailed
            ? confirmed && !dirty ? "Ảnh mới đọc lỗi; bảng size cũ vẫn đã xác nhận." : "Ảnh mới đọc lỗi; chưa có bảng size được xác nhận."
            : confirmed && !dirty ? "Đã xác nhận" : "Chưa xác nhận — khách chưa thể dùng bảng này để tư vấn."}</span>
        </p>
      </div>
      {error && (
        <p role="alert" className="size-chart-error">
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="size-chart-warnings">
          {warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}
      <fieldset disabled={busy || !loaded}>
        <div className="size-chart-controls">
          <label>
            Nguồn bảng
            <select
              value={chart.source}
              onChange={(e) => {
                // Selecting the image picker alone does not persist or discard
                // the current chart. The upload action owns that transition.
                if (e.target.value !== "IMAGE") edit();
                else setError("");
                setChart({
                  ...chart,
                  source: e.target.value as ChartInput["source"],
                  imageUrl: undefined,
                });
              }}
            >
              <option value="MANUAL">Nhập tay</option>
              <option value="IMAGE">Đọc từ ảnh</option>
            </select>
          </label>
          <label>
            Loại số đo
            <select
              value={chart.measurementType}
              onChange={(e) => {
                edit();
                setChart({
                  ...chart,
                  measurementType: e.target
                    .value as ChartInput["measurementType"],
                });
              }}
            >
              <option value="BODY">Số đo cơ thể phù hợp</option>
              <option value="GARMENT">Số đo thực tế của áo</option>
            </select>
          </label>
          <label>
            Đơn vị chiều dài
            <select
              value={chart.lengthUnit}
              onChange={(e) => {
                edit();
                setChart({
                  ...chart,
                  lengthUnit: e.target.value as ChartInput["lengthUnit"],
                });
              }}
            >
              <option value="CM">cm</option>
              <option value="IN">inch</option>
            </select>
          </label>
          <label>
            Đơn vị cân nặng
            <select
              value={chart.weightUnit}
              onChange={(e) => {
                edit();
                setChart({
                  ...chart,
                  weightUnit: e.target.value as ChartInput["weightUnit"],
                });
              }}
            >
              <option value="KG">kg</option>
              <option value="LB">lb</option>
            </select>
          </label>
        </div>
        <p className="size-chart-field-note">
          Đổi đơn vị không tự đổi các số đã nhập. Ngực/eo/mông là số đo cả vòng,
          không phải chiều ngang áo.
        </p>
        {chart.source === "IMAGE" && (
          <div className="size-chart-image-section" aria-busy={imageUploading}>
            <div className="size-chart-image-heading">
              <span className="size-chart-image-heading-icon"><ImagePlus size={20} aria-hidden="true" /></span>
              <div>
                <strong>Ảnh bảng size của mẫu áo</strong>
                <p>AI đọc ảnh một lần khi tải lên; bạn kiểm tra các khoảng số đo bên dưới trước khi xác nhận.</p>
              </div>
              {chart.rows.length > 0 && (
                <button type="button" className="size-chart-review-link"
                  onClick={() => reviewRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" })}>
                  Xem {chart.rows.length} size đã đọc ↓
                </button>
              )}
            </div>
            <div className="size-chart-image-content">
              <input
                ref={imageInputRef}
                className="size-chart-file-input"
                type="file"
                tabIndex={-1}
                aria-label="Tải ảnh bảng size (JPG, PNG, WebP; tối đa 8 MB)"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  uploadImage(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                className="size-chart-upload-button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageUploading}
              >
                <span className="size-chart-upload-icon"><UploadCloud size={30} strokeWidth={1.8} aria-hidden="true" /></span>
                <strong>{imageUploading ? "Đang tải và đọc ảnh…" : extractionFailed ? "Thử lại với ảnh" : chart.imageUrl ? "Chọn ảnh khác" : "Chọn ảnh bảng size"}</strong>
                <span>JPG, PNG hoặc WebP · tối đa 8 MB</span>
              </button>
              {chart.imageUrl && (
                <a className="size-chart-image-preview" href={chart.imageUrl} target="_blank" rel="noreferrer">
                  <img src={chart.imageUrl} alt="Ảnh bảng size nguồn để kiểm tra số liệu" />
                  <span>Xem ảnh đã tải</span>
                </a>
              )}
            </div>
            <p className={`size-chart-image-footnote${extractionFailed ? " is-error" : ""}`}>
              {extractionFailed
                ? `${warnings[0] ?? "AI chưa đọc được số đo từ ảnh."} ${chart.imageUrl ? "Ảnh đang hiển thị là ảnh cũ." : "Ảnh vừa chọn chưa được lưu."}`
                : chart.imageUrl
                  ? "Ảnh đã lưu. Hãy đối chiếu từng khoảng số đo với ảnh nguồn; tải ảnh khác sẽ thay dữ liệu trích xuất trong bản nháp."
                  : "Ảnh rõ chữ, chụp thẳng bảng và có đơn vị đo sẽ giúp AI đọc chính xác hơn."}
            </p>
          </div>
        )}
        <div className="size-chart-data-heading" ref={reviewRef}>
          <h5>Kiểm tra số đo theo từng size</h5>
          {chart.source === "IMAGE" && chart.imageUrl && !extractionFailed && (
            <p>{visibleRows.length > 0
              ? `Đã có ${visibleRows.length} dòng size để kiểm tra và chỉnh sửa.`
              : "Ảnh đã lưu nhưng chưa hiển thị dòng size nào. Hãy bấm Tải lại bảng đã lưu; nếu vẫn trống, tải ảnh lại hoặc nhập tay."}</p>
          )}
          <p>
            {chart.source === "IMAGE" && !chart.imageUrl && visibleRows.some((row) => dimensions.some((key) => row[key]))
              ? "Đây là số đo từ bảng đã lưu trước đó. Hãy chọn ảnh mới để AI cập nhật dữ liệu rồi kiểm tra lại. "
              : chart.source === "IMAGE" ? "AI có thể đọc sai ảnh; hãy đối chiếu từng số đo với ảnh nguồn. " : ""}
            Ngực, eo, mông, chiều cao và cân nặng nhập từ <strong>Từ</strong> đến <strong>Đến</strong>.
            Dài áo có thể là một giá trị chính xác như trên ảnh hoặc một khoảng. Để trống nếu chưa biết.
          </p>
        </div>
        {extractionFailed && (
          <p className="size-chart-extraction-hint" role="alert">
            {warnings[0] ?? "AI chưa điền được số đo từ ảnh."} {visibleRows.some((row) => dimensions.some((key) => row[key]))
              ? "Các số đo đã lưu trước đó vẫn còn; hãy kiểm tra trước khi xác nhận hoặc thử ảnh mới sau."
              : "Chưa có số đo để tư vấn; hãy thử ảnh mới sau hoặc nhập số đo thủ công."}
          </p>
        )}
        {loaded && !sizes.length && (
          <p role="alert">Sản phẩm chưa có size. Hãy bổ sung biến thể trước.</p>
        )}
        <div className="vib92-size-review-list" aria-label="Các size cần kiểm tra">
          {visibleRows.map((row, index) => {
            const metric = (key: Dimension) => {
              const label = `${row.size} ${labels[key]}`;
              const update = (value: string) => {
                edit();
                setRows(visibleRows.map((entry, i) => i === index ? { ...entry, [key]: value } : entry));
              };
              return <div className="size-chart-metric" key={key}>
                <span className="size-chart-metric-label">{labels[key]} ({key === "weight" ? chart.weightUnit.toLowerCase() : chart.lengthUnit.toLowerCase()})</span>
                {key === "length"
                  ? <LengthField key={`${row.size}-${version}`} value={row.length} label={label} onChange={update} />
                  : <RangePair value={row[key]} label={label} onChange={update} />}
              </div>;
            };
            return <div className="vib92-size-review-card" key={row.size} role="group" aria-label={`Số đo size ${row.size}`}>
              <h6>Size <span>{row.size}</span></h6>
              <div className="size-chart-measurement-grid">
                {dimensions.filter((key) => key !== "shoulder" && key !== "bicep").map(metric)}
              </div>
              <details className="size-chart-extra-measurements" open={Boolean(row.shoulder || row.bicep)}>
                <summary>Vai và bắp tay (tùy chọn)</summary>
                <div className="size-chart-measurement-grid">
                  {(["shoulder", "bicep"] as const).map(metric)}
                </div>
              </details>
            </div>;
          })}
        </div>
        <fieldset>
          <legend>Số đo bắt buộc khi tư vấn</legend>
          <p>
            Chọn ít nhất một vòng hoặc cả chiều cao và cân nặng. Mỗi size phải
            có đủ các trường đã chọn.
          </p>
          <p>Ngang vai là chiều rộng từ vai này sang vai kia; bắp tay là số đo cả vòng. Hai trường này chỉ dùng khi mẫu áo và khách đều có số đo.</p>
          {chart.source === "IMAGE" && required.length > 0 && !confirmed && (
            <p className="size-chart-field-note">AI đã chọn sẵn các số đo có đủ ở mọi size; hãy đối chiếu với ảnh và chỉnh lại nếu cần.</p>
          )}
          {dimensions
            .filter(
              (key): key is Exclude<Dimension, "length"> => key !== "length",
            )
            .map((key) => (
              <label className="size-chart-check" key={key}>
                <input
                  type="checkbox"
                  checked={chart.requiredMeasurements.includes(key)}
                  onChange={(e) => {
                    edit();
                    setChart({
                      ...chart,
                      requiredMeasurements: e.target.checked
                        ? [...chart.requiredMeasurements, key]
                        : chart.requiredMeasurements.filter(
                            (value) => value !== key,
                          ),
                    });
                  }}
                />
                {labels[key]}
              </label>
            ))}
        </fieldset>
        {chart.measurementType === "GARMENT" && (
          <fieldset>
            <legend>Quy tắc độ vừa và co giãn do cửa hàng khai báo</legend>
            <p>
              Độ cử động = vòng áo − vòng cơ thể, luôn tính bằng cm. Chỉ khai
              báo kiểu mặc cửa hàng đã kiểm chứng; để trống kiểu chưa hỗ trợ.
              Với vai, lấy chiều ngang vai áo trừ chiều ngang vai cơ thể. Giá trị âm chỉ được dùng trong độ giãn được khai báo.
            </p>
            <div className="size-chart-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Kiểu mặc</th>
                    {fitDimensions.map((key) => (
                      <th key={key}>{labels[key]} (cm)</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(fits) as Fit[]).map((fit) => (
                    <tr key={fit}>
                      <th>{fits[fit]}</th>
                      {fitDimensions.map((key) => (
                        <td key={key}>
                          <RangePair
                            label={`${fits[fit]} độ cử động ${labels[key]}`}
                            value={rules[fit][key]}
                            onChange={(value) => {
                              edit();
                              setRules({
                                ...rules,
                                [fit]: { ...rules[fit], [key]: value },
                              });
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th>Độ giãn thêm tối đa</th>
                    {fitDimensions.map((key) => (
                      <td key={key}>
                        <input
                          aria-label={`Độ giãn ${labels[key]}`}
                          placeholder="Chưa khai báo"
                          value={stretch[key]}
                          onChange={(e) => {
                            edit();
                            setStretch({ ...stretch, [key]: e.target.value });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </fieldset>
        )}
        <div className="size-chart-actions">
          <button type="button" className="size-chart-save-button" disabled={chart.source === "IMAGE" && !chart.imageUrl} onClick={() => void save()}>
            Lưu bảng nháp
          </button>
          <button
            type="button"
            className="size-chart-confirm-button"
            disabled={dirty || confirmed || Boolean(confirmBlockReason)}
            onClick={() =>
              void run(() => sizeChartApi.confirm(productId, version))
            }
          >
            Tôi đã kiểm tra — xác nhận bảng size
          </button>
        </div>
        {dirty && (
          <p>Có thay đổi chưa lưu. Hãy lưu bảng nháp rồi xác nhận lại.</p>
        )}
        {loaded && !confirmed && confirmBlockReason && (
          <p className="size-chart-confirm-hint" role="status">{confirmBlockReason}</p>
        )}
      </fieldset>
      <button
        type="button"
        className="size-chart-reload-button"
        disabled={busy}
        onClick={() => {
          if (
            !dirty ||
            window.confirm(
              "Tải lại sẽ bỏ các thay đổi bảng size chưa lưu. Tiếp tục?",
            )
          ) {
            setLoaded(false);
            void run(async () => {
              const response = await sizeChartApi.get(productId);
              setLoaded(true);
              return response;
            });
          }
        }}
      >
        <RefreshCw size={14} aria-hidden="true" /> Tải lại bảng đã lưu
      </button>
    </section>
  );
}
