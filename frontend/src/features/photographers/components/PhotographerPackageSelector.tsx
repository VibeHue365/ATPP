import React from 'react';
import { MapPin, CheckCircle } from 'lucide-react';
import type { PhotographerPackage } from '../types/photographer.types';

interface PhotographerPackageSelectorProps {
  packages: PhotographerPackage[];
  selectedPackageId?: string;
  city?: string;
  onSelect: (photographyPackage: PhotographerPackage) => void;
}

export const PhotographerPackageSelector: React.FC<PhotographerPackageSelectorProps> = ({
  packages,
  selectedPackageId,
  city,
  onSelect,
}) => (
  <section className="pd-packages-section">
    <h2 className="pd-section-title">
      <span className="pd-section-title-num">1</span>
      <span>Chọn gói dịch vụ</span>
    </h2>
    
    <div className="pd-package-list">
      {packages.map((photographyPackage) => {
        const isSelected = selectedPackageId === photographyPackage._id;
        return (
          <button
            key={photographyPackage._id}
            type="button"
            onClick={() => onSelect(photographyPackage)}
            className={`pd-package-card ${isSelected ? 'selected' : ''}`}
          >
            <span className="pd-package-card-left">
              <span className="pd-package-card-title-row">
                <strong className="pd-package-title">{photographyPackage.name}</strong>
                {isSelected && (
                  <span className="pd-package-check-icon" title="Gói dịch vụ đang chọn">
                    <CheckCircle size={18} fill="currentColor" color="white" />
                  </span>
                )}
              </span>
              
              {photographyPackage.description && (
                <span className="pd-package-desc">{photographyPackage.description}</span>
              )}
              
              <span className="pd-package-details-row">
                <span>Thời gian: <strong>{photographyPackage.durationHours} giờ</strong></span>
                <span>Ảnh chỉnh sửa: <strong>{photographyPackage.editedPhotosCount} ảnh</strong></span>
                <span>Trả ảnh: <strong>{photographyPackage.deliveryDays} ngày</strong></span>
              </span>
              
              {city && (
                <span className="pd-package-location-row">
                  <MapPin size={13} style={{ flexShrink: 0 }} />
                  Khu vực hoạt động: <strong>{city}</strong>
                </span>
              )}
            </span>
            <strong className="pd-package-price">
              {photographyPackage.price.toLocaleString('vi-VN')}đ
            </strong>
          </button>
        );
      })}
    </div>
  </section>
);
