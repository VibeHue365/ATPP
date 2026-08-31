import React, { useState } from 'react';
import { ArrowUpRight, Gift, ChevronDown } from 'lucide-react';
import type { MonthlySpending } from '../../types/profile.types';

interface AnnualSpendingCardProps {
  totalSpent: number;
  savingsAmount?: number;
  monthlyData?: MonthlySpending[];
}

export const AnnualSpendingCard: React.FC<AnnualSpendingCardProps> = ({
  totalSpent = 0,
  savingsAmount = 0,
  monthlyData
}) => {
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [hoveredMonth, setHoveredMonth] = useState<MonthlySpending | null>(null);

  // Dynamic 12 months array (all 0 by default)
  const months: MonthlySpending[] = monthlyData || Array.from({ length: 12 }, (_, i) => ({
    month: `T${i + 1}`,
    monthNumber: i + 1,
    amount: 0,
    heightPercent: 12
  }));

  const formattedTotal = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  })
    .format(totalSpent)
    .replace('₫', 'đ');

  const formattedSavings = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  })
    .format(savingsAmount)
    .replace('₫', 'đ');

  return (
    <div className="lume-dashboard-card">
      <div className="lume-dashboard-card-header">
        <h3 className="lume-dashboard-card-title">Chi tiêu trong năm</h3>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{
              appearance: 'none',
              backgroundColor: '#F8F5F1',
              border: '1px solid #E5DFD5',
              borderRadius: '8px',
              padding: '4px 24px 4px 10px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#4A3F35',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
          <ChevronDown
            size={12}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#8C827A'
            }}
          />
        </div>
      </div>

      <div className="lume-spending-amount-row">
        <span className="lume-spending-total">{formattedTotal}</span>
        <span className="lume-spending-trend">
          {totalSpent > 0 ? (
            <>
              <ArrowUpRight size={13} /> Năm {selectedYear}
            </>
          ) : (
            `Chưa có chi tiêu trong năm ${selectedYear}`
          )}
        </span>
      </div>

      {/* 12-Month Bar Chart */}
      <div className="lume-spending-chart-wrapper">
        <div className="lume-bar-chart">
          {months.map((m) => {
            const isHovered = hoveredMonth?.month === m.month;
            return (
              <div
                key={m.month}
                className="lume-chart-bar-column"
                onMouseEnter={() => setHoveredMonth(m)}
                onMouseLeave={() => setHoveredMonth(null)}
              >
                {isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: `${Math.max(25, m.heightPercent)}%`,
                      backgroundColor: '#231F20',
                      color: '#FFFFFF',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      zIndex: 10,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                    }}
                  >
                    {m.amount.toLocaleString('vi-VN')}đ
                  </div>
                )}
                <div
                  className={`lume-chart-bar ${isHovered ? 'active' : ''}`}
                  style={{ height: `${Math.max(12, m.heightPercent)}%` }}
                />
                <span className="lume-chart-label">{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Savings Callout Banner */}
      <div className="lume-savings-banner">
        <Gift size={18} className="lume-savings-icon" />
        <span className="lume-savings-text">
          {savingsAmount > 0 ? (
            <>
              Bạn đã tiết kiệm được <strong>{formattedSavings}</strong> nhờ các ưu đãi & khuyến mãi độc quyền tại LUMÉ.
            </>
          ) : (
            'Hãy áp dụng các mã ưu đãi độc quyền bên dưới để tiết kiệm chi phí khi đặt dịch vụ.'
          )}
        </span>
      </div>
    </div>
  );
};
