import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { adminStatsApi } from '../api/adminStatsApi';
import type {
  AdminAiInsightsResponse,
  ShopRiskProfile,
  UserShopInteraction,
  SentimentCluster,
} from '../types';
import './aiAnalyticsPanel.css';

// ─── Sub-components ──────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: ShopRiskProfile['riskLevel'] }) {
  const map = {
    HIGH_RISK: { label: 'Nguy hiểm cao', cls: 'ai-risk-badge--high' },
    WARNING: { label: 'Cảnh báo', cls: 'ai-risk-badge--warn' },
    HEALTHY: { label: 'Tốt', cls: 'ai-risk-badge--ok' },
  } as const;
  const { label, cls } = map[level];
  return <span className={`ai-risk-badge ${cls}`}>{label}</span>;
}

function LoyaltyBadge({ tier }: { tier: UserShopInteraction['loyaltyTier'] }) {
  const map = {
    VIP: { label: 'VIP', cls: 'ai-loyalty-badge--vip' },
    REGULAR: { label: 'Thường xuyên', cls: 'ai-loyalty-badge--regular' },
    NEW: { label: 'Mới', cls: 'ai-loyalty-badge--new' },
  } as const;
  const { label, cls } = map[tier];
  return <span className={`ai-loyalty-badge ${cls}`}>{label}</span>;
}

function SentimentBadge({ s }: { s: SentimentCluster['sentiment'] }) {
  const map = {
    POSITIVE: { label: 'Tích cực', cls: 'ai-sent-badge--pos' },
    NEGATIVE: { label: 'Tiêu cực', cls: 'ai-sent-badge--neg' },
    NEUTRAL: { label: 'Trung lập', cls: 'ai-sent-badge--neu' },
  } as const;
  const { label, cls } = map[s];
  return <span className={`ai-sent-badge ${cls}`}>{label}</span>;
}

function StarRating({ value }: { value: number }) {
  const rounded = Math.round(value * 10) / 10;
  return (
    <span className="ai-star-rating">
      <Star size={12} fill="#B89047" color="#B89047" />
      {rounded.toFixed(1)}
    </span>
  );
}

