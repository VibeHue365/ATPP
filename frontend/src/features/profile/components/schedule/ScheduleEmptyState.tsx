import React from 'react';
import { CalendarX, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ScheduleEmptyStateProps {
  onResetFilters: () => void;
  hasFilters: boolean;
}

export const ScheduleEmptyState: React.FC<ScheduleEmptyStateProps> = ({
  onResetFilters,
  hasFilters
}) => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px dashed #DED7CB',
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '16px'
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#FDF2F4',
          color: '#8B1E2D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <CalendarX size={28} />
      </div>

      <div style={{ maxWidth: '400px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#231F20', margin: '0 0 6px 0' }}>
          {hasFilters ? 'Không tìm thấy lịch hẹn phù hợp' : 'Bạn chưa có lịch hẹn nào'}
        </h4>
        <p style={{ fontSize: '13px', color: '#8C827A', margin: 0, lineHeight: 1.5 }}>
          {hasFilters
            ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc trạng thái để xem đầy đủ lịch của bạn.'
            : 'Hãy trải nghiệm dịch vụ thuê áo dài cao cấp hoặc đặt lịch chụp ảnh kỷ niệm tuyệt đẹp cùng LUMÉ ngay hôm nay.'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
        {hasFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #DED7CB',
              color: '#4A3F35',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Xóa bộ lọc
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => navigate('/rentals')}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                backgroundColor: '#8B1E2D',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: 750,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={14} />
              <span>Khám phá áo dài</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/photographers')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #DED7CB',
                color: '#4A3F35',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Đặt thợ chụp ảnh
            </button>
          </>
        )}
      </div>
    </div>
  );
};
