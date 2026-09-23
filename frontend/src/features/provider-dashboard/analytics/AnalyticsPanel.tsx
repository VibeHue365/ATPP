import { useState } from 'react';
import type { Order } from '../types';
import type { useProviderNavigationState } from '../hooks/useProviderNavigationState';
import { getImageUrl } from '../shared/mediaHelpers';
import { AnalyticsRevenueChart } from './AnalyticsRevenueChart';
import './providerAnalytics.css';

export interface AnalyticsData {
  capabilities?: string[];
  totalRevenue?: number;
  commissionFee?: number;
  successRate?: number;
  cancelRate?: number;
  totalProducts?: number;
  averageRentalDuration?: string | null;
  averageRating?: number;
  inventoryStatus?: { status: string; count: number }[];
  revenueGrowth?: { label: string; value: number }[];
  upcomingSchedules?: { customerName: string; date: string; time: string; status: string; color: string }[];
  popularProducts?: { name: string; image?: string; count: number }[];
  popularConcepts?: { name: string; percentage: number; color: string }[];
}
type View = ReturnType<typeof useProviderNavigationState>['currentView'];
interface Props {
  analyticsData: AnalyticsData | null;
  chartTimeRange: 'week' | 'month' | 'year';
  handlePeriodChange: (period: 'week' | 'month' | 'year') => Promise<void>;
  provider?: { _id?: string; businessName?: string } | null;
  orders?: Order[];
  loadingOrders?: boolean;
  notifications?: { _id: string; title?: string; message?: string; createdAt: string; isRead: boolean }[];
  onNavigate?: (view: View) => void;
  getNotiTimeAgo?: (date: string) => string;
}
export function AnalyticsIcon({ name }: { name: string }) {
  return <span className="pa-icon"><img src={`/provider-analytics/${name}.svg`} width="20" height="20" alt="" /></span>;
}
function SectionHeading({ title, onClick }: { title: string; onClick?: () => void }) {
  return <div className="pa-section-heading"><h3>{title}</h3>{onClick && <button onClick={onClick}>Xem tất cả <span aria-hidden="true">›</span></button>}</div>;
}
export function AnalyticsPanel({ analyticsData: data, chartTimeRange, handlePeriodChange, provider, orders = [], loadingOrders = false, notifications = [], onNavigate = () => {}, getNotiTimeAgo = () => '' }: Props) {
  const [service, setService] = useState<'shop' | 'photo'>('shop');
  if (!data) return <div className="pa-loading" role="status">Đang tải số liệu phân tích...</div>;
  const shop = data.capabilities?.some(c => ['AODAI_RENTAL', 'COSTUME_RENTAL', 'RENTAL'].includes(c));
  const photo = data.capabilities?.includes('PHOTOGRAPHY');
  const selectedService = !shop ? 'photo' : !photo ? 'shop' : service;
  const pending = orders.filter(o => ['PENDING', 'DEPOSIT_PAID'].includes(o.rawStatus || '')).length;
  const schedules = data.upcomingSchedules || [];
  const unread = notifications.filter(n => !n.isRead).length;
  const rented = data.inventoryStatus?.find(s => s.status === 'RENTED')?.count ?? 0;
  const money = (n?: number) => n == null ? '—' : `${n.toLocaleString('vi-VN')} đ`;
  const value = (n?: number, suffix = '') => n == null ? '—' : `${n}${suffix}`;
  const tasks = [
    { icon: 'booking', title: `${pending} đơn đặt lịch chờ xử lý`, detail: 'Kiểm tra và phản hồi khách hàng', view: 'orders' as View },
    ...(shop ? [{ icon: 'bag', title: `${rented} hiện vật đang được thuê`, detail: 'Theo dõi giao và nhận trang phục', view: 'rental-operations' as View }] : []),
    ...(photo ? [{ icon: 'clock', title: `${schedules.length} lịch chụp sắp tới`, detail: 'Chuẩn bị cho buổi chụp tiếp theo', view: 'calendar' as View }] : []),
    { icon: 'tasks', title: `${unread} thông báo chưa đọc`, detail: 'Cập nhật hoạt động cửa hàng', view: 'notifications' as View },
  ];
  const metrics = [
    { icon: 'revenue', label: 'Tổng doanh thu', value: money(data.totalRevenue), note: 'Doanh thu tích lũy', view: 'payouts' as View },
    { icon: 'booking', label: 'Booking chờ xử lý', value: loadingOrders ? '…' : String(pending), note: 'Đơn chờ xác nhận', view: 'orders' as View },
    { icon: 'clock', label: 'Lịch sắp tới', value: String(schedules.length), note: 'Lịch chụp được hiển thị', view: 'calendar' as View },
    { icon: 'bag', label: shop ? 'Đang thuê áo dài' : 'Phí hoa hồng', value: shop ? String(rented) : money(data.commissionFee), note: shop ? 'Hiện vật đang cho thuê' : 'Phí hoa hồng hệ thống', view: shop ? 'rental-operations' as View : 'payouts' as View },
    { icon: 'star', label: 'Tỷ lệ hoàn thành', value: value(data.successRate, '%'), note: 'Trên tổng số đơn hàng', view: 'orders' as View },
    { icon: 'tasks', label: 'Cần xử lý', value: loadingOrders ? '…' : String(pending), note: 'Ưu tiên', view: 'orders' as View },
  ];
  return <div className="provider-analytics" data-testid="provider-analytics">
    <section className="pa-welcome"><div><h2>Xin chào, {provider?.businessName || 'bạn'}! <span aria-hidden="true">👋</span></h2><p>Cùng xem tình hình kinh doanh và những việc cần xử lý hôm nay nhé!</p></div><div className="pa-welcome-actions"><span className="pa-date"><img src="/provider-analytics/booking.svg" width="16" height="16" alt="" />{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })}</span>{provider?._id && <a className="pa-store" href={`/stores/${encodeURIComponent(provider._id)}`} target="_blank" rel="noreferrer">Xem cửa hàng của tôi <img src="/provider-analytics/external.svg" width="14" height="14" alt="" /></a>}</div></section>
    <section className="pa-metrics" aria-label="Chỉ số kinh doanh">{metrics.map(m => <button className="pa-card pa-metric" key={m.label} onClick={() => onNavigate(m.view)}><span className="pa-metric-heading"><AnalyticsIcon name={m.icon} /><span>{m.label}</span></span><strong>{m.value}</strong><span className="pa-metric-note"><span className={m.note === 'Ưu tiên' ? 'pa-priority' : ''}>{m.note}</span><span aria-hidden="true">›</span></span></button>)}</section>
    <div className="pa-middle"><AnalyticsRevenueChart series={data.revenueGrowth || []} period={chartTimeRange} onPeriodChange={handlePeriodChange} /><section className="pa-card pa-schedules"><SectionHeading title="Lịch sắp tới" onClick={() => onNavigate('calendar')} />{schedules.length ? schedules.map((s, i) => <button className="pa-schedule" key={`${s.date}-${s.time}-${i}`} onClick={() => onNavigate('calendar')}><span className="pa-day"><b>{s.date.split('/')[0] || '—'}</b><small>TH{s.date.split('/')[1] || '—'}</small></span><span className="pa-avatar">{s.customerName.split(' ').slice(-2).map(n => n[0]).join('')}</span><span className="pa-row-text"><strong>{s.customerName}</strong><span>Lịch chụp ảnh</span><small>{s.date} · {s.time}</small></span><span className={`pa-status ${s.color === 'deposit' ? 'pa-status-green' : ''}`}>{s.status}</span><span className="pa-more" aria-hidden="true">•••</span></button>) : <p className="pa-empty">Chưa có lịch chụp sắp tới.</p>}</section></div>
    <div className="pa-bottom">
      <section className="pa-card"><SectionHeading title="Việc cần xử lý" onClick={() => onNavigate('orders')} />{tasks.map(t => <button className="pa-list-row" key={t.view} onClick={() => onNavigate(t.view)}><AnalyticsIcon name={t.icon} /><span className="pa-row-text"><strong>{loadingOrders && t.view === 'orders' ? 'Đang tải đơn hàng…' : t.title}</strong><small>{t.detail}</small></span><span className="pa-more" aria-hidden="true">›</span></button>)}</section>
      <section className="pa-card"><SectionHeading title="Dịch vụ nổi bật" onClick={() => onNavigate(selectedService === 'shop' ? 'collections' : 'photography-packages')} /><div className="pa-tabs" aria-label="Loại dịch vụ">{shop && <button aria-pressed={selectedService === 'shop'} onClick={() => setService('shop')}>Áo dài</button>}{photo && <button aria-pressed={selectedService === 'photo'} onClick={() => setService('photo')}>Chụp ảnh</button>}</div>{selectedService === 'shop' ? (data.popularProducts?.length ? data.popularProducts.map((p, i) => <div className="pa-product pa-list-row" key={`${p.name}-${i}`}><span className={`pa-rank pa-rank-${i}`}>{i + 1}</span>{p.image ? <img className="pa-product-image" src={getImageUrl(p.image)} alt={p.name} /> : <AnalyticsIcon name="bag" />}<span className="pa-row-text"><strong>{p.name}</strong><small>{p.count} lượt thuê</small></span></div>) : <p className="pa-empty">Chưa có lượt thuê áo dài nào.</p>) : (data.popularConcepts?.length ? data.popularConcepts.map((c, i) => <div className="pa-concept" key={`${c.name}-${i}`}><div><strong>{c.name}</strong><span>{c.percentage}%</span></div><progress max="100" value={c.percentage} /></div>) : <p className="pa-empty">Chưa có gói concept nào được đặt.</p>)}</section>
      <section className="pa-card"><SectionHeading title="Hoạt động gần đây" onClick={() => onNavigate('notifications')} />{notifications.length ? notifications.slice(0, 5).map(n => <button className="pa-list-row pa-activity" key={n._id} onClick={() => onNavigate('notifications')}><AnalyticsIcon name="booking" /><span className="pa-row-text"><strong>{n.title}</strong><small>{n.message}</small></span><time dateTime={n.createdAt}>{getNotiTimeAgo(n.createdAt)}</time></button>) : <p className="pa-empty">Chưa có hoạt động mới.</p>}</section>
    </div>
    <section className="pa-card pa-performance"><SectionHeading title="Hiệu suất hoạt động" onClick={() => onNavigate('reviews')} /><div className="pa-performance-grid"><div><AnalyticsIcon name="star" /><span><small>Đánh giá trung bình</small><strong>{value(data.averageRating, ' / 5')}</strong><small>Từ đánh giá khách hàng</small></span></div><div><AnalyticsIcon name="customers" /><span><small>Tỷ lệ khách quay lại</small><strong>—</strong><small>Chưa có số liệu</small></span></div><div><AnalyticsIcon name="return" /><span><small>Tỷ lệ hủy đơn</small><strong>{value(data.cancelRate, '%')}</strong></span></div><div><AnalyticsIcon name="clock" /><span><small>{shop ? 'Thời gian thuê TB' : 'Thời gian phản hồi TB'}</small><strong>{shop ? data.averageRentalDuration || '—' : '—'}</strong><small>{data.averageRentalDuration && shop ? 'Theo dữ liệu thuê' : 'Chưa có số liệu'}</small></span></div><button className="pa-encouragement" onClick={() => onNavigate('profile')}><span aria-hidden="true">🏆</span><span><strong>Cố gắng lên!</strong><small>Hoàn thiện hồ sơ và chăm sóc khách hàng mỗi ngày.</small></span><b aria-hidden="true">›</b></button></div><div className="pa-secondary-metrics">{shop && <span>Tổng sản phẩm: <b>{value(data.totalProducts)}</b></span>}{photo && <span>Phí hoa hồng hệ thống: <b>{money(data.commissionFee)}</b></span>}</div></section>
  </div>;
}
