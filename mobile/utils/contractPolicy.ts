import type {
  DamageCompensationPolicy,
  ProviderContractPolicyVersion,
  SavePolicyPayload,
  TierCompensationRule,
} from '@/types/contract';
import { resolveDamageCompensationRules } from '@/types/contract';

export const STANDARD_DISPUTE_RESOLUTION_CLAUSE =
  'Đối chiếu chứng cứ giao nhận và thương lượng.';

export const DEFAULT_PROVIDER_POLICY_PAYLOAD: SavePolicyPayload = {
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
      conditionsAndEvidence:
        'Rách đường may, ố màu có thể phục hồi theo hóa đơn giặt hấp/may vá chuyên dụng.',
    },
    severeDamage: {
      method: 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: null,
      percentageOfAsset: null,
      conditionsAndEvidence:
        'Rách lớn, biến dạng phom dáng; hai bên đối chiếu ảnh giao nhận và thương lượng.',
    },
    totalLoss: {
      method: 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: null,
      percentageOfAsset: null,
      conditionsAndEvidence:
        'Mất trang phục hoặc rách nát hoàn toàn không thể phục hồi; hai bên đối chiếu hình ảnh giao nhận và thương lượng bồi thường.',
    },
    incidentNotificationHours: 24,
    disputeResolutionTerms: STANDARD_DISPUTE_RESOLUTION_CLAUSE,
  },
  cancellationPolicy: {
    refundRules: [
      { daysBeforeRental: 3, refundPercentage: 100 },
      { daysBeforeRental: 1, refundPercentage: 50 },
      { daysBeforeRental: 0, refundPercentage: 0 },
    ],
    cancellationNotes:
      'Tiền cọc luôn hoàn 100% nếu hủy trước khi nhận đồ. Phí hủy chỉ tính trên tiền thuê.',
  },
  supportContact: {
    hotline: '',
    supportWorkingHours: '08:00 - 21:00',
    contactNote: 'Hỗ trợ đổi size trong vòng 2 giờ sau khi nhận đồ.',
  },
  customTermsText: 'Khách hàng vui lòng đồng kiểm trang phục khi nhận hàng.',
};

const ARBITRATION_PATTERNS = [
  /làm trọng tài/,
  /là trọng tài/,
  /trọng tài hòa giải/,
  /trọng tài thương mại/,
  /cơ quan trọng tài/,
  /hội đồng trọng tài/,
  /phán quyết bắt buộc/,
  /ra phán quyết có hiệu lực bắt buộc/,
];

const DEPOSIT_SEIZURE_PATTERNS = [
  /bảo lưu (khoản|tiền) cọc/,
  /bảo lưu cọc/,
  /giữ (khoản|tiền) cọc/,
  /tịch thu (khoản|tiền) cọc/,
  /phong tỏa (khoản|tiền) cọc/,
  /tự (động|ý) khấu trừ/,
  /cưỡng chế (thanh toán|khách|bên b)/,
];

const NEGATION_PATTERNS = [
  /không (phải|làm|được|có quyền|tự ý|mặc nhiên|tự động)/,
  /không/,
  /chưa được/,
  /chưa từng/,
  /chẳng/,
];

