import { useEffect, useState } from "react";
import { AdminReloadButton } from "../../../pages/admin/components/AdminReloadButton";
import { adminStatsApi } from "../api/adminStatsApi";
import type { LowRatingPhotographerReport } from "../types";
import "./adminDashboardPanels.css";

export function LowRatingPhotographersPanel() {
  const [data, setData] = useState<LowRatingPhotographerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminStatsApi.getLowRatingPhotographers());
    } catch {
      setError("Không thể tải báo cáo chất lượng photographer.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="admin-dashboard-panel">
      <div className="admin-dashboard-panel__header">
        <div>
          <h2>Cảnh báo chất lượng photographer</h2>
          <p>Photographer có điểm trung bình dưới {data?.threshold ?? 3.5} sao.</p>
        </div>
        <AdminReloadButton onClick={load} isLoading={loading} />
      </div>

      {error ? <p className="admin-dashboard-panel__error">{error}</p> : null}
      {loading ? <p className="admin-dashboard-panel__empty">Đang tải báo cáo...</p> : null}

      {!loading && !error ? (
        <div className="admin-analytics-card">
          {data?.data.length ? (
            <div className="admin-analytics-table-wrap">
              <table className="admin-analytics-table">
                <thead>
                  <tr>
                    <th>Photographer</th>
                    <th>Khu vực</th>
                    <th>Điểm TB</th>
                    <th>Đánh giá</th>
                    <th>Negative reviews</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((photographer) => (
                    <tr key={photographer.photographerId}>
                      <td>{photographer.businessName}</td>
                      <td>{photographer.city ?? "—"}</td>
                      <td>{photographer.averageRating.toFixed(1)} / 5</td>
                      <td>{photographer.totalReviews}</td>
                      <td>
                        {photographer.negativeReviews.length ? (
                          photographer.negativeReviews.map((review) => (
                            <p key={review.reviewId} className="admin-low-rating-review">
                              {review.rating}★ — {review.comment || "Không có nội dung"}
                            </p>
                          ))
                        ) : (
                          "Không có review tiêu cực"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-dashboard-panel__empty">
              Không có photographer nào dưới ngưỡng đánh giá.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
