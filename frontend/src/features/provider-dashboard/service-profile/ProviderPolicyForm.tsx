import React, { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Send,
  HelpCircle,
  FileCheck,
  Ban,
  History,
  Eye,
  X,
} from 'lucide-react';
import { CONTRACTS_V2_ENABLED } from '../../../config/features';
import { translateError } from '../../../utils/errorTranslator';
import {
  contractService,
  resolveDamageCompensationRules,
  type CurrentPolicyResponse,
  type SavePolicyPayload,
  type TierCompensationRule,
  type ProviderContractPolicyVersion,
} from '../../../services/contractService';
import { validateDisputeResolutionClause } from './disputeTermsGuardrail';

const DEFAULT_POLICY: SavePolicyPayload = {
  garmentCare: {
    allowIroning: true,
    allowWashing: false,
    prohibitedActions: [
      'Xịt nước hoa trực tiếp lên tơ tằm',
      'Dùng kim băng kim loại làm tưa lụa',
      'Tự ý cắt chỉ hoặc sửa chữa phom dáng',
    ],
    specialNotes: 'Bảo quản nơi khô ráo, tránh ánh nắng trực tiếp.',
  },
  lateReturn: {
    gracePeriodHours: 2,
    hourlyLateFee: 30000,
    dailyLateFee: 150000,
    maxLateDaysAllowed: 3,
  },
  damageCompensation: {
    minorDamage: {
      method: 'FIXED_FEE',
      fixedFeeAmount: 50000,
      percentageOfAsset: null,
      conditionsAndEvidence: 'Vết bẩn giặt tẩy được, sút đường chỉ nhẹ, tuột cúc.',
    },
    moderateDamage: {
      method: 'ACTUAL_REPAIR_COST',
      fixedFeeAmount: null,
      percentageOfAsset: null,
      conditionsAndEvidence: 'Rách đường may, ố màu có thể phục hồi theo hóa đơn giặt hấp/may vá chuyên dụng.',
    },
    severeDamage: {
      method: 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: null,
      percentageOfAsset: null,
      conditionsAndEvidence: 'Rách lớn, biến dạng phom dáng; hai bên đối chiếu ảnh giao nhận và thương lượng.',
    },
    totalLoss: {
      method: 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: null,
      percentageOfAsset: null,
      conditionsAndEvidence: 'Mất trang phục hoặc rách nát hoàn toàn không thể phục hồi; hai bên đối chiếu hình ảnh giao nhận và thương lượng bồi thường.',
    },
    incidentNotificationHours: 24,
    disputeResolutionTerms: null,
    minorDamageFee: 50000,
    moderateDamagePercent: 20,
    severeDamageOrLossPercent: 100,
    disputeResolutionNotes: null,
  },
  cancellationPolicy: {
    refundRules: [
      { daysBeforeRental: 3, refundPercentage: 100 },
      { daysBeforeRental: 1, refundPercentage: 50 },
      { daysBeforeRental: 0, refundPercentage: 0 },
    ],
    cancellationNotes: 'Tiền cọc luôn hoàn 100% nếu hủy trước khi nhận đồ. Phí hủy chỉ tính trên tiền thuê.',
  },
  supportContact: {
    hotline: '',
    supportWorkingHours: '08:00 - 21:00',
    contactNote: 'Hỗ trợ đổi size trong vòng 2 giờ sau khi nhận đồ.',
  },
  customTermsText: 'Khách hàng vui lòng đồng kiểm trang phục khi nhận hàng.',
};