/** Mirrors backend/web dispute resolution clause guardrails so errors are caught before submission. */
export function validateDisputeResolutionClause(
  clause?: string | null,
): { isValid: boolean; errorMessage?: string } {
  if (!clause || !clause.trim()) {
    return { isValid: true };
  }

  const segments = clause
    .trim()
    .toLowerCase()
    .split(/[.,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const violations: string[] = [];

  for (const segment of segments) {
    const hasNegation = NEGATION_PATTERNS.some((neg) => neg.test(segment));
    if (hasNegation) continue;

    for (const pattern of ARBITRATION_PATTERNS) {
      if (pattern.test(segment)) {
        violations.push(
          `Điều khoản không được gán quyền 'trọng tài' hoặc 'phán quyết bắt buộc' cho Sàn VibeHue: "${segment}".`,
        );
      }
    }

    for (const pattern of DEPOSIT_SEIZURE_PATTERNS) {
      if (pattern.test(segment)) {
        violations.push(
          `Điều khoản không được trao quyền tự ý giữ/phong tỏa cọc hoặc tự động khấu trừ cho Sàn VibeHue: "${segment}".`,
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      isValid: false,
      errorMessage: Array.from(new Set(violations)).join(' '),
    };
  }

  return { isValid: true };
}

function sanitizeTierRule(rule?: TierCompensationRule | null): TierCompensationRule {
  const method = rule?.method ?? 'INCIDENT_NEGOTIATION';
  return {
    method,
    fixedFeeAmount:
      method === 'FIXED_FEE'
        ? Math.max(0, Math.round(Number(rule?.fixedFeeAmount ?? 0) || 0))
        : null,
    percentageOfAsset:
      method === 'PERCENTAGE_ON_ASSET'
        ? Math.min(100, Math.max(1, Math.round(Number(rule?.percentageOfAsset ?? 10) || 10)))
        : null,
    conditionsAndEvidence: rule?.conditionsAndEvidence?.trim() || null,
  };
}

export function normalizePolicyPayloadForSave(
  form: SavePolicyPayload,
  fallbackPhone?: string,
): SavePolicyPayload {
  const cleanDispute =
    form.damageCompensation.disputeResolutionTerms?.trim() || null;

  return {
    garmentCare: {
      allowIroning: Boolean(form.garmentCare.allowIroning),
      allowWashing: Boolean(form.garmentCare.allowWashing),
      prohibitedActions: (form.garmentCare.prohibitedActions ?? [])
        .map((item) => item.trim())
        .filter(Boolean),
      specialNotes: form.garmentCare.specialNotes?.trim() || null,
    },
    lateReturn: {
      gracePeriodHours: Math.min(
        72,
        Math.max(0, Math.round(Number(form.lateReturn.gracePeriodHours) || 0)),
      ),
      hourlyLateFee: Math.max(
        0,
        Math.round(Number(form.lateReturn.hourlyLateFee) || 0),
      ),
      dailyLateFee: Math.max(
        0,
        Math.round(Number(form.lateReturn.dailyLateFee) || 0),
      ),
      maxLateDaysAllowed: Math.min(
        30,
        Math.max(1, Math.round(Number(form.lateReturn.maxLateDaysAllowed) || 1)),
      ),
    },
    damageCompensation: {
      minorDamage: sanitizeTierRule(form.damageCompensation.minorDamage),
      moderateDamage: sanitizeTierRule(form.damageCompensation.moderateDamage),
      severeDamage: sanitizeTierRule(form.damageCompensation.severeDamage),
      totalLoss: sanitizeTierRule(form.damageCompensation.totalLoss),
      incidentNotificationHours: Math.min(
        72,
        Math.max(
          1,
          Math.round(Number(form.damageCompensation.incidentNotificationHours ?? 24) || 24),
        ),
      ),
      disputeResolutionTerms: cleanDispute,
    },
    cancellationPolicy: {
      refundRules: (form.cancellationPolicy.refundRules ?? []).map((r) => ({
        daysBeforeRental: Math.max(0, Math.round(Number(r.daysBeforeRental) || 0)),
        refundPercentage: Math.min(
          100,
          Math.max(0, Math.round(Number(r.refundPercentage) || 0)),
        ),
      })),
      cancellationNotes: form.cancellationPolicy.cancellationNotes?.trim() || null,
    },
    supportContact: {
      hotline:
        form.supportContact.hotline.trim() || fallbackPhone?.trim() || '',
      supportWorkingHours:
        form.supportContact.supportWorkingHours.trim() || '08:00 - 21:00',
      contactNote: form.supportContact.contactNote?.trim() || null,
    },
    customTermsText: form.customTermsText?.trim() || null,
  };
}

export function policyVersionToFormPayload(
  version?: ProviderContractPolicyVersion | null,
  fallbackPhone?: string,
): SavePolicyPayload {
  if (!version) {
    return {
      ...DEFAULT_PROVIDER_POLICY_PAYLOAD,
      supportContact: {
        ...DEFAULT_PROVIDER_POLICY_PAYLOAD.supportContact,
        hotline: fallbackPhone?.trim() || '',
      },
    };
  }

  const resolved = resolveDamageCompensationRules(version.damageCompensation);
  return {
    garmentCare: version.garmentCare ?? DEFAULT_PROVIDER_POLICY_PAYLOAD.garmentCare,
    lateReturn: version.lateReturn ?? DEFAULT_PROVIDER_POLICY_PAYLOAD.lateReturn,
    damageCompensation: {
      minorDamage: resolved.minorDamage,
      moderateDamage: resolved.moderateDamage,
      severeDamage: resolved.severeDamage,
      totalLoss: resolved.totalLoss,
      incidentNotificationHours:
        version.damageCompensation?.incidentNotificationHours ??
        resolved.incidentNotificationHours ??
        24,
      disputeResolutionTerms:
        version.damageCompensation?.disputeResolutionTerms ??
        resolved.disputeResolutionTerms ??
        STANDARD_DISPUTE_RESOLUTION_CLAUSE,
    },
    cancellationPolicy:
      version.cancellationPolicy ?? DEFAULT_PROVIDER_POLICY_PAYLOAD.cancellationPolicy,
    supportContact: {
      hotline: version.supportContact?.hotline || fallbackPhone?.trim() || '',
      supportWorkingHours:
        version.supportContact?.supportWorkingHours || '08:00 - 21:00',
      contactNote: version.supportContact?.contactNote ?? '',
    },
    customTermsText: version.customTermsText ?? '',
  };
}

const TIER_LABELS: Array<{
  key: 'minorDamage' | 'moderateDamage' | 'severeDamage' | 'totalLoss';
  label: string;
}> = [
  { key: 'minorDamage', label: 'Hư hỏng nhẹ' },
  { key: 'moderateDamage', label: 'Hư hỏng vừa' },
  { key: 'severeDamage', label: 'Hư hỏng nặng' },
  { key: 'totalLoss', label: 'Mất trang phục' },
];

export function validatePolicyPayload(
  payload: SavePolicyPayload,
  mode: 'DRAFT' | 'SUBMIT',
): string | null {
  if (!payload.supportContact.hotline.trim()) {
    return 'Vui lòng nhập Hotline hỗ trợ của Shop.';
  }
  if (!payload.supportContact.supportWorkingHours.trim()) {
    return 'Vui lòng nhập khung giờ hỗ trợ của Shop.';
  }
  if (!payload.cancellationPolicy.refundRules.length) {
    return 'Cần ít nhất 1 mốc hoàn tiền khi hủy đơn.';
  }

  const disputeCheck = validateDisputeResolutionClause(
    payload.damageCompensation.disputeResolutionTerms,
  );
  if (!disputeCheck.isValid) {
    return disputeCheck.errorMessage ?? 'Điều khoản giải quyết tranh chấp không hợp lệ.';
  }

  if (payload.customTermsText && payload.customTermsText.length > 1000) {
    return 'Điều khoản riêng của Shop tối đa 1000 ký tự.';
  }

  if (mode === 'SUBMIT') {
    const dc: DamageCompensationPolicy = payload.damageCompensation;
    for (const item of TIER_LABELS) {
      const rule = dc[item.key];
      if (!rule) {
        return `Vui lòng thiết lập phương thức bồi thường cho '${item.label}'.`;
      }
      if (
        (rule.method === 'ACTUAL_REPAIR_COST' ||
          rule.method === 'INCIDENT_NEGOTIATION') &&
        (rule.conditionsAndEvidence?.trim().length ?? 0) < 5
      ) {
        return `Cần nhập căn cứ & chứng từ xác minh tối thiểu 5 ký tự cho '${item.label}'.`;
      }
    }
  }

  return null;
}

export function policyRequiresAssetValue(
  damageCompensation?: DamageCompensationPolicy | null,
): boolean {
  return resolveDamageCompensationRules(damageCompensation).requiresAssetValue;
}
