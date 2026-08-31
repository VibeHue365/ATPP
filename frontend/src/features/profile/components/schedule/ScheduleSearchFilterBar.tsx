import React from 'react';
import { Search, LayoutList, Calendar as CalendarIcon, ArrowUpDown } from 'lucide-react';
import '../ProfilePage.css';

interface ScheduleSearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  serviceType: 'ALL' | 'PHOTOSHOOT' | 'RENTAL';
  onServiceTypeChange: (t: 'ALL' | 'PHOTOSHOOT' | 'RENTAL') => void;
  viewMode: 'LIST' | 'CALENDAR';
  onViewModeChange: (v: 'LIST' | 'CALENDAR') => void;
  sortBy: 'NEWEST' | 'OLDEST' | 'DATE_NEAR';
  onSortByChange: (s: 'NEWEST' | 'OLDEST' | 'DATE_NEAR') => void;
}

export const ScheduleSearchFilterBar: React.FC<ScheduleSearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  serviceType,
  onServiceTypeChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortByChange
}) => {
  return (
    <div
      className="lume-schedule-toolbar"
      style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EFE9E1',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}
    >
      {/* Search Input Box */}
      <div
        className="lume-schedule-search-box"
        style={{
          position: 'relative',
          flex: 1,
          minWidth: '260px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <Search
          size={16}
          className="lume-schedule-search-icon"
          style={{ position: 'absolute', left: '12px', color: '#8C827A', pointerEvents: 'none' }}
        />
        <input
          type="text"
          className="lume-schedule-search-input"
          placeholder="Tìm theo mã đơn, gói chụp, áo dài, thợ ảnh..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 12px 9px 38px',
            borderRadius: '10px',
            border: '1px solid #DED7CB',
            background: '#FCFAF8',
            fontSize: '13px',
            color: '#231F20',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Toolbar Controls */}
      <div
        className="lume-schedule-toolbar-controls"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        {/* Service Type Toggle */}
        <div
          className="lume-schedule-type-toggle"
          style={{
            display: 'inline-flex',
            background: '#F4EFEA',
            borderRadius: '10px',
            padding: '3px',
            gap: '2px'
          }}
        >
          <button
            type="button"
            className={`lume-schedule-type-btn ${serviceType === 'ALL' ? 'active' : ''}`}
            onClick={() => onServiceTypeChange('ALL')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: serviceType === 'ALL' ? '#FFFFFF' : 'transparent',
              color: serviceType === 'ALL' ? '#8B1E2D' : '#574D4F',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: serviceType === 'ALL' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`lume-schedule-type-btn ${serviceType === 'PHOTOSHOOT' ? 'active' : ''}`}
            onClick={() => onServiceTypeChange('PHOTOSHOOT')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: serviceType === 'PHOTOSHOOT' ? '#FFFFFF' : 'transparent',
              color: serviceType === 'PHOTOSHOOT' ? '#8B1E2D' : '#574D4F',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: serviceType === 'PHOTOSHOOT' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            📷 Lịch chụp
          </button>
          <button
            type="button"
            className={`lume-schedule-type-btn ${serviceType === 'RENTAL' ? 'active' : ''}`}
            onClick={() => onServiceTypeChange('RENTAL')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: serviceType === 'RENTAL' ? '#FFFFFF' : 'transparent',
              color: serviceType === 'RENTAL' ? '#8B1E2D' : '#574D4F',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: serviceType === 'RENTAL' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            👘 Thuê áo
          </button>
        </div>

        {/* Sort select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowUpDown size={14} color="#8C827A" />
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as any)}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #DED7CB',
              backgroundColor: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              color: '#4A3F35',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="NEWEST">Mới nhất</option>
            <option value="DATE_NEAR">Gần ngày chụp nhất</option>
            <option value="OLDEST">Cũ nhất</option>
          </select>
        </div>

        {/* View Switcher (List vs Calendar) */}
        <div
          className="lume-schedule-view-switcher"
          style={{
            display: 'inline-flex',
            border: '1px solid #DED7CB',
            borderRadius: '10px',
            overflow: 'hidden',
            backgroundColor: '#FFFFFF'
          }}
        >
          <button
            type="button"
            title="Xem dạng danh sách thẻ"
            className={`lume-schedule-view-btn ${viewMode === 'LIST' ? 'active' : ''}`}
            onClick={() => onViewModeChange('LIST')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 12px',
              border: 'none',
              backgroundColor: viewMode === 'LIST' ? '#8B1E2D' : 'transparent',
              color: viewMode === 'LIST' ? '#FFFFFF' : '#8C827A',
              cursor: 'pointer'
            }}
          >
            <LayoutList size={16} />
          </button>
          <button
            type="button"
            title="Xem dạng lịch tháng"
            className={`lume-schedule-view-btn ${viewMode === 'CALENDAR' ? 'active' : ''}`}
            onClick={() => onViewModeChange('CALENDAR')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 12px',
              border: 'none',
              backgroundColor: viewMode === 'CALENDAR' ? '#8B1E2D' : 'transparent',
              color: viewMode === 'CALENDAR' ? '#FFFFFF' : '#8C827A',
              cursor: 'pointer'
            }}
          >
            <CalendarIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
