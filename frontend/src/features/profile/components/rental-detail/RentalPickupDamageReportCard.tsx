import React from 'react';
import { AlertCircle, Clock, Image as ImageIcon } from 'lucide-react';
import { getMediaUrl } from '../../../../shared/media/mediaUrl';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';

interface RentalPickupDamageReportCardProps {
  report?: {
    reportedAt?: string | Date | null;
    description?: string | null;
    evidencePhotos?: any[];
  } | null;
  onViewPhoto?: (url: string) => void;
}

export const RentalPickupDamageReportCard: React.FC<RentalPickupDamageReportCardProps> = ({
  report,
  onViewPhoto
}) => {
  if (!report || (!report.description && (!report.evidencePhotos || report.evidencePhotos.length === 0))) {
    return null;
  }

  const reportedDateStr = report.reportedAt
    ? new Date(report.reportedAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : 'Lúc nhận đồ';

  const photos = Array.isArray(report.evidencePhotos) ? report.evidencePhotos : [];

  return (
    <div
      style={{
        backgroundColor: '#FFFDF9',
        borderRadius: '16px',
        border: '1.5px solid #FCD34D',
        boxShadow: '0 4px 20px rgba(217, 119, 6, 0.08)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#FEF3C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D97706',
              flexShrink: 0
            }}
          >
            <AlertCircle size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#92400E' }}>
              Tình Trạng Có Sẵn Được Ghi Nhận Khi Nhận Áo
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0 0 0', fontSize: '12px', color: '#B45309' }}>
              <Clock size={12} />
              <span>Ghi nhận lúc: {reportedDateStr}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            color: '#B45309',
            padding: '4px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 750
          }}
        >
          Đã báo tình trạng có sẵn khi nhận
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #EFE9E1',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#7D736B', textTransform: 'uppercase' }}>
          Mô tả lỗi / vấn đề khách đã ghi nhận:
        </span>
        <p style={{ margin: 0, fontSize: '13.5px', color: '#231F20', fontWeight: 600, lineHeight: 1.5 }}>
          "{report.description || 'Có vết lỗi khi nhận đồ'}"
        </p>
        <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
          ✓ Báo cáo này dùng để đối soát và bảo vệ tiền cọc khi trả đồ. Bạn không bị trừ cọc đối với các lỗi này.
        </span>
      </div>

      {/* Evidence Photos */}
      {photos.length > 0 && (
        <div>
          <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 750, color: '#4B5563', marginBottom: '8px' }}>
            📸 Hình ảnh hiện trạng bạn đã chụp ({photos.length} ảnh):
          </span>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {photos.map((photo, index) => {
              const rawUrl = typeof photo === 'string' ? photo : (photo as any)?.url || '';
              const resolvedUrl = getMediaUrl(rawUrl) || rawUrl;
              return (
                <div
                  key={index}
                  onClick={() => onViewPhoto?.(resolvedUrl)}
                  style={{
                    width: '76px',
                    height: '76px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1.5px solid #FCD34D',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                    position: 'relative',
                    backgroundColor: '#F8F5F1'
                  }}
                  title="Bấm để xem ảnh phóng to"
                >
                  <ImageWithFallback
                    src={resolvedUrl}
                    alt={`Ảnh bằng chứng ${index + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    fallback={
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                        <ImageIcon size={20} />
                      </div>
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
