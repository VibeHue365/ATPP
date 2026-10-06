import React from 'react';
import { Calendar, ExternalLink, RefreshCw } from 'lucide-react';

interface OverviewHeaderProps {
  provider?: { _id?: string; businessName?: string } | null;
  lastUpdated?: string;
  isRefreshing?: boolean;
  isConnected?: boolean;
  onRefresh?: () => void;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({
  provider,
  lastUpdated,
  isRefreshing = false,
  isConnected = false,
  onRefresh,
}) => {
  // Format current date in Vietnamese as in Figma (e.g., "Thứ Hai, 28 tháng 7, 2026")
  const formattedDate = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const capitalizedDate =
    formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const businessName = provider?.businessName || 'Đối tác TàGo';
  const storeUrl = provider?._id
    ? `/stores/${encodeURIComponent(provider._id)}`
    : '#';

  const timeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <section className="po-welcome-header" aria-label="Chào mừng">
      <div className="po-welcome-title-group">
        <h2>
          Xin chào, {businessName}! <span role="img" aria-label="wave">👋</span>
        </h2>
        <p>Cùng xem tình hình kinh doanh và những việc cần xử lý hôm nay nhé!</p>
      </div>

      <div className="po-welcome-actions-group">
        {timeStr && (
          <div className="po-live-indicator" title={isConnected ? 'Đang kết nối thời gian thực' : 'Ngoại tuyến'}>
            <span
              className={`po-dot ${isConnected ? 'po-dot-green' : 'po-dot-gray'}`}
            />
            <span>Cập nhật lúc {timeStr}</span>
          </div>
        )}

        <button
          className={`po-btn-refresh ${isRefreshing ? 'spinning' : ''}`}
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Làm mới dữ liệu"
          type="button"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </button>

        <div className="po-date-badge">
          <Calendar size={15} color="var(--po-burgundy-700)" />
          <span>{capitalizedDate}</span>
        </div>

        <a
          href={storeUrl}
          target={provider?._id ? '_blank' : undefined}
          rel="noreferrer"
          className="po-store-preview-btn"
          id="btn-preview-store"
        >
          <span>Xem cửa hàng của tôi</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </section>
  );
};
