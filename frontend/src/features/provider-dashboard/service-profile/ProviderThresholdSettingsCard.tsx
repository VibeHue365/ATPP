import React, { useEffect, useState, useCallback } from 'react';
import {
  Sliders,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  FileText,
} from 'lucide-react';
import { CONTRACTS_V2_ENABLED } from '../../../config/features';
import {
  contractService,
  type ProviderContractConfig,
  type ProviderContractMode,
} from '../../../services/contractService';
import { translateError } from '../../../utils/errorTranslator';
import { useToast } from '../../../components/feedback/Toast';

export const ProviderThresholdSettingsCard: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState<boolean>(CONTRACTS_V2_ENABLED);
  const [saving, setSaving] = useState<boolean>(false);
  const [config, setConfig] = useState<ProviderContractConfig | null>(null);

  const [contractMode, setContractMode] = useState<ProviderContractMode>('AUTO');
  const [orderThresholdAmount, setOrderThresholdAmount] = useState<string>('500000');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!CONTRACTS_V2_ENABLED) return;
    try {
      setLoading(true);
      setSaveError(null);
      const data = await contractService.getProviderContractConfig();
      if (data) {
        setConfig(data);
        setContractMode(data.contractMode || 'AUTO');
        if (data.orderThresholdAmount !== null && data.orderThresholdAmount !== undefined) {
          setOrderThresholdAmount(String(data.orderThresholdAmount));
        }
      }
    } catch (err: unknown) {
      console.warn('Failed to load provider contract config:', err);
      // Non-blocking, fallback to defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  if (!CONTRACTS_V2_ENABLED) {
    return null;
  }

  const handleSave = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setValidationError(null);
    setSaveSuccess(null);
    setSaveError(null);

    let parsedThreshold: number | null = null;
    if (contractMode === 'CUSTOM_ORDER_THRESHOLD') {
      const num = Number(orderThresholdAmount);
      if (isNaN(num) || num <= 0) {
        setValidationError('Vui lòng nhập ngưỡng giá trị đơn hàng hợp lệ lớn hơn 0 VNĐ.');
        return;
      }
      if (num > 100000000) {
        setValidationError('Ngưỡng giá trị đơn hàng không được vượt quá 100.000.000 VNĐ.');
        return;
      }
      parsedThreshold = Math.floor(num);
    }

    setSaving(true);
    try {
      const updated = await contractService.updateProviderContractConfig({
        contractMode,
        orderThresholdAmount: parsedThreshold,
      });
      setConfig(updated);
      setContractMode(updated.contractMode);
      if (updated.orderThresholdAmount !== null && updated.orderThresholdAmount !== undefined) {
        setOrderThresholdAmount(String(updated.orderThresholdAmount));
      }
      setSaveSuccess(`Đã lưu cấu hình phân tầng hợp đồng (Phiên bản v${updated.version})`);
      toast.success('Cập nhật cấu hình ngưỡng hợp đồng thành công!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const translated = translateError(msg) || 'Không thể lưu cấu hình ngưỡng hợp đồng.';
      setSaveError(translated);
      toast.error(translated);
    } finally {
      setSaving(false);
    }
  };

  const formattedThresholdPreview = () => {
    const num = Number(orderThresholdAmount);
    if (isNaN(num) || num <= 0) return '0 đ';
    return `${num.toLocaleString('vi-VN')} đ`;
  };

  return (
    <div
      className="provider-contract-threshold-card"
      data-testid="provider-threshold-settings-card"
      style={{
        marginTop: 24,
        marginBottom: 24,
        padding: 24,
        borderRadius: 14,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: '#eff6ff',
            color: '#1d4ed8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sliders size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>
            Cấu hình Ngưỡng hợp đồng thuê (Tiered Contracts)
          </h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>
            Phân tầng trải nghiệm khách hàng: Đơn hàng nhỏ, an toàn sẽ thuê nhanh (QUICK); đơn hàng giá trị cao hoặc có rủi ro sẽ ký hợp đồng chi tiết (DETAILED).
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: '#6b7280' }}>
          <Loader2 size={18} className="animate-spin" />
          <span>Đang tải cấu hình hiện tại...</span>
        </div>
      ) : (
        <div className="provider-threshold-form-wrapper">
          {/* Mode Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 16 }}>
            {/* AUTO */}
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 16,
                borderRadius: 10,
                border: contractMode === 'AUTO' ? '2px solid #2563eb' : '1px solid #e5e7eb',
                background: contractMode === 'AUTO' ? '#f0f7ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                  <Zap size={16} color="#2563eb" /> Tự động (AUTO)
                </span>
                <input
                  type="radio"
                  name="contractMode"
                  value="AUTO"
                  checked={contractMode === 'AUTO'}
                  onChange={() => setContractMode('AUTO')}
                  data-testid="radio-mode-auto"
                />
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Áp dụng linh hoạt theo khuyến nghị và ngưỡng bảo vệ an toàn của hệ thống VibeHue.
              </p>
            </label>

            {/* CUSTOM_ORDER_THRESHOLD */}
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 16,
                borderRadius: 10,
                border: contractMode === 'CUSTOM_ORDER_THRESHOLD' ? '2px solid #2563eb' : '1px solid #e5e7eb',
                background: contractMode === 'CUSTOM_ORDER_THRESHOLD' ? '#f0f7ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                  <Sliders size={16} color="#059669" /> Ngưỡng đơn hàng
                </span>
                <input
                  type="radio"
                  name="contractMode"
                  value="CUSTOM_ORDER_THRESHOLD"
                  checked={contractMode === 'CUSTOM_ORDER_THRESHOLD'}
                  onChange={() => setContractMode('CUSTOM_ORDER_THRESHOLD')}
                  data-testid="radio-mode-custom"
                />
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Chủ động đặt mức tiền. Đơn dưới ngưỡng được thuê nhanh, đơn từ ngưỡng trở lên ký hợp đồng A4.
              </p>
            </label>

            {/* ALWAYS_DETAILED */}
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 16,
                borderRadius: 10,
                border: contractMode === 'ALWAYS_DETAILED' ? '2px solid #2563eb' : '1px solid #e5e7eb',
                background: contractMode === 'ALWAYS_DETAILED' ? '#f0f7ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                  <FileText size={16} color="#d97706" /> Luôn ký chi tiết
                </span>
                <input
                  type="radio"
                  name="contractMode"
                  value="ALWAYS_DETAILED"
                  checked={contractMode === 'ALWAYS_DETAILED'}
                  onChange={() => setContractMode('ALWAYS_DETAILED')}
                  data-testid="radio-mode-detailed"
                />
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Bắt buộc ký xác nhận hợp đồng điện tử chi tiết cho tất cả đơn hàng, bất kể giá trị.
              </p>
            </label>
          </div>

          {/* Threshold Input Field when CUSTOM_ORDER_THRESHOLD */}
          {contractMode === 'CUSTOM_ORDER_THRESHOLD' && (
            <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
              data-testid="threshold-input-section"
            >
              <label
                htmlFor="orderThresholdAmount"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}
              >
                Mức ngưỡng giá trị đơn hàng (VNĐ)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 400 }}>
                <input
                  id="orderThresholdAmount"
                  type="number"
                  min="10000"
                  max="100000000"
                  step="10000"
                  value={orderThresholdAmount}
                  onChange={(e) => setOrderThresholdAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleSave(e);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                  data-testid="input-threshold-amount"
                />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f766e', minWidth: 100 }}>
                  {formattedThresholdPreview()}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0' }}>
                Đơn hàng có tổng tiền thuê & cọc dưới mức này sẽ được kích hoạt thuê nhanh nếu không có cảnh báo rủi ro cao.
              </p>
            </div>
          )}

          {/* Safety Rule Note */}
          <div
            style={{
              marginTop: 18,
              padding: '12px 16px',
              borderRadius: 8,
              background: '#fefce8',
              border: '1px solid #fef08a',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <ShieldCheck size={18} color="#a16207" style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: '#713f12', margin: 0, lineHeight: 1.5 }}>
              <strong>Quy chuẩn bảo vệ tối thiểu của Sàn:</strong> Hệ thống tự động chuyển sang hợp đồng chi tiết khi phát hiện các yếu tố rủi ro cao (giá trị sản phẩm lớn, tiền cọc cao, thời gian thuê dài hoặc trang phục đặc biệt) ngay cả khi giá trị đơn hàng dưới ngưỡng đã chọn.
            </p>
          </div>

          {/* Errors and Success */}
          {validationError && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              data-testid="threshold-validation-error"
            >
              <AlertCircle size={16} /> {validationError}
            </div>
          )}
          {saveError && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} /> {saveError}
            </div>
          )}
          {saveSuccess && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={16} /> {saveSuccess}
            </div>
          )}

          {/* Submit Action */}
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {config?.version ? `Cấu hình phiên bản v${config.version}` : 'Chưa lưu cấu hình riêng'}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 20px',
                borderRadius: 8,
                background: saving ? '#93c5fd' : '#2563eb',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
              data-testid="save-threshold-config-button"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Đang lưu...' : 'Lưu cấu hình ngưỡng'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
