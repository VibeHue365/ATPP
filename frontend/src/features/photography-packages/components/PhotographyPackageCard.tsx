import {
  CalendarClock,
  Clock3,
  Edit3,
  ImageOff,
  Images,
  PauseCircle,
  PlayCircle,
  Wand2,
  Users,
  Camera,
  Trash2,
  Eye,
  Tag,
} from 'lucide-react';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
import type { PhotographyPackage } from '../types/photographyPackage.types';

export interface PhotographyPackageCardProps {
  photographyPackage: PhotographyPackage;
  categoryName?: string;
  conceptNames?: string[];
  isBusy?: boolean;
  onEdit?: (item: PhotographyPackage) => void;
  onTogglePublication?: (item: PhotographyPackage) => void;
  onDelete?: (item: PhotographyPackage) => void;
  previewMode?: boolean;
}

const statusLabels: Record<PhotographyPackage['status'], string> = {
  ACTIVE: 'Đang hoạt động',
  DRAFT: 'Bản nháp',
  INACTIVE: 'Tạm ngưng',
};

export function PhotographyPackageCard({
  photographyPackage,
  categoryName,
  conceptNames = [],
  isBusy = false,
  onEdit,
  onTogglePublication,
  onDelete,
  previewMode = false,
}: PhotographyPackageCardProps) {
  const isActive = photographyPackage.status === 'ACTIVE';
  const coverImage = photographyPackage.images?.[0];
  const imagesCount = photographyPackage.images?.length || 0;

  const handleDelete = () => {
    if (!onDelete) return;
    if (window.confirm(`Bạn có chắc muốn xóa gói chụp "${photographyPackage.name}"? Hành động này không thể hoàn tác.`)) {
      onDelete(photographyPackage);
    }
  };

  return (
    <article className="photography-package-card">
      {/* 1. MEDIA HEADER */}
      <div className="photography-package-card__media">
        {coverImage ? (
          <img src={getMediaUrl(coverImage)} alt={photographyPackage.name || 'Gói chụp ảnh'} />
        ) : (
          <div className="photography-package-card__image-placeholder">
            <ImageOff size={32} />
            <span>Chưa có ảnh bìa</span>
          </div>
        )}

        {/* Status Pill with Pulsing Dot */}
        <span
          className={`photography-package-card__status photography-package-card__status--${photographyPackage.status.toLowerCase()}`}
        >
          <span className="photography-package-card__pulsing-dot" />
          {statusLabels[photographyPackage.status]}
        </span>

        {/* Image Count Pill */}
        {imagesCount > 0 && (
          <span className="photography-package-card__image-count">
            <Images size={13} /> {imagesCount} ảnh
          </span>
        )}

        {/* Category Pill (if known) */}
        {categoryName && (
          <span className="photography-package-card__category-badge">
            <Tag size={12} /> {categoryName}
          </span>
        )}
      </div>

      {/* 2. CARD BODY */}
      <div className="photography-package-card__body">
        {/* Concept / Style Chips */}
        {conceptNames.length > 0 && (
          <div className="photography-package-card__tags">
            {conceptNames.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="photography-package-card__tag">
                {tag}
              </span>
            ))}
            {conceptNames.length > 3 && (
              <span className="photography-package-card__tag">+{conceptNames.length - 3}</span>
            )}
          </div>
        )}

        {/* Title */}
        <h3 className="photography-package-card__title">
          {photographyPackage.name || 'Tên gói chụp chưa đặt'}
        </h3>

        {/* Description */}
        <p className="photography-package-card__desc">
          {photographyPackage.description || 'Chưa có mô tả chi tiết cho gói dịch vụ này.'}
        </p>

        {/* Price Wrap */}
        <div className="photography-package-card__price-wrap">
          <span className="photography-package-card__price">
            {Number(photographyPackage.price || 0).toLocaleString('vi-VN')}đ
          </span>
          <span className="photography-package-card__price-unit">/ buổi</span>
        </div>

        {/* Structured Facts Grid */}
        <div className="photography-package-card__facts">
          <div className="photography-package-card__facts-item" title="Thời lượng buổi chụp">
            <Clock3 size={15} />
            <span>{photographyPackage.durationHours} giờ chụp</span>
          </div>

          <div className="photography-package-card__facts-item" title="Số người tối đa">
            <Users size={15} />
            <span>Tối đa {photographyPackage.maxPeople || 1} người</span>
          </div>

          <div className="photography-package-card__facts-item" title="Ảnh thành phẩm đã chỉnh sửa">
            <Wand2 size={15} />
            <span>{photographyPackage.editedPhotosCount || 0} ảnh chỉnh sửa</span>
          </div>

          <div className="photography-package-card__facts-item" title="Ảnh gốc kèm theo">
            <Camera size={15} />
            <span>
              {photographyPackage.rawPhotosCount && photographyPackage.rawPhotosCount > 0
                ? `${photographyPackage.rawPhotosCount} ảnh gốc`
                : 'Không kèm ảnh gốc'}
            </span>
          </div>

          <div className="photography-package-card__facts-item" title="Thời gian trả ảnh">
            <CalendarClock size={15} />
            <span>Trả ảnh {photographyPackage.deliveryDays || 1} ngày</span>
          </div>

          {Boolean(photographyPackage.overtimeFeePerHour) && (
            <div className="photography-package-card__facts-item" title="Phí tăng giờ">
              <Clock3 size={15} />
              <span>+{Number(photographyPackage.overtimeFeePerHour).toLocaleString('vi-VN')}đ/h</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. CARD ACTIONS */}
      {!previewMode ? (
        <div className="photography-package-card__actions">
          {/* Status Toggle Button */}
          <button
            type="button"
            className={
              isActive
                ? 'photography-package-button photography-package-button--pause'
                : 'photography-package-button photography-package-button--publish'
            }
            onClick={() => onTogglePublication?.(photographyPackage)}
            disabled={isBusy}
            title={isActive ? 'Tạm ngưng hiển thị cho khách' : 'Đăng bán công khai cho khách đặt'}
          >
            {isActive ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
            <span>{isActive ? 'Tạm ngưng' : 'Đăng bán'}</span>
          </button>

          <div className="photography-package-card__actions-group">
            {/* Edit Button */}
            <button
              type="button"
              className="photography-package-button photography-package-button--secondary"
              onClick={() => onEdit?.(photographyPackage)}
              disabled={isBusy}
              title="Chỉnh sửa chi tiết gói chụp"
            >
              <Edit3 size={15} />
              <span>Sửa</span>
            </button>

            {/* Delete Button */}
            {onDelete && (
              <button
                type="button"
                className="photography-package-button photography-package-button--danger photography-package-button--icon-only"
                onClick={handleDelete}
                disabled={isBusy}
                title="Xóa gói chụp này"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="photography-package-card__actions" style={{ justifyContent: 'center' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--pkg-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Eye size={13} /> Khách hàng sẽ nhìn thấy thẻ như thế này
          </span>
        </div>
      )}
    </article>
  );
}
