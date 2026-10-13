import React, { useState } from 'react';
import {
  Ticket,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export interface ApplicableVoucherItem {
  promotion: {
    _id: string;
    code: string;
    name: string;
    description?: string;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    discountValue: number;
    maxDiscountAmount?: number;
    minOrderValue: number;
    endDate: string;
    scope?: string;
    audience?: string;
    applicableBookingTypes?: string[];
    requiredTiers?: string[];
  };
  discountAmount: number;
  platformSubsidyAmount: number;
  finalGrandTotal: number;
  isBestDeal: boolean;
}

export interface IneligibleVoucherItem {
  promotion: {
    _id: string;
    code: string;
    name: string;
    description?: string;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    discountValue: number;
    maxDiscountAmount?: number;
    minOrderValue: number;
    endDate: string;
    scope?: string;
    audience?: string;
    applicableBookingTypes?: string[];
    requiredTiers?: string[];
  };
  reason: string;
}

interface VoucherPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicableList: ApplicableVoucherItem[];
  ineligibleList: IneligibleVoucherItem[];
  selectedVoucherCode: string | null;
  onSelectVoucher: (voucherItem: ApplicableVoucherItem | null) => void;
  onApplyManualCode?: (code: string) => Promise<boolean>;
}

export const VoucherPickerModal: React.FC<VoucherPickerModalProps> = ({
  isOpen,
  onClose,
  applicableList,
  ineligibleList,
  selectedVoucherCode,
  onSelectVoucher,
  onApplyManualCode,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [tempSelectedCode, setTempSelectedCode] = useState<string | null>(
    selectedVoucherCode,
  );
  const [activeTab, setActiveTab] = useState<'applicable' | 'ineligible'>('applicable');

  if (!isOpen) return null;

  const handleApplyManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setManualError(null);
    setIsSubmittingManual(true);

    try {
      const upperCode = manualCode.trim().toUpperCase();
      // Check if it already exists in applicableList
      const matched = applicableList.find(
        (item) => item.promotion.code.toUpperCase() === upperCode,
      );
      if (matched) {
        setTempSelectedCode(matched.promotion.code);
        setManualCode('');
        return;
      }

      // Check if it's in ineligibleList
      const ineligibleMatch = ineligibleList.find(
        (item) => item.promotion.code.toUpperCase() === upperCode,
      );
      if (ineligibleMatch) {
        setManualError(ineligibleMatch.reason || 'Mã này không đủ điều kiện cho đơn hàng');
        return;
      }

      if (onApplyManualCode) {
        const success = await onApplyManualCode(upperCode);
        if (success) {
          setTempSelectedCode(upperCode);
          setManualCode('');
        } else {
          setManualError('Mã ưu đãi không hợp lệ hoặc không thể áp dụng');
        }
      } else {
        setManualError('Mã ưu đãi không tồn tại hoặc đã hết hạn');
      }
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleConfirm = () => {
    if (!tempSelectedCode) {
      onSelectVoucher(null);
    } else {
      const item = applicableList.find(
        (v) => v.promotion.code === tempSelectedCode,
      );
      if (item) {
        onSelectVoucher(item);
      }
    }
    onClose();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return `HSD: ${d.toLocaleDateString('vi-VN')}`;
    } catch {
      return '';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px -8px rgba(45, 41, 38, 0.25)',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #F0ECE4',
            backgroundColor: '#FAF7F2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(139, 30, 34, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8B1E22',
              }}
            >
              <Ticket size={20} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#2D2926',
                  fontFamily: 'Playfair Display, Georgia, serif',
                }}
              >
                VibeHue Ưu Đãi
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#8C7E74' }}>
                Chọn mã voucher tốt nhất cho đơn hàng của bạn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#8C7E74',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Input Manual Code */}
        <div style={{ padding: '16px 24px 8px', backgroundColor: '#FFFFFF' }}>
          <form
            onSubmit={handleApplyManual}
            style={{ display: 'flex', gap: '8px' }}
          >
            <input
              type="text"
              placeholder="Nhập mã voucher (vd: GOLD10, COMBO150)"
              value={manualCode}
              onChange={(e) => {
                setManualCode(e.target.value.toUpperCase());
                setManualError(null);
              }}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #D9CFC4',
                fontSize: '13px',
                outline: 'none',
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            />
            <button
              type="submit"
              disabled={!manualCode.trim() || isSubmittingManual}
              style={{
                padding: '10px 20px',
                backgroundColor: manualCode.trim() ? '#8B1E22' : '#E0D8D0',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: manualCode.trim() ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s',
              }}
            >
              {isSubmittingManual ? 'Kiểm tra...' : 'Áp dụng'}
            </button>
          </form>
          {manualError && (
            <div
              style={{
                color: '#C0392B',
                fontSize: '12px',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <AlertCircle size={14} />
              <span>{manualError}</span>
            </div>
          )}
        </div>

        {/* Tabs: Khả dụng vs Không khả dụng */}
        <div
          style={{
            display: 'flex',
            padding: '8px 24px 0',
            borderBottom: '1px solid #F0ECE4',
            gap: '24px',
          }}
        >
          <button
            onClick={() => setActiveTab('applicable')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '10px 0',
              fontSize: '13px',
              fontWeight: activeTab === 'applicable' ? 700 : 500,
              color: activeTab === 'applicable' ? '#8B1E22' : '#8C7E74',
              borderBottom:
                activeTab === 'applicable' ? '2px solid #8B1E22' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Có thể áp dụng</span>
            <span
              style={{
                backgroundColor: activeTab === 'applicable' ? '#8B1E22' : '#EAE1D4',
                color: activeTab === 'applicable' ? '#FFFFFF' : '#5D4037',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 600,
              }}
            >
              {applicableList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ineligible')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '10px 0',
              fontSize: '13px',
              fontWeight: activeTab === 'ineligible' ? 700 : 500,
              color: activeTab === 'ineligible' ? '#8B1E22' : '#8C7E74',
              borderBottom:
                activeTab === 'ineligible' ? '2px solid #8B1E22' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Chưa đủ điều kiện</span>
            <span
              style={{
                backgroundColor: '#EAE1D4',
                color: '#5D4037',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 600,
              }}
            >
              {ineligibleList.length}
            </span>
          </button>
        </div>

        {/* Voucher List Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {activeTab === 'applicable' && (
            <>
              {applicableList.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '36px 16px',
                    color: '#8C7E74',
                  }}
                >
                  <Ticket size={40} style={{ opacity: 0.35, marginBottom: '10px' }} />
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                    Chưa có mã ưu đãi khả dụng cho đơn này
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                    Hãy thử xem tab "Chưa đủ điều kiện" để biết thêm chi tiết.
                  </p>
                </div>
              ) : (
                applicableList.map((item) => {
                  const isSelected = tempSelectedCode === item.promotion.code;
                  return (
                    <div
                      key={item.promotion._id}
                      onClick={() =>
                        setTempSelectedCode(
                          isSelected ? null : item.promotion.code,
                        )
                      }
                      style={{
                        display: 'flex',
                        borderRadius: '12px',
                        border: isSelected
                          ? '2px solid #8B1E22'
                          : '1px solid #EAE1D4',
                        backgroundColor: isSelected ? '#FDFBF9' : '#FFFFFF',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out',
                        position: 'relative',
                        boxShadow: isSelected
                          ? '0 4px 12px rgba(139, 30, 34, 0.08)'
                          : 'none',
                      }}
                    >
                      {/* Left Ticket Stub */}
                      <div
                        style={{
                          width: '100px',
                          backgroundColor: isSelected ? '#8B1E22' : '#F7F3ED',
                          color: isSelected ? '#FFFFFF' : '#8B1E22',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '12px 8px',
                          borderRight: '1px dashed #D9CFC4',
                          position: 'relative',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.promotion.discountType === 'PERCENTAGE'
                            ? `GIẢM ${item.promotion.discountValue}%`
                            : 'GIẢM'}
                        </span>
                        {item.promotion.discountType === 'FIXED_AMOUNT' && (
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 800,
                              marginTop: '2px',
                            }}
                          >
                            {(item.promotion.discountValue / 1000).toLocaleString('vi-VN')}K
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '10px',
                            opacity: isSelected ? 0.85 : 0.65,
                            marginTop: '4px',
                          }}
                        >
                          Voucher
                        </span>
                      </div>

                      {/* Right Detail Content */}
                      <div
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              marginBottom: '4px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#2D2926',
                                  fontFamily: 'monospace',
                                  letterSpacing: '0.05em',
                                }}
                              >
                                {item.promotion.code}
                              </span>
                              {item.isBestDeal && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: '#B7791F',
                                    backgroundColor: '#FEFCBF',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                  }}
                                >
                                  <Sparkles size={10} />
                                  Tiết kiệm nhất
                                </span>
                              )}
                            </div>

                            {/* Radio / Check mark */}
                            <div
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                border: isSelected
                                  ? '2px solid #8B1E22'
                                  : '2px solid #C8BDB2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isSelected ? '#8B1E22' : 'transparent',
                              }}
                            >
                              {isSelected && (
                                <div
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: '#FFFFFF',
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          <p
                            style={{
                              margin: '0 0 6px',
                              fontSize: '12px',
                              color: '#5D4037',
                              fontWeight: 500,
                              lineHeight: 1.4,
                            }}
                          >
                            {item.promotion.name}
                          </p>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                            color: '#8C7E74',
                            borderTop: '1px solid #F5EFE6',
                            paddingTop: '6px',
                            marginTop: '4px',
                          }}
                        >
                          <span style={{ color: '#27AE60', fontWeight: 700 }}>
                            Tiết kiệm {item.discountAmount.toLocaleString('vi-VN')}đ
                          </span>
                          <span>{formatDate(item.promotion.endDate)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'ineligible' && (
            <>
              {ineligibleList.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '36px 16px',
                    color: '#8C7E74',
                  }}
                >
                  <CheckCircle2 size={40} style={{ opacity: 0.35, color: '#27AE60', marginBottom: '10px' }} />
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                    Tất cả các voucher đều đã đủ điều kiện áp dụng!
                  </p>
                </div>
              ) : (
                ineligibleList.map((item) => (
                  <div
                    key={item.promotion._id}
                    style={{
                      display: 'flex',
                      borderRadius: '12px',
                      border: '1px solid #EAE1D4',
                      backgroundColor: '#FAF8F5',
                      opacity: 0.75,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Left Stub */}
                    <div
                      style={{
                        width: '90px',
                        backgroundColor: '#EFEBE4',
                        color: '#7D7065',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px 6px',
                        borderRight: '1px dashed #D9CFC4',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>
                        {item.promotion.code}
                      </span>
                      <span style={{ fontSize: '10px', marginTop: '4px' }}>Chưa khả dụng</span>
                    </div>

                    {/* Right Info */}
                    <div
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#5D4037',
                        }}
                      >
                        {item.promotion.name}
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '4px',
                          color: '#C0392B',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        <AlertCircle size={13} style={{ flexShrink: 0 }} />
                        <span>{item.reason}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #F0ECE4',
            backgroundColor: '#FAF7F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            {tempSelectedCode ? (
              <button
                onClick={() => setTempSelectedCode(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#8C7E74',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Bỏ chọn voucher
              </button>
            ) : (
              <span style={{ fontSize: '12px', color: '#8C7E74' }}>Chưa chọn mã nào</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: '1px solid #D9CFC4',
                color: '#5D4037',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
            <button
              onClick={handleConfirm}
              style={{
                padding: '8px 20px',
                backgroundColor: '#8B1E22',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(139, 30, 34, 0.25)',
              }}
            >
              Áp dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
