import React, { useState } from 'react';
import { useToast } from '../../../../components/feedback/Toast';

interface NotificationPreferencesCardProps {
  onViewAllNotifications: () => void;
}

export const NotificationPreferencesCard: React.FC<NotificationPreferencesCardProps> = ({
  onViewAllNotifications
}) => {
  const toast = useToast();
  const [promotions, setPromotions] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [orders, setOrders] = useState(true);
  const [newsletter, setNewsletter] = useState(false);

  const handleToggle = (setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean) => {
    setter(!value);
    toast.success('Đã cập nhật tùy chọn thông báo!');
  };

  return (
    <div className="lume-form-card">
      <div className="lume-form-card-header">
        <h3 className="lume-form-card-title">Thông báo</h3>
        <p className="lume-form-card-subtitle">Tùy chỉnh thông báo bạn muốn nhận</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Toggle 1 */}
        <div className="lume-toggle-item">
          <div className="lume-toggle-info">
            <h4 className="lume-toggle-title">Khuyến mãi & ưu đãi</h4>
            <p className="lume-toggle-desc">Nhận thông tin khuyến mãi mới nhất</p>
          </div>
          <label className="lume-switch">
            <input
              type="checkbox"
              checked={promotions}
              onChange={() => handleToggle(setPromotions, promotions)}
            />
            <span className="lume-slider" />
          </label>
        </div>

        {/* Toggle 2 */}
        <div className="lume-toggle-item">
          <div className="lume-toggle-info">
            <h4 className="lume-toggle-title">Nhắc lịch chụp</h4>
            <p className="lume-toggle-desc">Nhận thông báo nhắc lịch trước buổi chụp</p>
          </div>
          <label className="lume-switch">
            <input
              type="checkbox"
              checked={reminders}
              onChange={() => handleToggle(setReminders, reminders)}
            />
            <span className="lume-slider" />
          </label>
        </div>

        {/* Toggle 3 */}
        <div className="lume-toggle-item">
          <div className="lume-toggle-info">
            <h4 className="lume-toggle-title">Cập nhật đơn hàng</h4>
            <p className="lume-toggle-desc">Nhận thông báo về trạng thái đơn hàng</p>
          </div>
          <label className="lume-switch">
            <input
              type="checkbox"
              checked={orders}
              onChange={() => handleToggle(setOrders, orders)}
            />
            <span className="lume-slider" />
          </label>
        </div>

        {/* Toggle 4 */}
        <div className="lume-toggle-item">
          <div className="lume-toggle-info">
            <h4 className="lume-toggle-title">Bản tin từ LUMÉ</h4>
            <p className="lume-toggle-desc">Nhận bản tin và xu hướng mới từ LUMÉ</p>
          </div>
          <label className="lume-switch">
            <input
              type="checkbox"
              checked={newsletter}
              onChange={() => handleToggle(setNewsletter, newsletter)}
            />
            <span className="lume-slider" />
          </label>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '11.5px', color: '#8C827A', fontStyle: 'italic' }}>
        * Chúng tôi sẽ gửi thông báo qua Email và App của LUMÉ
      </p>

      <button
        type="button"
        onClick={onViewAllNotifications}
        className="lume-recent-orders-view-all-btn"
        style={{ marginTop: '2px' }}
      >
        Xem tất cả cài đặt thông báo
      </button>
    </div>
  );
};
