import React from 'react';
import { Search, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ScheduleToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: 'NEAR_DUE' | 'NEWEST' | 'OLDEST';
  onSortChange: (s: 'NEAR_DUE' | 'NEWEST' | 'OLDEST') => void;
  activeCategory: 'RENTAL' | 'PHOTOSHOOT' | 'COMBO';
}

export const ScheduleToolbar: React.FC<ScheduleToolbarProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  activeCategory
}) => {
  const navigate = useNavigate();

  const getActionBtnText = () => {
    if (activeCategory === 'PHOTOSHOOT') return '+ Đặt lịch chụp mới';
    if (activeCategory === 'COMBO') return '+ Đặt combo mới';
    return '+ Thuê áo dài mới';
  };

  const handleAction = () => {
    if (activeCategory === 'PHOTOSHOOT') navigate('/photographers');
    else if (activeCategory === 'COMBO') navigate('/combos');
    else navigate('/rentals');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap'
      }}
    >
      {/* Search Input Box */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minWidth: '280px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <Search
          size={16}
          style={{ position: 'absolute', left: '14px', color: '#8C827A', pointerEvents: 'none' }}
        />
        <input
          type="text"
          placeholder="Tìm kiếm áo dài, mã thuê..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px 10px 40px',
            borderRadius: '10px',
            border: '1px solid #DED7CB',
            backgroundColor: '#FFFFFF',
            fontSize: '13px',
            color: '#231F20',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as any)}
          style={{
            padding: '9px 14px',
            borderRadius: '10px',
            border: '1px solid #DED7CB',
            backgroundColor: '#FFFFFF',
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#4A3F35',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="NEAR_DUE">Sắp xếp: Gần hết hạn ⌄</option>
          <option value="NEWEST">Sắp xếp: Mới nhất ⌄</option>
          <option value="OLDEST">Sắp xếp: Cũ nhất ⌄</option>
        </select>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handleAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 20px',
            borderRadius: '10px',
            backgroundColor: '#8B1E2D',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '13px',
            fontWeight: 750,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(139, 30, 45, 0.25)',
            transition: 'background-color 0.15s',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#721824')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#8B1E2D')}
        >
          <Plus size={15} />
          <span>{getActionBtnText()}</span>
        </button>
      </div>
    </div>
  );
};
