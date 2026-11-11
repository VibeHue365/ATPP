import React, { useMemo } from 'react';
import {
  Store,
  User,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import './ContractDocumentPreview.css';
import { resolveDamageCompensationRules } from '../../services/contractService';

export interface ContractDocumentPreviewProps {
  renderedText: string | null | undefined;
  contractId: string;
  contractCode?: string | null;
  version?: number | null;
  bookingCode?: string | null;
  providerStatus?: string | null;
  customerName?: string | null;
  bookingId?: string | null;
  contentHash?: string | null;
  bookingFingerprint?: string | null;
  snapshot?: any;
}

function formatVnd(amount: unknown): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  return `${num.toLocaleString('vi-VN')} đ`;
}

function formatShortDate(val: unknown): string {
  if (!val) return 'Theo lịch hẹn';
  try {
    const d = new Date(val as string | number | Date);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('vi-VN');
  } catch {
    return String(val);
  }
}

function formatAddress(addr: unknown, fallback = ''): string {
  if (!addr) return fallback;
  if (typeof addr === 'string') return addr.trim() || fallback;
  if (typeof addr === 'object' && addr !== null) {
    const a = addr as Record<string, unknown>;
    if (typeof a.fullAddress === 'string' && a.fullAddress.trim()) {
      return a.fullAddress.trim();
    }
    const rawLine = ((a.addressLine || a.street || a.address || '') as string).trim();
    const ward = ((a.ward || '') as string).trim();
    const district = ((a.district || '') as string).trim();
    const city = ((a.city || a.province || '') as string).trim();

    const parts: string[] = [];
    if (rawLine) parts.push(rawLine);
    if (ward && !rawLine.toLowerCase().includes(ward.toLowerCase())) {
      parts.push(ward);
    }
    if (district && !rawLine.toLowerCase().includes(district.toLowerCase())) {
      parts.push(district);
    }
    if (city && !rawLine.toLowerCase().includes(city.toLowerCase())) {
      parts.push(city);
    }
    if (parts.length > 0) return parts.join(', ');
  }
  return fallback;
}

