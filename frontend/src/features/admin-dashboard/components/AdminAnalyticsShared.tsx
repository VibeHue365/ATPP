import { useState, type ReactNode } from 'react';
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

/* 📊 CHART 1: THỐNG KÊ ĐƠN ĐẶT LỊCH & DOANH THU (Grouped Bar Chart) */
export function GroupedBarChart({
  title = 'THỐNG KÊ ĐƠN ĐẶT LỊCH & DOANH THU',
  period = 'month',
  onPeriodChange,
  bookingsGrowth = [],
  customersGrowth = [],
  revenueGrowth = [],
}: {
  title?: string;
  period?: 'week' | 'month' | 'year';
  onPeriodChange?: (period: 'week' | 'month' | 'year') => void;
  bookingsGrowth?: AdminTrendPoint[];
  customersGrowth?: AdminTrendPoint[];
  revenueGrowth?: AdminTrendPoint[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const series = bookingsGrowth.length
    ? bookingsGrowth.map((point, idx) => {
        const bookingVal = point.value;
        const customerVal = customersGrowth[idx]?.value ?? 0;
        const revenueValInM = (revenueGrowth[idx]?.value ?? 0) / 1000000;
        return { label: point.label, bookingVal, customerVal, revenueValInM };
      })
    : ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((label) => ({ label, bookingVal: 0, customerVal: 0, revenueValInM: 0 }));

  const maxVal = Math.max(1, ...series.flatMap((s) => [s.bookingVal, s.customerVal, s.revenueValInM]));
  const step = Math.ceil(maxVal / 4);
  const ticks = [step * 4, step * 3, step * 2, step * 1, 0];

  return (
    <article className="admin-analytics-chart" style={{ padding: '24px', backgroundColor: '#FFF', borderRadius: '12px', border: '1px solid #E8E2D5', paddingBottom: '36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: 0, color: '#4A0E17', fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>{title}</h3>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4A0E17' }}>
              <i style={{ width: '12px', height: '12px', backgroundColor: '#4A0E17', borderRadius: '3px', display: 'inline-block' }} /> Đơn đặt lịch
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#706E3B' }}>
              <i style={{ width: '12px', height: '12px', backgroundColor: '#706E3B', borderRadius: '3px', display: 'inline-block' }} /> Khách hàng mới
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#B89047' }}>
              <i style={{ width: '12px', height: '12px', backgroundColor: '#B89047', borderRadius: '3px', display: 'inline-block' }} /> Doanh thu (triệu đ)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#FAF6F0', padding: '3px', borderRadius: '6px', border: '1px solid #E8E2D5' }}>
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

      <div style={{ display: 'flex', height: '240px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '12px', color: '#7A7A7A', fontSize: '11.5px', fontWeight: 600, width: '40px', textAlign: 'right', paddingBottom: '30px' }}>
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>

        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {ticks.map((t) => (
            <div key={t} style={{ borderBottom: '1px dashed #E8E2D5', width: '100%', height: '0px' }} />
          ))}

          <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', padding: '0 10px 30px 10px' }}>
            {series.map((s, idx) => (
              <div
                key={s.label}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justify: 'flex-end',
                  width: '60px',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {/* 💬 Sleek Hover Tooltip */}
                {hoveredIdx === idx && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '105%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#2A2A2A',
                      color: '#FFF',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      whiteSpace: 'nowrap',
                      zIndex: 30,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                      pointerEvents: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <strong style={{ color: '#F3C06B', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '3px' }}>
                      {s.label}
                    </strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4A0E17', border: '1px solid #FFF' }} />
                      <span>Đơn đặt lịch: <strong>{s.bookingVal.toLocaleString('vi-VN')}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#706E3B', border: '1px solid #FFF' }} />
                      <span>Khách hàng mới: <strong>{s.customerVal.toLocaleString('vi-VN')}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#B89047', border: '1px solid #FFF' }} />
                      <span>Doanh thu: <strong>{s.revenueValInM.toFixed(1)} triệu đ</strong></span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '100%', width: '100%', justifyContent: 'center' }}>
                  <div
                    style={{
                      width: '10px',
                      height: `${Math.max(4, (s.bookingVal / (ticks[0] || 1)) * 100)}%`,
                      backgroundColor: '#4A0E17',
                      borderRadius: '3px 3px 0 0',
                      transition: 'all 0.3s ease',
                      opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.6,
                    }}
                  />
                  <div
                    style={{
                      width: '10px',
                      height: `${Math.max(4, (s.customerVal / (ticks[0] || 1)) * 100)}%`,
                      backgroundColor: '#706E3B',
                      borderRadius: '3px 3px 0 0',
                      transition: 'all 0.3s ease',
                      opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.6,
                    }}
                  />
                  <div
                    style={{
                      width: '10px',
                      height: `${Math.max(4, (s.revenueValInM / (ticks[0] || 1)) * 100)}%`,
                      backgroundColor: '#B89047',
                      borderRadius: '3px 3px 0 0',
                      transition: 'all 0.3s ease',
                      opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.6,
                    }}
                  />
                </div>
                {/* 🏷️ Date label placed below chart area so it never overlaps bars */}
                <span style={{ position: 'absolute', top: '100%', marginTop: '6px', color: '#2A2A2A', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

/* 📈 CHART 2: BIỂU ĐỒ TĂNG TRƯỞNG DOANH THU HỆ THỐNG (Line Chart with SVG & Values) */
export function RevenueLineChart({
  title = 'BIỂU ĐỒ TĂNG TRƯỞNG DOANH THU HỆ THỐNG (TRIỆU ĐỒNG)',
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

  const series = growth.length
    ? growth.map((point) => ({ label: point.label, valInM: point.value / 1000000 }))
    : ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((label) => ({ label, valInM: 0 }));

  const maxVal = Math.max(1, ...series.map((s) => s.valInM));
  const step = Math.ceil(maxVal / 4);
  const ticks = [step * 4, step * 3, step * 2, step * 1, 0];

  const width = 600;
  const height = 180;
  const paddingX = 40;
  const paddingY = 25;

  const points = series.map((s, idx) => {
    const x = paddingX + (idx / (series.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - (s.valInM / (ticks[0] || 1)) * (height - 2 * paddingY);
    return { ...s, x, y };
  });

  const pathD = points.reduce((acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <article className="admin-analytics-chart" style={{ padding: '24px', backgroundColor: '#FFF', borderRadius: '12px', border: '1px solid #E8E2D5' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h3 style={{ margin: 0, color: '#4A0E17', fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' }}>{title}</h3>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#FAF6F0', padding: '3px', borderRadius: '6px', border: '1px solid #E8E2D5' }}>
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

      <div style={{ display: 'flex', height: '230px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '12px', color: '#7A7A7A', fontSize: '11.5px', fontWeight: 600, width: '45px', textAlign: 'right', paddingBottom: '24px' }}>
          {ticks.map((t) => (
            <span key={t}>{t}M</span>
          ))}
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <svg viewBox={`0 0 ${width} ${height + 30}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            {ticks.map((t, idx) => {
              const yGrid = paddingY + (idx / (ticks.length - 1)) * (height - 2 * paddingY);
              return (
                <line key={t} x1="0" y1={yGrid} x2={width} y2={yGrid} stroke="#E8E2D5" strokeDasharray="4 4" strokeWidth="1" />
              );
            })}

            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4A0E17" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#4A0E17" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#revenueGrad)" />
            <path d={pathD} fill="none" stroke="#4A0E17" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

            {points.map((p, idx) => (
              <g
                key={p.label}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIdx === idx ? 8 : 5.5}
                  fill="#4A0E17"
                  stroke="#FFF"
                  strokeWidth={hoveredIdx === idx ? 3 : 2}
                  style={{ transition: 'all 0.2s ease' }}
                />
                <text
                  x={p.x}
                  y={p.y - 12}
                  textAnchor="middle"
                  fill="#2A2A2A"
                  fontSize="13"
                  fontWeight="800"
                >
                  {p.valInM.toFixed(1)}M
                </text>
                <text
                  x={p.x}
                  y={height + 15}
                  textAnchor="middle"
                  fill="#2A2A2A"
                  fontSize="12"
                  fontWeight="700"
                >
                  {p.label}
                </text>

                {/* 💬 Sleek Node Hover Tooltip */}
                {hoveredIdx === idx && (
                  <g transform={`translate(${p.x}, ${p.y - 35})`}>
                    <rect x="-65" y="-14" width="130" height="26" rx="6" fill="#2A2A2A" />
                    <text x="0" y="3" textAnchor="middle" fill="#F3C06B" fontSize="11" fontWeight="800">
                      {p.label}: {(p.valInM * 1000000).toLocaleString('vi-VN')}đ ({p.valInM.toFixed(1)}M)
                    </text>
                  </g>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
    </article>
  );
}

export function TrendChart({ title, points, legend }: {
  title: string;
  points: AdminTrendPoint[];
  legend: string;
}) {
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

const statusLabel: Record<AdminTransaction['status'], string> = {
  PAID: 'Thành công',
  PENDING: 'Đang xử lý',
  FAILED: 'Thất bại',
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
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.id}</strong></td>
                <td>{item.providerName}</td>
                <td>{item.date}</td>
                <td><strong>{item.bank}</strong><small>STK: {item.account || '—'}</small></td>
                <td className="admin-analytics-table__amount">{formatCurrency(item.amount)}</td>
                <td><span className={`admin-analytics-status admin-analytics-status--${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="admin-analytics-table__empty">Không có lịch sử giao dịch nào.</td></tr>}
          </tbody>
        </table>
      </div>
      {footer}
    </article>
  );
}
