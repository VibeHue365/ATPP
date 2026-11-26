import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { ContractVersionSnapshot } from './schemas/contract-version.schema';
import {
  IncidentCompensationMethod,
  resolveDamageCompensationRules,
} from './schemas/provider-contract-policy.schema';
import {
  validateContractConsistency,
  formatDateVn,
  formatShortDateVn,
} from './contract-consistency-validator';
import { composeLocationAddress } from '../bookings/utils/location-address';

export interface ContractPdfInput {
  contractCode: string;
  versionNumber: number;
  versionId: string;
  contentHash: string;
  bookingFingerprint: string;
  renderedText: string;
  snapshot: ContractVersionSnapshot;
  consent?: {
    customerConsentAt?: Date | null;
    customerAuthMethod?: string | null;
    customerUserId?: string | null;
    providerAcceptanceRegulation?: string | null;
  } | null;
}

/** Legacy diacritics sanitizer kept for backward compatibility */
export function sanitizePdfText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ');
}

// Professional Palette: Muted navy, dark charcoal, slate grey, light borders
const COLOR_PRIMARY = rgb(0.12, 0.23, 0.42); // Navy accent (#1E3A6C)
const COLOR_TEXT_MAIN = rgb(0.1, 0.12, 0.15); // Charcoal text (#1A1F26)
const COLOR_TEXT_MUTED = rgb(0.38, 0.44, 0.52); // Slate grey (#617084)
const COLOR_BORDER = rgb(0.82, 0.86, 0.9); // Light divider (#D1DCE6)
const COLOR_BG_BOX = rgb(0.96, 0.97, 0.99); // Subtle panel fill (#F5F8FA)
const COLOR_BG_HEADER = rgb(0.93, 0.95, 0.98); // Table header fill (#EDF2F7)

function str(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return fallback;
}

function formatAddress(addr: unknown, fallback = ''): string {
  if (!addr) return fallback;
  if (typeof addr === 'string') return addr.trim() || fallback;
  if (typeof addr === 'object' && addr !== null) {
    const a = addr as Record<string, unknown>;
    if (typeof a.fullAddress === 'string' && a.fullAddress.trim()) {
      return a.fullAddress.trim();
    }
    const rawLine = (
      (a.addressLine || a.street || a.address || '') as string
    ).trim();
    const ward = ((a.ward || '') as string).trim();
    const district = ((a.district || '') as string).trim();
    const city = ((a.city || a.province || '') as string).trim();

    const composed = composeLocationAddress(rawLine, ward, district, city);
    if (composed) return composed;
  }
  return fallback;
}

