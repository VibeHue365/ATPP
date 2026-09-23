import { useState } from 'react';
interface Props {
  series: { label: string; value: number }[];
  period: 'week' | 'month' | 'year';
  onPeriodChange: (period: Props['period']) => Promise<void>;
}
/** The design's illustrative booking line has no API series yet. */
export function AnalyticsRevenueChart({ series, period, onPeriodChange }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const ceiling = Math.max(1000000, Math.ceil(Math.max(0, ...series.map(p => p.value || 0)) / 1000000) * 1000000);
  const selected = active == null ? null : series[active];
  return <section className="pa-card pa-revenue"><div className="pa-chart-heading"><div><h3>Doanh thu theo thời gian</h3><p>Biểu đồ thể hiện doanh thu từ các dịch vụ của bạn</p></div><div className="pa-period" aria-label="Khoảng thời gian">{(['week', 'month', 'year'] as const).map((p, i) => <button key={p} aria-pressed={period === p} onClick={() => { setActive(null); void onPeriodChange(p); }}>{['Tuần', 'Tháng', 'Năm'][i]}</button>)}</div></div><div className="pa-chart-unit">Doanh thu (triệu đồng)</div><div className="pa-chart" aria-label="Biểu đồ doanh thu"><div className="pa-y-axis">{[1, .75, .5, .25, 0].map(t => <span key={t}>{(ceiling * t / 1000000).toLocaleString('vi-VN')}</span>)}</div><div className="pa-plot"><div className="pa-grid-lines" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <span key={i} />)}</div><div className="pa-bars">{series.map((p, i) => <div className="pa-bar-slot" key={`${p.label}-${i}`}><button className="pa-bar" style={{ height: `${Math.max(0, p.value || 0) / ceiling * 100}%` }} aria-label={`${p.label}: ${(p.value || 0).toLocaleString('vi-VN')} đồng`} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} /><small>{series.length <= 12 || i % Math.ceil(series.length / 8) === 0 ? p.label : ''}</small></div>)}</div>{!series.length && <p className="pa-empty">Chưa có dữ liệu doanh thu.</p>}{selected && <div className="pa-chart-tooltip" role="status"><strong>{selected.label}</strong> · {(selected.value || 0).toLocaleString('vi-VN')} đ</div>}</div></div><div className="pa-chart-legend"><i />Doanh thu (triệu đồng)</div></section>;
}
