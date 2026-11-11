import { Types } from 'mongoose';
import {
  ContractPaymentBinding,
  PaymentPurpose,
} from '../schemas/payment.schema';
import {
  contractIntentKey,
  paymentMatchesBinding,
} from './contract-payment-binding';

describe('V2 payment binding', () => {
  const bookingId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const contractId = new Types.ObjectId();
  const contractVersionId = new Types.ObjectId();
  const hash = 'a'.repeat(64);
  const binding = (): ContractPaymentBinding => ({
    bindingVersion: 1,
    flowVersion: 2,
    bookingId,
    amount: 100,
    currency: 'VND',
    purpose: PaymentPurpose.FullPayment,
    bookingFingerprint: hash,
    boundAt: new Date(),
    versions: [
      {
        contractId,
        contractVersionId,
        providerId,
        contentHash: hash,
        bookingFingerprint: hash,
      },
    ],
  });

  it('keeps retry identity stable across timestamps and rejects changed amount/version', () => {
    const first = binding();
    const later = { ...binding(), boundAt: new Date(Date.now() + 1000) };
    expect(contractIntentKey(first)).toBe(contractIntentKey(later));
    expect(contractIntentKey({ ...later, amount: 101 })).not.toBe(
      contractIntentKey(first),
    );
    expect(
      contractIntentKey({
        ...later,
        versions: [
          { ...later.versions[0], contractVersionId: new Types.ObjectId() },
        ],
      }),
    ).not.toBe(contractIntentKey(first));
  });

  it('requires outer payment fields and embedded binding to agree', () => {
    const expected = binding();
    const payment = {
      bookingId,
      amount: 100,
      purpose: PaymentPurpose.FullPayment,
      contractBinding: expected,
      contractIntentKey: contractIntentKey(expected),
    };
    expect(paymentMatchesBinding(payment, expected)).toBe(true);
    expect(paymentMatchesBinding({ ...payment, amount: 101 }, expected)).toBe(
      false,
    );
    expect(
      paymentMatchesBinding(
        { ...payment, contractBinding: { ...expected, amount: 101 } },
        expected,
      ),
    ).toBe(false);
  });
});
