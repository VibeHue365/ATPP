import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Download,
  UserPlus,
  Users,
} from "lucide-react";
import { adminStatsApi } from "../api/adminStatsApi";
import type { UserGrowthMetrics } from "../types";
import { AdminReloadButton } from "../../../pages/admin/components/AdminReloadButton";
import { computeNiceScale } from "../utils/chartScale";
import "./adminDashboardPanels.css";

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const getIctDateKey = (offsetDays = 0) =>
  new Date(Date.now() + ICT_OFFSET_MS + offsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

const formatViDate = (isoDate?: string): string => {
  if (!isoDate) return "";
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return isoDate;
  const [y, m, d] = parts;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
};

const formatShortViDate = (isoDate: string): string => {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate.slice(5);
  return `${parts[2]}/${parts[1]}`;
};

const formatViWeekday = (isoDate: string): string => {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "";
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const labels = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  return labels[date.getDay()] ?? "";
};

const PRESET_RANGES = [
  { days: 7, label: "7 ngày" },
  { days: 14, label: "14 ngày" },
  { days: 30, label: "30 ngày" },
];

export function UserGrowthPanel() {
  const defaultTo = useMemo(() => getIctDateKey(0), []);
  const defaultFrom = useMemo(() => getIctDateKey(-6), []);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [appliedRange, setAppliedRange] = useState({ from: defaultFrom, to: defaultTo });
  const [data, setData] = useState<UserGrowthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const fetchGrowth = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminStatsApi.getUserGrowth(startDate, endDate);
      setData(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể tải báo cáo tăng trưởng.",
      );
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
        const result = await adminStatsApi.getUserGrowth(appliedRange.from, appliedRange.to);
        if (active) setData(result);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Không thể tải báo cáo tăng trưởng.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [appliedRange.from, appliedRange.to]);

  const handleApply = () => {
    if (from === appliedRange.from && to === appliedRange.to) {
      void fetchGrowth(from, to);
    } else {
      setAppliedRange({ from, to });
    }
  };

  const handleSelectPreset = (days: number) => {
    const nextTo = getIctDateKey(0);
    const nextFrom = getIctDateKey(-(days - 1));
    setFrom(nextFrom);
    setTo(nextTo);
    setAppliedRange({ from: nextFrom, to: nextTo });
  };

  const download = async () => {
    setExporting(true);
    setError(null);
    try {
      await adminStatsApi.exportUserGrowth(from, to);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể xuất Excel.",
      );
    } finally {
      setExporting(false);
    }
  };

  const rows = useMemo(() => data?.data ?? [], [data]);

  const rawMax = useMemo(
    () =>
      Math.max(
        0,
        ...rows.flatMap((row) => [row.newUsers, row.dau]),
      ),
    [rows],
  );

  const yScale = useMemo(
    () => computeNiceScale(rawMax, 4, { integerOnly: true, minMax: 4 }),
    [rawMax],
  );

  const activePresetDays = useMemo(() => {
    if (to !== defaultTo) return null;
    for (const preset of PRESET_RANGES) {
      if (from === getIctDateKey(-(preset.days - 1))) return preset.days;
    }
    return null;
  }, [from, to, defaultTo]);

  const summary = useMemo(() => {
    const totalNew = data?.totalNewUsers ?? rows.reduce((s, r) => s + r.newUsers, 0);
    const mau = data?.mau ?? 0;
    const latestDau = rows.at(-1)?.dau ?? 0;
    const avgDau = rows.length
      ? Number((rows.reduce((s, r) => s + r.dau, 0) / rows.length).toFixed(1))
      : 0;
    const avgNew = rows.length
      ? Number((totalNew / rows.length).toFixed(1))
      : 0;
    const stickiness = mau > 0 ? Number(((latestDau / mau) * 100).toFixed(1)) : 0;
    const peakDauRow = rows.reduce<(typeof rows)[number] | null>(
      (best, row) => (!best || row.dau > best.dau ? row : best),
      null,
    );
    return { totalNew, mau, latestDau, avgDau, avgNew, stickiness, peakDauRow };
  }, [data, rows]);

  return (
    <section className="ug-container">
      {/* 1. Header & Date Filter Bar */}
      <div className="ug-header">
        <div className="ug-header__text">
          <h2 className="ug-header__title">DAU / MAU và tăng trưởng người dùng</h2>
          <p className="ug-header__subtitle">
            Theo dõi số lượng tài khoản đăng ký mới, người dùng hoạt động theo ngày (DAU) và 30 ngày gần nhất (MAU).
          </p>
        </div>

        <div className="ug-controls">
          <div className="ug-presets" role="group" aria-label="Chọn nhanh khoảng thời gian">
            {PRESET_RANGES.map((preset) => (
              <button
                key={preset.days}
                type="button"
                className={`ug-preset-btn ${activePresetDays === preset.days ? "is-active" : ""}`}
                onClick={() => handleSelectPreset(preset.days)}
                disabled={loading}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="ug-date-group">
            <label className="ug-date-field">
              <span>Từ</span>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="ug-date-field">
              <span>Đến</span>
              <input
                type="date"
                value={to}
                min={from}
                max={defaultTo}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>

          <div className="ug-action-group">
            <button
              type="button"
              className="ug-btn ug-btn--primary"
              onClick={handleApply}
              disabled={loading}
            >
              Áp dụng
            </button>
            <button
              type="button"
              className="ug-btn ug-btn--outline"
              onClick={() => void download()}
              disabled={exporting || loading}
            >
              <Download size={14} />
              <span>{exporting ? "Đang xuất..." : "Xuất Excel"}</span>
            </button>
            <AdminReloadButton
              onClick={() => fetchGrowth(appliedRange.from, appliedRange.to)}
              isLoading={loading}
            />
          </div>
        </div>
      </div>

      {/* 2. Error Banner */}
      {error && (
        <div className="ug-error-banner" role="alert">
          <div className="ug-error-banner__content">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="ug-btn ug-btn--outline"
            onClick={() => void fetchGrowth(appliedRange.from, appliedRange.to)}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 3. Main Content */}
      {loading && !data ? (
        <div className="ug-loading-card">
          <div className="ug-spinner" />
          <p>Đang tải báo cáo tăng trưởng người dùng…</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="ug-kpi-grid">
            <article className="ug-kpi-card">
              <div className="ug-kpi-card__top">
                <span className="ug-kpi-card__label">Người dùng mới</span>
                <span className="ug-kpi-icon ug-kpi-icon--burgundy">
                  <UserPlus size={16} />
                </span>
              </div>
              <strong className="ug-kpi-card__value ug-kpi-card__value--burgundy">
                {summary.totalNew.toLocaleString("vi-VN")}
              </strong>
              <span className="ug-kpi-card__sub">
                {formatViDate(data?.from || appliedRange.from)} – {formatViDate(data?.to || appliedRange.to)} · TB {summary.avgNew}/ngày
              </span>
            </article>

            <article className="ug-kpi-card">
              <div className="ug-kpi-card__top">
                <span className="ug-kpi-card__label">MAU (30 ngày)</span>
                <span className="ug-kpi-icon ug-kpi-icon--olive">
                  <Users size={16} />
                </span>
              </div>
              <strong className="ug-kpi-card__value ug-kpi-card__value--olive">
                {summary.mau.toLocaleString("vi-VN")}
              </strong>
              <span className="ug-kpi-card__sub">
                Người dùng hoạt động 30 ngày gần nhất
              </span>
            </article>

            <article className="ug-kpi-card">
              <div className="ug-kpi-card__top">
                <span className="ug-kpi-card__label">DAU gần nhất</span>
                <span className="ug-kpi-icon ug-kpi-icon--gold">
                  <Activity size={16} />
                </span>
              </div>
              <strong className="ug-kpi-card__value ug-kpi-card__value--gold">
                {summary.latestDau.toLocaleString("vi-VN")}
              </strong>
              <span className="ug-kpi-card__sub">
                Tỷ lệ DAU/MAU: <strong>{summary.stickiness}%</strong> · TB {summary.avgDau} DAU/ngày
              </span>
            </article>
          </div>

          {/* Bar Chart Card */}
          <article className="ug-chart-card">
            <header className="ug-chart-card__header">
              <div>
                <h3>Tăng trưởng người dùng theo ngày</h3>
                <p>
                  So sánh số đăng ký mới và lượng người dùng hoạt động trong{" "}
                  <strong>{rows.length} ngày</strong>
                  {summary.peakDauRow && summary.peakDauRow.dau > 0
                    ? ` · Đỉnh DAU: ${summary.peakDauRow.dau.toLocaleString("vi-VN")} (${formatShortViDate(summary.peakDauRow.date)})`
                    : ""}
                </p>
              </div>
              <div className="ug-legend">
                <span>
                  <i style={{ background: "#b89047" }} /> Người dùng mới
                </span>
                <span>
                  <i style={{ background: "#4a0e17" }} /> DAU
                </span>
              </div>
            </header>

            <div className="ug-chart-frame">
              <div className="ug-yaxis" aria-hidden="true">
                {yScale.ticks.map((tick) => (
                  <span key={tick}>{tick.toLocaleString("vi-VN")}</span>
                ))}
              </div>
              <div className="ug-plot-scroll">
                <div
                  className="ug-bars-stage"
                  style={{
                    minWidth:
                      rows.length > 12 ? `${rows.length * 52}px` : "100%",
                  }}
                >
                  <div className="ug-gridlines" aria-hidden="true">
                    {yScale.ticks.map((tick) => (
                      <div key={tick} />
                    ))}
                  </div>

                  {rows.map((row, idx) => {
                    const newPct = (row.newUsers / (yScale.max || 1)) * 100;
                    const dauPct = (row.dau / (yScale.max || 1)) * 100;
                    const isHovered = hoveredIdx === idx;
                    return (
                      <div
                        className={`ug-bar-col ${isHovered ? "is-hovered" : ""}`}
                        key={row.date}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        {isHovered && (
                          <div className="ug-tooltip">
                            <strong>{formatViDate(row.date)}</strong>
                            <div>
                              <span className="ug-tooltip-dot" style={{ background: "#d4a853" }} />
                              Người mới: <b>{row.newUsers.toLocaleString("vi-VN")}</b>
                            </div>
                            <div>
                              <span className="ug-tooltip-dot" style={{ background: "#e11d48" }} />
                              DAU: <b>{row.dau.toLocaleString("vi-VN")}</b>
                            </div>
                          </div>
                        )}
                        <div className="ug-bar-pair">
                          <i
                            className={`ug-bar ug-bar--new ${row.newUsers === 0 ? "is-zero" : ""}`}
                            title={`${formatViDate(row.date)} · ${row.newUsers} người mới`}
                            style={{
                              height:
                                row.newUsers > 0
                                  ? `${Math.max(4, newPct)}%`
                                  : "3px",
                            }}
                          />
                          <b
                            className={`ug-bar ug-bar--dau ${row.dau === 0 ? "is-zero" : ""}`}
                            title={`${formatViDate(row.date)} · ${row.dau} DAU`}
                            style={{
                              height:
                                row.dau > 0
                                  ? `${Math.max(4, dauPct)}%`
                                  : "3px",
                            }}
                          />
                        </div>
                        <span className="ug-xlabel">
                          {formatShortViDate(row.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </article>

          {/* Detail Table Card */}
          <article className="ug-table-card">
            <header className="ug-table-card__header">
              <div className="ug-table-card__title">
                <Calendar size={15} color="#4a0e17" />
                <h3>Chi tiết tăng trưởng</h3>
              </div>
              <span className="ug-table-card__badge">
                {rows.length} ngày
              </span>
            </header>

            <div className="ug-table-scroll">
              <table className="ug-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th style={{ textAlign: "right" }}>Người dùng mới</th>
                    <th style={{ textAlign: "right" }}>DAU (Hoạt động)</th>
                    <th style={{ textAlign: "right" }}>Tỷ lệ DAU / MAU</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const ratio =
                      summary.mau > 0
                        ? Number(((row.dau / summary.mau) * 100).toFixed(1))
                        : 0;
                    return (
                      <tr key={row.date}>
                        <td>
                          <div className="ug-date-cell">
                            <strong>{formatViDate(row.date)}</strong>
                            <span>{formatViWeekday(row.date)}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            className={`ug-num-pill ${
                              row.newUsers > 0 ? "ug-num-pill--gold" : "ug-num-pill--muted"
                            }`}
                          >
                            {row.newUsers > 0
                              ? `+${row.newUsers.toLocaleString("vi-VN")}`
                              : "0"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            className={`ug-num-pill ${
                              row.dau > 0 ? "ug-num-pill--burgundy" : "ug-num-pill--muted"
                            }`}
                          >
                            {row.dau.toLocaleString("vi-VN")}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", color: "#6b7280", fontWeight: 600 }}>
                          {ratio}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td>Tổng cộng / Trung bình</td>
                      <td style={{ textAlign: "right" }}>
                        {summary.totalNew.toLocaleString("vi-VN")} mới
                      </td>
                      <td style={{ textAlign: "right" }}>
                        TB {summary.avgDau} / ngày
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {summary.stickiness}% (gần nhất)
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  );
}
