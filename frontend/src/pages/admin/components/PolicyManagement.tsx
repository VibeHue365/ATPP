import React, { useState, useEffect } from 'react';
import {
  Settings, History, Save, Code
} from 'lucide-react';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';

type PolicyCode = 'BOOKING_HOLD_POLICY' | 'COMMISSION_POLICY' | 'CANCELLATION_POLICY' | 'REFUND_POLICY' | 'PROVIDER_VIOLATION_POLICY' | 'DISPUTE_POLICY';
type PolicyType = 'BOOKING' | 'COMMISSION' | 'CANCELLATION' | 'REFUND' | 'PROVIDER_VIOLATION' | 'DISPUTE';
type PolicyStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

interface SystemPolicy {
  id: string;
  code: PolicyCode;
  type: PolicyType;
  name: string;
  description?: string;
  value: Record<string, unknown>;
  status: PolicyStatus;
  version: number;
  activatedAt?: string;
  createdAt: string;
}

type PolicyFieldKind = 'number' | 'percent' | 'boolean' | 'refundMode';

interface PolicyField {
  key: string;
  label: string;
  kind: PolicyFieldKind;
  defaultValue: number | boolean | string;
  min?: number;
  max?: number;
}

const POLICY_FIELDS: Record<PolicyCode, PolicyField[]> = {
  COMMISSION_POLICY: [
    { key: 'defaultCommissionRate', label: 'Tỷ lệ commission mặc định (%)', kind: 'percent', defaultValue: 10, min: 0, max: 100 },
    { key: 'sameProviderComboCommissionRate', label: 'Combo cùng provider (%)', kind: 'percent', defaultValue: 8, min: 0, max: 100 },
    { key: 'crossProviderComboCommissionRate', label: 'Combo nhiều provider (%)', kind: 'percent', defaultValue: 10, min: 0, max: 100 },
    { key: 'fixedPlatformFee', label: 'Phí nền tảng cố định (VND)', kind: 'number', defaultValue: 0, min: 0 },
    { key: 'minCommissionAmount', label: 'Commission tối thiểu (VND)', kind: 'number', defaultValue: 0, min: 0 },
  ],
  CANCELLATION_POLICY: [
    { key: 'freeCancelBeforeHours', label: 'Hủy miễn phí trước (giờ)', kind: 'number', defaultValue: 72, min: 0 },
    { key: 'urgentBookingBeforeHours', label: 'Mốc booking gấp (giờ)', kind: 'number', defaultValue: 2, min: 0 },
    { key: 'gracePeriodMinutesNormal', label: 'Grace period thường (phút)', kind: 'number', defaultValue: 60, min: 0 },
    { key: 'gracePeriodMinutesUrgent', label: 'Grace period gấp (phút)', kind: 'number', defaultValue: 5, min: 0 },
    { key: 'productLateCancelPenaltyRate', label: 'Phạt hủy muộn áo dài (%)', kind: 'percent', defaultValue: 100, min: 0, max: 100 },
    { key: 'photographyLateCancelPenaltyRate', label: 'Phạt hủy muộn chụp ảnh (%)', kind: 'percent', defaultValue: 30, min: 0, max: 100 },
  ],
  REFUND_POLICY: [
    { key: 'autoApproveFreeCancelRefund', label: 'Tự động duyệt hoàn tiền hợp lệ', kind: 'boolean', defaultValue: true },
    { key: 'manualReviewThresholdAmount', label: 'Ngưỡng cần duyệt thủ công (VND)', kind: 'number', defaultValue: 1000000, min: 0 },
    { key: 'refundProcessingMode', label: 'Phương thức hoàn tiền', kind: 'refundMode', defaultValue: 'SIMULATED' },
  ],
  BOOKING_HOLD_POLICY: [
    { key: 'holdMinutes', label: 'Thời gian giữ booking (phút)', kind: 'number', defaultValue: 15, min: 1, max: 120 },
    { key: 'autoExpireEnabled', label: 'Tự động hết hạn booking giữ chỗ', kind: 'boolean', defaultValue: true },
  ],
  PROVIDER_VIOLATION_POLICY: [
    { key: 'maxWarningsBeforeSuspend', label: 'Số cảnh cáo trước khi suspend', kind: 'number', defaultValue: 3, min: 1 },
    { key: 'lateCancelViolationPoint', label: 'Điểm vi phạm hủy muộn', kind: 'number', defaultValue: 1, min: 0 },
    { key: 'noShowViolationPoint', label: 'Điểm vi phạm no-show', kind: 'number', defaultValue: 2, min: 0 },
    { key: 'autoSuspendEnabled', label: 'Tự động suspend provider vi phạm', kind: 'boolean', defaultValue: true },
  ],
  DISPUTE_POLICY: [
    { key: 'allowDisputeAfterCompletedHours', label: 'Thời hạn mở dispute sau hoàn thành (giờ)', kind: 'number', defaultValue: 72, min: 0 },
    { key: 'requireEvidence', label: 'Bắt buộc có bằng chứng', kind: 'boolean', defaultValue: true },
    { key: 'holdSettlementWhenDisputed', label: 'Tạm giữ settlement khi có dispute', kind: 'boolean', defaultValue: true },
  ],
};