function formatVND(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

// ─── Expandable shop row ─────────────────────────────────────────────────────
function ShopRiskRow({ shop }: { shop: ShopRiskProfile }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr
        className={`ai-table-row ai-table-row--clickable ${shop.riskLevel === 'HIGH_RISK' ? 'ai-table-row--danger' : shop.riskLevel === 'WARNING' ? 'ai-table-row--warn' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        title="Nhấn để xem chi tiết"
      >
        <td>
          <div className="ai-shop-cell">
            {shop.avatarUrl ? (
              <img src={shop.avatarUrl} alt={shop.businessName} className="ai-avatar" />
            ) : (
              <div className="ai-avatar ai-avatar--placeholder">{shop.businessName.charAt(0)}</div>
            )}
            <span className="ai-shop-name">{shop.businessName}</span>
          </div>
        </td>
        <td className="ai-td-center">{shop.totalReviews}</td>
        <td className="ai-td-center"><StarRating value={shop.averageRating} /></td>
        <td className="ai-td-center">
          <span className="ai-bad-count">{shop.badReviewCount}</span>
          <span className="ai-bad-pct"> ({shop.badReviewPercentage.toFixed(0)}%)</span>
        </td>
        <td className="ai-td-center">{shop.disputeCount}</td>
        <td><RiskBadge level={shop.riskLevel} /></td>
        <td className="ai-td-issues">
          {shop.primaryIssues.slice(0, 2).map((issue) => (
            <span key={issue} className="ai-issue-tag">{issue}</span>
          ))}
          {shop.primaryIssues.length > 2 && <span className="ai-issue-tag ai-issue-tag--more">+{shop.primaryIssues.length - 2}</span>}
        </td>
        <td className="ai-td-center ai-expand-btn">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>
      {expanded && shop.recentNegativeComments?.length > 0 && (
        <tr className="ai-table-row ai-table-row--expanded">
          <td colSpan={8}>
            <div className="ai-comments-block">
              <strong>Đánh giá tiêu cực gần đây:</strong>
              {shop.recentNegativeComments.slice(0, 3).map((c, i) => (
                <div key={i} className="ai-comment-item">
                  <StarRating value={c.rating} />
                  <span className="ai-comment-author">{c.customerName}</span>
                  <span className="ai-comment-date">{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                  <p className="ai-comment-text">"{c.comment}"</p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AiAnalyticsPanel() {
  const [data, setData] = useState<AdminAiInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);

  const [interactionPage, setInteractionPage] = useState(0);
  const PAGE_SIZE = 8;

  const loadData = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminStatsApi.getAiAnalytics(q);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải dữ liệu phân tích AI. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAskCopilot = async () => {
    if (!question.trim()) return;
    setCopilotLoading(true);
    setCopilotAnswer(null);
    try {
      const res = await adminStatsApi.askCopilot(question.trim());
      setCopilotAnswer(res.aiAnalysis?.copilotAnswer || res.aiAnalysis?.executiveSummary || 'AI không có câu trả lời cụ thể.');
    } catch {
      setCopilotAnswer('Không thể kết nối AI. Vui lòng thử lại sau.');
    } finally {
      setCopilotLoading(false);
    }
  };

  // Auto-load on mount
  const [mounted, setMounted] = useState(false);
  if (!mounted) {
    setMounted(true);
    void loadData();
  }

  const pagedInteractions = data?.userShopInteractions.slice(
    interactionPage * PAGE_SIZE,
    (interactionPage + 1) * PAGE_SIZE
  ) ?? [];
  const totalPages = Math.ceil((data?.userShopInteractions.length ?? 0) / PAGE_SIZE);

  return (
    <div className="ai-analytics-root">
      {/* ── Header ── */}
      <div className="ai-analytics-header">
        <div className="ai-analytics-header__left">
          <Bot size={22} color="#4A0E17" />
          <div>
            <h2 className="ai-analytics-title">Trợ lý AI Phân tích &amp; Báo cáo</h2>
            <p className="ai-analytics-subtitle">
              Tổng hợp hành vi người dùng, đánh giá shop và phân tích cảm xúc nền tảng
            </p>
          </div>
        </div>
        <button
          type="button"
          className="ai-reload-btn"
          onClick={() => void loadData()}
          disabled={loading}
          title="Tải lại dữ liệu"
        >
          <RefreshCw size={15} className={loading ? 'ai-spin' : ''} />
          {loading ? 'Đang phân tích…' : 'Làm mới'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="ai-alert ai-alert--error">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !data && (
        <div className="ai-skeleton-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="ai-skeleton-card" />
          ))}
          <div className="ai-skeleton-block ai-skeleton-block--tall" />
          <div className="ai-skeleton-block ai-skeleton-block--tall" />
        </div>
      )}

      {data && (
        <>
          {/* ── KPI Cards ── */}
          <div className="ai-kpi-grid">
            <div className="ai-kpi-card">
              <div className="ai-kpi-icon ai-kpi-icon--blue"><MessageSquare size={18} /></div>
              <div>
                <p className="ai-kpi-label">Đánh giá đã phân tích</p>
                <p className="ai-kpi-value">{data.summary.totalReviewsAnalyzed.toLocaleString('vi-VN')}</p>
              </div>
            </div>
            <div className="ai-kpi-card">
              <div className="ai-kpi-icon ai-kpi-icon--gold"><Star size={18} /></div>
              <div>
                <p className="ai-kpi-label">Điểm TB toàn nền tảng</p>
                <p className="ai-kpi-value">{data.summary.averagePlatformRating.toFixed(2)} / 5</p>
              </div>
            </div>
            <div className="ai-kpi-card">
              <div className="ai-kpi-icon ai-kpi-icon--red"><ShieldAlert size={18} /></div>
              <div>
                <p className="ai-kpi-label">Shop nguy hiểm cao</p>
                <p className="ai-kpi-value ai-kpi-value--danger">{data.summary.highRiskShopsCount}</p>
              </div>
            </div>
            <div className="ai-kpi-card">
              <div className="ai-kpi-icon ai-kpi-icon--green"><Users size={18} /></div>
              <div>
                <p className="ai-kpi-label">Lượt tương tác User–Shop</p>
                <p className="ai-kpi-value">{data.summary.totalUserShopInteractions.toLocaleString('vi-VN')}</p>
              </div>
            </div>
          </div>

          {/* ── Highlight strip ── */}
          {(data.summary.mostActiveCustomer || data.summary.worstRatedShop) && (
            <div className="ai-highlight-strip">
              {data.summary.mostActiveCustomer && (
                <div className="ai-highlight-item ai-highlight-item--gold">
                  <TrendingUp size={14} />
                  <span>
                    Khách hàng tích cực nhất:{' '}
                    <strong>{data.summary.mostActiveCustomer.name}</strong>
                    {' '}({data.summary.mostActiveCustomer.bookingCount} booking)
                  </span>
                </div>
              )}
              {data.summary.worstRatedShop && (
                <div className="ai-highlight-item ai-highlight-item--red">
                  <AlertTriangle size={14} />
                  <span>
                    Shop đánh giá thấp nhất:{' '}
                    <strong>{data.summary.worstRatedShop.name}</strong>
                    {' '}(TB: {data.summary.worstRatedShop.avgRating.toFixed(1)} ⭐ · {data.summary.worstRatedShop.badReviewCount} đánh giá xấu)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── AI Executive Summary ── */}
          <section className="ai-section">
            <h3 className="ai-section-title">
              <Bot size={16} />
              Phân tích tổng thể từ AI
              <span className="ai-source-badge">{data.aiAnalysis.source === 'gemini' ? 'Gemini AI' : 'Heuristic Engine'}</span>
            </h3>
            <div className="ai-summary-card">
              <div className="ai-summary-block">
                <h4>Tóm tắt điều hành</h4>
                <p>{data.aiAnalysis.executiveSummary}</p>
              </div>
              {data.aiAnalysis.badShopsAnalysis && (
                <div className="ai-summary-block">
                  <h4>Phân tích shop có vấn đề</h4>
                  <p>{data.aiAnalysis.badShopsAnalysis}</p>
                </div>
              )}
              {data.aiAnalysis.userBehaviorAnalysis && (
                <div className="ai-summary-block">
                  <h4>Phân tích hành vi người dùng</h4>
                  <p>{data.aiAnalysis.userBehaviorAnalysis}</p>
                </div>
              )}
              {data.aiAnalysis.topRecommendations?.length > 0 && (
                <div className="ai-summary-block">
                  <h4>Khuyến nghị hành động</h4>
                  <ul className="ai-recommendations">
                    {data.aiAnalysis.topRecommendations.map((rec, i) => (
                      <li key={i}>
                        <CheckCircle size={13} color="#166534" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* ── Shop Risk Table ── */}
          <section className="ai-section">
            <h3 className="ai-section-title">
              <ShieldAlert size={16} />
              Hồ sơ rủi ro cửa hàng
              <span className="ai-count-badge">{data.shopRiskProfiles.length} shop</span>
            </h3>
            {data.shopRiskProfiles.length === 0 ? (
              <div className="ai-empty">Chưa có dữ liệu đánh giá shop nào.</div>
            ) : (
              <div className="ai-table-wrapper">
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th>Cửa hàng</th>
                      <th className="ai-td-center">Tổng đánh giá</th>
                      <th className="ai-td-center">Điểm TB</th>
                      <th className="ai-td-center">Đánh giá xấu</th>
                      <th className="ai-td-center">Tranh chấp</th>
                      <th>Mức độ</th>
                      <th>Vấn đề chính</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shopRiskProfiles.map((shop) => (
                      <ShopRiskRow key={shop.providerId} shop={shop} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── User–Shop Affinity ── */}
          <section className="ai-section">
            <h3 className="ai-section-title">
              <Users size={16} />
              Tương tác Khách hàng – Cửa hàng
              <span className="ai-count-badge">{data.userShopInteractions.length} cặp</span>
            </h3>
            {data.userShopInteractions.length === 0 ? (
              <div className="ai-empty">Chưa có dữ liệu booking nào.</div>
            ) : (
              <>
                <div className="ai-table-wrapper">
                  <table className="ai-table">
                    <thead>
                      <tr>
                        <th>Khách hàng</th>
                        <th>Cửa hàng</th>
                        <th className="ai-td-center">Booking</th>
                        <th className="ai-td-center">Hoàn thành</th>
                        <th className="ai-td-right">Tổng chi tiêu</th>
                        <th className="ai-td-center">Đánh giá TB</th>
                        <th>Loại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedInteractions.map((item) => (
                        <tr key={`${item.customerId}-${item.providerId}`} className="ai-table-row">
                          <td>
                            <div className="ai-user-cell">
                              {item.customerAvatar ? (
                                <img src={item.customerAvatar} alt={item.customerName} className="ai-avatar" />
                              ) : (
                                <div className="ai-avatar ai-avatar--placeholder">{item.customerName.charAt(0)}</div>
                              )}
                              <div>
                                <div className="ai-cell-name">{item.customerName}</div>
                                <div className="ai-cell-email">{item.customerEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="ai-shop-cell">
                              {item.providerAvatar ? (
                                <img src={item.providerAvatar} alt={item.providerName} className="ai-avatar" />
                              ) : (
                                <div className="ai-avatar ai-avatar--placeholder">{item.providerName.charAt(0)}</div>
                              )}
                              <span>{item.providerName}</span>
                            </div>
                          </td>
                          <td className="ai-td-center ai-bold">{item.totalBookings}</td>
                          <td className="ai-td-center">{item.completedBookings}</td>
                          <td className="ai-td-right">{formatVND(item.totalSpent)}</td>
                          <td className="ai-td-center">
                            {item.reviewCount > 0 ? <StarRating value={item.averageRatingGiven} /> : <span className="ai-no-data">—</span>}
                          </td>
                          <td><LoyaltyBadge tier={item.loyaltyTier} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="ai-pagination">
                    <button
                      type="button"
                      disabled={interactionPage === 0}
                      onClick={() => setInteractionPage((p) => p - 1)}
                    >
                      ← Trước
                    </button>
                    <span>Trang {interactionPage + 1} / {totalPages}</span>
                    <button
                      type="button"
                      disabled={interactionPage >= totalPages - 1}
                      onClick={() => setInteractionPage((p) => p + 1)}
                    >
                      Sau →
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── Sentiment Clusters ── */}
          {data.sentimentClusters?.length > 0 && (
            <section className="ai-section">
              <h3 className="ai-section-title">
                <MessageSquare size={16} />
                Cụm cảm xúc người dùng
              </h3>
              <div className="ai-sentiment-grid">
                {data.sentimentClusters.map((cluster) => (
                  <div key={cluster.topic} className={`ai-sentiment-card ai-sentiment-card--${cluster.sentiment.toLowerCase()}`}>
                    <div className="ai-sentiment-card__header">
                      <strong>{cluster.topic}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <SentimentBadge s={cluster.sentiment} />
                        <span className="ai-sentiment-count">{cluster.count} lượt</span>
                      </div>
                    </div>
                    {cluster.sampleQuotes?.length > 0 && (
                      <ul className="ai-sentiment-quotes">
                        {cluster.sampleQuotes.slice(0, 2).map((q, i) => (
                          <li key={i}>"{q}"</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Admin Co-pilot ── */}
          <section className="ai-section ai-copilot-section">
            <h3 className="ai-section-title">
              <Bot size={16} />
              Trợ lý AI – Hỏi đáp dữ liệu
            </h3>
            <p className="ai-copilot-hint">
              Hỏi AI bất kỳ câu hỏi nào về dữ liệu nền tảng. Ví dụ: "Shop nào có nhiều khiếu nại nhất?", "Khách hàng nào booking nhiều nhất?"
            </p>
            <div className="ai-copilot-input-row">
              <input
                type="text"
                className="ai-copilot-input"
                placeholder="Nhập câu hỏi của bạn (tiếng Việt)..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAskCopilot(); }}
                disabled={copilotLoading}
              />
              <button
                type="button"
                className="ai-copilot-btn"
                onClick={() => void handleAskCopilot()}
                disabled={copilotLoading || !question.trim()}
              >
                {copilotLoading ? <Loader2 size={15} className="ai-spin" /> : <Send size={15} />}
                {copilotLoading ? 'Đang hỏi AI…' : 'Hỏi AI'}
              </button>
            </div>
            {copilotAnswer && (
              <div className="ai-copilot-answer">
                <Bot size={15} color="#4A0E17" />
                <div>
                  <strong>Trả lời từ AI:</strong>
                  <p>{copilotAnswer}</p>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {!loading && !data && !error && (
        <div className="ai-empty ai-empty--full">
          <Bot size={40} color="#D1C5B4" />
          <p>Nhấn "Làm mới" để bắt đầu phân tích dữ liệu nền tảng.</p>
        </div>
      )}
    </div>
  );
}

