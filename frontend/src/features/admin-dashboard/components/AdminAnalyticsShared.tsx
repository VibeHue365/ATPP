import { useId, useState, type ReactNode } from 'react';
import type { AdminTrendPoint } from '../types';
import type { AdminTransaction } from '../api/adminTransactionsApi';
import { formatCurrency } from '../utils/adminAnalyticsUtils';
import { computeNiceScale, formatCompactVnd, formatExactVnd } from '../utils/chartScale';
import { getPaymentTxStatusMeta } from '../../../utils/bookingStatus';
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

/* 📈 CHART 2: BIỂU ĐỒ TĂNG TRƯỞNG DOANH THU HỆ THỐNG (Line Chart with SVG & Values) */
export function RevenueLineChart({
  title = 'BIỂU ĐỒ TĂNG TRƯỞNG DOANH THU HỆ THỐNG (VNĐ)',
  period = 'month',
  onPeriodChange,
  growth = [],
}: {
  title?: string;
  period?: 'week' | 'month' | 'year';
  onPeriodChange?: (period: 'week' | 'month' | 'year') => void;
  growth?: AdminTrendPoint[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const rawGradId = useId();
  const gradId = `revenueGrad-${rawGradId.replace(/:/g, '')}`;

  const series = growth.length
    ? growth.map((point) => ({
        label: point.label,
        value: Math.max(0, Number(point.value) || 0),
      }))
    : ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((label) => ({ label, value: 0 }));

  const rawMax = Math.max(0, ...series.map((s) => s.value));
  const scale = computeNiceScale(rawMax, 4, { minMax: 400_000 });
  const ticks = scale.ticks;

  const width = 640;
  const height = 210;
  const padLeft = 56;
  const padRight = 28;
  const padTop = 26;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const points = series.map((s, idx) => {
    const x =
      series.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (series.length - 1)) * plotW;
    const y = padTop + plotH - (Math.min(s.value, scale.max) / (scale.max || 1)) * plotH;
    return { ...s, x, y };
  });

  const pathD = points.reduce(
    (acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
    '',
  );
  const areaD =
    points.length > 1
      ? `${pathD} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`
      : '';

  return (
    <article
      className="admin-analytics-chart"
      style={{ padding: '24px', backgroundColor: '#FFF', borderRadius: '12px', border: '1px solid #E8E2D5' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <h3 style={{ margin: 0, color: '#4A0E17', fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>
          {title}
        </h3>
        <div
          style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: '#FAF6F0',
            padding: '3px',
            borderRadius: '6px',
            border: '1px solid #E8E2D5',
          }}
        >
          {(['week', 'month', 'year'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onPeriodChange?.(t)}
              style={{
                padding: '5px 14px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: period === t ? '#4A0E17' : 'transparent',
                color: period === t ? '#FFF' : '#7A7A7A',
                transition: 'all 0.15s ease',
              }}
            >
              {t === 'week' ? 'Tuần' : t === 'month' ? 'Tháng' : 'Năm'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: '240px', position: 'relative' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {ticks.map((t, idx) => {
            const yGrid = padTop + (idx / (ticks.length - 1 || 1)) * plotH;
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  y1={yGrid}
                  x2={width - padRight}
                  y2={yGrid}
                  stroke="#E8E2D5"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 10}
                  y={yGrid + 4}
                  textAnchor="end"
                  fill="#7A7A7A"
                  fontSize="11"
                  fontWeight="600"
                >
                  {formatCompactVnd(t)}
                </text>
              </g>
            );
          })}

          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4A0E17" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#4A0E17" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {areaD && <path d={areaD} fill={`url(#${gradId})`} />}
          {points.length > 1 && (
            <path d={pathD} fill="none" stroke="#4A0E17" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {points.map((p, idx) => {
            const tooltipText = `${p.label}: ${formatExactVnd(p.value)}`;
            const boxW = Math.max(140, tooltipText.length * 6.8 + 20);
            const halfW = boxW / 2;
            const tx = Math.min(width - halfW - 4, Math.max(halfW + 4, p.x));
            const ty = p.y < padTop + 34 ? p.y + 32 : p.y - 32;

            return (
              <g
                key={`${p.label}-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIdx === idx ? 7.5 : 5}
                  fill="#4A0E17"
                  stroke="#FFF"
                  strokeWidth={hoveredIdx === idx ? 3 : 2}
                  style={{ transition: 'all 0.2s ease' }}
                />
                <text
                  x={p.x}
                  y={p.y - 11}
                  textAnchor="middle"
                  fill="#2A2A2A"
                  fontSize="11.5"
                  fontWeight="700"
                >
                  {formatCompactVnd(p.value)}
                </text>
                <text
                  x={p.x}
                  y={height - 6}
                  textAnchor="middle"
                  fill="#2A2A2A"
                  fontSize="11.5"
                  fontWeight="700"
                >
                  {p.label}
                </text>

                {hoveredIdx === idx && (
                  <g transform={`translate(${tx}, ${ty})`}>
                    <rect x={-halfW} y="-14" width={boxW} height="26" rx="6" fill="#2A2A2A" />
                    <text x="0" y="3" textAnchor="middle" fill="#F3C06B" fontSize="11" fontWeight="800">
                      {tooltipText}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </article>
  );
}

export function TrendChart({ title, points, legend }: {
  title: string;
  points: AdminTrendPoint[];
  legend: string;
}) {
  void legend;
  return <RevenueLineChart title={title} growth={points} />;
}

const bookingTypes = [
  { id: 'AODAI_RENTAL', label: 'Cho thuê áo dài', color: '#4a0e17' },
  { id: 'PHOTOGRAPHY', label: 'Dịch vụ chụp ảnh', color: '#706e3b' },
  { id: 'COMBO', label: 'Combo trọn gói', color: '#b89047' },
] as const;

export function BookingDistribution({ items }: { items: Array<{ _id: string; count: number }> }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const segments = bookingTypes.map((type) => ({
    ...type,
    count: Math.max(0, items.find((item) => item._id === type.id)?.count ?? 0),
  }));
  const total = segments.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;

  const hoveredSegment = segments.find((s) => s.id === hoveredId);

  return (
    <article className='admin-analytics-card admin-booking-distribution'>
      <div><h3>Cơ cấu đặt dịch vụ hệ thống</h3><p>Tỷ lệ booking theo các loại hình dịch vụ chính.</p></div>
      <div className='admin-booking-distribution__content'>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <svg viewBox='0 0 120 120' role='img' aria-label={`Tổng cộng ${total.toLocaleString('vi-VN')} booking`} style={{ overflow: 'visible' }}>
            <circle className='admin-booking-distribution__track' cx='60' cy='60' r='45' pathLength='100' />
            {total > 0 && segments.map((segment) => {
              const percentage = (segment.count / total) * 100;
              const dashOffset = -offset;
              offset += percentage;
              const isHovered = hoveredId === segment.id;

              return percentage > 0 ? (
                <circle
                  key={segment.id}
                  className='admin-booking-distribution__segment'
                  cx='60'
                  cy='60'
                  r='45'
                  pathLength='100'
                  stroke={segment.color}
                  strokeDasharray={`${percentage} ${100 - percentage}`}
                  strokeDashoffset={dashOffset}
                  strokeWidth={isHovered ? 16 : 12}
                  style={{
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    opacity: hoveredId === null || isHovered ? 1 : 0.6,
                  }}
                  onMouseEnter={() => setHoveredId(segment.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              ) : null;
            })}
            <text x='60' y='52' textAnchor='middle' fontSize='8' fill='#7A7A7A' fontWeight='600'>
              {hoveredSegment ? hoveredSegment.label : 'Tổng booking'}
            </text>
            <text className='admin-booking-distribution__total' x='60' y='72' textAnchor='middle' fontSize={hoveredSegment ? '14' : '18'} fontWeight='800'>
              {hoveredSegment ? `${hoveredSegment.count} (${Math.round((hoveredSegment.count / (total || 1)) * 100)}%)` : total.toLocaleString('vi-VN')}
            </text>
          </svg>
        </div>

        <ul>
          {segments.map((segment) => {
            const isHovered = hoveredId === segment.id;
            return (
              <li
                key={segment.id}
                onMouseEnter={() => setHoveredId(segment.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: isHovered ? '#FAF6F0' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <i style={{ backgroundColor: segment.color, transform: isHovered ? 'scale(1.3)' : 'scale(1)', transition: 'transform 0.2s ease' }} />
                <span style={{ fontWeight: isHovered ? 700 : 500 }}>{segment.label}</span>
                <strong>{segment.count} ({total ? Math.round((segment.count / total) * 100) : 0}%)</strong>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

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
            <tr>
              <th>Mã giao dịch</th>
              <th>Đối tác nhận tiền</th>
              <th>Ngày giao dịch</th>
              <th>Thông tin ngân hàng</th>
              <th>Số tiền thực nhận</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const statusMeta = getPaymentTxStatusMeta(item.status);
              return (
                <tr key={item.id}>
                  <td><strong>{item.id}</strong></td>
                  <td>{item.providerName}</td>
                  <td>{item.date}</td>
                  <td><strong>{item.bank}</strong><small>STK: {item.account || '—'}</small></td>
                  <td className="admin-analytics-table__amount">{formatCurrency(item.amount)}</td>
                  <td>
                    <span
                      className={`admin-analytics-status admin-analytics-status--${(item.status || 'pending').toLowerCase()}`}
                      style={{ backgroundColor: statusMeta.bg, color: statusMeta.color }}
                    >
                      {statusMeta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!items.length && <tr><td colSpan={6} className="admin-analytics-table__empty">Không có lịch sử giao dịch nào.</td></tr>}
          </tbody>
        </table>
      </div>
      {footer}
    </article>
  );
}
