import React, { useEffect } from 'react';
import {
  DollarSign,
  Lightbulb,
  Percent,
  Plus,
  Save,
  Sparkles,
  Ticket,
  X
} from 'lucide-react';
import { VoucherCard } from './VoucherCard';
import '../vouchersFigma.css';

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  editingVoucherId: string | null;
  vCode: string;
  setVCode: (val: string) => void;
  vName: string;
  setVName: (val: string) => void;
  vDesc: string;
  setVDesc: (val: string) => void;
  vType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  setVType: (val: 'PERCENTAGE' | 'FIXED_AMOUNT') => void;
  vValue: number | '';
  setVValue: (val: number | '') => void;
  vMaxDiscount: number | '';
  setVMaxDiscount: (val: number | '') => void;
  vMinOrder: number | '';
  setVMinOrder: (val: number | '') => void;
  vUsageLimit: number | '';
  setVUsageLimit: (val: number | '') => void;
  vStartDate: string;
  setVStartDate: (val: string) => void;
  vEndDate: string;
  setVEndDate: (val: string) => void;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingVoucherId,
  vCode,
  setVCode,
  vName,
  setVName,
  vDesc,
  setVDesc,
  vType,
  setVType,
  vValue,
  setVValue,
  vMaxDiscount,
  setVMaxDiscount,
  vMinOrder,
  setVMinOrder,
  vUsageLimit,
  setVUsageLimit,
  vStartDate,
  setVStartDate,
  vEndDate,
  setVEndDate,
}) => {
  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Generate random voucher code
  const handleGenerateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setVCode(`LUME${rand}`);
  };

  // Quick date presets
  const handleSetQuickDays = (days: number) => {
    const start = vStartDate ? new Date(vStartDate) : new Date();
    const end = new Date(start.getTime() + days * 86400000);
    const toKey = (d: Date) => d.toISOString().split('T')[0];
    if (!vStartDate) {
      setVStartDate(toKey(start));
    }
    setVEndDate(toKey(end));
  };

  // Mock object for real-time live voucher card preview
  const previewVoucher = {
    code: vCode || 'LUMEVIP',
    name: vName || 'Tên chương trình ưu đãi của bạn',
    description: vDesc || 'Áp dụng cho mọi khách hàng đặt lịch hoặc thuê áo dài.',
    discountType: vType,
    discountValue: vValue || 10,
    minOrderValue: vMinOrder || 0,
    maxDiscountAmount: vMaxDiscount || null,
    usageLimit: vUsageLimit || 50,
    usedCount: 0,
    startDate: vStartDate || new Date().toISOString(),
    endDate: vEndDate || new Date(Date.now() + 30 * 86400000).toISOString(),
    status: 'ACTIVE',
  };

  return (
    <div className="vc-modal-backdrop" onClick={onClose}>
      <div className="vc-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* ==================== HEADER ==================== */}
        <div className="vc-modal-header">
          <div className="vc-modal-header-left">
            <div className="vc-modal-header-icon">
              <Ticket size={20} />
            </div>
            <div>
              <h3 className="vc-modal-title">
                {editingVoucherId ? 'Chỉnh Sửa Mã Voucher' : 'Tạo Mã Voucher Mới'}
              </h3>
              <p className="vc-modal-subtitle">
                Thiết lập điều kiện giảm giá, thời hạn sử dụng và ngân sách khuyến mãi cho cửa hàng
              </p>
            </div>
          </div>

          <button
            type="button"
            className="vc-modal-close-btn"
            onClick={onClose}
            title="Đóng (ESC)"
          >
            <X size={20} />
          </button>
        </div>

        {/* ==================== FORM BODY (2-COLUMN GRID) ==================== */}
        <form onSubmit={onSubmit} style={{ display: 'contents' }}>
          <div className="vc-modal-body-scroll">
            <div className="vc-modal-grid-2col">
              {/* ==================== LEFT COLUMN: INPUT FIELDS ==================== */}
              <div className="vc-modal-col-left">
                {/* 1. Mã Voucher */}
                <div className="vc-field-group">
                  <label className="vc-field-label">
                    <span>Mã Voucher (Code) *</span>
                    <span className="vc-field-hint">Khách hàng sẽ nhập mã này khi thanh toán</span>
                  </label>
                  <div className="vc-code-input-wrap">
                    <input
                      type="text"
                      className="vc-input-text"
                      placeholder="VD: LUMETET26"
                      required
                      value={vCode}
                      onChange={(e) =>
                        setVCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9_-]/g, '')
                        )
                      }
                    />
                    <button
                      type="button"
                      className="vc-btn-random-code"
                      onClick={handleGenerateRandomCode}
                      title="Tạo mã ngẫu nhiên"
                    >
                      <Sparkles size={14} color="var(--vc-gold)" />
                      <span>Mã ngẫu nhiên</span>
                    </button>
                  </div>
                </div>

                {/* 2. Tên chương trình & Mô tả */}
                <div className="vc-field-group">
                  <label className="vc-field-label">
                    <span>Tên chương trình ưu đãi *</span>
                  </label>
                  <input
                    type="text"
                    className="vc-input-text"
                    placeholder="VD: Ưu Đãi Đầu Năm - Giảm 20% Thuê Áo Dài"
                    required
                    value={vName}
                    onChange={(e) => setVName(e.target.value)}
                  />
                </div>

                <div className="vc-field-group">
                  <label className="vc-field-label">
                    <span>Mô tả ngắn điều kiện (Tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    className="vc-input-text"
                    placeholder="VD: Áp dụng cho các đơn đặt lịch trong tuần"
                    value={vDesc}
                    onChange={(e) => setVDesc(e.target.value)}
                  />
                </div>

                {/* 3. Loại giảm giá & Giá trị */}
                <div className="vc-field-group">
                  <label className="vc-field-label">
                    <span>Hình thức chiết khấu *</span>
                  </label>
                  <div className="vc-type-switch">
                    <button
                      type="button"
                      className={`vc-type-switch-btn ${
                        vType === 'PERCENTAGE' ? 'active' : ''
                      }`}
                      onClick={() => setVType('PERCENTAGE')}
                    >
                      <Percent size={15} />
                      <span>Theo Phần Trăm (%)</span>
                    </button>
                    <button
                      type="button"
                      className={`vc-type-switch-btn ${
                        vType === 'FIXED_AMOUNT' ? 'active' : ''
                      }`}
                      onClick={() => setVType('FIXED_AMOUNT')}
                    >
                      <DollarSign size={15} />
                      <span>Số Tiền Cố Định (đ)</span>
                    </button>
                  </div>
                </div>

                <div className="vc-grid-2cols">
                  {/* Giá trị giảm */}
                  <div className="vc-field-group">
                    <label className="vc-field-label">
                      <span>
                        {vType === 'PERCENTAGE' ? 'Phần trăm giảm (%) *' : 'Số tiền giảm (VNĐ) *'}
                      </span>
                    </label>
                    <input
                      type="number"
                      className="vc-input-text"
                      min={1}
                      max={vType === 'PERCENTAGE' ? 100 : undefined}
                      placeholder={vType === 'PERCENTAGE' ? 'VD: 15' : 'VD: 50000'}
                      required
                      value={vValue}
                      onChange={(e) =>
                        setVValue(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  </div>

                  {/* Giảm tối đa (nếu % ) */}
                  {vType === 'PERCENTAGE' ? (
                    <div className="vc-field-group">
                      <label className="vc-field-label">
                        <span>Giảm tối đa (VNĐ)</span>
                        <span className="vc-field-hint">Trống = Không giới hạn</span>
                      </label>
                      <input
                        type="number"
                        className="vc-input-text"
                        min={0}
                        placeholder="VD: 100000"
                        value={vMaxDiscount}
                        onChange={(e) =>
                          setVMaxDiscount(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  ) : (
                    <div className="vc-field-group">
                      <label className="vc-field-label">
                        <span>Đơn tối thiểu (VNĐ)</span>
                      </label>
                      <input
                        type="number"
                        className="vc-input-text"
                        min={0}
                        placeholder="VD: 200000"
                        value={vMinOrder}
                        onChange={(e) =>
                          setVMinOrder(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  )}
                </div>

                {vType === 'PERCENTAGE' && (
                  <div className="vc-grid-2cols">
                    {/* Đơn tối thiểu */}
                    <div className="vc-field-group">
                      <label className="vc-field-label">
                        <span>Đơn hàng tối thiểu (VNĐ)</span>
                        <span className="vc-field-hint">Trống = 0đ</span>
                      </label>
                      <input
                        type="number"
                        className="vc-input-text"
                        min={0}
                        placeholder="VD: 200000"
                        value={vMinOrder}
                        onChange={(e) =>
                          setVMinOrder(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                      />
                    </div>

                    {/* Giới hạn lượt dùng */}
                    <div className="vc-field-group">
                      <label className="vc-field-label">
                        <span>Số lượng phát hành</span>
                        <span className="vc-field-hint">Trống = Vô hạn</span>
                      </label>
                      <input
                        type="number"
                        className="vc-input-text"
                        min={1}
                        placeholder="VD: 50"
                        value={vUsageLimit}
                        onChange={(e) =>
                          setVUsageLimit(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                )}

                {vType === 'FIXED_AMOUNT' && (
                  <div className="vc-field-group">
                    <label className="vc-field-label">
                      <span>Số lượng voucher phát hành</span>
                      <span className="vc-field-hint">Trống = Vô hạn</span>
                    </label>
                    <input
                      type="number"
                      className="vc-input-text"
                      min={1}
                      placeholder="VD: 50"
                      value={vUsageLimit}
                      onChange={(e) =>
                        setVUsageLimit(
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                )}

                {/* 4. Thời gian hiệu lực */}
                <div className="vc-field-group">
                  <div className="vc-field-label">
                    <span>Thời gian áp dụng</span>
                    <div className="vc-quick-dates">
                      <button
                        type="button"
                        className="vc-quick-date-btn"
                        onClick={() => handleSetQuickDays(7)}
                      >
                        +7 ngày
                      </button>
                      <button
                        type="button"
                        className="vc-quick-date-btn"
                        onClick={() => handleSetQuickDays(30)}
                      >
                        +30 ngày
                      </button>
                      <button
                        type="button"
                        className="vc-quick-date-btn"
                        onClick={() => handleSetQuickDays(90)}
                      >
                        +3 tháng
                      </button>
                    </div>
                  </div>
                  <div className="vc-grid-2cols">
                    <div>
                      <input
                        type="date"
                        className="vc-input-text"
                        value={vStartDate}
                        onChange={(e) => setVStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        className="vc-input-text"
                        value={vEndDate}
                        onChange={(e) => setVEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ==================== RIGHT COLUMN: LIVE PREVIEW & TIPS ==================== */}
              <div className="vc-modal-col-right">
                {/* 1. Live Ticket Preview Container */}
                <div className="vc-preview-container">
                  <div className="vc-preview-header">
                    <div className="vc-preview-title">
                      <Ticket size={15} />
                      <span>Xem trước thẻ voucher thực tế</span>
                    </div>
                    <span className="vc-preview-badge">Live Preview</span>
                  </div>

                  <VoucherCard voucher={previewVoucher} previewOnly={true} />
                </div>

                {/* 2. Pro Tips Box */}
                <div className="vc-tips-box">
                  <div className="vc-tips-title">
                    <Lightbulb size={16} />
                    <span>Mẹo tối ưu hiệu quả voucher</span>
                  </div>
                  <ul className="vc-tips-list">
                    <li>
                      <strong>Ưu đãi 10% - 20%:</strong> Phù hợp cho khách hàng mới, giúp tăng 35% tỷ lệ hoàn tất đặt lịch.
                    </li>
                    <li>
                      <strong>Đơn hàng tối thiểu:</strong> Thiết lập mức tối thiểu cao hơn 15-20% giá thuê trang phục cơ bản để khách chọn thêm phụ kiện.
                    </li>
                    <li>
                      <strong>Tạo cảm giác cấp bách:</strong> Giới hạn số lượng (ví dụ: 30-50 lượt) thúc đẩy khách hàng chốt đơn sớm hơn.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* ==================== FOOTER ==================== */}
          <div className="vc-modal-footer">
            <button type="button" className="vc-btn-cancel" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="vc-btn-submit">
              {editingVoucherId ? <Save size={16} /> : <Plus size={16} />}
              <span>{editingVoucherId ? 'Cập Nhật Voucher' : 'Kích Hoạt Mã Voucher'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
