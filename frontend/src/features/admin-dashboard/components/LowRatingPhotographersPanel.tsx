import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Camera,
  CheckCircle2,
  MapPin,
  MessageSquareWarning,
  Search,
  Star,
  X,
} from "lucide-react";
import { AdminReloadButton } from "../../../pages/admin/components/AdminReloadButton";
import { includesVietnamese } from "../../../utils/vietnameseUtils";
import { adminStatsApi } from "../api/adminStatsApi";
import type { LowRatingPhotographerReport } from "../types";
import "./adminDashboardPanels.css";

const THRESHOLD_OPTIONS = [
  { value: 2.5, label: "Dưới 2.5 sao (Rất thấp)" },
  { value: 3.0, label: "Dưới 3.0 sao" },
  { value: 3.5, label: "Dưới 3.5 sao (Mặc định)" },
  { value: 4.0, label: "Dưới 4.0 sao" },
];

const formatReviewDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
};

export function LowRatingPhotographersPanel() {
  const [data, setData] = useState<LowRatingPhotographerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [threshold, setThreshold] = useState<number>(3.5);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "CRITICAL" | "WARNING">("ALL");

  const fetchReport = useCallback(async (targetThreshold: number) => {
    setLoading(true);
    setError(null);
    try {
      const report = await adminStatsApi.getLowRatingPhotographers(targetThreshold);
      setData(report);
    } catch {
      setError("Không thể tải báo cáo chất lượng photographer.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const report = await adminStatsApi.getLowRatingPhotographers(threshold);
        if (active) setData(report);
      } catch {
        if (active) setError("Không thể tải báo cáo chất lượng photographer.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [threshold]);

  const rows = useMemo(() => data?.data ?? [], [data]);

  const cities = useMemo(() => {
    const unique = new Set<string>();
    rows.forEach((item) => {
      if (item.city && item.city.trim()) unique.add(item.city.trim());
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

  const summary = useMemo(() => {
    const total = rows.length;
    const criticalCount = rows.filter((r) => r.averageRating <= 2.0).length;
    const totalNegativeReviews = rows.reduce((sum, r) => sum + (r.negativeReviews?.length ?? 0), 0);
    const totalReviewsSum = rows.reduce((sum, r) => sum + (r.totalReviews ?? 0), 0);
    const avgGroupRating =
      total > 0
        ? Number((rows.reduce((sum, r) => sum + r.averageRating, 0) / total).toFixed(1))
        : 0;

    return {
      total,
      criticalCount,
      totalNegativeReviews,
      totalReviewsSum,
      avgGroupRating,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      if (cityFilter !== "ALL" && (item.city?.trim() || "") !== cityFilter) {
        return false;
      }
      if (severityFilter === "CRITICAL" && item.averageRating > 2.0) {
        return false;
      }
      if (severityFilter === "WARNING" && item.averageRating <= 2.0) {
        return false;
      }
      if (searchQuery.trim()) {
        const matchName = includesVietnamese(item.businessName, searchQuery);
        const matchCity = includesVietnamese(item.city || "", searchQuery);
        const matchReview = (item.negativeReviews ?? []).some((rev) =>
          includesVietnamese(rev.comment || "", searchQuery),
        );
        if (!matchName && !matchCity && !matchReview) return false;
      }
      return true;
    });
  }, [rows, cityFilter, severityFilter, searchQuery]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || cityFilter !== "ALL" || severityFilter !== "ALL";

  const clearFilters = () => {
    setSearchQuery("");
    setCityFilter("ALL");
    setSeverityFilter("ALL");
  };

  return (
    <section className="lrp-container">
      {/* 1. Header */}
      <div className="lrp-header">
        <div className="lrp-header__text">
          <div className="lrp-header__title-row">
            <h2 className="lrp-header__title">Cảnh báo chất lượng photographer</h2>
            <span className="lrp-threshold-pill">
              Ngưỡng &lt; {(data?.threshold ?? threshold).toFixed(1)}★
            </span>
          </div>
          <p className="lrp-header__subtitle">
            Theo dõi các nhiếp ảnh gia có điểm đánh giá trung bình thấp và các phản hồi tiêu cực cần rà soát chất lượng dịch vụ.
          </p>
        </div>

        <div className="lrp-header__actions">
          <label className="lrp-threshold-control">
            <span>Ngưỡng cảnh báo</span>
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="lrp-select"
            >
              {THRESHOLD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <AdminReloadButton
            onClick={() => fetchReport(threshold)}
            isLoading={loading}
          />
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="lrp-kpi-grid">
        <div className="lrp-kpi-card">
          <div className="lrp-kpi-card__top">
            <span className="lrp-kpi-card__label">Photographer dưới ngưỡng</span>
            <span className="lrp-kpi-icon lrp-kpi-icon--burgundy">
              <Camera size={16} />
            </span>
          </div>
          <div className="lrp-kpi-card__value lrp-kpi-card__value--burgundy">
            {summary.total}
          </div>
          <span className="lrp-kpi-card__sub">
            Điểm TB thấp hơn {(data?.threshold ?? threshold).toFixed(1)} sao
          </span>
        </div>

        <div className="lrp-kpi-card">
          <div className="lrp-kpi-card__top">
            <span className="lrp-kpi-card__label">Mức nghiêm trọng (≤ 2.0★)</span>
            <span className="lrp-kpi-icon lrp-kpi-icon--red">
              <AlertOctagon size={16} />
            </span>
          </div>
          <div className="lrp-kpi-card__value lrp-kpi-card__value--red">
            {summary.criticalCount}
          </div>
          <span className="lrp-kpi-card__sub">Ưu tiên liên hệ &amp; rà soát ngay</span>
        </div>

        <div className="lrp-kpi-card">
          <div className="lrp-kpi-card__top">
            <span className="lrp-kpi-card__label">Đánh giá tiêu cực</span>
            <span className="lrp-kpi-icon lrp-kpi-icon--amber">
              <MessageSquareWarning size={16} />
            </span>
          </div>
          <div className="lrp-kpi-card__value lrp-kpi-card__value--amber">
            {summary.totalNegativeReviews}
          </div>
          <span className="lrp-kpi-card__sub">Phản hồi từ 1★ đến 3★ được ghi nhận</span>
        </div>

        <div className="lrp-kpi-card">
          <div className="lrp-kpi-card__top">
            <span className="lrp-kpi-card__label">Điểm TB nhóm cảnh báo</span>
            <span className="lrp-kpi-icon lrp-kpi-icon--slate">
              <Star size={16} />
            </span>
          </div>
          <div className="lrp-kpi-card__value">
            {summary.avgGroupRating > 0 ? `${summary.avgGroupRating.toFixed(1)} / 5` : "—"}
          </div>
          <span className="lrp-kpi-card__sub">
            Trên tổng {summary.totalReviewsSum} lượt đánh giá
          </span>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="lrp-toolbar">
        <div className="lrp-search-box">
          <Search size={15} color="#881337" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên photographer, khu vực hoặc nội dung đánh giá..."
            className="lrp-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="lrp-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="lrp-toolbar__filters">
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="lrp-select"
            aria-label="Lọc theo khu vực"
          >
            <option value="ALL">Tất cả khu vực</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) =>
              setSeverityFilter(e.target.value as "ALL" | "CRITICAL" | "WARNING")
            }
            className="lrp-select"
            aria-label="Lọc theo mức độ cảnh báo"
          >
            <option value="ALL">Tất cả mức độ</option>
            <option value="CRITICAL">Nghiêm trọng (≤ 2.0★)</option>
            <option value="WARNING">Cần theo dõi (&gt; 2.0★)</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              className="lrp-reset-btn"
              onClick={clearFilters}
            >
              Xóa lọc
            </button>
          )}

          <span className="lrp-result-count">
            Hiển thị <strong>{filteredRows.length}</strong> / {rows.length} photographer
          </span>
        </div>
      </div>

      {/* 4. Error Banner */}
      {error && (
        <div className="lrp-error-banner" role="alert">
          <div className="lrp-error-banner__content">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="lrp-retry-btn"
            onClick={() => void fetchReport(threshold)}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 5. Main Table Card */}
      <div className="lrp-table-card">
        {loading ? (
          <div className="lrp-state-box">
            <div className="lrp-spinner" />
            <p>Đang tải báo cáo chất lượng photographer...</p>
          </div>
        ) : filteredRows.length > 0 ? (
          <div className="lrp-table-scroll">
            <table className="lrp-table">
              <thead>
                <tr>
                  <th style={{ width: "20%" }}>Photographer</th>
                  <th style={{ width: "15%" }}>Khu vực</th>
                  <th style={{ width: "11%", textAlign: "center" }}>Điểm TB</th>
                  <th style={{ width: "13%", textAlign: "center" }}>Mức cảnh báo</th>
                  <th style={{ width: "10%", textAlign: "center" }}>Tổng đánh giá</th>
                  <th style={{ width: "31%" }}>Đánh giá tiêu cực</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((photographer) => {
                  const isCritical = photographer.averageRating <= 2.0;
                  const shortCode = `#PG${photographer.photographerId.slice(-6).toUpperCase()}`;

                  return (
                    <tr key={photographer.photographerId}>
                      <td>
                        <div className="lrp-photographer-cell">
                          <span className="lrp-photographer-name">
                            {photographer.businessName}
                          </span>
                          <span className="lrp-photographer-code">{shortCode}</span>
                        </div>
                      </td>

                      <td>
                        <div className="lrp-city-cell">
                          <MapPin size={13} color="#9CA3AF" />
                          <span>{photographer.city || "Chưa cập nhật"}</span>
                        </div>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`lrp-rating-badge ${
                            isCritical
                              ? "lrp-rating-badge--critical"
                              : "lrp-rating-badge--warning"
                          }`}
                        >
                          <Star size={12} fill="currentColor" />
                          <span>{photographer.averageRating.toFixed(1)} / 5</span>
                        </span>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`lrp-severity-pill ${
                            isCritical
                              ? "lrp-severity-pill--critical"
                              : "lrp-severity-pill--warning"
                          }`}
                        >
                          {isCritical ? "Nghiêm trọng" : "Cần theo dõi"}
                        </span>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <div className="lrp-review-count">
                          <strong>{photographer.totalReviews}</strong>
                          <span>
                            {photographer.negativeReviews.length} tiêu cực
                          </span>
                        </div>
                      </td>

                      <td>
                        {photographer.negativeReviews.length ? (
                          <div className="lrp-review-list">
                            {photographer.negativeReviews.map((review) => {
                              const dateLabel = formatReviewDate(review.createdAt);
                              return (
                                <div key={review.reviewId} className="lrp-review-item">
                                  <span className="lrp-review-star">
                                    {review.rating}★
                                  </span>
                                  <div className="lrp-review-body">
                                    <p className="lrp-review-comment">
                                      {review.comment || "Không có nội dung nhận xét"}
                                    </p>
                                    {dateLabel && (
                                      <span className="lrp-review-date">{dateLabel}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="lrp-muted-text">
                            Không có nhận xét tiêu cực
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="lrp-state-box">
            <CheckCircle2 size={34} color={hasActiveFilters ? "#9CA3AF" : "#059669"} />
            <h3>
              {hasActiveFilters
                ? "Không tìm thấy photographer phù hợp bộ lọc"
                : "Không có photographer nào dưới ngưỡng đánh giá"}
            </h3>
            <p>
              {hasActiveFilters
                ? "Thử thay đổi từ khóa tìm kiếm, khu vực hoặc mức độ cảnh báo."
                : `Tất cả photographer đang hoạt động đều đạt điểm trung bình từ ${(data?.threshold ?? threshold).toFixed(1)} sao trở lên.`}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="lrp-reset-btn"
                onClick={clearFilters}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
