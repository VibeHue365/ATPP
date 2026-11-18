import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { contractApi } from '@/apis/contractApi';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import { FontFamily } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import type {
  CurrentPolicyResponse,
  IncidentCompensationMethod,
  ProviderAcceptanceStatusResponse,
  ProviderContractConfig,
  ProviderContractMode,
  ProviderContractPolicyVersion,
  ProviderMechanismResponse,
  SavePolicyPayload,
  TierCompensationRule,
} from '@/types/contract';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatDateTime } from '@/utils/booking';
import {
  DEFAULT_PROVIDER_POLICY_PAYLOAD,
  normalizePolicyPayloadForSave,
  policyRequiresAssetValue,
  policyVersionToFormPayload,
  STANDARD_DISPUTE_RESOLUTION_CLAUSE,
  validatePolicyPayload,
} from '@/utils/contractPolicy';
import { ProviderAcceptanceModal } from './ProviderAcceptanceModal';
import { ProviderPolicyHistoryModal } from './ProviderPolicyHistoryModal';

interface ProviderContractSetupPanelProps {
  visible: boolean;
  defaultPhone?: string;
  onChanged?: () => void;
}

type TierKey = 'minorDamage' | 'moderateDamage' | 'severeDamage' | 'totalLoss';

const TIER_DEFINITIONS: Array<{
  key: TierKey;
  title: string;
  hint: string;
}> = [
  {
    key: 'minorDamage',
    title: '1. Hư hỏng nhẹ',
    hint: 'Vết bẩn giặt tẩy được, sút chỉ nhẹ, rơi cúc',
  },
  {
    key: 'moderateDamage',
    title: '2. Hư hỏng vừa',
    hint: 'Rách đường may, ố màu cần hấp tẩy/sửa chuyên dụng',
  },
  {
    key: 'severeDamage',
    title: '3. Hư hỏng nặng',
    hint: 'Rách lớn thân áo, biến dạng phom dáng hoặc thêu ren',
  },
  {
    key: 'totalLoss',
    title: '4. Mất đồ / Không thể phục hồi',
    hint: 'Thất lạc, cháy hỏng hoặc rách nát không thể sửa',
  },
];

const METHOD_OPTIONS: Array<{
  value: IncidentCompensationMethod;
  label: string;
}> = [
  { value: 'FIXED_FEE', label: 'Phí cố định' },
  { value: 'PERCENTAGE_ON_ASSET', label: '% Giá trị áo' },
  { value: 'ACTUAL_REPAIR_COST', label: 'Chi phí sửa thực tế' },
  { value: 'INCIDENT_NEGOTIATION', label: 'Thương lượng' },
];

const MODE_OPTIONS: Array<{
  value: ProviderContractMode;
  title: string;
  desc: string;
}> = [
  {
    value: 'AUTO',
    title: 'Tự động thông minh (AUTO)',
    desc: 'Hệ thống chọn bản Nhanh (QUICK) cho đơn rủi ro thấp hoặc Đầy đủ (DETAILED) nếu vượt ngưỡng an toàn.',
  },
  {
    value: 'CUSTOM_ORDER_THRESHOLD',
    title: 'Theo ngưỡng giá trị đơn',
    desc: 'Đơn dưới ngưỡng dùng bản Nhanh; từ ngưỡng trở lên bắt buộc hợp đồng Đầy đủ.',
  },
  {
    value: 'ALWAYS_DETAILED',
    title: 'Luôn hiển thị đầy đủ',
    desc: 'Mọi đơn thuê áo dài đều hiển thị đầy đủ toàn bộ điều khoản hợp đồng.',
  },
];

function getPolicyBannerMeta(version: ProviderContractPolicyVersion | null) {
  if (!version) {
    return {
      label: 'Chưa thiết lập chính sách',
      tone: 'warning' as const,
      desc: 'Hãy cấu hình chính sách cho thuê và bấm Gửi Admin duyệt để kích hoạt Hợp đồng điện tử V2.',
    };
  }
  switch (version.status) {
    case 'APPROVED':
      return {
        label: `v${version.versionNumber} · Đã duyệt`,
        tone: 'success' as const,
        desc: 'Chính sách đã được Ban Quản trị phê duyệt. Bạn có thể chấp thuận Quy chế sàn ở trên hoặc chỉnh sửa để tạo phiên bản mới.',
      };
    case 'PENDING_REVIEW':
      return {
        label: `v${version.versionNumber} · Chờ Admin duyệt`,
        tone: 'warning' as const,
        desc: 'Chính sách đang chờ Quản trị viên phê duyệt trên trang Web Admin. Biểu mẫu tạm khóa trong khi chờ duyệt.',
      };
    case 'REJECTED':
      return {
        label: `v${version.versionNumber} · Bị từ chối`,
        tone: 'error' as const,
        desc: version.reviewNote
          ? `Lý do từ chối: ${version.reviewNote}. Vui lòng chỉnh sửa và gửi duyệt lại.`
          : 'Chính sách chưa đạt yêu cầu, vui lòng điều chỉnh và gửi duyệt lại.',
      };
    case 'DRAFT':
    default:
      return {
        label: `v${version.versionNumber} · Bản nháp`,
        tone: 'info' as const,
        desc: 'Bản nháp chưa gửi duyệt. Hãy hoàn thiện các mục bên dưới và bấm "Gửi duyệt" để Admin xem xét.',
      };
  }
}