export const ProviderPolicyForm: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(CONTRACTS_V2_ENABLED);
  const [currentPolicyData, setCurrentPolicyData] = useState<CurrentPolicyResponse | null>(null);
  const [formData, setFormData] = useState<SavePolicyPayload>(DEFAULT_POLICY);

  const [saving, setSaving] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [newProhibitedAction, setNewProhibitedAction] = useState<string>('');
  const [disputeMode, setDisputeMode] = useState<string>('custom');

  // Policy Version History States
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyVersions, setHistoryVersions] = useState<ProviderContractPolicyVersion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<ProviderContractPolicyVersion | null>(null);

  const handleOpenHistoryModal = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const versions = await contractService.getProviderPolicyVersions();
      setHistoryVersions(versions || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách phiên bản lịch sử.';
      setHistoryError(msg);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadPolicy = useCallback(async () => {
    if (!CONTRACTS_V2_ENABLED) return;
    try {
      setErrorMsg(null);
      const res = await contractService.getProviderCurrentPolicy();
      setCurrentPolicyData(res);

      // Pre-fill form from draft, pending, or active policy
      const latest = res.draft || res.pending || res.active;
      if (latest) {
        const resolvedComp = resolveDamageCompensationRules(latest.damageCompensation);
        const toCleanTier = (rule: any): TierCompensationRule => ({
          method: rule?.method || 'INCIDENT_NEGOTIATION',
          fixedFeeAmount: typeof rule?.fixedFeeAmount === 'number' ? rule.fixedFeeAmount : null,
          percentageOfAsset: typeof rule?.percentageOfAsset === 'number' ? rule.percentageOfAsset : null,
          conditionsAndEvidence: rule?.conditionsAndEvidence ?? '',
        });

        setFormData({
          garmentCare: latest.garmentCare || DEFAULT_POLICY.garmentCare,
          lateReturn: latest.lateReturn || DEFAULT_POLICY.lateReturn,
          damageCompensation: {
            minorDamage: toCleanTier(latest.damageCompensation?.minorDamage || resolvedComp.minorDamage),
            moderateDamage: toCleanTier(latest.damageCompensation?.moderateDamage || resolvedComp.moderateDamage),
            severeDamage: toCleanTier(latest.damageCompensation?.severeDamage || resolvedComp.severeDamage),
            totalLoss: toCleanTier(latest.damageCompensation?.totalLoss || resolvedComp.totalLoss),
            incidentNotificationHours:
              latest.damageCompensation?.incidentNotificationHours ?? resolvedComp.incidentNotificationHours ?? 24,
            disputeResolutionTerms:
              latest.damageCompensation?.disputeResolutionTerms ??
              resolvedComp.disputeResolutionTerms ??
              null,
            minorDamageFee: latest.damageCompensation?.minorDamageFee ?? null,
            moderateDamagePercent: latest.damageCompensation?.moderateDamagePercent ?? null,
            severeDamageOrLossPercent: latest.damageCompensation?.severeDamageOrLossPercent ?? null,
            disputeResolutionNotes: latest.damageCompensation?.disputeResolutionNotes ?? null,
          },
          cancellationPolicy: latest.cancellationPolicy || DEFAULT_POLICY.cancellationPolicy,
          supportContact: latest.supportContact || DEFAULT_POLICY.supportContact,
          customTermsText: latest.customTermsText ?? '',
        });

        const existingDispute = (
          latest.damageCompensation?.disputeResolutionTerms ||
          latest.damageCompensation?.disputeResolutionNotes ||
          ''
        ).trim();
        if (existingDispute === 'Đối chiếu chứng cứ giao nhận và thương lượng.') {
          setDisputeMode('sample_1');
        } else if (existingDispute === 'Thương lượng thiện chí và VibeHue hỗ trợ hòa giải trung gian.') {
          setDisputeMode('sample_2');
        } else if (existingDispute === 'Đối chiếu hình ảnh, biên bản và chứng từ nếu có; mức bồi thường vẫn theo phương thức đã duyệt.') {
          setDisputeMode('sample_3');
        } else {
          setDisputeMode('custom');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải chính sách của shop.';
      setErrorMsg(translateError(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  if (!CONTRACTS_V2_ENABLED) {
    return null;
  }

  const latestVersion =
    currentPolicyData?.draft || currentPolicyData?.pending || currentPolicyData?.active;
  const isPendingReview = latestVersion?.status === 'PENDING_REVIEW';
  const isApproved = latestVersion?.status === 'APPROVED';
  const isRejected = latestVersion?.status === 'REJECTED';
  const isDraft = !latestVersion || latestVersion.status === 'DRAFT';

  // Add prohibited action tag
  const handleAddProhibitedAction = () => {
    const trimmed = newProhibitedAction.trim();
    if (!trimmed) return;
    if (trimmed.length < 5) {
      setErrorMsg('Hành vi cấm phải có ít nhất 5 ký tự mô tả cụ thể (ví dụ: Ăn uống làm vấy bẩn trang phục).');
      return;
    }
    if (formData.garmentCare.prohibitedActions.includes(trimmed)) return;
    setErrorMsg(null);
    setFormData((prev) => ({
      ...prev,
      garmentCare: {
        ...prev.garmentCare,
        prohibitedActions: [...prev.garmentCare.prohibitedActions, trimmed],
      },
    }));
    setNewProhibitedAction('');
  };

  const handleRemoveProhibitedAction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      garmentCare: {
        ...prev.garmentCare,
        prohibitedActions: prev.garmentCare.prohibitedActions.filter((_, i) => i !== index),
      },
    }));
  };

  // Client validation
  const validateForm = (isSubmitting: boolean = false): string | null => {
    if (!formData.supportContact.hotline.trim()) {
      return 'Vui lòng nhập số Hotline hỗ trợ khách hàng.';
    }
    if (formData.lateReturn.gracePeriodHours < 0 || formData.lateReturn.gracePeriodHours > 6) {
      return 'Thời gian ân hạn trễ phải từ 0 đến 6 giờ.';
    }
    if (formData.lateReturn.hourlyLateFee < 0 || formData.lateReturn.hourlyLateFee > 50000) {
      return 'Phí trễ mỗi giờ tối đa 50.000đ/giờ.';
    }
    if (formData.lateReturn.dailyLateFee < 0 || formData.lateReturn.dailyLateFee > 200000) {
      return 'Phí trễ mỗi ngày tối đa 200.000đ/ngày.';
    }

    const { minorDamage, moderateDamage, severeDamage, totalLoss, incidentNotificationHours } =
      formData.damageCompensation;

    if (
      incidentNotificationHours !== null &&
      incidentNotificationHours !== undefined &&
      incidentNotificationHours < 1
    ) {
      return 'Thời hạn thông báo sự cố phải từ 1 giờ trở lên.';
    }

    if (isSubmitting) {
      const tiers: Array<{ name: string; rule?: TierCompensationRule | null }> = [
        { name: 'Hư hỏng nhẹ', rule: minorDamage },
        { name: 'Hư hỏng vừa', rule: moderateDamage },
        { name: 'Hư hỏng nặng', rule: severeDamage },
        { name: 'Mất trang phục', rule: totalLoss },
      ];

      for (const t of tiers) {
        if (!t.rule || !t.rule.method) {
          return `Vui lòng chọn phương thức bồi thường cho mục '${t.name}'.`;
        }
        if (t.rule.method === 'FIXED_FEE') {
          if (
            t.rule.fixedFeeAmount === null ||
            t.rule.fixedFeeAmount === undefined ||
            t.rule.fixedFeeAmount < 0
          ) {
            return `Vui lòng nhập mức phí cố định hợp lệ cho mục '${t.name}'.`;
          }
        } else if (t.rule.method === 'PERCENTAGE_ON_ASSET') {
          if (
            t.rule.percentageOfAsset === null ||
            t.rule.percentageOfAsset === undefined ||
            t.rule.percentageOfAsset < 1 ||
            t.rule.percentageOfAsset > 100
          ) {
            return `Tỷ lệ bồi thường cho mục '${t.name}' phải từ 1% đến 100%.`;
          }
        } else if (
          t.rule.method === 'ACTUAL_REPAIR_COST' ||
          t.rule.method === 'INCIDENT_NEGOTIATION'
        ) {
          if (!t.rule.conditionsAndEvidence || t.rule.conditionsAndEvidence.trim().length < 5) {
            return `Vui lòng nêu rõ căn cứ và chứng từ xác minh cho mục '${t.name}'.`;
          }
        }
      }
      const disputeClause =
        formData.damageCompensation.disputeResolutionTerms ||
        formData.damageCompensation.disputeResolutionNotes;
      const disputeCheck = validateDisputeResolutionClause(disputeClause);
      if (!disputeCheck.isValid) {
        return `Vi phạm quy chế hòa giải: ${disputeCheck.errorMessage}`;
      }
    }

    return null;
  };

  const updateTier = (
    tierKey: 'minorDamage' | 'moderateDamage' | 'severeDamage' | 'totalLoss',
    patch: Partial<TierCompensationRule>,
  ) => {
    setFormData((prev) => {
      const currentTier = prev.damageCompensation[tierKey] || {
        method: 'INCIDENT_NEGOTIATION',
        fixedFeeAmount: null,
        percentageOfAsset: null,
        conditionsAndEvidence: '',
      };
      return {
        ...prev,
        damageCompensation: {
          ...prev.damageCompensation,
          [tierKey]: {
            ...currentTier,
            ...patch,
          },
        },
      };
    });
  };

  // Handle Save Draft
  const handleSaveDraft = async () => {
    const error = validateForm(false);
    if (error) {
      setErrorMsg(error);
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await contractService.saveProviderPolicyDraft(formData);
      setSuccessMsg('Đã lưu bản thảo chính sách thành công!');
      await loadPolicy();
    } catch (err: unknown) {
      setErrorMsg(translateError(err instanceof Error ? err.message : 'Lưu bản thảo thất bại.'));
    } finally {
      setSaving(false);
    }
  };

  // Handle Submit for Review
  const handleSubmitReview = async () => {
    const error = validateForm(true);
    if (error) {
      setErrorMsg(error);
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await contractService.submitProviderPolicyForReview(formData);
      setSuccessMsg('Đã gửi chính sách lên Ban Quản trị Sàn VibeHue để kiểm duyệt!');
      await loadPolicy();
    } catch (err: unknown) {
      setErrorMsg(translateError(err instanceof Error ? err.message : 'Gửi duyệt chính sách thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 text-center text-stone-400 text-sm flex items-center justify-center gap-2">
        <Loader2 size={16} className="animate-spin text-amber-600" />
        Đang tải thông tin chính sách hợp đồng…
      </div>
    );
  }

  const renderTierCard = (
    tierKey: 'minorDamage' | 'moderateDamage' | 'severeDamage' | 'totalLoss',
    tierLabel: string,
    tierSublabel: string,
    suggestions: string[],
  ) => {
    const tier = formData.damageCompensation[tierKey] || {
      method: 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: null,
      percentageOfAsset: null,
      conditionsAndEvidence: '',
    };

    return (
      <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-stone-100">
          <div>
            <span className="font-bold text-stone-800 text-xs block">{tierLabel}</span>
            <span className="text-[11px] text-stone-500">{tierSublabel}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                { id: 'FIXED_FEE', label: 'Phí cố định' },
                { id: 'PERCENTAGE_ON_ASSET', label: '% Giá trị' },
                { id: 'ACTUAL_REPAIR_COST', label: 'Chi phí thực tế' },
                { id: 'INCIDENT_NEGOTIATION', label: 'Thương lượng' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => updateTier(tierKey, { method: m.id })}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  tier.method === m.id
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input fields according to method */}
        {tier.method === 'FIXED_FEE' && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-stone-700 block">
              Mức phí bồi thường cố định (VNĐ):
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="5000"
                value={tier.fixedFeeAmount ?? ''}
                onChange={(e) =>
                  updateTier(tierKey, {
                    fixedFeeAmount: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0,
                  })
                }
                placeholder="Ví dụ: 50000"
                className="w-full px-2.5 py-1.5 border border-stone-300 rounded-md font-mono text-xs"
              />
              <span className="absolute right-2.5 top-1.5 text-xs text-stone-400">đ/lỗi</span>
            </div>
          </div>
        )}

        {tier.method === 'PERCENTAGE_ON_ASSET' && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-stone-700 block">
              Tỷ lệ bồi thường (% trên giá trị bồi hoàn đã duyệt):
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="100"
                value={tier.percentageOfAsset ?? ''}
                onChange={(e) =>
                  updateTier(tierKey, {
                    percentageOfAsset: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0,
                  })
                }
                placeholder="1 - 100"
                className="w-full px-2.5 py-1.5 border border-stone-300 rounded-md font-mono text-xs"
              />
              <span className="absolute right-2.5 top-1.5 text-xs text-stone-400">%</span>
            </div>
            <p className="text-[10px] text-amber-700">
              * Lưu ý: Áp dụng trên giá trị bồi hoàn đã chốt của trang phục trong đơn hàng.
            </p>
          </div>
        )}

        {tier.method === 'ACTUAL_REPAIR_COST' && (
          <div className="p-2 rounded bg-amber-50/60 border border-amber-200/70 text-[11px] text-amber-900">
            ✓ Bồi thường theo chi phí phục hồi/giặt sửa thực tế có hóa đơn/biên lai từ đơn vị chuyên nghiệp.
          </div>
        )}

        {tier.method === 'INCIDENT_NEGOTIATION' && (
          <div className="p-2 rounded bg-stone-100 border border-stone-200 text-[11px] text-stone-700">
            ✓ Hai bên tự đối chiếu hình ảnh/video khi giao và trả đồ để thỏa thuận mức bồi thường phù hợp.
          </div>
        )}

        {/* Conditions and Evidence input */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-stone-700 block">
            Căn cứ xác định sự cố & chứng từ cần cung cấp:
          </label>
          <input
            type="text"
            value={tier.conditionsAndEvidence ?? ''}
            onChange={(e) => updateTier(tierKey, { conditionsAndEvidence: e.target.value })}
            placeholder="Mô tả cụ thể căn cứ xác định sự cố..."
            className="w-full px-2.5 py-1.5 border border-stone-300 rounded-md text-xs"
          />
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              <span className="text-[10px] text-stone-400 mr-1 self-center">Gợi ý:</span>
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => updateTier(tierKey, { conditionsAndEvidence: s })}
                  className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-amber-100 text-[10px] text-stone-600 hover:text-amber-900 border border-stone-200"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="provider-policy-form mt-6 bg-white border border-stone-200 rounded-xl p-6 shadow-xs space-y-6"
      data-testid="provider-policy-form"
    >
      {/* Form Header & Lifecycle Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <FileCheck size={20} className="text-amber-800" />
            Quản lý Chính sách Hợp đồng Thuê Áo dài
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Thiết lập 4 nhóm quy chuẩn: Bảo quản áo dài, Trả trễ, Hư hỏng/Mất áo dài, Hủy thuê & Hoàn cọc.
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isApproved && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"
              data-testid="policy-status-approved"
            >
              <CheckCircle2 size={14} />
              ĐÃ DUYỆT (v{latestVersion?.versionNumber})
            </span>
          )}

          {isPendingReview && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300"
              data-testid="policy-status-pending"
            >
              <Clock size={14} />
              CHỜ DUYỆT (v{latestVersion?.versionNumber})
            </span>
          )}

          {isRejected && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300"
              data-testid="policy-status-rejected"
            >
              <XCircle size={14} />
              BỊ TỪ CHỐI (v{latestVersion?.versionNumber})
            </span>
          )}

          {isDraft && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-300"
              data-testid="policy-status-draft"
            >
              <Save size={14} />
              BẢN NHÁP {latestVersion ? `(v${latestVersion.versionNumber})` : ''}
            </span>
          )}

          <button
            type="button"
            onClick={handleOpenHistoryModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 transition-colors shadow-2xs cursor-pointer"
            data-testid="btn-policy-history"
            title="Xem toàn bộ lịch sử các phiên bản chính sách đã gửi hoặc phê duyệt"
          >
            <History size={14} className="text-amber-800" />
            <span>Lịch sử phiên bản</span>
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {isPendingReview && (
        <div className="p-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-0.5">Chính sách đang chờ Ban Quản trị Sàn duyệt:</strong>
            Phiên bản này đã được gửi lên ban điều hành VibeHue. Trong thời gian chờ duyệt, bạn vẫn có thể chỉnh sửa và lưu nháp phiên bản mới nhưng các booking hiện tại vẫn áp dụng theo chính sách đã được duyệt trước đó.
          </div>
        </div>
      )}

      {isRejected && latestVersion?.reviewNote && (
        <div className="p-3 text-xs text-rose-900 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5">
          <XCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-0.5">Lý do từ chối từ Ban Quản trị:</strong>
            {latestVersion.reviewNote}
          </div>
        </div>
      )}

      {/* FORM BODY: 4 CORE GROUPS */}
      <div className="space-y-6 text-xs text-stone-800">
        {/* GROUP 1: BẢO QUẢN ÁO DÀI */}
        <section className="bg-stone-50/70 p-4 rounded-xl border border-stone-200 space-y-3">
          <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 text-xs flex items-center justify-center font-bold">
              1
            </span>
            Quy định Bảo quản Áo dài (Garment Care)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer bg-white p-3 rounded-lg border border-stone-200">
              <input
                type="checkbox"
                checked={formData.garmentCare.allowIroning}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    garmentCare: { ...prev.garmentCare, allowIroning: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-stone-300 text-amber-800 focus:ring-amber-800"
              />
              <div>
                <span className="font-semibold block">Cho phép ủi / là nhiệt độ thấp</span>
                <span className="text-[11px] text-stone-500">Khách được dùng bàn ủi hơi nước ở nhiệt độ an toàn</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer bg-white p-3 rounded-lg border border-stone-200">
              <input
                type="checkbox"
                checked={formData.garmentCare.allowWashing}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    garmentCare: { ...prev.garmentCare, allowWashing: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-stone-300 text-amber-800 focus:ring-amber-800"
              />
              <div>
                <span className="font-semibold block">Khách tự giặt trước khi trả</span>
                <span className="text-[11px] text-stone-500">Mặc định: Không (Shop tự giặt hấp chuyên dụng)</span>
              </div>
            </label>
          </div>

          {/* Prohibited Actions */}
          <div className="space-y-2 pt-2">
            <label className="font-semibold text-stone-700 block">
              Các hành vi cấm đối với trang phục:
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.garmentCare.prohibitedActions.map((action, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-200 text-stone-800 text-[11px]"
                >
                  <Ban size={12} className="text-rose-600" />
                  {action}
                  <button
                    type="button"
                    onClick={() => handleRemoveProhibitedAction(idx)}
                    className="text-stone-400 hover:text-stone-700 ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newProhibitedAction}
                onChange={(e) => setNewProhibitedAction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddProhibitedAction();
                  }
                }}
                placeholder="Nhập hành vi cấm (ví dụ: xịt keo tóc, cắt chỉ...) rồi bấm Thêm"
                className="flex-1 px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
              />
              <button
                type="button"
                onClick={handleAddProhibitedAction}
                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold rounded-lg text-xs"
              >
                Thêm
              </button>
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">
              Ghi chú chất liệu đặc thù (Lụa tơ tằm, gấm thêu...):
            </label>
            <input
              type="text"
              value={formData.garmentCare.specialNotes || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  garmentCare: { ...prev.garmentCare, specialNotes: e.target.value },
                }))
              }
              placeholder="Ví dụ: Vải gấm tơ tằm nguyên bản, không giặt nước nóng."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
            />
          </div>
        </section>

        {/* GROUP 2: QUY ĐỊNH TRẢ TRỄ */}
        <section className="bg-stone-50/70 p-4 rounded-xl border border-stone-200 space-y-3">
          <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 text-xs flex items-center justify-center font-bold">
              2
            </span>
            Quy định Trả trễ & Phí phát sinh (Late Return)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <label className="text-stone-600 block mb-1 font-semibold">
                Giờ ân hạn không tính phí (0 - 6h)
              </label>
              <input
                type="number"
                min="0"
                max="6"
                value={formData.lateReturn.gracePeriodHours}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    lateReturn: {
                      ...prev.lateReturn,
                      gracePeriodHours: parseInt(e.target.value, 10) || 0,
                    },
                  }))
                }
                className="w-full px-2.5 py-1.5 border border-stone-300 rounded-md font-mono"
              />
              <span className="text-[10px] text-stone-400 block mt-1">Đề xuất: 2 giờ</span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <label className="text-stone-600 block mb-1 font-semibold">
                Phí trễ mỗi giờ (đ/h, tối đa 50k)
              </label>
              <input
                type="number"
                min="0"
                max="50000"
                step="5000"
                value={formData.lateReturn.hourlyLateFee}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    lateReturn: {
                      ...prev.lateReturn,
                      hourlyLateFee: parseInt(e.target.value, 10) || 0,
                    },
                  }))
                }
                className="w-full px-2.5 py-1.5 border border-stone-300 rounded-md font-mono"
              />
              <span className="text-[10px] text-stone-400 block mt-1">Guardrail: ≤ 50.000đ</span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <label className="text-stone-600 block mb-1 font-semibold">
                Phí trễ mỗi ngày (đ/ngày, tối đa 200k)
              </label>
              <input
                type="number"
                min="0"
                max="200000"
                step="10000"
                value={formData.lateReturn.dailyLateFee}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    lateReturn: {
                      ...prev.lateReturn,
                      dailyLateFee: parseInt(e.target.value, 10) || 0,
                    },
                  }))
                }
                className="w-full px-2.5 py-1.5 border border-stone-300 rounded-md font-mono"
              />
              <span className="text-[10px] text-stone-400 block mt-1">Guardrail: ≤ 200.000đ</span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <label className="text-stone-600 block mb-1 font-semibold">
                Số ngày trễ tối đa (1 - 7 ngày)
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={formData.lateReturn.maxLateDaysAllowed}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    lateReturn: {
                      ...prev.lateReturn,
                      maxLateDaysAllowed: parseInt(e.target.value, 10) || 1,
                    },
                  }))
                }
                className="w-full px-2.5 py-1.5 border border-stone-300 rounded-md font-mono"
              />
              <span className="text-[10px] text-stone-400 block mt-1">Sau mốc này tính là mất đồ</span>
            </div>
          </div>
        </section>

        {/* GROUP 3: HƯ HỎNG & BỒI THƯỜNG (4 CẤP ĐỘ ĐỘC LẬP) */}
        <section className="bg-stone-50/70 p-4 rounded-xl border border-stone-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 text-xs flex items-center justify-center font-bold">
                3
              </span>
              Quy định Bồi thường Hư hỏng & Mất đồ (4 Cấp độ độc lập)
            </h4>
            <span className="text-[11px] text-stone-500">
              Provider tự chọn phương thức bồi thường phù hợp cho từng loại sự cố
            </span>
          </div>

          <div className="space-y-3">
            {/* 1. Hư hỏng nhẹ */}
            {renderTierCard(
              'minorDamage',
              '1. Hư hỏng nhẹ',
              'Vết bẩn giặt tẩy được, sút đường may nhỏ, tuột cúc áo',
              [
                'Vết bẩn giặt tẩy được, sút chỉ nhẹ',
                'Hóa đơn giặt hấp ngoài thực tế',
                'Đối chiếu ảnh chụp lúc nhận/trả đồ',
              ],
            )}

            {/* 2. Hư hỏng vừa */}
            {renderTierCard(
              'moderateDamage',
              '2. Hư hỏng vừa',
              'Rách nhỏ dưới 5cm, ố màu cục bộ, hỏng khóa kéo có thể phục hồi',
              [
                'Chi phí sửa chữa/may vá theo hóa đơn thực tế',
                'Tỷ lệ 20% trên giá trị bồi hoàn đã duyệt',
                'Thương lượng mức bồi thường dựa trên biên bản',
              ],
            )}

            {/* 3. Hư hỏng nặng */}
            {renderTierCard(
              'severeDamage',
              '3. Hư hỏng nặng',
              'Rách vải lớn, biến dạng phom dáng, cháy xém hoặc biến dạng chất liệu',
              [
                'Đối chiếu hình ảnh lúc giao/nhận và thương lượng',
                'Chi phí phục hồi theo báo giá cơ sở phục chế',
                'Bồi thường theo tỷ lệ giá trị trang phục',
              ],
            )}

            {/* 4. Mất đồ */}
            {renderTierCard(
              'totalLoss',
              '4. Mất trang phục / Không thể phục hồi',
              'Trang phục không hoàn trả hoặc rách nát hoàn toàn không còn giá trị sử dụng',
              [
                'Bồi thường 100% giá trị bồi hoàn đã duyệt',
                'Thương lượng bồi thường căn cứ giá trị khấu hao',
              ],
            )}
          </div>

          {/* Timeframe & Dispute Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-stone-200">
            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <label className="text-stone-700 block mb-1 font-semibold text-xs">
                Thời hạn Shop kiểm tra & báo sự cố (giờ sau khi nhận đồ):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={formData.damageCompensation.incidentNotificationHours ?? 24}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      damageCompensation: {
                        ...prev.damageCompensation,
                        incidentNotificationHours: parseInt(e.target.value, 10) || 24,
                      },
                    }))
                  }
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-md font-mono text-xs"
                />
                <span className="absolute right-2.5 top-1.5 text-xs text-stone-400">giờ</span>
              </div>
              <span className="text-[10px] text-stone-400 block mt-1">
                Shop chủ động thiết lập (ví dụ: trong vòng 24h hoặc 48h kể từ lúc nhận lại áo)
              </span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-3">
              <label
                htmlFor="dispute-resolution-input"
                className="text-stone-800 block font-semibold text-xs"
              >
                Cơ chế giải quyết tranh chấp & hòa giải trung gian:
              </label>

              {/* 4 Lựa chọn theo yêu cầu: Mẫu 1, Mẫu 2, Mẫu 3, Khác */}
              <div className="space-y-2">
                {[
                  {
                    id: 'sample_1',
                    title: 'Mẫu 1',
                    text: 'Đối chiếu chứng cứ giao nhận và thương lượng.',
                  },
                  {
                    id: 'sample_2',
                    title: 'Mẫu 2',
                    text: 'Thương lượng thiện chí và VibeHue hỗ trợ hòa giải trung gian.',
                  },
                  {
                    id: 'sample_3',
                    title: 'Mẫu 3',
                    text: 'Đối chiếu hình ảnh, biên bản và chứng từ nếu có; mức bồi thường vẫn theo phương thức đã duyệt.',
                  },
                  {
                    id: 'custom',
                    title: 'Khác — Tự nhập điều khoản',
                    text: '',
                  },
                ].map((opt) => {
                  const currentText = (
                    formData.damageCompensation.disputeResolutionTerms ||
                    formData.damageCompensation.disputeResolutionNotes ||
                    ''
                  ).trim();

                  const isChecked =
                    opt.id === 'custom'
                      ? disputeMode === 'custom' ||
                        ![
                          'Đối chiếu chứng cứ giao nhận và thương lượng.',
                          'Thương lượng thiện chí và VibeHue hỗ trợ hòa giải trung gian.',
                          'Đối chiếu hình ảnh, biên bản và chứng từ nếu có; mức bồi thường vẫn theo phương thức đã duyệt.',
                        ].includes(currentText)
                      : currentText === opt.text;

                  return (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                        isChecked
                          ? 'border-amber-500 bg-amber-50/60 text-stone-900 font-medium shadow-xs'
                          : 'border-stone-200 bg-stone-50/50 text-stone-700 hover:bg-stone-100/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="dispute-resolution-choice"
                        checked={isChecked}
                        onChange={() => {
                          if (opt.id === 'custom') {
                            setDisputeMode('custom');
                          } else {
                            setDisputeMode(opt.id);
                            setFormData((prev) => ({
                              ...prev,
                              damageCompensation: {
                                ...prev.damageCompensation,
                                disputeResolutionTerms: opt.text,
                                disputeResolutionNotes: opt.text,
                              },
                            }));
                          }
                        }}
                        className="mt-0.5 text-amber-600 focus:ring-amber-500 accent-amber-600"
                      />
                      <div className="flex-1 leading-relaxed">
                        <span className="font-bold text-stone-900 mr-1.5">{opt.title}:</span>
                        {opt.text && <span className="text-stone-700">{opt.text}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Ô hiển thị và tự nhập nội dung điều khoản áp dụng */}
              <div className="pt-2 border-t border-stone-100 space-y-1">
                <span className="text-[11px] font-semibold text-stone-600 block">
                  Nội dung điều khoản sẽ ghi nhận vào hợp đồng điện tử:
                </span>
                <input
                  id="dispute-resolution-input"
                  type="text"
                  value={
                    formData.damageCompensation.disputeResolutionTerms ||
                    formData.damageCompensation.disputeResolutionNotes ||
                    ''
                  }
                  onChange={(e) => {
                    setDisputeMode('custom');
                    setFormData((prev) => ({
                      ...prev,
                      damageCompensation: {
                        ...prev.damageCompensation,
                        disputeResolutionTerms: e.target.value,
                        disputeResolutionNotes: e.target.value,
                      },
                    }));
                  }}
                  placeholder="Chọn 1 trong các Mẫu trên hoặc tự nhập điều khoản thỏa thuận thiện chí..."
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-md text-xs bg-white text-stone-800"
                />
                <span className="text-[10px] text-stone-400 block mt-1">
                  Lưu ý: Nền tảng VibeHue chỉ hỗ trợ hòa giải thiện chí dựa trên chứng cứ giao nhận. Shop không tự ý đưa điều khoản ủy quyền cho Sàn làm trọng tài phán quyết hoặc tự ý giữ/khấu trừ tiền cọc.
                </span>
              </div>
              {(() => {
                const currentClause =
                  formData.damageCompensation.disputeResolutionTerms ||
                  formData.damageCompensation.disputeResolutionNotes;
                const check = validateDisputeResolutionClause(currentClause);
                if (!check.isValid) {
                  return (
                    <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start gap-1.5">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-600" />
                      <span>
                        <strong>Cảnh báo guardrail:</strong> {check.errorMessage}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </section>

        {/* GROUP 4: HỦY ĐƠN & HOÀN CỌC */}
        <section className="bg-stone-50/70 p-4 rounded-xl border border-stone-200 space-y-3">
          <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 text-xs flex items-center justify-center font-bold">
              4
            </span>
            Chính sách Hủy thuê & Hoàn tiền cọc (Cancellation & Deposit Refund)
          </h4>

          <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-2">
            <span className="font-semibold text-stone-700 block">
              Biểu phí hoàn tiền thuê khi hủy đơn trước thời hạn:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {formData.cancellationPolicy.refundRules.map((rule, idx) => (
                <div key={idx} className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                  <span className="text-stone-500 block mb-1">
                    {rule.daysBeforeRental > 0
                      ? `Hủy trước ≥ ${rule.daysBeforeRental} ngày:`
                      : 'Hủy trong vòng 24 giờ:'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={rule.refundPercentage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setFormData((prev) => {
                          const updated = [...prev.cancellationPolicy.refundRules];
                          updated[idx] = { ...updated[idx], refundPercentage: val };
                          return {
                            ...prev,
                            cancellationPolicy: { ...prev.cancellationPolicy, refundRules: updated },
                          };
                        });
                      }}
                      className="w-20 px-2 py-1 border border-stone-300 rounded font-mono text-center"
                    />
                    <span className="font-semibold text-stone-700">% tiền thuê</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <label className="font-semibold text-stone-700 block mb-1">
                Ghi chú hoàn cọc (Luôn bảo vệ tiền cọc của khách):
              </label>
              <input
                type="text"
                value={formData.cancellationPolicy.cancellationNotes || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    cancellationPolicy: {
                      ...prev.cancellationPolicy,
                      cancellationNotes: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
              />
            </div>
          </div>
        </section>

        {/* SUPPORT CONTACT & CUSTOM TERMS */}
        <section className="bg-stone-50/70 p-4 rounded-xl border border-stone-200 space-y-3">
          <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
            <HelpCircle size={18} className="text-amber-800" />
            Thông tin Hỗ trợ Giao dịch & Điều khoản Tùy chỉnh
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                Hotline hỗ trợ trực tiếp <span className="text-rose-600">*</span>:
              </label>
              <input
                type="text"
                value={formData.supportContact.hotline}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    supportContact: { ...prev.supportContact, hotline: e.target.value },
                  }))
                }
                placeholder="Ví dụ: 0901234567"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                Khung giờ hỗ trợ khách hàng:
              </label>
              <input
                type="text"
                value={formData.supportContact.supportWorkingHours}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    supportContact: {
                      ...prev.supportContact,
                      supportWorkingHours: e.target.value,
                    },
                  }))
                }
                placeholder="Ví dụ: 08:00 - 21:00"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">
              Điều khoản bổ sung tùy chỉnh (tối đa 1000 ký tự):
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={formData.customTermsText || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, customTermsText: e.target.value }))
              }
              placeholder="Quy định thêm của cửa hàng (không được trái với quy chế sàn VibeHue)..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs leading-relaxed"
            />
          </div>
        </section>
      </div>

      {/* Dynamic Action Notifications (Lưu nháp / Gửi duyệt thành công hoặc lỗi) */}
      {successMsg && (
        <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-300 rounded-lg flex items-center gap-2 shadow-xs">
          <XCircle size={16} className="text-rose-600 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200">
        <span className="text-[11px] text-stone-500 italic">
          * Sau khi gửi duyệt, chính sách sẽ được kiểm tra theo chuẩn pháp lý trước khi đưa vào Hợp đồng điện tử.
        </span>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || submitting}
            className="px-4 py-2 border border-stone-300 hover:bg-stone-100 text-stone-800 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-60"
            data-testid="save-draft-btn"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Lưu bản thảo
          </button>

          <button
            type="button"
            onClick={handleSubmitReview}
            disabled={saving || submitting}
            className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-semibold rounded-lg text-xs shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-60"
            data-testid="submit-review-btn"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Gửi duyệt chính sách
          </button>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: LỊCH SỬ PHIÊN BẢN CHÍNH SÁCH
          ========================================================================= */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowHistoryModal(false)}
          data-testid="policy-history-modal"
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Lịch sử Phiên bản Chính sách Shop</h3>
                  <p className="text-xs text-stone-500">Tra cứu trạng thái xét duyệt và nội dung các phiên bản chính sách cho thuê.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {loadingHistory ? (
                <div className="py-12 text-center text-stone-500 flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-amber-700" />
                  <span className="text-xs">Đang tải danh sách phiên bản...</span>
                </div>
              ) : historyError ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {historyError}
                </div>
              ) : historyVersions.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  Chưa có phiên bản chính sách nào được ghi nhận.
                </div>
              ) : (
                historyVersions.map((ver) => {
                  const isVerApproved = ver.status === 'APPROVED';
                  const isVerPending = ver.status === 'PENDING_REVIEW';
                  const isVerRejected = ver.status === 'REJECTED';
                  const isVerDraft = ver.status === 'DRAFT';
                  const isVerSuperseded = ver.status === 'SUPERSEDED';

                  return (
                    <div
                      key={ver._id}
                      className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors space-y-2.5"
                      data-testid={`history-version-item-${ver.versionNumber}`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-stone-900 font-mono">
                            Phiên bản v{ver.versionNumber}
                          </span>
                          {isVerApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={12} /> Đã duyệt
                            </span>
                          )}
                          {isVerPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                              <Clock size={12} /> Chờ duyệt
                            </span>
                          )}
                          {isVerRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle size={12} /> Bị từ chối
                            </span>
                          )}
                          {isVerDraft && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-200 text-stone-700 border border-stone-300">
                              <Save size={12} /> Bản nháp
                            </span>
                          )}
                          {isVerSuperseded && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                              Đã thay thế
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedHistoryVersion(ver)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                          data-testid={`btn-view-version-${ver.versionNumber}`}
                        >
                          <Eye size={13} />
                          <span>Xem chi tiết (Chỉ đọc)</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-500 pt-1 border-t border-stone-200/60">
                        <div>
                          Ngày gửi / tạo:{' '}
                          <strong className="text-stone-700">
                            {ver.submittedAt
                              ? new Date(ver.submittedAt).toLocaleString('vi-VN')
                              : ver.createdAt
                              ? new Date(ver.createdAt).toLocaleString('vi-VN')
                              : '---'}
                          </strong>
                        </div>
                        <div>
                          Thời điểm duyệt:{' '}
                          <strong className="text-stone-700">
                            {ver.approvedAt
                              ? new Date(ver.approvedAt).toLocaleString('vi-VN')
                              : ver.reviewedAt
                              ? new Date(ver.reviewedAt).toLocaleString('vi-VN')
                              : 'Chưa xét duyệt'}
                          </strong>
                        </div>
                      </div>

                      {isVerRejected && ver.reviewNote && (
                        <div
                          className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs"
                          data-testid={`rejection-reason-${ver.versionNumber}`}
                        >
                          <div className="font-semibold flex items-center gap-1.5 mb-0.5">
                            <AlertTriangle size={13} className="text-rose-600" />
                            Lý do từ chối:
                          </div>
                          <p className="m-0 text-[11px] text-rose-700 whitespace-pre-wrap">{ver.reviewNote}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-stone-200 flex justify-end bg-stone-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: XEM CHI TIẾT PHIÊN BẢN (CHẾ ĐỘ CHỈ ĐỌC)
          ========================================================================= */}
      {selectedHistoryVersion && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedHistoryVersion(null)}
          data-testid="policy-version-detail-modal"
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-stone-200 bg-stone-50/70 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
                  <FileCheck size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-stone-900 font-mono">
                      Chính sách Phiên bản v{selectedHistoryVersion.versionNumber}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-200 text-stone-700">
                      Chỉ đọc
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">Nội dung đã lưu trữ trong cơ sở dữ liệu của Shop.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryVersion(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
                aria-label="Đóng chi tiết"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-stone-700 flex-1">
              {/* Rejection Note Warning if any */}
              {selectedHistoryVersion.status === 'REJECTED' && selectedHistoryVersion.reviewNote && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-xs">
                    <AlertTriangle size={15} className="text-rose-600" />
                    Lý do từ chối từ Ban Quản Trị Sàn:
                  </div>
                  <p className="m-0 text-xs text-rose-700 whitespace-pre-wrap">{selectedHistoryVersion.reviewNote}</p>
                </div>
              )}

              {/* Group 1: Garment Care */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 space-y-2.5">
                <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-xs flex items-center justify-center font-bold">1</span>
                  Hướng dẫn bảo quản & Giặt là áo dài
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500">Ủi/Là trang phục:</span>
                    <strong className={selectedHistoryVersion.garmentCare?.allowIroning ? 'text-emerald-700' : 'text-rose-700'}>
                      {selectedHistoryVersion.garmentCare?.allowIroning ? '✓ Cho phép là ủi' : '✗ Không được tự ý là ủi'}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500">Giặt tẩy trang phục:</span>
                    <strong className={selectedHistoryVersion.garmentCare?.allowWashing ? 'text-emerald-700' : 'text-rose-700'}>
                      {selectedHistoryVersion.garmentCare?.allowWashing ? '✓ Cho phép tự giặt' : '✗ Shop tự giặt chuyên dụng'}
                    </strong>
                  </div>
                </div>
                {selectedHistoryVersion.garmentCare?.prohibitedActions?.length > 0 && (
                  <div className="pt-2 border-t border-stone-200">
                    <span className="font-semibold text-stone-600 block mb-1">Các hành vi nghiêm cấm:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-stone-600">
                      {selectedHistoryVersion.garmentCare.prohibitedActions.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedHistoryVersion.garmentCare?.specialNotes && (
                  <div className="text-stone-500 italic pt-1">
                    Lưu ý đặc biệt: "{selectedHistoryVersion.garmentCare.specialNotes}"
                  </div>
                )}
              </div>

              {/* Group 2: Late Return */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 space-y-2.5">
                <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-xs flex items-center justify-center font-bold">2</span>
                  Quy định trả trễ & Phí ân hạn
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                  <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-500 block">Ân hạn:</span>
                    <strong className="text-stone-800 text-xs">{selectedHistoryVersion.lateReturn?.gracePeriodHours ?? 2} giờ</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-500 block">Phí trễ / giờ:</span>
                    <strong className="text-stone-800 text-xs">{(selectedHistoryVersion.lateReturn?.hourlyLateFee ?? 0).toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-500 block">Phí trễ / ngày:</span>
                    <strong className="text-stone-800 text-xs">{(selectedHistoryVersion.lateReturn?.dailyLateFee ?? 0).toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-500 block">Trễ tối đa:</span>
                    <strong className="text-stone-800 text-xs">{selectedHistoryVersion.lateReturn?.maxLateDaysAllowed ?? 3} ngày</strong>
                  </div>
                </div>
              </div>

              {/* Group 3: Damage Compensation (4 Tiers) */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 space-y-3">
                <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-xs flex items-center justify-center font-bold">3</span>
                  Quy định Bồi thường Sự cố (4 Cấp độ độc lập)
                </h4>
                <div className="space-y-2">
                  {[
                    { key: 'minorDamage', label: '1. Hư hỏng nhẹ', rule: selectedHistoryVersion.damageCompensation?.minorDamage },
                    { key: 'moderateDamage', label: '2. Hư hỏng vừa', rule: selectedHistoryVersion.damageCompensation?.moderateDamage },
                    { key: 'severeDamage', label: '3. Hư hỏng nặng', rule: selectedHistoryVersion.damageCompensation?.severeDamage },
                    { key: 'totalLoss', label: '4. Mất đồ / Không phục hồi', rule: selectedHistoryVersion.damageCompensation?.totalLoss },
                  ].map(({ key, label, rule }) => (
                    <div key={key} className="p-2.5 bg-white rounded-lg border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div>
                        <strong className="text-stone-800 block text-xs">{label}</strong>
                        <span className="text-[11px] text-stone-500">{rule?.conditionsAndEvidence || 'Theo thỏa thuận hai bên.'}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                          {rule?.method === 'FIXED_FEE'
                            ? `${(rule?.fixedFeeAmount ?? 0).toLocaleString('vi-VN')} đ`
                            : rule?.method === 'PERCENTAGE_ON_ASSET'
                            ? `${rule?.percentageOfAsset ?? 0}% Giá trị bồi hoàn`
                            : rule?.method === 'ACTUAL_REPAIR_COST'
                            ? 'Chi phí thực tế'
                            : 'Thương lượng'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-stone-500 pt-2 border-t border-stone-200 flex justify-between flex-wrap gap-2">
                  <span>Thời hạn báo sự cố: <strong>{selectedHistoryVersion.damageCompensation?.incidentNotificationHours ?? 24} giờ</strong></span>
                  {selectedHistoryVersion.damageCompensation?.disputeResolutionTerms && (
                    <span>Hòa giải: <em>{selectedHistoryVersion.damageCompensation.disputeResolutionTerms}</em></span>
                  )}
                </div>
              </div>

              {/* Group 4: Cancellation Policy */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 space-y-2">
                <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-xs flex items-center justify-center font-bold">4</span>
                  Chính sách Hủy thuê & Hoàn tiền cọc
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  {(selectedHistoryVersion.cancellationPolicy?.refundRules || []).map((r, i) => (
                    <div key={i} className="p-2 bg-white rounded-lg border border-stone-200">
                      <span className="text-[10px] text-stone-500 block">Trước {r.daysBeforeRental} ngày:</span>
                      <strong className="text-amber-900 text-xs font-mono">{r.refundPercentage}%</strong>
                    </div>
                  ))}
                </div>
                {selectedHistoryVersion.cancellationPolicy?.cancellationNotes && (
                  <p className="text-[11px] text-stone-500 italic mt-1 m-0">
                    *{selectedHistoryVersion.cancellationPolicy.cancellationNotes}
                  </p>
                )}
              </div>

              {/* Group 5: Hotline & Notes */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>Hotline hỗ trợ: <strong className="text-stone-800">{selectedHistoryVersion.supportContact?.hotline || 'Chưa thiết lập'}</strong></span>
                  <span>Khung giờ: <strong className="text-stone-800">{selectedHistoryVersion.supportContact?.supportWorkingHours || '08:00 - 21:00'}</strong></span>
                </div>
                {selectedHistoryVersion.customTermsText && (
                  <div className="pt-2 text-stone-600 border-t border-stone-200 text-[11px]">
                    Điều khoản riêng của shop: "{selectedHistoryVersion.customTermsText}"
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-stone-200 flex justify-end bg-stone-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setSelectedHistoryVersion(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 cursor-pointer"
              >
                Đóng chi tiết
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
