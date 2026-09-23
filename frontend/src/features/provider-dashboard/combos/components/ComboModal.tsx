import React, { useEffect } from 'react';
import {
  X,
  Scissors,
  Camera,
  Layers,
  Info,
  Check,
  Search,
  Calculator,
  Calendar,
  Sparkles,
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

  // Dynamic Price Calculation
  const aoDaiBasePrice = selectedProduct?.basePrice || 0;
  const pkgBasePrice = selectedPackage?.price || 0;
  const totalOriginalPrice = aoDaiBasePrice + pkgBasePrice;
  const effectiveDiscountPercent = Number(cDiscount) || 0;

  const calculatedComboPrice = cPrice
    ? Number(cPrice)
    : Math.round(totalOriginalPrice * (1 - effectiveDiscountPercent / 100));

  const customerSavings = Math.max(0, totalOriginalPrice - calculatedComboPrice);

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
              <div className="cb-modal-icon-box">
                <Layers size={22} />
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
              {/* ==================== CỘT TRÁI ==================== */}
              <div className="cb-modal-col">
                {/* Section 1: Thông tin cơ bản */}
                <div className="cb-form-section">
                  <h4 className="cb-section-title">
                    <Sparkles size={14} color="var(--cb-primary)" />
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
                    <Layers size={14} color="var(--cb-primary)" />
                    2. Sản phẩm & Dịch vụ ghép cặp
                  </h4>

                  {/* Áo dài áp dụng */}
                  <div className="cb-field-group">
                    <label className="cb-field-label">
                      Áo dài áp dụng <span style={{ color: '#E11D48' }}>*</span>
                    </label>

                    <div className="cb-picker-card">
                      <div className="cb-picker-left">
                        <div className="cb-picker-thumb">
                          {prodImg ? (
                            <img src={prodImg} alt={selectedProduct?.name} />
                          ) : (
                            <Scissors size={24} />
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

                  {/* Gói chụp ảnh */}
                  <div className="cb-field-group">
                    <label className="cb-field-label">
                      Gói chụp ảnh <span style={{ color: '#E11D48' }}>*</span>
                    </label>

                    <div className="cb-picker-card">
                      <div className="cb-picker-left">
                        <div className="cb-picker-thumb">
                          {pkgImg ? (
                            <img src={pkgImg} alt={selectedPackage?.name} />
                          ) : (
                            <Camera size={24} />
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
              </div>

              {/* ==================== CỘT PHẢI ==================== */}
              <div className="cb-modal-col">
                {/* Section 3: Giá và ưu đãi */}
                <div className="cb-form-section">
                  <h4 className="cb-section-title">
                    <Calculator size={14} color="var(--cb-primary)" />
                    3. Giá và ưu đãi chiết khấu
                  </h4>

                  <div className="cb-grid-2cols">
                    <div className="cb-field-group">
                      <label className="cb-field-label">
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
                            setCDiscount(e.target.value === '' ? '' : Number(e.target.value))
                          }
                        />
                        <span className="cb-input-suffix">%</span>
                      </div>
                      <span className="cb-field-hint">Từ 1% - 80%</span>
                    </div>

                    <div className="cb-field-group">
                      <label className="cb-field-label">Giá combo tự định nghĩa</label>
                      <div className="cb-input-with-suffix">
                        <input
                          type="number"
                          min="0"
                          className="cb-input-text"
                          placeholder="Để trống nếu tính theo %"
                          value={cPrice}
                          onChange={(e) => setCPrice(e.target.value)}
                        />
                        <span className="cb-input-suffix">đ</span>
                      </div>
                      <span className="cb-field-hint">Giá cố định tùy chọn</span>
                    </div>
                  </div>

                  {/* Bảng tính giá động */}
                  <div className="cb-price-summary-box">
                    <div className="cb-price-summary-header">
                      <span>BẢNG TÍNH TOÁN GIÁ DỰ KIẾN</span>
                      <span>TỰ ĐỘNG CẬP NHẬT</span>
                    </div>

                    <div className="cb-price-summary-row">
                      <span>Giá Áo Dài + Gói Chụp:</span>
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
                      <span>Giá Combo Khách Thanh Toán:</span>
                      <span>
                        {calculatedComboPrice > 0
                          ? `${calculatedComboPrice.toLocaleString('vi-VN')}đ`
                          : '0đ'}
                      </span>
                    </div>

                    {customerSavings > 0 && (
                      <div className="cb-price-summary-row" style={{ color: '#BE123C', fontWeight: 600 }}>
                        <span>Tiết kiệm cho khách hàng:</span>
                        <span>-{customerSavings.toLocaleString('vi-VN')}đ ({effectiveDiscountPercent}%)</span>
                      </div>
                    )}
                  </div>

                  <div className="cb-info-box">
                    <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      Hệ thống tự động tính: <code>(Giá Áo + Giá Gói Chụp) × (1 - % Giảm)</code> nếu bạn không nhập giá ghi đè.
                    </div>
                  </div>
                </div>

                {/* Section 4: Thời gian áp dụng */}
                <div className="cb-form-section">
                  <h4 className="cb-section-title">
                    <Calendar size={14} color="var(--cb-primary)" />
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
                </div>

                {/* Section 5: Giới hạn số lượng */}
                <div className="cb-form-section">
                  <h4 className="cb-section-title">
                    <Layers size={14} color="var(--cb-primary)" />
                    5. Giới hạn số lượng & sức chứa
                  </h4>

                  <div className="cb-grid-3cols">
                    <div className="cb-field-group">
                      <label className="cb-field-label">
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
                          <Scissors size={20} color="var(--cb-text-muted)" />
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