export function ProviderContractSetupPanel({
  visible,
  defaultPhone,
  onChanged,
}: ProviderContractSetupPanelProps) {
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [featureDisabledMsg, setFeatureDisabledMsg] = useState<string | null>(null);

  const [policyData, setPolicyData] = useState<CurrentPolicyResponse | null>(null);
  const [acceptance, setAcceptance] = useState<ProviderAcceptanceStatusResponse | null>(
    null,
  );
  const [mechanism, setMechanism] = useState<ProviderMechanismResponse | null>(null);
  const [contractConfig, setContractConfig] = useState<ProviderContractConfig | null>(
    null,
  );

  const [form, setForm] = useState<SavePolicyPayload>(() =>
    policyVersionToFormPayload(null, defaultPhone),
  );
  const [newProhibited, setNewProhibited] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingPolicy, setSubmittingPolicy] = useState(false);

  const [contractMode, setContractMode] = useState<ProviderContractMode>('AUTO');
  const [thresholdInput, setThresholdInput] = useState('500000');
  const [savingConfig, setSavingConfig] = useState(false);

  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<
    ProviderContractPolicyVersion[]
  >([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setFeatureDisabledMsg(null);
    try {
      const [polRes, accRes, mechRes, cfgRes] = await Promise.allSettled([
        contractApi.getProviderCurrentPolicy(),
        contractApi.getProviderAcceptance(),
        contractApi.getProviderMechanism(),
        contractApi.getProviderConfig(),
      ]);

      const cfgError =
        cfgRes.status === 'rejected'
          ? getApiErrorMessage(cfgRes.reason, '')
          : '';
      if (cfgError.includes('CONTRACTS_V2_DISABLED')) {
        setFeatureDisabledMsg(
          'Backend chưa bật CONTRACTS_V2_ENABLED=true. Vui lòng khởi động lại Backend với cấu hình mới.',
        );
      }

      if (polRes.status === 'fulfilled') {
        setPolicyData(polRes.value);
        const editable =
          polRes.value.draft || polRes.value.pending || polRes.value.active;
        setForm(policyVersionToFormPayload(editable, defaultPhone));
      } else {
        setForm(policyVersionToFormPayload(null, defaultPhone));
      }

      if (accRes.status === 'fulfilled') {
        setAcceptance(accRes.value);
      }
      if (mechRes.status === 'fulfilled') {
        setMechanism(mechRes.value);
      }
      if (cfgRes.status === 'fulfilled' && cfgRes.value) {
        setContractConfig(cfgRes.value);
        setContractMode(cfgRes.value.contractMode || 'AUTO');
        if (typeof cfgRes.value.orderThresholdAmount === 'number') {
          setThresholdInput(String(cfgRes.value.orderThresholdAmount));
        }
      }
    } catch (err) {
      show(getApiErrorMessage(err, 'Không thể tải cấu hình Hợp đồng V2'), 'error');
    } finally {
      setLoading(false);
    }
  }, [defaultPhone, show]);

  useEffect(() => {
    if (visible) {
      void loadAll();
    }
  }, [visible, loadAll]);

  const latestPolicyVersion = useMemo(
    () => policyData?.draft || policyData?.pending || policyData?.active || null,
    [policyData],
  );
  const isLockedPending = latestPolicyVersion?.status === 'PENDING_REVIEW';
  const hasApprovedPolicy = Boolean(policyData?.active?.status === 'APPROVED');
  const needsAssetValue = useMemo(
    () => policyRequiresAssetValue(form.damageCompensation),
    [form.damageCompensation],
  );
  const policyBanner = useMemo(
    () => getPolicyBannerMeta(latestPolicyVersion),
    [latestPolicyVersion],
  );

  const updateTier = (tierKey: TierKey, patch: Partial<TierCompensationRule>) => {
    setForm((prev) => ({
      ...prev,
      damageCompensation: {
        ...prev.damageCompensation,
        [tierKey]: {
          method: 'INCIDENT_NEGOTIATION',
          ...(prev.damageCompensation[tierKey] ?? {}),
          ...patch,
        },
      },
    }));
  };

  const handleSaveDraft = async () => {
    const normalized = normalizePolicyPayloadForSave(form, defaultPhone);
    const err = validatePolicyPayload(normalized, 'DRAFT');
    if (err) {
      show(err, 'error');
      return;
    }
    setSavingDraft(true);
    try {
      await contractApi.saveProviderPolicyDraft(normalized);
      show('Đã lưu bản nháp Chính sách Hợp đồng', 'success');
      await loadAll();
      onChanged?.();
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể lưu bản nháp chính sách'), 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitPolicy = async () => {
    const normalized = normalizePolicyPayloadForSave(form, defaultPhone);
    const err = validatePolicyPayload(normalized, 'SUBMIT');
    if (err) {
      show(err, 'error');
      return;
    }
    setSubmittingPolicy(true);
    try {
      await contractApi.submitProviderPolicy(normalized);
      show(
        'Đã gửi chính sách lên Ban Quản trị! Vui lòng mở Web Admin duyệt trước khi kích hoạt Quy chế.',
        'success',
      );
      await loadAll();
      onChanged?.();
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể gửi duyệt chính sách'), 'error');
    } finally {
      setSubmittingPolicy(false);
    }
  };

  const handleAcceptMechanism = async (mechanismHash: string) => {
    setAcceptSubmitting(true);
    try {
      await contractApi.acceptProviderMechanism(mechanismHash);
      setAcceptModalVisible(false);
      show('Đã kích hoạt Hợp đồng điện tử V2 cho Shop thành công!', 'success');
      await loadAll();
      onChanged?.();
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể chấp thuận quy chế'), 'error');
    } finally {
      setAcceptSubmitting(false);
    }
  };

  const handleRevokeAcceptance = () => {
    TagoAlert.alert(
      'Rút lại chấp thuận quy chế',
      'Khi rút lại chấp thuận, khách hàng sẽ tạm thời không thể tạo đơn thuê mới tại Shop cho đến khi bạn xác nhận lại quy chế. Tiếp tục?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rút lại',
          style: 'destructive',
          onPress: async () => {
            try {
              await contractApi.revokeProviderAcceptance();
              show('Đã rút lại chấp thuận quy chế', 'info');
              await loadAll();
              onChanged?.();
            } catch (cause) {
              show(
                getApiErrorMessage(cause, 'Không thể rút lại chấp thuận'),
                'error',
              );
            }
          },
        },
      ],
    );
  };

  const handleSaveConfig = async () => {
    let orderThresholdAmount: number | null = null;
    if (contractMode === 'CUSTOM_ORDER_THRESHOLD') {
      const parsed = Math.round(Number(thresholdInput.replace(/[^0-9]/g, '')));
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000_000) {
        show('Ngưỡng tiền đơn hàng phải từ 0 đến 100.000.000 VNĐ', 'error');
        return;
      }
      orderThresholdAmount = parsed;
    }

    setSavingConfig(true);
    try {
      const updated = await contractApi.updateProviderConfig({
        contractMode,
        orderThresholdAmount,
      });
      setContractConfig(updated);
      show('Đã cập nhật chế độ hiển thị Hợp đồng V2', 'success');
      onChanged?.();
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể lưu cấu hình chế độ hợp đồng'), 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const openHistory = async () => {
    setHistoryVisible(true);
    setHistoryLoading(true);
    try {
      const list = await contractApi.getProviderPolicyVersions();
      setHistoryVersions(Array.isArray(list) ? list : []);
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể tải lịch sử phiên bản'), 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#BA0049" />
        <Text style={styles.loadingText}>Đang tải cấu hình Hợp đồng V2...</Text>
      </View>
    );
  }

  const accStatus = acceptance?.status || 'NOT_ACCEPTED';
  const accBadge =
    accStatus === 'ACTIVE'
      ? { label: 'Đã kích hoạt V2', tone: 'success' as const }
      : accStatus === 'STALE'
        ? { label: 'Cần xác nhận lại', tone: 'warning' as const }
        : accStatus === 'REVOKED'
          ? { label: 'Đã rút lại (Tạm ngưng)', tone: 'error' as const }
          : { label: 'Chưa tham gia V2 (Legacy)', tone: 'neutral' as const };

  return (
    <View style={styles.root}>
      {featureDisabledMsg && (
        <View style={styles.alertError}>
          <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
          <Text style={styles.alertErrorText}>{featureDisabledMsg}</Text>
        </View>
      )}

      {/* CARD 1: TRẠNG THÁI & QUY CHẾ SÀN */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>BƯỚC KÍCH HOẠT HỢP ĐỒNG V2</Text>
            <Text style={styles.cardTitle}>Trạng thái & Quy chế sàn</Text>
          </View>
          <StatusBadge label={accBadge.label} tone={accBadge.tone} />
        </View>

        <View style={styles.stepsBox}>
          <StepLine
            done={Boolean(latestPolicyVersion)}
            text="1. Thiết lập & gửi Chính sách hợp đồng của Shop"
          />
          <StepLine
            done={hasApprovedPolicy}
            text="2. Quản trị viên phê duyệt chính sách trên Web Admin"
          />
          <StepLine
            done={accStatus === 'ACTIVE'}
            text="3. Shop bấm Chấp thuận Quy chế sàn giao kết tự động"
          />
        </View>

        {acceptance?.active && (
          <View style={styles.activeMetaBox}>
            <Text style={styles.metaText}>
              Mẫu: {acceptance.active.templateVersion} · Quy chế:{' '}
              {acceptance.active.mechanismVersion}
            </Text>
            <Text style={styles.metaText}>
              Chấp thuận lúc: {formatDateTime(acceptance.active.acceptedAt)}
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          {accStatus !== 'ACTIVE' ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setAcceptModalVisible(true)}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>
                {accStatus === 'STALE'
                  ? 'Xem & Xác nhận lại Quy chế'
                  : 'Xem toàn văn & Chấp thuận'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.dangerOutlineBtn}
              onPress={handleRevokeAcceptance}
            >
              <Ionicons name="close-circle-outline" size={16} color="#B91C1C" />
              <Text style={styles.dangerOutlineText}>Rút lại chấp thuận</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* CARD 2: CHÍNH SÁCH HỢP ĐỒNG SHOP */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>ĐIỀU KHOẢN RIÊNG CỦA SHOP</Text>
            <Text style={styles.cardTitle}>Chính sách Thuê & Bồi thường</Text>
          </View>
          <StatusBadge label={policyBanner.label} tone={policyBanner.tone} />
        </View>

        <View
          style={[
            styles.infoBanner,
            policyBanner.tone === 'error' && styles.alertError,
            policyBanner.tone === 'warning' && styles.alertWarn,
          ]}
        >
          <Text style={styles.infoBannerText}>{policyBanner.desc}</Text>
        </View>

        <View style={styles.subHeaderRow}>
          <Pressable style={styles.historyBtn} onPress={() => void openHistory()}>
            <Ionicons name="time-outline" size={15} color="#BA0049" />
            <Text style={styles.historyBtnText}>
              Lịch sử phiên bản ({policyData?.totalVersions ?? 0})
            </Text>
          </Pressable>
        </View>

        {/* Mục 1: Bảo quản */}
        <Text style={styles.sectionHeading}>1. Bảo quản & Giặt là áo dài</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Cho phép khách tự ủi (là hơi nhẹ)</Text>
          <Switch
            value={form.garmentCare.allowIroning}
            disabled={isLockedPending}
            trackColor={{ false: '#CBD5E1', true: '#F4A3BA' }}
            thumbColor={form.garmentCare.allowIroning ? '#BA0049' : '#F8FAFC'}
            onValueChange={(val) =>
              setForm((p) => ({
                ...p,
                garmentCare: { ...p.garmentCare, allowIroning: val },
              }))
            }
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Cho phép khách tự giặt</Text>
          <Switch
            value={form.garmentCare.allowWashing}
            disabled={isLockedPending}
            trackColor={{ false: '#CBD5E1', true: '#F4A3BA' }}
            thumbColor={form.garmentCare.allowWashing ? '#BA0049' : '#F8FAFC'}
            onValueChange={(val) =>
              setForm((p) => ({
                ...p,
                garmentCare: { ...p.garmentCare, allowWashing: val },
              }))
            }
          />
        </View>

        <Text style={styles.fieldLabel}>Hành vi nghiêm cấm khi sử dụng</Text>
        <View style={styles.chipsWrap}>
          {form.garmentCare.prohibitedActions.map((act, idx) => (
            <Pressable
              key={`${act}-${idx}`}
              disabled={isLockedPending}
              style={styles.tagChip}
              onPress={() =>
                setForm((p) => ({
                  ...p,
                  garmentCare: {
                    ...p.garmentCare,
                    prohibitedActions: p.garmentCare.prohibitedActions.filter(
                      (_, i) => i !== idx,
                    ),
                  },
                }))
              }
            >
              <Text style={styles.tagChipText}>{act}</Text>
              {!isLockedPending && (
                <Ionicons name="close" size={13} color="#9F1239" />
              )}
            </Pressable>
          ))}
        </View>
        {!isLockedPending && (
          <View style={styles.inlineAddRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Thêm điều cấm (VD: Không gắn ghim lên lụa)"
              placeholderTextColor="#94A3B8"
              value={newProhibited}
              onChangeText={setNewProhibited}
            />
            <Pressable
              style={styles.smallAddBtn}
              onPress={() => {
                const trimmed = newProhibited.trim();
                if (!trimmed) return;
                if (!form.garmentCare.prohibitedActions.includes(trimmed)) {
                  setForm((p) => ({
                    ...p,
                    garmentCare: {
                      ...p.garmentCare,
                      prohibitedActions: [
                        ...p.garmentCare.prohibitedActions,
                        trimmed,
                      ],
                    },
                  }));
                }
                setNewProhibited('');
              }}
            >
              <Text style={styles.smallAddBtnText}>Thêm</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.fieldLabel}>Ghi chú bảo quản đặc biệt</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          editable={!isLockedPending}
          placeholder="Ghi chú hướng dẫn bảo quản..."
          placeholderTextColor="#94A3B8"
          value={form.garmentCare.specialNotes ?? ''}
          onChangeText={(v) =>
            setForm((p) => ({
              ...p,
              garmentCare: { ...p.garmentCare, specialNotes: v },
            }))
          }
        />

        {/* Mục 2: Trả trễ */}
        <Text style={styles.sectionHeading}>2. Quy định trả trễ & Ân hạn</Text>
        <View style={styles.grid2}>
          <NumberField
            label="Ân hạn miễn phí (giờ)"
            value={form.lateReturn.gracePeriodHours}
            editable={!isLockedPending}
            onChange={(n) =>
              setForm((p) => ({
                ...p,
                lateReturn: { ...p.lateReturn, gracePeriodHours: n },
              }))
            }
          />
          <NumberField
            label="Trễ tối đa (ngày)"
            value={form.lateReturn.maxLateDaysAllowed}
            editable={!isLockedPending}
            onChange={(n) =>
              setForm((p) => ({
                ...p,
                lateReturn: { ...p.lateReturn, maxLateDaysAllowed: Math.max(1, n) },
              }))
            }
          />
        </View>
        <View style={styles.grid2}>
          <NumberField
            label="Phí trễ mỗi giờ (đ)"
            value={form.lateReturn.hourlyLateFee}
            editable={!isLockedPending}
            onChange={(n) =>
              setForm((p) => ({
                ...p,
                lateReturn: { ...p.lateReturn, hourlyLateFee: n },
              }))
            }
          />
          <NumberField
            label="Phí trễ mỗi ngày (đ)"
            value={form.lateReturn.dailyLateFee}
            editable={!isLockedPending}
            onChange={(n) =>
              setForm((p) => ({
                ...p,
                lateReturn: { ...p.lateReturn, dailyLateFee: n },
              }))
            }
          />
        </View>

        {/* Mục 3: Bồi thường 4 cấp độ */}
        <Text style={styles.sectionHeading}>
          3. Quy định Bồi thường Sự cố (4 cấp độ)
        </Text>
        {needsAssetValue && (
          <View style={styles.alertWarn}>
            <Ionicons name="information-circle-outline" size={17} color="#92400E" />
            <Text style={styles.warnSmallText}>
              Chính sách có mức dùng "% Giá trị áo". Sau khi lưu/duyệt, hãy vào
              từng mẫu áo dài (nút Sửa trên danh sách sản phẩm) để nhập "Giá trị
              bồi hoàn (VNĐ)".
            </Text>
          </View>
        )}

        {TIER_DEFINITIONS.map((tierDef) => {
          const tierRule = form.damageCompensation[tierDef.key];
          const method = tierRule?.method ?? 'INCIDENT_NEGOTIATION';
          return (
            <View key={tierDef.key} style={styles.tierBox}>
              <Text style={styles.tierTitle}>{tierDef.title}</Text>
              <Text style={styles.tierHint}>{tierDef.hint}</Text>

              <View style={styles.chipsWrap}>
                {METHOD_OPTIONS.map((opt) => {
                  const selected = method === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      disabled={isLockedPending}
                      style={[
                        styles.methodChip,
                        selected && styles.methodChipSelected,
                      ]}
                      onPress={() =>
                        updateTier(tierDef.key, {
                          method: opt.value,
                          fixedFeeAmount:
                            opt.value === 'FIXED_FEE'
                              ? (tierRule?.fixedFeeAmount ?? 50000)
                              : null,
                          percentageOfAsset:
                            opt.value === 'PERCENTAGE_ON_ASSET'
                              ? (tierRule?.percentageOfAsset ?? 30)
                              : null,
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.methodChipText,
                          selected && styles.methodChipTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {method === 'FIXED_FEE' && (
                <NumberField
                  label="Số tiền phạt cố định (VNĐ)"
                  value={tierRule?.fixedFeeAmount ?? 0}
                  editable={!isLockedPending}
                  onChange={(n) =>
                    updateTier(tierDef.key, { fixedFeeAmount: n })
                  }
                />
              )}

              {method === 'PERCENTAGE_ON_ASSET' && (
                <NumberField
                  label="Tỷ lệ trên giá trị bồi hoàn (%)"
                  value={tierRule?.percentageOfAsset ?? 20}
                  editable={!isLockedPending}
                  onChange={(n) =>
                    updateTier(tierDef.key, {
                      percentageOfAsset: Math.min(100, Math.max(1, n || 1)),
                    })
                  }
                />
              )}

              <Text style={styles.fieldLabel}>
                Căn cứ & chứng từ xác minh{' '}
                {(method === 'ACTUAL_REPAIR_COST' ||
                  method === 'INCIDENT_NEGOTIATION') &&
                  '*'}
              </Text>
              <TextInput
                style={styles.input}
                editable={!isLockedPending}
                placeholder="Mô tả căn cứ đối chiếu (tối thiểu 5 ký tự)..."
                placeholderTextColor="#94A3B8"
                value={tierRule?.conditionsAndEvidence ?? ''}
                onChangeText={(v) =>
                  updateTier(tierDef.key, { conditionsAndEvidence: v })
                }
              />
            </View>
          );
        })}

        <NumberField
          label="Thời hạn thông báo sự cố sau khi nhận đồ (giờ)"
          value={form.damageCompensation.incidentNotificationHours ?? 24}
          editable={!isLockedPending}
          onChange={(n) =>
            setForm((p) => ({
              ...p,
              damageCompensation: {
                ...p.damageCompensation,
                incidentNotificationHours: Math.max(1, n),
              },
            }))
          }
        />

        <View style={styles.labelWithAction}>
          <Text style={styles.fieldLabel}>Điều khoản giải quyết tranh chấp</Text>
          {!isLockedPending && (
            <Pressable
              onPress={() =>
                setForm((p) => ({
                  ...p,
                  damageCompensation: {
                    ...p.damageCompensation,
                    disputeResolutionTerms: STANDARD_DISPUTE_RESOLUTION_CLAUSE,
                  },
                }))
              }
            >
              <Text style={styles.linkActionText}>Dùng mẫu chuẩn sàn</Text>
            </Pressable>
          )}
        </View>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          editable={!isLockedPending}
          placeholder={STANDARD_DISPUTE_RESOLUTION_CLAUSE}
          placeholderTextColor="#94A3B8"
          value={form.damageCompensation.disputeResolutionTerms ?? ''}
          onChangeText={(v) =>
            setForm((p) => ({
              ...p,
              damageCompensation: {
                ...p.damageCompensation,
                disputeResolutionTerms: v,
              },
            }))
          }
        />

        {/* Mục 4: Hủy đơn & Hoàn cọc */}
        <Text style={styles.sectionHeading}>4. Chính sách Hủy thuê & Hoàn tiền</Text>
        {form.cancellationPolicy.refundRules.map((rule, idx) => (
          <View key={idx} style={styles.cancelRuleRow}>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Trước ngày thuê (ngày)"
                value={rule.daysBeforeRental}
                editable={!isLockedPending}
                onChange={(n) =>
                  setForm((p) => ({
                    ...p,
                    cancellationPolicy: {
                      ...p.cancellationPolicy,
                      refundRules: p.cancellationPolicy.refundRules.map((r, i) =>
                        i === idx ? { ...r, daysBeforeRental: n } : r,
                      ),
                    },
                  }))
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Hoàn tiền thuê (%)"
                value={rule.refundPercentage}
                editable={!isLockedPending}
                onChange={(n) =>
                  setForm((p) => ({
                    ...p,
                    cancellationPolicy: {
                      ...p.cancellationPolicy,
                      refundRules: p.cancellationPolicy.refundRules.map((r, i) =>
                        i === idx
                          ? { ...r, refundPercentage: Math.min(100, n) }
                          : r,
                      ),
                    },
                  }))
                }
              />
            </View>
            {!isLockedPending && form.cancellationPolicy.refundRules.length > 1 && (
              <Pressable
                style={styles.removeRuleBtn}
                onPress={() =>
                  setForm((p) => ({
                    ...p,
                    cancellationPolicy: {
                      ...p.cancellationPolicy,
                      refundRules: p.cancellationPolicy.refundRules.filter(
                        (_, i) => i !== idx,
                      ),
                    },
                  }))
                }
              >
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
              </Pressable>
            )}
          </View>
        ))}

        {!isLockedPending && (
          <Pressable
            style={styles.addRuleBtn}
            onPress={() =>
              setForm((p) => ({
                ...p,
                cancellationPolicy: {
                  ...p.cancellationPolicy,
                  refundRules: [
                    ...p.cancellationPolicy.refundRules,
                    { daysBeforeRental: 2, refundPercentage: 50 },
                  ],
                },
              }))
            }
          >
            <Ionicons name="add-circle-outline" size={16} color="#BA0049" />
            <Text style={styles.addRuleText}>Thêm mốc hủy đơn</Text>
          </Pressable>
        )}

        <Text style={styles.fieldLabel}>Ghi chú chính sách hủy</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          editable={!isLockedPending}
          placeholder="VD: Tiền cọc hoàn 100% nếu hủy trước khi nhận đồ..."
          placeholderTextColor="#94A3B8"
          value={form.cancellationPolicy.cancellationNotes ?? ''}
          onChangeText={(v) =>
            setForm((p) => ({
              ...p,
              cancellationPolicy: {
                ...p.cancellationPolicy,
                cancellationNotes: v,
              },
            }))
          }
        />

        {/* Mục 5: Hỗ trợ & Điều khoản riêng */}
        <Text style={styles.sectionHeading}>
          5. Thông tin Hỗ trợ & Điều khoản riêng
        </Text>
        <View style={styles.grid2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Hotline hỗ trợ *</Text>
            <TextInput
              style={styles.input}
              editable={!isLockedPending}
              keyboardType="phone-pad"
              placeholder="0901234567"
              placeholderTextColor="#94A3B8"
              value={form.supportContact.hotline}
              onChangeText={(v) =>
                setForm((p) => ({
                  ...p,
                  supportContact: { ...p.supportContact, hotline: v },
                }))
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Khung giờ hỗ trợ *</Text>
            <TextInput
              style={styles.input}
              editable={!isLockedPending}
              placeholder="08:00 - 21:00"
              placeholderTextColor="#94A3B8"
              value={form.supportContact.supportWorkingHours}
              onChangeText={(v) =>
                setForm((p) => ({
                  ...p,
                  supportContact: { ...p.supportContact, supportWorkingHours: v },
                }))
              }
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Điều khoản riêng của Shop (tối đa 1000 ký tự)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          editable={!isLockedPending}
          placeholder={DEFAULT_PROVIDER_POLICY_PAYLOAD.customTermsText ?? ''}
          placeholderTextColor="#94A3B8"
          value={form.customTermsText ?? ''}
          onChangeText={(v) => setForm((p) => ({ ...p, customTermsText: v }))}
        />

        {!isLockedPending && (
          <View style={styles.policySubmitRow}>
            <Pressable
              style={[styles.secondaryBtn, savingDraft && { opacity: 0.7 }]}
              disabled={savingDraft || submittingPolicy}
              onPress={() => void handleSaveDraft()}
            >
              {savingDraft ? (
                <ActivityIndicator size="small" color="#BA0049" />
              ) : (
                <Text style={styles.secondaryBtnText}>Lưu nháp</Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.primaryBtn, { flex: 1.4 }, submittingPolicy && { opacity: 0.7 }]}
              disabled={savingDraft || submittingPolicy}
              onPress={() => void handleSubmitPolicy()}
            >
              {submittingPolicy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={15} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Gửi Admin duyệt</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* CARD 3: CẤU HÌNH NGƯỠNG HIỂN THỊ HỢP ĐỒNG */}
      <View style={styles.card}>
        <Text style={styles.eyebrow}>TRẢI NGHIỆM KÝ CỦA KHÁCH</Text>
        <Text style={styles.cardTitle}>Chế độ Hợp đồng (Nhanh / Đầy đủ)</Text>
        {contractConfig && (
          <Text style={styles.metaText}>
            Đang áp dụng: {contractConfig.contractMode}
            {contractConfig.contractMode === 'CUSTOM_ORDER_THRESHOLD' &&
            typeof contractConfig.orderThresholdAmount === 'number'
              ? ` · Ngưỡng ${contractConfig.orderThresholdAmount.toLocaleString('vi-VN')}đ`
              : ''}
          </Text>
        )}

        <View style={{ gap: 8, marginTop: 8 }}>
          {MODE_OPTIONS.map((opt) => {
            const active = contractMode === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.modeCard, active && styles.modeCardActive]}
                onPress={() => setContractMode(opt.value)}
              >
                <View style={styles.modeTitleRow}>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={17}
                    color={active ? '#BA0049' : '#94A3B8'}
                  />
                  <Text style={[styles.modeTitle, active && { color: '#BA0049' }]}>
                    {opt.title}
                  </Text>
                </View>
                <Text style={styles.modeDesc}>{opt.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        {contractMode === 'CUSTOM_ORDER_THRESHOLD' && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.fieldLabel}>
              Ngưỡng giá trị đơn hàng áp dụng bản Đầy đủ (VNĐ)
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={thresholdInput}
              onChangeText={setThresholdInput}
              placeholder="VD: 500000"
              placeholderTextColor="#94A3B8"
            />
          </View>
        )}

        <Pressable
          style={[styles.primaryBtn, { marginTop: 12 }, savingConfig && { opacity: 0.7 }]}
          disabled={savingConfig}
          onPress={() => void handleSaveConfig()}
        >
          {savingConfig ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Lưu chế độ hiển thị</Text>
          )}
        </Pressable>
      </View>

      <ProviderAcceptanceModal
        visible={acceptModalVisible}
        mechanism={mechanism}
        hasApprovedPolicy={hasApprovedPolicy}
        submitting={acceptSubmitting}
        onClose={() => setAcceptModalVisible(false)}
        onConfirmAccept={handleAcceptMechanism}
      />

      <ProviderPolicyHistoryModal
        visible={historyVisible}
        loading={historyLoading}
        versions={historyVersions}
        onClose={() => setHistoryVisible(false)}
      />
    </View>
  );
}

function StepLine({ done, text }: { done: boolean; text: string }) {
  return (
    <View style={styles.stepRow}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={done ? '#059669' : '#94A3B8'}
      />
      <Text style={[styles.stepText, done && styles.stepTextDone]}>{text}</Text>
    </View>
  );
}

function NumberField({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: number;
  editable: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        editable={editable}
        keyboardType="numeric"
        value={String(Number.isFinite(value) ? value : 0)}
        onChangeText={(txt) => {
          const digits = txt.replace(/[^0-9]/g, '');
          onChange(digits ? parseInt(digits, 10) : 0);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14,
    paddingBottom: 20,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: FontFamily.bodyMedium,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
    letterSpacing: 0.6,
  },
  cardTitle: {
    fontSize: 15.5,
    fontFamily: FontFamily.display,
    color: '#1B1C1C',
    marginTop: 2,
  },
  stepsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#475569',
  },
  stepTextDone: {
    fontFamily: FontFamily.bodySemiBold,
    color: '#065F46',
  },
  activeMetaBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  metaText: {
    fontSize: 11.5,
    fontFamily: FontFamily.bodyMedium,
    color: '#475569',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  infoBanner: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
  },
  infoBannerText: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#334155',
    lineHeight: 17,
  },
  alertWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  warnSmallText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: FontFamily.bodyMedium,
    color: '#92400E',
    lineHeight: 16,
  },
  alertError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  alertErrorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: '#991B1B',
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FFF1F5',
  },
  historyBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemiBold,
    color: '#BA0049',
  },
  sectionHeading: {
    fontSize: 13.5,
    fontFamily: FontFamily.bodyBold,
    color: '#1E293B',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  switchLabel: {
    fontSize: 12.5,
    fontFamily: FontFamily.bodyMedium,
    color: '#334155',
  },
  fieldLabel: {
    fontSize: 11.5,
    fontFamily: FontFamily.bodySemiBold,
    color: '#475569',
    marginBottom: 4,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 13,
    fontFamily: FontFamily.body,
    color: '#1B1C1C',
  },
  textArea: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagChipText: {
    fontSize: 11.5,
    fontFamily: FontFamily.bodyMedium,
    color: '#9F1239',
  },
  inlineAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  smallAddBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B',
  },
  smallAddBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },
  grid2: {
    flexDirection: 'row',
    gap: 10,
  },
  tierBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  tierTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  tierHint: {
    fontSize: 11.5,
    fontFamily: FontFamily.body,
    color: '#64748B',
    marginBottom: 4,
  },
  methodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  methodChipSelected: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  methodChipText: {
    fontSize: 11.5,
    fontFamily: FontFamily.bodyMedium,
    color: '#475569',
  },
  methodChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bodySemiBold,
  },
  labelWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  linkActionText: {
    fontSize: 11.5,
    fontFamily: FontFamily.bodySemiBold,
    color: '#BA0049',
  },
  cancelRuleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  removeRuleBtn: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  addRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addRuleText: {
    fontSize: 12.5,
    fontFamily: FontFamily.bodySemiBold,
    color: '#BA0049',
  },
  policySubmitRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#BA0049',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#BA0049',
    backgroundColor: '#FFF1F5',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  dangerOutlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  dangerOutlineText: {
    fontSize: 12.5,
    fontFamily: FontFamily.bodySemiBold,
    color: '#B91C1C',
  },
  modeCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  modeCardActive: {
    borderColor: '#BA0049',
    backgroundColor: '#FFF1F5',
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1E293B',
  },
  modeDesc: {
    fontSize: 11.5,
    fontFamily: FontFamily.body,
    color: '#64748B',
    paddingLeft: 25,
    lineHeight: 16,
  },
});
