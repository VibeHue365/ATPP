import React, { useMemo } from 'react';
import { CheckCircle, MapPin } from 'lucide-react';
import type { PhotographerPackage } from '../types/photographer.types';

interface PhotographerPackageSelectorProps {
  packages: PhotographerPackage[];
  selectedPackageId?: string;
  city?: string;
  onSelect: (photographyPackage: PhotographerPackage) => void;
}

type PricingUnit = NonNullable<PhotographerPackage['pricingUnit']>;

const pricingMeta: Record<PricingUnit, { label: string; unitLabel: string }> = {
  PER_SESSION: { label: 'Theo buổi', unitLabel: 'buổi' },
  PER_DAY: { label: 'Theo ngày', unitLabel: 'ngày' },
  PER_BOOKING: { label: 'Trọn booking', unitLabel: 'booking' },
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes} phút`;
  return `${hours} giờ${remainingMinutes ? ` ${remainingMinutes} phút` : ''}`;
};

const getPricingUnit = (photographyPackage: PhotographerPackage): PricingUnit =>
  photographyPackage.pricingUnit ?? 'PER_SESSION';

const getIncludedDuration = (photographyPackage: PhotographerPackage) =>
  Math.max(
    photographyPackage.includedDurationMinutes ?? Math.round(photographyPackage.durationHours * 60),
    30,
  );

const getEntitlementLabel = (photographyPackage: PhotographerPackage) => {
  const unit = getPricingUnit(photographyPackage);
  const duration = formatDuration(getIncludedDuration(photographyPackage));
  if (unit === 'PER_DAY') return `Bao gồm tổng ${duration} mỗi ngày`;
  if (unit === 'PER_BOOKING') {
    const sessions = photographyPackage.includedSessionCount ?? 1;
    const days = photographyPackage.includedDayCount ?? 1;
    return `Bao gồm ${sessions} buổi · ${days} ngày · tổng ${duration}`;
  }
  return `Bao gồm ${duration} mỗi buổi`;
};

export const PhotographerPackageSelector: React.FC<PhotographerPackageSelectorProps> = ({
  packages,
  selectedPackageId,
  city,
  onSelect,
}) => {
  const serviceGroups = useMemo(() => {
    const groups = new Map<string, { name: string; description?: string; plans: PhotographerPackage[] }>();
    for (const photographyPackage of packages) {
      const key = photographyPackage.serviceGroupId?.trim() || `package-${photographyPackage._id}`;
      const current = groups.get(key);
      if (current) {
        current.plans.push(photographyPackage);
        continue;
      }
      groups.set(key, {
        name: photographyPackage.serviceName?.trim() || photographyPackage.name,
        description: photographyPackage.description,
        plans: [photographyPackage],
      });
    }
    return [...groups.entries()];
  }, [packages]);

  return (
    <section className="pd-packages-section">
      <h2 className="pd-section-title">
        <span className="pd-section-title-num">1</span>
        <span>Chọn dịch vụ & phương án giá</span>
      </h2>

      <div className="pd-package-list">
        {serviceGroups.map(([groupId, group]) => (
          <article className="pd-service-group" key={groupId}>
            <header className="pd-service-group__header">
              <div>
                <strong>{group.name}</strong>
                {group.description && <p>{group.description}</p>}
              </div>
              {city && (
                <span className="pd-package-location-row">
                  <MapPin size={13} /> Khu vực hoạt động: <strong>{city}</strong>
                </span>
              )}
            </header>

            <div className="pd-service-group__plans" role="radiogroup" aria-label={`Phương án giá cho ${group.name}`}>
              {group.plans.map((photographyPackage) => {
                const isSelected = selectedPackageId === photographyPackage._id;
                const unit = getPricingUnit(photographyPackage);
                const meta = pricingMeta[unit];
                return (
                  <button
                    key={photographyPackage._id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onSelect(photographyPackage)}
                    className={`pd-package-card ${isSelected ? 'selected' : ''}`}
                  >
                    <span className="pd-package-card-left">
                      <span className="pd-package-card-title-row">
                        <strong className="pd-package-title">{photographyPackage.planName?.trim() || meta.label}</strong>
                        <span className="pd-package-unit-badge">{meta.label}</span>
                        {isSelected && (
                          <span className="pd-package-check-icon" title="Phương án giá đang chọn">
                            <CheckCircle size={18} fill="currentColor" color="white" />
                          </span>
                        )}
                      </span>
                      <span className="pd-package-entitlement">{getEntitlementLabel(photographyPackage)}</span>
                      <span className="pd-package-details-row">
                        <span>Ảnh chỉnh sửa: <strong>{photographyPackage.editedPhotosCount} ảnh</strong></span>
                        <span>Trả ảnh: <strong>{photographyPackage.deliveryDays} ngày</strong></span>
                        {unit === 'PER_BOOKING' && Boolean(photographyPackage.additionalSessionFee) && (
                          <span>Buổi thêm: <strong>{photographyPackage.additionalSessionFee!.toLocaleString('vi-VN')}đ</strong></span>
                        )}
                      </span>
                    </span>
                    <span className="pd-package-price">
                      {photographyPackage.price.toLocaleString('vi-VN')}đ
                      <small>/{meta.unitLabel}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
