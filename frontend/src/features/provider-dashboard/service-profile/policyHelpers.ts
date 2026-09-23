
import type { CancellationRefundRule } from '../types';

export const normalizeCancellationRefundRules = (rules: CancellationRefundRule[]) => rules
  .filter((rule) => Number.isFinite(rule.noticeDays) && Number.isFinite(rule.refundPercent))
  .map((rule) => ({
    noticeDays: Math.max(0, Math.min(365, Number(rule.noticeDays))),
    refundPercent: Math.max(0, Math.min(100, Number(rule.refundPercent))),
  }))
  .sort((left, right) => right.noticeDays - left.noticeDays);

export const buildCancellationPolicySummary = (rules: CancellationRefundRule[], additionalNotes: string) => {
  const normalizedRules = normalizeCancellationRefundRules(rules);
  const ruleLines = normalizedRules.map((rule, index) => {
    const previousRule = normalizedRules[index - 1];
    if (rule.noticeDays === 0 && previousRule) {
      return `Hủy dưới ${previousRule.noticeDays} ngày: hoàn ${rule.refundPercent}% tiền cọc.`;
    }
    if (previousRule) {
      return `Hủy từ ${rule.noticeDays} đến dưới ${previousRule.noticeDays} ngày: hoàn ${rule.refundPercent}% tiền cọc.`;
    }
    return `Hủy trước ít nhất ${rule.noticeDays} ngày: hoàn ${rule.refundPercent}% tiền cọc.`;
  });
  return [...ruleLines, additionalNotes.trim()].filter(Boolean).join(' ');
};
