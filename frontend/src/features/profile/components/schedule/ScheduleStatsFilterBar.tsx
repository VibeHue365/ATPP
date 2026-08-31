import React from 'react';
import '../ProfilePage.css';

export type ScheduleStatusFilter = 'ALL' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

interface ScheduleStatsFilterBarProps {
  currentFilter: ScheduleStatusFilter;
  onSelectFilter: (filter: ScheduleStatusFilter) => void;
  counts: {
    all: number;
    upcoming: number;
    active: number;
    completed: number;
    cancelled: number;
  };
}

export const ScheduleStatsFilterBar: React.FC<ScheduleStatsFilterBarProps> = ({
  currentFilter,
  onSelectFilter,
  counts
}) => {
  const filterOptions: { key: ScheduleStatusFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'Tất cả lịch hẹn', count: counts.all },
    { key: 'UPCOMING', label: 'Sắp tới', count: counts.upcoming },
    { key: 'ACTIVE', label: 'Đang thuê / Đang chụp', count: counts.active },
    { key: 'COMPLETED', label: 'Đã hoàn thành', count: counts.completed },
    { key: 'CANCELLED', label: 'Đã hủy', count: counts.cancelled }
  ];

  return (
    <div
      className="lume-schedule-stats-filter-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '4px',
        flexWrap: 'wrap'
      }}
    >
      {filterOptions.map((opt) => {
        const isActive = currentFilter === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            className={`lume-filter-pill-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelectFilter(opt.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '999px',
              backgroundColor: isActive ? '#8B1E2D' : '#F8F5F1',
              border: isActive ? '1px solid #8B1E2D' : '1px solid #EAE3D8',
              color: isActive ? '#FFFFFF' : '#574D4F',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s'
            }}
          >
            <span>{opt.label}</span>
            <span
              className="lume-filter-pill-count"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                borderRadius: '999px',
                backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                color: isActive ? '#FFFFFF' : '#7D736B',
                fontSize: '11px',
                fontWeight: 800
              }}
            >
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
