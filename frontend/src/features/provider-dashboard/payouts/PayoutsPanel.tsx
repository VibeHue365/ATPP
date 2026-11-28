import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Info,
  PauseCircle,
  RefreshCw,
  Search,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type {
  ProviderSettlementItem,
  ProviderSettlementsFilters,
  ProviderSettlementsPagination,
  ProviderSettlementsSummary,
} from './types';
import './payoutsPanel.css';

interface PayoutsPanelProps
  extends Pick<
    ReturnType<typeof useProviderSessionState>,
    'isLoadingProvider' | 'setSelectedBookingId' | 'setIsDetailModalOpen'
  > {
  isLoadingPayouts: boolean;
  payoutsError: string | null;
  payouts: ProviderSettlementItem[];
  payoutSummary: ProviderSettlementsSummary;
  payoutLifetimeSummary: ProviderSettlementsSummary;
  payoutPagination: ProviderSettlementsPagination;
  payoutFilters: ProviderSettlementsFilters;
  fetchPayouts: (overrides?: Partial<ProviderSettlementsFilters>) => Promise<void>;
}

const formatVnd = (amount?: number | null) =>
  `${Number(amount ?? 0).toLocaleString('vi-VN')}đ`;

const formatViDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getBookingObjectId = (item: ProviderSettlementItem): string | null => {
  if (!item.bookingId) return null;
  if (typeof item.bookingId === 'string') return item.bookingId;
  return item.bookingId._id || item.bookingId.id || null;
};

const getBookingCode = (item: ProviderSettlementItem): string => {
  if (typeof item.bookingId === 'object' && item.bookingId?.bookingCode) {
    return item.bookingId.bookingCode;
  }
  return item.bookingCode || '—';
};

function getStatusMeta(rawStatus?: string) {
  const status = String(rawStatus || 'READY_TO_SETTLE').toUpperCase();
  switch (status) {
    case 'SETTLED':
      return {
        key: 'settled' as const,
        label: 'Đã giải ngân',
        icon: <CheckCircle2 size={13} />,
      };
    case 'ON_HOLD':
      return {
        key: 'held' as const,
        label: 'Đang tạm giữ',
        icon: <PauseCircle size={13} />,
      };
    case 'CANCELLED':
      return {
        key: 'cancelled' as const,
        label: 'Đã hủy',
        icon: <XCircle size={13} />,
      };
    default:
      return {
        key: 'pending' as const,
        label: 'Chờ quyết toán',
        icon: <Clock size={13} />,
      };
  }
}

