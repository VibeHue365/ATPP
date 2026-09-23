import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Eye,
  ImagePlus,
  Info,
  Lightbulb,
  LoaderCircle,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { httpClient } from '../../../services/httpClient';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
import { PortfolioCard } from '../../provider-dashboard/portfolio/components/PortfolioCard';
import type { PortfolioItem } from '../../provider-dashboard/types';
import './PortfolioItemFormModal.css';

export interface PortfolioItemFormValues {
  title: string;
  description?: string;
  images: string[];
}

interface PortfolioItemFormModalProps {
  isOpen: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (values: PortfolioItemFormValues) => Promise<void>;
  initialValues?: PortfolioItemFormValues | null;
}

export const PortfolioItemFormModal: React.FC<PortfolioItemFormModalProps> = ({
  isOpen,
  isSaving = false,
  onClose,
  onSubmit,
  initialValues = null,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        setTitle(initialValues.title || '');
        setDescription(initialValues.description || '');
        setImages(initialValues.images || []);
      } else {
        setTitle('');
        setDescription('');
        setImages([]);
      }
      setError(null);
      setIsDragging(false);
    }
  }, [isOpen, initialValues]);

  const uploadFiles = async (files: FileList) => {
    if (!files.length) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('images', file));
      const response = await httpClient.post<{ urls: string[] }>('/products/upload', formData);
      setImages((current) => [...new Set([...current, ...(response.urls || [])])]);
    } catch (uploadError: unknown) {
      const message = uploadError instanceof Error ? uploadError.message : 'Không thể tải ảnh lên.';
      setError(message);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const uploadImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      await uploadFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files) {
      await uploadFiles(files);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError('Vui lòng nhập tiêu đề tác phẩm.');
      return;
    }
    if (!images.length) {
      setError('Vui lòng tải lên ít nhất một bức ảnh cho tác phẩm này.');
      return;
    }
    setError(null);
    await onSubmit({
      title: normalizedTitle,
      description: description.trim() || undefined,
      images,
    });
  };

  // Real-time Artwork Card Preview computation
  const previewItem: PortfolioItem = useMemo(() => {
    return {
      _id: 'preview-artwork-id',
      title: title.trim() || 'Tên tác phẩm (Ví dụ: Nắng Thu Hoàng Thành)',
      description:
        description.trim() ||
        'Concept chụp áo dài truyền thống tại Cố Đô Huế, kết hợp ánh sáng tự nhiên...',
      images,
      moderationStatus: 'APPROVED',
    };
  }, [title, description, images]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialValues ? 'Chỉnh sửa tác phẩm Portfolio' : 'Thêm tác phẩm Portfolio mới'}
      maxWidth="1000px"
    >
      <div className="portfolio-modal-wrapper">
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Intro Notice */}
          <div className="portfolio-info-banner">
            <Info size={18} style={{ color: 'var(--pf-primary)', flexShrink: 0, marginTop: 1 }} />
            <p>
              Tác phẩm chất lượng cao là minh chứng thuyết phục nhất cho phong cách và tay nghề của bạn. Tác phẩm mới sẽ được gửi duyệt trước khi hiển thị công khai.
            </p>
          </div>

          {/* 2-Column Grid (Option 1) */}
          <div className="portfolio-form-grid" style={{ gridTemplateColumns: '1.15fr 0.85fr', gap: '28px' }}>
            {/* ================= LEFT COLUMN: INPUTS & TIPS ================= */}
            <div className="portfolio-form-left">
              <div className="portfolio-form-group">
                <label className="portfolio-label">
                  <span>
                    Tiêu đề tác phẩm <span style={{ color: '#DC2626' }}>*</span>
                  </span>
                  <span className="portfolio-char-counter">{title.length}/120</span>
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  placeholder="Ví dụ: Nắng Chiều Hoàng Thành Huế"
                  className="portfolio-input"
                  required
                />
              </div>

              <div className="portfolio-form-group">
                <label className="portfolio-label">
                  <span>Mô tả bối cảnh & phong cách</span>
                  <span className="portfolio-char-counter">{description.length}/1000</span>
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Bối cảnh chụp, thiết bị sử dụng, cảm xúc hoặc concept truyền cảm hứng…"
                  className="portfolio-input portfolio-textarea"
                />
              </div>

              {/* Optimization Tips Box */}
              <div
                style={{
                  background: '#FFFDF9',
                  border: '1px solid #EBE4D8',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#B45309', fontWeight: 700, fontSize: '12.5px' }}>
                  <Lightbulb size={16} />
                  <span>Mẹo xây dựng Portfolio thu hút:</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#6B7280', lineHeight: 1.6 }}>
                  <li>Chọn ảnh có ánh sáng và màu sắc tiêu biểu cho phong cách thương hiệu của bạn.</li>
                  <li>Tải lên từ <strong>3 đến 8 ảnh</strong> cho mỗi bộ tác phẩm để khách hàng chiêm ngưỡng trọn vẹn.</li>
                  <li>Tiêu đề giàu cảm xúc giúp tăng 40% khả năng khách nhấn vào xem chi tiết hồ sơ.</li>
                </ul>
              </div>
            </div>

            {/* ================= RIGHT COLUMN: UPLOAD & LIVE PREVIEW ================= */}
            <div className="portfolio-form-right">
              <div className="portfolio-form-group">
                <div className="portfolio-upload-header">
                  <span className="portfolio-upload-title">
                    Hình ảnh tác phẩm <span style={{ color: '#DC2626' }}>*</span>
                  </span>
                  <span className="portfolio-upload-badge">
                    Đã chọn: <strong className="portfolio-upload-count-highlight">{images.length}</strong> ảnh
                  </span>
                </div>

                <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={uploadImages} />

                <div
                  className={`portfolio-dropzone ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  style={{ pointerEvents: isUploading ? 'none' : 'auto', minHeight: '140px', padding: '20px' }}
                >
                  <div className="portfolio-dropzone-icon-box" style={{ width: '42px', height: '42px' }}>
                    {isUploading ? (
                      <LoaderCircle size={20} className="portfolio-spin" />
                    ) : (
                      <UploadCloud size={20} />
                    )}
                  </div>
                  <div>
                    <div className="portfolio-dropzone-title" style={{ fontSize: '13px' }}>
                      {isUploading ? 'Đang tải ảnh lên…' : 'Kéo thả hoặc chọn nhiều ảnh từ máy'}
                    </div>
                    <div className="portfolio-dropzone-desc" style={{ fontSize: '11px' }}>
                      Hỗ trợ JPG, PNG, WebP. Ảnh đầu tiên sẽ làm ảnh đại diện.
                    </div>
                  </div>
                </div>
              </div>

              {/* Thumbnails grid */}
              {images.length > 0 && (
                <div className="portfolio-preview-container">
                  <span className="portfolio-preview-label">Ảnh đã chọn ({images.length})</span>
                  <div className="portfolio-preview-grid" style={{ maxHeight: '160px' }}>
                    {images.map((image, index) => (
                      <div key={image} className="portfolio-image-card">
                        <img src={getMediaUrl(image)} alt={`Ảnh tác phẩm ${index + 1}`} />
                        <div className="portfolio-image-overlay">
                          <span className="portfolio-image-overlay-badge">
                            {index === 0 ? 'Bìa' : `#${index + 1}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Xóa ảnh ${index + 1}`}
                          onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}
                          className="portfolio-image-delete-btn"
                          title="Xóa ảnh"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Artwork Card Preview */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--pf-primary-dark)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Eye size={14} /> Xem trước hiển thị thực tế
                  </span>
                  <span style={{ fontSize: '10.5px', fontWeight: 750, color: 'var(--pf-primary)', background: 'var(--pf-primary-light)', padding: '2px 7px', borderRadius: '999px' }}>
                    Live Preview
                  </span>
                </div>

                <div style={{ background: '#FAF8F5', border: '1px dashed #EBE4D8', borderRadius: '12px', padding: '10px' }}>
                  <PortfolioCard portfolioItem={previewItem} previewMode />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="portfolio-error-box">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="portfolio-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isUploading}
              className="portfolio-button portfolio-button--secondary"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="portfolio-button portfolio-button--primary"
            >
              {isSaving ? (
                <>
                  <LoaderCircle size={16} className="portfolio-spin" />
                  Đang gửi duyệt…
                </>
              ) : (
                <>
                  <ImagePlus size={16} />
                  {initialValues ? 'Cập nhật tác phẩm' : 'Gửi duyệt tác phẩm'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