const createPolicyValue = (code: PolicyCode, value?: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    POLICY_FIELDS[code].map((field) => {
      const currentValue = value?.[field.key];
      if (field.kind === 'percent' && typeof currentValue === 'number') {
        return [field.key, currentValue * 100];
      }
      return [field.key, currentValue ?? field.defaultValue];
    }),
  );

const serializePolicyValue = (code: PolicyCode, value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    POLICY_FIELDS[code].map((field) => {
      const currentValue = value[field.key];
      return [field.key, field.kind === 'percent' ? Number(currentValue) / 100 : currentValue];
    }),
  );

interface PolicyVersionsResponse {
  data?: SystemPolicy[];
  items?: SystemPolicy[];
}

export const PolicyManagement: React.FC = () => {
  const toast = useToast();
  const [selectedCode, setSelectedCode] = useState<PolicyCode>('COMMISSION_POLICY');
  const [versions, setVersions] = useState<SystemPolicy[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<SystemPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionVersionId, setActionVersionId] = useState<string | null>(null);

  // Editor mode: 'BASIC' (Form inputs) or 'ADVANCED' (Raw JSON Editor)
  const [editorMode, setEditorMode] = useState<'BASIC' | 'ADVANCED'>('BASIC');

  // Form states for creating a new version
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [jsonValue, setJsonValue] = useState('{}');
  const [basicValue, setBasicValue] = useState<Record<string, unknown>>(
    createPolicyValue('COMMISSION_POLICY'),
  );

  const policyCodes: { code: PolicyCode; label: string; type: PolicyType; desc: string }[] = [
    { code: 'COMMISSION_POLICY', label: 'Chính sách chiết khấu (Commission)', type: 'COMMISSION', desc: 'Thiết lập phần trăm chiết khấu hoa hồng của nền tảng đối với đơn hàng.' },
    { code: 'CANCELLATION_POLICY', label: 'Chính sách hủy đơn (Cancellation)', type: 'CANCELLATION', desc: 'Thiết lập thời hạn hủy lịch và tỉ lệ phạt cọc cho khách hàng & đối tác.' },
    { code: 'REFUND_POLICY', label: 'Chính sách hoàn tiền (Refund)', type: 'REFUND', desc: 'Thiết lập tiến trình duyệt hoàn tiền cọc tự động qua cổng thanh toán PayOS.' },
    { code: 'BOOKING_HOLD_POLICY', label: 'Quy định tạm giữ cọc (Booking Hold)', type: 'BOOKING', desc: 'Quy định số giờ tạm giữ tiền cọc giữ đồ trước khi chuyển khoản đối soát.' },
    { code: 'PROVIDER_VIOLATION_POLICY', label: 'Xử lý vi phạm đối tác (Violation)', type: 'PROVIDER_VIOLATION', desc: 'Quy định mức phạt khi đối tác tự ý hủy lịch hoặc vi phạm dịch vụ.' },
    { code: 'DISPUTE_POLICY', label: 'Giải quyết tranh chấp (Dispute)', type: 'DISPUTE', desc: 'Quy định thời gian khiếu nại và quy trình phán quyết cọc hư hỏng sản phẩm.' }
  ];

  const fetchVersions = async (code: PolicyCode) => {
    setLoading(true);
    setError(null);
    try {
      const res = await httpClient.get<PolicyVersionsResponse | SystemPolicy[]>(
        `/admin/system/policies/code/${code}`
      );
      // Sort by version descending
      const items = Array.isArray(res) ? res : res.data || res.items || [];
      const sorted = items.sort((a, b) => b.version - a.version);
      setVersions(sorted);

      // Select the active version by default, or the latest version
      const activeVer = sorted.find(v => v.status === 'ACTIVE') || sorted[0] || null;
      setSelectedVersion(activeVer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách phiên bản chính sách';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions(selectedCode);
  }, [selectedCode]);

  // Synchronize editor inputs when selectedVersion changes
  useEffect(() => {
    if (selectedVersion) {
      setNewName(`${selectedVersion.name} (Bản chỉnh sửa)`);
      setNewDescription(selectedVersion.description || '');
      const strVal = JSON.stringify(selectedVersion.value, null, 2);
      setJsonValue(strVal);
      setBasicValue(createPolicyValue(selectedCode, selectedVersion.value));
    } else {
      setNewName('');
      setNewDescription('');
      setJsonValue('{}');
      setBasicValue(createPolicyValue(selectedCode));
    }
  }, [selectedVersion, selectedCode]);

  // Keep JSON string in sync when the structured form changes.
  useEffect(() => {
    if (editorMode === 'BASIC') {
      setJsonValue(JSON.stringify(serializePolicyValue(selectedCode, basicValue), null, 2));
    }
  }, [basicValue, editorMode, selectedCode]);

  // Handle Save Draft (creates a new DRAFT version)
  const handleSaveDraft = async () => {
    if (!newName.trim()) {
      toast.error('Vui lòng nhập tên phiên bản chính sách');
      return;
    }

    // Validate JSON format
    let parsedValue: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(jsonValue) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('Policy value must be an object');
      }
      parsedValue = parsed as Record<string, unknown>;
    } catch (err) {
      toast.error('Định dạng cấu hình JSON không hợp lệ! Vui lòng kiểm tra lại cú pháp.');
      return;
    }

    const currentMeta = policyCodes.find(p => p.code === selectedCode);
    if (!currentMeta) return;

    const payload = {
      code: selectedCode,
      type: currentMeta.type,
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      value: parsedValue
    };

    setSaving(true);
    try {
      await httpClient.post('/admin/system/policies', payload);
      toast.success('Đã lưu bản thảo chính sách mới thành công!');
      await fetchVersions(selectedCode);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lưu bản thảo thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSelectedVersion = async () => {
    if (!selectedVersion || selectedVersion.status === 'ACTIVE') return;
    if (!newName.trim()) {
      toast.error('Vui lòng nhập tên phiên bản chính sách');
      return;
    }

    let parsedValue: Record<string, unknown>;
    try {
      const parsed = JSON.parse(jsonValue) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('Policy value must be an object');
      }
      parsedValue = parsed as Record<string, unknown>;
    } catch {
      toast.error('Định dạng cấu hình JSON không hợp lệ!');
      return;
    }

    setSaving(true);
    try {
      await httpClient.patch(`/admin/system/policies/${selectedVersion.id}`, {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        value: parsedValue,
        reason: 'Cập nhật phiên bản chính sách từ trang quản trị',
      });
      toast.success(`Đã cập nhật phiên bản v${selectedVersion.version}`);
      await fetchVersions(selectedCode);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Cập nhật phiên bản thất bại');
    } finally {
      setSaving(false);
    }
  };

  const updateBasicValue = (field: PolicyField, value: string | boolean) => {
    setBasicValue((previous) => ({
      ...previous,
      [field.key]: field.kind === 'number' || field.kind === 'percent'
        ? Number(value)
        : value,
    }));
  };

  // Activate policy
  const handleActivateVersion = async (id: string, version: number) => {
    const result = await Swal.fire({
      title: `Kích hoạt Phiên bản v${version}?`,
      text: 'Phiên bản này sẽ được áp dụng ngay lập tức trên toàn hệ thống. Phiên bản đang chạy sẽ được tự động lưu trữ.',
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Lý do kích hoạt chính thức *',
      inputPlaceholder: 'Ví dụ: Cập nhật tăng chiết khấu hè 2026 / Điều chỉnh thời gian hủy cọc...',
      inputAttributes: { required: 'true' },
      showCancelButton: true,
      confirmButtonColor: '#706E3B',
      cancelButtonColor: '#7A7A7A',
      confirmButtonText: 'Kích hoạt ngay',
      cancelButtonText: 'Hủy bỏ',
      background: 'white',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Vui lòng nhập lý do kích hoạt chính sách!';
        }
        return null;
      }
    });

    if (result.isConfirmed && result.value) {
      setActionVersionId(id);
      try {
        await httpClient.patch(`/admin/system/policies/${id}/activate`, {
          reason: result.value.trim()
        });
        toast.success(`Phiên bản v${version} đã được áp dụng làm chính sách hiện hành!`);
        await fetchVersions(selectedCode);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Kích hoạt chính sách thất bại');
      } finally {
        setActionVersionId(null);
      }
    }
  };

  // Archive / Deactivate policy
  const handleArchiveDraft = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hủy bỏ bản thảo này?',
      text: 'Bản thảo chính sách chưa được kích hoạt sẽ bị hủy.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4A0E17',
      confirmButtonText: 'Hủy bản thảo',
      cancelButtonText: 'Quay lại',
      background: 'white'
    });

    if (result.isConfirmed) {
      setActionVersionId(id);
      try {
        await httpClient.patch(`/admin/system/policies/${id}/deactivate`, {
          reason: 'Admin archived/cancelled draft version'
        });
        toast.success('Đã hủy bỏ bản thảo thành công');
        await fetchVersions(selectedCode);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Hủy bản thảo thất bại');
      } finally {
        setActionVersionId(null);
      }
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}>

      {/* LEFT: Policy selector sidebar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #E8E2D5'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#4A0E17', fontWeight: 800, borderBottom: '1px solid #E8E2D5', paddingBottom: '8px' }}>
          DANH MỤC CHÍNH SÁCH
        </h3>
        {policyCodes.map(p => {
          const isActive = selectedCode === p.code;
          return (
            <button
              key={p.code}
              onClick={() => setSelectedCode(p.code)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: '12px 14px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: isActive ? '#4A0E17' : 'transparent',
                color: isActive ? 'white' : '#2A2A2A',
                transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{p.label.split('(')[0].trim()}</span>
              <span style={{ fontSize: '10px', opacity: isActive ? 0.8 : 0.6, marginTop: '2px' }}>{p.code}</span>
            </button>
          );
        })}
      </div>

      {/* RIGHT: Editor Panel & Versions History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Active version Banner & details */}
        <div style={{
          backgroundColor: '#FAF6F0',
          border: '1px solid #E8E2D5',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#B89047', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cấu hình hiện hành</span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#4A0E17', margin: '4px 0' }}>
                {policyCodes.find(p => p.code === selectedCode)?.label}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7A7A7A' }}>
                {policyCodes.find(p => p.code === selectedCode)?.desc}
              </p>
            </div>
          </div>
        </div>

        {/* Form Hybrid Editor Layout */}
        <div style={{ backgroundColor: 'white', border: '1px solid #E8E2D5', borderRadius: '12px', overflow: 'hidden' }}>

          {/* Editor Header: Switch basic / advanced */}
          <div style={{
            padding: '16px 20px',
            backgroundColor: '#FAF6F0',
            borderBottom: '1px solid #E8E2D5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 750, color: '#4A0E17', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={15} /> BIÊN TẬP PHIÊN BẢN CẤU HÌNH MỚI
            </h3>

            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'white', padding: '3px', borderRadius: '6px', border: '1px solid #E8E2D5' }}>
              <button
                onClick={() => setEditorMode('BASIC')}
                style={{
                  padding: '4px 10px', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  backgroundColor: editorMode === 'BASIC' ? '#4A0E17' : 'transparent',
                  color: editorMode === 'BASIC' ? 'white' : '#7A7A7A'
                }}
              >
                Giao diện Form
              </button>
              <button
                onClick={() => setEditorMode('ADVANCED')}
                style={{
                  padding: '4px 10px', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  backgroundColor: editorMode === 'ADVANCED' ? '#4A0E17' : 'transparent',
                  color: editorMode === 'ADVANCED' ? 'white' : '#7A7A7A'
                }}
              >
                Advanced (JSON Code)
              </button>
            </div>
          </div>

          {/* Editor Body */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>TÊN PHIÊN BẢN MỚI *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Tăng phí commission hè"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>MÔ TẢ NGẮN GỌN</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Mô tả nguyên nhân/chi tiết thay đổi..."
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>

            {/* Hybrid Views */}
            {editorMode === 'BASIC' ? (
              <div style={{ padding: '16px', backgroundColor: '#FAF6F0', borderRadius: '8px', border: '1px solid #E8E2D5', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {POLICY_FIELDS[selectedCode].map((field) => (
                  <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {field.kind === 'boolean' ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '38px', fontSize: '13px', fontWeight: 700, color: '#2A2A2A', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(basicValue[field.key])}
                          onChange={(event) => updateBasicValue(field, event.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: '#4A0E17' }}
                        />
                        {field.label}
                      </label>
                    ) : (
                      <>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>{field.label}</label>
                        {field.kind === 'refundMode' ? (
                          <select
                            value={String(basicValue[field.key] ?? field.defaultValue)}
                            onChange={(event) => updateBasicValue(field, event.target.value)}
                            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', backgroundColor: 'white' }}
                          >
                            <option value="SIMULATED">Giả lập</option>
                            <option value="MANUAL">Thủ công</option>
                            <option value="GATEWAY">Cổng thanh toán</option>
                          </select>
                        ) : (
                          <input
                            type="number"
                            value={String(basicValue[field.key] ?? field.defaultValue)}
                            onChange={(event) => updateBasicValue(field, event.target.value)}
                            min={field.min}
                            max={field.max}
                            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px' }}
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* ADVANCED JSON CODE VIEW */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', display: 'flex', alignItems: 'center', gap: '4px' }}><Code size={14} /> NỘI DUNG CẤU HÌNH JSON (OBJECT VALUE) *</label>
                <textarea
                  value={jsonValue}
                  onChange={(e) => setJsonValue(e.target.value)}
                  style={{
                    width: '100%',
                    height: '140px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #E8E2D5',
                    outline: 'none',
                    resize: 'none',
                    backgroundColor: '#1E1E1E',
                    color: '#9CDCFE'
                  }}
                />
              </div>
            )}

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E8E2D5', paddingTop: '16px', marginTop: '4px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                {selectedVersion && selectedVersion.status !== 'ACTIVE' && (
                  <button
                    onClick={handleUpdateSelectedVersion}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', color: '#4A0E17', border: '1px solid #4A0E17', padding: '10px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
                  >
                    <Save size={16} /> {saving ? 'Đang lưu...' : `Cập nhật v${selectedVersion.version}`}
                  </button>
                )}
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#4A0E17', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 2px 4px rgba(74,14,23,0.15)' }}
                >
                  <Save size={16} /> {saving ? 'Đang lưu...' : 'Tạo phiên bản nháp mới'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline / version history section */}
        <div style={{ backgroundColor: 'white', border: '1px solid #E8E2D5', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 750, color: '#4A0E17', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={15} /> LỊCH SỬ CÁC PHIÊN BẢN CHÍNH SÁCH
            </h3>
          </div>

          <div style={{ padding: '20px' }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Đang tải phiên bản chính sách...</div>
            ) : error ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#991B1B' }}>
                <p style={{ margin: '0 0 12px' }}>{error}</p>
                <button onClick={() => void fetchVersions(selectedCode)} style={{ padding: '7px 14px', border: '1px solid #4A0E17', background: 'white', color: '#4A0E17', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}>Thử lại</button>
              </div>
            ) : versions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Không tìm thấy phiên bản chính sách nào</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {versions.map((v) => {
                  const isActive = v.status === 'ACTIVE';
                  const isDraft = v.status === 'DRAFT';

                  return (
                    <div
                      key={v.id}
                      style={{
                        border: '1px solid #E8E2D5',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: isActive ? '#FFF9F9' : 'transparent',
                        borderColor: isActive ? '#4A0E17' : '#E8E2D5'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%', backgroundColor: isActive ? '#4A0E17' : '#E8E2D5',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? 'white' : '#7A7A7A', fontWeight: 800, fontSize: '14px'
                        }}>
                          v{v.version}
                        </div>
                        <div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <strong style={{ fontSize: '14.5px', color: '#2A2A2A' }}>{v.name}</strong>
                            <span style={{
                              padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                              backgroundColor: isActive ? '#F0FDF4' : isDraft ? '#FEF3C7' : '#F3F4F6',
                              color: isActive ? '#166534' : isDraft ? '#92400E' : '#7A7A7A'
                            }}>
                              {v.status === 'ACTIVE' ? 'ĐANG CHẠY' : v.status === 'DRAFT' ? 'DRAFT' : 'ARCHIVED'}
                            </span>
                          </div>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#7A7A7A' }}>
                            {v.description || 'Không có mô tả chi tiết'}
                          </p>
                          <span style={{ display: 'block', fontSize: '11px', color: '#B89047', marginTop: '6px', fontWeight: 600 }}>
                            Tạo ngày: {new Date(v.createdAt).toLocaleDateString('vi-VN')} {v.activatedAt && `• Kích hoạt: ${new Date(v.activatedAt).toLocaleDateString('vi-VN')}`}
                          </span>
                        </div>
                      </div>

                      {/* Version Action buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setSelectedVersion(v);
                            // Scroll to editor
                            window.scrollTo({ top: 120, behavior: 'smooth' });
                          }}
                          style={{
                            padding: '6px 12px', border: '1px solid #E8E2D5', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700,
                            cursor: 'pointer', backgroundColor: 'white', color: '#4A0E17'
                          }}
                        >
                          Xem giá trị (Value)
                        </button>
                        {isDraft && (
                          <>
                            <button
                              onClick={() => handleActivateVersion(v.id, v.version)}
                              disabled={actionVersionId === v.id}
                              style={{
                                padding: '6px 12px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700,
                                cursor: 'pointer', backgroundColor: '#706E3B', color: 'white'
                              }}
                            >
                              {actionVersionId === v.id ? 'Đang xử lý...' : 'Kích hoạt'}
                            </button>
                            <button
                              onClick={() => handleArchiveDraft(v.id)}
                              disabled={actionVersionId === v.id}
                              style={{
                                padding: '6px 12px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700,
                                cursor: 'pointer', backgroundColor: '#4A0E17', color: 'white'
                              }}
                            >
                              Hủy bỏ
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
