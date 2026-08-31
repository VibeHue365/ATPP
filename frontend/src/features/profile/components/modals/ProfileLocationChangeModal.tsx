import React, { useState } from 'react';
import { Modal } from '../../../../components/common/Modal';
import { PhotographyLocationPicker } from '../../../photographers/components/PhotographyLocationPicker';
import type { LocationSelection } from '../../../photographers/types/photographer.types';
import { httpClient } from '../../../../services/httpClient';
import { useToast } from '../../../../components/feedback/Toast';

interface ProfileLocationChangeModalProps {
  bookingId: string;
  schedule: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProfileLocationChangeModal: React.FC<ProfileLocationChangeModalProps> = ({
  bookingId,
  schedule,
  onClose,
  onSuccess
}) => {
  const toast = useToast();
  const [requestedLocation, setRequestedLocation] = useState<LocationSelection | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!requestedLocation) {
      toast.error('Vui lòng chọn địa điểm mới trên bản đồ');
      return;
    }

    setIsSubmitting(true);
    try {
      await httpClient.post(
        `/api/bookings/${bookingId}/photoshoot-schedules/${schedule._id}/location-change-requests`,
        {
          address: requestedLocation.address,
          latitude: requestedLocation.latitude,
          longitude: requestedLocation.longitude,
          note: note || undefined
        }
      );
      toast.success('Đã gửi yêu cầu đổi địa điểm. Chờ photographer xác nhận.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể gửi yêu cầu đổi địa điểm.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="YÊU CẦU ĐỔI ĐỊA ĐIỂM CHỤP"
      maxWidth="560px"
    >
      <div className="lume-modal-content-box animate-fade-in">
        <p style={{ margin: 0, fontSize: '12.5px', color: '#574D4F' }}>
          Vui lòng ghim địa điểm mới. Photographer sẽ xem xét và phản hồi trong thời gian sớm nhất.
        </p>

        <PhotographyLocationPicker
          value={requestedLocation}
          onSelect={setRequestedLocation}
        />

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú thêm về địa điểm (tùy chọn)..."
          maxLength={500}
          style={{
            minHeight: '70px',
            border: '1px solid #DED7CB',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '13px',
            boxSizing: 'border-box',
            outline: 'none',
            resize: 'none'
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #ECE5DB', paddingTop: '14px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, backgroundColor: '#FFFFFF', border: '1px solid #DED7CB', color: '#574D4F', cursor: 'pointer' }}
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!requestedLocation || isSubmitting}
            onClick={handleSubmit}
            style={{ padding: '8px 22px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 750, backgroundColor: '#8B1E2D', color: '#FFFFFF', border: 'none', cursor: !requestedLocation || isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
