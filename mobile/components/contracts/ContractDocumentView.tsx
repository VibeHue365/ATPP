import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import {
  resolveDamageCompensationRules,
  type ContractDetail,
} from '@/types/contract';
import { formatDate, formatDateTime } from '@/utils/booking';
import {
  formatContractMoney,
  formatDamageTierValue,
  getContractStateBadge,
} from '@/utils/contractFormat';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface Props {
  contract: ContractDetail;
}

function asObj(val: unknown): Record<string, any> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, any>)
    : null;
}

function formatLocationSnapshot(loc: unknown): string {
  const obj = asObj(loc);
  if (!obj) return 'Theo địa chỉ cửa hàng trên TàGo';
  const parts = [
    obj.address,
    obj.street,
    obj.ward,
    obj.district,
    obj.city || obj.province,
  ].filter((p) => typeof p === 'string' && p.trim().length > 0);
  if (parts.length > 0) return parts.join(', ');
  if (typeof obj.fullAddress === 'string' && obj.fullAddress.trim()) {
    return obj.fullAddress.trim();
  }
  return 'Theo địa chỉ cửa hàng đã xác thực';
}

export function ContractDocumentView({ contract }: Props) {
  const [showRawText, setShowRawText] = useState(false);
  const snapshot = asObj(contract.snapshot);
  const stateBadge = getContractStateBadge(contract);

  if (!snapshot) {
    return (
      <View style={styles.paper}>
        <View style={styles.legalHeader}>
          <Text style={styles.nationalMotto}>
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </Text>
          <Text style={styles.nationalSub}>Độc lập - Tự do - Hạnh phúc</Text>
          <Text style={styles.docTitle}>
            HỢP ĐỒNG ĐIỆN TỬ THUÊ TRANG PHỤC ÁO DÀI
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              Mã HĐ: {contract.contractCode || contract.contractId.slice(-8).toUpperCase()}
            </Text>
            <StatusBadge label={stateBadge.label} tone={stateBadge.tone} />
          </View>
        </View>
        <Text style={styles.rawText}>
          {contract.renderedText || 'Nội dung hợp đồng đang được cập nhật.'}
        </Text>
      </View>
    );
  }

  const booking = asObj(snapshot.booking) || {};
  const customer = asObj(snapshot.customer) || {};
  const provider = asObj(snapshot.provider) || {};
  const providerContact = asObj(provider.contact) || {};
  const providerAddress = asObj(provider.address) || {};
  const providerItems = Array.isArray(snapshot.providerItems)
    ? (snapshot.providerItems as Record<string, any>[])
    : [];
  const pricing = asObj(snapshot.pricing) || {};
  const bookingSummary = asObj(pricing.bookingSummary);
  const policies = asObj(snapshot.policies) || {};
  const template = asObj(snapshot.template) || {};

  const garmentCare = asObj(policies.providerGarmentCare);
  const lateReturn = asObj(policies.providerLateReturn);
  const cancelPolicy = asObj(policies.providerCancellationPolicy);
  const resolvedDamage = resolveDamageCompensationRules(
    policies.providerDamageCompensation as any,
  );

  const primaryReplacementVal =
    providerItems
      .map((it) => (typeof it.replacementValue === 'number' ? it.replacementValue : 0))
      .find((v) => v > 0) || null;

  const computedRentalSubtotal = providerItems.reduce(
    (sum, it) => sum + Number(it.unitPrice || 0) * Number(it.quantity || 1),
    0,
  );
  const computedDeposit = providerItems.reduce(
    (sum, it) => sum + Number(it.depositAmount || 0) * Number(it.quantity || 1),
    0,
  );

  const cancelRules = Array.isArray(cancelPolicy?.refundRules)
    ? (cancelPolicy.refundRules as Array<{
        daysBeforeRental: number;
        refundPercentage: number;
      }>)
    : [];

  return (
    <View style={styles.paper}>
      {/* National Motto & Doc Title */}
      <View style={styles.legalHeader}>
        <Text style={styles.nationalMotto}>
          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
        </Text>
        <Text style={styles.nationalSub}>Độc lập - Tự do - Hạnh phúc</Text>
        <View style={styles.dividerShort} />
        <Text style={styles.docTitle}>
          {typeof template.title === 'string' && template.title.trim()
            ? template.title
            : 'HỢP ĐỒNG ĐIỆN TỬ THUÊ TRANG PHỤC ÁO DÀI'}
        </Text>
        <View style={styles.metaBadges}>
          <StatusBadge label={stateBadge.label} tone={stateBadge.tone} />
          <StatusBadge
            label={`Phiên bản v${contract.version ?? 1}`}
            tone="neutral"
          />
        </View>
        <Text style={styles.metaCode}>
          Số HĐ: {contract.contractCode || contract.contractId.slice(-8).toUpperCase()}
          {booking.bookingCode ? ` · Mã đơn #${booking.bookingCode}` : ''}
        </Text>
      </View>

      {/* I. Parties */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>I. CÁC BÊN THAM GIA HỢP ĐỒNG</Text>
        <View style={styles.partyBox}>
          <Text style={styles.partyLabel}>BÊN CHO THUÊ (BÊN A - NHÀ CUNG CẤP)</Text>
          <Text style={styles.partyName}>
            {provider.businessName || contract.providerName || 'Cửa hàng đối tác TàGo'}
          </Text>
          {Boolean(providerContact.phone || providerContact.email) && (
            <Text style={styles.clauseLine}>
              Liên hệ: {[providerContact.phone, providerContact.email].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Text style={styles.clauseLine}>
            Địa chỉ: {formatLocationSnapshot(providerAddress)}
          </Text>
        </View>

        <View style={styles.partyBox}>
          <Text style={styles.partyLabel}>BÊN THUÊ (BÊN B - KHÁCH HÀNG)</Text>
          <Text style={styles.partyName}>
            {customer.fullName || 'Khách hàng TàGo'}
          </Text>
          {Boolean(customer.phone || customer.email) && (
            <Text style={styles.clauseLine}>
              Liên hệ: {[customer.phone, customer.email].filter(Boolean).join(' · ')}
            </Text>
          )}
          {Boolean(customer.defaultAddress) && (
            <Text style={styles.clauseLine}>
              Địa chỉ: {formatLocationSnapshot(customer.defaultAddress)}
            </Text>
          )}
        </View>
      </View>

      {/* II. Items & Schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          II. DANH MỤC TRANG PHỤC, THỜI GIAN & ĐỊA ĐIỂM
        </Text>
        {providerItems.map((item, idx) => (
          <View
            key={String(item.bookingItemId || item.productId || idx)}
            style={styles.itemCard}
          >
            <Text style={styles.itemTitle}>
              {idx + 1}. {item.productName || 'Trang phục Áo dài'}
            </Text>
            <View style={styles.itemGrid}>
              <Text style={styles.itemMeta}>
                Size: {item.size || 'Tiêu chuẩn'}
                {item.color ? ` · Màu: ${item.color}` : ''} · SL: {item.quantity || 1}
              </Text>
              <Text style={styles.itemMeta}>
                Thời gian thuê: {formatDate(item.rentalFrom)} → {formatDate(item.rentalTo)}
              </Text>
              <Text style={styles.itemMeta}>
                Địa điểm giao/trả: {formatLocationSnapshot(item.pickupReturnLocation)}
              </Text>
              <Text style={styles.itemPriceLine}>
                Đơn giá thuê: {formatContractMoney(item.unitPrice)} · Cọc thế chân:{' '}
                {formatContractMoney(item.depositAmount)}
              </Text>
              {typeof item.replacementValue === 'number' &&
                item.replacementValue > 0 && (
                  <Text style={styles.itemReplacement}>
                    Giá trị bồi hoàn tài sản (được duyệt):{' '}
                    {formatContractMoney(item.replacementValue)}
                  </Text>
                )}
            </View>
          </View>
        ))}
      </View>

      {/* III. Pricing & Deposit */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          III. GIÁ THUÊ, TIỀN ĐẶT CỌC & THANH TOÁN ESCROW
        </Text>
        <View style={styles.priceBox}>
          <PriceLine
            label="Tiền thuê trang phục"
            value={formatContractMoney(
              bookingSummary?.rentalSubtotal ?? computedRentalSubtotal,
            )}
          />
          {Number(bookingSummary?.discountAmount || 0) > 0 && (
            <PriceLine
              label="Giảm giá / Voucher"
              value={`-${formatContractMoney(bookingSummary?.discountAmount)}`}
            />
          )}
          <PriceLine
            label="Tiền cọc giữ đồ / thế chân"
            value={formatContractMoney(
              bookingSummary?.depositAmount ?? computedDeposit,
            )}
          />
          <View style={styles.priceDivider} />
          <PriceLine
            label="Tổng thanh toán"
            value={formatContractMoney(
              bookingSummary?.totalAmount ??
                computedRentalSubtotal + computedDeposit,
            )}
            bold
          />
          <Text style={styles.escrowNote}>
            Tiền cọc thế chân được TàGo Escrow giữ an toàn và tự động hoàn trả sau
            khi Bên A xác nhận hoàn trả trang phục nguyên vẹn.
          </Text>
        </View>
      </View>

      {/* IV. Policies */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          IV. CHÍNH SÁCH BẢO QUẢN, TRẢ MUỘN & BỒI THƯỜNG
        </Text>

        {/* Garment care */}
        <View style={styles.subBlock}>
          <Text style={styles.subBlockTitle}>1. Quy định bảo quản trang phục</Text>
          {garmentCare ? (
            <>
              <Text style={styles.clauseLine}>
                • Ủi (là): {garmentCare.allowIroning ? 'Được phép (nhiệt thấp)' : 'Không tự ý ủi nóng'}
                {'  |  '}
                Giặt: {garmentCare.allowWashing ? 'Giặt tay nhẹ nhàng' : 'Không tự ý giặt tẩy — Tiệm sẽ vệ sinh'}
              </Text>
              {Array.isArray(garmentCare.prohibitedActions) &&
                garmentCare.prohibitedActions.length > 0 && (
                  <Text style={styles.clauseLine}>
                    • Nghiêm cấm: {garmentCare.prohibitedActions.join(', ')}
                  </Text>
                )}
              {Boolean(garmentCare.specialNotes) && (
                <Text style={styles.clauseLine}>
                  • Lưu ý thêm: {garmentCare.specialNotes}
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.clauseLine}>
              {policies.providerRental ||
                'Giữ gìn trang phục nguyên vẹn, không tự ý cắt sửa hay làm biến dạng trang phục.'}
            </Text>
          )}
        </View>

        {/* Late return */}
        {lateReturn && (
          <View style={styles.subBlock}>
            <Text style={styles.subBlockTitle}>2. Chính sách trả đồ muộn</Text>
            <Text style={styles.clauseLine}>
              • Miễn phí trễ tối đa: {lateReturn.gracePeriodHours ?? 0} giờ
            </Text>
            <Text style={styles.clauseLine}>
              • Phí trễ theo giờ: {formatContractMoney(lateReturn.hourlyLateFee)}/giờ ·
              Theo ngày: {formatContractMoney(lateReturn.dailyLateFee)}/ngày
            </Text>
            <Text style={styles.clauseLine}>
              • Thời gian trễ tối đa cho phép: {lateReturn.maxLateDaysAllowed ?? 3} ngày
              (sau mốc này xem như mất mát tài sản).
            </Text>
          </View>
        )}

        {/* Damage compensation */}
        <View style={styles.subBlock}>
          <Text style={styles.subBlockTitle}>
            {lateReturn ? '3.' : '2.'} Biểu mức bồi thường hư hỏng / mất mát
          </Text>
          <DamageRow
            label="• Hư hỏng nhẹ"
            rule={resolvedDamage.minorDamage}
            replacementValue={primaryReplacementVal}
          />
          <DamageRow
            label="• Hư hỏng vừa"
            rule={resolvedDamage.moderateDamage}
            replacementValue={primaryReplacementVal}
          />
          <DamageRow
            label="• Hư hỏng nặng"
            rule={resolvedDamage.severeDamage}
            replacementValue={primaryReplacementVal}
          />
          <DamageRow
            label="• Mất mát / Hư hỏng không thể phục hồi"
            rule={resolvedDamage.totalLoss}
            replacementValue={primaryReplacementVal}
          />
          {resolvedDamage.incidentNotificationHours ? (
            <Text style={styles.clauseLine}>
              • Thời hạn thông báo sự cố sau nhận đồ: trong vòng{' '}
              {resolvedDamage.incidentNotificationHours} giờ.
            </Text>
          ) : null}
          {resolvedDamage.disputeResolutionTerms ? (
            <Text style={styles.clauseLine}>
              • Giải quyết tranh chấp: {resolvedDamage.disputeResolutionTerms}
            </Text>
          ) : null}
        </View>

        {/* Cancellation */}
        <View style={styles.subBlock}>
          <Text style={styles.subBlockTitle}>
            {lateReturn ? '4.' : '3.'} Chính sách hủy đơn & hoàn cọc
          </Text>
          {cancelRules.length > 0 ? (
            cancelRules.map((r, i) => (
              <Text key={i} style={styles.clauseLine}>
                • Hủy trước ≥ {r.daysBeforeRental} ngày nhận đồ: hoàn{' '}
                {r.refundPercentage}% tiền cọc đã thanh toán.
              </Text>
            ))
          ) : (
            <Text style={styles.clauseLine}>
              {policies.providerCancellation ||
                'Áp dụng theo quy định hủy đơn tiêu chuẩn của sàn TàGo tại thời điểm đặt lịch.'}
            </Text>
          )}
        </View>

        {Boolean(policies.providerCustomTermsText) && (
          <View style={styles.subBlock}>
            <Text style={styles.subBlockTitle}>Điều khoản riêng của cửa hàng</Text>
            <Text style={styles.clauseLine}>
              {String(policies.providerCustomTermsText)}
            </Text>
          </View>
        )}
      </View>

      {/* V. Consent & Digital Evidence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>V. XÁC NHẬN ĐIỆN TỬ & TOÀN VẸN DỮ LIỆU</Text>
        <View style={styles.integrityBox}>
          <Text style={styles.clauseLine}>
            • Mã băm nội dung (SHA-256):{' '}
            <Text style={styles.mono}>
              {contract.contentHash
                ? `${contract.contentHash.slice(0, 20)}...${contract.contentHash.slice(-10)}`
                : 'Đang cấp phát'}
            </Text>
          </Text>
          <Text style={styles.clauseLine}>
            • Trạng thái ký kết:{' '}
            {contract.customerAcceptedAt
              ? `Đã đồng ý lúc ${formatDateTime(contract.customerAcceptedAt)}`
              : contract.isSigned
                ? 'Đã xác nhận đồng ý điện tử'
                : 'Chưa xác nhận'}
          </Text>
          {contract.expiresAt && !contract.isSigned && (
            <Text style={styles.clauseLine}>
              • Phiên bản giữ chỗ đến: {formatDateTime(contract.expiresAt)}
            </Text>
          )}
        </View>
      </View>

      {Boolean(contract.renderedText) && (
        <View style={styles.rawToggleWrap}>
          <Pressable
            onPress={() => setShowRawText((v) => !v)}
            style={styles.rawToggleBtn}
          >
            <Ionicons
              name={showRawText ? 'chevron-up-outline' : 'document-text-outline'}
              size={15}
              color={Colors.primary}
            />
            <Text style={styles.rawToggleText}>
              {showRawText
                ? 'Ẩn nguyên văn văn bản gốc'
                : 'Xem nguyên văn bản hợp đồng (Text)'}
            </Text>
          </Pressable>
          {showRawText && (
            <Text style={styles.rawText}>{contract.renderedText}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function PriceLine({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, bold && styles.priceBold]}>{label}</Text>
      <Text style={[styles.priceVal, bold && styles.priceBoldPrimary]}>
        {value}
      </Text>
    </View>
  );
}

function DamageRow({
  label,
  rule,
  replacementValue,
}: {
  label: string;
  rule: ReturnType<typeof resolveDamageCompensationRules>['minorDamage'];
  replacementValue?: number | null;
}) {
  return (
    <View style={styles.damageRow}>
      <Text style={styles.damageTierLabel}>{label}</Text>
      <Text style={styles.damageTierVal}>
        {formatDamageTierValue(rule, replacementValue)}
      </Text>
      {Boolean(rule.conditionsAndEvidence) && (
        <Text style={styles.damageCondition}>
          Căn cứ: {rule.conditionsAndEvidence}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  legalHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.md,
    gap: 4,
  },
  nationalMotto: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  nationalSub: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  dividerShort: {
    width: 72,
    height: 1.5,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  docTitle: {
    fontFamily: FontFamily.display,
    fontSize: 15,
    color: Colors.primaryDark,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 2,
  },
  metaBadges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.sm,
  },
  metaText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaCode: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  partyBox: {
    backgroundColor: Colors.surfaceSoft,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: 3,
  },
  partyLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.4,
  },
  partyName: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    color: Colors.text,
  },
  clauseLine: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: 6,
    backgroundColor: Colors.background,
  },
  itemTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13.5,
    color: Colors.text,
  },
  itemGrid: {
    gap: 3,
  },
  itemMeta: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  itemPriceLine: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.text,
    marginTop: 2,
  },
  itemReplacement: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.warning,
  },
  priceBox: {
    backgroundColor: Colors.surfaceSoft,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  priceLabel: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: Colors.textSecondary,
    flex: 1,
  },
  priceVal: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12.5,
    color: Colors.text,
  },
  priceBold: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.text,
    fontSize: 13.5,
  },
  priceBoldPrimary: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
    fontSize: 14,
  },
  priceDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  escrowNote: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 17,
  },
  subBlock: {
    gap: 4,
    paddingLeft: Spacing.xs,
  },
  subBlockTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12.5,
    color: Colors.text,
  },
  damageRow: {
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  damageTierLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12.5,
    color: Colors.text,
  },
  damageTierVal: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.primaryDark,
    marginLeft: 10,
  },
  damageCondition: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: Colors.textMuted,
    marginLeft: 10,
  },
  integrityBox: {
    backgroundColor: Colors.successSoft,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: 4,
  },
  mono: {
    fontFamily: FontFamily.bodyMedium,
    color: Colors.text,
    fontSize: 11.5,
  },
  rawToggleWrap: {
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  rawToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  rawToggleText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  rawText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 19,
    backgroundColor: Colors.surfaceSoft,
    padding: Spacing.md,
    borderRadius: Radius.sm,
  },
});
