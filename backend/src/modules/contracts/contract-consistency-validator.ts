import { ContractVersionSnapshot } from './schemas/contract-version.schema';

export interface ConsistencyCheckResult {
  consistent: boolean;
  contradictions: string[];
  warnings: string[];
}

export const CONTRACT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function formatShortDateVn(dateVal: unknown): string {
  if (!dateVal) return 'N/A';
  try {
    let d: Date;
    if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
      d = new Date(dateVal);
    } else {
      return 'N/A';
    }
    if (isNaN(d.getTime())) return 'N/A';

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: CONTRACT_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return formatter.format(d);
  } catch {
    return 'N/A';
  }
}

export function formatDateVn(dateVal: unknown): string {
  if (!dateVal) return 'N/A';
  try {
    let d: Date;
    if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
      d = new Date(dateVal);
    } else {
      return 'N/A';
    }
    if (isNaN(d.getTime())) return 'N/A';

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: CONTRACT_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(d).replace(',', '');
  } catch {
    return 'N/A';
  }
}

function parseFormattedNumber(str: string): number | null {
  // Matches e.g. "10.950.000", "1.700.000", "500.000"
  const cleaned = str.replace(/[^\d]/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function extractDatesFromText(text: string): string[] {
  // Matches DD/MM/YYYY
  const regex = /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

/**
 * Validates that renderedText terms do not contradict the structured canonical snapshot.
 * Detects hardcoded dates, deposits, or rental amounts that mismatch booking data.
 * All calendar dates are evaluated strictly in the business timezone: Asia/Ho_Chi_Minh (UTC+7).
 */
export function validateContractConsistency(
  snapshot: ContractVersionSnapshot,
  renderedText: string,
): ConsistencyCheckResult {
  const contradictions: string[] = [];
  const warnings: string[] = [];

  if (!snapshot || !renderedText) {
    return { consistent: true, contradictions: [], warnings: [] };
  }

  const pricing = snapshot.pricing || {};
  const items = snapshot.providerItems || [];

  // 1. Multi-Item Check: Verify items list is non-empty
  if (items.length === 0) {
    contradictions.push(
      'ITEMS_EMPTY: Snapshot contains zero provider rental items',
    );
    return { consistent: false, contradictions, warnings };
  }

  // 2. Check Deposit Amount Consistency
  const snapshotDeposit = Number(pricing.depositTotal);
  if (!isNaN(snapshotDeposit) && snapshotDeposit > 0) {
    const depositRegex =
      /(?:đặt cọc|tiền cọc|tiền đặt cọc|ký quỹ)[^\d\n\r]{0,35}([0-9]{1,3}(?:\.[0-9]{3})+)/gi;
    let match: RegExpExecArray | null;
    while ((match = depositRegex.exec(renderedText)) !== null) {
      const parsedAmount = parseFormattedNumber(match[1]);
      if (parsedAmount !== null && parsedAmount !== snapshotDeposit) {
        contradictions.push(
          `DEPOSIT_MISMATCH: Snapshot deposit is ${snapshotDeposit.toLocaleString('vi-VN')} đ but rendered terms specify ${match[1]} đ`,
        );
      }
    }
  }

  // 3. Check Rental Total Consistency
  const snapshotRental = Number(pricing.rentalTotal);
  if (!isNaN(snapshotRental) && snapshotRental > 0) {
    const rentalRegex =
      /(?:tiền thuê trang phục|tổng tiền thuê|giá thuê)[^\d\n\r]{0,30}([0-9]{1,3}(?:\.[0-9]{3})+)/gi;
    let rMatch: RegExpExecArray | null;
    while ((rMatch = rentalRegex.exec(renderedText)) !== null) {
      const parsed = parseFormattedNumber(rMatch[1]);
      if (parsed !== null && parsed !== snapshotRental) {
        contradictions.push(
          `RENTAL_TOTAL_MISMATCH: Snapshot rental total is ${snapshotRental.toLocaleString('vi-VN')} đ but rendered terms specify ${rMatch[1]} đ`,
        );
      }
    }
  }

  // 4. Check Grand Total Consistency
  const snapshotGrand = Number(pricing.grandTotal);
  if (!isNaN(snapshotGrand) && snapshotGrand > 0) {
    const grandRegex =
      /(?:tổng thanh toán|tổng giá trị hợp đồng|tổng cộng thanh toán)[^\d\n\r]{0,30}([0-9]{1,3}(?:\.[0-9]{3})+)/gi;
    let gMatch: RegExpExecArray | null;
    while ((gMatch = grandRegex.exec(renderedText)) !== null) {
      const parsed = parseFormattedNumber(gMatch[1]);
      if (parsed !== null && parsed !== snapshotGrand) {
        contradictions.push(
          `GRAND_TOTAL_MISMATCH: Snapshot grand total is ${snapshotGrand.toLocaleString('vi-VN')} đ but rendered terms specify ${gMatch[1]} đ`,
        );
      }
    }
  }

  // 5. Check Rental Period / Dates Consistency in Asia/Ho_Chi_Minh timezone
  let minStartMs = Infinity;
  let maxEndMs = -Infinity;
  let minStartDateStr = '';
  let maxEndDateStr = '';
  const validItemDates = new Set<string>();

  for (const item of items) {
    const startStr = formatShortDateVn(item.rentalFrom);
    const endStr = formatShortDateVn(item.rentalTo);

    if (startStr !== 'N/A') {
      validItemDates.add(startStr);
      const startMs = new Date(String(item.rentalFrom)).getTime();
      if (!isNaN(startMs) && startMs < minStartMs) {
        minStartMs = startMs;
        minStartDateStr = startStr;
      }
    }

    if (endStr !== 'N/A') {
      validItemDates.add(endStr);
      const endMs = new Date(String(item.rentalTo)).getTime();
      if (!isNaN(endMs) && endMs > maxEndMs) {
        maxEndMs = endMs;
        maxEndDateStr = endStr;
      }
    }
  }

  // Check if renderedText explicitly specifies dates in rental duration clauses
  const periodRegex =
    /(?:thời hạn thuê|thời gian thuê|ngày bắt đầu|ngày giao nhận|thời gian giao nhận|giao nhận và hoàn trả)[^\n\r]{0,140}/gi;
  let periodMatch: RegExpExecArray | null;
  while ((periodMatch = periodRegex.exec(renderedText)) !== null) {
    const datesInClause = extractDatesFromText(periodMatch[0]);
    for (const d of datesInClause) {
      if (!validItemDates.has(d)) {
        contradictions.push(
          `RENTAL_DATE_MISMATCH: Date ${d} in rendered terms does not match any item rental date in snapshot in Asia/Ho_Chi_Minh (${Array.from(validItemDates).join(', ')})`,
        );
      }
    }

    // If the clause mentions dates, verify it does not miss the expected start or end dates
    if (datesInClause.length >= 2) {
      if (minStartDateStr && !datesInClause.includes(minStartDateStr)) {
        contradictions.push(
          `RENTAL_PERIOD_START_MISMATCH: Period clause specifies [${datesInClause.join(', ')}] but expected start date is ${minStartDateStr}`,
        );
      }
      if (maxEndDateStr && !datesInClause.includes(maxEndDateStr)) {
        contradictions.push(
          `RENTAL_PERIOD_END_MISMATCH: Period clause specifies [${datesInClause.join(', ')}] but expected end date is ${maxEndDateStr}`,
        );
      }
    }
  }

  return {
    consistent: contradictions.length === 0,
    contradictions,
    warnings,
  };
}
