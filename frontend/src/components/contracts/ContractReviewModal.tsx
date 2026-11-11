import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Store,
  CreditCard,
  X,
  Loader2,
  AlertTriangle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import {
  contractService,
  type BookingReadinessResponse,
  type ContractDetail,
  type ContractReadinessStatus,
} from '../../services/contractService';
import { translateError } from '../../utils/errorTranslator';
import { useToast } from '../feedback/Toast';
import { ContractDocumentPreview } from './ContractDocumentPreview';
import { ContractQuickConsentCard } from './ContractQuickConsentCard';
import './ContractReviewModal.css';

export interface ContractReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  bookingData?: {
    bookingCode?: string;
    items?: unknown[];
    pricingSummary?: unknown;
    [key: string]: unknown;
  };
  onAllAccepted: () => void;
}

export const ContractReviewModal: React.FC<ContractReviewModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  bookingData,
  onAllAccepted,
}) => {
  const toast = useToast();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<BookingReadinessResponse | null>(null);
  const [contracts, setContracts] = useState<ContractDetail[]>([]);
  const [activeContractIndex, setActiveContractIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);
  const [isRefreshingVersion, setIsRefreshingVersion] = useState<boolean>(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const handleNavigateToCart = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/cart';
    }
  };

  const handleOpenPdf = async () => {
    if (!currentContract) return;
    setPdfLoading(true);
    try {
      toast.info('Đang tải bản PDF hợp đồng chuẩn...');
      const { blob } = await contractService.downloadPdfBlob(currentContract.contractId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e: any) {
      console.error('Failed to open PDF:', e);
      toast.error('Chưa thể mở file PDF lúc này: ' + (e?.message || 'Vui lòng thử lại'));
    } finally {
      setPdfLoading(false);
    }
  };

  // Fetch readiness and contract details
  const loadContractsData = useCallback(async () => {
    if (!bookingId) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const readRes = await contractService.getBookingReadiness(bookingId);
      setReadiness(readRes);

      if (readRes.requirement === 'NOT_REQUIRED') {
        setIsLoading(false);
        return;
      }

      // Fetch full details (with renderedText) for all contracts requiring consent
      const contractDetails: ContractDetail[] = [];
      for (const p of readRes.providers) {
        if (p.contractId) {
          try {
            const detail = await contractService.getContractDetail(p.contractId);
            contractDetails.push(detail);
          } catch (e: unknown) {
            console.error(`Failed to load contract ${p.contractId}:`, e);
          }
        }
      }

      setContracts(contractDetails);
    } catch (err: unknown) {
      console.error('Failed to load contract readiness:', err);
      const msg = err instanceof Error ? err.message : 'Không thể tải thông tin hợp đồng điện tử. Vui lòng thử lại.';
      setErrorMsg(translateError(msg));
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      void loadContractsData();
      setActiveContractIndex(0);
      setHasAgreed(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, loadContractsData]);

  if (!isOpen) return null;

  const currentContract = contracts[activeContractIndex] || null;
  const currentProviderReadiness = readiness?.providers.find(
    (p) => p.contractId === currentContract?.contractId,
  );
  const isQuickMode =
    currentContract?.presentationMode === 'QUICK' ||
    currentProviderReadiness?.presentationMode === 'QUICK';

  const holdExpiresAtRaw =
    (bookingData as any)?.holdExpiresAt ||
    currentContract?.snapshot?.booking?.holdExpiresAt;
  const isHoldExpired = Boolean(
    holdExpiresAtRaw && new Date(holdExpiresAtRaw).getTime() <= Date.now(),
  );
  const isDeclined =
    currentProviderReadiness?.status === 'DECLINED' ||
    currentContract?.versionState === 'DECLINED';
  const isStale =
    currentProviderReadiness?.status === 'STALE_SNAPSHOT';

  useEffect(() => {
    setHasAgreed(false);
    setRefreshNotice(null);
  }, [currentContract?.versionId]);

  const handleRefreshContracts = async () => {
    setIsRefreshingVersion(true);
    setRefreshNotice(null);
    try {
      toast.info('Đang yêu cầu tạo phiên bản hợp đồng mới...');
      const previousVersionId = currentContract?.versionId;
      const refreshedReadiness = await contractService.refreshContracts(bookingId);
      const matched = refreshedReadiness?.providers?.find(
        (p) =>
          (currentContract?.providerId && p.providerId === currentContract.providerId) ||
          (currentContract?.contractId && p.contractId === currentContract.contractId),
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

      toast.success('Đã cập nhật phiên bản hợp đồng mới! Vui lòng xem xét và chấp thuận.');
      setRefreshNotice(null);
      await loadContractsData();
      setHasAgreed(false);
    } catch (err: unknown) {
      console.error('Failed to refresh contracts:', err);
      const msg = err instanceof Error ? err.message : '';
      const translated = translateError(msg);
      toast.error(translated || 'Không thể cập nhật phiên bản mới.');
    } finally {
      setIsRefreshingVersion(false);
    }
  };

  const getStatusBadge = (status?: ContractReadinessStatus) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="vh-accepted-badge" data-testid="status-accepted">
            <CheckCircle2 size={14} /> Đã ghi nhận chấp thuận
          </span>
        );
      case 'DECLINED':
        return (
          <span className="vh-declined-badge" data-testid="status-declined">
            <X size={14} /> Khách hàng đã từ chối
          </span>
        );
      case 'STALE_SNAPSHOT':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px',
              backgroundColor: '#fed7aa',
              color: '#9a3412',
              fontWeight: 600,
              fontSize: '0.8125rem',
            }}
            data-testid="status-stale"
          >
            <AlertTriangle size={14} /> Điều khoản đã thay đổi
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="vh-declined-badge" data-testid="status-expired">
            <Clock size={14} /> Phiên bản đã hết hạn
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              fontWeight: 600,
              fontSize: '0.8125rem',
            }}
            data-testid="status-awaiting"
          >
            <Clock size={14} /> Chờ khách hàng chấp thuận
          </span>
        );
    }
  };

  const handleConsent = async (action: 'ACCEPT' | 'DECLINE') => {
    if (!currentContract || !currentContract.versionId) {
      toast.error('Thiếu thông tin phiên bản hợp đồng.');
      return;
    }

    if (action === 'ACCEPT' && !hasAgreed) {
      toast.error('Vui lòng tích chọn "Tôi đồng ý điều khoản" trước khi chấp thuận hợp đồng.');
      return;
    }

    if (!currentContract.contentHash || !currentContract.bookingFingerprint) {
      toast.error('Thiếu mã băm chứng thực hợp đồng từ máy chủ.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Strictly pass exact hashes from backend, zero client recalculation
      const idempotencyKey = `consent-${currentContract.contractId}-${currentContract.versionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await contractService.submitConsent(
        currentContract.contractId,
        {
          contractVersionId: currentContract.versionId,
          action,
          contentHash: currentContract.contentHash,
          bookingFingerprint: currentContract.bookingFingerprint,
          idempotencyKey,
        },
      );

      toast.success(
        action === 'ACCEPT'
          ? 'Đã chấp thuận điều khoản hợp đồng!'
          : 'Đã ghi nhận từ chối điều khoản hợp đồng.',
      );

      // Refetch state from backend to enforce single source of truth
      await loadContractsData();
    } catch (err: unknown) {
      console.error('Failed to submit contract consent:', err);
      const msg = err instanceof Error ? err.message : '';
      const translated = translateError(msg);
      toast.error(translated || 'Lỗi khi ghi nhận chấp thuận.');
      await loadContractsData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const acceptedCount =
    readiness?.providers.filter((p) => p.status === 'ACCEPTED').length || 0;
  const totalCount = readiness?.providers.length || 0;
  const isAllAccepted = readiness?.ready === true;

  return (
    <div className="vh-contract-modal-overlay" data-testid="contract-review-modal">
      <div
        className="vh-contract-modal-container"
        style={isQuickMode ? { maxWidth: 760 } : undefined}
      >
        {/* Header */}
        <div className="vh-contract-modal-header">
          <div className="vh-contract-modal-title">
            <ShieldCheck size={22} />
            <span>
              {isQuickMode
                ? 'Thỏa thuận Thuê nhanh Trang phục'
                : 'Xem xét & Chấp thuận Hợp đồng Điện tử'}
            </span>
          </div>
          <button
            className="vh-contract-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="vh-contract-modal-body">
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1rem',
                gap: '1rem',
                color: '#64748b',
              }}
              data-testid="contract-loading"
            >
              <Loader2 size={32} className="animate-spin" />
              <span>{isQuickMode ? 'Đang tải thông tin thuê nhanh...' : 'Đang tải thông tin hợp đồng điện tử...'}</span>
            </div>
          ) : errorMsg ? (
            <div className="vh-contract-banner">
              <AlertTriangle size={20} />
              <div>
                <strong>{isQuickMode ? 'Lỗi tải thỏa thuận:' : 'Lỗi tải hợp đồng:'}</strong> {errorMsg}
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    className="vh-btn-secondary"
                    onClick={() => loadContractsData()}
                  >
                    Tải lại
                  </button>
                </div>
              </div>
            </div>
          ) : readiness?.requirement === 'NOT_REQUIRED' ? (
            <div className="vh-contract-banner success" data-testid="contract-not-required">
              <CheckCircle2 size={20} />
              <div>
                Đơn hàng này không yêu cầu ký kết hợp đồng thuê điện tử. Bạn có thể
                tiến hành thanh toán ngay.
              </div>
            </div>
          ) : contracts.length === 0 ? (
            <div className="vh-contract-banner">
              <AlertCircle size={20} />
              <div>
                <div>
                  {isQuickMode
                    ? 'Chưa có thông tin thỏa thuận thuê cho đơn hàng này. Vui lòng liên hệ hỗ trợ hoặc thử lại.'
                    : 'Chưa có hợp đồng nào được tạo cho đơn hàng này. Vui lòng liên hệ hỗ trợ hoặc thử lại.'}
                </div>
                {readiness?.blockers && readiness.blockers.length > 0 && (
                  <p style={{ margin: '0.35rem 0 0', color: '#b91c1c', fontSize: '0.825rem' }}>
                    Nguyên nhân: {translateError(readiness.blockers[0])}
                  </p>
                )}
                <div style={{ marginTop: '0.75rem' }}>
                  <button
                    className="vh-btn-secondary"
                    onClick={() => void loadContractsData()}
                  >
                    Thử lại
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Overview Banner */}
              {!isQuickMode && (
                <div
                  className={`vh-contract-banner ${isAllAccepted ? 'success' : ''}`}
                  data-testid="contract-overview-banner"
                >
                  {isAllAccepted ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                  <div>
                    <strong>
                      {isAllAccepted
                        ? 'Tất cả hợp đồng đã được chấp thuận!'
                        : `Cần chấp thuận ${totalCount - acceptedCount} hợp đồng thuê trước khi thanh toán`}
                    </strong>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>
                      Theo Quy chế sàn VibeHue, bạn cần đọc và xác nhận các điều khoản
                      cho thuê với từng nhà cung cấp trang phục.
                    </p>
                  </div>
                </div>
              )}

              {/* Multi-provider Tabs if > 1 provider */}
              {contracts.length > 1 && (
                <div className="vh-contract-tabs-nav" data-testid="multi-provider-tabs">
                  {contracts.map((c, idx) => {
                    const pStatus = readiness?.providers.find(
                      (p) => p.contractId === c.contractId,
                    )?.status;
                    return (
                      <button
                        key={c.contractId}
                        className={`vh-contract-tab-btn ${activeContractIndex === idx ? 'active' : ''}`}
                        onClick={() => {
                          setActiveContractIndex(idx);
                          setHasAgreed(false);
                        }}
                        data-testid={`provider-tab-${idx}`}
                      >
                        <Store size={15} />
                        <span>Hợp đồng bên #{idx + 1}</span>
                        {pStatus === 'ACCEPTED' ? (
                          <CheckCircle2 size={14} color="#166534" />
                        ) : (
                          <Clock size={14} color="#b45309" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Current Contract Details */}
              {currentContract && (
                <div data-testid={`contract-card-${currentContract.contractId}`}>
                  {/* Metadata and Provider Summary */}
                  {!isQuickMode && (
                    <div className="vh-contract-info-grid">
                      <div className="vh-contract-info-block">
                        <h4>BÊN CHO THUÊ</h4>
                        <p>
                          <strong>Đơn vị:</strong>{' '}
                          {currentContract.snapshot?.provider?.businessName || (
                            <span>{currentContract.providerId}</span>
                          )}
                        </p>
                        <p>
                          <strong>Mã hợp đồng:</strong>{' '}
                          {currentContract.contractCode || currentContract.contractId}
                        </p>
                        <p>
                          <strong>Phiên bản:</strong> v{currentContract.version || 1}
                        </p>
                      </div>

                      <div className="vh-contract-info-block">
                        <h4>TRẠNG THÁI CHẤP THUẬN</h4>
                        <div style={{ marginTop: '0.25rem' }}>
                          {getStatusBadge(currentProviderReadiness?.status)}
                        </div>
                        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                          Mã đơn thuê:{' '}
                          <strong>
                            {bookingData?.bookingCode ||
                              currentContract.snapshot?.booking?.bookingCode ||
                              (bookingId.length > 12 ? 'B' + bookingId.slice(-10).toUpperCase() : bookingId)}
                          </strong>
                        </p>
                      </div>
                    </div>
                  )}

                  {isQuickMode ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <ContractQuickConsentCard
                        contract={currentContract}
                        bookingId={bookingId}
                        bookingCode={bookingData?.bookingCode}
                        onConsented={async () => {
                          await loadContractsData();
                          setTimeout(() => {
                            onAllAccepted();
                          }, 300);
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Contract Full-Text Terms Reader */}
                      <div style={{ marginTop: '1rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.4rem',
                          }}
                        >
                          <label
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                            }}
                          >
                            <FileText size={16} />
                            Toàn văn Điều khoản Hợp đồng (Bản giao kết điện tử):
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <button
                              type="button"
                              onClick={handleOpenPdf}
                              disabled={pdfLoading}
                              style={{
                                fontSize: '0.75rem',
                                color: '#1e3a6c',
                                backgroundColor: '#edf2f7',
                                border: '1px solid #cbd5e1',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <FileText size={13} />
                              <span>{pdfLoading ? 'Đang tải PDF...' : 'Xem file PDF demo'}</span>
                            </button>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Cuộn xuống để đọc hết
                            </span>
                          </div>
                        </div>

                        <ContractDocumentPreview
                          renderedText={currentContract.renderedText}
                          contractId={currentContract.contractId}
                          contractCode={currentContract.contractCode}
                          version={currentContract.version}
                          bookingCode={bookingData?.bookingCode || currentContract.snapshot?.booking?.bookingCode}
                          providerStatus={currentProviderReadiness?.status}
                          customerName={(bookingData?.customerName as string) || currentContract.snapshot?.customer?.fullName}
                          bookingId={bookingId}
                          contentHash={currentContract.contentHash}
                          bookingFingerprint={currentContract.bookingFingerprint}
                          snapshot={currentContract.snapshot}
                        />
                      </div>

                      {/* Guidance Box for Declined Version */}
                      {isDeclined && (
                        <div
                          style={{
                            marginTop: '0.75rem',
                            padding: '12px 16px',
                            background: '#fff1f2',
                            border: '1px solid #fecdd3',
                            borderRadius: '8px',
                            color: '#9f1239',
                          }}
                          data-testid="declined-contract-guidance"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px' }}>
                            <XCircle size={16} color="#e11d48" />
                            <span>Bạn đã từ chối điều khoản phiên bản này</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5, color: '#be123c' }}>
                            {isHoldExpired
                              ? 'Thời gian giữ chỗ của đơn hàng đã hết hạn. Vui lòng quay lại giỏ hàng để kiểm tra tồn kho và đặt lại đơn mới.'
                              : 'Bạn đã từ chối các điều khoản trong phiên bản này. Nếu bạn và Shop đã trao đổi lại hoặc Shop vừa cập nhật chính sách mới, bạn có thể tạo phiên bản hợp đồng mới để xem và chấp thuận lại.'}
                          </p>
                          {!isHoldExpired && (
                            <div style={{ marginTop: '8px' }}>
                              <button
                                type="button"
                                onClick={handleRefreshContracts}
                                disabled={isRefreshingVersion}
                                className="vh-btn-secondary"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.35rem 0.75rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  backgroundColor: '#ffffff',
                                  borderColor: '#fda4af',
                                  color: '#be123c',
                                  fontWeight: 600,
                                }}
                                data-testid="btn-request-new-version"
                              >
                                {isRefreshingVersion ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                <span>Tạo phiên bản hợp đồng mới</span>
                              </button>
                            </div>
                          )}
                          {refreshNotice && (
                            <div
                              style={{
                                marginTop: '8px',
                                padding: '8px 12px',
                                background: '#fff1f2',
                                border: '1px solid #fecdd3',
                                borderRadius: '6px',
                                fontSize: '0.8125rem',
                                color: '#be123c',
                                fontWeight: 600,
                              }}
                              data-testid="refresh-no-change-notice"
                            >
                              {refreshNotice}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Guidance Box for Stale Version */}
                      {isStale && (
                        <div
                          style={{
                            marginTop: '0.75rem',
                            padding: '12px 16px',
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: '8px',
                            color: '#92400e',
                          }}
                          data-testid="stale-contract-guidance"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px' }}>
                            <AlertTriangle size={16} color="#d97706" />
                            <span>Điều khoản hợp đồng đã thay đổi</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5, color: '#b45309' }}>
                            Thông tin đơn hàng hoặc chính sách cho thuê của Shop đã thay đổi so với bản dự thảo trước đó. Bạn cần tạo phiên bản mới để xem xét và chấp thuận lại.
                          </p>
                          <div style={{ marginTop: '8px' }}>
                            <button
                              type="button"
                              onClick={handleRefreshContracts}
                              disabled={isRefreshingVersion}
                              className="vh-btn-secondary"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.35rem 0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                backgroundColor: '#ffffff',
                                borderColor: '#fcd34d',
                                color: '#92400e',
                                fontWeight: 600,
                              }}
                              data-testid="btn-update-stale-version"
                            >
                              {isRefreshingVersion ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                              <span>Cập nhật phiên bản mới</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Status row in body */}
                      {!isDeclined && !isStale && (
                        <div
                          className={`vh-contract-consent-row ${
                            currentProviderReadiness?.status === 'ACCEPTED' ? 'accepted' : 'pending'
                          }`}
                          style={{ marginTop: '0.75rem' }}
                        >
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                              {currentProviderReadiness?.status === 'ACCEPTED'
                                ? 'Đã hoàn tất chấp thuận điều khoản:'
                                : 'Xác nhận của Bên thuê (Bên B):'}
                            </div>
                            <div style={{ fontSize: '0.785rem', color: '#64748b', marginTop: '0.15rem' }}>
                              {currentProviderReadiness?.status === 'ACCEPTED'
                                ? 'Bạn đã hoàn tất chấp thuận điều khoản của bên cho thuê này.'
                                : 'Bấm nút "Chấp thuận hợp đồng này" ở thanh công cụ bên dưới để xác nhận cam kết điện tử.'}
                            </div>
                          </div>

                          {currentProviderReadiness?.status === 'ACCEPTED' && (
                            <span className="vh-accepted-badge">
                              <CheckCircle2 size={16} /> Đã ghi nhận chấp thuận
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Audit Metadata Box (Collapsible for Clean UX) */}
                  <details className="vh-contract-audit-box" style={{ marginTop: '0.75rem', cursor: 'pointer' }}>
                    <summary style={{ fontWeight: 600, color: '#64748b', fontSize: '0.785rem', outline: 'none' }}>
                      ℹ️ Thông tin kiểm chứng tài liệu (Mã băm SHA-256 & Bằng chứng toàn vẹn)
                    </summary>
                    <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div>
                        • <strong>SHA-256 Content Hash:</strong>{' '}
                        <span>{currentContract.contentHash || 'N/A'}</span>
                      </div>
                      <div>
                        • <strong>Booking Fingerprint:</strong>{' '}
                        <span>{currentContract.bookingFingerprint || 'N/A'}</span>
                      </div>
                      <div>
                        • <strong>Version ID:</strong>{' '}
                        <span>{currentContract.versionId || 'N/A'}</span>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer - Always Sticky & Prominent */}
        <div className="vh-contract-modal-footer">
          <button
            type="button"
            className="vh-btn-secondary"
            onClick={onClose}
          >
            Đóng
          </button>

          <div className="vh-footer-actions-row">
            {!isQuickMode &&
              currentProviderReadiness?.status !== 'ACCEPTED' &&
              !isDeclined &&
              !isStale &&
              contracts.length > 0 && (
                <>
                  <label className="vh-checkbox-label">
                    <input
                      type="checkbox"
                      data-testid="checkbox-agree-terms"
                      checked={hasAgreed}
                      onChange={(e) => setHasAgreed(e.target.checked)}
                      style={{ width: '15px', height: '15px', accentColor: '#166534', cursor: 'pointer' }}
                    />
                    <span>Tôi đồng ý điều khoản</span>
                  </label>

                  <button
                    type="button"
                    className="vh-btn-decline"
                    onClick={() => handleConsent('DECLINE')}
                    disabled={isSubmitting}
                    data-testid="btn-decline-contract"
                  >
                    Từ chối
                  </button>

                  <button
                    type="button"
                    className="vh-btn-accept"
                    onClick={() => handleConsent('ACCEPT')}
                    disabled={!hasAgreed || isSubmitting}
                    data-testid="btn-accept-contract"
                    style={{
                      backgroundColor: hasAgreed ? '#166534' : '#94a3b8',
                      boxShadow: hasAgreed ? '0 4px 12px rgba(22, 101, 52, 0.25)' : 'none',
                      cursor: !hasAgreed || isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: hasAgreed ? 1 : 0.75,
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Đang ghi nhận...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>Chấp thuận hợp đồng này</span>
                      </>
                    )}
                  </button>
                </>
              )}

            {!isQuickMode && isDeclined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="vh-declined-badge" data-testid="status-declined">
                  <X size={15} /> Bạn đã từ chối phiên bản này
                </span>
                {!isHoldExpired ? (
                  <button
                    type="button"
                    className="vh-btn-secondary"
                    onClick={handleRefreshContracts}
                    disabled={isRefreshingVersion}
                    data-testid="btn-footer-request-new-version"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    {isRefreshingVersion ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    <span>Tạo phiên bản mới</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="vh-btn-secondary"
                    onClick={handleNavigateToCart}
                    data-testid="btn-footer-reorder-expired"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                  >
                    <span>Đặt lại đơn hàng</span>
                  </button>
                )}
              </div>
            )}

            {!isQuickMode && isStale && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '9999px',
                    backgroundColor: '#fed7aa',
                    color: '#9a3412',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                  }}
                  data-testid="status-stale"
                >
                  <AlertTriangle size={14} /> Cần cập nhật điều khoản
                </span>
                <button
                  type="button"
                  className="vh-btn-primary"
                  onClick={handleRefreshContracts}
                  disabled={isRefreshingVersion}
                  data-testid="btn-footer-update-stale"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  {isRefreshingVersion ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Cập nhật phiên bản mới</span>
                </button>
              </div>
            )}

            {currentProviderReadiness?.status === 'ACCEPTED' && (
              <span className="vh-accepted-badge" data-testid="status-accepted">
                <CheckCircle2 size={16} /> {isQuickMode ? 'Đã xác nhận thuê nhanh' : 'Đã chấp thuận hợp đồng'}
              </span>
            )}

            {!isQuickMode ? (
              <button
                type="button"
                className="vh-btn-primary"
                onClick={onAllAccepted}
                disabled={!isAllAccepted || isLoading || contracts.length === 0}
                data-testid="btn-proceed-to-payment"
              >
                <CreditCard size={16} />
                <span>
                  {isAllAccepted
                    ? 'Tiếp tục thanh toán PayOS'
                    : `Còn ${totalCount - acceptedCount} hợp đồng chưa chấp thuận`}
                </span>
              </button>
            ) : isAllAccepted ? (
              <button
                type="button"
                className="vh-btn-primary"
                onClick={onAllAccepted}
                disabled={isLoading}
                data-testid="btn-proceed-to-payment"
              >
                <CreditCard size={16} />
                <span>Tiếp tục thanh toán PayOS</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
