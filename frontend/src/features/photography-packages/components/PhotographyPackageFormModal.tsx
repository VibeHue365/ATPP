import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Trash2, UploadCloud } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { httpClient } from '../../../services/httpClient';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
import { categoryService } from '../../categories/services/categoryService';
import type { Category } from '../../categories/types';
import type { PhotographyPackage, PhotographyPackagePayload, PhotographyPackageStatus } from '../types/photographyPackage.types';

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
  const [packageCategories, setPackageCategories] = useState<Category[]>([]);
  const [conceptCategories, setConceptCategories] = useState<Category[]>([]);
  const [styleCategories, setStyleCategories] = useState<Category[]>([]);
  const [eventCategories, setEventCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(() => initialPackage?.categoryId || '');
  const [conceptCategoryIds, setConceptCategoryIds] = useState<string[]>(() => initialPackage?.conceptCategoryIds || []);
  const [styleCategoryIds, setStyleCategoryIds] = useState<string[]>(() => initialPackage?.styleCategoryIds || []);
  const [eventCategoryIds, setEventCategoryIds] = useState<string[]>(() => initialPackage?.eventCategoryIds || []);  const [name, setName] = useState(() => initialPackage?.name || '');
  const [description, setDescription] = useState(() => initialPackage?.description || '');
  const [price, setPrice] = useState(() => initialPackage ? String(initialPackage.price) : '');
  const [durationHours, setDurationHours] = useState(() => initialPackage ? String(initialPackage.durationHours) : '1');
  const [editedPhotosCount, setEditedPhotosCount] = useState(() => initialPackage ? String(initialPackage.editedPhotosCount) : '');
  const [rawPhotosCount, setRawPhotosCount] = useState(() => initialPackage ? String(initialPackage.rawPhotosCount || 0) : '0');
  const [includesRawPhotos, setIncludesRawPhotos] = useState(() => Boolean(initialPackage?.rawPhotosCount));
  const [deliveryDays, setDeliveryDays] = useState(() => initialPackage ? String(initialPackage.deliveryDays) : '1');
  const [overtimeFeePerHour, setOvertimeFeePerHour] = useState(() => initialPackage ? String(initialPackage.overtimeFeePerHour || 0) : '0');
  const [travelFeeNotes, setTravelFeeNotes] = useState(() => initialPackage?.travelFeeNotes || '');
  const [images, setImages] = useState<string[]>(() => initialPackage?.images || []);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);


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
    return () => { active = false; };
  }, [isOpen]);

  const toggleCategory = (
    id: string,
    setValue: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setValue((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
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

    if (!normalizedName || !categoryId || normalizedPrice < 0 || normalizedDuration < 0.5 || normalizedEditedPhotos < 0 || normalizedDeliveryDays < 0) {
      setError('Vui lòng chọn danh mục nhiếp ảnh và điền đủ thông tin gói hợp lệ.');
      return;
    }
    if (status === 'ACTIVE' && !images.length) {
      setError('Thêm ít nhất một ảnh minh họa trước khi đăng bán gói chụp.');
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
      editedPhotosCount: normalizedEditedPhotos,
      rawPhotosCount: includesRawPhotos ? numberValue(rawPhotosCount) : 0,
      deliveryDays: normalizedDeliveryDays,
      overtimeFeePerHour: numberValue(overtimeFeePerHour),
      travelFeeNotes: travelFeeNotes.trim() || undefined,
      images,
      status,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialPackage ? 'Chỉnh sửa gói chụp ảnh' : 'Tạo gói chụp ảnh'} maxWidth="1020px">
      <div className="photography-package-form">
        <div className="photography-package-form__intro">
          <ImagePlus size={20} />
          <p>Gói chụp đang hoạt động sẽ hiển thị để khách có thể xem và đặt lịch. Bạn có thể lưu nháp để hoàn thiện sau.</p>
        </div>

        <div className="photography-package-form__grid">
          <section className="photography-package-form__section">
            <h3>Thông tin hiển thị</h3>
            <label>Danh mục nhiếp ảnh <b>*</b>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Chọn danh mục dịch vụ</option>
                {packageCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {([
              ['Concept chụp', conceptCategories, conceptCategoryIds, setConceptCategoryIds],
              ['Phong cách', styleCategories, styleCategoryIds, setStyleCategoryIds],
              ['Sự kiện phù hợp', eventCategories, eventCategoryIds, setEventCategoryIds],
            ] as const).map(([label, categories, selectedIds, setSelectedIds]) => (
              <div key={label} style={{ marginBottom: '13px' }}>
                <strong style={{ display: 'block', marginBottom: '7px', color: '#4d453e', fontSize: '12px' }}>{label}</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {categories.map((category) => {
                    const selected = selectedIds.includes(category.id);
                    return <button key={category.id} type="button" onClick={() => toggleCategory(category.id, setSelectedIds)} style={{ border: selected ? '1px solid #9f1d27' : '1px solid #ded4c6', borderRadius: '999px', padding: '6px 10px', background: selected ? '#fae9e9' : '#fff', color: selected ? '#7d1520' : '#5e554c', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{selected ? '✓ ' : ''}{category.name}</button>;
                  })}
                </div>
              </div>
            ))}            <label>Tên gói <b>*</b><input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} placeholder="Ví dụ: Chụp áo dài ngoại cảnh Huế" /></label>
            <label>Mô tả <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} placeholder="Điểm nổi bật, concept và những trải nghiệm khách nhận được..." /></label>
            <div className="photography-package-form__two-columns">
              <label>Giá gói (đ) <b>*</b><input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="1500000" /></label>
              <label>Thời lượng (giờ) <b>*</b><input type="number" min="0.5" step="0.5" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} /></label>
              <label>Ảnh thành phẩm đã chỉnh sửa <b>*</b><input type="number" min="0" value={editedPhotosCount} onChange={(event) => setEditedPhotosCount(event.target.value)} placeholder="20" /><small>Ảnh đã chọn lọc, chỉnh màu và gửi cho khách.</small></label>
              <div className="photography-package-form__raw-photos-option">
                <div><strong>Có gửi ảnh gốc cho khách?</strong><small>Ảnh từ máy ảnh, chưa chỉnh sửa.</small></div>
                <button type="button" role="switch" aria-checked={includesRawPhotos} className={includesRawPhotos ? 'is-enabled' : ''} onClick={() => setIncludesRawPhotos((current) => !current)}>
                  <span aria-hidden="true" />{includesRawPhotos ? 'Có cung cấp' : 'Không cung cấp'}
                </button>
                {includesRawPhotos && <label>Số ảnh gốc dự kiến<input type="number" min="1" value={rawPhotosCount} onChange={(event) => setRawPhotosCount(event.target.value)} placeholder="150" /></label>}
              </div>
              <label>Trả ảnh sau (ngày) <b>*</b><input type="number" min="0" value={deliveryDays} onChange={(event) => setDeliveryDays(event.target.value)} /></label>
              <label>Phí tăng giờ (đ)<input type="number" min="0" value={overtimeFeePerHour} onChange={(event) => setOvertimeFeePerHour(event.target.value)} /></label>
            </div>
            <label>Ghi chú di chuyển<textarea value={travelFeeNotes} onChange={(event) => setTravelFeeNotes(event.target.value)} maxLength={500} rows={2} placeholder="Ví dụ: Miễn phí trong nội thành Huế..." /></label>
          </section>

          <section className="photography-package-form__section">
            <div className="photography-package-form__upload-heading"><h3>Ảnh minh họa</h3><span>{images.length} ảnh</span></div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); }} />
            <div className={`photography-package-form__dropzone ${isDragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void uploadFiles(event.dataTransfer.files); }} onClick={() => inputRef.current?.click()}>
              {isUploading ? <LoaderCircle className="photography-package-form__spin" size={26} /> : <UploadCloud size={26} />}
              <strong>{isUploading ? 'Đang tải ảnh lên...' : 'Chọn hoặc kéo thả nhiều ảnh'}</strong>
              <span>JPG, PNG hoặc WEBP; ảnh đầu tiên sẽ làm ảnh bìa.</span>
            </div>
            {images.length > 0 && <div className="photography-package-form__images">
              {images.map((image, index) => <div className="photography-package-form__image" key={image}>
                <img src={getMediaUrl(image)} alt={`Ảnh gói chụp ${index + 1}`} />
                {index === 0 && <span>Ảnh bìa</span>}
                <div className="photography-package-form__image-actions">
                  <button type="button" title="Đưa ảnh về trước" disabled={index === 0} onClick={() => moveImage(index, -1)}><ArrowLeft size={14} /></button>
                  <button type="button" title="Đưa ảnh về sau" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}><ArrowRight size={14} /></button>
                  <button type="button" title="Xóa ảnh" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button>
                </div>
              </div>)}
            </div>}
          </section>
        </div>

        {error && <p className="photography-package-form__error"><AlertCircle size={16} /> {error}</p>}
        <div className="photography-package-form__actions">
          <button type="button" className="photography-package-button photography-package-button--secondary" onClick={onClose} disabled={isSaving || isUploading}>Hủy</button>
          <button type="button" className="photography-package-button photography-package-button--secondary" onClick={() => void submit('DRAFT')} disabled={isSaving || isUploading}>{isSaving ? 'Đang lưu...' : 'Lưu bản nháp'}</button>
          <button type="button" className="photography-package-button photography-package-button--primary" onClick={() => void submit('ACTIVE')} disabled={isSaving || isUploading}>{isSaving ? 'Đang lưu...' : 'Đăng bán gói'}</button>
        </div>
      </div>
    </Modal>
  );
}
