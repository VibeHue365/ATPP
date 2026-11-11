/**
 * Guardrail validator for Provider Contract Policy Dispute Resolution Clauses.
 *
 * Enforces Model A boundaries:
 * - VibeHue is a goodwill mediation platform, NOT a commercial arbitration tribunal.
 * - Platform has NO power to unilaterally seize, hold, freeze, or forfeit deposits.
 * - Platform has NO authority to auto-deduct funds or compel customer payment of excess damages.
 *
 * Valid negations (e.g. "VibeHue không phải là trọng tài", "Sàn không tự ý khấu trừ cọc")
 * are explicitly permitted and must NOT be falsely rejected.
 */

export interface DisputeClauseValidationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
  detectedViolations?: string[];
}

export function validateDisputeResolutionClause(
  clause: string | null | undefined,
): DisputeClauseValidationResult {
  if (!clause || !clause.trim()) {
    // Empty clause is valid - platform default mediation rules apply
    return { isValid: true };
  }

  const normalized = clause.trim();
  const lower = normalized.toLowerCase();
  const violations: string[] = [];

  // Break clause into sub-clauses by punctuation so negations are evaluated in their local scope
  const segments = lower
    .split(/[.,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);

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

  for (const segment of segments) {
    const hasNegation = NEGATION_PATTERNS.some((neg) => neg.test(segment));

    for (const pat of ARBITRATION_PATTERNS) {
      if (pat.test(segment)) {
        if (!hasNegation) {
          violations.push(
            `Điều khoản không được gán quyền 'trọng tài' hoặc 'phán quyết bắt buộc' cho Sàn VibeHue: "${segment}".`,
          );
        }
      }
    }

    for (const pat of DEPOSIT_SEIZURE_PATTERNS) {
      if (pat.test(segment)) {
        if (!hasNegation) {
          violations.push(
            `Điều khoản không được trao quyền tự ý giữ, bảo lưu, phong tỏa cọc hoặc tự động khấu trừ cho Sàn VibeHue: "${segment}".`,
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    const uniqueViolations = Array.from(new Set(violations));
    return {
      isValid: false,
      errorCode: 'GUARDRAIL_UNAUTHORIZED_DISPUTE_POWERS',
      errorMessage: uniqueViolations.join(' '),
      detectedViolations: uniqueViolations,
    };
  }

  return { isValid: true };
}