export function buildContractTermsLines(
  policies: any,
  items: any[] = [],
): string[] {
  const garmentCare = policies?.providerGarmentCare;
  const lateReturn = policies?.providerLateReturn;
  const damageComp = policies?.providerDamageCompensation;
  const cancelPolicy = policies?.providerCancellationPolicy;
  const customTerms = policies?.providerCustomTermsText;

  const firstItem = items && items[0] ? items[0] : {};
  const totalReplacementVal =
    items && items.length > 0
      ? items.reduce(
          (sum: number, it: any) =>
            sum +
            (Number(it.replacementValue || it.declaredValue) || 0) *
              (Number(it.quantity) || 1),
          0,
        )
      : Number(firstItem.declaredValue || firstItem.replacementValue || 0);

  const lines: string[] = [
    'ĐIỀU 1: QUYỀN VÀ NGHĨA VỤ CỦA BÊN CHO THUÊ (BÊN A)',
    '- Cung cấp trang phục áo dài đúng mẫu mã, màu sắc, kích thước và tiêu chuẩn như đã mô tả trên hệ thống.',
    '- Bàn giao sản phẩm nguyên vẹn, đảm bảo vệ sinh và sẵn sàng sử dụng cho Bên B tại điểm nhận quy định.',
    '- Hoàn trả đầy đủ 100% tiền đặt cọc cho Bên B sau khi nhận lại trang phục nguyên vẹn và đúng hạn thỏa thuận.',
    '',
  ];

  // ĐIỀU 2: BẢO QUẢN ÁO DÀI
  if (garmentCare) {
    lines.push(
      'ĐIỀU 2: NGHĨA VỤ CỦA BÊN THUÊ VÀ QUY ĐỊNH BẢO QUẢN ÁO DÀI (BÊN B)',
    );
    lines.push(
      '- Thanh toán đúng và đủ toàn bộ giá trị hợp đồng gồm tiền thuê và tiền cọc theo phương thức thanh toán của Sàn trước khi nhận đồ.',
    );
    const ironingText = garmentCare.allowIroning
      ? 'Được phép sử dụng bàn ủi hơi nước ở nhiệt độ an toàn.'
      : 'KHÔNG ĐƯỢC PHÉP tự ý là/ủi trang phục.';
    lines.push(`- Quy định ủi/là trang phục: ${ironingText}`);
    const washingText = garmentCare.allowWashing
      ? 'Bên B được phép tự giặt sạch trước khi hoàn trả theo hướng dẫn bảo quản.'
      : 'Bên B KHÔNG tự ý giặt; Bên A chịu trách nhiệm giặt hấp, xử lý chuyên dụng sau khi nhận lại.';
    lines.push(`- Quy định giặt trang phục: ${washingText}`);

    const rawActions = Array.isArray(garmentCare.prohibitedActions)
      ? garmentCare.prohibitedActions
          .map((act: string) => (act || '').trim())
          .filter(Boolean)
      : [];

    if (rawActions.length > 0) {
      lines.push(`- Các hành vi bị nghiêm cấm: ${rawActions.join('; ')}.`);
    } else {
      lines.push(
        '- Các hành vi bị nghiêm cấm: Không tự ý cắt sửa phom dáng, làm rách hỏng hoặc vấy bẩn không thể phục hồi.',
      );
    }
    if (garmentCare.specialNotes) {
      lines.push(
        `- Ghi chú chất liệu đặc thù từ Shop: ${garmentCare.specialNotes}`,
      );
    }
  } else {
    lines.push('ĐIỀU 2: QUYỀN VÀ NGHĨA VỤ CỦA BÊN THUÊ (BÊN B)');
    lines.push(
      '- Thanh toán đúng và đủ giá trị hợp đồng gồm tiền thuê và tiền cọc theo phương thức thanh toán của Sàn.',
    );
    lines.push(
      '- Có trách nhiệm bảo quản trang phục cẩn thận; không tự ý cắt may, chỉnh sửa hoặc làm vấy bẩn hư hại sản phẩm.',
    );
    lines.push(
      `- Hoàn trả trang phục đúng thời hạn và địa điểm đã cam kết. ${policies?.providerRental || 'Thời gian thuê tối đa và quy định phạt quá hạn áp dụng theo chính sách niêm yết.'}`,
    );
  }
  lines.push('');

  // ĐIỀU 3: QUY ĐỊNH TRẢ TRỄ & BẢO VỆ LỊCH HẸN (ĐỒNG BỘ QUY TRÌNH QUÁ HẠN & DOMINO RECOVERY)
  lines.push(
    'ĐIỀU 3: QUY ĐỊNH HOÀN TRẢ, BIỂU PHÍ QUÁ HẠN VÀ BẢO VỆ LỊCH HẸN',
  );
  lines.push(
    '- Thời hạn hoàn trả: Bên B có nghĩa vụ hoàn trả trang phục đúng thời hạn và địa điểm quy định tại Phần II của hợp đồng (không áp dụng thời gian ân hạn miễn phí nếu không có thỏa thuận gia hạn hợp lệ trước hạn trả).',
  );
  lines.push(
    '- Biểu phí quá hạn trả trang phục: Kể từ thời điểm quá hạn, hệ thống áp dụng mức phí trễ hạn lũy tiến là +10% tiền đặt cọc cho mỗi 30 phút trễ (làm tròn lên theo từng chu kỳ 30 phút, tối thiểu 1.000 đ/30 phút), với mức trần tối đa bằng 50% tổng tiền đặt cọc của đơn hàng trong giai đoạn chờ hoàn trả.',
  );
  lines.push(
    '- Các mốc cảnh báo và chế tài tài khoản: Hệ thống gửi thông báo nhắc nhở tại mốc 15 phút và 1 giờ quá hạn. Khi quá hạn từ 2 giờ (T+2h) trở lên, tài khoản Bên B bị tạm khóa quyền tạo đơn thuê mới trên nền tảng TàGo và tiếp tục duy trì thời hạn phạt tạm khóa 03 (ba) ngày kể từ khi hoàn tất trả trang phục và đối soát xong nghĩa vụ quá hạn.',
  );
  lines.push(
    '- Mốc quá hạn 24 giờ và xác nhận mất trang phục (LOST_ITEM): Trường hợp trễ quá 24 giờ mà Bên B chưa hoàn trả trang phục và Bên A đã liên hệ tối thiểu 03 (ba) lần bất thành, Bên A có quyền kích hoạt xác nhận Mất trang phục (LOST_ITEM) theo Điều 4.',
  );
  lines.push(
    '- Bảo vệ lịch hẹn kế tiếp (Cơ chế Domino Recovery): Trường hợp lịch giao trang phục của Bên B bị ảnh hưởng do khách thuê ca trước trả trễ: (i) Bên A / Nền tảng được quyền tự động điều phối trang phục cùng mẫu và kích thước còn trống lịch trong kho để bàn giao đúng hẹn cho Bên B; hoặc (ii) nếu không còn trang phục cùng mẫu/size, hệ thống đề xuất tối đa 03 mẫu tương đương (trong biên độ giá 70%–130%) để Bên B lựa chọn trong vòng 60 phút. Nếu Bên B không đồng ý đổi mẫu hoặc hết 60 phút chưa có phương án thay thế, đơn hàng được hủy và hoàn trả 100% tiền thuê cùng tiền đặt cọc cho Bên B.',
  );
  if (!lateReturn && policies?.providerRental) {
    lines.push(`- Ghi chú vận hành bổ sung từ Shop: ${policies.providerRental}`);
  }
  lines.push('');

  // ĐIỀU 4: TIỀN ĐẶT CỌC VÀ BỒI THƯỜNG
  if (damageComp) {
    lines.push('ĐIỀU 4: TIỀN ĐẶT CỌC VÀ BỒI THƯỜNG HƯ HỎNG, MẤT MÁT');
    lines.push(
      '- Tiền đặt cọc là khoản bảo đảm thực hiện hợp đồng được ghi nhận theo đơn hàng và được hoàn trả đầy đủ khi Bên B hoàn trả trang phục đúng hạn, nguyên vẹn.',
    );

    const resolved = resolveDamageCompensationRules(damageComp);

    const renderTierPdf = (
      tierLabel: string,
      tier: typeof resolved.minorDamage,
    ) => {
      if (tier.method === IncidentCompensationMethod.FIXED_FEE) {
        const feeStr =
          tier.fixedFeeAmount !== null
            ? formatVnd(tier.fixedFeeAmount)
            : 'theo biểu phí đã duyệt';
        const cond = tier.conditionsAndEvidence
          ? ` (Điều kiện: ${tier.conditionsAndEvidence})`
          : '';
        lines.push(`- ${tierLabel}: ${feeStr}/lỗi${cond}.`);
      } else if (
        tier.method === IncidentCompensationMethod.PERCENTAGE_ON_ASSET
      ) {
        const pct = tier.percentageOfAsset ?? 0;
        const compAmt =
          totalReplacementVal > 0 ? totalReplacementVal * (pct / 100) : 0;
        const calcStr =
          totalReplacementVal > 0
            ? ` (${formatVnd(compAmt)} trên tổng giá trị bồi hoàn ${formatVnd(totalReplacementVal)})`
            : ' do Shop niêm yết';
        const cond = tier.conditionsAndEvidence
          ? ` (Điều kiện: ${tier.conditionsAndEvidence})`
          : '';
        lines.push(
          `- ${tierLabel}: ${pct}% Giá trị bồi hoàn trang phục${calcStr}${cond}.`,
        );
      } else if (
        tier.method === IncidentCompensationMethod.ACTUAL_REPAIR_COST
      ) {
        const cond = tier.conditionsAndEvidence
          ? ` Căn cứ: ${tier.conditionsAndEvidence}`
          : '';
        lines.push(
          `- ${tierLabel} (Chi phí thực tế): Bồi thường theo chi phí phục hồi/sửa chữa thực tế căn cứ hóa đơn, chứng từ hợp lệ từ đơn vị chuyên nghiệp.${cond}`,
        );
      } else {
        const cond = tier.conditionsAndEvidence
          ? ` Căn cứ: ${tier.conditionsAndEvidence}`
          : '';
        lines.push(
          `- ${tierLabel} (Thương lượng sự cố): Hai bên đối chiếu hiện trạng và thương lượng số tiền bồi thường dựa trên chứng cứ giao nhận.${cond}`,
        );
      }
    };

    renderTierPdf(
      'Phí xử lý hư hỏng nhẹ (vết bẩn tẩy được, bung chỉ nhẹ, cúc tuột)',
      resolved.minorDamage,
    );
    renderTierPdf(
      'Bồi thường hư hỏng vừa (rách nhỏ dưới 5cm, hỏng phụ liệu cần may vá)',
      resolved.moderateDamage,
    );
    renderTierPdf(
      'Bồi thường hư hỏng nặng (rách vải lớn, biến dạng phom dáng, cháy xém hoặc biến dạng chất liệu)',
      resolved.severeDamage,
    );
    renderTierPdf(
      'Mất trang phục hoặc không thể phục hồi (không hoàn trả hoặc hư hỏng toàn bộ không thể tái sử dụng)',
      resolved.totalLoss,
    );

    if (resolved.incidentNotificationHours) {
      lines.push(
        `- Thời hạn thông báo sự cố: Bên A có trách nhiệm kiểm tra và gửi thông báo sự cố kèm chứng cứ trong vòng ${resolved.incidentNotificationHours} giờ kể từ thời điểm nhận lại trang phục.`,
      );
    }

    lines.push(
      '- Cơ sở bồi thường và xử lý tiền cọc: Tiền đặt cọc là khoản bảo đảm thực hiện hợp đồng. Khi Bên B hoàn trả trang phục quá hạn và Bên A xác nhận hoàn tất nhận lại đồ, các bên thống nhất đối trừ khoản phí phạt quá hạn (tối đa 50% tiền cọc theo biểu phí tại Điều 3) từ tiền đặt cọc để chuyển cho Bên A, phần cọc còn dư (nếu có) được hoàn trả về cho Bên B. Trường hợp phát sinh hư hỏng, việc xử lý bồi thường và đối trừ tiền cọc được thực hiện theo thỏa thuận thống nhất giữa hai bên trên cơ sở các mức bồi thường đã giao kết; trường hợp giá trị thiệt hại vượt quá tiền cọc, Bên B có trách nhiệm thanh toán bổ sung phần chênh lệch cho Bên A theo quy định thỏa thuận.',
    );
    lines.push(
      '- Xử lý trường hợp mất trang phục (LOST_ITEM): Khi đơn hàng bị xác nhận mất trang phục sau quá hạn 24 giờ và tối thiểu 03 lần liên hệ bất thành, 100% tiền đặt cọc được chuyển cho Bên A để bù đắp thiệt hại trang phục; tài khoản Bên B bị khóa vĩnh viễn khỏi nền tảng TàGo và hồ sơ hợp đồng điện tử cùng thông tin định danh (CCCD) được sử dụng làm căn cứ giải quyết theo quy định pháp luật hiện hành.',
    );

    const rawDispute = (
      resolved.disputeResolutionTerms ||
      damageComp.disputeResolutionNotes ||
      ''
    ).trim();
    lines.push(
      `- Hỗ trợ giải quyết tranh chấp: ${rawDispute || 'Khi có tranh chấp hoặc bất đồng về tình trạng trang phục, Nền tảng TàGo đóng vai trò là kênh tiếp nhận phản ánh và hỗ trợ hai bên hòa giải trung gian dựa trên chứng cứ giao nhận, không tự ý phán quyết hay khấu trừ tiền.'}`,
    );
  } else {
    lines.push('ĐIỀU 4: TIỀN ĐẶT CỌC VÀ QUY ĐỊNH BỒI THƯỜNG');
    lines.push(
      '- Tiền đặt cọc là khoản bảo đảm thực hiện hợp đồng theo đơn đặt hàng.',
    );
    lines.push(
      '- Khi hoàn trả trang phục đúng hạn, nguyên vẹn không hỏng hóc, Bên B sẽ được nhận lại toàn bộ tiền cọc.',
    );
    lines.push(
      '- Đối soát trả muộn & mất trang phục: Khi Bên B trả muộn và Bên A xác nhận nhận lại đồ, các bên thống nhất đối trừ phí quá hạn (+10% tiền cọc/30 phút, tối đa 50% cọc) từ tiền cọc để chuyển cho Bên A và hoàn phần dư cho Bên B. Trường hợp xác nhận mất trang phục (LOST_ITEM) sau quá hạn 24 giờ và tối thiểu 03 lần liên hệ bất thành, 100% tiền cọc được chuyển cho Bên A và tài khoản Bên B bị khóa vĩnh viễn.',
    );
    lines.push(
      '- Trường hợp trang phục bị mất mát hoặc hư hỏng, Bên B đồng ý bồi thường theo chi phí phục hồi hoặc giá trị bồi hoàn niêm yết của trang phục.',
    );
  }
  lines.push('');

  // ĐIỀU 5: HỦY THUÊ VÀ HOÀN TIỀN
  if (cancelPolicy) {
    lines.push('ĐIỀU 5: CHÍNH SÁCH HỦY ĐƠN VÀ HOÀN TIỀN');
    lines.push(
      '- Thời điểm xác định yêu cầu hủy: Tỷ lệ hoàn tiền thuê được tính riêng cho từng sản phẩm, dựa trên thời điểm hệ thống ghi nhận yêu cầu hủy so với mốc nhận đồ (rentalFrom) của chính sản phẩm đó tại Phần II. Tiền cọc của sản phẩm được hoàn lại khi hủy trước thời điểm nhận đồ.',
    );
    lines.push(
      '- Biểu phí và tỷ lệ hoàn tiền thuê (các khoảng thời gian không chồng lấn):',
    );

    if (
      Array.isArray(cancelPolicy.refundRules) &&
      cancelPolicy.refundRules.length > 0
    ) {
      const sortedRules = cancelPolicy.refundRules
        .slice()
        .sort((a: any, b: any) => b.daysBeforeRental - a.daysBeforeRental);
      for (let idx = 0; idx < sortedRules.length; idx++) {
        const rule = sortedRules[idx];
        const prev = idx > 0 ? sortedRules[idx - 1] : null;
        if (idx === 0) {
          const h = rule.daysBeforeRental * 24;
          const hText = h > 0 ? ` (${h} giờ)` : '';
          lines.push(
            `  + Hủy trước thời điểm bắt đầu thuê từ ${rule.daysBeforeRental} ngày${hText} trở lên: Hoàn trả ${rule.refundPercentage}% tiền thuê.`,
          );
        } else {
          const curH = rule.daysBeforeRental * 24;
          const prevH = prev.daysBeforeRental * 24;
          if (rule.daysBeforeRental === 0) {
            lines.push(
              `  + Hủy trong vòng dưới ${prev.daysBeforeRental} ngày (dưới ${prevH} giờ) trước thời điểm bắt đầu thuê: Hoàn trả ${rule.refundPercentage}% tiền thuê${rule.refundPercentage === 0 ? ' (không hoàn lại tiền thuê)' : ''}.`,
            );
          } else {
            lines.push(
              `  + Hủy trước thời điểm bắt đầu thuê từ ${rule.daysBeforeRental} ngày (${curH} giờ) đến dưới ${prev.daysBeforeRental} ngày (${prevH} giờ): Hoàn trả ${rule.refundPercentage}% tiền thuê.`,
            );
          }
        }
      }
    } else {
      lines.push(
        '  + Tiền thuê được hoàn trả theo quy định đã phê duyệt của Shop.',
      );
    }
    if (cancelPolicy.cancellationNotes) {
      lines.push(`- Lưu ý hủy đơn từ Shop: ${cancelPolicy.cancellationNotes}`);
    }
  } else {
    lines.push('ĐIỀU 5: CHÍNH SÁCH HỦY ĐƠN VÀ HOÀN TIỀN');
    lines.push(
      `- Quy định hủy từ Bên Cho Thuê: ${policies?.providerCancellation || 'Áp dụng theo quy chế hoạt động của nền tảng TàGo.'}`,
    );
    if (policies?.cancellation?.value?.freeCancelBeforeHours) {
      lines.push(
        `- Quy định bảo vệ từ Sàn TàGo: Cho phép hủy miễn phí trước ${policies.cancellation.value.freeCancelBeforeHours} giờ so với thời điểm nhận đồ. Tiền cọc và tiền thuê sẽ được hoàn trả theo quy trình của sàn.`,
      );
    }
  }
  lines.push('');

  // ĐIỀU 6: ĐIỀU KHOẢN BỔ SUNG
  let nextArticleNum = 6;
  if (customTerms && customTerms.trim()) {
    lines.push(`ĐIỀU ${nextArticleNum}: ĐIỀU KHOẢN BỔ SUNG CỦA BÊN CHO THUÊ`);
    lines.push(`- Cam kết riêng của Bên Cho Thuê: ${customTerms.trim()}`);
    lines.push('');
    nextArticleNum++;
  }

  // HIỆU LỰC HỢP ĐỒNG
  lines.push(
    `ĐIỀU ${nextArticleNum}: HIỆU LỰC HỢP ĐỒNG VÀ XÁC NHẬN GIAO KẾT ĐIỆN TỬ`,
  );
  lines.push(
    '- Hợp đồng điện tử này được xác lập (formedAt) tại thời điểm Bên B hoàn tất xác nhận chấp thuận điện tử trên hệ thống TàGo theo quy định của Luật Giao dịch điện tử.',
  );
  lines.push(
    '- Điều kiện thực thi và hiệu lực cung cấp dịch vụ (effectiveAt) bắt đầu khi đơn hàng hoàn tất nghĩa vụ thanh toán (paidAt) và được hệ thống xác nhận hợp lệ theo Quy chế nền tảng.',
  );
  lines.push(
    '- Bản ghi hợp đồng điện tử được tạo mã băm SHA-256 để bảo đảm tính toàn vẹn kỹ thuật, chống sửa đổi trái phép và phục vụ tra cứu, đối soát theo quy định.',
  );

  return lines;
}

