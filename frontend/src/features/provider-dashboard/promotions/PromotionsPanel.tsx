import {
  Tag,
  Trash2,
  X
} from 'lucide-react';
import type { FormEvent } from 'react';
import type { useProviderCampaignState } from '../collections/useProviderCampaignState';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { useProviderInventoryState } from '../inventory/useProviderInventoryState';
import type { useProviderPromotionsState } from './useProviderPromotionsState';

type PromotionsPanelProps = Pick<ReturnType<typeof useProviderSessionState>,
  'isLoadingProvider'
> &
  Pick<ReturnType<typeof useProviderCampaignState>,
    'activeCampaign' | 'submittingCampaign'
  > &
  Pick<ReturnType<typeof useProviderPromotionsState>,
    'vCode' | 'setVCode' | 'vName' | 'setVName' | 'vType' | 'setVType' | 'vValue' | 'setVValue' | 'vouchers' | 'editingComboId' | 'cName' | 'setCName' | 'cDesc' | 'setCDesc' | 'cProductId' | 'setIsAoDaiModalOpen' | 'cPackageId' | 'photoPackages' | 'setIsPackageModalOpen' | 'cDiscount' | 'setCDiscount' | 'cPrice' | 'setCPrice' | 'cValidFrom' | 'setCValidFrom' | 'cValidTo' | 'setCValidTo' | 'cMaxUsage' | 'setCMaxUsage' | 'cShootPeopleCount' | 'setCShootPeopleCount' | 'cAoDaiQuantity' | 'setCAoDaiQuantity' | 'isAoDaiModalOpen' | 'aoDaiSearch' | 'setAoDaiSearch' | 'setCProductId' | 'isPackageModalOpen' | 'packageSearch' | 'setPackageSearch' | 'setCPackageId' | 'combos'
  > &
  Pick<ReturnType<typeof useProviderInventoryState>,
    'myProductsList' | 'inventorySummary'
  > &
{
  hasAodaiCapability: boolean | undefined;
  openCampaignModal: () => void;
  handleDeactivateCampaign: () => Promise<void>;
  handleAddVoucher: (e: FormEvent<Element>) => Promise<void>;
  handleDeleteVoucher: (id: string) => Promise<void>;
  hasPhotographyCapability: boolean | undefined;
  handleCreateOrUpdateCombo: (e: FormEvent<Element>) => Promise<void>;
  clearComboForm: () => void;
  handleEditCombo: (combo: any) => void;
  handleDeleteCombo: (id: string) => Promise<void>;
};

