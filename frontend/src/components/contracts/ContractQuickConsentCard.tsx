import React, { useState, useEffect } from 'react';
import {
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Coins,
  Loader2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  contractService,
  type ContractDetail,
  type BookingReadinessResponse,
  resolveDamageCompensationRules,
} from '../../services/contractService';
import { translateError } from '../../utils/errorTranslator';
import { useToast } from '../feedback/Toast';
import { ContractDetailViewerModal } from './ContractDetailViewerModal';

export interface ContractQuickConsentCardProps {
  contract: ContractDetail;
  bookingId: string;
  onConsented: () => void;
  onRefreshed?: (updatedContract: ContractDetail, readiness: BookingReadinessResponse) => void;
  onModeSwitchToDetailed?: () => void;
  onError?: (err: unknown) => void;
  bookingCode?: string;
}

export const ContractQuickConsentCard: React.FC<ContractQuickConsentCardProps> = ({
  contract,
  bookingId,
  onConsented,
  onRefreshed,
  onModeSwitchToDetailed,
  onError,
  bookingCode,
}) => {
  const toast = useToast();
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFullContractModal, setShowFullContractModal] = useState<boolean>(false);
  const [isRefreshingVersion, setIsRefreshingVersion] = useState<boolean>(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  useEffect(() => {
    setHasAgreed(false);
    setErrorMsg(null);
    setRefreshNotice(null);
  }, [contract.versionId]);

  const snapshot = contract.snapshot || {};
  const isDeclined = contract.versionState === 'DECLINED';
  const holdExpiresAtRaw =
    (contract as any)?.holdExpiresAt ||
    snapshot?.booking?.holdExpiresAt;
  const isHoldExpired = Boolean(
    holdExpiresAtRaw && new Date(holdExpiresAtRaw).getTime() <= Date.now(),
  );

  const handleRefreshContracts = async () => {
    setIsRefreshingVersion(true);
    setRefreshNotice(null);
    try {
      toast.info('Đang yêu cầu tạo phiên bản thỏa thuận mới...');
      const previousVersionId = contract.versionId;
      const readiness = await contractService.refreshContracts(bookingId);
      const matched = readiness?.providers?.find(
        (p) =>
          (contract.providerId && p.providerId === contract.providerId) ||
          (contract.contractId && p.contractId === contract.contractId),
      );

      if (!matched || !matched.versionId) {
        toast.error('Không tìm thấy thông tin hợp đồng sau khi làm mới. Vui lòng thử lại.');
        return;
      }

      const isSameVersion = matched.versionId === previousVersionId;

      if (isSameVersion) {
        const msg = isDeclined
          ? 'Chưa có phiên bản mới do điều khoản chưa thay đổi. Hợp đồng vẫn giữ trạng thái đã từ chối.'
          : 'Chưa có phiên bản mới do điều khoản chưa thay đổi.';
        toast.warning(msg);
        setRefreshNotice(msg);
        return;
      }

      toast.success('Đã cập nhật phiên bản mới! Vui lòng xem xét và đồng ý lại.');
      setRefreshNotice(null);
      setHasAgreed(false);

      const updatedContract = await contractService.getContractDetail(
        matched.contractId || contract.contractId,
      );

      if (
        matched.presentationMode === 'DETAILED' ||
        updatedContract.presentationMode === 'DETAILED' ||
        readiness.presentationMode === 'DETAILED'
      ) {
        if (onModeSwitchToDetailed) {
          onModeSwitchToDetailed();
        } else if (onRefreshed) {
          onRefreshed(updatedContract, readiness);
        }
      } else if (onRefreshed) {
        onRefreshed(updatedContract, readiness);
      }
    } catch (err: unknown) {
      console.error('Failed to refresh contract:', err);
      const msg = err instanceof Error ? err.message : '';
      const translated = translateError(msg);
      toast.error(translated || 'Không thể tạo phiên bản mới.');
    } finally {
      setIsRefreshingVersion(false);
    }
  };
  const pricing = snapshot.pricing || {};
  const summary = (pricing as any)?.bookingSummary || {};
  const policies = snapshot.policies || {};
  const provider = snapshot.provider || {};
  const items: any[] = snapshot.items || snapshot.providerItems || [];

  let itemsRentalTotal = 0;
  let itemsDepositTotal = 0;
  let itemsReplacementTotal = 0;
  for (const it of items) {
    const q = Math.max(1, Number(it.quantity) || 1);
    const uPrice = Number(it.unitPrice) || Number(it.rentalPrice) || 0;
    const dep = Number(it.depositAmount) || 0;
    const rep =
      Number(it.replacementValue) ||
      Number(it.productReplacementValue) ||
      Number((it as any).product?.replacementValue) ||
      0;
    itemsRentalTotal += uPrice * q;
    itemsDepositTotal += dep * q;
    itemsReplacementTotal += rep * q;
  }

  const replacementValue =
    itemsReplacementTotal > 0
      ? itemsReplacementTotal
      : Number((snapshot as any)?.replacementValueTotal) > 0
      ? Number((snapshot as any).replacementValueTotal)
      : Number((snapshot as any)?.replacementValue) > 0
      ? Number((snapshot as any).replacementValue)
      : 0;

  const rentalFee =
    Number(pricing.rentalFee) > 0
      ? Number(pricing.rentalFee)
      : Number(pricing.totalAmount) > 0
      ? Number(pricing.totalAmount)
      : Number(summary.subTotal) > 0
      ? Number(summary.subTotal)
      : Number(summary.rentalTotal) > 0
      ? Number(summary.rentalTotal)
      : itemsRentalTotal;

  const depositAmount =
    Number(pricing.depositAmount) > 0
      ? Number(pricing.depositAmount)
      : Number(summary.depositTotal) > 0
      ? Number(summary.depositTotal)
      : itemsDepositTotal;

  const lateReturn = policies.providerLateReturn || policies.lateReturn || {};
  const gracePeriodHours =
    lateReturn.gracePeriodHours != null && lateReturn.gracePeriodHours > 0
      ? lateReturn.gracePeriodHours
      : lateReturn.gracePeriod != null && lateReturn.gracePeriod > 0
      ? lateReturn.gracePeriod
      : 2;
  const hourlyLateFee =
    lateReturn.hourlyLateFee != null && lateReturn.hourlyLateFee > 0
      ? lateReturn.hourlyLateFee
      : lateReturn.hourlyFee != null && lateReturn.hourlyFee > 0
      ? lateReturn.hourlyFee
      : 30000;
  const dailyLateFee =
    lateReturn.dailyLateFee != null && lateReturn.dailyLateFee > 0
      ? lateReturn.dailyLateFee
      : lateReturn.dailyFee != null && lateReturn.dailyFee > 0
      ? lateReturn.dailyFee
      : 150000;

  const damageRules = typeof resolveDamageCompensationRules === 'function'
    ? resolveDamageCompensationRules(policies.providerDamageCompensation || policies.damageCompensation)
    : {
        minorDamage: { method: 'INCIDENT_NEGOTIATION' as const, fixedFeeAmount: null, tier: 'minorDamage' as const, percentageOfAsset: null, conditionsAndEvidence: null },
        moderateDamage: { method: 'INCIDENT_NEGOTIATION' as const, fixedFeeAmount: null, tier: 'moderateDamage' as const, percentageOfAsset: null, conditionsAndEvidence: null },
        severeDamage: { method: 'INCIDENT_NEGOTIATION' as const, fixedFeeAmount: null, tier: 'severeDamage' as const, percentageOfAsset: null, conditionsAndEvidence: null },
        totalLoss: { method: 'INCIDENT_NEGOTIATION' as const, fixedFeeAmount: null, tier: 'totalLoss' as const, percentageOfAsset: null, conditionsAndEvidence: null },
        incidentNotificationHours: null,
        disputeResolutionTerms: null,
        isLegacyV1: false,
        requiresAssetValue: false,
      };

  const formatVnd = (amount: unknown): string => {
    const num = typeof amount === 'number' ? amount : Number(amount) || 0;
    return `${num.toLocaleString('vi-VN')} đ`;
  };

  const handleQuickConsent = async () => {
    if (!hasAgreed) {
      toast.error('Vui lòng tích chọn đồng ý điều khoản trước khi xác nhận.');
      return;
    }

    if (!contract.contractId || !contract.versionId) {
      toast.error('Thiếu thông tin phiên bản hợp đồng.');
      return;
    }

    if (!contract.contentHash || !contract.bookingFingerprint) {
      toast.error('Thiếu mã băm chứng thực hợp đồng từ máy chủ.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = `quick-consent-${contract.contractId}-${contract.versionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await contractService.submitConsent(contract.contractId, {
        contractVersionId: contract.versionId,
        action: 'ACCEPT',
        contentHash: contract.contentHash,
        bookingFingerprint: contract.bookingFingerprint,
        idempotencyKey,
      });

      toast.success('Đã xác nhận điều khoản thuê trang phục!');
      onConsented();
    } catch (err: unknown) {
      console.error('Failed to submit quick consent:', err);
      const msg = err instanceof Error ? err.message : '';
      const translated = translateError(msg) || 'Lỗi khi ghi nhận chấp thuận điều khoản.';
      setErrorMsg(translated);
      toast.error(translated);
      if (onError) onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="contract-quick-consent-card"
      data-testid="contract-quick-consent-card"
      style={{
        borderRadius: 14,
        border: '1px solid #fed7aa',
        background: '#fffaf5',
        padding: 20,
        marginBottom: 20,
        boxShadow: '0 2px 8px rgba(234, 88, 12, 0.06)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          borderBottom: '1px dashed #fdba74',
          paddingBottom: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#ffedd5',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#9a3412' }}>
                Thỏa thuận thuê nhanh trang phục
              </h4>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: '#ea580c',
                  color: '#ffffff',
                }}
                data-testid="presentation-mode-quick-badge"
              >
                QUICK
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#7c2d12' }}>
              Cửa hàng: <strong>{provider.storeName || 'Cửa hàng cho thuê'}</strong>
              {bookingCode
                ? ` • Đơn hàng: #${bookingCode}`
                : bookingId
                ? ` • Đơn hàng: #${bookingId.slice(-8).toUpperCase()}`
                : ''}
              {items.length > 0 ? ` • ${items[0]?.productName || 'Trang phục'}${items.length > 1 ? ` (+${items.length - 1})` : ''}` : ''}
              {replacementValue > 0 ? ` • Giá trị trang phục: ${formatVnd(replacementValue)}` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFullContractModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: '1px solid #ea580c',
            color: '#c2410c',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          data-testid="btn-view-full-contract"
        >
          <FileText size={14} /> Xem văn bản đầy đủ <ExternalLink size={12} />
        </button>
      </div>

      {/* Summary Terms Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* Pricing Summary */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid #ffedd5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9a3412', fontWeight: 600 }}>
            <Coins size={14} /> Tiền thuê & Cọc
          </div>
          <div style={{ fontSize: 13, marginTop: 4, color: '#1f2937' }}>
            Thuê: <strong>{formatVnd(rentalFee)}</strong>
          </div>
          <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
            Tiền đặt cọc: <strong>{formatVnd(depositAmount)}</strong> (Hoàn trả khi trả đồ nguyên vẹn)
          </div>
        </div>

        {/* Late Return Rules */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid #ffedd5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9a3412', fontWeight: 600 }}>
            <Clock size={14} /> Quy định trả đồ & Trễ hạn
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: '#1f2937' }}>
            Ân hạn trả trễ: <strong>{gracePeriodHours} giờ</strong>
          </div>
          <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
            Phí quá hạn: {formatVnd(hourlyLateFee)}/giờ • {formatVnd(dailyLateFee)}/ngày
          </div>
        </div>

        {/* Incident / Damage Rules */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid #ffedd5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9a3412', fontWeight: 600 }}>
            <ShieldCheck size={14} /> Bồi thường sự cố
          </div>
          {replacementValue > 0 && (
            <div style={{ fontSize: 13, marginTop: 4, color: '#1f2937' }}>
              Giá trị bồi hoàn: <strong style={{ color: '#b91c1c' }}>{formatVnd(replacementValue)}</strong>
            </div>
          )}
          <div style={{ fontSize: 12, marginTop: replacementValue > 0 ? 2 : 4, color: '#4b5563' }}>
            Hư hỏng nhẹ: <strong>{damageRules.minorDamage.method === 'FIXED_FEE' ? formatVnd(damageRules.minorDamage.fixedFeeAmount) : 'Theo thỏa thuận'}</strong>
          </div>
          <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
            Hư hỏng nặng / Mất: {replacementValue > 0 ? `Tối đa ${formatVnd(replacementValue)}` : 'Theo chính sách niêm yết'}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {/* Consent Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          paddingTop: 12,
          borderTop: '1px solid #fed7aa',
        }}
      >
        {isDeclined ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#9f1239',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
            data-testid="quick-declined-guidance"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
              <AlertCircle size={15} color="#e11d48" />
              <span>Bạn đã từ chối thỏa thuận thuê nhanh phiên bản này</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#be123c', lineHeight: 1.5 }}>
              {isHoldExpired
                ? 'Thời gian giữ chỗ của đơn hàng đã hết hạn. Vui lòng quay lại giỏ hàng để đặt lại đơn mới.'
                : 'Nếu các bên đã thống nhất lại điều khoản hoặc Shop cập nhật chính sách, bạn có thể tạo phiên bản mới để xem xét lại.'}
            </p>
            {!isHoldExpired && (
              <div>
                <button
                  type="button"
                  onClick={handleRefreshContracts}
                  disabled={isRefreshingVersion}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 6,
                    background: '#ffffff',
                    border: '1px solid #fda4af',
                    color: '#be123c',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isRefreshingVersion ? 'not-allowed' : 'pointer',
                  }}
                  data-testid="btn-quick-refresh-version"
                >
                  {isRefreshingVersion ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  <span>Tạo phiên bản mới</span>
                </button>
              </div>
            )}
            {refreshNotice && (
              <div
                style={{
                  marginTop: 4,
                  padding: '6px 10px',
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#be123c',
                  fontWeight: 600,
                }}
                data-testid="quick-refresh-no-change-notice"
              >
                {refreshNotice}
              </div>
            )}
          </div>
        ) : (
          <>
            <label
              htmlFor={`quick-agree-${contract.contractId}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: 'pointer',
                flex: 1,
                minWidth: 260,
              }}
            >
              <input
                type="checkbox"
                id={`quick-agree-${contract.contractId}`}
                data-testid="quick-consent-checkbox"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', accentColor: '#ea580c' }}
              />
              <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                Tôi đã đọc, hiểu và đồng ý với các <strong>điều khoản thuê trang phục</strong> áp dụng cho đơn hàng này.
              </span>
            </label>

            <button
              type="button"
              data-testid="quick-consent-submit-button"
              disabled={!hasAgreed || isSubmitting}
              onClick={handleQuickConsent}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                borderRadius: 8,
                background: !hasAgreed || isSubmitting ? '#fed7aa' : '#ea580c',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: !hasAgreed || isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: hasAgreed ? '0 2px 6px rgba(234, 88, 12, 0.25)' : 'none',
                transition: 'background 0.2s',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Đang xác nhận...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Xác nhận thuê nhanh
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Full Document Viewer Modal */}
      <ContractDetailViewerModal
        isOpen={showFullContractModal}
        onClose={() => setShowFullContractModal(false)}
        contractId={contract.contractId}
        versionId={contract.versionId}
        viewerRole="customer"
      />
    </div>
  );
};
