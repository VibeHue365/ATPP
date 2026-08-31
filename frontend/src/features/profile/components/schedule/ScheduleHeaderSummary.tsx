import React from 'react';
import { User, Pencil, Clock, Shirt, Camera, Package, Heart } from 'lucide-react';

interface ScheduleHeaderSummaryProps {
  fullName?: string;
  onEditProfile: () => void;
  onViewUrgentDetail: () => void;
  urgentItem?: any;
  urgentCount?: number;
  stats?: {
    activeRentals: number;
    upcomingShoots: number;
    upcomingCombos: number;
    favoritesCount: number;
  };
}

export const ScheduleHeaderSummary: React.FC<ScheduleHeaderSummaryProps> = ({
  fullName = 'Khách hàng LUMÉ',
  onEditProfile,
  onViewUrgentDetail,
  urgentItem,
  urgentCount = 0,
  stats = {
    activeRentals: 0,
    upcomingShoots: 0,
    upcomingCombos: 0,
    favoritesCount: 0
  }
}) => {
  const isOverdue = urgentItem?.type === 'OVERDUE';
  const alertBg = isOverdue ? '#FFF5F5' : '#FFF7EE';
  const alertBorder = isOverdue ? '#FECACA' : '#FED7AA';
  const alertIconBg = isOverdue ? '#FEE2E2' : '#FFEDD5';
  const alertIconColor = isOverdue ? '#DC2626' : '#EA580C';
  const alertTextColor = isOverdue ? '#991B1B' : '#9A3412';
  const alertSubColor = isOverdue ? '#B91C1C' : '#C2410C';
  const alertBtnBorder = isOverdue ? '#FCA5A5' : '#FDBA74';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Greeting Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#EAE6E1',
              color: '#8C827A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <User size={24} />
          </div>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: '#231F20' }}>
              Xin chào, {fullName} 👋
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#8C827A' }}>
              Chúc bạn một ngày tuyệt vời cùng LUMÉ!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onEditProfile}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #DED7CB',
            color: '#231F20',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#FDF2F4';
            e.currentTarget.style.borderColor = '#8B1E2D';
            e.currentTarget.style.color = '#8B1E2D';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#DED7CB';
            e.currentTarget.style.color = '#231F20';
          }}
        >
          <Pencil size={14} />
          <span>Chỉnh sửa hồ sơ</span>
        </button>
      </div>

      {/* 2. Four Quick Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Thuê áo dài */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EFE9E1',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#FDF2F4',
              color: '#8B1E2D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Shirt size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#231F20' }}>
                {String(stats.activeRentals).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#231F20' }}>Đang thuê áo dài</span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#8C827A' }}>
              {urgentCount > 0 ? `${urgentCount} đơn cần chú ý` : stats.activeRentals > 0 ? 'Đang hoạt động' : 'Chưa có đơn thuê'}
            </p>
          </div>
        </div>

        {/* Card 2: Lịch chụp sắp tới */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EFE9E1',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#FDF2F4',
              color: '#8B1E2D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Camera size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#231F20' }}>
                {String(stats.upcomingShoots).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#231F20' }}>Lịch chụp sắp tới</span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#8C827A' }}>
              {stats.upcomingShoots > 0 ? 'Đã lên lịch thành công' : 'Chưa có lịch chụp'}
            </p>
          </div>
        </div>

        {/* Card 3: Combo sắp tới */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EFE9E1',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#FDF2F4',
              color: '#8B1E2D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Package size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#231F20' }}>
                {String(stats.upcomingCombos).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#231F20' }}>Combo sắp tới</span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#8C827A' }}>
              {stats.upcomingCombos > 0 ? 'Trọn gói trang phục & chụp' : 'Chưa có combo'}
            </p>
          </div>
        </div>

        {/* Card 4: Yêu thích */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EFE9E1',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#FDF2F4',
              color: '#8B1E2D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Heart size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#231F20' }}>
                {String(stats.favoritesCount).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#231F20' }}>Yêu thích</span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#8C827A' }}>Áo dài & gói chụp</p>
          </div>
        </div>
      </div>

      {/* 3. Warning Alert Banner (Only shown if there are real urgent items) */}
      {urgentItem && (
        <div
          style={{
            backgroundColor: alertBg,
            border: `1px solid ${alertBorder}`,
            borderRadius: '14px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: alertIconBg,
                color: alertIconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Clock size={18} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '13.5px', fontWeight: 800, color: alertTextColor }}>
                {isOverdue
                  ? `Bạn có ${urgentCount} đơn đã quá hạn trả đồ!`
                  : `Bạn có ${urgentCount} đơn sắp đến hạn trả!`}
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: alertSubColor }}>
                {urgentItem.title} – Hạn trả: {urgentItem.dueDate} ({urgentItem.countdownLabel} {urgentItem.countdownValue})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewUrgentDetail}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              border: `1px solid ${alertBtnBorder}`,
              color: alertIconColor,
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = alertIconColor;
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.color = alertIconColor;
            }}
          >
            Xem chi tiết
          </button>
        </div>
      )}
    </div>
  );
};
