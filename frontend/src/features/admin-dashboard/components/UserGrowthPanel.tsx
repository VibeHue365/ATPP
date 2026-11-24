import { useEffect, useMemo, useState } from "react";
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

export function UserGrowthPanel() {
  const defaultTo = useMemo(() => getIctDateKey(0), []);
  const defaultFrom = useMemo(() => getIctDateKey(-6), []);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<UserGrowthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const rawMax = useMemo(
    () =>
      Math.max(
        0,
        ...(data?.data.flatMap((row) => [row.newUsers, row.dau]) ?? []),
      ),
    [data],
  );
  const yScale = useMemo(
    () => computeNiceScale(rawMax, 4, { integerOnly: true, minMax: 4 }),
    [rawMax],
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminStatsApi.getUserGrowth(from, to));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể tải báo cáo tăng trưởng.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

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

  const rows = data?.data ?? [];

  return (
    <section className="admin-dashboard-panel">
      <div className="admin-dashboard-panel__toolbar">
        <label>
          Từ{" "}
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Đến{" "}
          <input
            type="date"
            value={to}
            min={from}
            max={defaultTo}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <button type="button" onClick={() => void load()} disabled={loading}>
          Áp dụng
        </button>
        <button
          type="button"
          onClick={() => void download()}
          disabled={exporting || loading}
        >
          Xuất Excel
        </button>
        <AdminReloadButton onClick={() => void load()} isLoading={loading} />
      </div>
      {error && (
        <p className="admin-dashboard-panel__error" role="alert">
          {error}
        </p>
      )}
      {loading && !data ? (
        <p className="admin-dashboard-panel__loading">
          Đang tải báo cáo tăng trưởng…
        </p>
      ) : (
        <>
          <div className="admin-analytics-metrics admin-analytics-metrics--three">
            <article className="admin-analytics-metric admin-analytics-metric--burgundy">
              <span>Người dùng mới</span>
              <strong>
                {(data?.totalNewUsers ?? 0).toLocaleString("vi-VN")}
              </strong>
              <small>
                {data?.from} đến {data?.to}
              </small>
            </article>
            <article className="admin-analytics-metric admin-analytics-metric--olive">
              <span>MAU</span>
              <strong>{(data?.mau ?? 0).toLocaleString("vi-VN")}</strong>
              <small>Người dùng hoạt động 30 ngày gần nhất</small>
            </article>
            <article className="admin-analytics-metric admin-analytics-metric--gold">
              <span>DAU gần nhất</span>
              <strong>
                {(data?.data.at(-1)?.dau ?? 0).toLocaleString("vi-VN")}
              </strong>
              <small>Theo lần đăng nhập</small>
            </article>
          </div>
          <article className="admin-analytics-chart">
            <header>
              <h3>Tăng trưởng người dùng theo ngày</h3>
              <div className="admin-growth-legend">
                <span>
                  <i style={{ background: "#b89047" }} /> Người dùng mới
                </span>
                <span>
                  <i style={{ background: "#4a0e17" }} /> DAU
                </span>
              </div>
            </header>
            <div className="admin-growth-chart-frame">
              <div className="admin-growth-yaxis">
                {yScale.ticks.map((tick) => (
                  <span key={tick}>{tick.toLocaleString("vi-VN")}</span>
                ))}
              </div>
              <div className="admin-growth-plot-scroll">
                <div
                  className="admin-analytics-chart__bars"
                  style={{
                    minWidth:
                      rows.length > 12 ? `${rows.length * 46}px` : "100%",
                  }}
                >
                  <div className="admin-growth-gridlines" aria-hidden="true">
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
                        className="admin-growth-bar"
                        key={row.date}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        {isHovered && (
                          <div className="admin-growth-tooltip">
                            <strong>{row.date}</strong>
                            <div>Mới: {row.newUsers.toLocaleString("vi-VN")}</div>
                            <div>DAU: {row.dau.toLocaleString("vi-VN")}</div>
                          </div>
                        )}
                        <i
                          title={`${row.newUsers} người mới`}
                          style={{ height: row.newUsers > 0 ? `${Math.max(2, newPct)}%` : "0%" }}
                        />
                        <b
                          title={`${row.dau} DAU`}
                          style={{ height: row.dau > 0 ? `${Math.max(2, dauPct)}%` : "0%" }}
                        />
                        <span>{row.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </article>
          <article className="admin-analytics-table">
            <header>
              <h3>Chi tiết tăng trưởng</h3>
            </header>
            <div className="admin-analytics-table__scroll">
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Người dùng mới</th>
                    <th>DAU</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{row.newUsers.toLocaleString("vi-VN")}</td>
                      <td>{row.dau.toLocaleString("vi-VN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  );
}
