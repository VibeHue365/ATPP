import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ContractDocumentPreview } from '../src/components/contracts/ContractDocumentPreview';

describe('P0 Verification: Customer Contract A4 Preview reflects Approved Provider Policies', () => {
  const sampleSnapshotWithStructuredPolicies = {
    booking: {
      bookingCode: 'BK-HUE-2026-99',
      customerFullName: 'Nguyễn Văn Khách',
    },
    provider: {
      businessName: 'Huế Áo Dài Studio',
      address: {
        addressLine: '45 Lê Lợi, Phú Hội, Thành phố Huế',
        ward: 'Phú Hội',
        district: 'Thành phố Huế',
        city: 'Thừa Thiên Huế',
      },
      phone: '0988777666',
      email: 'info@hueaodai.vn',
    },
    customer: {
      fullName: 'Nguyễn Văn Khách',
      email: 'khach@vibehue.vn',
      phone: '0912345678',
      address: '12 Nguyễn Tri Phương, Phú Nhuận, Thành phố Huế',
    },
    providerItems: [
      {
        productTitle: 'Áo Dài Cung Đình Huế Thêu Tay',
        variantLabel: 'Size M - Đỏ Hoàng Cung',
        quantity: 1,
        rentalPrice: 166665,
        unitPrice: 166665,
        depositAmount: 11111,
        replacementValue: 2000000,
        rentalFrom: '2026-11-15T08:00:00.000Z',
        rentalTo: '2026-11-18T18:00:00.000Z',
        pickupReturnLocation: '45 Lê Lợi, Phú Hội, Thành phố Huế',
      },
    ],
    pricing: {
      bookingSummary: {
        rentalTotal: 166665,
        subTotal: 166665,
        depositTotal: 11111,
        voucherDiscountTotal: 0,
        discountAmount: 0,
        grandTotal: 177776,
      },
    },
    policies: {
      providerPolicyVersion: 1,
      providerGarmentCare: {
        allowIroning: true,
        allowWashing: false,
        prohibitedActions: [
          'Xịt nước hoa trực tiếp lên tơ tằm',
          'Dùng kim băng kim loại làm tưa lụa',
          'Tự ý cắt chỉ hoặc sửa chữa phom dáng',
        ],
        specialNotes: 'Bảo quản nơi khô ráo, tránh ánh nắng trực tiếp.',
      },
      providerLateReturn: {
        gracePeriodHours: 2,
        hourlyLateFee: 20000,
        dailyLateFee: 100000,
        maxLateDaysAllowed: 3,
      },
      providerDamageCompensation: {
        minorDamageFee: 50000,
        moderateDamagePercent: 20,
        severeDamageOrLossPercent: 100,
        disputeResolutionNotes: 'Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.',
      },
      providerCancellationPolicy: {
        refundRules: [
          { daysBeforeRental: 3, refundPercentage: 100 },
          { daysBeforeRental: 1, refundPercentage: 50 },
          { daysBeforeRental: 0, refundPercentage: 0 },
        ],
        cancellationNotes: 'Tiền cọc luôn hoàn 100% nếu hủy trước khi nhận đồ. Phí hủy chỉ tính trên tiền thuê.',
      },
      providerCustomTermsText: 'Khách hàng vui lòng đồng kiểm trang phục kỹ lưỡng khi nhận hàng.',
    },
  };

  it('1. Renders all 4 approved provider policy groups into Customer A4 Preview with accurate numbers', () => {
    const { container } = render(
      <ContractDocumentPreview
        contractId="contract-hue-001"
        contractCode="VH-HD-2026-0001"
        version={1}
        bookingCode="BK-HUE-2026-99"
        renderedText={JSON.stringify({ snapshot: sampleSnapshotWithStructuredPolicies })}
        snapshot={sampleSnapshotWithStructuredPolicies}
      />,
    );

    const fullText = container.textContent || '';

    // Header & Version
    expect(fullText).toContain('VH-HD-2026-0001');
    expect(fullText).toContain('v1 (Đã duyệt)');

    // Group A: Garment Care
    expect(fullText).toContain('QUY ĐỊNH BẢO QUẢN ÁO DÀI');
    expect(fullText).toContain('Được phép sử dụng bàn ủi hơi nước ở nhiệt độ an toàn.');
    expect(fullText).toContain('Bên B KHÔNG tự ý giặt; Bên A chịu trách nhiệm giặt hấp');
    expect(fullText).toContain('Xịt nước hoa trực tiếp lên tơ tằm; Dùng kim băng kim loại làm tưa lụa; Tự ý cắt chỉ hoặc sửa chữa phom dáng.');
    expect(fullText).toContain('Bảo quản nơi khô ráo, tránh ánh nắng trực tiếp.');

    // Group B: Late Return
    expect(fullText).toContain('QUY ĐỊNH HOÀN TRẢ VÀ BIỂU PHÍ TRỄ HẠN');
    expect(fullText).toContain('2 giờ');
    expect(fullText).toMatch(/20\.000\s*đ\/giờ/);
    expect(fullText).toMatch(/100\.000\s*đ\/ngày/);
    expect(fullText).toContain('3 ngày');

    // Group C: Damage Compensation
    expect(fullText).toContain('BỒI THƯỜNG HƯ HỎNG, MẤT MÁT');
    expect(fullText).toMatch(/50\.000\s*đ\/lỗi/);
    expect(fullText).toContain('20% Giá trị bồi hoàn trang phục (400.000 đ trên tổng giá trị bồi hoàn 2.000.000 đ)');
    expect(fullText).toContain('100% Giá trị bồi hoàn trang phục (2.000.000 đ trên tổng giá trị bồi hoàn 2.000.000 đ)');
    expect(fullText).not.toContain('BUSINESS_APPROVAL_REQUIRED');
    expect(fullText).toContain('Hỗ trợ giải quyết tranh chấp: Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.');

    // Group D: Cancellation Policy & Refund
    expect(fullText).toContain('CHÍNH SÁCH HỦY ĐƠN VÀ HOÀN TIỀN');
    expect(fullText).toContain('Hủy trước thời điểm bắt đầu thuê từ 3 ngày (72 giờ) trở lên: Hoàn trả 100% tiền thuê.');
    expect(fullText).toContain('Hủy trước thời điểm bắt đầu thuê từ 1 ngày (24 giờ) đến dưới 3 ngày (72 giờ): Hoàn trả 50% tiền thuê.');
    expect(fullText).toContain('Hủy trong vòng dưới 1 ngày (dưới 24 giờ) trước thời điểm bắt đầu thuê: Hoàn trả 0% tiền thuê');
    expect(fullText).toContain('Tiền cọc luôn hoàn 100% nếu hủy trước khi nhận đồ.');

    // Custom terms & execution
    expect(fullText).toContain('Khách hàng vui lòng đồng kiểm trang phục kỹ lưỡng khi nhận hàng.');
    expect(fullText).toContain('formedAt');
    expect(fullText).toContain('effectiveAt');
    expect(fullText).toContain('paidAt');
    expect(fullText).toContain('toàn vẹn kỹ thuật');

    // Invariant: Unapproved platform 72h fallback rule MUST NOT appear when approved provider policy exists
    expect(fullText).not.toContain('Quy định bảo vệ từ Sàn VibeHue: Cho phép hủy miễn phí trước 72 giờ');
  });

  it('2. Financial amounts match exact test values: 166.665 đ, 11.111 đ, 177.776 đ', () => {
    const { container } = render(
      <ContractDocumentPreview
        contractId="contract-hue-001"
        contractCode="VH-HD-2026-0001"
        renderedText={JSON.stringify({ snapshot: sampleSnapshotWithStructuredPolicies })}
        snapshot={sampleSnapshotWithStructuredPolicies}
      />,
    );

    const fullText = container.textContent || '';

    // Rental total: 166.665 đ
    expect(fullText).toMatch(/166\.665\s*đ/);

    // Deposit total: 11.111 đ
    expect(fullText).toMatch(/11\.111\s*đ/);

    // Grand total: 177.776 đ
    expect(fullText).toMatch(/177\.776\s*đ/);
  });

  it('3. Address is deduplicated and not repeated', () => {
    const { container } = render(
      <ContractDocumentPreview
        contractId="contract-hue-001"
        contractCode="VH-HD-2026-0001"
        renderedText={JSON.stringify({ snapshot: sampleSnapshotWithStructuredPolicies })}
        snapshot={sampleSnapshotWithStructuredPolicies}
      />,
    );

    const fullText = container.textContent || '';
    expect(fullText).toContain('45 Lê Lợi');
    expect(fullText).not.toContain('Phú Hội, Phú Hội');
    expect(fullText).not.toContain('Thành phố Huế, Thành phố Huế');
  });

  it('4. Legacy policy snapshot fallback works gracefully without crash', () => {
    const legacySnapshot = {
      ...sampleSnapshotWithStructuredPolicies,
      policies: {
        providerRental: 'Quy định thuê trang phục theo niêm yết shop.',
        providerCancellation: 'Hủy trước 48h hoàn 100% cọc.',
      },
    };

    const { container } = render(
      <ContractDocumentPreview
        contractId="contract-hue-legacy"
        contractCode="VH-HD-LEGACY"
        renderedText={JSON.stringify({ snapshot: legacySnapshot })}
        snapshot={legacySnapshot}
      />,
    );

    const fullText = container.textContent || '';
    expect(fullText).toContain('Quy định thuê trang phục theo niêm yết shop.');
    expect(fullText).toContain('Hủy trước 48h hoàn 100% cọc.');
  });
});
