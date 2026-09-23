import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Eye,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { httpClient } from '../../../services/httpClient';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
import { categoryService } from '../../categories/services/categoryService';
import type { Category } from '../../categories/types';
import type {
  PhotographyPackage,
  PhotographyPackagePayload,
  PhotographyPackageStatus,
} from '../types/photographyPackage.types';
import { PhotographyPackageCard } from './PhotographyPackageCard';

interface PhotographyPackageFormModalProps {
  isOpen: boolean;
  isSaving?: boolean;
  initialPackage?: PhotographyPackage | null;
  onClose: () => void;
  onSubmit: (payload: PhotographyPackagePayload) => Promise<void>;
}

const numberValue = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function PhotographyPackageFormModal({
  isOpen,
  isSaving = false,
  initialPackage = null,
  onClose,
  onSubmit,
}: PhotographyPackageFormModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Categories
  const [packageCategories, setPackageCategories] = useState<Category[]>([]);
  const [conceptCategories, setConceptCategories] = useState<Category[]>([]);
  const [styleCategories, setStyleCategories] = useState<Category[]>([]);
  const [eventCategories, setEventCategories] = useState<Category[]>([]);

  // Form fields
  const [categoryId, setCategoryId] = useState(() => initialPackage?.categoryId || '');
  const [conceptCategoryIds, setConceptCategoryIds] = useState<string[]>(
    () => initialPackage?.conceptCategoryIds || []
  );
  const [styleCategoryIds, setStyleCategoryIds] = useState<string[]>(
    () => initialPackage?.styleCategoryIds || []
  );
  const [eventCategoryIds, setEventCategoryIds] = useState<string[]>(
    () => initialPackage?.eventCategoryIds || []
  );
  const [name, setName] = useState(() => initialPackage?.name || '');
  const [description, setDescription] = useState(() => initialPackage?.description || '');
  const [price, setPrice] = useState(() => (initialPackage ? String(initialPackage.price) : ''));
  const [durationHours, setDurationHours] = useState(() =>
    initialPackage ? String(initialPackage.durationHours) : '2'
  );
  const [editedPhotosCount, setEditedPhotosCount] = useState(() =>
    initialPackage ? String(initialPackage.editedPhotosCount) : '20'
  );
  const [rawPhotosCount, setRawPhotosCount] = useState(() =>
    initialPackage ? String(initialPackage.rawPhotosCount || 0) : '100'
  );
  const [includesRawPhotos, setIncludesRawPhotos] = useState(() =>
    Boolean(initialPackage?.rawPhotosCount && initialPackage.rawPhotosCount > 0)
  );
  const [deliveryDays, setDeliveryDays] = useState(() =>
    initialPackage ? String(initialPackage.deliveryDays) : '3'
  );
  const [maxPeople, setMaxPeople] = useState(() =>
    initialPackage ? String(initialPackage.maxPeople || 1) : '1'
  );
  const [overtimeFeePerHour, setOvertimeFeePerHour] = useState(() =>
    initialPackage ? String(initialPackage.overtimeFeePerHour || 0) : '0'
  );
  const [travelFeeNotes, setTravelFeeNotes] = useState(
    () => initialPackage?.travelFeeNotes || ''
  );
  const [images, setImages] = useState<string[]>(() => initialPackage?.images || []);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch category references
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void Promise.all([
      categoryService.getPublic({ type: 'PHOTOGRAPHY_CATEGORY' }),
      categoryService.getPublic({ type: 'CONCEPT' }),
      categoryService.getPublic({ type: 'STYLE' }),
      categoryService.getPublic({ type: 'EVENT' }),
    ])
      .then(([packages, concepts, styles, events]) => {
        if (!active) return;
        setPackageCategories(packages);
        setConceptCategories(concepts);
        setStyleCategories(styles);
        setEventCategories(events);
      })
      .catch((categoryError: unknown) => {
        if (active) setError(errorMessage(categoryError, 'Không thể tải danh mục. Vui lòng thử lại.'));
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const toggleCategory = (
    id: string,
    setValue: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setValue((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
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
    } catch (uploadError: unknown) {
      setError(errorMessage(uploadError, 'Không thể tải ảnh lên. Vui lòng thử lại.'));
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= images.length) return;
    setImages((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  const submit = async (status: PhotographyPackageStatus) => {
    const normalizedName = name.trim();
    const normalizedPrice = numberValue(price);
    const normalizedDuration = numberValue(durationHours);
    const normalizedEditedPhotos = numberValue(editedPhotosCount);
    const normalizedDeliveryDays = numberValue(deliveryDays);
    const normalizedMaxPeople = numberValue(maxPeople, 1);

    if (!normalizedName) {
      setError('Vui lòng nhập tên gói chụp ảnh.');
      return;
    }
    if (!categoryId) {
      setError('Vui lòng chọn danh mục dịch vụ nhiếp ảnh chính.');
      return;
    }
    if (normalizedPrice <= 0) {
      setError('Giá gói chụp phải lớn hơn 0đ.');
      return;
    }
    if (normalizedDuration < 0.5) {
      setError('Thời lượng chụp tối thiểu là 0.5 giờ (30 phút).');
      return;
    }
    if (normalizedEditedPhotos < 0) {
      setError('Số ảnh chỉnh sửa không hợp lệ.');
      return;
    }
    if (normalizedDeliveryDays < 0) {
      setError('Số ngày trả ảnh không hợp lệ.');
      return;
    }
    if (status === 'ACTIVE' && !images.length) {
      setError('Cần ít nhất một ảnh minh họa trước khi đăng bán công khai gói chụp.');
      return;
    }

    setError(null);
    await onSubmit({
      categoryId,
      conceptCategoryIds,
      styleCategoryIds,
      eventCategoryIds,
      name: normalizedName,
      description: description.trim() || undefined,
      price: normalizedPrice,
      durationHours: normalizedDuration,
      maxPeople: normalizedMaxPeople,
      editedPhotosCount: normalizedEditedPhotos,
      rawPhotosCount: includesRawPhotos ? numberValue(rawPhotosCount) : 0,
      deliveryDays: normalizedDeliveryDays,
      overtimeFeePerHour: numberValue(overtimeFeePerHour),
      travelFeeNotes: travelFeeNotes.trim() || undefined,
      images,
      status,
    });
  };

  // Real-time Preview computation
  const selectedCategoryName = useMemo(() => {
    return packageCategories.find((cat) => cat.id === categoryId)?.name;
  }, [packageCategories, categoryId]);

  const selectedConceptNames = useMemo(() => {
    const names: string[] = [];
    conceptCategoryIds.forEach((id) => {
      const c = conceptCategories.find((item) => item.id === id);
      if (c) names.push(c.name);
    });
    styleCategoryIds.forEach((id) => {
      const s = styleCategories.find((item) => item.id === id);
      if (s) names.push(s.name);
    });
    return names;
  }, [conceptCategoryIds, styleCategoryIds, conceptCategories, styleCategories]);

  const previewPackage: PhotographyPackage = useMemo(() => {
    return {
      _id: initialPackage?._id || 'preview-temp-id',
      categoryId,
      conceptCategoryIds,
      styleCategoryIds,
      eventCategoryIds,
      name: name.trim() || 'Tên gói chụp (Ví dụ: Chụp Áo Dài Cung Đình Huế)',
      description:
        description.trim() ||
        'Gói chụp trọn gói tại Đại Nội & Cung An Định, bao gồm makeup nhẹ, hỗ trợ tạo dáng và trả toàn bộ file...',
      price: numberValue(price, 1500000),
      durationHours: numberValue(durationHours, 2),
      maxPeople: numberValue(maxPeople, 1),
      editedPhotosCount: numberValue(editedPhotosCount, 25),
      rawPhotosCount: includesRawPhotos ? numberValue(rawPhotosCount, 150) : 0,
      deliveryDays: numberValue(deliveryDays, 3),
      overtimeFeePerHour: numberValue(overtimeFeePerHour, 0),
      travelFeeNotes: travelFeeNotes.trim() || undefined,
      images,
      status: 'ACTIVE',
    };
  }, [
    initialPackage,
    categoryId,
    conceptCategoryIds,
    styleCategoryIds,
    eventCategoryIds,
    name,
    description,
    price,
    durationHours,
    maxPeople,
    editedPhotosCount,
    includesRawPhotos,
    rawPhotosCount,
    deliveryDays,
    overtimeFeePerHour,
    travelFeeNotes,
    images,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialPackage ? 'Chỉnh sửa gói chụp ảnh' : 'Tạo gói chụp ảnh mới'}
      maxWidth="1040px"
    >
      <div className="photography-package-form">
        {/* Intro banner */}
        <div className="photography-package-form__intro" style={{ marginBottom: '16px' }}>
          <ImagePlus size={20} color="var(--pkg-primary)" />
          <p>
            Thiết lập quyền lợi, thời lượng và ảnh thành phẩm rõ ràng giúp khách hàng tin tưởng và nhanh chóng đặt lịch với bạn.
          </p>
        </div>

        {/* 2-Column Option 1 Layout */}
        <div className="photography-package-modal-grid">
          {/* ================= LEFT COLUMN: FORM INPUTS ================= */}
          <div className="photography-package-modal-left">
            {/* Section 1: Categories & Concept Chips */}
            <section className="photography-package-form__section">
              <h3>
                <Tag size={16} /> Phân loại dịch vụ & Concept
              </h3>

              <label>
                <span>
                  Danh mục nhiếp ảnh chính <b>*</b>
                </span>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">-- Chọn danh mục dịch vụ --</option>
                  {packageCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <small>Khách hàng sẽ tìm thấy gói chụp của bạn theo danh mục này.</small>
              </label>

              {([
                ['Concept chụp', conceptCategories, conceptCategoryIds, setConceptCategoryIds],
                ['Phong cách', styleCategories, styleCategoryIds, setStyleCategoryIds],
                ['Sự kiện phù hợp', eventCategories, eventCategoryIds, setEventCategoryIds],
              ] as const).map(([label, categories, selectedIds, setSelectedIds]) => (
                <div key={label} className="photography-package-chips-wrap">
                  <span className="photography-package-chips-label">{label}</span>
                  <div className="photography-package-chips-list">
                    {categories.map((category) => {
                      const selected = selectedIds.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          className={`photography-package-chip ${selected ? 'is-selected' : ''}`}
                          onClick={() => toggleCategory(category.id, setSelectedIds)}
                        >
                          {selected ? '✓ ' : '+ '}
                          {category.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>

            {/* Section 2: Basic Info */}
            <section className="photography-package-form__section">
              <h3>
                <Camera size={16} /> Thông tin gói chụp
              </h3>

              <label>
                <span>
                  Tên gói chụp <b>*</b>
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={140}
                  placeholder="Ví dụ: Chụp Ngoại Cảnh Áo Dài Hoàng Cung"
                />
                <small style={{ textAlign: 'right' }}>{name.length}/140 ký tự</small>
              </label>

              <label>
                <span>Mô tả chi tiết</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Mô tả trải nghiệm, phong cách chụp, các địa điểm nổi bật và những quyền lợi đặc biệt..."
                />
                <small style={{ textAlign: 'right' }}>{description.length}/1000 ký tự</small>
              </label>
            </section>

            {/* Section 3: Pricing & Specifications */}
            <section className="photography-package-form__section">
              <h3>
                <Sparkles size={16} /> Giá & Quy cách thực hiện
              </h3>

              <div className="photography-package-form__two-columns">
                <label>
                  <span>
                    Giá trọn gói (đ) <b>*</b>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="1500000"
                  />
                  <small>Chi phí tính theo 1 buổi chụp tiêu chuẩn.</small>
                </label>

                <label>
                  <span>
                    Thời lượng buổi chụp (giờ) <b>*</b>
                  </span>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                  />
                  <small>Ví dụ: 1.5 giờ, 2 giờ, 3 giờ...</small>
                </label>

                <label>
                  <span>
                    Số người chụp tối đa <b>*</b>
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={maxPeople}
                    onChange={(e) => setMaxPeople(e.target.value)}
                    placeholder="1"
                  />
                  <small>Số lượng khách được phục vụ trong gói.</small>
                </label>

                <label>
                  <span>
                    Ảnh thành phẩm chỉnh sửa (tấm) <b>*</b>
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={editedPhotosCount}
                    onChange={(e) => setEditedPhotosCount(e.target.value)}
                    placeholder="25"
                  />
                  <small>Số ảnh được retouch màu & da chỉn chu.</small>
                </label>
              </div>

              {/* Raw photos toggle */}
              <div className="photography-package-form__raw-photos-option">
                <div>
                  <strong>Có gửi ảnh gốc (raw/full files) cho khách?</strong>
                  <small>Toàn bộ ảnh chụp trong buổi (chưa qua chỉnh sửa màu).</small>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includesRawPhotos}
                  className={includesRawPhotos ? 'is-enabled' : ''}
                  onClick={() => setIncludesRawPhotos((c) => !c)}
                >
                  <span aria-hidden="true" />
                  {includesRawPhotos ? 'Có kèm ảnh gốc' : 'Không kèm'}
                </button>

                {includesRawPhotos && (
                  <label>
                    <span>Số lượng ảnh gốc dự kiến</span>
                    <input
                      type="number"
                      min="1"
                      value={rawPhotosCount}
                      onChange={(e) => setRawPhotosCount(e.target.value)}
                      placeholder="150"
                    />
                  </label>
                )}
              </div>

              <div className="photography-package-form__two-columns">
                <label>
                  <span>
                    Thời gian trả ảnh (ngày) <b>*</b>
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                  />
                  <small>Số ngày từ lúc chụp đến khi bàn giao ảnh hoàn thiện.</small>
                </label>

                <label>
                  <span>Phí phát sinh tăng giờ (đ/giờ)</span>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={overtimeFeePerHour}
                    onChange={(e) => setOvertimeFeePerHour(e.target.value)}
                    placeholder="200000"
                  />
                  <small>Để trống hoặc 0 nếu không tính phí thêm giờ.</small>
                </label>
              </div>

              <label>
                <span>Ghi chú di chuyển / Phụ phí ngoại cảnh</span>
                <textarea
                  value={travelFeeNotes}
                  onChange={(e) => setTravelFeeNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Ví dụ: Miễn phí di chuyển trong nội thành Huế. Điểm chụp ngoại thành phụ thu 150.000đ..."
                />
              </label>
            </section>
          </div>

          {/* ================= RIGHT COLUMN: MEDIA & LIVE PREVIEW ================= */}
          <div className="photography-package-modal-right">
            {/* Media Upload */}
            <section className="photography-package-form__section">
              <div className="photography-package-form__upload-heading">
                <h3>
                  <ImagePlus size={16} /> Bộ sưu tập ảnh minh họa
                </h3>
                <span>{images.length} ảnh đã chọn</span>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) void uploadFiles(e.target.files);
                }}
              />

              <div
                className={`photography-package-form__dropzone ${isDragging ? 'is-dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  void uploadFiles(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
              >
                {isUploading ? (
                  <LoaderCircle className="photography-package-form__spin" size={28} />
                ) : (
                  <UploadCloud size={28} />
                )}
                <strong>{isUploading ? 'Đang tải ảnh lên hệ thống...' : 'Tải lên hoặc kéo thả ảnh vào đây'}</strong>
                <span>Hỗ trợ JPG, PNG, WebP (Tối đa 10MB/ảnh). Ảnh đầu tiên sẽ làm ảnh bìa.</span>
              </div>

              {images.length > 0 && (
                <div className="photography-package-form__images">
                  {images.map((image, index) => (
                    <div className="photography-package-form__image" key={image}>
                      <img src={getMediaUrl(image)} alt={`Ảnh gói chụp ${index + 1}`} />
                      {index === 0 && <span className="photography-package-form__image-tag">Ảnh bìa</span>}
                      <div className="photography-package-form__image-actions">
                        <button
                          type="button"
                          title="Đưa về trước (làm ảnh bìa)"
                          disabled={index === 0}
                          onClick={() => moveImage(index, -1)}
                        >
                          <ArrowLeft size={13} />
                        </button>
                        <button
                          type="button"
                          title="Đưa về sau"
                          disabled={index === images.length - 1}
                          onClick={() => moveImage(index, 1)}
                        >
                          <ArrowRight size={13} />
                        </button>
                        <button
                          type="button"
                          title="Xóa ảnh"
                          onClick={() =>
                            setImages((current) => current.filter((_, itemIdx) => itemIdx !== index))
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Live Interactive Package Preview */}
            <div className="photography-package-live-preview">
              <div className="photography-package-live-preview__header">
                <h4>
                  <Eye size={15} /> Xem trước hiển thị thực tế
                </h4>
                <span className="photography-package-live-preview__badge">Live Preview</span>
              </div>

              <div className="photography-package-live-preview__box">
                <PhotographyPackageCard
                  photographyPackage={previewPackage}
                  categoryName={selectedCategoryName}
                  conceptNames={selectedConceptNames}
                  previewMode
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="photography-package-form__footer">
          <div>
            {error && (
              <p className="photography-package-form__error">
                <AlertCircle size={16} /> {error}
              </p>
            )}
          </div>

          <div className="photography-package-form__actions">
            <button
              type="button"
              className="photography-package-button photography-package-button--secondary"
              onClick={onClose}
              disabled={isSaving || isUploading}
            >
              Hủy
            </button>

            <button
              type="button"
              className="photography-package-button photography-package-button--secondary"
              onClick={() => void submit('DRAFT')}
              disabled={isSaving || isUploading}
            >
              {isSaving ? 'Đang lưu...' : 'Lưu bản nháp'}
            </button>

            <button
              type="button"
              className="photography-package-button photography-package-button--primary"
              onClick={() => void submit('ACTIVE')}
              disabled={isSaving || isUploading}
            >
              {isSaving ? 'Đang lưu...' : 'Đăng bán gói chụp'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
