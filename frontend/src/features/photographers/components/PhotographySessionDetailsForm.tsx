import React from 'react';
import { Upload } from 'lucide-react';
import { PhotographyLocationPicker } from './PhotographyLocationPicker';

interface PhotographySessionDetailsFormProps {
  locations: string[];
  photographerCity: string;
  selectedLocation: string;
  concept: string;
  request: string;
  referenceFile: File | null;
  onLocationChange: (location: string) => void;
  onConceptChange: (value: string) => void;
  onRequestChange: (value: string) => void;
  onReferenceFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const PhotographySessionDetailsForm: React.FC<PhotographySessionDetailsFormProps> = ({
  locations,
  photographerCity,
  selectedLocation,
  concept,
  request,
  referenceFile,
  onLocationChange,
  onConceptChange,
  onRequestChange,
  onReferenceFileChange,
}) => (
  <>
    {/* BƯỚC 3: Địa điểm */}
    <section className="pd-about-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 className="pd-section-title" style={{ marginBottom: 0 }}>
        <span className="pd-section-title-num">3</span>
        <span>Địa điểm chụp ảnh</span>
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
        {locations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#8C827A' }}>ĐỊA CHỈ CỦA NHIẾP ẢNH GIA</span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {locations.map((location) => (
                <button
                  key={location}
                  type="button"
                  onClick={() => onLocationChange(location)}
                  className="vh-btn vh-btn-sm"
                  style={{
                    borderRadius: '8px',
                    border: '1px solid rgba(45, 41, 38, 0.15)',
                    backgroundColor: selectedLocation === location ? 'var(--color-primary-dark)' : 'white',
                    color: selectedLocation === location ? 'white' : 'var(--color-text-secondary)',
                    fontWeight: 700,
                    padding: '10px 18px',
                    textAlign: 'left',
                    boxShadow: selectedLocation === location ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {location}
                </button>
              ))}
            </div>
          </div>
        )}
        <PhotographyLocationPicker providerCity={photographerCity} onSelect={onLocationChange} />
      </div>
    </section>
    {/* BƯỚC 4: Concept & Ý tưởng */}
    <section className="pd-about-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 className="pd-section-title" style={{ marginBottom: 0 }}>
        <span className="pd-section-title-num">4</span>
        <span>Concept & ý tưởng mong muốn</span>
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
        <div className="vh-input-group" style={{ marginBottom: 0 }}>
          <label className="vh-input-label" style={{ fontWeight: 700, fontSize: '13px' }}>
            Concept mong muốn
          </label>
          <div className="vh-input-wrapper">
            <input
              type="text"
              placeholder="Ví dụ: Cổ phục Nhật Bình bên lăng Khải Định, Áo dài trắng Trường Tiền..."
              value={concept}
              onChange={(event) => onConceptChange(event.target.value)}
              className="vh-input-field"
              style={{ borderRadius: '10px' }}
            />
          </div>
        </div>

        <div className="vh-input-group" style={{ marginBottom: 0 }}>
          <label className="vh-input-label" style={{ fontWeight: 700, fontSize: '13px' }}>
            Ý tưởng chụp hoặc yêu cầu chi tiết
          </label>
          <div className="vh-input-wrapper">
            <textarea
              rows={4}
              placeholder="Mô tả bối cảnh chụp mong muốn, tone màu ảnh ưa thích, các góc chụp muốn tập trung hoặc lưu ý đặc biệt dành cho nhiếp ảnh gia..."
              value={request}
              onChange={(event) => onRequestChange(event.target.value)}
              className="vh-input-field"
              style={{ borderRadius: '10px', resize: 'vertical', minHeight: '100px', lineHeight: 1.5 }}
            />
          </div>
        </div>

        <div className="vh-input-group" style={{ marginBottom: 0 }}>
          <label className="vh-input-label" style={{ fontWeight: 700, fontSize: '13px' }}>
            Tải ảnh bối cảnh/concept mẫu (nếu có)
          </label>
          <div style={{
            border: '2px dashed rgba(182, 145, 91, 0.25)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            backgroundColor: 'var(--color-light-bg)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(182, 145, 91, 0.25)'}
          >
            <input
              type="file"
              accept="image/*"
              onChange={onReferenceFileChange}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#8C827A' }}>
              <Upload size={24} style={{ color: 'var(--color-gold)' }} />
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {referenceFile ? `Đã chọn: ${referenceFile.name}` : 'Chọn ảnh tham khảo từ thiết bị'}
              </span>
              <span style={{ fontSize: '11px', color: '#B6915B', fontWeight: 500 }}>
                Hỗ trợ tệp tin hình ảnh định dạng JPG, PNG dưới 5 MB
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </>
);

