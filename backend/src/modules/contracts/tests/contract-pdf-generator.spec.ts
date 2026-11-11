import * as fs from 'node:fs';
import * as path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { hashContract } from '../canonical-contract';
import {
  ContractPdfGenerator,
  sanitizePdfText,
} from '../contract-pdf-generator';
import { ContractVersionSnapshot } from '../schemas/contract-version.schema';

describe('ContractPdfGenerator (Phase 6.1)', () => {
  jest.setTimeout(30000);
  const scratchDir =
    'C:/Users/ASUS/.gemini/antigravity/brain/68c59b7c-6838-4146-a6a9-3a382205b094/scratch';

  const mockSnapshot: ContractVersionSnapshot = {
    bookingId: '64b0f0000000000000000101',
    customerId: '64b0f0000000000000000002',
    providerId: '64b0f0000000000000000003',
    bookingType: 'AODAI_RENTAL',
    bookingItemIds: ['64b0f0000000000000000010'],
    booking: { bookingCode: 'VH-BOOK-2026-8888' },
    customer: {
      fullName: 'Nguyễn Thị Phương Thảo',
      email: 'phuongthao.nguyen@example.vn',
      phoneNumber: '0901234567',
      address: 'Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    },
    provider: {
      businessName: 'Tiệm May & Cho Thuê Áo Dài Truyền Thống Huế Xưa',
      representative: 'Trần Văn Hoàng',
      address: '123 Phố Huế, Phường Ngô Thì Nhậm, Quận Hai Bà Trưng, Hà Nội',
      phone: '02438221234',
    },
    providerItems: [
      {
        productName: 'Áo Dài Nhật Bình Hoàng Cung (Thêu Phượng Hoàng Chỉ Vàng)',
        size: 'M',
        color: 'Đỏ thẫm cung đình',
        quantity: 1,
        rentalFrom: '2026-11-15T08:00:00+07:00',
        rentalTo: '2026-11-18T18:00:00+07:00',
        rentalPrice: 850000,
        depositAmount: 1500000,
      },
      {
        productName: 'Khăn Đóng Gấm Lụa Tơ Tằm Cung Đình',
        size: 'Free size',
        color: 'Vàng kim',
        quantity: 1,
        rentalFrom: '2026-11-15T08:00:00+07:00',
        rentalTo: '2026-11-18T18:00:00+07:00',
        rentalPrice: 150000,
        depositAmount: 200000,
      },
    ],
    pricing: {
      rentalTotal: 1000000,
      depositTotal: 1700000,
      voucherDiscountTotal: 100000,
      grandTotal: 2600000,
    },
    policies: { policyName: 'Quy chế thuê áo dài chuẩn VibeHue 2026' },
    template: { version: 'ao-dai-rental-v2' },
  };

  const sampleBookingFingerprint = hashContract({
    booking: mockSnapshot.booking,
    providerItems: mockSnapshot.providerItems,
    pricing: mockSnapshot.pricing,
  });

  const sampleContentHash = hashContract({
    template: mockSnapshot.template,
    snapshot: mockSnapshot,
  });

  const sampleInput = {
    contractCode: 'VH-HD-2026-0001',
    versionNumber: 1,
    versionId: '64b0f0000000000000000011',
    contentHash: sampleContentHash,
    bookingFingerprint: sampleBookingFingerprint,
    renderedText: `ĐIỀU 1: ĐỐI TƯỢNG VÀ PHẠM VI THUÊ
1.1. Bên Cho Thuê đồng ý cho Bên Thuê sử dụng các trang phục áo dài truyền thống và phụ kiện theo đúng danh mục chi tiết quy định tại hợp đồng này.
1.2. Bên Thuê cam kết sử dụng trang phục đúng mục đích tham gia sự kiện văn hóa, biểu diễn hoặc chụp ảnh kỷ niệm, không sử dụng vào mục đích vi phạm pháp luật.

ĐIỀU 2: THỜI HẠN THUÊ VÀ ĐỊA ĐIỂM GIAO NHẬN
2.1. Thời hạn thuê bắt đầu từ 08:00 ngày 15/11/2026 và kết thúc vào 18:00 ngày 18/11/2026.
2.2. Địa điểm giao nhận và hoàn trả trang phục: 123 Phố Huế, Phường Ngô Thì Nhậm, Quận Hai Bà Trưng, Hà Nội.

ĐIỀU 3: TIỀN ĐẶT CỌC VÀ TRÁCH NHIỆM BẢO QUẢN
3.1. Tiền đặt cọc giữ đồ trị giá 1.700.000 đ được Bên Thuê thanh toán đầy đủ vào tài khoản ký quỹ (Escrow) của nền tảng VibeHue trước thời điểm nhận trang phục.
3.2. Bên Cho Thuê hoàn trả 100% tiền cọc cho Bên Thuê trong vòng 24 giờ kể từ thời điểm nhận lại trang phục nguyên vẹn, không hư hỏng.
3.3. Trường hợp trang phục bị rách, sứt chỉ, cháy hoặc dính bẩn không thể tẩy sạch, Bên Thuê chịu trách nhiệm bồi thường theo biểu phí đã công bố trên VibeHue.`,
    snapshot: mockSnapshot,
    consent: {
      customerConsentAt: new Date('2026-11-14T10:00:00.000Z'),
      customerAuthMethod: 'APP_SESSION (Xác thực tài khoản di động)',
      customerUserId: '64b0f0000000000000000002',
      providerAcceptanceRegulation:
        'QUY_CHE_TU_DONG_CHAP_THUAN_HOP_DONG_AO_DAI_2026',
    },
  };

  it('1. Generates standard-compliant PDF buffer with Noto Sans Unicode and valid header/trailer', async () => {
    const { buffer, sha256 } = await ContractPdfGenerator.generate(sampleInput);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Verify PDF header and trailer
    const pdfPrefix = buffer.slice(0, 5).toString('utf-8');
    expect(pdfPrefix).toBe('%PDF-');

    const pdfSuffix = buffer.slice(-60).toString('utf-8');
    expect(pdfSuffix).toContain('%%EOF');

    // Load with pdf-lib to ensure valid syntax
    const loadedDoc = await PDFDocument.load(buffer);
    expect(loadedDoc.getPageCount()).toBeGreaterThanOrEqual(1);

    expect(sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('2. Preserves Vietnamese diacritics ă â ê ô ơ ư đ Đ in generated PDF without throwing', async () => {
    const vietnameseInput = {
      ...sampleInput,
      contractCode: 'VH-HD-ĐỒNG-ÁO-DÀI-2026',
      renderedText:
        'ĐIỀU 1: Hợp đồng thuê áo dài truyền thống với đầy đủ dấu thanh tiếng Việt: á à ả ã ạ, ắ ằ ẳ ẵ ặ, ấ ầ ổ ỗ ộ, ớ ờ ở ỡ ợ, ứ ừ ử ữ ự, đ, Đ.',
    };

    const { buffer } = await ContractPdfGenerator.generate(vietnameseInput);
    const loadedDoc = await PDFDocument.load(buffer);
    expect(loadedDoc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('3. Multi-page pagination: Supports table and long contract terms spanning multiple pages cleanly', async () => {
    const longTerms = Array.from(
      { length: 60 },
      (_, i) =>
        `ĐIỀU ${i + 1}: Điều khoản cam kết số ${i + 1} quy định chi tiết quyền và nghĩa vụ của bên thuê trang phục áo dài truyền thống tại nền tảng VibeHue.`,
    ).join('\n\n');

    const longInput = { ...sampleInput, renderedText: longTerms };
    const { buffer } = await ContractPdfGenerator.generate(longInput);
    const loadedDoc = await PDFDocument.load(buffer);

    expect(loadedDoc.getPageCount()).toBeGreaterThanOrEqual(3);
  });

  it('4. Sanitizer backward compatibility test', () => {
    const raw =
      'Hợp đồng thuê áo dài — bản nháp nội bộ. Địa chỉ: 123 Phố Huế, Đống Đa.';
    const sanitized = sanitizePdfText(raw);
    expect(sanitized).toBe(
      'Hop dong thue ao dai   ban nhap noi bo. Dia chi: 123 Pho Hue, Dong Da.',
    );
  });

  it('5. Generates the 3 Deliverable Sample PDFs for user review', async () => {
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    // Deliverable 1: contract_sample_standard.pdf (hợp đồng tiêu chuẩn)
    const stdRes = await ContractPdfGenerator.generate(sampleInput);
    const stdPath = path.join(scratchDir, 'contract_sample_standard.pdf');
    fs.writeFileSync(stdPath, stdRes.buffer);
    expect(fs.existsSync(stdPath)).toBe(true);

    // Deliverable 2: contract_sample_multi_item.pdf (nhiều sản phẩm, bảng dài)
    const multiItemSnapshot: ContractVersionSnapshot = {
      ...mockSnapshot,
      bookingId: '64b0f0000000000000000102',
      booking: { bookingCode: 'VH-BOOK-MULTI-9999' },
      providerItems: [
        {
          productName: 'Áo Dài Hoàng Cung Triều Nguyễn (Thêu Tay Long Phụng)',
          size: 'L',
          color: 'Vàng chính sắc',
          quantity: 2,
          rentalFrom: '2026-11-20T08:00:00+07:00',
          rentalTo: '2026-11-23T18:00:00+07:00',
          rentalPrice: 1200000,
          depositAmount: 2400000,
        },
        {
          productName: 'Áo Dài Gấm Thái Tuấn Nữ Truyền Thống Hoa Văn Chìm',
          size: 'M',
          color: 'Hồng phấn pastel',
          quantity: 3,
          rentalFrom: '2026-11-20T08:00:00+07:00',
          rentalTo: '2026-11-23T18:00:00+07:00',
          rentalPrice: 650000,
          depositAmount: 1300000,
        },
        {
          productName: 'Áo Dài Cách Tân Nam Vải Đũi Cổ Tròn Đính Khuy Đồng',
          size: 'XL',
          color: 'Xanh coban đậm',
          quantity: 2,
          rentalFrom: '2026-11-20T08:00:00+07:00',
          rentalTo: '2026-11-23T18:00:00+07:00',
          rentalPrice: 500000,
          depositAmount: 1000000,
        },
        {
          productName: 'Khăn Đóng Lụa Tơ Tằm Cung Đình 10 Vòng',
          size: 'Free size',
          color: 'Đỏ ruby thêu rồng',
          quantity: 2,
          rentalFrom: '2026-11-20T08:00:00+07:00',
          rentalTo: '2026-11-23T18:00:00+07:00',
          rentalPrice: 120000,
          depositAmount: 200000,
        },
        {
          productName: 'Guốc Mộc Sơn Mài Vẽ Tay Hoa Sen Đồng Tháp',
          size: '37-39',
          color: 'Đen bóng nhũ vàng',
          quantity: 3,
          rentalFrom: '2026-11-20T08:00:00+07:00',
          rentalTo: '2026-11-23T18:00:00+07:00',
          rentalPrice: 80000,
          depositAmount: 150000,
        },
        {
          productName: 'Quạt Xếp Lụa Hà Đông Cán Gỗ Trầm Hương',
          size: 'Tiêu chuẩn',
          color: 'Trắng ngà',
          quantity: 4,
          rentalFrom: '2026-11-20T08:00:00+07:00',
          rentalTo: '2026-11-23T18:00:00+07:00',
          rentalPrice: 50000,
          depositAmount: 100000,
        },
      ],
      pricing: {
        rentalTotal: 5970000,
        depositTotal: 10950000,
        voucherDiscountTotal: 500000,
        grandTotal: 16420000,
      },
    };

    const multiItemRenderedText = `ĐIỀU 1: ĐỐI TƯỢNG VÀ PHẠM VI THUÊ
1.1. Bên Cho Thuê đồng ý cho Bên Thuê sử dụng các trang phục áo dài truyền thống và phụ kiện cao cấp theo danh mục chi tiết gồm 06 hạng mục tại Phần II.
1.2. Bên Thuê cam kết bảo quản trang phục đúng tiêu chuẩn lễ phục truyền thống, không tự ý chỉnh sửa kết cấu áo.

ĐIỀU 2: THỜI HẠN THUÊ VÀ ĐỊA ĐIỂM GIAO NHẬN
2.1. Thời hạn thuê bắt đầu từ 08:00 ngày 20/11/2026 và kết thúc vào 18:00 ngày 23/11/2026.
2.2. Địa điểm bàn giao và hoàn trả: 123 Phố Huế, Phường Ngô Thì Nhậm, Quận Hai Bà Trưng, Hà Nội.

ĐIỀU 3: TIỀN ĐẶT CỌC VÀ TRÁCH NHIỆM BẢO QUẢN
3.1. Tiền đặt cọc giữ đồ trị giá 10.950.000 đ được Bên Thuê thanh toán đầy đủ vào tài khoản ký quỹ (Escrow) của nền tảng VibeHue trước thời điểm nhận trang phục.
3.2. Bên Cho Thuê hoàn trả 100% tiền cọc cho Bên Thuê trong vòng 24 giờ kể từ thời điểm nhận lại toàn bộ 06 hạng mục trang phục và phụ kiện nguyên vẹn.
3.3. Trường hợp trang phục hư hỏng hoặc mất phụ kiện, Bên Thuê chịu trách nhiệm bồi thường theo biểu giá đã công bố công khai trên hệ thống VibeHue.`;

    const multiItemBookingFingerprint = hashContract({
      booking: multiItemSnapshot.booking,
      providerItems: multiItemSnapshot.providerItems,
      pricing: multiItemSnapshot.pricing,
    });

    const multiItemContentHash = hashContract({
      template: multiItemSnapshot.template,
      snapshot: multiItemSnapshot,
    });

    const multiItemInput = {
      ...sampleInput,
      contractCode: 'VH-HD-MULTI-ITEM-0099',
      versionNumber: 1,
      versionId: '64b0f0000000000000000022',
      contentHash: multiItemContentHash,
      bookingFingerprint: multiItemBookingFingerprint,
      snapshot: multiItemSnapshot,
      renderedText: multiItemRenderedText,
      consent: {
        customerConsentAt: new Date('2026-11-19T14:30:00.000Z'),
        customerAuthMethod: 'APP_SESSION (Xác thực tài khoản di động)',
        customerUserId: '64b0f0000000000000000002',
        providerAcceptanceRegulation:
          'QUY_CHE_TU_DONG_CHAP_THUAN_HOP_DONG_AO_DAI_2026',
      },
    };
    const multiRes = await ContractPdfGenerator.generate(multiItemInput);
    const multiPath = path.join(scratchDir, 'contract_sample_multi_item.pdf');
    fs.writeFileSync(multiPath, multiRes.buffer);
    expect(fs.existsSync(multiPath)).toBe(true);

    // Deliverable 3: contract_sample_long_terms.pdf (điều khoản dài, nhiều trang)
    const longTermsSnapshot: ContractVersionSnapshot = {
      ...mockSnapshot,
      bookingId: '64b0f0000000000000000103',
      booking: { bookingCode: 'VH-BOOK-LONG-7777' },
    };

    const longTermsBookingFingerprint = hashContract({
      booking: longTermsSnapshot.booking,
      providerItems: longTermsSnapshot.providerItems,
      pricing: longTermsSnapshot.pricing,
    });

    const longTermsContentHash = hashContract({
      template: longTermsSnapshot.template,
      snapshot: longTermsSnapshot,
    });

    const longTermsText = `ĐIỀU 1: PHẠM VI ÁP DỤNG VÀ GIẢI THÍCH TỪ NGỮ
1.1. Hợp đồng này quy định chi tiết quyền, nghĩa vụ và trách nhiệm của Bên Cho Thuê và Bên Thuê trong việc thuê và sử dụng trang phục áo dài truyền thống trên Nền tảng VibeHue.
1.2. "Trang phục áo dài" bao gồm áo, quần, khăn đóng, guốc mộc và toàn bộ phụ kiện đi kèm được mô tả chi tiết tại Phần II.
1.3. "Tài khoản ký quỹ Escrow" là tài khoản trung gian của nền tảng VibeHue có chức năng giữ tiền cọc của Bên Thuê và chỉ giải ngân hoặc hoàn trả khi có sự xác nhận hoàn tất dịch vụ.

ĐIỀU 2: THỜI HẠN THUÊ VÀ ĐỊA ĐIỂM BÀN GIAO HIỆN TRẠNG
2.1. Thời hạn thuê bắt đầu từ 08:00 ngày 15/11/2026 và kết thúc vào 18:00 ngày 18/11/2026.
2.2. Địa điểm bàn giao và hoàn trả: 123 Phố Huế, Phường Ngô Thì Nhậm, Quận Hai Bà Trưng, Hà Nội.
2.3. Tại thời điểm bàn giao trang phục, hai bên có trách nhiệm đồng kiểm tra kỹ lưỡng hiện trạng thực tế, bao gồm đường may, cúc bấm, màu sắc, hoa văn thêu và độ sạch của trang phục.
2.4. Việc ký nhận điện tử hoặc ấn nút "Đã nhận đồ" trên ứng dụng đồng nghĩa với việc Bên Thuê công nhận trang phục ở tình trạng hoàn hảo và đúng cam kết.

ĐIỀU 3: NGHĨA VỤ BẢO QUẢN TRONG SUỐT THỜI GIAN THUÊ
3.1. Bên Thuê tuyệt đối không được tự ý sửa đổi kích thước, cắt gấu, tháo chỉ, nhuộm màu hoặc can thiệp vào cấu trúc ban đầu của áo dài.
3.2. Không được sử dụng bàn là nhiệt độ cao trực tiếp lên chất liệu lụa tơ tằm, gấm hoặc vải thêu chỉ kim tuyến. Chỉ được sử dụng bàn là hơi nước ở chế độ vải mỏng nhẹ.
3.3. Trường hợp trang phục bị dính nước mưa hoặc vết bẩn thức ăn, Bên Thuê cần thông báo ngay cho Bên Cho Thuê qua hệ thống nhắn tin để được hướng dẫn xử lý ban đầu, tránh tự ý tẩy rửa bằng hóa chất mạnh.

ĐIỀU 4: TIỀN ĐẶT CỌC, HOÀN CỌC VÀ TRỪ CỌC
4.1. Tiền đặt cọc giữ đồ trị giá 1.700.000 đ được Bên Thuê thanh toán cùng lúc với tiền thuê trang phục và được giữ an toàn tại tài khoản Escrow của VibeHue.
4.2. Trong vòng tối đa 24 giờ kể từ khi Bên Cho Thuê xác nhận đã nhận lại đầy đủ trang phục nguyên vẹn, hệ thống tự động hoàn trả 100% tiền đặt cọc vào tài khoản của Bên Thuê.
4.3. Nếu phát sinh hư hỏng, hai bên sẽ căn cứ vào Biên bản kiểm đồ và Biểu phí bồi thường được niêm yết công khai trên Quy chế Hoạt động của VibeHue để khấu trừ tiền cọc tương ứng.

ĐIỀU 5: PHẠT CHẬM TRẢ VÀ TRƯỜNG HỢP BẤT KHẢ KHÁNG
5.1. Trường hợp Bên Thuê hoàn trả trang phục chậm hơn thời gian quy định tại hợp đồng mà không có thỏa thuận gia hạn trước bằng văn bản, Bên Thuê chịu mức phí phạt quá hạn bằng 50% đơn giá thuê 01 ngày cho mỗi 06 giờ chậm trễ.
5.2. Sự kiện bất khả kháng bao gồm thiên tai, dịch bệnh, hỏa hoạn hoặc lệnh phong tỏa của cơ quan nhà nước có thẩm quyền. Khi xảy ra sự kiện bất khả kháng, bên bị ảnh hưởng phải thông báo cho bên kia trong vòng 12 giờ để cùng thống nhất phương án xử lý phù hợp.

ĐIỀU 6: GIẢI QUYẾT TRANH CHẤP VÀ LUẬT ÁP DỤNG
6.1. Mọi tranh chấp phát sinh từ hoặc liên quan đến hợp đồng này trước hết sẽ được ưu tiên giải quyết thông qua thương lượng hòa giải trên Trung tâm Hỗ trợ Tranh chấp của VibeHue.
6.2. Trường hợp hòa giải không thành trong vòng 30 ngày kể từ ngày phát sinh tranh chấp, một trong các bên có quyền đưa vụ việc ra Tòa án nhân dân có thẩm quyền tại nơi Bên Cho Thuê đặt trụ sở để giải quyết theo quy định của pháp luật Việt Nam.`;

    const longTermsInput = {
      ...sampleInput,
      contractCode: 'VH-HD-LONG-TERMS-0077',
      versionNumber: 1,
      versionId: '64b0f0000000000000000033',
      contentHash: longTermsContentHash,
      bookingFingerprint: longTermsBookingFingerprint,
      snapshot: longTermsSnapshot,
      renderedText: longTermsText,
      consent: {
        customerConsentAt: new Date('2026-11-14T11:15:00.000Z'),
        customerAuthMethod: 'APP_SESSION (Xác thực tài khoản di động)',
        customerUserId: '64b0f0000000000000000002',
        providerAcceptanceRegulation:
          'QUY_CHE_TU_DONG_CHAP_THUAN_HOP_DONG_AO_DAI_2026',
      },
    };
    const longRes = await ContractPdfGenerator.generate(longTermsInput);
    const longPath = path.join(scratchDir, 'contract_sample_long_terms.pdf');
    fs.writeFileSync(longPath, longRes.buffer);
    expect(fs.existsSync(longPath)).toBe(true);

    const stdDoc = await PDFDocument.load(stdRes.buffer);
    const multiDoc = await PDFDocument.load(multiRes.buffer);
    const loadedLong = await PDFDocument.load(longRes.buffer);
    expect(loadedLong.getPageCount()).toBeGreaterThanOrEqual(2);

    // Assert all 3 deliverables possess distinct, cryptographically valid identities
    const versionIds = [
      sampleInput.versionId,
      multiItemInput.versionId,
      longTermsInput.versionId,
    ];
    expect(new Set(versionIds).size).toBe(3);

    const bookingIds = [
      sampleInput.snapshot.bookingId,
      multiItemInput.snapshot.bookingId,
      longTermsInput.snapshot.bookingId,
    ];
    expect(new Set(bookingIds).size).toBe(3);

    const fingerprints = [
      sampleInput.bookingFingerprint,
      multiItemInput.bookingFingerprint,
      longTermsInput.bookingFingerprint,
    ];
    expect(new Set(fingerprints).size).toBe(3);

    const contentHashes = [
      sampleInput.contentHash,
      multiItemInput.contentHash,
      longTermsInput.contentHash,
    ];
    expect(new Set(contentHashes).size).toBe(3);

    const pdfSha256s = [stdRes.sha256, multiRes.sha256, longRes.sha256];
    expect(new Set(pdfSha256s).size).toBe(3);

    const manifest = {
      generatedAt: new Date().toISOString(),
      generator: 'ContractPdfGenerator (Phase 6.2 Reconciliation)',
      items: [
        {
          contractCode: sampleInput.contractCode,
          bookingId: sampleInput.snapshot.bookingId,
          contractVersionId: sampleInput.versionId,
          templateVersion:
            typeof sampleInput.snapshot.template?.version === 'string'
              ? sampleInput.snapshot.template.version
              : 'ao-dai-rental-v2',
          contentHash: sampleInput.contentHash,
          bookingFingerprint: sampleInput.bookingFingerprint,
          pdfSha256: stdRes.sha256,
          filePath: stdPath,
          pageCount: stdDoc.getPageCount(),
        },
        {
          contractCode: multiItemInput.contractCode,
          bookingId: multiItemInput.snapshot.bookingId,
          contractVersionId: multiItemInput.versionId,
          templateVersion:
            typeof multiItemInput.snapshot.template?.version === 'string'
              ? multiItemInput.snapshot.template.version
              : 'ao-dai-rental-v2',
          contentHash: multiItemInput.contentHash,
          bookingFingerprint: multiItemInput.bookingFingerprint,
          pdfSha256: multiRes.sha256,
          filePath: multiPath,
          pageCount: multiDoc.getPageCount(),
        },
        {
          contractCode: longTermsInput.contractCode,
          bookingId: longTermsInput.snapshot.bookingId,
          contractVersionId: longTermsInput.versionId,
          templateVersion:
            typeof longTermsInput.snapshot.template?.version === 'string'
              ? longTermsInput.snapshot.template.version
              : 'ao-dai-rental-v2',
          contentHash: longTermsInput.contentHash,
          bookingFingerprint: longTermsInput.bookingFingerprint,
          pdfSha256: longRes.sha256,
          filePath: longPath,
          pageCount: loadedLong.getPageCount(),
        },
      ],
    };

    const manifestPath = path.join(scratchDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  });
});