function formatVnd(amount: unknown): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  return `${num.toLocaleString('vi-VN')} đ`;
}

function formatDate(dateVal: unknown): string {
  return formatDateVn(dateVal);
}

function formatShortDate(dateVal: unknown): string {
  return formatShortDateVn(dateVal);
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  if (!text) return [''];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If a single word exceeds maxWidth, break it by character
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = '';
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, fontSize) <= maxWidth) {
            chunk += char;
          } else {
            lines.push(chunk);
            chunk = char;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function findFontBuffer(fileName: string): Buffer {
  const candidates = [
    path.resolve(process.cwd(), 'assets/fonts', fileName),
    path.resolve(process.cwd(), 'backend/assets/fonts', fileName),
    path.resolve(__dirname, '../../../assets/fonts', fileName),
    path.resolve(__dirname, '../../../../assets/fonts', fileName),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return fs.readFileSync(c);
    }
  }
  throw new Error(
    `Font file ${fileName} not found in any candidate path: ${candidates.join(', ')}`,
  );
}

class PdfLayoutEngine {
  public pages: PDFPage[] = [];
  public currentPage!: PDFPage;
  public currentY = 785;
  public readonly pageWidth = 595.28;
  public readonly pageHeight = 841.89;
  public readonly margin = 50;
  public readonly contentWidth = 495.28;
  public readonly bottomLimit = 55;

