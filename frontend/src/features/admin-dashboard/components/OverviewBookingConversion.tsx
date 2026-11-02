import type { BookingConversionMetrics } from '../types';

interface Props {
  data: BookingConversionMetrics;
  formatNumber: (value: number) => string;
}

const metricItems = [
  { key: 'completionRate', countKey: 'completedBookings', label: 'Hoàn thành', color: '#059669' },
  { key: 'cancellationRate', countKey: 'cancelledBookings', label: 'Đã hủy', color: '#DC2626' },
  { key: 'disputeRate', countKey: 'disputedBookings', label: 'Tranh chấp', color: '#D97706' },
] as const;

export function OverviewBookingConversion({ data, formatNumber }: Props) {
  return (
    <section className="lume-chart-card lume-conversion-card" aria-label="Tỷ lệ chuyển đổi booking">
      <div className="lume-chart-card__header">
        <div className="lume-chart-card__title-group">
          <h3>Tỷ lệ trạng thái booking</h3>
          <p>Phân bổ booking hoàn thành, hủy và tranh chấp.</p>
        </div>
        <strong className="lume-conversion-card__total">{formatNumber(data.totalBookings)} booking</strong>
      </div>
      <div className="lume-conversion-list">
        {metricItems.map(({ key, countKey, label, color }) => {
          const rate = data[key];
          return (
            <div className="lume-conversion-row" key={key}>
              <div className="lume-conversion-row__label"><span style={{ backgroundColor: color }} /><span>{label}</span></div>
              <div className="lume-conversion-row__bar" aria-label={`${label}: ${rate}%`}><i style={{ width: `${Math.min(Math.max(rate, 0), 100)}%`, backgroundColor: color }} /></div>
              <strong>{rate}%</strong>
              <small>{formatNumber(data[countKey])}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
