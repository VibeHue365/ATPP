import React, { useEffect } from 'react';
import {
  X,
  Shirt,
  Camera,
  Check,
  Search,
  CalendarDays,
  Sparkles,
  Tag,
  Flame,
  Zap,
  Users,
  Package,
  Eye,
  Receipt,
  CreditCard,
  Gift,
  TrendingDown,
  Link2,
  Combine,
  SlidersHorizontal,
  Coins,
  Percent,
  BadgePercent,
} from 'lucide-react';
import { Modal } from '../../../../components/common/Modal';
import { getImageUrl } from '../../shared/mediaHelpers';

interface ComboModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingComboId: string | null;
  cName: string;
  setCName: (val: string) => void;
  cDesc: string;
  setCDesc: (val: string) => void;
  cProductId: string;
  setCProductId: (val: string) => void;
  cPackageId: string;
  setCPackageId: (val: string) => void;
  cDiscount: number | '';
  setCDiscount: (val: number | '') => void;
  cPrice: string;
  setCPrice: (val: string) => void;
  cValidFrom: string;
  setCValidFrom: (val: string) => void;
  cValidTo: string;
  setCValidTo: (val: string) => void;
  cMaxUsage: number | '';
  setCMaxUsage: (val: number | '') => void;
  cShootPeopleCount: number | '';
  setCShootPeopleCount: (val: number | '') => void;
  cAoDaiQuantity: number | '';
  setCAoDaiQuantity: (val: number | '') => void;
  myProductsList: any[];
  photoPackages: any[];
  combos?: any[];
  inventorySummary: any;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  // Sub-modal pickers
  isAoDaiModalOpen: boolean;
  setIsAoDaiModalOpen: (open: boolean) => void;
  aoDaiSearch: string;
  setAoDaiSearch: (val: string) => void;
  isPackageModalOpen: boolean;
  setIsPackageModalOpen: (open: boolean) => void;
  packageSearch: string;
  setPackageSearch: (val: string) => void;
}