export function PayoutsPanel({
  isLoadingProvider,
  isLoadingPayouts,
  payoutsError,
  payouts,
  payoutSummary,
  payoutLifetimeSummary,
  payoutPagination,
  payoutFilters,
  fetchPayouts,
  setSelectedBookingId,
  setIsDetailModalOpen,
}: PayoutsPanelProps) {
  const [searchText, setSearchText] = useState('');
  const [draftFromDate, setDraftFromDate] = useState(payoutFilters.fromDate);
  const [draftToDate, setDraftToDate] = useState(payoutFilters.toDate);

  const hasDateFilter = Boolean(payoutFilters.fromDate || payoutFilters.toDate);
  const hasAnyFilter = Boolean(
    payoutFilters.status || hasDateFilter || searchText.trim(),
  );

  const visiblePayouts = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return payouts;
    return payouts.filter((item) => {
      const settlementCode = (item.settlementCode || item.id || '').toLowerCase();
      const bookingCode = getBookingCode(item).toLowerCase();
      const bookingId = (getBookingObjectId(item) || '').toLowerCase();
      const payoutRef = (item.payoutReference || '').toLowerCase();
      return (
        settlementCode.includes(q) ||
        bookingCode.includes(q) ||
        bookingId.includes(q) ||
        payoutRef.includes(q)
      );
    });
  }, [payouts, searchText]);

  const handleSelectStatus = (nextStatus: string) => {
    void fetchPayouts({ status: nextStatus, page: 1 });
  };

  const handleApplyDateFilter = () => {
    void fetchPayouts({
      fromDate: draftFromDate,
      toDate: draftToDate,
      page: 1,
    });
  };

  const handleClearFilters = () => {
    setSearchText('');
    setDraftFromDate('');
    setDraftToDate('');
    void fetchPayouts({
      status: '',
      fromDate: '',
      toDate: '',
      page: 1,
    });
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > payoutPagination.totalPages) return;
    void fetchPayouts({ page: nextPage });
  };

  const statusTabs = useMemo(() => {
    const base = [
      { id: '', label: 'Tất cả', count: payoutSummary.totalCount },
      {
        id: 'READY_TO_SETTLE',
        label: 'Chờ quyết toán',
        count: payoutSummary.pending.count,
      },
      {
        id: 'SETTLED',
        label: 'Đã giải ngân',
        count: payoutSummary.settled.count,
      },
      {
        id: 'ON_HOLD',
        label: 'Đang tạm giữ',
        count: payoutSummary.held.count,
      },
    ];
    if (payoutSummary.cancelled.count > 0 || payoutFilters.status === 'CANCELLED') {
      base.push({
        id: 'CANCELLED',
        label: 'Đã hủy',
        count: payoutSummary.cancelled.count,
      });
    }
    return base;
  }, [payoutSummary, payoutFilters.status]);

  const pageStart =
    payoutPagination.total === 0
      ? 0
      : (payoutPagination.page - 1) * payoutPagination.limit + 1;
  const pageEnd = Math.min(
    payoutPagination.page * payoutPagination.limit,
    payoutPagination.total,
  );

  return (
    <main className="pp-page">
      {/* 1. Header */}
      <div className="pp-header">
        <div>
          <h2 className="pp-title">Doanh thu &amp; Thanh toán</h2>
          <p className="pp-subtitle">
            Tổng hợp thu nhập tích lũy từ khi mở cửa hàng, theo dõi trạng thái đối soát và lịch sử giải ngân từ hệ thống TàGo.
          </p>
        </div>

        <button
          type="button"
          className="pp-reload-btn"
          onClick={() => void fetchPayouts()}
          disabled={isLoadingPayouts}
        >
          <RefreshCw size={14} className={isLoadingPayouts ? 'pp-spin' : ''} />
          <span>Tải lại</span>
        </button>
      </div>

      {/* 2. Lifetime Financial KPI Cards */}
      <section className="pp-kpi-grid" aria-label="Tổng quan doanh thu tích lũy">
        {/* Featured: Total Cumulative Net Earnings */}
        <div
          className="pp-kpi-card pp-kpi-card--featured pp-kpi-card--clickable"
          onClick={() => handleSelectStatus('')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelectStatus('');
            }
          }}
        >
          <div>
            <div className="pp-kpi-top">
              <span className="pp-kpi-label">Tổng thu nhập tích lũy (Thực nhận)</span>
              <span className="pp-kpi-icon pp-kpi-icon--featured">
                <Wallet size={17} />
              </span>
            </div>
            <div className="pp-kpi-value" style={{ marginTop: '8px' }}>
              {formatVnd(payoutLifetimeSummary.totalNetEarnings)}
            </div>
            <div className="pp-kpi-sub" style={{ marginTop: '4px' }}>
              Toàn thời gian từ khi mở cửa hàng · {payoutLifetimeSummary.activeCount} đơn quyết toán
            </div>
          </div>

          <div className="pp-kpi-breakdown">
            <span>
              Doanh thu gốc:{' '}
              <strong>{formatVnd(payoutLifetimeSummary.totalGrossRevenue)}</strong>
            </span>
            <span>
              Phí nền tảng:{' '}
              <strong>-{formatVnd(payoutLifetimeSummary.totalPlatformFee)}</strong>
            </span>
            {payoutLifetimeSummary.totalCompensation > 0 && (
              <span>
                Bồi thường cọc:{' '}
                <strong>+{formatVnd(payoutLifetimeSummary.totalCompensation)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Settled */}
        <button
          type="button"
          className={`pp-kpi-card pp-kpi-card--clickable ${
            payoutFilters.status === 'SETTLED' ? 'pp-kpi-card--active' : ''
          }`}
          onClick={() => handleSelectStatus('SETTLED')}
        >
          <div className="pp-kpi-top">
            <span className="pp-kpi-label">Đã giải ngân</span>
            <span className="pp-kpi-icon pp-kpi-icon--settled">
              <CheckCircle2 size={17} />
            </span>
          </div>
          <div className="pp-kpi-value pp-kpi-value--settled">
            {formatVnd(payoutLifetimeSummary.settled.amount)}
          </div>
          <div className="pp-kpi-sub">
            {payoutLifetimeSummary.settled.count} phiếu đã chuyển khoản về tài khoản
          </div>
        </button>

        {/* Ready to settle */}
        <button
          type="button"
          className={`pp-kpi-card pp-kpi-card--clickable ${
            payoutFilters.status === 'READY_TO_SETTLE' ? 'pp-kpi-card--active' : ''
          }`}
          onClick={() => handleSelectStatus('READY_TO_SETTLE')}
        >
          <div className="pp-kpi-top">
            <span className="pp-kpi-label">Chờ quyết toán</span>
            <span className="pp-kpi-icon pp-kpi-icon--pending">
              <Clock size={17} />
            </span>
          </div>
          <div className="pp-kpi-value pp-kpi-value--pending">
            {formatVnd(payoutLifetimeSummary.pending.amount)}
          </div>
          <div className="pp-kpi-sub">
            {payoutLifetimeSummary.pending.count} phiếu đã hoàn tất đơn, chờ Admin chi trả
          </div>
        </button>

        {/* On Hold */}
        <button
          type="button"
          className={`pp-kpi-card pp-kpi-card--clickable ${
            payoutFilters.status === 'ON_HOLD' ? 'pp-kpi-card--active' : ''
          }`}
          onClick={() => handleSelectStatus('ON_HOLD')}
        >
          <div className="pp-kpi-top">
            <span className="pp-kpi-label">Đang tạm giữ</span>
            <span className="pp-kpi-icon pp-kpi-icon--held">
              <PauseCircle size={17} />
            </span>
          </div>
          <div
            className={`pp-kpi-value ${
              payoutLifetimeSummary.held.amount > 0 ? 'pp-kpi-value--held' : ''
            }`}
          >
            {formatVnd(payoutLifetimeSummary.held.amount)}
          </div>
          <div className="pp-kpi-sub">
            {payoutLifetimeSummary.held.count > 0
              ? `${payoutLifetimeSummary.held.count} phiếu đang đối soát / tranh chấp`
              : 'Không có khoản nào đang bị tạm giữ'}
          </div>
        </button>
      </section>

      {/* 3. Clarification strip */}
      <div className="pp-info-strip">
        <Info size={16} />
        <span>
          <strong>Lưu ý đối soát:</strong> Doanh thu ở trang Tổng quan tính theo tổng giá trị đơn đặt phát sinh trong tháng (trước hoa hồng). Trang này ghi nhận{' '}
          <strong>thu nhập thực nhận sau phí nền tảng</strong> cho các đơn đã hoàn tất và trạng thái giải ngân từng phiếu.
        </span>
      </div>

      {/* Error banner */}
      {payoutsError && (
        <div className="pp-error-banner" role="alert">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            {payoutsError}
          </span>
          <button
            type="button"
            className="pp-btn-ghost"
            onClick={() => void fetchPayouts()}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 4. Settlements List & Filter Card */}
      {isLoadingProvider || (isLoadingPayouts && payouts.length === 0) ? (
        <div className="pp-loading">
          <div className="pp-loading-spinner" />
          <div>Đang tải dữ liệu doanh thu &amp; quyết toán từ hệ thống...</div>
        </div>
      ) : (
        <section className="pp-panel-card">
          <div className="pp-toolbar-top">
            <h3 className="pp-section-title">Chi tiết các khoản quyết toán</h3>
            <div className="pp-tabs" role="tablist" aria-label="Lọc theo trạng thái quyết toán">
              {statusTabs.map((tab) => (
                <button
                  key={tab.id || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={payoutFilters.status === tab.id}
                  className={`pp-tab-btn ${
                    payoutFilters.status === tab.id ? 'is-active' : ''
                  }`}
                  onClick={() => handleSelectStatus(tab.id)}
                >
                  <span>{tab.label}</span>
                  <span className="pp-tab-count">({tab.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search & Date Filter Row */}
          <div className="pp-filter-row">
            <div className="pp-search-box">
              <Search size={15} />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm mã quyết toán, mã booking, mã giao dịch..."
                aria-label="Tìm kiếm quyết toán"
              />
            </div>

            <div className="pp-date-controls">
              <label className="pp-date-field">
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={draftFromDate}
                  max={draftToDate || undefined}
                  onChange={(e) => setDraftFromDate(e.target.value)}
                />
              </label>
              <label className="pp-date-field">
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={draftToDate}
                  min={draftFromDate || undefined}
                  onChange={(e) => setDraftToDate(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="pp-btn-primary"
                onClick={handleApplyDateFilter}
                disabled={isLoadingPayouts}
              >
                Lọc theo ngày
              </button>
              {hasAnyFilter && (
                <button
                  type="button"
                  className="pp-btn-ghost"
                  onClick={handleClearFilters}
                  disabled={isLoadingPayouts}
                >
                  <X size={14} />
                  <span>Xóa lọc</span>
                </button>
              )}
            </div>
          </div>

          {/* Filtered period subtotal strip */}
          {hasDateFilter && (
            <div className="pp-range-strip">
              <span>
                Kết quả theo khoảng ngày đã chọn (
                <strong>
                  {payoutFilters.fromDate ? formatViDate(payoutFilters.fromDate) : 'Đầu kỳ'}
                </strong>{' '}
                →{' '}
                <strong>
                  {payoutFilters.toDate ? formatViDate(payoutFilters.toDate) : 'Hiện tại'}
                </strong>
                ):
              </span>
              <span>
                Thực nhận: <strong>{formatVnd(payoutSummary.totalNetEarnings)}</strong> · Gốc:{' '}
                <strong>{formatVnd(payoutSummary.totalGrossRevenue)}</strong> · Phí:{' '}
                <strong>-{formatVnd(payoutSummary.totalPlatformFee)}</strong> ({payoutSummary.activeCount}{' '}
                phiếu hiệu lực)
              </span>
            </div>
          )}

          {/* Table */}
          {visiblePayouts.length === 0 ? (
            <div className="pp-empty">
              <DollarSign size={38} style={{ opacity: 0.28 }} />
              <p className="pp-empty-title">
                {hasAnyFilter
                  ? 'Không có khoản quyết toán nào khớp bộ lọc'
                  : 'Chưa có khoản quyết toán nào'}
              </p>
              <p className="pp-empty-desc">
                {hasAnyFilter
                  ? 'Thử đổi tab trạng thái, mở rộng khoảng ngày hoặc bấm Xóa lọc để xem toàn bộ lịch sử.'
                  : 'Khi đơn hàng hoàn tất, hệ thống sẽ tự động tạo phiếu quyết toán và hiển thị tiến độ chi trả tại đây.'}
              </p>
            </div>
          ) : (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Mã quyết toán / Đơn hàng</th>
                    <th style={{ textAlign: 'right' }}>Doanh thu gốc</th>
                    <th style={{ textAlign: 'right' }}>Phí nền tảng</th>
                    <th style={{ textAlign: 'right' }}>Số tiền thực nhận</th>
                    <th style={{ textAlign: 'left' }}>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePayouts.map((item) => {
                    const bookingObjectId = getBookingObjectId(item);
                    const bookingCode = getBookingCode(item);
                    const shortId = bookingObjectId
                      ? `#${bookingObjectId.slice(-6).toUpperCase()}`
                      : null;
                    const statusMeta = getStatusMeta(item.status);
                    const isCancelled = statusMeta.key === 'cancelled';
                    const payable = Number(
                      item.payableAmount ?? item.netAmount ?? item.amount ?? 0,
                    );
                    const originalNet = Number(item.netAmount ?? payable);
                    const fee =
                      Number(item.commissionAmount ?? 0) +
                      Number(item.allocatedPlatformFee ?? item.fixedPlatformFee ?? 0);
                    const rateLabel = item.commissionRate
                      ? `${Math.round(item.commissionRate * 100)}%`
                      : null;
                    const displayDate = item.settledAt || item.createdAt || item.date;

                    return (
                      <tr
                        key={item._id || item.settlementCode}
                        className={bookingObjectId ? 'is-clickable' : undefined}
                        onClick={() => {
                          if (bookingObjectId) {
                            setSelectedBookingId(bookingObjectId);
                            setIsDetailModalOpen(true);
                          }
                        }}
                      >
                        <td>
                          <div className="pp-code-cell">
                            <span className="pp-code-main">
                              {item.settlementCode || item.id || '—'}
                            </span>
                            <span className="pp-code-sub">
                              <span className="pp-code-booking">{bookingCode}</span>
                              {shortId && <span>· {shortId}</span>}
                            </span>
                          </div>
                        </td>

                        <td style={{ textAlign: 'right', color: '#4b5563', fontWeight: 600 }}>
                          {formatVnd(item.grossAmount)}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <span className="pp-fee-val">-{formatVnd(fee)}</span>
                          {rateLabel && (
                            <span className="pp-fee-rate">HH: {rateLabel}</span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <span className={`pp-amount-net pp-amount-net--${statusMeta.key}`}>
                            {isCancelled ? formatVnd(0) : formatVnd(payable)}
                          </span>
                          {isCancelled && originalNet > 0 && (
                            <span className="pp-amount-note pp-amount-note--muted">
                              Gốc: {formatVnd(originalNet)} (đã hủy)
                            </span>
                          )}
                          {!isCancelled &&
                            item.compensationAmount != null &&
                            item.compensationAmount > 0 && (
                              <span className="pp-amount-note pp-amount-note--comp">
                                +{formatVnd(item.compensationAmount)} bồi thường cọc
                              </span>
                            )}
                        </td>

                        <td>
                          <div className="pp-status-cell">
                            <span
                              className={`pp-status-badge pp-status-badge--${statusMeta.key}`}
                            >
                              {statusMeta.icon}
                              <span>{statusMeta.label}</span>
                            </span>
                            {statusMeta.key === 'settled' && item.payoutReference && (
                              <span className="pp-status-meta">
                                Mã GD: <strong>{item.payoutReference}</strong>
                              </span>
                            )}
                            {(statusMeta.key === 'held' ||
                              statusMeta.key === 'cancelled') &&
                              item.holdReason && (
                                <span className="pp-status-meta">
                                  Lý do: {item.holdReason}
                                </span>
                              )}
                          </div>
                        </td>

                        <td>
                          <div className="pp-date-cell">
                            <span className="pp-date-main">
                              {formatViDate(displayDate)}
                            </span>
                            <span className="pp-date-tag">
                              {item.settledAt ? 'Ngày giải ngân' : 'Ngày tạo phiếu'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {payoutPagination.total > 0 && (
            <div className="pp-pagination">
              <span className="pp-pagination-info">
                Hiển thị <strong>{pageStart}–{pageEnd}</strong> trên{' '}
                <strong>{payoutPagination.total}</strong> phiếu quyết toán · Trang{' '}
                <strong>{payoutPagination.page}</strong>/{Math.max(1, payoutPagination.totalPages)}
              </span>

              <div className="pp-pagination-actions">
                <button
                  type="button"
                  className="pp-page-btn"
                  disabled={payoutPagination.page <= 1 || isLoadingPayouts}
                  onClick={() => handlePageChange(payoutPagination.page - 1)}
                >
                  <ChevronLeft size={15} />
                  <span>Trang trước</span>
                </button>
                <button
                  type="button"
                  className="pp-page-btn"
                  disabled={
                    payoutPagination.page >= payoutPagination.totalPages ||
                    isLoadingPayouts
                  }
                  onClick={() => handlePageChange(payoutPagination.page + 1)}
                >
                  <span>Trang sau</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default PayoutsPanel;
