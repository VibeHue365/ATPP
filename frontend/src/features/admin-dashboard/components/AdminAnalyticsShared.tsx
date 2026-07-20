import type { ReactNode } from 'react';
import type { AdminTrendPoint } from '../types';
import type { AdminTransaction } from '../api/adminTransactionsApi';
import { formatCurrency } from '../utils/adminAnalyticsUtils';
import './adminDashboardPanels.css';


export function MetricCard({ label, value, detail, tone = 'burgundy' }: {
  label: string;
  value: string | number;
  detail: string;
  tone?: 'burgundy' | 'charcoal' | 'olive' | 'gold';
}) {
  return (
    <article className={`admin-analytics-metric admin-analytics-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function TrendChart({ title, points, legend }: {
  title: string;
  points: AdminTrendPoint[];
  legend: string;
}) {
  const safePoints = points.length ? points : [{ label: 'ChÆ°a cÃ³ dá»¯ liá»‡u', value: 0 }];
  const maxValue = Math.max(1, ...safePoints.map((point) => point.value));

  return (
    <article className="admin-analytics-chart">
      <header><h3>{title}</h3><span>{legend}</span></header>
      <div className="admin-analytics-chart__bars" aria-label={title}>
        {safePoints.map((point) => (
          <div className="admin-analytics-chart__bar" key={point.label} title={`${point.label}: ${point.value.toLocaleString('vi-VN')}`}>
            <i style={{ height: `${Math.max(4, (point.value / maxValue) * 100)}%` }} />
            <span>{point.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

const bookingTypes = [
  { id: 'AODAI_RENTAL', label: 'Cho thuê áo dài', color: '#4a0e17' },
  { id: 'PHOTOGRAPHY', label: 'Dịch vụ chụp ảnh', color: '#706e3b' },
  { id: 'COMBO', label: 'Combo trọn gói', color: '#b89047' },
] as const;

export function BookingDistribution({ items }: { items: Array<{ _id: string; count: number }> }) {
  const segments = bookingTypes.map((type) => ({
    ...type,
    count: Math.max(0, items.find((item) => item._id === type.id)?.count ?? 0),
  }));
  const total = segments.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;

  return (
    <article className='admin-analytics-card admin-booking-distribution'>
      <div><h3>Cơ cấu đặt dịch vụ hệ thống</h3><p>Tỷ lệ booking theo các loại hình dịch vụ chính.</p></div>
      <div className='admin-booking-distribution__content'>
        <svg viewBox='0 0 120 120' role='img' aria-label={`Tổng cộng ${total.toLocaleString('vi-VN')} booking`}>
          <circle className='admin-booking-distribution__track' cx='60' cy='60' r='45' pathLength='100' />
          {total > 0 && segments.map((segment) => {
            const percentage = (segment.count / total) * 100;
            const dashOffset = -offset;
            offset += percentage;
            return percentage > 0 ? <circle key={segment.id} className='admin-booking-distribution__segment' cx='60' cy='60' r='45' pathLength='100' stroke={segment.color} strokeDasharray={`${percentage} ${100 - percentage}`} strokeDashoffset={dashOffset} /> : null;
          })}
          <text x='60' y='56' textAnchor='middle'>Tổng booking</text>
          <text className='admin-booking-distribution__total' x='60' y='73' textAnchor='middle'>{total.toLocaleString('vi-VN')}</text>
        </svg>
        <ul>{segments.map((segment) => <li key={segment.id}><i style={{ backgroundColor: segment.color }} /><span>{segment.label}</span><strong>{total ? Math.round((segment.count / total) * 100) : 0}%</strong></li>)}</ul>
      </div>
    </article>
  );
}

const statusLabel: Record<AdminTransaction['status'], string> = {
  PAID: 'ThÃ nh cÃ´ng',
  PENDING: 'Äang xá»­ lÃ½',
  FAILED: 'Tháº¥t báº¡i',
};

export function TransactionTable({ title, items, footer }: {
  title: string;
  items: AdminTransaction[];
  footer?: ReactNode;
}) {
  return (
    <article className="admin-analytics-table">
      <header><h3>{title}</h3></header>
      <div className="admin-analytics-table__scroll">
        <table>
          <thead>
            <tr><th>MÃ£ giao dá»‹ch</th><th>Äá»‘i tÃ¡c nháº­n tiá»n</th><th>NgÃ y giao dá»‹ch</th><th>ThÃ´ng tin ngÃ¢n hÃ ng</th><th>Sá»‘ tiá»n thá»±c nháº­n</th><th>Tráº¡ng thÃ¡i</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.id}</strong></td>
                <td>{item.providerName}</td>
                <td>{item.date}</td>
                <td><strong>{item.bank}</strong><small>STK: {item.account || 'â€”'}</small></td>
                <td className="admin-analytics-table__amount">{formatCurrency(item.amount)}</td>
                <td><span className={`admin-analytics-status admin-analytics-status--${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="admin-analytics-table__empty">KhÃ´ng cÃ³ lá»‹ch sá»­ giao dá»‹ch nÃ o.</td></tr>}
          </tbody>
        </table>
      </div>
      {footer}
    </article>
  );
}
