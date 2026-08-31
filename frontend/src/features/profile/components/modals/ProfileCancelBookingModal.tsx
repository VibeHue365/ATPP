import React, { useState } from 'react';
import { Modal } from '../../../../components/common/Modal';
import { AlertTriangle } from 'lucide-react';
import { httpClient } from '../../../../services/httpClient';
import { useToast } from '../../../../components/feedback/Toast';

interface ProfileCancelBookingModalProps {
  booking: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProfileCancelBookingModal: React.FC<ProfileCancelBookingModalProps> = ({
  booking,
  onClose,
  onSuccess
}) => {
  const toast = useToast();
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancelBooking = async () => {
    if (!cancelReason.trim()) {
      toast.error('Vui lòng nhập lý do hủy đơn');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await httpClient.post<any>(`/api/bookings/${booking._id}/cancel`, {
        reason: cancelReason.trim()
      });

      if (response.success || response._id) {
        if (response.isFreeCancel) {
          toast.success(
            `Hủy đơn thành công! Khách hàng được hoàn trả 100% tiền cọc (${(response.refundAmount || 0).toLocaleString('vi-VN')}đ).`
          );
        } else {
          toast.info(
            `Hủy đơn thành công! ${response.penaltyReason || 'Bạn bị phạt mất cọc giữ chỗ do hủy sát giờ.'}`
          );
        }
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể hủy đơn đặt lịch này. Vui lòng kiểm tra lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="XÁC NHẬN HỦY LỊCH ĐẶT CHỖ"
      maxWidth="540px"
    >
      <div className="lume-modal-content-box animate-fade-in">
        {/* Policy Warning */}
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h5 style={{ color: '#991B1B', fontSize: '13px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={15} /> QUY ĐỊNH HOÀN TIỀN CỌC
          </h5>
          <ul style={{ fontSize: '12px', color: '#7F1D1D', paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <li><strong>Hủy trước 24 giờ:</strong> Hoàn trả <strong>100%</strong> tiền cọc đã đóng.</li>
            <li><strong>Hủy trong vòng 24 giờ:</strong> Phạt mất tiền cọc giữ chỗ (trừ đơn đặt trong vòng 60 phút).</li>
            <li><strong>Đơn chưa thanh toán:</strong> Hủy miễn phí bất kỳ lúc nào.</li>
          </ul>
        </div>

        {/* Input Reason */}
        <div>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#574D4F', marginBottom: '6px' }}>
            LÝ DO HỦY ĐƠN (BẮT BUỘC)
          </label>
          <textarea
            placeholder="Vui lòng cung cấp lý do hủy để chúng tôi hỗ trợ tốt hơn..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            required
            style={{
              width: '100%',
              minHeight: '75px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #DED7CB',
              fontSize: '13px',
              boxSizing: 'border-box',
              outline: 'none',
              resize: 'none'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #ECE5DB', paddingTop: '14px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, backgroundColor: '#FFFFFF', border: '1px solid #DED7CB', color: '#574D4F', cursor: 'pointer' }}
          >
            Quay lại
          </button>
          <button
            type="button"
            disabled={!cancelReason.trim() || isSubmitting}
            onClick={handleCancelBooking}
            style={{
              padding: '8px 22px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 750,
              backgroundColor: cancelReason.trim() ? '#C0392B' : '#CCC',
              color: '#FFFFFF',
              border: 'none',
              cursor: cancelReason.trim() && !isSubmitting ? 'pointer' : 'not-allowed'
            }}
          >
            {isSubmitting ? 'Đang hủy...' : 'Xác nhận hủy lịch'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
