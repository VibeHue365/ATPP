import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Plus, Trash2, AlertCircle, Info, UploadCloud } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { httpClient } from '../../../services/httpClient';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
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
  const [externalUrl, setExternalUrl] = useState('');
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
      setExternalUrl('');
      setError(null);
      setIsDragging(false);
    }
  }, [isOpen, initialValues]);

  const addExternalUrl = () => {
    const nextUrl = externalUrl.trim();
    if (!nextUrl) return;
    try {
      new URL(nextUrl);
    } catch {
      setError('Đường dẫn ảnh chưa hợp lệ.');
      return;
    }
    if (!images.includes(nextUrl)) {
      setImages((current) => [...current, nextUrl]);
    }
    setExternalUrl('');
    setError(null);
  };

  const uploadFiles = async (files: FileList) => {
    if (!files.length) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('images', file));
      const response = await httpClient.post<{ urls: string[] }>('/products/upload', formData);
      setImages((current) => [...new Set([...current, ...(response.urls || [])])]);
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Không thể tải ảnh lên.');
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
      setError('Thêm ít nhất một ảnh cho tác phẩm.');
      return;
    }
    setError(null);
    await onSubmit({
      title: normalizedTitle,
      description: description.trim() || undefined,
      images,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm tác phẩm portfolio" maxWidth="920px">
      <div className="portfolio-modal-wrapper">
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column' }}>
          
          <div className="portfolio-info-banner">
            <Info size={18} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }} />
            <p>
              Tác phẩm sẽ được gửi duyệt trước khi hiển thị công khai trên hồ sơ nhiếp ảnh gia.
            </p>
          </div>

          <div className="portfolio-form-grid">
            <div className="portfolio-form-left">
              <div className="portfolio-form-group">
                <label className="portfolio-label">
                  <span>Tiêu đề tác phẩm <span style={{ color: 'var(--color-error)' }}>*</span></span>
                  <span className="portfolio-char-counter">{title.length}/120</span>
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  placeholder="Ví dụ: Concept áo dài bên sông Hương"
                  className="portfolio-input"
                  required
                />
              </div>

              <div className="portfolio-form-group">
                <label className="portfolio-label">
                  <span>Mô tả ngắn <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>(không bắt buộc)</span></span>
                  <span className="portfolio-char-counter">{description.length}/1000</span>
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Bối cảnh, phong cách, cảm hứng hoặc thông tin khách hàng cần biết…"
                  className="portfolio-input portfolio-textarea"
                />
              </div>

              <div className="portfolio-url-section">
                <span className="portfolio-url-section-title">Hoặc dán URL ảnh</span>
                <div className="portfolio-url-input-group">
                  <input
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addExternalUrl();
                      }
                    }}
                    placeholder="Nhập đường dẫn ảnh ngoài..."
                    className="portfolio-url-input"
                  />
                  <button
                    type="button"
                    onClick={addExternalUrl}
                    className="portfolio-url-btn"
                    title="Thêm ảnh từ URL"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="portfolio-form-right">
              <div className="portfolio-form-group">
                <div className="portfolio-upload-header">
                  <span className="portfolio-upload-title">Ảnh tác phẩm <span style={{ color: 'var(--color-error)' }}>*</span></span>
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
                  style={{ pointerEvents: isUploading ? 'none' : 'auto' }}
                >
                  <div className="portfolio-dropzone-icon-box">
                    {isUploading ? (
                      <LoaderCircle size={22} className="portfolio-spin" />
                    ) : (
                      <UploadCloud size={22} />
                    )}
                  </div>
                  <div>
                    <div className="portfolio-dropzone-title">
                      {isUploading ? 'Đang tải ảnh lên…' : 'Chọn hoặc kéo thả nhiều ảnh từ máy'}
                    </div>
                    <div className="portfolio-dropzone-desc">
                      Hỗ trợ tệp tin định dạng JPG, PNG, WEBP. Tải lên nhiều ảnh cùng lúc.
                    </div>
                  </div>
                </div>
              </div>

              {images.length > 0 && (
                <div className="portfolio-preview-container">
                  <span className="portfolio-preview-label">Ảnh đã chọn xem trước</span>
                  <div className="portfolio-preview-grid">
                    {images.map((image, index) => (
                      <div key={image} className="portfolio-image-card">
                        <img src={getMediaUrl(image)} alt={`Ảnh tác phẩm ${index + 1}`} />
                        <div className="portfolio-image-overlay">
                          <span className="portfolio-image-overlay-badge">#{index + 1}</span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Xóa ảnh ${index + 1}`}
                          onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}
                          className="portfolio-image-delete-btn"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="portfolio-error-box">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="portfolio-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isUploading}
              className="vh-btn vh-btn-sm vh-btn-text"
              style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)' }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="vh-btn vh-btn-sm vh-btn-primary"
              style={{ padding: '10px 22px', borderRadius: 'var(--radius-md)' }}
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
