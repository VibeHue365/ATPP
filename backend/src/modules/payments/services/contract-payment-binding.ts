import { ContractPaymentBinding, Payment } from '../schemas/payment.schema';
import { hashContract } from '../../contracts/canonical-contract';

/** BoundAt is evidence, but not part of the retry identity. */
export function contractIntentKey(binding: ContractPaymentBinding): string {
  return hashContract({
    bindingVersion: binding.bindingVersion,
    flowVersion: binding.flowVersion,
    bookingId: binding.bookingId.toString(),
    amount: binding.amount,
    currency: binding.currency,
    purpose: binding.purpose,
    bookingFingerprint: binding.bookingFingerprint,
    versions: binding.versions
      .map((version) => ({
        contractId: version.contractId.toString(),
        contractVersionId: version.contractVersionId.toString(),
        providerId: version.providerId.toString(),
        contentHash: version.contentHash,
        bookingFingerprint: version.bookingFingerprint,
      }))
      .sort((left, right) => left.providerId.localeCompare(right.providerId)),
  });
}

export function paymentMatchesBinding(
  payment: Pick<
    Payment,
    'bookingId' | 'amount' | 'purpose' | 'contractBinding' | 'contractIntentKey'
  >,
  binding: ContractPaymentBinding,
): boolean {
  return (
    payment.bookingId.toString() === binding.bookingId.toString() &&
    payment.amount === binding.amount &&
    payment.purpose === binding.purpose &&
    payment.contractIntentKey === contractIntentKey(binding) &&
    !!payment.contractBinding &&
    contractIntentKey(payment.contractBinding) === contractIntentKey(binding)
  );
}
