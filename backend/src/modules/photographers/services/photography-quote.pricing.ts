export type PhotographyQuotePricingUnit =
  | 'PER_SESSION'
  | 'PER_DAY'
  | 'PER_BOOKING';

export interface PhotographyQuotePricingPolicy {
  name: string;
  price: number;
  pricingUnit?: PhotographyQuotePricingUnit | null;
  includedDurationMinutes?: number | null;
  includedSessionCount?: number | null;
  includedDayCount?: number | null;
  additionalSessionFee?: number | null;
  overtimeFeePerHour?: number | null;
  overtimeIncrementMinutes?: number | null;
  maxOvertimeMinutes?: number | null;
}

export interface QuoteSessionForPricing {
  clientId: string;
  providerLocalDate: string;
  durationMinutes: number;
}

export interface PhotographyQuoteBreakdownItem {
  type: 'BASE_PACKAGE' | 'OVERTIME' | 'SURCHARGE';
  label: string;
  amount: number;
  clientIds?: string[];
}

export interface PhotographyQuotePriceResult {
  pricingUnit: PhotographyQuotePricingUnit;
  baseAmount: number;
  overtimeAmount: number;
  surchargeAmount: number;
  totalAmount: number;
  breakdown: PhotographyQuoteBreakdownItem[];
  overtimeMinutesByClientId: Record<string, number>;
}

export class PhotographyPricingPolicyError extends Error {}

type SessionGroup = {
  label: string;
  clientIds: string[];
  durationMinutes: number;
};

