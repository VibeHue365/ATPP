import React from 'react';
import { Calendar, ExternalLink } from 'lucide-react';

interface OverviewHeaderProps {
  provider?: { _id?: string; businessName?: string } | null;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({ provider }) => {
  // Format current date in Vietnamese as in Figma (e.g., "Thứ Hai, 28 tháng 7, 2026")
  const formattedDate = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Capitalize first letter (e.g., "thứ hai" -> "Thứ Hai")
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const businessName = provider?.businessName || 'Huế Áo Dài Studio';
  const storeUrl = provider?._id ? `/stores/${encodeURIComponent(provider._id)}` : '#';

  return (
    <section className="po-welcome-header" aria-label="Chào mừng">
      <div className="po-welcome-title-group">
        <h2>
          Xin chào, {businessName}! <span role="img" aria-label="wave">👋</span>
        </h2>
        <p>Cùng xem tình hình kinh doanh và những việc cần xử lý hôm nay nhé!</p>
      </div>

      <div className="po-welcome-actions-group">
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
