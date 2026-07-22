import { CalendarClock, Clock3, Edit3, ImageOff, Images, PauseCircle, PlayCircle, WandSparkles } from 'lucide-react';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
import type { PhotographyPackage } from '../types/photographyPackage.types';

interface PhotographyPackageCardProps {
  photographyPackage: PhotographyPackage;
  isBusy?: boolean;
  onEdit: (item: PhotographyPackage) => void;
  onTogglePublication: (item: PhotographyPackage) => void;
}

const statusLabels = {
  ACTIVE: 'Đang hoạt động',
  DRAFT: 'Bản nháp',
  INACTIVE: 'Tạm ngưng',
};

export function PhotographyPackageCard({
  photographyPackage,
  isBusy = false,
  onEdit,
  onTogglePublication,
}: PhotographyPackageCardProps) {
  const isActive = photographyPackage.status === 'ACTIVE';
  const coverImage = photographyPackage.images[0];
  const pricingUnit = photographyPackage.pricingUnit || 'PER_SESSION';
  const pricingSuffix = pricingUnit === 'PER_DAY' ? '/ ngày' : pricingUnit === 'PER_BOOKING' ? '/ booking' : '/ buổi';
  const includedHours = (photographyPackage.includedDurationMinutes ?? Math.round(photographyPackage.durationHours * 60)) / 60;

  return (
    <article className="photography-package-card">
      <div className="photography-package-card__media">
        {coverImage ? (
          <img src={getMediaUrl(coverImage)} alt={photographyPackage.name} />
        ) : (
          <div className="photography-package-card__image-placeholder">
            <ImageOff size={28} />
            <span>Chưa có ảnh bìa</span>
          </div>
        )}
        <span className={`photography-package-card__status photography-package-card__status--${photographyPackage.status.toLowerCase()}`}>
          {statusLabels[photographyPackage.status]}
        </span>
        {photographyPackage.images.length > 1 && (
          <span className="photography-package-card__image-count"><Images size={14} /> {photographyPackage.images.length}</span>
        )}
      </div>

      <div className="photography-package-card__body">
        <div>
          <h3>{photographyPackage.planName || photographyPackage.name}</h3>
          <p>{photographyPackage.description || 'Chưa có mô tả cho gói chụp này.'}</p>
        </div>
        <strong className="photography-package-card__price">
          {photographyPackage.price.toLocaleString('vi-VN')}đ <small>{pricingSuffix}</small>
        </strong>
        <div className="photography-package-card__facts">
          <span><Clock3 size={15} /> Bao gồm {includedHours.toLocaleString('vi-VN')} giờ {pricingUnit === 'PER_DAY' ? 'mỗi ngày' : pricingUnit === 'PER_SESSION' ? 'mỗi buổi' : 'toàn booking'}</span>
          {pricingUnit === 'PER_BOOKING' && <span><CalendarClock size={15} /> {photographyPackage.includedSessionCount || 1} buổi / {photographyPackage.includedDayCount || 1} ngày</span>}
          <span><WandSparkles size={15} /> {photographyPackage.editedPhotosCount} ảnh chỉnh sửa</span>
          <span><CalendarClock size={15} /> Trả ảnh {photographyPackage.deliveryDays} ngày</span>
        </div>
      </div>

      <div className="photography-package-card__actions">
        <button type="button" className="photography-package-button photography-package-button--secondary" onClick={() => onEdit(photographyPackage)} disabled={isBusy}>
          <Edit3 size={15} /> Chỉnh sửa
        </button>
        <button type="button" className={isActive ? 'photography-package-button photography-package-button--pause' : 'photography-package-button photography-package-button--primary'} onClick={() => onTogglePublication(photographyPackage)} disabled={isBusy}>
          {isActive ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
          {isActive ? 'Tạm ngưng' : 'Đăng bán'}
        </button>
      </div>
    </article>
  );
}
