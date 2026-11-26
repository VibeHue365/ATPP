export interface ContractCancellationRule {
  daysBeforeRental: number;
  refundPercentage: number;
}

export interface ContractCancellationItem {
  id: string;
  providerId: string;
  rentalFrom: Date | string;
  unitPrice: number;
  depositAmount: number;
  quantity: number;
  discountAmount?: number;
}

export interface ItemCancellationBreakdown {
  itemId: string;
  hoursBeforeRental: number;
  refundPercentage: number;
  rentalRefund: number;
  depositRefund: number;
  penaltyAmount: number;
}

export function resolveContractRefundPercentage(
  hoursBeforeRental: number,
  rules: ContractCancellationRule[],
): number {
  const sorted = rules
    .filter(
      (rule) =>
        Number.isFinite(rule.daysBeforeRental) &&
        Number.isFinite(rule.refundPercentage),
    )
    .slice()
    .sort((a, b) => b.daysBeforeRental - a.daysBeforeRental);
  const matched = sorted.find(
    (rule) => hoursBeforeRental >= rule.daysBeforeRental * 24,
  );
  return Math.min(100, Math.max(0, matched?.refundPercentage ?? 0));
}

export function calculateItemizedContractCancellation(input: {
  items: ContractCancellationItem[];
  rulesByProvider: Map<string, ContractCancellationRule[]>;
  now: Date;
}): {
  refundAmount: number;
  penaltyAmount: number;
  breakdown: ItemCancellationBreakdown[];
} {
  let refundAmount = 0;
  let penaltyAmount = 0;
  const breakdown: ItemCancellationBreakdown[] = [];

  for (const item of input.items) {
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
    const grossRental = Math.max(0, Number(item.unitPrice) || 0) * quantity;
    const discount = Math.min(
      grossRental,
      Math.max(0, Number(item.discountAmount) || 0),
    );
    const netRental = grossRental - discount;
    const deposit = Math.max(0, Number(item.depositAmount) || 0) * quantity;
    const rentalFrom = new Date(item.rentalFrom);
    const hoursBeforeRental = Number.isNaN(rentalFrom.getTime())
      ? Number.NEGATIVE_INFINITY
      : (rentalFrom.getTime() - input.now.getTime()) / (60 * 60 * 1000);
    const refundPercentage = resolveContractRefundPercentage(
      hoursBeforeRental,
      input.rulesByProvider.get(item.providerId) || [],
    );
    const rentalRefund = Math.round(
      netRental * (refundPercentage / 100),
    );
    // The approved contract promises the deposit back when cancellation occurs
    // before the item's pickup time. A cancellation after pickup/no-show does not.
    const depositRefund = hoursBeforeRental > 0 ? deposit : 0;
    const itemPenalty = netRental - rentalRefund + (deposit - depositRefund);

    refundAmount += rentalRefund + depositRefund;
    penaltyAmount += itemPenalty;
    breakdown.push({
      itemId: item.id,
      hoursBeforeRental,
      refundPercentage,
      rentalRefund,
      depositRefund,
      penaltyAmount: itemPenalty,
    });
  }

  return { refundAmount, penaltyAmount, breakdown };
}
