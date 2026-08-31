import React from 'react';
import { Camera, Download, ExternalLink, CheckCircle2, MessageSquareText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';
import { downloadPhotosAsZip, downloadSinglePhoto } from '../../../../utils/downloadUtils';
import { useToast } from '../../../../components/feedback/Toast';

interface PhotoshootDeliveredGalleryProps {
  photos?: string[];
  driveUrl?: string;
  bookingCode?: string;
  status?: string;
  onViewPhoto?: (url: string, index: number) => void;
  onConfirmComplete?: () => void;
  onOpenDisputeOrSupport?: () => void;
  isConfirming?: boolean;
}

export const PhotoshootDeliveredGallery: React.FC<PhotoshootDeliveredGalleryProps> = ({
  photos = [],
  driveUrl,
  bookingCode = 'PS-LUME',
  status,
  onViewPhoto,
  onConfirmComplete,
  onOpenDisputeOrSupport,
  isConfirming = false
}) => {
  const toast = useToast();
  const hasPhotos = photos.length > 0 || Boolean(driveUrl);
  const isAwaitingReview = status === 'AWAITING_REVIEW';

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EFE9E1',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}
    >
      {/* Header section with Drive Link & Download All */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} color="#8B1E2D" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#231F20' }}>
              Kho ảnh kết quả từ Nhiếp ảnh gia
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: '#8C827A' }}>
            {hasPhotos
              ? `Đã nhận được ${photos.length} ảnh xem trước và đường dẫn tải ảnh chất lượng cao.`
              : 'Ảnh chụp sau buổi làm việc sẽ được cập nhật tại đây.'}
          </span>
        </div>

        {hasPhotos && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  textDecoration: 'none',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
                }}
              >
                <ExternalLink size={14} />
                <span>Mở Kho Ảnh Gốc (Google Drive)</span>
              </a>
            )}

            {photos.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const zipName = `anh_chup_${bookingCode}.zip`;
                  void downloadPhotosAsZip(photos, zipName, toast);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#1E40AF',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                <span>Tải tất cả ({photos.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Awaiting Review Action Banner */}
      {isAwaitingReview && (
        <div
          style={{
            backgroundColor: '#FFFBEB',
            borderRadius: '12px',
            border: '1px solid #FCD34D',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '540px' }}>
            <AlertCircle size={20} color="#B45309" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '13.5px', fontWeight: 800, color: '#92400E' }}>
                Xác nhận kết quả buổi chụp ảnh
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#78350F', lineHeight: 1.4 }}>
                Vui lòng kiểm tra ảnh trong link Google Drive hoặc danh sách bên dưới. Nếu hài lòng, hãy bấm <strong>Xác nhận hài lòng</strong> để hoàn tất đơn và đánh giá thợ chụp.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenDisputeOrSupport && (
              <button
                type="button"
                onClick={onOpenDisputeOrSupport}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #DED7CB',
                  color: '#4A3F35',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MessageSquareText size={14} />
                <span>Yêu cầu sửa thêm</span>
              </button>
            )}

            {onConfirmComplete && (
              <button
                type="button"
                disabled={isConfirming}
                onClick={onConfirmComplete}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: isConfirming ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)'
                }}
              >
                <CheckCircle2 size={15} />
                <span>{isConfirming ? 'Đang xử lý...' : '✓ Duyệt ảnh & Hoàn tất'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Photo Gallery Grid */}
      {photos.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '12px'
          }}
        >
          {photos.map((photoUrl, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                aspectRatio: '1/1',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid #ECE5DB',
                backgroundColor: '#F8F5F1',
                cursor: 'pointer'
              }}
              onClick={() => onViewPhoto?.(photoUrl, idx)}
            >
              <ImageWithFallback
                src={photoUrl}
                alt={`Ảnh chụp kết quả ${idx + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                fallback={
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                    <ImageIcon size={24} />
                  </div>
                }
              />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void downloadSinglePhoto(photoUrl, `anh_chup_${idx + 1}.jpg`);
                }}
                style={{
                  position: 'absolute',
                  bottom: '6px',
                  right: '6px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Tải ảnh này về máy"
              >
                <Download size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : !driveUrl ? (
        /* Empty State */
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: '#FCFAF8',
            borderRadius: '12px',
            border: '1px dashed #E2DACF',
            color: '#8C827A',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Camera size={32} color="#C4B7A6" />
          <span style={{ fontWeight: 700, color: '#4A3F35' }}>Chưa có ảnh bàn giao từ buổi chụp</span>
          <span style={{ fontSize: '11.5px', color: '#8C827A', maxWidth: '420px', lineHeight: 1.5 }}>
            Sau khi hoàn tất buổi chụp, nhiếp ảnh gia sẽ tải lên ảnh demo và link Google Drive lưu trữ toàn bộ ảnh gốc có độ phân giải cao tại đây.
          </span>
        </div>
      ) : null}
    </div>
  );
};
