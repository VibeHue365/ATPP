import {
  validateContractConsistency,
  formatShortDateVn,
} from '../contract-consistency-validator';
import { ContractVersionSnapshot } from '../schemas/contract-version.schema';

describe('contract-consistency-validator (Asia/Ho_Chi_Minh timezone)', () => {
  const baseSnapshot: ContractVersionSnapshot = {
    bookingId: '64b0f0000000000000000001',
    customerId: '64b0f0000000000000000002',
    providerId: '64b0f0000000000000000003',
    bookingType: 'AODAI_RENTAL',
    bookingItemIds: ['item-1'],
    booking: { bookingCode: 'VH-CONSISTENCY-01' },
    customer: { fullName: 'Nguyễn Văn A' },
    provider: { businessName: 'Áo Dài Hà Nội' },
    providerItems: [
      {
        productName: 'Áo Dài Nhật Bình',
        rentalFrom: '2026-11-20T08:00:00+07:00',
        rentalTo: '2026-11-23T18:00:00+07:00',
        rentalPrice: 5970000,
        depositAmount: 10950000,
      },
    ],
    pricing: {
      rentalTotal: 5970000,
      depositTotal: 10950000,
      voucherDiscountTotal: 500000,
      grandTotal: 16420000,
    },
    policies: {},
    template: { version: 'v1' },
  };

  describe('Positive Consistency Verification', () => {
    it('1. Returns consistent=true when terms match snapshot deposit and dates in Asia/Ho_Chi_Minh', () => {
      const consistentTerms = `
ĐIỀU 1: PHẠM VI THUÊ
ĐIỀU 2: THỜI HẠN THUÊ VÀ ĐỊA ĐIỂM GIAO NHẬN
Thời hạn thuê bắt đầu từ 20/11/2026 đến 23/11/2026.
ĐIỀU 3: TIỀN ĐẶT CỌC
Tiền đặt cọc giữ đồ là 10.950.000 đ.
      `;

      const result = validateContractConsistency(baseSnapshot, consistentTerms);
      expect(result.consistent).toBe(true);
      expect(result.contradictions).toHaveLength(0);
    });

    it('2. Multi-item consistency: validates multiple items matching the overall rental period', () => {
      const multiItemSnapshot: ContractVersionSnapshot = {
        ...baseSnapshot,
        providerItems: [
          {
            productName: 'Áo Dài Hoàng Cung',
            rentalFrom: '2026-11-20T08:00:00+07:00',
            rentalTo: '2026-11-23T18:00:00+07:00',
          },
          {
            productName: 'Phụ kiện Khăn Đóng',
            rentalFrom: '2026-11-20T08:00:00+07:00',
            rentalTo: '2026-11-23T18:00:00+07:00',
          },
        ],
      };

      const terms = `
Thời gian thuê: 20/11/2026 đến 23/11/2026.
Tiền cọc: 10.950.000 đ.
      `;

      const result = validateContractConsistency(multiItemSnapshot, terms);
      expect(result.consistent).toBe(true);
    });
  });

  describe('Standard Contract Negative Tests', () => {
    it('3. Detects deposit mismatch when terms contain contradictory deposit amount', () => {
      const contradictoryTerms = `
ĐIỀU 2: THỜI HẠN THUÊ
Thời hạn thuê bắt đầu từ 20/11/2026 đến 23/11/2026.
ĐIỀU 3: TIỀN ĐẶT CỌC
Tiền đặt cọc giữ đồ là 1.700.000 đ.
      `;

      const result = validateContractConsistency(
        baseSnapshot,
        contradictoryTerms,
      );
      expect(result.consistent).toBe(false);
      expect(
        result.contradictions.some((c) => c.includes('DEPOSIT_MISMATCH')),
      ).toBe(true);
    });

    it('4. Detects rental dates mismatch when terms contain contradictory dates', () => {
      const contradictoryDatesTerms = `
ĐIỀU 2: THỜI HẠN THUÊ VÀ ĐỊA ĐIỂM
Thời hạn thuê bắt đầu từ 15/11/2026 đến 18/11/2026.
ĐIỀU 3: TIỀN ĐẶT CỌC
Tiền đặt cọc giữ đồ là 10.950.000 đ.
      `;

      const result = validateContractConsistency(
        baseSnapshot,
        contradictoryDatesTerms,
      );
      expect(result.consistent).toBe(false);
      expect(
        result.contradictions.some((c) => c.includes('RENTAL_DATE_MISMATCH')),
      ).toBe(true);
    });

    it('5. Detects rental total contradiction when terms contain incorrect rental sum', () => {
      const mismatchedRentalTerms = `
Thời gian thuê: 20/11/2026 đến 23/11/2026.
Tổng tiền thuê: 1.200.000 đ.
Tiền cọc: 10.950.000 đ.
      `;

      const result = validateContractConsistency(
        baseSnapshot,
        mismatchedRentalTerms,
      );
      expect(result.consistent).toBe(false);
      expect(
        result.contradictions.some((c) => c.includes('RENTAL_TOTAL_MISMATCH')),
      ).toBe(true);
    });

    it('6. Blocks empty items list in snapshot', () => {
      const emptyItemsSnapshot: ContractVersionSnapshot = {
        ...baseSnapshot,
        providerItems: [],
      };

      const result = validateContractConsistency(
        emptyItemsSnapshot,
        'Thời gian: 20/11/2026',
      );
      expect(result.consistent).toBe(false);
      expect(result.contradictions.some((c) => c.includes('ITEMS_EMPTY'))).toBe(
        true,
      );
    });
  });

  describe('Timezone & Midnight Boundary Regression Tests', () => {
    it('7. Strictly evaluates Asia/Ho_Chi_Minh (+07:00) day transition at 17:00 UTC', () => {
      // 16:59:59 UTC on Nov 18 -> 23:59:59 ICT on Nov 18
      const beforeMidnightUtc = '2026-11-18T16:59:59.000Z';
      expect(formatShortDateVn(beforeMidnightUtc)).toBe('18/11/2026');

      // 17:00:00 UTC on Nov 18 -> 00:00:00 ICT on Nov 19
      const atMidnightUtc = '2026-11-18T17:00:00.000Z';
      expect(formatShortDateVn(atMidnightUtc)).toBe('19/11/2026');

      // 18:00:00 UTC on Nov 18 -> 01:00:00 ICT on Nov 19
      const afterMidnightUtc = '2026-11-18T18:00:00.000Z';
      expect(formatShortDateVn(afterMidnightUtc)).toBe('19/11/2026');
    });

    it('8. Rejects 18/11/2026 in renderedText when timestamp is 18:00 UTC (which is 19/11/2026 in ICT)', () => {
      const snapshotWithUtcEvening: ContractVersionSnapshot = {
        ...baseSnapshot,
        providerItems: [
          {
            productName: 'Áo Dài',
            rentalFrom: '2026-11-15T08:00:00+07:00',
            rentalTo: '2026-11-18T18:00:00.000Z', // In Vietnam this is 19/11/2026!
          },
        ],
        pricing: { depositTotal: 1700000 },
      };

      // If text says 18/11/2026, it must FAIL because in Vietnam time the rental ends on 19/11/2026!
      const contradictoryText = `
Thời hạn thuê bắt đầu từ 15/11/2026 đến 18/11/2026.
Tiền đặt cọc: 1.700.000 đ.
      `;

      const result = validateContractConsistency(
        snapshotWithUtcEvening,
        contradictoryText,
      );
      expect(result.consistent).toBe(false);
      expect(
        result.contradictions.some((c) => c.includes('RENTAL_DATE_MISMATCH')),
      ).toBe(true);
    });

    it('9. Rejects incomplete period clause missing the expected end date', () => {
      const incompleteClauseTerms = `
ĐIỀU 2: THỜI HẠN THUÊ
Thời hạn thuê bắt đầu từ 20/11/2026 đến 22/11/2026.
Tiền cọc: 10.950.000 đ.
      `;

      const result = validateContractConsistency(
        baseSnapshot,
        incompleteClauseTerms,
      );
      expect(result.consistent).toBe(false);
      expect(
        result.contradictions.some(
          (c) =>
            c.includes('RENTAL_DATE_MISMATCH') ||
            c.includes('RENTAL_PERIOD_END_MISMATCH'),
        ),
      ).toBe(true);
    });
  });

  describe('Multi-Item and Long-Terms Negative Tests', () => {
    it('10. Multi-item negative: detects contradictory deposit total in multi-item contract', () => {
      const multiItemSnapshot: ContractVersionSnapshot = {
        ...baseSnapshot,
        providerItems: [
          {
            productName: 'Áo Dài 1',
            rentalFrom: '2026-11-20T08:00:00+07:00',
            rentalTo: '2026-11-23T18:00:00+07:00',
          },
          {
            productName: 'Áo Dài 2',
            rentalFrom: '2026-11-20T08:00:00+07:00',
            rentalTo: '2026-11-23T18:00:00+07:00',
          },
        ],
        pricing: { depositTotal: 10950000 },
      };

      const badTerms = `
Thời gian thuê: 20/11/2026 đến 23/11/2026.
Tiền đặt cọc: 5.000.000 đ.
      `;

      const result = validateContractConsistency(multiItemSnapshot, badTerms);
      expect(result.consistent).toBe(false);
      expect(
        result.contradictions.some((c) => c.includes('DEPOSIT_MISMATCH')),
      ).toBe(true);
    });

    it('11. Long-terms negative: detects contradictory deposit amount buried in detailed legal clauses', () => {
      const longTermsNegative = `
ĐIỀU 1: PHẠM VI ÁP DỤNG
ĐIỀU 2: THỜI HẠN THUÊ
Thời hạn thuê bắt đầu từ 20/11/2026 đến 23/11/2026.
ĐIỀU 3: BẢO QUẢN
ĐIỀU 4: TIỀN ĐẶT CỌC VÀ HOÀN CỌC
Tiền đặt cọc giữ đồ trị giá 1.700.000 đ được giữ an toàn tại tài khoản Escrow.
ĐIỀU 5: PHẠT QUÁ HẠN
ĐIỀU 6: TRANH CHẤP
      `;

      const result = validateContractConsistency(
        baseSnapshot,
        longTermsNegative,
      );
      expect(result.consistent).toBe(false);
      expect(
        result.contradictions.some((c) => c.includes('DEPOSIT_MISMATCH')),
      ).toBe(true);
    });
  });
});