export function PromotionsPanel({
  isLoadingProvider, hasAodaiCapability, openCampaignModal, activeCampaign, handleDeactivateCampaign,
  submittingCampaign, handleAddVoucher, vCode, setVCode, vName, setVName, vType, setVType, vValue,
  setVValue, vouchers, handleDeleteVoucher, hasPhotographyCapability, handleCreateOrUpdateCombo,
  editingComboId, cName, setCName, cDesc, setCDesc, cProductId, myProductsList, setIsAoDaiModalOpen,
  cPackageId, photoPackages, setIsPackageModalOpen, cDiscount, setCDiscount, cPrice, setCPrice,
  cValidFrom, setCValidFrom, cValidTo, setCValidTo, cMaxUsage, setCMaxUsage, cShootPeopleCount,
  setCShootPeopleCount, inventorySummary, cAoDaiQuantity, setCAoDaiQuantity, clearComboForm,
  isAoDaiModalOpen, aoDaiSearch, setAoDaiSearch, setCProductId, isPackageModalOpen, packageSearch,
  setPackageSearch, setCPackageId, combos, handleEditCombo, handleDeleteCombo,
}: PromotionsPanelProps) {
  return (
    <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Mã khuyến mãi</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Tạo các chương trình khuyến mãi, giảm giá trực tiếp theo % hoặc tiền mặt cho khách hàng.</p>
        </div>
      </div>

      {isLoadingProvider ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải danh sách voucher...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* CHIẾN DỊCH GIẢM GIÁ ÁO DÀI */}
          {hasAodaiCapability && (
            <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0 }}>CHIẾN DỊCH GIẢM GIÁ SẢN PHẨM ÁO DÀI</h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Tạo chương trình giảm giá toàn bộ sản phẩm theo % cho dịp lễ/sự kiện đặc biệt.</p>
                </div>
                <button
                  type="button"
                  onClick={openCampaignModal}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: activeCampaign ? '#B91C1C' : 'var(--color-primary)',
                    padding: '10px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    color: 'white', border: 'none', transition: 'var(--transition-smooth)',
                  }}
                >
                  <Tag size={16} /> {activeCampaign ? `Đang chạy: ${activeCampaign.occasion} (-${activeCampaign.discountPercent}%)` : 'Tạo chiến dịch giảm giá'}
                </button>
              </div>

              {activeCampaign ? (
                <div style={{ padding: '14px 18px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: '#B91C1C' }}>🎉 {activeCampaign.occasion} (-{activeCampaign.discountPercent}%)</span>
                    <div style={{ fontSize: '12px', color: '#991B1B', marginTop: '4px' }}>
                      Áp dụng từ: {new Date(activeCampaign.startDate).toLocaleDateString('vi-VN')} đến {new Date(activeCampaign.endDate).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeactivateCampaign}
                    disabled={submittingCampaign}
                    style={{ padding: '8px 14px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                  >
                    Hủy chiến dịch (Về giá gốc)
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Chưa có chiến dịch giảm giá sản phẩm nào đang diễn ra.</p>
              )}
            </div>
          )}

          <form onSubmit={handleAddVoucher} style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0, borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>TẠO MÃ KHUYẾN MÃI MỚI</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÃ CODE (IN HOA, VIẾT LIỀN)</span>
                <input
                  type="text"
                  placeholder="Ví dụ: SILKSTONE10"
                  value={vCode}
                  onChange={(e) => setVCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÊN CHƯƠNG TRÌNH KHUYẾN MÃI</span>
                <input
                  type="text"
                  placeholder="Ví dụ: Giảm giá hè rực rỡ"
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>LOẠI GIẢM GIÁ</span>
                <select
                  value={vType}
                  onChange={(e) => setVType(e.target.value as any)}
                  style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                >
                  <option value="PERCENTAGE">Giảm theo Phần trăm (%)</option>
                  <option value="FIXED_AMOUNT">Giảm số tiền mặt cố định (đ)</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GIÁ TRỊ GIẢM</span>
                <input
                  type="number"
                  value={vValue}
                  onChange={(e) => setVValue(Number(e.target.value))}
                  style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              style={{ alignSelf: 'flex-start', padding: '11px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
            >
              Tạo Voucher ngay
            </button>
          </form>

          <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>DANH SÁCH VOUCHERS HOẠT ĐỘNG</h3>
            {vouchers.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>Chưa có mã khuyến mãi nào được tạo.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {vouchers.map((v) => (
                  <div key={v._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'var(--color-light-bg)' }}>
                    <div>
                      <span style={{ padding: '4px 10px', backgroundColor: 'var(--color-dark-bg)', color: 'white', borderRadius: '4px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em' }}>{v.code}</span>
                      <h5 style={{ fontSize: '14px', fontWeight: 700, margin: '10px 0 4px 0' }}>{v.name}</h5>
                      <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 700 }}>
                        Giảm {v.discountValue.toLocaleString()}{v.discountType === 'PERCENTAGE' ? '%' : 'đ'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteVoucher(v._id)}
                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '6px' }}
                      title="Xóa Voucher"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COMBO PROMOTION SECTION */}
          {hasPhotographyCapability && hasAodaiCapability && (
            <div style={{ borderTop: '2px dashed var(--color-light-border)', paddingTop: '40px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: 0 }}>Quản lý Combo Khuyến Mãi (Áo Dài + Photographer)</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                  Tạo gói combo kết hợp thuê áo dài và thuê thợ chụp ảnh để được hưởng mức chiết khấu hấp dẫn hơn.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
                {/* Form Create/Edit Combo */}
                <form onSubmit={handleCreateOrUpdateCombo} style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0, borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>
                    {editingComboId ? 'CẬP NHẬT COMBO' : 'TẠO COMBO MỚI'}
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÊN COMBO KHUYẾN MÃI</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: Combo Tràng An - Lưu giữ khoảnh khắc"
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÔ TẢ COMBO (MÔ TẢ NGẮN)</span>
                    <textarea
                      placeholder="Mô tả quyền lợi combo, ví dụ: Bao gồm 1 bộ áo dài và 2 tiếng chụp hình ngoại cảnh..."
                      value={cDesc}
                      onChange={(e) => setCDesc(e.target.value)}
                      rows={2}
                      style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHỌN ÁO DÀI</span>
                      {cProductId ? (
                        (() => {
                          const prod = myProductsList.find(p => p._id === cProductId);
                          return (
                            <div style={{ display: 'flex', gap: '10px', padding: '8px', border: '1px solid var(--color-primary)', borderRadius: '8px', backgroundColor: 'var(--color-primary-trans)', alignItems: 'center' }}>
                              <img src={prod?.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'} alt={prod?.name} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod?.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>{prod?.basePrice?.toLocaleString('vi-VN')}đ</div>
                              </div>
                              <button type="button" onClick={() => setIsAoDaiModalOpen(true)} style={{ border: 'none', background: 'none', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Đổi</button>
                            </div>
                          );
                        })()
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAoDaiModalOpen(true)}
                          style={{ padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#64748B', backgroundColor: '#F8FAFC', cursor: 'pointer', textAlign: 'center' }}
                        >
                          + Chọn Áo Dài
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHỌN GÓI CHỤP ẢNH</span>
                      {cPackageId ? (
                        (() => {
                          const pkg = photoPackages.find(p => p._id === cPackageId);
                          return (
                            <div style={{ display: 'flex', gap: '10px', padding: '8px', border: '1px solid var(--color-primary)', borderRadius: '8px', backgroundColor: 'var(--color-primary-trans)', alignItems: 'center' }}>
                              <img src={pkg?.images?.[0] || 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb'} alt={pkg?.name} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg?.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>{pkg?.price?.toLocaleString('vi-VN')}đ ({pkg?.durationHours}h)</div>
                              </div>
                              <button type="button" onClick={() => setIsPackageModalOpen(true)} style={{ border: 'none', background: 'none', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Đổi</button>
                            </div>
                          );
                        })()
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsPackageModalOpen(true)}
                          style={{ padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#64748B', backgroundColor: '#F8FAFC', cursor: 'pointer', textAlign: 'center' }}
                        >
                          + Chọn Gói Chụp
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>PHẦN TRĂM GIẢM GIÁ (%)</span>
                      <input
                        type="number"
                        min={1}
                        max={80}
                        value={cDiscount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setCDiscount('');
                          } else {
                            const num = Number(val);
                            if (!isNaN(num)) {
                              setCDiscount(num);
                            }
                          }
                        }}
                        onBlur={() => {
                          if (cDiscount === '' || cDiscount < 1) {
                            setCDiscount(1);
                          } else if (cDiscount > 80) {
                            setCDiscount(80);
                          }
                        }}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GIÁ COMBO TỰ ĐỊNH NGHĨA (Đ - TÙY CHỌN)</span>
                      <input
                        type="number"
                        placeholder="Để trống nếu tính theo %"
                        value={cPrice}
                        onChange={(e) => setCPrice(e.target.value)}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>NGÀY BẮT ĐẦU COMBO</span>
                      <input
                        type="date"
                        value={cValidFrom}
                        onChange={(e) => setCValidFrom(e.target.value)}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>NGÀY KẾT THÚC COMBO</span>
                      <input
                        type="date"
                        value={cValidTo}
                        onChange={(e) => setCValidTo(e.target.value)}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SỐ LƯỢNG COMBO GIỚI HẠN (STOCK)</span>
                      <input
                        type="number"
                        min={1}
                        value={cMaxUsage}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCMaxUsage(val === '' ? '' : Number(val));
                        }}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SỐ LƯỢNG NGƯỜI CHỤP TRONG COMBO</span>
                      {(() => {
                        const selectedPkg = photoPackages.find(p => p._id === cPackageId);
                        const maxPeopleAllowed = selectedPkg ? (selectedPkg.maxPeople || 1) : 1;
                        return (
                          <>
                            <input
                              type="number"
                              min={1}
                              max={maxPeopleAllowed}
                              value={cShootPeopleCount}
                              onChange={(e) => {
                                const val = e.target.value;
                                const num = val === '' ? '' : Number(val);
                                if (num !== '' && num > maxPeopleAllowed) {
                                  setCShootPeopleCount(maxPeopleAllowed);
                                } else {
                                  setCShootPeopleCount(num);
                                }
                              }}
                              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                              required
                            />
                            {selectedPkg && (
                              <small style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                Số người chụp tối đa của gói: <strong style={{ color: 'var(--color-primary)' }}>{maxPeopleAllowed}</strong> người
                              </small>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SỐ LƯỢNG ÁO DÀI THUÊ TRONG COMBO</span>
                      {(() => {
                        const selectedAoDaiStock = cProductId && inventorySummary
                          ? inventorySummary
                            .filter((item: any) => item.productId === cProductId)
                            .reduce((sum: number, item: any) => sum + (item.available || 0), 0)
                          : 0;
                        return (
                          <>
                            <input
                              type="number"
                              min={1}
                              max={selectedAoDaiStock || 1}
                              value={cAoDaiQuantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                const num = val === '' ? '' : Number(val);
                                if (num !== '' && num > selectedAoDaiStock && selectedAoDaiStock > 0) {
                                  setCAoDaiQuantity(selectedAoDaiStock);
                                } else {
                                  setCAoDaiQuantity(num);
                                }
                              }}
                              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                              required
                            />
                            <small style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              Tồn kho áo dài khả dụng: <strong style={{ color: 'var(--color-primary)' }}>{selectedAoDaiStock}</strong> sản phẩm
                            </small>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="submit"
                      style={{ padding: '11px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
                    >
                      {editingComboId ? 'Cập nhật Combo' : 'Tạo Combo ngay'}
                    </button>
                    {editingComboId && (
                      <button
                        type="button"
                        onClick={clearComboForm}
                        style={{ padding: '11px 24px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', color: 'var(--color-text-primary)', cursor: 'pointer' }}
                      >
                        Hủy bỏ
                      </button>
                    )}
                  </div>

                  {/* Modal chọn Áo Dài */}
                  {isAoDaiModalOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Chọn Áo Dài Cho Combo</h3>
                          <button type="button" onClick={() => setIsAoDaiModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: '16px', borderBottom: '1px solid #E2E8F0' }}>
                          <input
                            type="text"
                            placeholder="Tìm kiếm áo dài theo tên..."
                            value={aoDaiSearch}
                            onChange={(e) => setAoDaiSearch(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                          />
                        </div>
                        <div style={{ padding: '20px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {myProductsList.filter(p => p.name.toLowerCase().includes(aoDaiSearch.toLowerCase())).map((prod) => (
                            <div
                              key={prod._id}
                              onClick={() => { setCProductId(prod._id); setIsAoDaiModalOpen(false); }}
                              style={{ display: 'flex', gap: '12px', padding: '12px', border: cProductId === prod._id ? '2px solid var(--color-primary)' : '1px solid #E2E8F0', borderRadius: '12px', cursor: 'pointer', backgroundColor: cProductId === prod._id ? 'var(--color-primary-trans)' : 'white', transition: 'all 0.2s', alignItems: 'center' }}
                            >
                              <img src={prod.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'} alt={prod.name} style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                              <div style={{ flex: 1 }}>
                                <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{prod.name}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700, marginTop: '2px' }}>{prod.basePrice?.toLocaleString('vi-VN')}đ</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modal chọn Gói chụp ảnh */}
                  {isPackageModalOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Chọn Gói Chụp Cho Combo</h3>
                          <button type="button" onClick={() => setIsPackageModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: '16px', borderBottom: '1px solid #E2E8F0' }}>
                          <input
                            type="text"
                            placeholder="Tìm kiếm gói chụp theo tên..."
                            value={packageSearch}
                            onChange={(e) => setPackageSearch(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                          />
                        </div>
                        <div style={{ padding: '20px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {photoPackages.filter(p => p.name.toLowerCase().includes(packageSearch.toLowerCase())).map((pkg) => (
                            <div
                              key={pkg._id}
                              onClick={() => { setCPackageId(pkg._id); setIsPackageModalOpen(false); }}
                              style={{ display: 'flex', gap: '12px', padding: '12px', border: cPackageId === pkg._id ? '2px solid var(--color-primary)' : '1px solid #E2E8F0', borderRadius: '12px', cursor: 'pointer', backgroundColor: cPackageId === pkg._id ? 'var(--color-primary-trans)' : 'white', transition: 'all 0.2s', alignItems: 'center' }}
                            >
                              <img src={pkg.images?.[0] || 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb'} alt={pkg.name} style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                              <div style={{ flex: 1 }}>
                                <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{pkg.name}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Thời lượng: {pkg.durationHours}h</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700, marginTop: '2px' }}>{pkg.price?.toLocaleString('vi-VN')}đ</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </form>

                {/* Danh sách Combo */}
                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>
                    DANH SÁCH COMBO ĐANG CHẠY
                  </h4>
                  {combos.length === 0 ? (
                    <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', margin: 'auto' }}>Chưa có combo khuyến mãi nào được tạo.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '480px' }}>
                      {combos.map((cb) => (
                        <div key={cb._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'var(--color-light-bg)' }}>
                          <div style={{ flex: 1, marginRight: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ padding: '2px 8px', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '4px', fontWeight: 700, fontSize: '11px' }}>
                                -{cb.discountPercent}%
                              </span>
                              <h5 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{cb.name}</h5>
                            </div>
                            {cb.description && (
                              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 8px 0' }}>{cb.description}</p>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--color-text-primary)', marginTop: '8px' }}>
                              <div><strong>Áo dài:</strong> {cb.productId?.name || 'Sản phẩm đã bị xóa'}</div>
                              <div><strong>Gói chụp:</strong> {cb.photographyPackageId?.name || 'Gói chụp đã bị xóa'}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '11px' }}>
                                {((cb.productId?.basePrice || 0) + (cb.photographyPackageId?.price || 0)).toLocaleString('vi-VN')}đ
                              </div>
                              <div style={{ color: '#EF4444', fontWeight: 700, fontSize: '15px' }}>
                                {cb.comboPrice ? cb.comboPrice.toLocaleString('vi-VN') : Math.round(((cb.productId?.basePrice || 0) + (cb.photographyPackageId?.price || 0)) * (1 - cb.discountPercent / 100)).toLocaleString('vi-VN')}đ
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                              <button
                                onClick={() => handleEditCombo(cb)}
                                style={{ padding: '6px 10px', border: '1px solid var(--color-primary)', borderRadius: '4px', backgroundColor: 'white', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Sửa
                              </button>
                              <button
                                onClick={() => handleDeleteCombo(cb._id)}
                                style={{ padding: '6px 10px', border: '1px solid #EF4444', borderRadius: '4px', backgroundColor: 'white', color: '#EF4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
