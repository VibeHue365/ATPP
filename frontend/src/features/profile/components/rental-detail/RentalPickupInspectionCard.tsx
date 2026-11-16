import React from 'react';
import { ShieldCheck, AlertTriangle, CheckSquare, XCircle, Image as ImageIcon, Info } from 'lucide-react';
import { getMediaUrl } from '../../../../shared/media/mediaUrl';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';
import { RentalEvidenceImage } from '../../../rentals/components/RentalEvidenceImage';

interface RentalPickupInspectionCardProps {
  handoverPhotos?: any[];
  bookingId?: string;
  itemId?: string;
  isSubmitting?: boolean;
  onOpenConfirmModal: () => void;
  onOpenDamageModal: () => void;
  onOpenRejectModal: () => void;
  onViewPhoto?: (url: string) => void;
}

export const RentalPickupInspectionCard: React.FC<RentalPickupInspectionCardProps> = ({
  handoverPhotos = [],
  bookingId,
  itemId,
  isSubmitting = false,
  onOpenConfirmModal,
  onOpenDamageModal,
  onOpenRejectModal,
  onViewPhoto
}) => {
  const photos = Array.isArray(handoverPhotos) ? handoverPhotos : [];

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1.5px solid #E2DACF',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}
    >
      {/* 1. Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#FDF2F4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8E1B2E',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#231F20' }}>
              Kiểm tra áo khi nhận
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#7D736B' }}>
              Bắt buộc đối soát hiện trạng trang phục trước khi nhận đồ tại cửa hàng
            </p>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FDF2F4',
            border: '1px solid #F7D5DA',
            color: '#8E1B2E',
            padding: '4px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 750
          }}
        >
          Chờ bạn đối soát
        </div>
      </div>

      {/* 2. Instruction Banner */}
      <div
        style={{
          backgroundColor: '#FCFAF8',
          border: '1px solid #F0ECE4',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}
      >
        <Info size={16} color="#8E1B2E" style={{ marginTop: '2px', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '13px', color: '#574D4F', lineHeight: 1.5, fontWeight: 500 }}>
          Vui lòng so sánh ảnh shop cung cấp với tình trạng thực tế của áo và phụ kiện. Nếu phát hiện vết bẩn, rách, thiếu phụ kiện hoặc sai sản phẩm, hãy báo cáo trước khi xác nhận nhận áo.
        </p>
      </div>

      {/* 3. Shop Handover Photos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 750, color: '#231F20' }}>
          Ảnh bàn giao từ Shop {photos.length > 0 ? `(${photos.length} ảnh):` : ''}
        </span>

        {photos.length === 0 ? (
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#F8F5F1',
              borderRadius: '10px',
              border: '1px dashed #DED7CB',
              color: '#7D736B',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <ImageIcon size={18} color="#8C827A" />
            <span>Shop chưa cung cấp ảnh bàn giao. Bạn nên tự chụp ảnh hiện trạng trước khi nhận.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {photos.map((photo, index) => {
              const rawUrl = typeof photo === 'string' ? photo : (photo as any)?.url || '';
              const fileId = typeof photo === 'object' ? (photo as any)?.fileId : undefined;
              const resolvedUrl = getMediaUrl(rawUrl) || rawUrl;
              return (
                <div
                  key={index}
                  onClick={() => onViewPhoto?.(resolvedUrl)}
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid #ECE5DB',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                    cursor: 'pointer',
                    position: 'relative',
                    backgroundColor: '#F8F5F1'
                  }}
                  title="Bấm để xem ảnh phóng to"
                >
                  {fileId && bookingId && itemId ? (
                    <RentalEvidenceImage
                      bookingId={bookingId}
                      itemId={itemId}
                      fileId={fileId}
                      alt={`Ảnh shop bàn giao ${index + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <ImageWithFallback
                      src={resolvedUrl}
                      alt={`Ảnh shop bàn giao ${index + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      fallback={
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                          <ImageIcon size={22} />
                        </div>
                      }
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      left: '4px',
                      right: '4px',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: '4px',
                      padding: '1px 4px',
                      color: '#FFFFFF',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      textAlign: 'center'
                    }}
                  >
                    Ảnh #{index + 1}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Action Buttons Divider */}
      <div style={{ borderTop: '1px solid #F0ECE4', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Action A: Confirm normal */}
          <button
            type="button"
            onClick={onOpenConfirmModal}
            disabled={isSubmitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              borderRadius: '10px',
              backgroundColor: '#059669',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 750,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
              transition: 'background-color 0.15s'
            }}
            onMouseOver={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#047857';
            }}
            onMouseOut={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#059669';
            }}
          >
            <CheckSquare size={16} />
            <span>Áo đúng tình trạng – Xác nhận nhận</span>
          </button>

          {/* Action B: Report damage but proceed */}
          <button
            type="button"
            onClick={onOpenDamageModal}
            disabled={isSubmitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '10px',
              backgroundColor: '#FEF3C7',
              border: '1.5px solid #FCD34D',
              color: '#B45309',
              fontSize: '13px',
              fontWeight: 750,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#FDE68A';
            }}
            onMouseOut={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#FEF3C7';
            }}
          >
            <AlertTriangle size={15} color="#B45309" />
            <span>Có vấn đề nhưng vẫn nhận áo</span>
          </button>

          {/* Action C: Reject handover */}
          <button
            type="button"
            onClick={onOpenRejectModal}
            disabled={isSubmitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #FECACA',
              color: '#DC2626',
              fontSize: '13px',
              fontWeight: 750,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#FEF2F2';
            }}
            onMouseOut={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
          >
            <XCircle size={15} color="#DC2626" />
            <span>Từ chối nhận áo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