export const ComboModal: React.FC<ComboModalProps> = ({
  isOpen,
  onClose,
  editingComboId,
  cName,
  setCName,
  cDesc,
  setCDesc,
  cProductId,
  setCProductId,
  cPackageId,
  setCPackageId,
  cDiscount,
  setCDiscount,
  cPrice,
  setCPrice,
  cValidFrom,
  setCValidFrom,
  cValidTo,
  setCValidTo,
  cMaxUsage,
  setCMaxUsage,
  cShootPeopleCount,
  setCShootPeopleCount,
  cAoDaiQuantity,
  setCAoDaiQuantity,
  myProductsList,
  photoPackages,
  combos = [],
  inventorySummary,
  onSubmit,
  isAoDaiModalOpen,
  setIsAoDaiModalOpen,
  aoDaiSearch,
  setAoDaiSearch,
  isPackageModalOpen,
  setIsPackageModalOpen,
  packageSearch,
  setPackageSearch,
}) => {
  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Fallback to populated data on combo when editing
  const currentEditingCombo = combos.find(
    (c: any) => String(c._id || c.id) === String(editingComboId)
  );

  const selectedProduct =
    myProductsList.find(
      (p: any) => String(p._id || p.id) === String(cProductId)
    ) ||
    (currentEditingCombo?.productId &&
    (String(currentEditingCombo.productId._id || currentEditingCombo.productId.id) === String(cProductId) || !cProductId)
      ? currentEditingCombo.productId
      : null);

  const selectedPackage =
    photoPackages.find(
      (pkg: any) => String(pkg._id || pkg.id) === String(cPackageId)
    ) ||
    (currentEditingCombo?.photographyPackageId &&
    (String(currentEditingCombo.photographyPackageId._id || currentEditingCombo.photographyPackageId.id) === String(cPackageId) || !cPackageId)
      ? currentEditingCombo.photographyPackageId
      : null);

  const selectedProductStock =
    (inventorySummary?.products || []).find(
      (item: any) => item.productId === (selectedProduct?._id || selectedProduct?.id || cProductId)
    )?.availableStock ?? null;

  const selectedPackageMaxPeople = selectedPackage?.maxPeople ?? null;

  // Dynamic Price Calculation & 2-Way Sync
  const aoDaiBasePrice = selectedProduct?.basePrice || 0;
  const pkgBasePrice = selectedPackage?.price || 0;
  const totalOriginalPrice = aoDaiBasePrice + pkgBasePrice;

  const calculatedComboPrice =
    cPrice !== '' && cPrice !== undefined
      ? Number(cPrice)
      : totalOriginalPrice > 0
      ? Math.round(totalOriginalPrice * (1 - (Number(cDiscount) || 0) / 100))
      : 0;

  const customerSavings = Math.max(0, totalOriginalPrice - calculatedComboPrice);
  const effectiveDiscountPercent =
    totalOriginalPrice > 0
      ? Math.round((customerSavings / totalOriginalPrice) * 100)
      : Number(cDiscount) || 0;

  const QUICK_DISCOUNTS = [10, 15, 20, 25, 30, 40, 50];

  const handleDiscountChange = (val: number | '') => {
    setCDiscount(val);
    if (val === '' || totalOriginalPrice <= 0) {
      setCPrice('');
      return;
    }
    const num = Math.max(1, Math.min(80, Number(val)));
    const newPrice = Math.round(totalOriginalPrice * (1 - num / 100));
    setCPrice(String(newPrice));
  };

  const handlePriceChange = (val: string) => {
    setCPrice(val);
    if (!val || totalOriginalPrice <= 0) {
      return;
    }
    const numPrice = Number(val);
    if (numPrice <= 0) {
      setCDiscount(80);
      return;
    }
    if (numPrice >= totalOriginalPrice) {
      setCDiscount(1);
      return;
    }
    const savings = totalOriginalPrice - numPrice;
    const computedPercent = Math.max(
      1,
      Math.min(80, Math.round((savings / totalOriginalPrice) * 100))
    );
    setCDiscount(computedPercent);
  };

  const handleQuickDuration = (days: number) => {
    const fromDate = cValidFrom ? new Date(cValidFrom) : new Date();
    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + days);
    setCValidTo(toDate.toISOString().split('T')[0]);
    if (!cValidFrom) {
      setCValidFrom(fromDate.toISOString().split('T')[0]);
    }
  };

  const handleEndOfYear = () => {
    const now = new Date();
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    setCValidTo(endOfYear.toISOString().split('T')[0]);
    if (!cValidFrom) {
      setCValidFrom(now.toISOString().split('T')[0]);
    }
  };

  const filteredAoDaiList = myProductsList.filter((prod: any) => {
    if (!aoDaiSearch.trim()) return true;
    const q = aoDaiSearch.toLowerCase();
    return (
      (prod.name || '').toLowerCase().includes(q) ||
      (prod.category || '').toLowerCase().includes(q)
    );
  });

  const filteredPackageList = photoPackages.filter((pkg: any) => {
    if (!packageSearch.trim()) return true;
    const q = packageSearch.toLowerCase();
    return (
      (pkg.name || '').toLowerCase().includes(q) ||
      (pkg.description || '').toLowerCase().includes(q)
    );
  });

  const prodImg = selectedProduct?.images?.[0]
    ? getImageUrl(selectedProduct.images[0])
    : '';
  const pkgImg = selectedPackage?.images?.[0]
    ? getImageUrl(selectedPackage.images[0])
    : '';

  return (
    <>
      {/* 1. Backdrop Overlay */}
      <div className="cb-modal-backdrop" onClick={onClose}>
        {/* 2. Wide Modal (920px, 2 Columns) */}
        <div className="cb-modal-container" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="cb-modal-header">
            <div className="cb-modal-title-group">
              <div className="cb-modal-icon-box" style={{ background: 'linear-gradient(135deg, #881337 0%, #BE123C 100%)', color: '#FFFFFF', boxShadow: '0 4px 14px rgba(136, 19, 55, 0.28)' }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h3 className="cb-modal-title">
                  {editingComboId ? 'Chỉnh sửa combo trọn gói' : 'Tạo combo trọn gói mới'}
                </h3>
                <p className="cb-modal-subtitle">
                  Kết hợp Áo Dài và Gói Chụp Ảnh để tạo trải nghiệm trọn vẹn và hấp dẫn cho khách hàng
                </p>
              </div>
            </div>
            <button
              type="button"
              className="cb-modal-close-btn"
              onClick={onClose}
              title="Đóng (ESC)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form Body: 2 Wide Columns */}
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div className="cb-modal-body">
              {/* ==================== CỘT TRÁI (FORM NHẬP LIỆU) ==================== */}
              <div className="cb-modal-col-left">
                {/* Section 1: Thông tin cơ bản */}
                <div className="cb-form-section">
                  <h4 className="cb-section-title">
                    <span className="cb-sec-icon-pill" style={{ background: '#FFF1F2', color: '#BE123C' }}>
                      <Sparkles size={14} />
                    </span>
                    1. Thông tin cơ bản
                  </h4>

                  <div className="cb-field-group">
                    <div className="cb-field-label-row">
                      <label className="cb-field-label">
                        Tên combo <span style={{ color: '#E11D48' }}>*</span>
                      </label>
                      <span className="cb-char-count">{cName.length}/100</span>
                    </div>
                    <input
                      type="text"
                      className="cb-input-text"
                      placeholder="Ví dụ: Combo Hoàng Cung - Dấu ấn cố đô"
                      maxLength={100}
                      required
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                    />
                  </div>

                  <div className="cb-field-group">
                    <div className="cb-field-label-row">
                      <label className="cb-field-label">
                        Mô tả ngắn <span style={{ color: '#E11D48' }}>*</span>
                      </label>
                      <span className="cb-char-count">{cDesc.length}/300</span>
                    </div>
                    <textarea
                      className="cb-textarea"
                      placeholder="Mô tả quyền lợi, điểm nổi bật và concept của combo..."
                      maxLength={300}
                      required
                      value={cDesc}
                      onChange={(e) => setCDesc(e.target.value)}
                    />
                  </div>
                </div>

                {/* Section 2: Chọn sản phẩm & dịch vụ */}
                <div className="cb-form-section">
                  <h4 className="cb-section-title">
                    <span className="cb-sec-icon-pill" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                      <Combine size={14} />
                    </span>
                    2. Sản phẩm & Dịch vụ ghép cặp
                  </h4>

                  {/* Áo dài áp dụng */}
                  <div className="cb-field-group">
                    <label className="cb-field-label">
                      <Shirt size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: '#BE123C' }} />
                      Áo dài áp dụng <span style={{ color: '#E11D48' }}>*</span>
                    </label>

                    <div className="cb-picker-card">
                      <div className="cb-picker-left">
                        <div className="cb-picker-thumb">
                          {prodImg ? (
                            <img src={prodImg} alt={selectedProduct?.name} />
                          ) : (
                            <Shirt size={22} color="var(--cb-text-muted)" />
                          )}
                        </div>
                        <div className="cb-picker-info">
                          <span className="cb-picker-name" title={selectedProduct?.name}>
                            {selectedProduct ? selectedProduct.name : 'Chưa chọn mẫu áo dài'}
                          </span>
                          <div className="cb-picker-sub">
                            {selectedProduct ? (
                              <>
                                <span>
                                  Giá thuê:{' '}
                                  <strong className="cb-picker-price">
                                    {selectedProduct.basePrice?.toLocaleString('vi-VN')}đ
                                  </strong>
                                </span>
                                {selectedProductStock !== null && (
                                  <span className="cb-picker-stock-tag">
                                    Tồn kho: {selectedProductStock}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span>Chọn một mẫu áo dài từ kho của bạn</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="cb-btn-picker-action"
                        onClick={() => setIsAoDaiModalOpen(true)}
                      >
                        {selectedProduct ? 'Thay đổi' : '+ Chọn áo'}
                      </button>
                    </div>
                  </div>

                  {/* Connector Badge */}
                  <div className="cb-pair-connector">
                    <span className="cb-pair-connector-line" />
                    <span className="cb-pair-connector-badge">
                      <Link2 size={12} color="var(--cb-primary)" />
                      <span>Ghép đôi trọn gói</span>
                    </span>
                    <span className="cb-pair-connector-line" />
                  </div>

                  {/* Gói chụp ảnh */}
                  <div className="cb-field-group">
                    <label className="cb-field-label">
                      <Camera size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: '#2563EB' }} />
                      Gói chụp ảnh <span style={{ color: '#E11D48' }}>*</span>
                    </label>

                    <div className="cb-picker-card">
                      <div className="cb-picker-left">
                        <div className="cb-picker-thumb">
                          {pkgImg ? (
                            <img src={pkgImg} alt={selectedPackage?.name} />
                          ) : (
                            <Camera size={22} color="var(--cb-text-muted)" />
                          )}
                        </div>
                        <div className="cb-picker-info">
                          <span className="cb-picker-name" title={selectedPackage?.name}>
                            {selectedPackage ? selectedPackage.name : 'Chưa chọn gói chụp ảnh'}
                          </span>
                          <div className="cb-picker-sub">
                            {selectedPackage ? (
                              <>
                                <span>
                                  Giá chụp:{' '}
                                  <strong className="cb-picker-price">
                                    {selectedPackage.price?.toLocaleString('vi-VN')}đ
                                  </strong>
                                </span>
                                {selectedPackage.durationHours && (
                                  <span style={{ background: '#F3ECE1', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                    {selectedPackage.durationHours}h
                                  </span>
                                )}
                                {selectedPackage.maxPeople && (
                                  <span style={{ color: 'var(--cb-text-muted)' }}>
                                    • Tối đa {selectedPackage.maxPeople} người
                                  </span>
                                )}
                              </>
                            ) : (
                              <span>Chọn một gói chụp ảnh từ danh sách</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="cb-btn-picker-action"
                        onClick={() => setIsPackageModalOpen(true)}
                      >
                        {selectedPackage ? 'Thay đổi' : '+ Chọn gói'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 3: Giá và ưu đãi chiết khấu */}
                <div className="cb-form-section">
                  <h4 className="cb-section-title">
                    <span className="cb-sec-icon-pill" style={{ background: '#FEF3C7', color: '#D97706' }}>
                      <BadgePercent size={14} />
                    </span>
                    3. Giá và ưu đãi chiết khấu
                  </h4>

                  <div className="cb-grid-2cols">
                    <div className="cb-field-group">
                      <label className="cb-field-label">
                        <Percent size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#D97706' }} />
                        Chiết khấu (%) <span style={{ color: '#E11D48' }}>*</span>
                      </label>
                      <div className="cb-input-with-suffix">
                        <input
                          type="number"
                          min="1"
                          max="80"
                          className="cb-input-text"
                          placeholder="VD: 15"
                          required
                          value={cDiscount}
                          onChange={(e) =>
                            handleDiscountChange(e.target.value === '' ? '' : Number(e.target.value))
                          }
                        />
                        <span className="cb-input-suffix">%</span>
                      </div>
                      <div className="cb-quick-chips">
                        {QUICK_DISCOUNTS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            className={`cb-chip-btn ${cDiscount === d ? 'active' : ''}`}
                            onClick={() => handleDiscountChange(d)}
                          >
                            {d >= 30 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                <Flame size={11} color="#EF4444" /> {d}%
                              </span>
                            ) : (
                              `${d}%`
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="cb-field-group">
                      <label className="cb-field-label">
                        <Coins size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--cb-primary)' }} />
                        Giá combo khách trả
                      </label>
                      <div className="cb-input-with-suffix">
                        <input
                          type="number"
                          min="0"
                          className="cb-input-text"
                          placeholder="Tự động tính theo %"
                          value={cPrice}
                          onChange={(e) => handlePriceChange(e.target.value)}
                        />
                        <span className="cb-input-suffix">đ</span>
                      </div>
                      <span className="cb-field-hint">Tự động đồng bộ với % chiết khấu</span>
                    </div>
                  </div>
                </div>

                {/* Section 4: Thời gian áp dụng */}
                <div className="cb-form-section">
                  <h4 className="cb-section-title">
                    <span className="cb-sec-icon-pill" style={{ background: '#ECFDF5', color: '#059669' }}>
                      <CalendarDays size={14} />
                    </span>
                    4. Thời gian áp dụng
                  </h4>

                  <div className="cb-grid-2cols">
                    <div className="cb-field-group">
                      <label className="cb-field-label">
                        Ngày bắt đầu <span style={{ color: '#E11D48' }}>*</span>
                      </label>
                      <input
                        type="date"
                        className="cb-input-text"
                        required
                        value={cValidFrom}
                        onChange={(e) => setCValidFrom(e.target.value)}
                      />
                    </div>

                    <div className="cb-field-group">
                      <label className="cb-field-label">
                        Ngày kết thúc <span style={{ color: '#E11D48' }}>*</span>
                      </label>
                      <input
                        type="date"
                        className="cb-input-text"
                        required
                        value={cValidTo}
                        onChange={(e) => setCValidTo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="cb-quick-chips" style={{ marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--cb-text-muted)', alignSelf: 'center', marginRight: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Zap size={11} color="#F59E0B" /> Chọn nhanh:
                    </span>
                    <button type="button" className="cb-chip-btn" onClick={() => handleQuickDuration(30)}>
                      +30 ngày
                    </button>
                    <button type="button" className="cb-chip-btn" onClick={() => handleQuickDuration(60)}>
                      +60 ngày
                    </button>
                    <button type="button" className="cb-chip-btn" onClick={() => handleQuickDuration(90)}>
                      +90 ngày
                    </button>
                    <button type="button" className="cb-chip-btn" onClick={handleEndOfYear}>
                      Hết năm {new Date().getFullYear()}
                    </button>
                  </div>
                </div>

                {/* Section 5: Giới hạn số lượng */}
                <div className="cb-form-section">
                  <h4 className="cb-section-title">
                    <span className="cb-sec-icon-pill" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                      <SlidersHorizontal size={14} />
                    </span>
                    5. Giới hạn số lượng & sức chứa
                  </h4>

                  <div className="cb-grid-3cols">
                    <div className="cb-field-group">
                      <label className="cb-field-label">
                        <Package size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#7C3AED' }} />
                        Số lượng (Stock) <span style={{ color: '#E11D48' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="cb-input-text"
                        placeholder="Số lượng"
                        required
                        value={cMaxUsage}
                        onChange={(e) =>
                          setCMaxUsage(e.target.value === '' ? '' : Number(e.target.value))
                        }
                      />
                      <span className="cb-field-hint">Tối thiểu 1</span>
                    </div>

                    <div className="cb-field-group">
                      <label className="cb-field-label">
                        <Users size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#2563EB' }} />
                        Số người tối đa <span style={{ color: '#E11D48' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="cb-input-text"
                        placeholder="Số người"
                        required
                        value={cShootPeopleCount}
                        onChange={(e) =>
                          setCShootPeopleCount(e.target.value === '' ? '' : Number(e.target.value))
                        }
                      />
                      <span className="cb-field-hint">
                        {selectedPackageMaxPeople !== null
                          ? `Max: ${selectedPackageMaxPeople}`
                          : 'Theo gói'}
                      </span>
                    </div>

                    <div className="cb-field-group">
                      <label className="cb-field-label">
                        <Shirt size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#BE123C' }} />
                        Số áo thuê <span style={{ color: '#E11D48' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="cb-input-text"
                        placeholder="Số áo"
                        required
                        value={cAoDaiQuantity}
                        onChange={(e) =>
                          setCAoDaiQuantity(e.target.value === '' ? '' : Number(e.target.value))
                        }
                      />
                      <span className="cb-field-hint">
                        {selectedProductStock !== null
                          ? `Tồn: ${selectedProductStock}`
                          : 'Theo kho'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ==================== CỘT PHẢI (STICKY PREVIEW & GIÁ TIỀN) ==================== */}
              <div className="cb-modal-col-right">
                {/* 1. Live Preview Card */}
                <div className="cb-live-preview-wrapper">
                  <div className="cb-live-preview-header">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Eye size={13} color="var(--cb-primary)" />
                      XEM TRƯỚC GIAO DIỆN (LIVE PREVIEW)
                    </span>
                    <span style={{ color: 'var(--cb-primary)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Sparkles size={12} />
                      COMBO
                    </span>
                  </div>

                  {/* Dual Split Images Hero */}
                  <div className="cb-live-preview-hero">
                    {prodImg ? (
                      <img src={prodImg} alt="Áo dài" className="cb-live-preview-img-half" />
                    ) : (
                      <div className="cb-live-preview-hero-fallback">
                        <Shirt size={22} color="var(--cb-text-muted)" />
                        <span>Chưa chọn áo</span>
                      </div>
                    )}

                    {pkgImg ? (
                      <img src={pkgImg} alt="Gói chụp" className="cb-live-preview-img-half" />
                    ) : (
                      <div className="cb-live-preview-hero-fallback">
                        <Camera size={22} color="var(--cb-text-muted)" />
                        <span>Chưa chọn gói</span>
                      </div>
                    )}

                    {effectiveDiscountPercent > 0 && (
                      <div className="cb-live-preview-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Flame size={12} fill="#FFF" color="#FFF" />
                        GIẢM {effectiveDiscountPercent}%
                      </div>
                    )}
                  </div>

                  {/* Preview Content */}
                  <div className="cb-live-preview-content">
                    <h5 className="cb-live-preview-title">
                      {cName.trim() || 'Tên combo trọn gói mẫu'}
                    </h5>

                    <div className="cb-live-preview-items">
                      <div className="cb-preview-item-row">
                        <span className="cb-preview-tag-icon cb-tag-shirt"><Shirt size={12} /></span>
                        <span><strong>Áo dài:</strong> {selectedProduct ? selectedProduct.name : 'Chưa chọn áo dài'}</span>
                      </div>
                      <div className="cb-preview-item-row">
                        <span className="cb-preview-tag-icon cb-tag-camera"><Camera size={12} /></span>
                        <span><strong>Gói chụp:</strong> {selectedPackage ? selectedPackage.name : 'Chưa chọn gói chụp'}</span>
                      </div>
                      {(cValidFrom || cValidTo) && (
                        <div className="cb-preview-item-row">
                          <span className="cb-preview-tag-icon cb-tag-cal"><CalendarDays size={12} /></span>
                          <span style={{ fontSize: 11, color: 'var(--cb-text-light)' }}>
                            Áp dụng: {cValidFrom || '...'} → {cValidTo || '...'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="cb-live-preview-pricing">
                      <div className="cb-live-preview-price-left">
                        <span className="cb-live-preview-current-price">
                          {calculatedComboPrice > 0 ? `${calculatedComboPrice.toLocaleString('vi-VN')}đ` : '0đ'}
                        </span>
                        {totalOriginalPrice > 0 && calculatedComboPrice < totalOriginalPrice && (
                          <span className="cb-live-preview-old-price">
                            {totalOriginalPrice.toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                      {cMaxUsage && (
                        <span style={{ fontSize: 11, color: 'var(--cb-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Package size={11} color="var(--cb-text-muted)" />
                          Còn: <strong>{cMaxUsage}</strong> suất
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Bảng tính toán giá chi tiết & Tiết kiệm */}
                <div className="cb-price-summary-box">
                  <div className="cb-price-summary-header">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Receipt size={13} color="var(--cb-primary)" />
                      BẢNG TÍNH TOÁN GIÁ DỰ KIẾN
                    </span>
                    <span style={{ color: 'var(--cb-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Zap size={11} />
                      TỰ ĐỘNG
                    </span>
                  </div>

                  <div className="cb-price-summary-row">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Tag size={12} color="var(--cb-text-muted)" />
                      Giá Áo Dài + Gói Chụp:
                    </span>
                    <span>
                      {aoDaiBasePrice > 0 || pkgBasePrice > 0
                        ? `${aoDaiBasePrice.toLocaleString('vi-VN')}đ + ${pkgBasePrice.toLocaleString('vi-VN')}đ`
                        : '—'}
                    </span>
                  </div>

                  <div className="cb-price-summary-row" style={{ color: 'var(--cb-text-muted)' }}>
                    <span>Tổng giá gốc niêm yết:</span>
                    <span style={{ textDecoration: 'line-through' }}>
                      {totalOriginalPrice > 0 ? `${totalOriginalPrice.toLocaleString('vi-VN')}đ` : '—'}
                    </span>
                  </div>

                  <div className="cb-price-summary-row highlight">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CreditCard size={15} color="var(--cb-primary)" />
                      Khách Thanh Toán:
                    </span>
                    <span style={{ color: 'var(--cb-primary)', fontSize: 18 }}>
                      {calculatedComboPrice > 0
                        ? `${calculatedComboPrice.toLocaleString('vi-VN')}đ`
                        : '0đ'}
                    </span>
                  </div>

                  {/* Box tiết kiệm cho khách hàng */}
                  {customerSavings > 0 ? (
                    <div className="cb-savings-card-highlight">
                      <span className="cb-savings-card-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Gift size={15} color="#059669" />
                        Tiết kiệm cho khách:
                      </span>
                      <span className="cb-savings-card-val">
                        +{customerSavings.toLocaleString('vi-VN')}đ
                        <span className="cb-savings-card-pill">
                          <TrendingDown size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                          -{effectiveDiscountPercent}%
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--cb-text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
                      {totalOriginalPrice > 0 ? 'Giá combo bằng giá gốc' : 'Vui lòng chọn Áo dài & Gói chụp để tính giá'}
                    </div>
                  )}

                  <div className="cb-info-box" style={{ marginTop: 2 }}>
                    <Sparkles size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      Hệ thống tự động đồng bộ giữa <code>% Chiết khấu</code> và <code>Giá combo</code>. Bạn có thể nhập 1 trong 2 ô, ô còn lại sẽ tự động tính toán.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="cb-modal-footer">
              <button type="button" className="cb-btn-cancel" onClick={onClose}>
                Hủy bỏ
              </button>
              <button type="submit" className="cb-btn-submit">
                <Check size={18} />
                <span>{editingComboId ? 'Lưu thay đổi combo' : 'Tạo combo ngay'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ==================== SUB-MODAL 1: CHỌN ÁO DÀI ==================== */}
      <Modal
        isOpen={isAoDaiModalOpen}
        onClose={() => setIsAoDaiModalOpen(false)}
        title="Chọn Áo Dài Ghép Combo"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="cb-search-wrap" style={{ width: '100%' }}>
            <Search className="cb-search-icon" size={16} />
            <input
              type="text"
              className="cb-search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="Tìm kiếm mẫu áo dài theo tên, phân loại..."
              value={aoDaiSearch}
              onChange={(e) => setAoDaiSearch(e.target.value)}
            />
          </div>

          <div
            style={{
              maxHeight: '380px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {filteredAoDaiList.length === 0 ? (
              <p
                style={{
                  textAlign: 'center',
                  color: 'var(--cb-text-muted)',
                  padding: 24,
                }}
              >
                Không tìm thấy mẫu áo dài nào phù hợp.
              </p>
            ) : (
              filteredAoDaiList.map((prod: any) => {
                const prodId = prod._id || prod.id;
                const isSelected = String(cProductId) === String(prodId);
                const img = prod.images?.[0] ? getImageUrl(prod.images[0]) : '';
                const stock =
                  (inventorySummary?.products || []).find(
                    (item: any) => item.productId === prodId
                  )?.availableStock ?? null;

                return (
                  <div
                    key={prodId}
                    onClick={() => {
                      setCProductId(prodId);
                      setIsAoDaiModalOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? 'var(--cb-primary)' : 'var(--cb-border)'}`,
                      background: isSelected ? 'var(--cb-primary-light)' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 6,
                          overflow: 'hidden',
                          background: '#F3ECE1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt={prod.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Shirt size={20} color="var(--cb-text-muted)" />
                        )}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: 'var(--cb-text-dark)',
                          }}
                        >
                          {prod.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--cb-text-muted)', marginTop: 2 }}>
                          Giá thuê:{' '}
                          <strong style={{ color: 'var(--cb-primary)' }}>
                            {prod.basePrice?.toLocaleString('vi-VN')}đ
                          </strong>
                          {stock !== null && ` • Tồn kho khả dụng: ${stock}`}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cb-btn-picker-action"
                      style={{
                        background: isSelected ? 'var(--cb-primary)' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : 'var(--cb-primary)',
                      }}
                    >
                      {isSelected ? 'Đang chọn' : 'Chọn áo'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* ==================== SUB-MODAL 2: CHỌN GÓI CHỤP ==================== */}
      <Modal
        isOpen={isPackageModalOpen}
        onClose={() => setIsPackageModalOpen(false)}
        title="Chọn Gói Chụp Ảnh Ghép Combo"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="cb-search-wrap" style={{ width: '100%' }}>
            <Search className="cb-search-icon" size={16} />
            <input
              type="text"
              className="cb-search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="Tìm kiếm gói chụp theo tên gói, concept..."
              value={packageSearch}
              onChange={(e) => setPackageSearch(e.target.value)}
            />
          </div>

          <div
            style={{
              maxHeight: '380px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {filteredPackageList.length === 0 ? (
              <p
                style={{
                  textAlign: 'center',
                  color: 'var(--cb-text-muted)',
                  padding: 24,
                }}
              >
                Không tìm thấy gói chụp nào phù hợp.
              </p>
            ) : (
              filteredPackageList.map((pkg: any) => {
                const pkgId = pkg._id || pkg.id;
                const isSelected = String(cPackageId) === String(pkgId);
                const img = pkg.images?.[0] ? getImageUrl(pkg.images[0]) : '';

                return (
                  <div
                    key={pkgId}
                    onClick={() => {
                      setCPackageId(pkgId);
                      setIsPackageModalOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? 'var(--cb-primary)' : 'var(--cb-border)'}`,
                      background: isSelected ? 'var(--cb-primary-light)' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 6,
                          overflow: 'hidden',
                          background: '#F3ECE1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt={pkg.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Camera size={20} color="var(--cb-text-muted)" />
                        )}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: 'var(--cb-text-dark)',
                          }}
                        >
                          {pkg.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--cb-text-muted)', marginTop: 2 }}>
                          Giá gói:{' '}
                          <strong style={{ color: 'var(--cb-primary)' }}>
                            {pkg.price?.toLocaleString('vi-VN')}đ
                          </strong>
                          {pkg.durationHours && ` • Thời lượng: ${pkg.durationHours}h`}
                          {pkg.maxPeople && ` • Tối đa: ${pkg.maxPeople} người`}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cb-btn-picker-action"
                      style={{
                        background: isSelected ? 'var(--cb-primary)' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : 'var(--cb-primary)',
                      }}
                    >
                      {isSelected ? 'Đang chọn' : 'Chọn gói'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};