export const ContractDocumentPreview: React.FC<ContractDocumentPreviewProps> = ({
  renderedText,
  contractId,
  contractCode,
  version = 1,
  bookingCode,
  providerStatus,
  customerName,
  bookingId,
  contentHash,
  bookingFingerprint,
  snapshot,
}) => {
  const snapshotData = useMemo(() => {
    if (snapshot && typeof snapshot === 'object') return snapshot;
    if (!renderedText) return null;
    const trimmed = renderedText.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.snapshot || parsed;
    } catch {
      return null;
    }
  }, [snapshot, renderedText]);

  // If we have a structured snapshot, render the high-fidelity A4-styled preview
  if (snapshotData) {
    const booking = snapshotData.booking || {};
    const provider = snapshotData.provider || {};
    const customer = snapshotData.customer || {};
    const items = snapshotData.providerItems || [];
    const pricing = snapshotData.pricing || {};
    const summary = pricing.bookingSummary || {};
    const policies = snapshotData.policies || {};
    const garmentCare = policies.providerGarmentCare;
    const lateReturn = policies.providerLateReturn;
    const damageComp = policies.providerDamageCompensation;
    const cancelPolicy = policies.providerCancellationPolicy;
    const customTerms = policies.providerCustomTermsText;

    const provName = provider.businessName || 'Nhà cung cấp đối tác VibeHue';
    const provAddr = formatAddress(provider.address, 'Chưa cập nhật trên hệ thống');
    const provPhone =
      provider.contact?.phone || provider.phone || 'Liên hệ qua ứng dụng VibeHue';
    const provEmail = provider.contact?.email || provider.email || 'Chưa cập nhật trên hệ thống';

    const custName = customer.fullName || customerName || 'Chưa cập nhật trên hệ thống';
    const custEmail = customer.email || 'Chưa cập nhật trên hệ thống';
    const custPhone = customer.phoneNumber || customer.phone || 'Chưa cập nhật trên hệ thống';
    const custAddr = formatAddress(
      customer.defaultAddress || customer.address,
      'Chưa cập nhật trên hệ thống',
    );

    let itemsRentalTotal = 0;
    let itemsDepositTotal = 0;
    let totalReplacementVal = 0;
    for (const it of items) {
      const uPrice = Number(it.unitPrice) || Number(it.rentalPrice) || 0;
      const q = Number(it.quantity) || 1;
      itemsRentalTotal += uPrice * q;
      itemsDepositTotal += (Number(it.depositAmount) || 0) * q;
      totalReplacementVal += (Number(it.replacementValue || it.declaredValue) || 0) * q;
    }

    const rentalTotal = Number(summary.subTotal) || Number(summary.rentalTotal) || itemsRentalTotal;
    const depositTotal = Number(summary.depositTotal) || itemsDepositTotal;
    const discountAmount = Number(summary.discountAmount) || Number(summary.voucherDiscountTotal) || 0;
    const grandTotal =
      Number(summary.grandTotal) || Math.max(0, rentalTotal + depositTotal - discountAmount);

    const firstRentalFrom = items[0]?.rentalFrom;
    const firstRentalTo = items[0]?.rentalTo;
    let rentalDays = 0;
    if (firstRentalFrom && firstRentalTo) {
      const fromD = new Date(firstRentalFrom).getTime();
      const toD = new Date(firstRentalTo).getTime();
      if (!isNaN(fromD) && !isNaN(toD) && toD >= fromD) {
        rentalDays = Math.max(1, Math.ceil((toD - fromD) / (1000 * 60 * 60 * 24)));
      }
    }
    const daysLabel = rentalDays > 0 ? ` (${rentalDays} ngày)` : '';
    const periodStr = `Từ ngày ${formatShortDate(firstRentalFrom)} đến ngày ${formatShortDate(firstRentalTo)}${daysLabel}`;
    const pickupLoc = formatAddress(
      items[0]?.pickupReturnLocation || provider.address,
      'Tại cửa hàng Bên Cho Thuê',
    );

    const isAccepted = providerStatus === 'ACCEPTED';

    return (
      <div className="vh-doc-preview-wrapper" data-testid="contract-terms-reader">
        {/* Document Header */}
        <div className="vh-doc-header">
          <div className="vh-doc-nation">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>{' '}
          <div className="vh-doc-motto">Độc lập - Tự do - Hạnh phúc</div>{' '}
          <div className="vh-doc-divider">-------------------o0o-------------------</div>
          <h2 className="vh-doc-title">HỢP ĐỒNG ĐIỆN TỬ THUÊ TRANG PHỤC ÁO DÀI</h2>

          <div className="vh-doc-meta-bar">
            <div>
              <span className="vh-meta-label">Mã hợp đồng:</span>{' '}
              <span className="vh-meta-code">{contractCode || contractId}</span>
            </div>
            <div className="vh-doc-meta-row">
              <span>
                <span className="vh-meta-label">Phiên bản hợp đồng:</span> v{version || 1}
              </span>
              {policies.providerPolicyVersion ? (
                <span>
                  <span className="vh-meta-label">Chính sách Shop:</span>{' '}
                  <strong>v{policies.providerPolicyVersion} (Đã duyệt)</strong>
                </span>
              ) : null}
              <span>
                <span className="vh-meta-label">Mã đơn thuê:</span>{' '}
                <strong>{booking.bookingCode || bookingCode || 'N/A'}</strong>
              </span>
              <span>
                <span className="vh-meta-label">Ngày lập:</span>{' '}
                {new Date().toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>
        </div>

        {/* Section I: Parties */}
        <div className="vh-doc-section">
          <div className="vh-doc-section-title">I. THÔNG TIN CÁC BÊN THAM GIA</div>
          <div className="vh-doc-parties-grid">
            <div className="vh-doc-party-card">
              <div className="vh-party-header">
                <Store size={15} />
                <span>BÊN CHO THUÊ (BÊN A)</span>
              </div>
              <div className="vh-party-name">{provName}</div>
              <div className="vh-party-field">
                <span className="vh-field-lbl">Địa chỉ:</span> {provAddr}
              </div>
              <div className="vh-party-field">
                <span className="vh-field-lbl">Điện thoại:</span> {provPhone}
              </div>
              <div className="vh-party-field">
                <span className="vh-field-lbl">Email:</span> {provEmail}
              </div>
            </div>

            <div className="vh-doc-party-card">
              <div className="vh-party-header">
                <User size={15} />
                <span>BÊN THUÊ (BÊN B)</span>
              </div>
              <div className="vh-party-name">{custName}</div>
              <div className="vh-party-field">
                <span className="vh-field-lbl">Số điện thoại:</span> {custPhone}
              </div>
              <div className="vh-party-field">
                <span className="vh-field-lbl">Email:</span> {custEmail}
              </div>
              <div className="vh-party-field">
                <span className="vh-field-lbl">Địa chỉ:</span> {custAddr}
              </div>
            </div>
          </div>
        </div>

        {/* Section II: Items Table */}
        <div className="vh-doc-section">
          <div className="vh-doc-section-title">II. CHI TIẾT SẢN PHẨM & DỊCH VỤ THUÊ</div>
          <div className="vh-doc-table-wrap">
            <table className="vh-doc-table">
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center' }}>STT</th>
                  <th>Sản phẩm & Phân loại</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Size</th>
                  <th style={{ width: '45px', textAlign: 'center' }}>SL</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Đơn giá thuê</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, idx: number) => {
                  const uPrice = Number(it.unitPrice) || Number(it.rentalPrice) || 0;
                  const q = Number(it.quantity) || 1;
                  const lTotal = uPrice * q;
                  const desc = it.color ? `${it.productName} (Màu: ${it.color})` : it.productName;
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td>
                        <strong>{desc}</strong>
                        {Number(it.replacementValue || it.declaredValue) > 0 && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Giá trị bồi hoàn: {formatVnd(Number(it.replacementValue || it.declaredValue))}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{it.size || 'Freesize'}</td>
                      <td style={{ textAlign: 'center' }}>{q}</td>
                      <td style={{ textAlign: 'right' }}>{formatVnd(uPrice)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatVnd(lTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="vh-doc-rental-terms">
            <div className="vh-doc-term-row">
              <Calendar size={14} className="vh-term-icon" />
              <span>
                <strong>Thời gian thuê:</strong> {periodStr}
              </span>
            </div>
            <div className="vh-doc-term-row">
              <MapPin size={14} className="vh-term-icon" />
              <span>
                <strong>Địa điểm nhận & hoàn trả đồ:</strong> {pickupLoc}
              </span>
            </div>
          </div>
        </div>

        {/* Section III: Financial Summary */}
        <div className="vh-doc-section">
          <div className="vh-doc-section-title">III. GIÁ TRỊ HỢP ĐỒNG & THANH TOÁN</div>
          <div className="vh-doc-fin-box">
            <div className="vh-fin-row">
              <span>Tiền thuê trang phục:</span>
              <span>{formatVnd(rentalTotal)}</span>
            </div>
            <div className="vh-fin-row">
              <span>Tiền đặt cọc giữ đồ:</span>
              <span>{formatVnd(depositTotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="vh-fin-row discount">
                <span>Giảm giá Voucher:</span>
                <span>-{formatVnd(discountAmount)}</span>
              </div>
            )}
            <div className="vh-fin-divider" />
            <div className="vh-fin-row total">
              <span>TỔNG THANH TOÁN (CẦN THANH TOÁN):</span>
              <span className="vh-fin-total-val">{formatVnd(grandTotal)}</span>
            </div>
            <div className="vh-fin-note">
              * Quy định về tiền cọc: Tiền đặt cọc là khoản bảo đảm thực hiện hợp đồng được ghi nhận
              theo đơn đặt hàng và sẽ được hoàn trả cho Bên B sau khi Bên A tiếp nhận và xác nhận trang
              phục nguyên vẹn, đúng hạn theo quy định của hợp đồng.
            </div>
          </div>
        </div>

        {/* Section IV: Terms & Conditions */}
        <div className="vh-doc-section">
          <div className="vh-doc-section-title">
            IV. ĐIỀU KHOẢN VÀ ĐIỀU KIỆN THUÊ TRANG PHỤC
            {policies.providerPolicyVersion ? ` (THEO CHÍNH SÁCH SHOP ĐÃ PHÊ DUYỆT V${policies.providerPolicyVersion})` : ''}
          </div>
          <div className="vh-doc-articles">
            <div className="vh-article-block">
              <h5>ĐIỀU 1: QUYỀN VÀ NGHĨA VỤ CỦA BÊN CHO THUÊ (BÊN A)</h5>
              <ul>
                <li>Cung cấp trang phục áo dài đúng mẫu mã, màu sắc, kích thước và tiêu chuẩn như đã mô tả trên hệ thống.</li>
                <li>Bàn giao sản phẩm nguyên vẹn, đảm bảo vệ sinh và sẵn sàng sử dụng cho Bên B tại điểm nhận quy định.</li>
                <li>Hoàn trả đầy đủ 100% tiền đặt cọc cho Bên B sau khi nhận lại trang phục nguyên vẹn và đúng hạn thỏa thuận.</li>
              </ul>
            </div>

            {garmentCare ? (
              <div className="vh-article-block">
                <h5>ĐIỀU 2: NGHĨA VỤ CỦA BÊN THUÊ VÀ QUY ĐỊNH BẢO QUẢN ÁO DÀI (BÊN B)</h5>
                <ul>
                  <li>Thanh toán đúng và đủ toàn bộ giá trị hợp đồng gồm tiền thuê và tiền cọc theo phương thức thanh toán của Sàn trước khi nhận đồ.</li>
                  <li>
                    <strong>Quy định ủi/là trang phục:</strong>{' '}
                    {garmentCare.allowIroning
                      ? 'Được phép sử dụng bàn ủi hơi nước ở nhiệt độ an toàn.'
                      : 'KHÔNG ĐƯỢC PHÉP tự ý là/ủi trang phục.'}
                  </li>
                  <li>
                    <strong>Quy định giặt trang phục:</strong>{' '}
                    {garmentCare.allowWashing
                      ? 'Bên B được phép tự giặt sạch trước khi hoàn trả theo hướng dẫn bảo quản.'
                      : 'Bên B KHÔNG tự ý giặt; Bên A chịu trách nhiệm giặt hấp, xử lý chuyên dụng sau khi nhận lại.'}
                  </li>
                  <li>
                    <strong>Các hành vi bị nghiêm cấm:</strong>{' '}
                    {Array.isArray(garmentCare.prohibitedActions) && garmentCare.prohibitedActions.length > 0
                      ? garmentCare.prohibitedActions
                          .map((act: string) => (act || '').trim())
                          .filter(Boolean)
                          .join('; ') + '.'
                      : 'Không tự ý cắt sửa phom dáng, làm rách hỏng hoặc vấy bẩn không thể phục hồi.'}
                  </li>
                  {garmentCare.specialNotes && (
                    <li>
                      <strong>Ghi chú chất liệu đặc thù từ Shop:</strong> {garmentCare.specialNotes}
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="vh-article-block">
                <h5>ĐIỀU 2: QUYỀN VÀ NGHĨA VỤ CỦA BÊN THUÊ (BÊN B)</h5>
                <ul>
                  <li>Thanh toán đúng và đủ giá trị hợp đồng gồm tiền thuê và tiền cọc theo phương thức thanh toán của Sàn.</li>
                  <li>Có trách nhiệm bảo quản trang phục cẩn thận; không tự ý cắt may, chỉnh sửa hoặc làm vấy bẩn hư hại sản phẩm.</li>
                  <li>
                    Hoàn trả trang phục đúng thời hạn và địa điểm đã cam kết.{' '}
                    {policies.providerRental || 'Thời gian thuê tối đa và quy định phạt quá hạn áp dụng theo chính sách niêm yết.'}
                  </li>
                </ul>
              </div>
            )}

            {lateReturn ? (
              <div className="vh-article-block">
                <h5>ĐIỀU 3: QUY ĐỊNH HOÀN TRẢ VÀ BIỂU PHÍ TRỄ HẠN</h5>
                <ul>
                  <li>Hoàn trả trang phục đúng thời hạn và địa điểm quy định tại <strong>Phần II</strong> của hợp đồng.</li>
                  <li>
                    <strong>Thời gian ân hạn:</strong> {lateReturn.gracePeriodHours} giờ kể từ mốc thời gian hoàn trả đã hẹn (trong khoảng thời gian này Bên B không bị tính phí phạt trễ).
                  </li>
                  <li>
                    <strong>Biểu phí phạt trễ hạn:</strong> Áp dụng tương ứng theo hình thức thuê ({formatVnd(lateReturn.hourlyLateFee)}/giờ đối với thuê theo giờ, {formatVnd(lateReturn.dailyLateFee)}/ngày đối với thuê theo ngày), không cộng dồn hai mức phí cùng lúc.
                  </li>
                  <li>
                    <strong>Thời gian trễ tối đa cho phép:</strong> {lateReturn.maxLateDaysAllowed ?? 3} ngày.
                  </li>
                  <li>
                    <strong>Xử lý quá hạn tối đa:</strong> Trường hợp trễ quá {lateReturn.maxLateDaysAllowed ?? 3} ngày mà Bên B chưa hoàn trả và không có thông báo/thỏa thuận gia hạn hợp lệ, vụ việc sẽ được chuyển sang quy trình xử lý vi phạm hợp đồng để thực hiện bồi thường theo Điều 4.
                  </li>
                </ul>
              </div>
            ) : (
              <div className="vh-article-block">
                <h5>ĐIỀU 3: THỜI HẠN VÀ QUY ĐỊNH HOÀN TRẢ</h5>
                <ul>
                  <li>
                    Hoàn trả trang phục đúng thời hạn và địa điểm quy định tại <strong>Phần II</strong> của hợp đồng.{' '}
                    {policies.providerRental || 'Thời gian thuê tối đa và quy định phạt quá hạn áp dụng theo chính sách niêm yết.'}
                  </li>
                </ul>
              </div>
            )}

            {damageComp ? (() => {
              const resolved = resolveDamageCompensationRules(damageComp);
              const renderTierPreview = (tierLabel: string, tier: typeof resolved.minorDamage) => {
                if (tier.method === 'FIXED_FEE') {
                  const feeStr = tier.fixedFeeAmount !== null ? formatVnd(tier.fixedFeeAmount) : 'theo biểu phí đã duyệt';
                  const cond = tier.conditionsAndEvidence ? ` (Điều kiện: ${tier.conditionsAndEvidence})` : '';
                  return (
                    <li key={tierLabel}>
                      <strong>{tierLabel}:</strong> {feeStr}/lỗi{cond}.
                    </li>
                  );
                } else if (tier.method === 'PERCENTAGE_ON_ASSET') {
                  const pct = tier.percentageOfAsset ?? 0;
                  const compAmt = totalReplacementVal > 0 ? totalReplacementVal * (pct / 100) : 0;
                  const calcStr = totalReplacementVal > 0
                    ? ` (${formatVnd(compAmt)} trên tổng giá trị bồi hoàn ${formatVnd(totalReplacementVal)})`
                    : ' do Shop niêm yết';
                  const cond = tier.conditionsAndEvidence ? ` (Điều kiện: ${tier.conditionsAndEvidence})` : '';
                  return (
                    <li key={tierLabel}>
                      <strong>{tierLabel}:</strong> {pct}% Giá trị bồi hoàn trang phục{calcStr}{cond}.
                    </li>
                  );
                } else if (tier.method === 'ACTUAL_REPAIR_COST') {
                  const cond = tier.conditionsAndEvidence ? ` Căn cứ: ${tier.conditionsAndEvidence}` : '';
                  return (
                    <li key={tierLabel}>
                      <strong>{tierLabel} (Chi phí thực tế):</strong> Bồi thường theo chi phí phục hồi/sửa chữa thực tế căn cứ hóa đơn, chứng từ hợp lệ từ đơn vị chuyên nghiệp.{cond}
                    </li>
                  );
                } else {
                  const cond = tier.conditionsAndEvidence ? ` Căn cứ: ${tier.conditionsAndEvidence}` : '';
                  return (
                    <li key={tierLabel}>
                      <strong>{tierLabel} (Thương lượng sự cố):</strong> Hai bên đối chiếu hiện trạng và thương lượng số tiền bồi thường dựa trên chứng cứ giao nhận.{cond}
                    </li>
                  );
                }
              };

              return (
                <div className="vh-article-block">
                  <h5>ĐIỀU 4: TIỀN ĐẶT CỌC VÀ BỒI THƯỜNG HƯ HỎNG, MẤT MÁT</h5>
                  <ul>
                    <li>
                      Tiền đặt cọc là khoản bảo đảm thực hiện hợp đồng được ghi nhận theo đơn hàng và được hoàn trả đầy đủ khi Bên B hoàn trả trang phục đúng hạn, nguyên vẹn.
                    </li>
                    {renderTierPreview('Phí xử lý hư hỏng nhẹ (vết bẩn tẩy được, bung chỉ nhẹ, cúc tuột)', resolved.minorDamage)}
                    {renderTierPreview('Bồi thường hư hỏng vừa (rách nhỏ dưới 5cm, hỏng phụ liệu cần may vá)', resolved.moderateDamage)}
                    {renderTierPreview('Bồi thường hư hỏng nặng (rách vải lớn, biến dạng phom dáng, cháy xém hoặc biến dạng chất liệu)', resolved.severeDamage)}
                    {renderTierPreview('Mất trang phục hoặc không thể phục hồi (không hoàn trả hoặc hư hỏng toàn bộ không thể tái sử dụng)', resolved.totalLoss)}
                    {resolved.incidentNotificationHours && (
                      <li>
                        <strong>Thời hạn thông báo sự cố:</strong> Bên A có trách nhiệm kiểm tra và gửi thông báo sự cố kèm chứng cứ trong vòng {resolved.incidentNotificationHours} giờ kể từ thời điểm nhận lại trang phục.
                      </li>
                    )}
                    <li>
                      <strong>Cơ sở bồi thường và xử lý tiền cọc:</strong> Tiền đặt cọc là khoản bảo đảm thực hiện hợp đồng. Khi phát sinh sự cố, việc xử lý bồi thường và đối trừ tiền cọc được thực hiện theo thỏa thuận thống nhất giữa hai bên trên cơ sở các mức bồi thường đã giao kết; trường hợp giá trị thiệt hại vượt quá tiền cọc, Bên B có trách nhiệm thanh toán bổ sung phần chênh lệch cho Bên A theo quy định thỏa thuận.
                    </li>
                    <li>
                      <strong>Hỗ trợ giải quyết tranh chấp:</strong>{' '}
                      {(resolved.disputeResolutionTerms || damageComp.disputeResolutionNotes || '').trim() ||
                        'Khi có tranh chấp hoặc bất đồng về tình trạng trang phục, Nền tảng VibeHue đóng vai trò là kênh tiếp nhận phản ánh và hỗ trợ hai bên hòa giải trung gian dựa trên chứng cứ giao nhận, không tự ý phán quyết hay khấu trừ tiền.'}
                    </li>
                  </ul>
                </div>
              );
            })() : (
              <div className="vh-article-block">
                <h5>ĐIỀU 4: TIỀN ĐẶT CỌC VÀ QUY ĐỊNH BỒI THƯỜNG</h5>
                <ul>
                  <li>Tiền đặt cọc là khoản bảo đảm thực hiện hợp đồng theo đơn đặt hàng.</li>
                  <li>Khi hoàn trả trang phục đúng hạn, nguyên vẹn không hỏng hóc, Bên B sẽ được nhận lại toàn bộ tiền cọc.</li>
                  <li>Trường hợp trang phục bị mất mát, hư hỏng hoặc trả muộn, Bên B đồng ý bồi thường theo chi phí phục hồi hoặc giá trị bồi hoàn niêm yết của trang phục.</li>
                </ul>
              </div>
            )}

            {cancelPolicy ? (
              <div className="vh-article-block">
                <h5>ĐIỀU 5: CHÍNH SÁCH HỦY ĐƠN VÀ HOÀN TIỀN</h5>
                <ul>
                  <li>
                    <strong>Thời điểm xác định yêu cầu hủy:</strong> Tính theo thời điểm (timestamp) hệ thống ghi nhận Bên B gửi yêu cầu hủy đơn thành công so với mốc thời gian nhận đồ (rentalFrom) quy định tại <strong>Phần II</strong>.
                  </li>
                  <li>
                    <strong>Biểu phí và tỷ lệ hoàn tiền thuê (các khoảng thời gian không chồng lấn):</strong>
                  </li>
                  {Array.isArray(cancelPolicy.refundRules) && cancelPolicy.refundRules.length > 0 ? (
                    (() => {
                      const sorted = cancelPolicy.refundRules
                        .slice()
                        .sort((a: any, b: any) => b.daysBeforeRental - a.daysBeforeRental);
                      return sorted.map((rule: any, idx: number) => {
                        const prev = idx > 0 ? sorted[idx - 1] : null;
                        if (idx === 0) {
                          const h = rule.daysBeforeRental * 24;
                          const hText = h > 0 ? ` (${h} giờ)` : '';
                          return (
                            <li key={idx} style={{ paddingLeft: '1rem' }}>
                              - Hủy trước thời điểm bắt đầu thuê từ {rule.daysBeforeRental} ngày{hText} trở lên: Hoàn trả {rule.refundPercentage}% tiền thuê.
                            </li>
                          );
                        }
                        const curH = rule.daysBeforeRental * 24;
                        const prevH = prev!.daysBeforeRental * 24;
                        if (rule.daysBeforeRental === 0) {
                          return (
                            <li key={idx} style={{ paddingLeft: '1rem' }}>
                              - Hủy trong vòng dưới {prev!.daysBeforeRental} ngày (dưới {prevH} giờ) trước thời điểm bắt đầu thuê: Hoàn trả {rule.refundPercentage}% tiền thuê{rule.refundPercentage === 0 ? ' (không hoàn lại tiền thuê)' : ''}.
                            </li>
                          );
                        }
                        return (
                          <li key={idx} style={{ paddingLeft: '1rem' }}>
                            - Hủy trước thời điểm bắt đầu thuê từ {rule.daysBeforeRental} ngày ({curH} giờ) đến dưới {prev!.daysBeforeRental} ngày ({prevH} giờ): Hoàn trả {rule.refundPercentage}% tiền thuê.
                          </li>
                        );
                      });
                    })()
                  ) : (
                    <li>Tiền thuê được hoàn trả theo quy định đã phê duyệt của Shop.</li>
                  )}
                  {cancelPolicy.cancellationNotes && (
                    <li>
                      <strong>Lưu ý hủy đơn từ Shop:</strong> {cancelPolicy.cancellationNotes}
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="vh-article-block">
                <h5>ĐIỀU 5: CHÍNH SÁCH HỦY ĐƠN VÀ HOÀN TIỀN</h5>
                <ul>
                  <li>
                    <strong>Quy định hủy từ Bên Cho Thuê:</strong>{' '}
                    {policies.providerCancellation || 'Áp dụng theo quy chế hoạt động của nền tảng VibeHue.'}
                  </li>
                  {policies.cancellation?.value?.freeCancelBeforeHours && (
                    <li>
                      <strong>Quy định bảo vệ từ Sàn VibeHue:</strong> Cho phép hủy miễn phí trước{' '}
                      {policies.cancellation.value.freeCancelBeforeHours} giờ so với thời điểm nhận đồ. Tiền cọc và tiền thuê sẽ được hoàn trả theo quy trình của sàn.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {customTerms && customTerms.trim() && (
              <div className="vh-article-block">
                <h5>ĐIỀU 6: ĐIỀU KHOẢN BỔ SUNG CỦA BÊN CHO THUÊ</h5>
                <ul>
                  <li>
                    <strong>Cam kết riêng của Bên Cho Thuê:</strong> {customTerms.trim()}
                  </li>
                </ul>
              </div>
            )}

            <div className="vh-article-block">
              <h5>ĐIỀU {customTerms && customTerms.trim() ? 7 : 6}: HIỆU LỰC HỢP ĐỒNG VÀ XÁC NHẬN GIAO KẾT ĐIỆN TỬ</h5>
              <ul>
                <li>Hợp đồng điện tử này được xác lập (formedAt) tại thời điểm Bên B hoàn tất xác nhận chấp thuận điện tử trên hệ thống VibeHue theo quy định của Luật Giao dịch điện tử.</li>
                <li>Điều kiện thực thi và hiệu lực cung cấp dịch vụ (effectiveAt) bắt đầu khi đơn hàng hoàn tất nghĩa vụ thanh toán (paidAt) và được hệ thống xác nhận hợp lệ theo Quy chế nền tảng.</li>
                <li>Bản ghi hợp đồng điện tử được tạo mã băm SHA-256 để bảo đảm tính toàn vẹn kỹ thuật, chống sửa đổi trái phép và phục vụ tra cứu, đối soát theo quy định.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section V: Execution & Audit Trail */}
        <div className="vh-doc-section">
          <div className="vh-doc-section-title">V. XÁC NHẬN ĐIỆN TỬ VÀ HIỆU LỰC HỢP ĐỒNG</div>
          <div className="vh-doc-execution-grid">
            <div className="vh-exec-card">
              <div className="vh-exec-role">ĐẠI DIỆN BÊN CHO THUÊ</div>
              <div className="vh-exec-text">
                Đại diện: <strong>{provName}</strong>
              </div>
              <div className="vh-exec-text">Cơ chế: Tự động giao kết theo Quy chế nền tảng</div>
              <div className="vh-exec-text muted">
                {policies.providerPolicyVersion
                  ? `Chính sách áp dụng: Phiên bản v${policies.providerPolicyVersion} đã được phê duyệt`
                  : 'Áp dụng điều kiện giao dịch chung đã cam kết với VibeHue'}
              </div>
              <div className="vh-exec-badge platform">[ GHI NHẬN THEO QUY CHẾ NỀN TẢNG ]</div>
            </div>

            <div className="vh-exec-card">
              <div className="vh-exec-role">
                {isAccepted ? 'ĐẠI DIỆN BÊN THUÊ' : 'ĐẠI DIỆN BÊN THUÊ (BẢN XEM TRƯỚC)'}
              </div>
              <div className="vh-exec-text">
                {isAccepted ? 'Người chấp thuận: ' : 'Người thuê: '}
                <strong>{custName}</strong>
                {!isAccepted && ' (Chờ xác nhận)'}
              </div>
              <div className="vh-exec-text muted">
                Thời điểm: {isAccepted ? 'Đã xác nhận điện tử' : 'Chưa ghi nhận (Bản xem trước)'}
              </div>
              <div className="vh-exec-text muted">
                Xác thực: {isAccepted ? 'APP_SESSION' : 'Chưa thực hiện'}
              </div>
              <div className={`vh-exec-badge ${isAccepted ? 'accepted' : 'pending'}`}>
                {isAccepted ? (
                  <>
                    <CheckCircle2 size={13} /> [ ĐÃ CHẤP THUẬN ĐIỆN TỬ ]
                  </>
                ) : (
                  <>
                    <Clock size={13} /> [ CHƯA CHẤP THUẬN — BẢN XEM TRƯỚC ]
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="vh-doc-audit-metadata">
            <details style={{ fontSize: '0.72rem', color: '#64748b' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                Thông tin kiểm chứng kỹ thuật & tính toàn vẹn (SHA-256)
              </summary>
              <div style={{ marginTop: '0.35rem', lineHeight: '1.4' }}>
                <div><strong>Mã tham chiếu đơn:</strong> {bookingId || bookingCode || 'N/A'}</div>
                <div><strong>Content SHA-256:</strong> <code style={{ wordBreak: 'break-all' }}>{contentHash || 'N/A'}</code></div>
                {bookingFingerprint && (
                  <div><strong>Booking Fingerprint:</strong> <code style={{ wordBreak: 'break-all' }}>{bookingFingerprint}</code></div>
                )}
              </div>
            </details>
          </div>
        </div>

        {/* Document Footer */}
        <div className="vh-doc-footer">
          Hợp đồng điện tử VibeHue — Nền tảng cho thuê trang phục truyền thống | Bản xem trước chuẩn PDF
        </div>
      </div>
    );
  }

  // Fallback for plain text format: still render in a paper container for readable presentation
  return (
    <div className="vh-doc-preview-wrapper" data-testid="contract-terms-reader">
      <div className="vh-doc-header">
        <div className="vh-doc-nation">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div className="vh-doc-motto">Độc lập - Tự do - Hạnh phúc</div>
        <div className="vh-doc-divider">-------------------o0o-------------------</div>
        <h2 className="vh-doc-title">HỢP ĐỒNG ĐIỆN TỬ THUÊ TRANG PHỤC ÁO DÀI</h2>
      </div>
      <div className="vh-contract-reader-box" style={{ border: 'none', background: 'transparent', padding: '0.5rem 1rem' }}>
        {renderedText || 'Đang tải nội dung hợp đồng...'}
      </div>
    </div>
  );
};