  constructor(
    public readonly doc: PDFDocument,
    public readonly regularFont: PDFFont,
    public readonly boldFont: PDFFont,
    public readonly contractCode: string,
  ) {
    this.addPage(true);
  }

  addPage(isFirst = false): PDFPage {
    const page = this.doc.addPage([this.pageWidth, this.pageHeight]);
    this.pages.push(page);
    this.currentPage = page;

    if (isFirst) {
      this.currentY = 790;
    } else {
      // Running header on page 2+
      const headerText = 'TÀGO — HỢP ĐỒNG THUÊ ÁO DÀI';
      const codeText = `Mã: ${this.contractCode}`;
      page.drawText(headerText, {
        x: this.margin,
        y: 805,
        size: 8,
        font: this.boldFont,
        color: COLOR_PRIMARY,
      });
      const codeWidth = this.regularFont.widthOfTextAtSize(codeText, 8);
      page.drawText(codeText, {
        x: this.margin + this.contentWidth - codeWidth,
        y: 805,
        size: 8,
        font: this.regularFont,
        color: COLOR_TEXT_MUTED,
      });
      page.drawLine({
        start: { x: this.margin, y: 798 },
        end: { x: this.margin + this.contentWidth, y: 798 },
        thickness: 0.5,
        color: COLOR_BORDER,
      });
      this.currentY = 780;
    }

    return page;
  }

  ensureSpace(neededHeight: number): void {
    if (this.currentY - neededHeight < this.bottomLimit) {
      this.addPage(false);
    }
  }

  drawSectionHeader(title: string): void {
    this.ensureSpace(35);
    this.currentY -= 14;

    this.currentPage.drawText(title, {
      x: this.margin,
      y: this.currentY,
      size: 11,
      font: this.boldFont,
      color: COLOR_PRIMARY,
    });

    this.currentY -= 5;
    this.currentPage.drawLine({
      start: { x: this.margin, y: this.currentY },
      end: { x: this.margin + this.contentWidth, y: this.currentY },
      thickness: 1,
      color: COLOR_PRIMARY,
    });
    this.currentY -= 10;
  }

  finalizeFooters(): void {
    const total = this.pages.length;
    for (let i = 0; i < total; i++) {
      const page = this.pages[i];
      // Footer divider
      page.drawLine({
        start: { x: this.margin, y: 40 },
        end: { x: this.margin + this.contentWidth, y: 40 },
        thickness: 0.5,
        color: COLOR_BORDER,
      });

      // Left footer
      page.drawText(
        'Hợp đồng điện tử TàGo — Nền tảng cho thuê trang phục truyền thống',
        {
          x: this.margin,
          y: 28,
          size: 7.5,
          font: this.regularFont,
          color: COLOR_TEXT_MUTED,
        },
      );

      // Right footer
      const pageStr = `Trang ${i + 1} / ${total}`;
      const pageStrWidth = this.regularFont.widthOfTextAtSize(pageStr, 7.5);
      page.drawText(pageStr, {
        x: this.margin + this.contentWidth - pageStrWidth,
        y: 28,
        size: 7.5,
        font: this.boldFont,
        color: COLOR_TEXT_MUTED,
      });
    }
  }
}

