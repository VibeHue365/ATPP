import React, { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import {
  X,
  Plus,
  Play,
  ChevronLeft,
  ChevronRight,
  Bold,
  Italic,
  Underline,
  List as ListIcon,
  Quote,
  Link2,
  Image as ImageIcon,
  Check,
  Sparkles,
  RefreshCw,
  Camera,
  Trash2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { SmartTagEditor } from '../../smart-tagging/components/SmartTagEditor';
import {
  colorLabels,
  colorSwatches,
  materialLabels,
} from '../constants';
import type { useProviderInventoryState } from '../inventory/useProviderInventoryState';
import { getImageUrl } from '../shared/mediaHelpers';
import type { VariantRow } from '../types';
import type { useProductWizardState } from './useProductWizardState';
import type { useProviderProductsState } from './useProviderProductsState';
import './productWizardFigma.css';

const SMART_TAG_LABELS: Record<string, string> = {
  TRUYEN_THONG: 'Áo dài truyền thống',
  CACH_TAN: 'Áo dài cách tân',
  PHA_CACH: 'Phong cách phá cách',
  PHU_HOP_LE_CUOI: 'Lễ cưới & Đám hỏi',
  CHUP_ANH_KY_YEU: 'Chụp ảnh kỷ yếu',
  LE_HOI_TRUYEN_THONG: 'Lễ hội & Tết',
  BIEU_DIEN_SU_KIEN: 'Biểu diễn & Sự kiện',
  DAO_PHO: 'Dạo phố & Chụp ảnh',
};

type ProductWizardModalProps = Pick<
  ReturnType<typeof useProductWizardState>,
  | 'isModalOpen'
  | 'editingProduct'
  | 'wizardStep'
  | 'setWizardStep'
  | 'prodName'
  | 'setProdName'
  | 'prodCategoryId'
  | 'setProdCategoryId'
  | 'prodStatus'
  | 'setProdStatus'
  | 'prodBasePrice'
  | 'setProdBasePrice'
  | 'prodDepositAmount'
  | 'setProdDepositAmount'
  | 'prodDescription'
  | 'setProdDescription'
  | 'uploadingImages'
  | 'prodImages'
  | 'uploadingVideos'
  | 'prodVideos'
  | 'editInvSummary'
  | 'prodSizes'
  | 'setProdSizes'
  | 'prodColors'
  | 'setProdColors'
  | 'prodMaterials'
  | 'setProdMaterials'
  | 'variants'
  | 'setVariants'
  | 'prodColorImages'
  | 'uploadingColor'
  | 'createdDraftId'
  | 'setActiveTagCodes'
  | 'savingDraft'
  | 'activeTagCodes'
> &
  Pick<ReturnType<typeof useProviderProductsState>, 'categories'> &
  Pick<
    ReturnType<typeof useProviderInventoryState>,
    | 'setAddInvProductId'
    | 'setIsAddInventoryOpen'
    | 'variantBusy'
    | 'setVariantEditRow'
    | 'setVariantEditQty'
  > & {
    handleWizardCancel: () => Promise<void>;
    handleImageChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
    removeImage: (index: number) => void;
    handleVideoChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
    removeVideo: (index: number) => void;
    handleRemoveVariant: (row: any) => Promise<void>;
    updateVariantRow: (idx: number, field: keyof VariantRow, value: string | number) => void;
    removeVariantRow: (idx: number) => void;
    addVariantRow: () => void;
    colorsNeedingImages: () => string[];
    handleColorImageChange: (color: string, e: ChangeEvent<HTMLInputElement>) => Promise<void>;
    removeColorImage: (color: string, index: number) => void;
    handleWizardFinish: () => Promise<void>;
    handleWizardBack: () => void;
    handleWizardNext: () => Promise<void>;
  };

export function ProductWizardModal({
  isModalOpen,
  handleWizardCancel,
  editingProduct,
  wizardStep,
  setWizardStep,
  prodName,
  setProdName,
  prodCategoryId,
  setProdCategoryId,
  categories,
  prodStatus,
  setProdStatus,
  prodBasePrice,
  setProdBasePrice,
  prodDepositAmount,
  setProdDepositAmount,
  prodDescription,
  setProdDescription,
  handleImageChange,
  uploadingImages,
  prodImages,
  removeImage,
  handleVideoChange,
  uploadingVideos,
  prodVideos,
  removeVideo,
  setAddInvProductId,
  setIsAddInventoryOpen,
  editInvSummary,
  prodSizes,
  setProdSizes,
  prodColors,
  setProdColors,
  prodMaterials,
  setProdMaterials,
  variantBusy,
  setVariantEditRow,
  setVariantEditQty,
  handleRemoveVariant,
  variants,
  setVariants,
  updateVariantRow,
  removeVariantRow,
  addVariantRow: _addVariantRow,
  colorsNeedingImages,
  prodColorImages,
  uploadingColor,
  handleColorImageChange,
  removeColorImage,
  createdDraftId,
  setActiveTagCodes,
  handleWizardFinish,
  handleWizardBack,
  handleWizardNext,
  savingDraft,
  activeTagCodes,
}: ProductWizardModalProps) {
  // Local state for live preview carousel & extra cultural fields from Figma
  const [previewIdx, setPreviewIdx] = useState<number>(0);
  const [designStory, setDesignStory] = useState<string>('');
  const [materialOrigin, setMaterialOrigin] = useState<string>('');
  const [fitTips, setFitTips] = useState<string>('');

  // Step 2: Variants & Inventory State
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(0);
  const [variantPreviewIdx, setVariantPreviewIdx] = useState<number>(0);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [targetUploadColor, setTargetUploadColor] = useState<string | null>(null);
  const colorFileInputRef = useRef<HTMLInputElement>(null);

  // Figma 368:297 Attribute definitions
  const ALL_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

  const ALL_COLORS: { key: string; label: string; swatch: string }[] = [
    { key: 'RED', label: 'Đỏ', swatch: '#881337' },
    { key: 'PINK', label: 'Hồng', swatch: '#EC4899' },
    { key: 'WHITE', label: 'Trắng', swatch: '#FFFFFF' },
    { key: 'GOLD', label: 'Vàng', swatch: '#F59E0B' },
    { key: 'BLUE', label: 'Xanh dương', swatch: '#3B82F6' },
    { key: 'GREEN', label: 'Xanh lá', swatch: '#10B981' },
    { key: 'BLACK', label: 'Đen', swatch: '#1F2937' },
  ];

  const ALL_MATERIALS: { key: string; label: string }[] = [
    { key: 'SILK', label: 'Lụa tơ tằm' },
    { key: 'BROCADE', label: 'Gấm' },
    { key: 'VELVET', label: 'Nhung' },
    { key: 'ORGANZA', label: 'Voan' },
    { key: 'KATE', label: 'Kate' },
    { key: 'OTHER', label: 'Khác' },
  ];

  const generateSku = (name: string, color: string, size: string): string => {
    const rawName = (name || '').trim();
    let cleaned = rawName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toUpperCase();
    cleaned = cleaned.replace(/^AO\s*DAI\s*/i, '').replace(/[^A-Z0-9]/g, '');
    const shortSlug = cleaned.slice(0, 8) || (rawName ? 'AD' : 'NEW');
    const colorCode = (color || 'MAU').toUpperCase();
    const sizeCode = (size || 'SZ').toUpperCase();
    return `AD-${shortSlug}-${colorCode}-${sizeCode}`;
  };

  const generateMatrixRows = (
    sizes: string[],
    colors: string[],
    materials: string[],
    existingList: VariantRow[]
  ): VariantRow[] => {
    if (sizes.length === 0 || colors.length === 0) {
      return [];
    }
    const sList = sizes;
    const cList = colors;
    const mList = materials.length > 0 ? materials : ['SILK'];

    // Map existing quantities by composite key `${size}_${color}_${material}`
    const existingQtyMap = new Map<string, number>();
    existingList.forEach((v) => {
      existingQtyMap.set(`${v.size}_${v.color}_${v.material}`, Number(v.quantity) || 1);
    });

    const rows: VariantRow[] = [];
    for (const c of cList) {
      for (const s of sList) {
        for (const m of mList) {
          const key = `${s}_${c}_${m}`;
          const existingQty = existingQtyMap.get(key);
          const qty = existingQty !== undefined ? existingQty : 1;
          rows.push({
            size: s,
            color: c,
            material: m,
            quantity: qty,
            condition: 'GOOD',
          });
        }
      }
    }
    return rows;
  };

  const handleToggleSize = (sz: string) => {
    const isRemoving = prodSizes.includes(sz);
    const updated = isRemoving
      ? prodSizes.filter((s) => s !== sz)
      : [...prodSizes, sz];
    setProdSizes(updated);

    if (isRemoving) {
      // Remove only variants that match the deselected size
      setVariants((prev) => prev.filter((v) => v.size !== sz));
    } else if (prodColors.length > 0) {
      // Add missing combinations for newly selected size
      const mats = prodMaterials.length > 0 ? prodMaterials : ['SILK'];
      const newRows: VariantRow[] = [];
      for (const c of prodColors) {
        for (const m of mats) {
          const exists = variants.some((v) => v.size === sz && v.color === c && v.material === m);
          if (!exists) {
            newRows.push({ size: sz, color: c, material: m, quantity: 1, condition: 'GOOD' });
          }
        }
      }
      if (newRows.length > 0) {
        setVariants((prev) => [...prev, ...newRows]);
      }
    }
  };

  const handleToggleColor = (col: string) => {
    const isRemoving = prodColors.includes(col);
    const updated = isRemoving
      ? prodColors.filter((c) => c !== col)
      : [...prodColors, col];
    setProdColors(updated);

    if (isRemoving) {
      // Remove only variants that match the deselected color
      setVariants((prev) => prev.filter((v) => v.color !== col));
    } else if (prodSizes.length > 0) {
      // Add missing combinations for newly selected color
      const mats = prodMaterials.length > 0 ? prodMaterials : ['SILK'];
      const newRows: VariantRow[] = [];
      for (const s of prodSizes) {
        for (const m of mats) {
          const exists = variants.some((v) => v.size === s && v.color === col && v.material === m);
          if (!exists) {
            newRows.push({ size: s, color: col, material: m, quantity: 1, condition: 'GOOD' });
          }
        }
      }
      if (newRows.length > 0) {
        setVariants((prev) => [...prev, ...newRows]);
      }
    }
  };

  const handleToggleMaterial = (mat: string) => {
    const updated = prodMaterials.includes(mat)
      ? prodMaterials.filter((m) => m !== mat)
      : [...prodMaterials, mat];
    setProdMaterials(updated);
  };

  const handleRegenerateMatrix = () => {
    const newRows = generateMatrixRows(prodSizes, prodColors, prodMaterials, variants);
    setVariants(newRows);
  };

  const handleDeleteRow = (idx: number) => {
    removeVariantRow(idx);
    setSelectedRowIds((prev) => {
      const next = new Set<number>();
      prev.forEach((id) => {
        if (id < idx) next.add(id);
        else if (id > idx) next.add(id - 1);
      });
      return next;
    });
    if (selectedVariantIdx === idx) {
      setSelectedVariantIdx(0);
    } else if (selectedVariantIdx > idx) {
      setSelectedVariantIdx((prev) => Math.max(0, prev - 1));
    }
  };

  const handleBulkDelete = () => {
    if (selectedRowIds.size === 0) return;
    setVariants((prev) => prev.filter((_, idx) => !selectedRowIds.has(idx)));
    setSelectedRowIds(new Set());
    setSelectedVariantIdx(0);
  };

  const handleTriggerUploadColor = (color: string) => {
    setTargetUploadColor(color);
    if (colorFileInputRef.current) {
      colorFileInputRef.current.value = '';
      colorFileInputRef.current.click();
    }
  };

  const handleColorFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    if (targetUploadColor && e.target.files && e.target.files.length > 0) {
      handleColorImageChange(targetUploadColor, e);
    }
  };

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // Reset preview carousel index if images change
  useEffect(() => {
    setPreviewIdx(0);
  }, [prodImages.length]);

  if (!isModalOpen) return null;

  // Build gallery array for Live Preview
  const previewGallery = prodImages.length > 0
    ? prodImages.map((img) => getImageUrl(img))
    : [];

  const currentPreviewImg = previewGallery[previewIdx] || previewGallery[0] || '';

  const selectedCategoryName =
    categories.find((c) => (c._id || c.id) === prodCategoryId)?.name || '';

  const previewBasePrice = prodBasePrice ? Number(prodBasePrice) : null;
  const previewDeposit = prodDepositAmount ? Number(prodDepositAmount) : null;

  const stepsList = [
    { n: 1, title: 'Thông tin cơ bản', sub: 'Tên, mô tả, hình ảnh' },
    { n: 2, title: 'Biến thể & Tồn kho', sub: 'Kích cỡ, màu sắc, số lượng' },
    { n: 3, title: 'Thẻ thông minh AI', sub: 'Kiểu dáng, phong cách, dịp sử dụng' },
  ];

  return (
    <div className="pwm-backdrop" onClick={handleWizardCancel}>
      <div className="pwm-container" onClick={(e) => e.stopPropagation()}>
        {/* 1. MODAL HEADER WITH FIGMA STEPPER */}
        <div className="pwm-header">
          {/* Header Left: Icon & Title */}
          <div className="pwm-header-left">
            <div className="pwm-icon-box">
              <Sparkles size={22} />
            </div>
            <div className="pwm-title-wrap">
              <h3>{editingProduct ? 'Chỉnh sửa thông tin Áo Dài' : 'Thêm áo dài mới'}</h3>
              <p>Tạo một sản phẩm thật ấn tượng để thu hút khách hàng</p>
            </div>
          </div>

          {/* Stepper Bar */}
          <div className="pwm-stepper">
            {stepsList.map((step, idx) => {
              const active = wizardStep === step.n;
              const done = wizardStep > step.n;
              return (
                <React.Fragment key={step.n}>
                  <button
                    type="button"
                    onClick={() => {
                      if (editingProduct) setWizardStep(step.n);
                    }}
                    className={`pwm-step-item ${active ? 'active' : ''} ${done ? 'done' : ''} ${
                      editingProduct ? 'clickable' : ''
                    }`}
                  >
                    <div className="pwm-step-circle">
                      {done ? <Check size={14} /> : step.n}
                    </div>
                    <div className="pwm-step-text">
                      <span className="pwm-step-title">{step.title}</span>
                      <span className="pwm-step-sub">{step.sub}</span>
                    </div>
                  </button>
                  {idx < stepsList.length - 1 && (
                    <div className={`pwm-step-line ${wizardStep > idx + 1 ? 'active' : ''}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={handleWizardCancel}
            className="pwm-close-btn"
            title="Đóng modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. MODAL BODY */}
        <div className="pwm-body">
          {wizardStep === 1 && (
            <div className="pwm-step1-grid">
              {/* LEFT COLUMN: FORM */}
              <div className="pwm-form-col">
                <h4 className="pwm-section-title">Thông tin chung</h4>

                {/* Name & Category Row */}
                <div className="pwm-form-row">
                  <div className="pwm-form-group">
                    <label className="pwm-label">
                      Tên thiết kế <span className="pwm-req">*</span>
                    </label>
                    <input
                      type="text"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="Ví dụ: Áo dài Ngũ Thân"
                      className="pwm-input"
                      required
                    />
                  </div>

                  <div className="pwm-form-group">
                    <label className="pwm-label">
                      Danh mục <span className="pwm-req">*</span>
                    </label>
                    <select
                      value={prodCategoryId}
                      onChange={(e) => setProdCategoryId(e.target.value)}
                      className="pwm-select"
                      required
                    >
                      {categories.map((c) => (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Price & Deposit Row */}
                <div className="pwm-form-row">
                  <div className="pwm-form-group">
                    <label className="pwm-label">
                      Giá thuê / ngày <span className="pwm-req">*</span>
                    </label>
                    <div className="pwm-input-unit-wrap">
                      <input
                        type="number"
                        value={prodBasePrice}
                        onChange={(e) => setProdBasePrice(e.target.value)}
                        placeholder="500000"
                        className="pwm-input"
                        style={{ paddingRight: '50px' }}
                        required
                      />
                      <span className="pwm-input-unit">VND</span>
                    </div>
                  </div>

                  <div className="pwm-form-group">
                    <label className="pwm-label">
                      Tiền đặt cọc <span className="pwm-req">*</span>
                    </label>
                    <div className="pwm-input-unit-wrap">
                      <input
                        type="number"
                        value={prodDepositAmount}
                        onChange={(e) => setProdDepositAmount(e.target.value)}
                        placeholder="1000000"
                        className="pwm-input"
                        style={{ paddingRight: '50px' }}
                        required
                      />
                      <span className="pwm-input-unit">VND</span>
                    </div>
                  </div>
                </div>

                {/* Status Row */}
                <div className="pwm-form-group">
                  <label className="pwm-label">Trạng thái ban đầu</label>
                  <select
                    value={prodStatus}
                    onChange={(e) => setProdStatus(e.target.value as any)}
                    className="pwm-select"
                  >
                    <option value="DRAFT">Bản nháp (Tạm ẩn - khuyên dùng khi mới tạo)</option>
                    <option value="ACTIVE">Đang hoạt động (Mở bán & cho thuê ngay)</option>
                    <option value="INACTIVE">Ngừng kinh doanh</option>
                  </select>
                </div>

                {/* Description Rich Text Editor */}
                <div className="pwm-form-group">
                  <label className="pwm-label">Mô tả chi tiết</label>
                  <div className="pwm-editor-card">
                    <div className="pwm-editor-toolbar">
                      <button type="button" className="pwm-tool-btn" title="In đậm">
                        <Bold size={13} />
                      </button>
                      <button type="button" className="pwm-tool-btn" title="In nghiêng">
                        <Italic size={13} />
                      </button>
                      <button type="button" className="pwm-tool-btn" title="Gạch chân">
                        <Underline size={13} />
                      </button>
                      <div className="pwm-tool-sep" />
                      <button type="button" className="pwm-tool-btn" title="Danh sách">
                        <ListIcon size={13} />
                      </button>
                      <button type="button" className="pwm-tool-btn" title="Trích dẫn">
                        <Quote size={13} />
                      </button>
                      <button type="button" className="pwm-tool-btn" title="Chèn liên kết">
                        <Link2 size={13} />
                      </button>
                      <button type="button" className="pwm-tool-btn" title="Chèn hình">
                        <ImageIcon size={13} />
                      </button>
                    </div>

                    <textarea
                      value={prodDescription}
                      onChange={(e) => setProdDescription(e.target.value)}
                      placeholder="Áo dài Ngũ Thân được lấy cảm hứng từ trang phục cung đình Huế, với form dáng truyền thống, tôn vinh nét đẹp thanh lịch và trang nhã của người phụ nữ Việt. Chất liệu lụa tơ tằm cao cấp, thêu họa tiết thủ công tinh xảo..."
                      rows={4}
                      maxLength={1000}
                      className="pwm-textarea"
                    />

                    <div className="pwm-counter-row">
                      <span>{(prodDescription || '').length}/1000</span>
                    </div>
                  </div>
                </div>

                {/* Cultural & Storytelling Fields from Figma */}
                <div className="pwm-form-row">
                  <div className="pwm-form-group">
                    <label className="pwm-label">Câu chuyện thiết kế</label>
                    <div className="pwm-input-counter-wrap">
                      <input
                        type="text"
                        value={designStory}
                        onChange={(e) => setDesignStory(e.target.value)}
                        placeholder="Lấy cảm hứng từ nét đẹp cung đình triều Nguyễn..."
                        maxLength={500}
                        className="pwm-input"
                        style={{ paddingRight: '54px' }}
                      />
                      <span className="pwm-input-counter">{designStory.length}/500</span>
                    </div>
                  </div>

                  <div className="pwm-form-group">
                    <label className="pwm-label">Chất liệu &amp; xuất xứ</label>
                    <div className="pwm-input-counter-wrap">
                      <input
                        type="text"
                        value={materialOrigin}
                        onChange={(e) => setMaterialOrigin(e.target.value)}
                        placeholder="Lụa tơ tằm cao cấp, được dệt thủ công tại làng lụa..."
                        maxLength={500}
                        className="pwm-input"
                        style={{ paddingRight: '54px' }}
                      />
                      <span className="pwm-input-counter">{materialOrigin.length}/500</span>
                    </div>
                  </div>
                </div>

                <div className="pwm-form-group">
                  <label className="pwm-label">Gợi ý dáng người phù hợp</label>
                  <div className="pwm-input-counter-wrap">
                    <input
                      type="text"
                      value={fitTips}
                      onChange={(e) => setFitTips(e.target.value)}
                      placeholder="Phù hợp với dáng người từ 1m55 - 1m70, tôn dáng..."
                      maxLength={300}
                      className="pwm-input"
                      style={{ paddingRight: '54px' }}
                    />
                    <span className="pwm-input-counter">{fitTips.length}/300</span>
                  </div>
                </div>

                {/* Hình ảnh & Video Section */}
                <div className="pwm-media-section">
                  <label className="pwm-label">
                    Hình ảnh &amp; Video <span className="pwm-req">*</span>
                  </label>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    Tải lên hình ảnh chất lượng cao và video ngắn để giới thiệu sản phẩm
                  </span>

                  {/* Hidden inputs */}
                  <input
                    id="pwm-img-input"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                  <input
                    id="pwm-vid-input"
                    type="file"
                    multiple
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={handleVideoChange}
                    style={{ display: 'none' }}
                  />

                  <div className="pwm-media-grid">
                    {/* Uploaded Images */}
                    {prodImages.map((imgUrl, index) => (
                      <div key={index} className="pwm-media-card">
                        <img
                          src={getImageUrl(imgUrl)}
                          alt={`Uploaded ${index + 1}`}
                          className="pwm-media-img"
                        />
                        {index === 0 && <span className="pwm-cover-badge">● Ảnh bìa</span>}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="pwm-media-del"
                          title="Xóa ảnh này"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}

                    {/* Add Image Box */}
                    <button
                      type="button"
                      onClick={() => document.getElementById('pwm-img-input')?.click()}
                      className="pwm-add-box"
                      disabled={uploadingImages}
                    >
                      <Plus size={18} style={{ color: '#881337' }} />
                      <span className="pwm-add-box-title">
                        {uploadingImages ? 'Đang tải...' : 'Thêm ảnh'}
                      </span>
                      <span className="pwm-add-box-sub">(Tối đa 10 ảnh)</span>
                    </button>

                    {/* Uploaded Videos */}
                    {prodVideos.map((vidUrl, index) => (
                      <div key={index} className="pwm-media-card" style={{ backgroundColor: '#000' }}>
                        <video
                          src={getImageUrl(vidUrl)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <span className="pwm-video-duration">00:30</span>
                        <button
                          type="button"
                          onClick={() => removeVideo(index)}
                          className="pwm-media-del"
                          title="Xóa video"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}

                    {/* Add Video Box (if < 1 video) */}
                    {prodVideos.length === 0 && (
                      <button
                        type="button"
                        onClick={() => document.getElementById('pwm-vid-input')?.click()}
                        className="pwm-add-box"
                        disabled={uploadingVideos}
                        style={{ position: 'relative' }}
                      >
                        <span className="pwm-video-duration">00:30</span>
                        <Play size={18} style={{ color: '#881337', marginTop: 10 }} />
                        <span className="pwm-add-box-title">
                          {uploadingVideos ? 'Đang tải...' : 'Thêm video'}
                        </span>
                        <span className="pwm-add-box-sub">(Tối đa 1 video)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: LIVE PREVIEW CARD */}
              <div className="pwm-preview-col">
                <div className="pwm-preview-header">
                  <h4>Xem trước sản phẩm</h4>
                  <p>Đây là cách sản phẩm sẽ hiển thị trên website</p>
                </div>

                <div className="pwm-preview-card">
                  {/* Big Image Carousel */}
                  {currentPreviewImg ? (
                    <div className="pwm-preview-main-img-wrap">
                      <img
                        src={currentPreviewImg}
                        alt="Xem trước áo dài"
                        className="pwm-preview-main-img"
                      />

                      {previewGallery.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewIdx((i) => (i > 0 ? i - 1 : previewGallery.length - 1))
                            }
                            className="pwm-preview-arrow prev"
                            title="Ảnh trước"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewIdx((i) => (i < previewGallery.length - 1 ? i + 1 : 0))
                            }
                            className="pwm-preview-arrow next"
                            title="Ảnh sau"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="pwm-preview-empty-image">
                      <ImageIcon size={36} strokeWidth={1.5} color="#9CA3AF" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>Chưa có hình ảnh</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Tải ảnh lên ở form bên trái</span>
                    </div>
                  )}

                  {/* 4 Thumbnails */}
                  {previewGallery.length > 0 && (
                    <div className="pwm-preview-thumbs">
                      {previewGallery.slice(0, 4).map((thumbUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPreviewIdx(idx)}
                          className={`pwm-preview-thumb-btn ${previewIdx === idx ? 'active' : ''}`}
                        >
                          <img
                            src={thumbUrl}
                            alt={`Thumbnail ${idx + 1}`}
                            className="pwm-preview-thumb-img"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Meta: Title & Badge */}
                  <div className="pwm-preview-meta">
                    <div className="pwm-preview-title-row">
                      <h4 className="pwm-preview-prod-title">
                        {prodName.trim() ? (
                          prodName
                        ) : (
                          <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontWeight: 500 }}>
                            Chưa nhập tên sản phẩm
                          </span>
                        )}
                      </h4>
                      <span className={`pwm-preview-status-pill ${(prodStatus || 'DRAFT').toLowerCase()}`}>
                        {prodStatus === 'ACTIVE' ? 'Đang bán' : prodStatus === 'DRAFT' ? 'Bản nháp' : 'Tạm ngưng'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: selectedCategoryName ? '#6B7280' : '#9CA3AF', marginTop: '-2px' }}>
                      {selectedCategoryName || 'Chưa chọn danh mục'}
                    </div>

                    {/* Pricing */}
                    <div className="pwm-preview-pricing">
                      {previewBasePrice !== null ? (
                        <>
                          <strong>{previewBasePrice.toLocaleString('vi-VN')}đ</strong> / ngày
                          {previewDeposit !== null && (
                            <> &nbsp;·&nbsp; Cọc: {previewDeposit.toLocaleString('vi-VN')}đ</>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: 500 }}>
                          Chưa nhập giá thuê
                        </span>
                      )}
                    </div>

                    {/* Description snippet */}
                    <p className="pwm-preview-desc">
                      {prodDescription.trim() ? (
                        <>
                          {prodDescription.length > 120
                            ? `${prodDescription.slice(0, 120)}...`
                            : prodDescription}
                          {prodDescription.length > 120 && (
                            <span className="pwm-preview-see-more">Xem thêm</span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                          Chưa có mô tả chi tiết.
                        </span>
                      )}
                    </p>

                    {/* Attributes */}
                    <div className="pwm-preview-attr-row">
                      <span className="pwm-preview-attr-label">Kích cỡ</span>
                      <div className="pwm-preview-pills">
                        {prodSizes && prodSizes.length > 0 ? (
                          prodSizes.map((sz) => (
                            <span key={sz} className="pwm-preview-pill">
                              {sz}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>
                            Chưa chọn
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pwm-preview-attr-row">
                      <span className="pwm-preview-attr-label">Màu sắc</span>
                      {prodColors && prodColors.length > 0 ? (
                        <div className="pwm-preview-swatches">
                          {prodColors.map((c) => (
                            <span
                              key={c}
                              className="pwm-preview-swatch"
                              style={{ backgroundColor: colorSwatches[c] || '#881337' }}
                              title={colorLabels[c] || c}
                            />
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>
                          Chưa chọn
                        </span>
                      )}
                    </div>

                    <div className="pwm-preview-attr-row">
                      <span className="pwm-preview-attr-label">Chất liệu</span>
                      {prodMaterials && prodMaterials.length > 0 ? (
                        <span className="pwm-preview-pill">
                          {materialLabels[prodMaterials[0]] || prodMaterials[0]}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>
                          Chưa chọn
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            editingProduct ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '16px', border: '1px solid #EBE4D8', borderRadius: '12px', backgroundColor: '#FAF8F5', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 750, color: '#111827' }}>
                      Biến thể &amp; tồn kho hiện có
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAddInvProductId(editingProduct._id);
                        setIsAddInventoryOpen(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        backgroundColor: '#881337',
                        color: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} /> Nhập thêm hàng
                    </button>
                  </div>

                  {editInvSummary.length === 0 ? (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(prodSizes || []).map((sz) => (
                        <span key={'s' + sz} className="pwm-preview-pill">
                          {sz}
                        </span>
                      ))}
                      {(prodColors || []).map((c) => (
                        <span key={'c' + c} className="pwm-preview-pill">
                          {colorLabels[c] || c}
                        </span>
                      ))}
                      {(prodMaterials || []).map((m) => (
                        <span key={'m' + m} className="pwm-preview-pill">
                          {materialLabels[m] || m}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: 'white' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#FAF8F5', color: '#6B7280' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>KÍCH CỠ</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>MÀU</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>CHẤT LIỆU</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>TỔNG</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>KHẢ DỤNG</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>THAO TÁC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editInvSummary.map((row: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #F0ECE4' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 650 }}>{row.size}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 650 }}>{colorLabels[row.color] || row.color}</td>
                              <td style={{ padding: '10px 14px' }}>{materialLabels[row.material] || row.material || '—'}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 750 }}>{row.total}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 750, color: '#059669' }}>{row.available}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    disabled={variantBusy}
                                    onClick={() => {
                                      setVariantEditRow(row);
                                      setVariantEditQty(String(row.total));
                                    }}
                                    style={{
                                      padding: '5px 10px',
                                      border: '1px solid #D1D5DB',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      cursor: variantBusy ? 'not-allowed' : 'pointer',
                                      fontWeight: 650,
                                      fontSize: '11.5px',
                                      color: '#881337',
                                    }}
                                  >
                                    Sửa số lượng
                                  </button>
                                  <button
                                    type="button"
                                    disabled={variantBusy}
                                    onClick={() => handleRemoveVariant(row)}
                                    style={{
                                      padding: '5px 10px',
                                      border: '1px solid #FECACA',
                                      borderRadius: '6px',
                                      backgroundColor: '#FEF2F2',
                                      cursor: variantBusy ? 'not-allowed' : 'pointer',
                                      fontWeight: 650,
                                      fontSize: '11.5px',
                                      color: '#DC2626',
                                    }}
                                  >
                                    Xóa
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                    Nhập thêm hàng và sửa/xóa biến thể là thao tác trên KHO — có hiệu lực ngay. Trạng thái giặt / bảo trì quản lý ở tab Tồn kho.
                  </p>
                </div>

                {/* Ảnh theo màu */}
                {colorsNeedingImages().length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '18px',
                      border: '1px solid #EBE4D8',
                      borderRadius: '12px',
                      backgroundColor: '#FAF8F5',
                    }}
                  >
                    <div>
                      <h5 style={{ margin: 0, fontSize: '13.5px', fontWeight: 750, color: '#111827' }}>
                        ẢNH RIÊNG THEO MÀU SẮC
                      </h5>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7280' }}>
                        Khách đổi màu ở trang sản phẩm thì ảnh đổi theo. Màu nào bỏ trống sẽ dùng ảnh chung ở bước 1.
                      </p>
                    </div>

                    {colorsNeedingImages().map((color) => {
                      const shots = prodColorImages[color] || [];
                      const busy = uploadingColor === color;
                      return (
                        <div
                          key={`ci-${color}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: '1px solid #E5E7EB',
                            backgroundColor: 'white',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '13px',
                                fontWeight: 700,
                              }}
                            >
                              <span
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  border: '1px solid rgba(0,0,0,0.15)',
                                  backgroundColor: colorSwatches[color] || '#D4D4D8',
                                }}
                              />
                              {colorLabels[color] || color}
                              {shots.length === 0 && (
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#B45309' }}>
                                  — chưa có ảnh riêng
                                </span>
                              )}
                            </span>

                            <label
                              style={{
                                padding: '6px 14px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                color: '#881337',
                                backgroundColor: 'white',
                                cursor: busy ? 'wait' : 'pointer',
                                opacity: busy ? 0.6 : 1,
                              }}
                            >
                              {busy ? 'Đang tải...' : '+ Thêm ảnh'}
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                hidden
                                disabled={busy}
                                onChange={(e) => handleColorImageChange(color, e)}
                              />
                            </label>
                          </div>

                          {shots.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 4 }}>
                              {shots.map((url, idx) => (
                                <div
                                  key={`${color}-${url}-${idx}`}
                                  style={{
                                    position: 'relative',
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    border: '1px solid #E5E7EB',
                                  }}
                                >
                                  <img
                                    src={getImageUrl(url)}
                                    alt={`${color} ${idx + 1}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeColorImage(color, idx)}
                                    style={{
                                      position: 'absolute',
                                      top: '2px',
                                      right: '2px',
                                      width: '18px',
                                      height: '18px',
                                      border: 'none',
                                      borderRadius: '50%',
                                      backgroundColor: 'rgba(0,0,0,0.65)',
                                      color: 'white',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="pwm-step2-layout">
                {/* Hidden input for color photo upload */}
                <input
                  ref={colorFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleColorFileSelected}
                />
                {/* 1. MAIN COLUMN: Attributes & Variant Matrix */}
                <div className="pwm-step2-center">
                  <div className="pwm-step2-heading">
                    <h4>2. Thiết lập biến thể &amp; Tồn kho</h4>
                    <p>Tạo các biến thể (size, màu sắc, chất liệu) và khai báo số lượng hiện có trong kho.</p>
                  </div>

                  {/* Attribute Selectors Card */}
                  <div className="pwm-attr-card">
                    <h5 className="pwm-attr-card-title">Chọn thuộc tính biến thể</h5>
                    <p className="pwm-attr-card-sub">Chọn các tùy chọn áp dụng cho sản phẩm này</p>

                    <div className="pwm-attr-grid">
                      {/* Column 1: Kích cỡ */}
                      <div>
                        <div className="pwm-attr-col-label">
                          Kích cỡ (Size) <span style={{ color: '#DC2626' }}>*</span>
                        </div>
                        <div className="pwm-attr-pills">
                          {ALL_SIZES.map((sz) => {
                            const isChecked = prodSizes.includes(sz);
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => handleToggleSize(sz)}
                                className={`pwm-size-pill ${isChecked ? 'active' : ''}`}
                              >
                                {isChecked && <Check size={13} strokeWidth={3} />}
                                <span>{sz}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Column 2: Màu sắc */}
                      <div>
                        <div className="pwm-attr-col-label">
                          Màu sắc <span style={{ color: '#DC2626' }}>*</span>
                        </div>
                        <div className="pwm-attr-pills">
                          {ALL_COLORS.map((col) => {
                            const isChecked = prodColors.includes(col.key);
                            return (
                              <button
                                key={col.key}
                                type="button"
                                onClick={() => handleToggleColor(col.key)}
                                className={`pwm-color-pill ${isChecked ? 'active' : ''}`}
                              >
                                <span
                                  className="pwm-color-pill-dot"
                                  style={{ backgroundColor: col.swatch }}
                                />
                                <span>{col.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Column 3: Chất liệu */}
                      <div>
                        <div className="pwm-attr-col-label">Chất liệu</div>
                        <div className="pwm-material-grid">
                          {ALL_MATERIALS.map((mat) => {
                            const isChecked = prodMaterials.includes(mat.key);
                            return (
                              <label
                                key={mat.key}
                                onClick={() => handleToggleMaterial(mat.key)}
                                className="pwm-material-check-item"
                              >
                                <div className={`pwm-checkbox-box ${isChecked ? 'checked' : ''}`}>
                                  {isChecked && <Check size={12} strokeWidth={3} />}
                                </div>
                                <span>{mat.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Variant Matrix Table Card */}
                  <div className="pwm-matrix-card">
                    <div className="pwm-matrix-header">
                      <div className="pwm-matrix-header-info">
                        <h4>Ma trận biến thể ({variants.length})</h4>
                        <p>
                          {variants.length > 0
                            ? 'Bạn có thể trực tiếp đổi Màu, Kích cỡ, Chất liệu, chỉnh số lượng hoặc xóa bất kỳ biến thể nào.'
                            : 'Chưa có biến thể nào. Chọn kích cỡ và màu sắc ở trên để sinh tự động, hoặc bấm "Thêm biến thể thủ công".'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedRowIds.size > 0 && (
                          <button
                            type="button"
                            onClick={handleBulkDelete}
                            className="pwm-matrix-bulk-delete-btn"
                            title="Xóa các biến thể đã chọn"
                          >
                            <Trash2 size={13} />
                            <span>Xóa {selectedRowIds.size} biến thể</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleRegenerateMatrix}
                          className="pwm-matrix-regen-btn"
                          title="Sinh lại tổ hợp biến thể từ thuộc tính đã chọn"
                        >
                          <RefreshCw size={13} />
                          <span>Sinh lại ma trận</span>
                        </button>
                      </div>
                    </div>

                    {/* Matrix Table */}
                    <div className="pwm-matrix-table-wrap">
                      <table className="pwm-matrix-table">
                        <thead>
                          <tr>
                            <th className="pwm-matrix-th" style={{ width: '32px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedRowIds.size > 0 && selectedRowIds.size === variants.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRowIds(new Set(variants.map((_, i) => i)));
                                  } else {
                                    setSelectedRowIds(new Set());
                                  }
                                }}
                                style={{ accentColor: '#881337', cursor: 'pointer' }}
                              />
                            </th>
                            <th className="pwm-matrix-th" style={{ width: '34px', textAlign: 'center' }}>STT</th>
                            <th className="pwm-matrix-th" style={{ minWidth: '95px' }}>MÀU SẮC</th>
                            <th className="pwm-matrix-th" style={{ width: '58px' }}>KÍCH CỠ</th>
                            <th className="pwm-matrix-th" style={{ minWidth: '100px' }}>CHẤT LIỆU</th>
                            <th className="pwm-matrix-th" style={{ width: '42px', textAlign: 'center' }}>ẢNH</th>
                            <th className="pwm-matrix-th" style={{ minWidth: '105px' }}>MÃ SKU</th>
                            <th className="pwm-matrix-th" style={{ width: '70px', textAlign: 'center' }}>TỒN KHO</th>
                            <th className="pwm-matrix-th" style={{ width: '85px', textAlign: 'center' }}>HÀNH ĐỘNG</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.length === 0 ? (
                            <tr>
                              <td colSpan={9} style={{ textAlign: 'center', padding: '36px 16px', color: '#9CA3AF' }}>
                                <p style={{ margin: '0 0 6px', fontSize: '13.5px', fontWeight: 650, color: '#4B5563' }}>
                                  Chưa có biến thể nào
                                </p>
                                <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>
                                  Vui lòng chọn Kích cỡ và Màu sắc ở phía trên để tự động tạo danh sách biến thể.
                                </p>
                              </td>
                            </tr>
                          ) : (
                            variants.map((row, idx) => {
                              const isSelected = selectedVariantIdx === idx;
                              const colorObj = ALL_COLORS.find((c) => c.key === row.color) || {
                                key: row.color,
                                label: colorLabels[row.color] || row.color,
                                swatch: colorSwatches[row.color] || '#881337',
                              };
                              const rowSku = generateSku(prodName, row.color, row.size);
                              const rowColorImg = (prodColorImages[row.color] && prodColorImages[row.color][0])
                                ? getImageUrl(prodColorImages[row.color][0])
                                : (prodImages[0] ? getImageUrl(prodImages[0]) : '');

                              return (
                                <tr
                                  key={idx}
                                  onClick={() => {
                                    setSelectedVariantIdx(idx);
                                    setVariantPreviewIdx(0);
                                  }}
                                  className={`pwm-matrix-tr ${isSelected ? 'active' : ''}`}
                                >
                                  <td className="pwm-matrix-td" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={selectedRowIds.has(idx)}
                                      onChange={(e) => {
                                        const next = new Set(selectedRowIds);
                                        if (e.target.checked) next.add(idx);
                                        else next.delete(idx);
                                        setSelectedRowIds(next);
                                      }}
                                      style={{ accentColor: '#881337', cursor: 'pointer' }}
                                    />
                                  </td>
                                  <td className="pwm-matrix-td" style={{ color: '#6B7280', fontWeight: 650, textAlign: 'center' }}>
                                    {idx + 1}
                                  </td>
                                  <td className="pwm-matrix-td" onClick={(e) => e.stopPropagation()}>
                                    <div className="pwm-matrix-select-wrap">
                                      <span
                                        className="pwm-matrix-color-dot"
                                        style={{ backgroundColor: colorObj.swatch }}
                                      />
                                      <select
                                        value={row.color}
                                        onChange={(e) => {
                                          const newColor = e.target.value;
                                          updateVariantRow(idx, 'color', newColor);
                                          if (!prodColors.includes(newColor)) {
                                            setProdColors((prev) => [...prev, newColor]);
                                          }
                                        }}
                                        className="pwm-matrix-select pwm-matrix-select-color"
                                        title="Chọn màu sắc cho biến thể"
                                      >
                                        {ALL_COLORS.map((c) => (
                                          <option key={c.key} value={c.key}>
                                            {c.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </td>
                                  <td className="pwm-matrix-td" onClick={(e) => e.stopPropagation()}>
                                    <select
                                      value={row.size}
                                      onChange={(e) => {
                                        const newSize = e.target.value;
                                        updateVariantRow(idx, 'size', newSize);
                                        if (!prodSizes.includes(newSize)) {
                                          setProdSizes((prev) => [...prev, newSize]);
                                        }
                                      }}
                                      className="pwm-matrix-select pwm-matrix-select-size"
                                      title="Chọn kích cỡ cho biến thể"
                                    >
                                      {ALL_SIZES.map((sz) => (
                                        <option key={sz} value={sz}>
                                          {sz}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="pwm-matrix-td" onClick={(e) => e.stopPropagation()}>
                                    <select
                                      value={row.material || 'SILK'}
                                      onChange={(e) => {
                                        const newMat = e.target.value;
                                        updateVariantRow(idx, 'material', newMat);
                                        if (!prodMaterials.includes(newMat)) {
                                          setProdMaterials((prev) => [...prev, newMat]);
                                        }
                                      }}
                                      className="pwm-matrix-select pwm-matrix-select-mat"
                                      title="Chọn chất liệu cho biến thể"
                                    >
                                      {ALL_MATERIALS.map((m) => (
                                        <option key={m.key} value={m.key}>
                                          {m.label}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="pwm-matrix-td" style={{ textAlign: 'center' }}>
                                    {rowColorImg ? (
                                      <img
                                        src={rowColorImg}
                                        alt={`Ảnh ${row.color} ${row.size}`}
                                        className="pwm-matrix-thumb"
                                      />
                                    ) : (
                                      <div
                                        className="pwm-matrix-thumb"
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: '#FAF8F5',
                                          border: '1px dashed #D1D5DB',
                                          color: '#9CA3AF',
                                        }}
                                      >
                                        <Camera size={13} />
                                      </div>
                                    )}
                                  </td>
                                  <td className="pwm-matrix-td">
                                    <span className="pwm-matrix-sku">{rowSku}</span>
                                  </td>
                                  <td className="pwm-matrix-td" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      min={1}
                                      value={row.quantity}
                                      onChange={(e) => updateVariantRow(idx, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                                      className="pwm-matrix-qty-input"
                                    />
                                  </td>
                                  <td className="pwm-matrix-td" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleTriggerUploadColor(row.color)}
                                        className="pwm-matrix-action-btn"
                                        title={`Thêm ảnh cho màu ${colorObj.label}`}
                                      >
                                        <Camera size={11} />
                                        <span>Ảnh</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRow(idx)}
                                        className="pwm-matrix-delete-btn"
                                        title="Xóa biến thể này"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                            );
                          })
                        )}
                        </tbody>
                      </table>
                    </div>

                    {/* Matrix Bottom Row */}
                    <div className="pwm-matrix-footer">
                      <button
                        type="button"
                        onClick={() => {
                          const defaultSize = prodSizes[0] || 'M';
                          const defaultColor = prodColors[0] || 'RED';
                          const defaultMaterial = prodMaterials[0] || 'SILK';
                          setVariants((prev) => [
                            ...prev,
                            {
                              size: defaultSize,
                              color: defaultColor,
                              material: defaultMaterial,
                              quantity: 1,
                              condition: 'GOOD',
                            },
                          ]);
                          if (!prodSizes.includes(defaultSize)) {
                            setProdSizes((prev) => [...prev, defaultSize]);
                          }
                          if (!prodColors.includes(defaultColor)) {
                            setProdColors((prev) => [...prev, defaultColor]);
                          }
                        }}
                        className="pwm-matrix-add-btn"
                      >
                        <Plus size={15} />
                        <span>Thêm biến thể thủ công</span>
                      </button>

                      <div className="pwm-matrix-total-wrap">
                        <span className="pwm-matrix-total-label">Tổng số lượng tồn kho (tất cả biến thể):</span>
                        <span className="pwm-matrix-total-val">
                          {variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)}
                        </span>
                        <span className="pwm-matrix-total-unit">Sản phẩm</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. RIGHT COLUMN: Live Variant Preview */}
                <div className="pwm-step2-preview-col">
                  <div className="pwm-step2-preview-header">
                    <h4>Xem trước biến thể</h4>
                    <p>Chọn một biến thể để xem trước</p>
                  </div>

                  {variants.length === 0 ? (
                    <div className="pwm-step2-preview-card">
                      <div className="pwm-preview-empty-image" style={{ height: '240px' }}>
                        <ImageIcon size={32} strokeWidth={1.5} color="#9CA3AF" />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>Chưa có biến thể</span>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Chọn kích cỡ và màu sắc để tạo biến thể</span>
                      </div>

                      <h5 className="pwm-step2-preview-prod-title">
                        {prodName.trim() ? (
                          prodName
                        ) : (
                          <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontWeight: 500 }}>
                            Chưa nhập tên sản phẩm
                          </span>
                        )}
                      </h5>

                      <div>
                        <span
                          className="pwm-step2-preview-variant-pill"
                          style={{ color: '#9CA3AF', backgroundColor: '#F3F4F6' }}
                        >
                          Chưa có biến thể
                        </span>
                      </div>

                      <div className="pwm-step2-specs">
                        <div className="pwm-step2-spec-row">
                          <span className="pwm-step2-spec-label">Màu sắc</span>
                          <span className="pwm-step2-spec-val" style={{ color: '#9CA3AF' }}>—</span>
                        </div>
                        <div className="pwm-step2-spec-row">
                          <span className="pwm-step2-spec-label">Kích cỡ</span>
                          <span className="pwm-step2-spec-val" style={{ color: '#9CA3AF' }}>—</span>
                        </div>
                        <div className="pwm-step2-spec-row">
                          <span className="pwm-step2-spec-label">Chất liệu</span>
                          <span className="pwm-step2-spec-val" style={{ color: '#9CA3AF' }}>—</span>
                        </div>
                        <div className="pwm-step2-spec-row">
                          <span className="pwm-step2-spec-label">Mã SKU</span>
                          <span className="pwm-step2-spec-val sku" style={{ color: '#9CA3AF' }}>—</span>
                        </div>
                        <div className="pwm-step2-spec-row">
                          <span className="pwm-step2-spec-label">Số lượng tồn kho</span>
                          <span className="pwm-step2-spec-val" style={{ color: '#9CA3AF' }}>0</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const currentActive = variants[selectedVariantIdx] || variants[0];
                      const activeColorImgs = (prodColorImages[currentActive.color] || []).map((img) => getImageUrl(img));
                      const activeGallery = activeColorImgs.length > 0 ? activeColorImgs : previewGallery;
                      const heroImg = activeGallery[variantPreviewIdx] || activeGallery[0] || '';

                      const curColorObj = ALL_COLORS.find((c) => c.key === currentActive.color) || {
                        key: currentActive.color,
                        label: colorLabels[currentActive.color] || currentActive.color,
                        swatch: colorSwatches[currentActive.color] || '#881337',
                      };

                      const curMaterialObj = ALL_MATERIALS.find((m) => m.key === currentActive.material);
                      const curMaterialLabel = curMaterialObj?.label || materialLabels[currentActive.material] || currentActive.material || 'Lụa tơ tằm';

                      return (
                        <div className="pwm-step2-preview-card">
                          {/* Big Hero Image */}
                          {heroImg ? (
                            <div className="pwm-step2-preview-hero">
                              <img
                                src={heroImg}
                                alt="Xem trước biến thể"
                                className="pwm-step2-preview-hero-img"
                              />

                              {activeGallery.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVariantPreviewIdx((i) => (i > 0 ? i - 1 : activeGallery.length - 1))
                                    }
                                    className="pwm-step2-preview-hero-arrow prev"
                                    title="Ảnh trước"
                                  >
                                    <ChevronLeft size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVariantPreviewIdx((i) => (i < activeGallery.length - 1 ? i + 1 : 0))
                                    }
                                    className="pwm-step2-preview-hero-arrow next"
                                    title="Ảnh sau"
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="pwm-preview-empty-image" style={{ height: '240px' }}>
                              <Camera size={32} strokeWidth={1.5} color="#9CA3AF" />
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>
                                Chưa có ảnh cho màu {curColorObj.label}
                              </span>
                              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Thêm ảnh riêng ở bảng bên trái</span>
                            </div>
                          )}

                          {/* 4 Thumbnails */}
                          {activeGallery.length > 0 && (
                            <div className="pwm-step2-preview-thumbs">
                              {activeGallery.slice(0, 4).map((thumbUrl, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setVariantPreviewIdx(idx)}
                                  className={`pwm-step2-preview-thumb-btn ${variantPreviewIdx === idx ? 'active' : ''}`}
                                >
                                  <img
                                    src={thumbUrl}
                                    alt={`Thumb ${idx + 1}`}
                                    className="pwm-step2-preview-thumb-img"
                                  />
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Title & Badge */}
                          <h5 className="pwm-step2-preview-prod-title">
                            {prodName.trim() ? (
                              prodName
                            ) : (
                              <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontWeight: 500 }}>
                                Chưa nhập tên sản phẩm
                              </span>
                            )}
                          </h5>

                          <div>
                            <span className="pwm-step2-preview-variant-pill">
                              Biến thể: {curColorObj.label} / Size {currentActive.size}
                            </span>
                          </div>

                          {/* Specs Table */}
                          <div className="pwm-step2-specs">
                            <div className="pwm-step2-spec-row">
                              <span className="pwm-step2-spec-label">Màu sắc</span>
                              <span className="pwm-step2-spec-val">
                                <span
                                  style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: curColorObj.swatch,
                                    border: '1px solid rgba(0,0,0,0.15)',
                                    display: 'inline-block',
                                  }}
                                />
                                {curColorObj.label}
                              </span>
                            </div>

                            <div className="pwm-step2-spec-row">
                              <span className="pwm-step2-spec-label">Kích cỡ</span>
                              <span className="pwm-step2-spec-val" style={{ fontWeight: 700 }}>
                                {currentActive.size}
                              </span>
                            </div>

                            <div className="pwm-step2-spec-row">
                              <span className="pwm-step2-spec-label">Chất liệu</span>
                              <span className="pwm-step2-spec-val">{curMaterialLabel}</span>
                            </div>

                            <div className="pwm-step2-spec-row">
                              <span className="pwm-step2-spec-label">Mã SKU</span>
                              <span className="pwm-step2-spec-val sku">
                                {generateSku(prodName, currentActive.color, currentActive.size)}
                              </span>
                            </div>

                            <div className="pwm-step2-spec-row">
                              <span className="pwm-step2-spec-label">Số lượng tồn kho</span>
                              <span className="pwm-step2-spec-val" style={{ fontWeight: 800 }}>
                                {currentActive.quantity}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            )
          )}

          {wizardStep === 3 && (
            <div className="pwm-step3-layout">
              {/* 1. MAIN COLUMN: AI Tagging Controls & Editor */}
              <div className="pwm-step3-center">
                <div className="pwm-step2-heading">
                  <h4>3. Gắn thẻ thông minh bằng AI</h4>
                  <p>Hệ thống phân tích hình ảnh và mô tả để gợi ý thẻ phong cách, dịp lễ phù hợp nhất.</p>
                </div>

                {/* AI Assistant Banner */}
                <div className="pwm-step3-ai-banner">
                  <div className="pwm-step3-ai-icon">
                    <Sparkles size={20} />
                  </div>
                  <div className="pwm-step3-ai-banner-content">
                    <h4>Trợ lý phân tích thẻ thông minh AI</h4>
                    <p>
                      Bấm "Tạo gợi ý" bên dưới để AI tự động nhận diện và gán các thẻ phong cách &amp; sự kiện thích hợp cho thiết kế áo dài của bạn.
                    </p>
                  </div>
                </div>

                {/* Smart Tag Editor Card */}
                <div className="pwm-step3-editor-card">
                  <SmartTagEditor
                    productId={editingProduct?._id ?? createdDraftId ?? undefined}
                    initialDecisionVersion={editingProduct?.taggingDecisionVersion}
                    onActiveTagsChange={setActiveTagCodes}
                  />
                </div>
              </div>

              {/* 2. RIGHT COLUMN: Live Preview */}
              <div className="pwm-preview-col pwm-step3-preview-col">
                <div className="pwm-preview-header">
                  <h4>Xem trước hiển thị</h4>
                  <p>Giao diện khách hàng nhìn thấy</p>
                </div>

                <div className="pwm-preview-card">
                  {/* Hero image carousel */}
                  {currentPreviewImg ? (
                    <div className="pwm-preview-main-img-wrap">
                      <img
                        src={currentPreviewImg}
                        alt="Xem trước áo dài"
                        className="pwm-preview-main-img"
                      />

                      {previewGallery.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewIdx((i) => (i > 0 ? i - 1 : previewGallery.length - 1))
                            }
                            className="pwm-preview-arrow prev"
                            title="Ảnh trước"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewIdx((i) => (i < previewGallery.length - 1 ? i + 1 : 0))
                            }
                            className="pwm-preview-arrow next"
                            title="Ảnh sau"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="pwm-preview-empty-image">
                      <ImageIcon size={36} strokeWidth={1.5} color="#9CA3AF" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>Chưa có hình ảnh</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Tải ảnh lên ở Bước 1 để xem trước</span>
                    </div>
                  )}

                  {/* 4 Thumbnails */}
                  {previewGallery.length > 0 && (
                    <div className="pwm-step2-preview-thumbs">
                      {previewGallery.slice(0, 4).map((thumbUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPreviewIdx(idx)}
                          className={`pwm-step2-preview-thumb-btn ${previewIdx === idx ? 'active' : ''}`}
                        >
                          <img
                            src={thumbUrl}
                            alt={`Thumb ${idx + 1}`}
                            className="pwm-step2-preview-thumb-img"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Title & Category & Pricing */}
                  <div className="pwm-preview-meta">
                    <div className="pwm-preview-title-row">
                      <h4 className="pwm-preview-prod-title">
                        {prodName.trim() ? (
                          prodName
                        ) : (
                          <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontWeight: 500 }}>
                            Chưa nhập tên sản phẩm
                          </span>
                        )}
                      </h4>
                      <span className={`pwm-preview-status-pill ${(prodStatus || 'DRAFT').toLowerCase()}`}>
                        {prodStatus === 'ACTIVE' ? 'Đang bán' : prodStatus === 'DRAFT' ? 'Bản nháp' : 'Tạm ngưng'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: selectedCategoryName ? '#6B7280' : '#9CA3AF', marginTop: '-2px' }}>
                      {selectedCategoryName || 'Chưa chọn danh mục'}
                    </div>

                    <div className="pwm-preview-pricing">
                      {previewBasePrice !== null ? (
                        <>
                          <strong>{previewBasePrice.toLocaleString('vi-VN')}đ</strong> / ngày
                          {previewDeposit !== null && (
                            <> &nbsp;·&nbsp; Cọc: {previewDeposit.toLocaleString('vi-VN')}đ</>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: 500 }}>
                          Chưa nhập giá thuê
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pwm-step2-summary-divider" style={{ margin: '4px 0' }} />

                  {/* AI Tags Section */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12.5px',
                        fontWeight: 750,
                        color: '#374151',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Sparkles size={13} color="#881337" />
                        Thẻ thông minh đã gắn
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: activeTagCodes.length > 0 ? '#881337' : '#9CA3AF',
                          fontWeight: 750,
                        }}
                      >
                        {activeTagCodes.length} thẻ
                      </span>
                    </div>

                    {activeTagCodes.length > 0 ? (
                      <div className="pwm-step3-tag-pills-wrap">
                        {activeTagCodes.map((code) => (
                          <span key={code} className="pwm-ai-tag-pill">
                            <Sparkles size={10} />
                            <span>{SMART_TAG_LABELS[code] || code.replace(/_/g, ' ')}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>
                        Chưa có thẻ nào được gắn. Vui lòng bấm "Tạo gợi ý" hoặc chọn thủ công.
                      </p>
                    )}
                  </div>

                  {/* Inventory Summary */}
                  <div
                    style={{
                      background: '#FAF8F5',
                      border: '1px solid #EBE4D8',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: '#4B5563',
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '4px',
                    }}
                  >
                    <span>Biến thể: <strong>{variants.length} tổ hợp</strong></span>
                    <span>
                      Tổng kho: <strong>{variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)} chiếc</strong>
                    </span>
                  </div>

                  {/* AI Optimization badge */}
                  <div className="pwm-step3-opt-badge">
                    <Check size={14} strokeWidth={3} />
                    <span>Tối ưu hóa tìm kiếm &amp; đề xuất AI</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. MODAL FOOTER */}
        <div className="pwm-footer">
          <button
            type="button"
            onClick={handleWizardCancel}
            className="pwm-btn-cancel"
          >
            Hủy
          </button>

          <div style={{ display: 'flex', gap: '12px' }}>
            {editingProduct ? (
              <>
                {wizardStep > 1 && (
                  <button
                    type="button"
                    onClick={handleWizardBack}
                    className="pwm-btn-back"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ArrowLeft size={15} />
                    <span>Quay lại</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleWizardFinish}
                  className="pwm-btn-next"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sparkles size={15} />
                  <span>Lưu thay đổi</span>
                </button>
              </>
            ) : (
              <>
                {wizardStep > 1 && (
                  <button
                    type="button"
                    onClick={handleWizardBack}
                    className="pwm-btn-back"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ArrowLeft size={15} />
                    <span>Quay lại</span>
                  </button>
                )}

                {wizardStep < 3 && (
                  <button
                    type="button"
                    onClick={handleWizardNext}
                    disabled={savingDraft}
                    className="pwm-btn-next"
                  >
                    <span>{savingDraft ? 'Đang lưu...' : 'Tiếp tục'}</span>
                    <ArrowRight size={15} />
                  </button>
                )}

                {wizardStep === 3 && (
                  <button
                    type="button"
                    onClick={handleWizardFinish}
                    disabled={activeTagCodes.length < 1}
                    className="pwm-btn-next"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Sparkles size={15} />
                    <span>Đăng áo dài</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