export function calculatePhotographyQuote(
  policy: PhotographyQuotePricingPolicy,
  sessions: QuoteSessionForPricing[],
): PhotographyQuotePriceResult {
  if (!sessions.length) {
    throw new PhotographyPricingPolicyError('Cần có ít nhất một buổi chụp để tính giá.');
  }

  const pricingUnit = policy.pricingUnit ?? 'PER_SESSION';
  const includedDurationMinutes = normalizePositiveInteger(
    policy.includedDurationMinutes,
    120,
  );
  const overtimeIncrementMinutes = normalizePositiveInteger(
    policy.overtimeIncrementMinutes,
    30,
  );
  const maxOvertimeMinutes = normalizeNonNegativeInteger(
    policy.maxOvertimeMinutes,
    240,
  );
  const price = normalizeCurrency(policy.price);
  const overtimeFeePerHour = normalizeCurrency(policy.overtimeFeePerHour ?? 0);
  const breakdown: PhotographyQuoteBreakdownItem[] = [];
  const overtimeMinutesByClientId: Record<string, number> = {};

  const addBreakdown = (
    type: PhotographyQuoteBreakdownItem['type'],
    label: string,
    amount: number,
    clientIds?: string[],
  ) => {
    if (!amount) return;
    breakdown.push({ type, label, amount, clientIds });
  };

  const chargeGroup = (group: SessionGroup, baseAmount: number) => {
    const overtimeMinutes = Math.max(
      0,
      group.durationMinutes - includedDurationMinutes,
    );
    if (overtimeMinutes > maxOvertimeMinutes) {
      throw new PhotographyPricingPolicyError(
        `Thời lượng tăng giờ vượt giới hạn ${maxOvertimeMinutes} phút của gói chụp.`,
      );
    }
    if (overtimeMinutes % overtimeIncrementMinutes !== 0) {
      throw new PhotographyPricingPolicyError(
        `Thời lượng tăng giờ phải theo bước ${overtimeIncrementMinutes} phút.`,
      );
    }

    const overtimeAmount = Math.round(
      (overtimeMinutes * overtimeFeePerHour) / 60,
    );
    addBreakdown('BASE_PACKAGE', group.label, baseAmount, group.clientIds);
    addBreakdown(
      'OVERTIME',
      `Tăng giờ — ${group.label}`,
      overtimeAmount,
      group.clientIds,
    );
    return { baseAmount, overtimeAmount, overtimeMinutes };
  };

  let baseAmount = 0;
  let overtimeAmount = 0;
  let surchargeAmount = 0;

  if (pricingUnit === 'PER_SESSION') {
    for (const session of sessions) {
      if (session.durationMinutes < includedDurationMinutes) {
        throw new PhotographyPricingPolicyError(
          `Mỗi buổi chụp phải có thời lượng tối thiểu ${includedDurationMinutes} phút theo gói.`,
        );
      }
      const charged = chargeGroup(
        {
          label: `${policy.name} — buổi chụp`,
          clientIds: [session.clientId],
          durationMinutes: session.durationMinutes,
        },
        price,
      );
      baseAmount += charged.baseAmount;
      overtimeAmount += charged.overtimeAmount;
      overtimeMinutesByClientId[session.clientId] = charged.overtimeMinutes;
    }
  } else if (pricingUnit === 'PER_DAY') {
    for (const [date, sessionsOnDate] of groupByDate(sessions)) {
      const charged = chargeGroup(
        {
          label: `${policy.name} — ngày ${date}`,
          clientIds: sessionsOnDate.map((session) => session.clientId),
          durationMinutes: sessionsOnDate.reduce(
            (total, session) => total + session.durationMinutes,
            0,
          ),
        },
        price,
      );
      baseAmount += charged.baseAmount;
      overtimeAmount += charged.overtimeAmount;
    }
  } else if (pricingUnit === 'PER_BOOKING') {
    const includedSessionCount = policy.includedSessionCount;
    const includedDayCount = policy.includedDayCount;
    if (
      !Number.isInteger(includedSessionCount) ||
      !includedSessionCount ||
      !Number.isInteger(includedDayCount) ||
      !includedDayCount
    ) {
      throw new PhotographyPricingPolicyError(
        'Gói tính theo đơn cần khai báo số buổi và số ngày được bao gồm trước khi khách có thể đặt.',
      );
    }

    const distinctDayCount = groupByDate(sessions).size;
    if (distinctDayCount > includedDayCount) {
      throw new PhotographyPricingPolicyError(
        `Gói chỉ bao gồm tối đa ${includedDayCount} ngày chụp.`,
      );
    }

    const charged = chargeGroup(
      {
        label: `${policy.name} — toàn bộ đơn`,
        clientIds: sessions.map((session) => session.clientId),
        durationMinutes: sessions.reduce(
          (total, session) => total + session.durationMinutes,
          0,
        ),
      },
      price,
    );
    baseAmount += charged.baseAmount;
    overtimeAmount += charged.overtimeAmount;

    const extraSessionCount = Math.max(0, sessions.length - includedSessionCount);
    const additionalSessionFee = normalizeCurrency(
      policy.additionalSessionFee ?? 0,
    );
    surchargeAmount = extraSessionCount * additionalSessionFee;
    addBreakdown(
      'SURCHARGE',
      `Phụ thu ${extraSessionCount} buổi chụp thêm`,
      surchargeAmount,
      sessions.slice(includedSessionCount).map((session) => session.clientId),
    );
  } else {
    throw new PhotographyPricingPolicyError('Đơn vị tính giá của gói chụp không hợp lệ.');
  }

  return {
    pricingUnit,
    baseAmount,
    overtimeAmount,
    surchargeAmount,
    totalAmount: baseAmount + overtimeAmount + surchargeAmount,
    breakdown,
    overtimeMinutesByClientId,
  };
}

function groupByDate(
  sessions: QuoteSessionForPricing[],
): Map<string, QuoteSessionForPricing[]> {
  const groups = new Map<string, QuoteSessionForPricing[]>();
  for (const session of sessions) {
    const group = groups.get(session.providerLocalDate) ?? [];
    group.push(session);
    groups.set(session.providerLocalDate, group);
  }
  return groups;
}

function normalizePositiveInteger(value: number | null | undefined, fallback: number) {
  return Number.isInteger(value) && (value as number) > 0
    ? (value as number)
    : fallback;
}

function normalizeNonNegativeInteger(value: number | null | undefined, fallback: number) {
  return Number.isInteger(value) && (value as number) >= 0
    ? (value as number)
    : fallback;
}

function normalizeCurrency(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}
