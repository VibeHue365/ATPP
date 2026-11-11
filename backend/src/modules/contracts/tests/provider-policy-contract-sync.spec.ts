import { buildContractTermsLines, ContractPdfGenerator } from '../contract-pdf-generator';
import { validateContractConsistency } from '../contract-consistency-validator';
import { hashContract } from '../canonical-contract';
import { ContractSnapshotService } from '../contract-snapshot.service';
import { Types } from 'mongoose';

describe('P0 Verification: Provider Policy Sync into Contract Terms & PDF Generator', () => {
  const sampleStructuredPolicies = {
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
  };

  const sampleSnapshot: any = {
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
      phoneNumber: '0912345678',
      defaultAddress: '12 Nguyễn Tri Phương, Phú Nhuận, Thành phố Huế',
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
      rentalTotal: 166665,
      subTotal: 166665,
      depositTotal: 11111,
      voucherDiscountTotal: 0,
      discountAmount: 0,
      grandTotal: 177776,
    },
    policies: sampleStructuredPolicies,
    template: {
      version: 'ao-dai-rental-v2',
      title: 'Hợp đồng điện tử thuê trang phục Áo Dài',
    },
  };

  it('1. buildContractTermsLines generates all 4 approved policy groups with authoritative terms', () => {
    const lines = buildContractTermsLines(sampleStructuredPolicies, sampleSnapshot.providerItems);
    const fullText = lines.join('\n');

    // Group A: Garment Care
    expect(fullText).toContain('ĐIỀU 2: NGHĨA VỤ CỦA BÊN THUÊ VÀ QUY ĐỊNH BẢO QUẢN ÁO DÀI (BÊN B)');
    expect(fullText).toContain('Được phép sử dụng bàn ủi hơi nước ở nhiệt độ an toàn.');
    expect(fullText).toContain('Quy định giặt trang phục: Bên B KHÔNG tự ý giặt; Bên A chịu trách nhiệm giặt hấp, xử lý chuyên dụng sau khi nhận lại.');
    expect(fullText).toContain('Xịt nước hoa trực tiếp lên tơ tằm; Dùng kim băng kim loại làm tưa lụa; Tự ý cắt chỉ hoặc sửa chữa phom dáng.');
    expect(fullText).toContain('Bảo quản nơi khô ráo, tránh ánh nắng trực tiếp.');

    // Group B: Late Return (Reference to Part II, faithful to approved numbers)
    expect(fullText).toContain('ĐIỀU 3: QUY ĐỊNH HOÀN TRẢ VÀ BIỂU PHÍ TRỄ HẠN');
    expect(fullText).toContain('Phần II');
    expect(fullText).toContain('Thời gian ân hạn: 2 giờ');
    expect(fullText).toContain('Biểu phí phạt trễ hạn: Áp dụng tương ứng theo hình thức thuê');
    expect(fullText).toMatch(/20\.000\s*đ\/giờ/);
    expect(fullText).toMatch(/100\.000\s*đ\/ngày/);
    expect(fullText).toContain('Thời gian trễ tối đa cho phép: 3 ngày.');
    expect(fullText).toContain('chuyển sang quy trình xử lý vi phạm hợp đồng');
    expect(fullText).not.toContain('tự động coi là mất');

    // Group C: Damage Compensation (Clear basis, concrete calculations, NO technical placeholders)
    expect(fullText).toContain('ĐIỀU 4: TIỀN ĐẶT CỌC VÀ BỒI THƯỜNG HƯ HỎNG, MẤT MÁT');
    expect(fullText).toMatch(/Phí xử lý hư hỏng nhẹ.*50\.000\s*đ\/lỗi/);
    expect(fullText).toContain('20% Giá trị bồi hoàn trang phục (400.000 đ trên tổng giá trị bồi hoàn 2.000.000 đ)');
    expect(fullText).toContain('100% Giá trị bồi hoàn trang phục (2.000.000 đ trên tổng giá trị bồi hoàn 2.000.000 đ)');
    expect(fullText).not.toContain('BUSINESS_APPROVAL_REQUIRED');
    expect(fullText).not.toContain('trọng tài thương mại');
    expect(fullText).not.toContain('cơ quan trọng tài');

    // Group D: Cancellation Policy & Refund (Non-overlapping tiers, faithful to approved notes)
    expect(fullText).toContain('ĐIỀU 5: CHÍNH SÁCH HỦY ĐƠN VÀ HOÀN TIỀN');
    expect(fullText).toContain('Hủy trước thời điểm bắt đầu thuê từ 3 ngày (72 giờ) trở lên: Hoàn trả 100% tiền thuê.');
    expect(fullText).toContain('Hủy trước thời điểm bắt đầu thuê từ 1 ngày (24 giờ) đến dưới 3 ngày (72 giờ): Hoàn trả 50% tiền thuê.');
    expect(fullText).toContain('Hủy trong vòng dưới 1 ngày (dưới 24 giờ) trước thời điểm bắt đầu thuê: Hoàn trả 0% tiền thuê');
    expect(fullText).toContain('Lưu ý hủy đơn từ Shop: Tiền cọc luôn hoàn 100% nếu hủy trước khi nhận đồ.');
    expect(fullText).toContain('Thời điểm xác định yêu cầu hủy: Tính theo thời điểm (timestamp) hệ thống');

    // Custom terms & execution
    expect(fullText).toContain('ĐIỀU 6: ĐIỀU KHOẢN BỔ SUNG CỦA BÊN CHO THUÊ');
    expect(fullText).toContain('Khách hàng vui lòng đồng kiểm trang phục kỹ lưỡng khi nhận hàng.');
    expect(fullText).toContain('ĐIỀU 7: HIỆU LỰC HỢP ĐỒNG VÀ XÁC NHẬN GIAO KẾT ĐIỆN TỬ');
    expect(fullText).toContain('formedAt');
    expect(fullText).toContain('effectiveAt');
    expect(fullText).toContain('paidAt');
    expect(fullText).toContain('toàn vẹn kỹ thuật');

    // Invariant: Unapproved platform 72-hour fallback rule MUST NOT be present
    expect(fullText).not.toContain('Quy định bảo vệ từ Sàn VibeHue: Cho phép hủy miễn phí trước 72 giờ');
  });

  it('2. Legacy fallback returns standard legacy lines without crashing', () => {
    const legacyPolicies = {
      providerRental: 'Quy định thuê đồ từ cửa hàng Huế.',
      providerCancellation: 'Hủy trước 24h mất 50% cọc.',
    };

    const lines = buildContractTermsLines(legacyPolicies);
    const fullText = lines.join('\n');

    expect(fullText).toContain('Quy định thuê đồ từ cửa hàng Huế.');
    expect(fullText).toContain('Hủy trước 24h mất 50% cọc.');
    expect(fullText).not.toContain('72 giờ');
  });

  it('3. ContractConsistencyValidator evaluates snapshot and terms as consistent', () => {
    const renderedText = JSON.stringify({ snapshot: sampleSnapshot });
    const result = validateContractConsistency(sampleSnapshot, renderedText);

    expect(result.consistent).toBe(true);
    expect(result.contradictions).toHaveLength(0);
  });

  it('4. ContractPdfGenerator generates valid PDF buffer containing approved policy values', async () => {
    const { buffer, sha256 } = await ContractPdfGenerator.generate({
      contractCode: 'VH-HD-2026-0001',
      versionNumber: 1,
      versionId: '64b0f0000000000000000011',
      contentHash: hashContract({ template: sampleSnapshot.template, snapshot: sampleSnapshot }),
      bookingFingerprint: hashContract({
        booking: sampleSnapshot.booking,
        providerItems: sampleSnapshot.providerItems,
        pricing: sampleSnapshot.pricing,
      }),
      renderedText: JSON.stringify({ snapshot: sampleSnapshot }),
      snapshot: sampleSnapshot,
      consent: {
        customerConsentAt: new Date('2026-11-14T10:00:00.000Z'),
        customerAuthMethod: 'APP_SESSION',
        customerUserId: '64b0f0000000000000000002',
        providerAcceptanceRegulation: 'QC-VIBEHUE-2026-V1',
      },
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(10000);
    expect(sha256).toMatch(/^[a-f0-9]{64}$/);
    // Standard PDF header signature
    expect(buffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
  }, 15000);

  it('5. ContractSnapshotService fails closed when replacementValue is missing on structured policy', async () => {
    const provId = new Types.ObjectId('64b0f0000000000000000001');
    const custId = new Types.ObjectId('64b0f0000000000000000002');
    const prodId = new Types.ObjectId('64b0f0000000000000000003');
    const bkId = new Types.ObjectId('64b0f0000000000000000004');
    const itemId = new Types.ObjectId('64b0f0000000000000000005');
    const pvId = new Types.ObjectId('64b0f0000000000000000006');

    const mockDb = {
      collection: jest.fn((name: string) => ({
        findOne: jest.fn(async () => {
          if (name === 'users') {
            return { _id: custId, profile: { fullName: 'Khách Hàng' } };
          }
          if (name === 'providers') {
            return { _id: provId, businessName: 'Studio Huế', policies: {} };
          }
          if (name === 'products') {
            // Product exists and is approved, but replacementValue is missing
            return {
              _id: prodId,
              providerId: provId,
              name: 'Áo dài',
              slug: 'ao-dai',
              moderationStatus: 'APPROVED',
            };
          }
          if (name === 'provider_contract_policies') {
            return {
              versionNumber: 1,
              status: 'APPROVED',
              garmentCare: sampleStructuredPolicies.providerGarmentCare,
              lateReturn: sampleStructuredPolicies.providerLateReturn,
              damageCompensation: sampleStructuredPolicies.providerDamageCompensation,
              cancellationPolicy: sampleStructuredPolicies.providerCancellationPolicy,
            };
          }
          return null;
        }),
      })),
    };
    const mockConn = { db: mockDb } as any;
    const mockResolver = {
      clearCache: jest.fn(),
      getActivePolicyByCode: jest.fn().mockResolvedValue({ code: 'P', version: 1, value: {} }),
    } as any;

    const snapshotService = new ContractSnapshotService(mockConn, mockResolver);
    const mockContext = {
      booking: {
        _id: bkId,
        bookingCode: 'BK-TEST-001',
        customerId: custId,
        providerIds: [provId],
        bookingType: 'AODAI_RENTAL',
        pricingSummary: { subTotal: 100000, grandTotal: 100000 },
      },
      rentalProviderIds: [provId],
      rentalItems: [
        {
          _id: itemId,
          providerId: provId,
          productId: prodId,
          priceVersionId: pvId,
          unitPrice: 100000,
          depositAmount: 50000,
          quantity: 1,
          selectedSize: 'M',
          rentalFrom: new Date(),
          rentalTo: new Date(Date.now() + 86400000),
          pickupReturnLocationSnapshot: { address: 'Huế' },
          // replacementValue is deliberately omitted
        },
      ],
    } as any;

    await expect(
      snapshotService.build(mockContext, provId, { version: 'v1' } as any),
    ).rejects.toThrow('CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING');
  });

  it('6. ContractSnapshotService fails closed with UNAPPROVED when product has replacementValue but is not approved', async () => {
    const provId = new Types.ObjectId('64b0f0000000000000000001');
    const custId = new Types.ObjectId('64b0f0000000000000000002');
    const prodId = new Types.ObjectId('64b0f0000000000000000003');
    const bkId = new Types.ObjectId('64b0f0000000000000000004');
    const itemId = new Types.ObjectId('64b0f0000000000000000005');
    const pvId = new Types.ObjectId('64b0f0000000000000000006');

    const mockDb = {
      collection: jest.fn((name: string) => ({
        findOne: jest.fn(async () => {
          if (name === 'users') return { _id: custId, profile: { fullName: 'Khách Hàng' } };
          if (name === 'providers') return { _id: provId, businessName: 'Studio Huế', policies: {} };
          if (name === 'products') {
            return {
              _id: prodId,
              providerId: provId,
              name: 'Áo dài',
              slug: 'ao-dai',
              replacementValue: 2000000,
              moderationStatus: 'PENDING_REVIEW', // Not approved!
            };
          }
          if (name === 'provider_contract_policies') {
            return {
              versionNumber: 1,
              status: 'APPROVED',
              garmentCare: sampleStructuredPolicies.providerGarmentCare,
              lateReturn: sampleStructuredPolicies.providerLateReturn,
              damageCompensation: sampleStructuredPolicies.providerDamageCompensation,
              cancellationPolicy: sampleStructuredPolicies.providerCancellationPolicy,
            };
          }
          return null;
        }),
      })),
    };
    const mockConn = { db: mockDb } as any;
    const mockResolver = {
      clearCache: jest.fn(),
      getActivePolicyByCode: jest.fn().mockResolvedValue({ code: 'P', version: 1, value: {} }),
    } as any;

    const snapshotService = new ContractSnapshotService(mockConn, mockResolver);
    const mockContext = {
      booking: {
        _id: bkId,
        bookingCode: 'BK-TEST-002',
        customerId: custId,
        providerIds: [provId],
        bookingType: 'AODAI_RENTAL',
        pricingSummary: { subTotal: 100000, grandTotal: 100000 },
      },
      rentalProviderIds: [provId],
      rentalItems: [
        {
          _id: itemId,
          providerId: provId,
          productId: prodId,
          priceVersionId: pvId,
          unitPrice: 100000,
          depositAmount: 50000,
          quantity: 1,
          selectedSize: 'M',
          rentalFrom: new Date(),
          rentalTo: new Date(Date.now() + 86400000),
          pickupReturnLocationSnapshot: { address: 'Huế' },
        },
      ],
    } as any;

    await expect(
      snapshotService.build(mockContext, provId, { version: 'v1' } as any),
    ).rejects.toThrow('CONTRACT_PRODUCT_REPLACEMENT_VALUE_UNAPPROVED');
  });

  it('7. ContractSnapshotService resolves replacementValue from approved Product when BookingItem lacks it', async () => {
    const provId = new Types.ObjectId('64b0f0000000000000000001');
    const custId = new Types.ObjectId('64b0f0000000000000000002');
    const prodId = new Types.ObjectId('64b0f0000000000000000003');
    const bkId = new Types.ObjectId('64b0f0000000000000000004');
    const itemId = new Types.ObjectId('64b0f0000000000000000005');
    const pvId = new Types.ObjectId('64b0f0000000000000000006');

    const mockDb = {
      collection: jest.fn((name: string) => ({
        findOne: jest.fn(async () => {
          if (name === 'users') return { _id: custId, profile: { fullName: 'Khách Hàng' } };
          if (name === 'providers') return { _id: provId, businessName: 'Studio Huế', policies: {} };
          if (name === 'products') {
            return {
              _id: prodId,
              providerId: provId,
              name: 'Áo dài',
              slug: 'ao-dai',
              replacementValue: 2500000,
              moderationStatus: 'APPROVED',
            };
          }
          if (name === 'provider_contract_policies') {
            return {
              versionNumber: 1,
              status: 'APPROVED',
              garmentCare: sampleStructuredPolicies.providerGarmentCare,
              lateReturn: sampleStructuredPolicies.providerLateReturn,
              damageCompensation: sampleStructuredPolicies.providerDamageCompensation,
              cancellationPolicy: sampleStructuredPolicies.providerCancellationPolicy,
            };
          }
          return null;
        }),
      })),
    };
    const mockConn = { db: mockDb } as any;
    const mockResolver = {
      clearCache: jest.fn(),
      getActivePolicyByCode: jest.fn().mockResolvedValue({ code: 'P', version: 1, value: {} }),
    } as any;

    const snapshotService = new ContractSnapshotService(mockConn, mockResolver);
    const mockContext = {
      booking: {
        _id: bkId,
        bookingCode: 'BK-TEST-003',
        customerId: custId,
        providerIds: [provId],
        bookingType: 'AODAI_RENTAL',
        pricingSummary: { subTotal: 100000, grandTotal: 100000 },
      },
      rentalProviderIds: [provId],
      rentalItems: [
        {
          _id: itemId,
          providerId: provId,
          productId: prodId,
          priceVersionId: pvId,
          unitPrice: 100000,
          depositAmount: 50000,
          quantity: 1,
          selectedSize: 'M',
          rentalFrom: new Date(),
          rentalTo: new Date(Date.now() + 86400000),
          pickupReturnLocationSnapshot: { address: 'Huế' },
          replacementValue: null, // BookingItem lacks it
        },
      ],
    } as any;

    const snapshot = await snapshotService.build(mockContext, provId, { version: 'v1' } as any);
    expect(snapshot.providerItems[0].replacementValue).toBe(2500000);
  });

  it('8. ContractSnapshotService does NOT require replacementValue if policy does not use percentage damage compensation', async () => {
    const provId = new Types.ObjectId('64b0f0000000000000000001');
    const custId = new Types.ObjectId('64b0f0000000000000000002');
    const prodId = new Types.ObjectId('64b0f0000000000000000003');
    const bkId = new Types.ObjectId('64b0f0000000000000000004');
    const itemId = new Types.ObjectId('64b0f0000000000000000005');
    const pvId = new Types.ObjectId('64b0f0000000000000000006');

    const mockDb = {
      collection: jest.fn((name: string) => ({
        findOne: jest.fn(async () => {
          if (name === 'users') return { _id: custId, profile: { fullName: 'Khách Hàng' } };
          if (name === 'providers') return { _id: provId, businessName: 'Studio Huế', policies: {} };
          if (name === 'products') {
            return {
              _id: prodId,
              providerId: provId,
              name: 'Áo dài',
              slug: 'ao-dai',
              // No replacementValue
            };
          }
          if (name === 'provider_contract_policies') {
            return {
              versionNumber: 1,
              status: 'APPROVED',
              garmentCare: sampleStructuredPolicies.providerGarmentCare,
              lateReturn: sampleStructuredPolicies.providerLateReturn,
              damageCompensation: {
                minorDamageFee: 50000,
                moderateDamagePercent: 0, // No percentage compensation!
                severeDamageOrLossPercent: 0,
                disputeResolutionNotes: 'Bồi thường thỏa thuận theo biên bản.',
              },
              cancellationPolicy: sampleStructuredPolicies.providerCancellationPolicy,
            };
          }
          return null;
        }),
      })),
    };
    const mockConn = { db: mockDb } as any;
    const mockResolver = {
      clearCache: jest.fn(),
      getActivePolicyByCode: jest.fn().mockResolvedValue({ code: 'P', version: 1, value: {} }),
    } as any;

    const snapshotService = new ContractSnapshotService(mockConn, mockResolver);
    const mockContext = {
      booking: {
        _id: bkId,
        bookingCode: 'BK-TEST-004',
        customerId: custId,
        providerIds: [provId],
        bookingType: 'AODAI_RENTAL',
        pricingSummary: { subTotal: 100000, grandTotal: 100000 },
      },
      rentalProviderIds: [provId],
      rentalItems: [
        {
          _id: itemId,
          providerId: provId,
          productId: prodId,
          priceVersionId: pvId,
          unitPrice: 100000,
          depositAmount: 50000,
          quantity: 1,
          selectedSize: 'M',
          rentalFrom: new Date(),
          rentalTo: new Date(Date.now() + 86400000),
          pickupReturnLocationSnapshot: { address: 'Huế' },
        },
      ],
    } as any;

    // Must succeed without throwing
    const snapshot = await snapshotService.build(mockContext, provId, { version: 'v1' } as any);
    expect(snapshot.providerItems[0].replacementValue).toBeNull();
  });

  it('9. Multiple items in booking: fails closed if any item lacks required replacementValue', async () => {
    const provId = new Types.ObjectId('64b0f0000000000000000001');
    const custId = new Types.ObjectId('64b0f0000000000000000002');
    const prod1Id = new Types.ObjectId('64b0f0000000000000000003');
    const prod2Id = new Types.ObjectId('64b0f0000000000000000007');
    const bkId = new Types.ObjectId('64b0f0000000000000000004');
    const item1Id = new Types.ObjectId('64b0f0000000000000000005');
    const item2Id = new Types.ObjectId('64b0f0000000000000000008');
    const pvId = new Types.ObjectId('64b0f0000000000000000006');

    const mockDb = {
      collection: jest.fn((name: string) => ({
        findOne: jest.fn(async (query: any) => {
          if (name === 'users') return { _id: custId, profile: { fullName: 'Khách Hàng' } };
          if (name === 'providers') return { _id: provId, businessName: 'Studio Huế', policies: {} };
          if (name === 'products') {
            if (query._id?.equals(prod1Id)) {
              return { _id: prod1Id, providerId: provId, name: 'Áo dài 1', replacementValue: 2000000, moderationStatus: 'APPROVED' };
            }
            if (query._id?.equals(prod2Id)) {
              return { _id: prod2Id, providerId: provId, name: 'Áo dài 2', replacementValue: null }; // Missing!
            }
          }
          if (name === 'provider_contract_policies') {
            return {
              versionNumber: 1,
              status: 'APPROVED',
              garmentCare: sampleStructuredPolicies.providerGarmentCare,
              lateReturn: sampleStructuredPolicies.providerLateReturn,
              damageCompensation: sampleStructuredPolicies.providerDamageCompensation,
              cancellationPolicy: sampleStructuredPolicies.providerCancellationPolicy,
            };
          }
          return null;
        }),
      })),
    };
    const mockConn = { db: mockDb } as any;
    const mockResolver = {
      clearCache: jest.fn(),
      getActivePolicyByCode: jest.fn().mockResolvedValue({ code: 'P', version: 1, value: {} }),
    } as any;

    const snapshotService = new ContractSnapshotService(mockConn, mockResolver);
    const mockContext = {
      booking: {
        _id: bkId,
        bookingCode: 'BK-TEST-005',
        customerId: custId,
        providerIds: [provId],
        bookingType: 'AODAI_RENTAL',
        pricingSummary: { subTotal: 200000, grandTotal: 200000 },
      },
      rentalProviderIds: [provId],
      rentalItems: [
        {
          _id: item1Id,
          providerId: provId,
          productId: prod1Id,
          priceVersionId: pvId,
          unitPrice: 100000,
          depositAmount: 50000,
          quantity: 1,
          selectedSize: 'M',
          rentalFrom: new Date(),
          rentalTo: new Date(Date.now() + 86400000),
          pickupReturnLocationSnapshot: { address: 'Huế' },
          replacementValue: 2000000,
        },
        {
          _id: item2Id,
          providerId: provId,
          productId: prod2Id,
          priceVersionId: pvId,
          unitPrice: 100000,
          depositAmount: 50000,
          quantity: 1,
          selectedSize: 'L',
          rentalFrom: new Date(),
          rentalTo: new Date(Date.now() + 86400000),
          pickupReturnLocationSnapshot: { address: 'Huế' },
          replacementValue: null,
        },
      ],
    } as any;

    await expect(
      snapshotService.build(mockContext, provId, { version: 'v1' } as any),
    ).rejects.toThrow('CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING');
  });
});