export class ContractPdfGenerator {
  /**
   * Generates a deterministic, professional, standard-compliant PDF document buffer
   * with full Vietnamese Unicode typography, A4 formatting and immutable evidence metadata.
   */
  static async generate(
    input: ContractPdfInput,
  ): Promise<{ buffer: Buffer; sha256: string }> {
    const validation = validateContractConsistency(
      input.snapshot,
      input.renderedText,
    );
    if (!validation.consistent) {
      throw new Error(
        `CONTRACT_DATA_INCONSISTENCY: ${validation.contradictions.join('; ')}`,
      );
    }

    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    const regularFontBytes = findFontBuffer('NotoSans-Regular.ttf');
    const boldFontBytes = findFontBuffer('NotoSans-Bold.ttf');

    const regularFont = await doc.embedFont(regularFontBytes, { subset: true });
    const boldFont = await doc.embedFont(boldFontBytes, { subset: true });

    const layout = new PdfLayoutEngine(
      doc,
      regularFont,
      boldFont,
      input.contractCode,
    );

    // =========================================================================
    // 1. BRAND & TITLE
    // =========================================================================
    const isConsented = Boolean(input.consent?.customerConsentAt);

    layout.currentPage.drawText('TÀGO', {
      x: layout.margin,
      y: layout.currentY,
      size: 11,
      font: boldFont,
      color: COLOR_PRIMARY,
    });

    if (!isConsented) {
      layout.currentPage.drawText('[ DỰ THẢO XEM TRƯỚC — CHƯA KÝ ]', {
        x: layout.margin + 70,
        y: layout.currentY + 1,
        size: 8.5,
        font: boldFont,
        color: rgb(0.7, 0.4, 0.1),
      });
    }
    layout.currentY -= 20;

    layout.currentPage.drawText('HỢP ĐỒNG THUÊ ÁO DÀI', {
      x: layout.margin,
      y: layout.currentY,
      size: 17,
      font: boldFont,
      color: COLOR_TEXT_MAIN,
    });
    layout.currentY -= 14;

    layout.currentPage.drawText(
      'DỊCH VỤ THUÊ TRANG PHỤC VÀ PHỤ KIỆN TRUYỀN THỐNG TRÊN NỀN TẢNG TÀGO',
      {
        x: layout.margin,
        y: layout.currentY,
        size: 8.5,
        font: regularFont,
        color: COLOR_TEXT_MUTED,
      },
    );
    layout.currentY -= 12;

    // Metadata Summary Card
    const metaBoxHeight = 52;
    layout.currentPage.drawRectangle({
      x: layout.margin,
      y: layout.currentY - metaBoxHeight,
      width: layout.contentWidth,
      height: metaBoxHeight,
      color: COLOR_BG_BOX,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });

    const metaY = layout.currentY - 14;

    // Row 1: Full-width contract code (to prevent any text overlap)
    layout.currentPage.drawText('Mã hợp đồng:', {
      x: layout.margin + 12,
      y: metaY,
      size: 8.5,
      font: boldFont,
      color: COLOR_TEXT_MAIN,
    });
    layout.currentPage.drawText(input.contractCode, {
      x: layout.margin + 80,
      y: metaY,
      size: 8,
      font: boldFont,
      color: COLOR_PRIMARY,
    });

    // Row 2: Version, Booking Code, Date created
    const row2Y = metaY - 20;

    layout.currentPage.drawText('Phiên bản:', {
      x: layout.margin + 12,
      y: row2Y,
      size: 8.5,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });
    layout.currentPage.drawText(`v${input.versionNumber}`, {
      x: layout.margin + 62,
      y: row2Y,
      size: 8.5,
      font: boldFont,
      color: COLOR_TEXT_MAIN,
    });

    const bookingObj = (input.snapshot?.booking || {}) as
      | Record<string, unknown>
      | undefined;
    const bookingCode = str(bookingObj?.bookingCode || bookingObj?.code, 'N/A');
    layout.currentPage.drawText('Mã đơn thuê:', {
      x: layout.margin + 130,
      y: row2Y,
      size: 8.5,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });
    layout.currentPage.drawText(bookingCode, {
      x: layout.margin + 195,
      y: row2Y,
      size: 8.5,
      font: boldFont,
      color: COLOR_TEXT_MAIN,
    });

    const createdDate = formatDate(
      input.consent?.customerConsentAt || new Date(),
    );
    layout.currentPage.drawText('Ngày lập:', {
      x: layout.margin + 330,
      y: row2Y,
      size: 8.5,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });
    layout.currentPage.drawText(createdDate, {
      x: layout.margin + 375,
      y: row2Y,
      size: 8.5,
      font: regularFont,
      color: COLOR_TEXT_MAIN,
    });

    layout.currentY -= metaBoxHeight + 10;

    // =========================================================================
    // 2. PHẦN I: THÔNG TIN CÁC BÊN (Parties)
    // =========================================================================
    layout.drawSectionHeader('I. THÔNG TIN CÁC BÊN THAM GIA');

    const prov = input.snapshot.provider;
    const cust = input.snapshot.customer;

    const partyCardWidth = (layout.contentWidth - 12) / 2;
    const partyCardHeight = 92;

    layout.ensureSpace(partyCardHeight + 5);

    // Box A - Bên Cho Thuê
    const boxAY = layout.currentY - partyCardHeight;
    layout.currentPage.drawRectangle({
      x: layout.margin,
      y: boxAY,
      width: partyCardWidth,
      height: partyCardHeight,
      color: COLOR_BG_BOX,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });

    layout.currentPage.drawText('BÊN CHO THUÊ (BÊN A)', {
      x: layout.margin + 10,
      y: boxAY + partyCardHeight - 14,
      size: 9,
      font: boldFont,
      color: COLOR_PRIMARY,
    });

    const provName = str(
      prov?.businessName || prov?.name,
      'Cửa hàng đối tác TàGo',
    );
    const provNameWrapped = wrapText(
      provName,
      boldFont,
      8.5,
      partyCardWidth - 20,
    );
    layout.currentPage.drawText(provNameWrapped[0], {
      x: layout.margin + 10,
      y: boxAY + partyCardHeight - 27,
      size: 8.5,
      font: boldFont,
      color: COLOR_TEXT_MAIN,
    });

    const provAddress = formatAddress(
      prov?.address,
      'Chưa cập nhật trên hệ thống',
    );
    const provAddressWrapped = wrapText(
      `Địa chỉ: ${provAddress}`,
      regularFont,
      8,
      partyCardWidth - 20,
    );
    layout.currentPage.drawText(provAddressWrapped[0] || '', {
      x: layout.margin + 10,
      y: boxAY + partyCardHeight - 42,
      size: 8,
      font: regularFont,
      color: COLOR_TEXT_MAIN,
    });
    if (provAddressWrapped[1]) {
      layout.currentPage.drawText(provAddressWrapped[1], {
        x: layout.margin + 10,
        y: boxAY + partyCardHeight - 53,
        size: 8,
        font: regularFont,
        color: COLOR_TEXT_MAIN,
      });
    }

    const provPhone = str(
      (prov as any)?.contact?.phone ||
        prov?.phone ||
        prov?.phoneNumber ||
        (prov as any)?.contact?.email ||
        prov?.email,
      'Liên hệ qua ứng dụng TàGo',
    );
    layout.currentPage.drawText(`Điện thoại: ${provPhone}`, {
      x: layout.margin + 10,
      y: boxAY + 10,
      size: 8,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });

    // Box B - Bên Thuê
    const boxBX = layout.margin + partyCardWidth + 12;
    layout.currentPage.drawRectangle({
      x: boxBX,
      y: boxAY,
      width: partyCardWidth,
      height: partyCardHeight,
      color: COLOR_BG_BOX,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });

    layout.currentPage.drawText('BÊN THUÊ (BÊN B)', {
      x: boxBX + 10,
      y: boxAY + partyCardHeight - 14,
      size: 9,
      font: boldFont,
      color: COLOR_PRIMARY,
    });

    const custName = str(
      cust?.fullName || cust?.name,
      'Chưa cập nhật trên hệ thống',
    );
    layout.currentPage.drawText(custName, {
      x: boxBX + 10,
      y: boxAY + partyCardHeight - 27,
      size: 8.5,
      font: boldFont,
      color: COLOR_TEXT_MAIN,
    });

    const custPhone = str(
      cust?.phoneNumber || cust?.phone,
      'Chưa cập nhật trên hệ thống',
    );
    const custEmail = str(cust?.email, 'Chưa cập nhật trên hệ thống');
    layout.currentPage.drawText(`Số điện thoại: ${custPhone}`, {
      x: boxBX + 10,
      y: boxAY + partyCardHeight - 42,
      size: 8,
      font: regularFont,
      color: COLOR_TEXT_MAIN,
    });

    layout.currentPage.drawText(`Email: ${custEmail}`, {
      x: boxBX + 10,
      y: boxAY + partyCardHeight - 55,
      size: 8,
      font: regularFont,
      color: COLOR_TEXT_MAIN,
    });

    const custAddress = formatAddress(
      (cust as any)?.defaultAddress || cust?.address,
      'Chưa cập nhật trên hệ thống',
    );
    layout.currentPage.drawText(`Địa chỉ: ${custAddress}`, {
      x: boxBX + 10,
      y: boxAY + 10,
      size: 8,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });

    layout.currentY -= partyCardHeight + 14;

    // =========================================================================
    // 3. PHẦN II: CHI TIẾT SẢN PHẨM THUÊ (Rented Items Table)
    // =========================================================================
    layout.drawSectionHeader('II. CHI TIẾT SẢN PHẨM & DỊCH VỤ THUÊ');

    const colWidths = [28, 220, 48, 34, 82, 83.28];
    const colAlign: ('left' | 'center' | 'right')[] = [
      'center',
      'left',
      'center',
      'center',
      'right',
      'right',
    ];
    const headers = [
      'STT',
      'Sản phẩm & Phân loại',
      'Size',
      'SL',
      'Đơn giá thuê',
      'Thành tiền',
    ];

    const drawTableHeader = () => {
      layout.ensureSpace(22);
      const rowY = layout.currentY - 20;
      layout.currentPage.drawRectangle({
        x: layout.margin,
        y: rowY,
        width: layout.contentWidth,
        height: 20,
        color: COLOR_BG_HEADER,
        borderColor: COLOR_BORDER,
        borderWidth: 0.5,
      });

      let curX = layout.margin;
      headers.forEach((h, idx) => {
        const w = colWidths[idx];
        const align = colAlign[idx];
        let textX = curX + 4;
        if (align === 'center') {
          const tw = boldFont.widthOfTextAtSize(h, 8);
          textX = curX + (w - tw) / 2;
        } else if (align === 'right') {
          const tw = boldFont.widthOfTextAtSize(h, 8);
          textX = curX + w - tw - 6;
        }
        layout.currentPage.drawText(h, {
          x: textX,
          y: rowY + 6,
          size: 8,
          font: boldFont,
          color: COLOR_TEXT_MAIN,
        });
        curX += w;
      });
      layout.currentY -= 20;
    };

    drawTableHeader();

    const items = input.snapshot.providerItems || [];
    let firstRentalFrom: unknown = null;
    let firstRentalTo: unknown = null;
    const rentalPeriods = new Set<string>();

    items.forEach((item, index) => {
      const name = str(
        item.productName || item.name,
        `Sản phẩm áo dài #${index + 1}`,
      );
      const color = str(item.color);
      const fullDesc = color ? `${name} (Màu: ${color})` : name;
      const size = str(item.size, 'Tiêu chuẩn');
      const qty = Number(item.quantity) || 1;
      const unitPrice =
        Number((item as any).unitPrice) ||
        Number(item.rentalPrice) ||
        Number((item as any).price) ||
        0;
      const lineTotal = unitPrice * qty;

      const rFrom =
        item.rentalFrom || (item as any).startDate || (item as any).shootDate;
      const rTo = item.rentalTo || (item as any).endDate || rFrom;
      if (!firstRentalFrom && rFrom) firstRentalFrom = rFrom;
      if (!firstRentalTo && rTo) firstRentalTo = rTo;
      if (rFrom || rTo) {
        rentalPeriods.add(`${String(rFrom || '')}___${String(rTo || '')}`);
      }

      const itemFromStr = rFrom ? formatShortDate(rFrom) : '';
      const itemToStr = rTo ? formatShortDate(rTo) : '';
      const itemPeriodStr =
        itemFromStr && itemFromStr !== 'N/A'
          ? `Lịch thuê: ${itemFromStr} -> ${itemToStr && itemToStr !== 'N/A' ? itemToStr : itemFromStr}`
          : null;

      const repVal =
        Number((item as any).replacementValue || (item as any).declaredValue) ||
        0;
      const repValStr =
        repVal > 0 ? `Giá trị bồi hoàn: ${formatVnd(repVal)}` : null;

      const nameLines = wrapText(fullDesc, regularFont, 8, colWidths[1] - 8);
      const metaLines = [repValStr, itemPeriodStr].filter(
        (line): line is string => Boolean(line),
      );
      const totalTextLines = nameLines.length + metaLines.length;
      const rowHeight = Math.max(22, totalTextLines * 11 + 8);

      if (layout.currentY - rowHeight < layout.bottomLimit) {
        layout.addPage(false);
        drawTableHeader();
      }

      const rowY = layout.currentY - rowHeight;
      layout.currentPage.drawRectangle({
        x: layout.margin,
        y: rowY,
        width: layout.contentWidth,
        height: rowHeight,
        color: index % 2 === 1 ? COLOR_BG_BOX : rgb(1, 1, 1),
        borderColor: COLOR_BORDER,
        borderWidth: 0.5,
      });

      let cellX = layout.margin;

      // STT
      const sttStr = String(index + 1);
      const sttW = regularFont.widthOfTextAtSize(sttStr, 8);
      layout.currentPage.drawText(sttStr, {
        x: cellX + (colWidths[0] - sttW) / 2,
        y: rowY + rowHeight / 2 - 3,
        size: 8,
        font: regularFont,
        color: COLOR_TEXT_MAIN,
      });
      cellX += colWidths[0];

      // Name lines
      nameLines.forEach((nLine, lIdx) => {
        layout.currentPage.drawText(nLine, {
          x: cellX + 4,
          y: rowY + rowHeight - 12 - lIdx * 11,
          size: 8,
          font: lIdx === 0 ? boldFont : regularFont,
          color: COLOR_TEXT_MAIN,
        });
      });
      metaLines.forEach((mLine, mIdx) => {
        layout.currentPage.drawText(mLine, {
          x: cellX + 4,
          y: rowY + rowHeight - 12 - (nameLines.length + mIdx) * 11,
          size: 7,
          font: regularFont,
          color: COLOR_TEXT_MUTED,
        });
      });
      cellX += colWidths[1];

      // Size
      const sizeW = regularFont.widthOfTextAtSize(size, 8);
      layout.currentPage.drawText(size, {
        x: cellX + (colWidths[2] - sizeW) / 2,
        y: rowY + rowHeight / 2 - 3,
        size: 8,
        font: regularFont,
        color: COLOR_TEXT_MAIN,
      });
      cellX += colWidths[2];

      // Qty
      const qtyStr = String(qty);
      const qtyW = regularFont.widthOfTextAtSize(qtyStr, 8);
      layout.currentPage.drawText(qtyStr, {
        x: cellX + (colWidths[3] - qtyW) / 2,
        y: rowY + rowHeight / 2 - 3,
        size: 8,
        font: regularFont,
        color: COLOR_TEXT_MAIN,
      });
      cellX += colWidths[3];

      // Unit price
      const priceStr = formatVnd(unitPrice);
      const priceW = regularFont.widthOfTextAtSize(priceStr, 8);
      layout.currentPage.drawText(priceStr, {
        x: cellX + colWidths[4] - priceW - 6,
        y: rowY + rowHeight / 2 - 3,
        size: 8,
        font: regularFont,
        color: COLOR_TEXT_MAIN,
      });
      cellX += colWidths[4];

      // Line total
      const totalStr = formatVnd(lineTotal);
      const totalW = boldFont.widthOfTextAtSize(totalStr, 8);
      layout.currentPage.drawText(totalStr, {
        x: cellX + colWidths[5] - totalW - 6,
        y: rowY + rowHeight / 2 - 3,
        size: 8,
        font: boldFont,
        color: COLOR_TEXT_MAIN,
      });

      layout.currentY -= rowHeight;
    });

    // Rental period details under table
    layout.ensureSpace(32);
    layout.currentY -= 8;
    const fromStr = firstRentalFrom ? formatShortDate(firstRentalFrom) : '';
    const toStr = firstRentalTo ? formatShortDate(firstRentalTo) : '';
    let rentalDays = 0;
    if (firstRentalFrom && firstRentalTo) {
      const fromD = new Date(firstRentalFrom as any).getTime();
      const toD = new Date(firstRentalTo as any).getTime();
      if (!isNaN(fromD) && !isNaN(toD) && toD >= fromD) {
        rentalDays = Math.max(
          1,
          Math.ceil((toD - fromD) / (1000 * 60 * 60 * 24)),
        );
      }
    }
    const daysLabel = rentalDays > 0 ? ` (${rentalDays} ngày)` : '';
    const hasMultipleRentalPeriods = rentalPeriods.size > 1;
    const periodStr = hasMultipleRentalPeriods
      ? 'Thời gian thuê: Theo lịch thuê riêng của từng sản phẩm trong bảng chi tiết'
      : `Thời gian thuê: ${fromStr && fromStr !== 'N/A' ? fromStr : 'Theo thỏa thuận'} đến ${toStr && toStr !== 'N/A' ? toStr : 'Theo thỏa thuận'}${daysLabel}`;
    const pickupLoc = formatAddress(
      (items[0]?.pickupReturnLocation as any)?.address ||
        items[0]?.pickupReturnLocation ||
        prov?.address,
      'Tại cửa hàng Bên Cho Thuê',
    );
    const returnLocationStr = `Địa điểm nhận & hoàn trả đồ: ${pickupLoc}`;

    layout.currentPage.drawText(periodStr, {
      x: layout.margin + 4,
      y: layout.currentY,
      size: 8,
      font: boldFont,
      color: COLOR_TEXT_MAIN,
    });
    layout.currentY -= 12;

    layout.currentPage.drawText(returnLocationStr, {
      x: layout.margin + 4,
      y: layout.currentY,
      size: 8,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });
    layout.currentY -= 12;

    // =========================================================================
    // 4. PHẦN III: GIÁ TRỊ HỢP ĐỒNG (Financial Summary)
    // =========================================================================
    layout.drawSectionHeader('III. GIÁ TRỊ HỢP ĐỒNG & THANH TOÁN');

    const pricing = input.snapshot.pricing;
    const summary = (pricing as any)?.bookingSummary || {};

    let itemsRentalTotal = 0;
    let itemsDepositTotal = 0;
    for (const it of items) {
      const uPrice =
        Number((it as any).unitPrice) ||
        Number(it.rentalPrice) ||
        Number((it as any).price) ||
        0;
      const q = Number(it.quantity) || 1;
      itemsRentalTotal += uPrice * q;
      itemsDepositTotal += (Number(it.depositAmount) || 0) * q;
    }

    const rentalTotal =
      Number(summary.subTotal) ||
      Number(summary.rentalTotal) ||
      Number(summary.serviceTotal) ||
      Number(pricing?.rentalTotal) ||
      itemsRentalTotal;

    const depositTotal =
      Number(summary.depositTotal) ||
      Number(pricing?.depositTotal) ||
      itemsDepositTotal;

    const voucherDiscount =
      Number(summary.voucherDiscountTotal) ||
      Number(summary.voucherDiscountAmount) ||
      Number(summary.discountAmount) ||
      Number(pricing?.voucherDiscountTotal) ||
      0;

    const grandTotal =
      Number(summary.grandTotal) ||
      Number(pricing?.grandTotal) ||
      Math.max(0, rentalTotal + depositTotal - voucherDiscount);

    const finBoxWidth = 260;
    const finBoxHeight = voucherDiscount > 0 ? 86 : 70;
    const finBoxX = layout.margin + layout.contentWidth - finBoxWidth;

    layout.ensureSpace(finBoxHeight + 10);
    const finBoxY = layout.currentY - finBoxHeight;

    layout.currentPage.drawRectangle({
      x: finBoxX,
      y: finBoxY,
      width: finBoxWidth,
      height: finBoxHeight,
      color: COLOR_BG_BOX,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });

    let finY = finBoxY + finBoxHeight - 16;
    const labelX = finBoxX + 12;
    const valRight = finBoxX + finBoxWidth - 12;

    // Rental Total
    layout.currentPage.drawText('Tiền thuê trang phục:', {
      x: labelX,
      y: finY,
      size: 8.5,
      font: regularFont,
      color: COLOR_TEXT_MAIN,
    });
    const rStr = formatVnd(rentalTotal);
    layout.currentPage.drawText(rStr, {
      x: valRight - regularFont.widthOfTextAtSize(rStr, 8.5),
      y: finY,
      size: 8.5,
      font: regularFont,
      color: COLOR_TEXT_MAIN,
    });
    finY -= 15;

    // Deposit Total
    layout.currentPage.drawText('Tiền đặt cọc giữ đồ:', {
      x: labelX,
      y: finY,
      size: 8.5,
      font: regularFont,
      color: COLOR_TEXT_MAIN,
    });
    const dStr = formatVnd(depositTotal);
    layout.currentPage.drawText(dStr, {
      x: valRight - regularFont.widthOfTextAtSize(dStr, 8.5),
      y: finY,
      size: 8.5,
      font: regularFont,
      color: COLOR_TEXT_MAIN,
    });
    finY -= 15;

    // Voucher (if any)
    if (voucherDiscount > 0) {
      layout.currentPage.drawText('Giảm giá Voucher:', {
        x: labelX,
        y: finY,
        size: 8.5,
        font: regularFont,
        color: rgb(0.1, 0.55, 0.25),
      });
      const vStr = `-${formatVnd(voucherDiscount)}`;
      layout.currentPage.drawText(vStr, {
        x: valRight - regularFont.widthOfTextAtSize(vStr, 8.5),
        y: finY,
        size: 8.5,
        font: regularFont,
        color: rgb(0.1, 0.55, 0.25),
      });
      finY -= 15;
    }

    // Divider
    layout.currentPage.drawLine({
      start: { x: labelX, y: finY + 4 },
      end: { x: valRight, y: finY + 4 },
      thickness: 0.5,
      color: COLOR_BORDER,
    });
    finY -= 6;

    // Grand Total
    layout.currentPage.drawText('TỔNG THANH TOÁN:', {
      x: labelX,
      y: finY,
      size: 10,
      font: boldFont,
      color: COLOR_PRIMARY,
    });
    const gStr = formatVnd(grandTotal);
    layout.currentPage.drawText(gStr, {
      x: valRight - boldFont.widthOfTextAtSize(gStr, 11),
      y: finY,
      size: 11,
      font: boldFont,
      color: COLOR_PRIMARY,
    });

    layout.currentY -= finBoxHeight + 14;

    // =========================================================================
    // 5. PHẦN IV: ĐIỀU KHOẢN VÀ ĐIỀU KIỆN (Terms & Conditions)
    // =========================================================================
    let termsLines: string[] = [];
    const rawRendered = (input.renderedText || '').trim();

    let policiesForHeader: any = input.snapshot?.policies;
    if (rawRendered.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawRendered);
        const snap = parsed.snapshot || parsed;
        const policies = snap.policies || input.snapshot.policies || {};
        const items = snap.providerItems || input.snapshot.providerItems || [];
        policiesForHeader = policies;
        termsLines = buildContractTermsLines(policies, items);
      } catch {
        termsLines = rawRendered.split('\n');
      }
    } else {
      termsLines = input.renderedText ? input.renderedText.split('\n') : [];
    }

    const policyVersionNumber = policiesForHeader?.providerPolicyVersion;
    layout.drawSectionHeader(
      policyVersionNumber
        ? `IV. ĐIỀU KHOẢN VÀ ĐIỀU KIỆN THUÊ TRANG PHỤC (CHÍNH SÁCH ĐÃ DUYỆT V${policyVersionNumber})`
        : 'IV. ĐIỀU KHOẢN VÀ ĐIỀU KIỆN THUÊ TRANG PHỤC',
    );
    for (const rawLine of termsLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        layout.currentY -= 6;
        continue;
      }

      const isHeading = /^(ĐIỀU|Điều|MỤC|Mục|\d+\.)/i.test(trimmed);
      const fontSize = isHeading ? 9.5 : 8.5;
      const font = isHeading ? boldFont : regularFont;
      const color = isHeading ? COLOR_PRIMARY : COLOR_TEXT_MAIN;
      const lineHeight = isHeading ? 14 : 12;

      // Prevent orphan heading at the very bottom
      if (isHeading) {
        layout.ensureSpace(45);
        layout.currentY -= 4;
      }

      const wrapped = wrapText(
        trimmed,
        font,
        fontSize,
        layout.contentWidth - 6,
      );
      for (const wLine of wrapped) {
        layout.ensureSpace(lineHeight);
        layout.currentPage.drawText(wLine, {
          x: layout.margin + (isHeading ? 0 : 6),
          y: layout.currentY,
          size: fontSize,
          font,
          color,
        });
        layout.currentY -= lineHeight;
      }
    }

    layout.currentY -= 10;

    // =========================================================================
    // 6. PHẦN V: XÁC NHẬN ĐIỆN TỬ & BẰNG CHỨNG TOÀN VẸN (Execution & Evidence)
    // =========================================================================
    // Keep confirmation block and audit metadata together on the exact same page
    const signCardWidth = (layout.contentWidth - 12) / 2;
    const signCardHeight = 74;
    const auditBoxHeight = 56;
    const executionAndAuditTotalHeight =
      28 + signCardHeight + 10 + auditBoxHeight + 8; // ~176 pt

    layout.ensureSpace(executionAndAuditTotalHeight);
    layout.drawSectionHeader('V. XÁC NHẬN ĐIỆN TỬ VÀ HIỆU LỰC HỢP ĐỒNG');

    const signY = layout.currentY - signCardHeight;

    // Provider Confirmation Box
    layout.currentPage.drawRectangle({
      x: layout.margin,
      y: signY,
      width: signCardWidth,
      height: signCardHeight,
      color: COLOR_BG_BOX,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });

    layout.currentPage.drawText('ĐẠI DIỆN BÊN CHO THUÊ', {
      x: layout.margin + 10,
      y: signY + signCardHeight - 14,
      size: 8.5,
      font: boldFont,
      color: COLOR_PRIMARY,
    });

    layout.currentPage.drawText(
      'Cơ chế: Chấp thuận trước theo Quy chế hoạt động nền tảng',
      {
        x: layout.margin + 10,
        y: signY + signCardHeight - 28,
        size: 7.5,
        font: regularFont,
        color: COLOR_TEXT_MAIN,
      },
    );

    const provCardSubtitle = policyVersionNumber
      ? `Chính sách áp dụng: Phiên bản v${policyVersionNumber} đã được phê duyệt`
      : 'Hình thức: Áp dụng điều kiện giao dịch chung đã cam kết với TàGo';

    layout.currentPage.drawText(provCardSubtitle, {
      x: layout.margin + 10,
      y: signY + signCardHeight - 40,
      size: 7,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });

    layout.currentPage.drawText('[ GHI NHẬN THEO QUY CHẾ NỀN TẢNG ]', {
      x: layout.margin + 10,
      y: signY + 10,
      size: 7.5,
      font: boldFont,
      color: COLOR_PRIMARY,
    });

    // Customer Confirmation Box
    const signBX = layout.margin + signCardWidth + 12;
    layout.currentPage.drawRectangle({
      x: signBX,
      y: signY,
      width: signCardWidth,
      height: signCardHeight,
      color: COLOR_BG_BOX,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });

    const custTitle = isConsented
      ? 'ĐẠI DIỆN BÊN THUÊ'
      : 'ĐẠI DIỆN BÊN THUÊ (BẢN XEM TRƯỚC)';

    layout.currentPage.drawText(custTitle, {
      x: signBX + 10,
      y: signY + signCardHeight - 14,
      size: 8.5,
      font: boldFont,
      color: isConsented ? COLOR_PRIMARY : rgb(0.5, 0.3, 0.1),
    });

    const custPerson = isConsented
      ? `Người chấp thuận: ${custName}`
      : `Người thuê: ${custName} (Chờ ký điện tử)`;
    layout.currentPage.drawText(custPerson, {
      x: signBX + 10,
      y: signY + signCardHeight - 28,
      size: 7.5,
      font: regularFont,
      color: COLOR_TEXT_MAIN,
    });

    const consentTime =
      isConsented && input.consent?.customerConsentAt
        ? formatDate(input.consent.customerConsentAt)
        : 'Chưa ghi nhận (Bản xem trước)';
    layout.currentPage.drawText(`Thời điểm: ${consentTime}`, {
      x: signBX + 10,
      y: signY + signCardHeight - 40,
      size: 7,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });

    const authMethod =
      isConsented && input.consent?.customerAuthMethod
        ? input.consent.customerAuthMethod
        : 'Chưa thực hiện';
    layout.currentPage.drawText(`Xác thực: ${authMethod}`, {
      x: signBX + 10,
      y: signY + signCardHeight - 50,
      size: 7,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });

    if (isConsented) {
      layout.currentPage.drawText('[ ĐÃ CHẤP THUẬN ĐIỆN TỬ ]', {
        x: signBX + 10,
        y: signY + 10,
        size: 7.5,
        font: boldFont,
        color: rgb(0.1, 0.55, 0.25),
      });
    } else {
      layout.currentPage.drawText('[ CHƯA CHẤP THUẬN — BẢN XEM TRƯỚC ]', {
        x: signBX + 10,
        y: signY + 10,
        size: 7,
        font: boldFont,
        color: rgb(0.7, 0.4, 0.1),
      });
    }

    layout.currentY -= signCardHeight + 10;

    // =========================================================================
    // 7. FOOTER TECHNICAL EVIDENCE (Boxed Audit Metadata)
    // =========================================================================
    // Placed directly underneath execution cards on the same page
    const auditY = layout.currentY - auditBoxHeight;

    layout.currentPage.drawRectangle({
      x: layout.margin,
      y: auditY,
      width: layout.contentWidth,
      height: auditBoxHeight,
      color: COLOR_BG_BOX,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });

    layout.currentPage.drawText(
      'THÔNG TIN KIỂM CHỨNG TOÀN VẸN VÀ BẰNG CHỨNG ĐIỆN TỬ (AUDIT METADATA):',
      {
        x: layout.margin + 8,
        y: auditY + auditBoxHeight - 12,
        size: 7.5,
        font: boldFont,
        color: COLOR_TEXT_MUTED,
      },
    );

    layout.currentPage.drawText(
      `• Contract Version ID: ${input.versionId}   |   Booking Reference: ${input.snapshot.bookingId || 'N/A'}`,
      {
        x: layout.margin + 8,
        y: auditY + auditBoxHeight - 22,
        size: 7,
        font: regularFont,
        color: COLOR_TEXT_MUTED,
      },
    );

    const regulationCode =
      input.consent?.providerAcceptanceRegulation ||
      'DRAFT (Chờ phê duyệt quy chế mẫu chính thức)';
    layout.currentPage.drawText(`• Quy chế Bên cho thuê: ${regulationCode}`, {
      x: layout.margin + 8,
      y: auditY + auditBoxHeight - 32,
      size: 7,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });

    layout.currentPage.drawText(`• Content SHA-256: ${input.contentHash}`, {
      x: layout.margin + 8,
      y: auditY + auditBoxHeight - 42,
      size: 7,
      font: regularFont,
      color: COLOR_TEXT_MUTED,
    });

    layout.currentPage.drawText(
      `• Booking Fingerprint: ${input.bookingFingerprint}`,
      {
        x: layout.margin + 8,
        y: auditY + auditBoxHeight - 52,
        size: 7,
        font: regularFont,
        color: COLOR_TEXT_MUTED,
      },
    );

    layout.currentY -= auditBoxHeight + 8;

    // Finalize running footers and page numbering on all pages
    layout.finalizeFooters();

    const pdfBytes = await doc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const sha256 = createHash('sha256').update(pdfBuffer).digest('hex');

    return { buffer: pdfBuffer, sha256 };
  }
}
