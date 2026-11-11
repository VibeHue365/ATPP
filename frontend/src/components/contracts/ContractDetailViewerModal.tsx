import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  ShieldCheck,
  Clock,
  AlertTriangle,
  X,
  CheckCircle2,
  RefreshCw,
  Hash,
} from 'lucide-react';
import { contractService } from '../../services/contractService';
import type { ContractDetail, ContractEvidenceSummary } from '../../services/contractService';
import { useToast } from '../feedback/Toast';
import { ContractDocumentPreview } from './ContractDocumentPreview';
import { ContractCodeDisplay } from './ContractCodeDisplay';
import './ContractReviewModal.css';
import './ContractDocumentPreview.css';

interface ContractDetailViewerModalProps {
  contractId: string | null;
  versionId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  viewerRole?: 'customer' | 'provider' | 'admin';
}

export const ContractDetailViewerModal: React.FC<ContractDetailViewerModalProps> = ({
  contractId,
  versionId,
  isOpen,
  onClose,
  viewerRole = 'customer',
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [contractDetail, setContractDetail] = useState<ContractDetail | null>(null);
  const [evidence, setEvidence] = useState<ContractEvidenceSummary | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !contractId) {
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [detailRes, evidenceRes] = await Promise.allSettled([
          contractService.getContractDetail(contractId),
          contractService.getEvidence(contractId, versionId || undefined),
        ]);

        if (!isMounted) return;

        if (detailRes.status === 'fulfilled') {
          setContractDetail(detailRes.value);
        } else {
          throw detailRes.reason;
        }

        if (evidenceRes.status === 'fulfilled') {
          setEvidence(evidenceRes.value);
        } else {
          // Evidence might not be ready or return 404 for draft contracts
          console.warn('Could not fetch evidence summary:', evidenceRes.reason);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const apiErr = err as { message?: string };
        const msg = apiErr.message || 'Không thể tải chi tiết hợp đồng điện tử.';
        setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
      setContractDetail(null);
      setEvidence(null);
      setError(null);
    };
  }, [isOpen, contractId, versionId]);

  if (!isOpen || !contractId) return null;

  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const res = await contractService.triggerPdfDownload(contractId, versionId || undefined);
      toast.success(
        `Đã tải xuống thành công tài liệu: ${res.filename} (SHA-256: ${res.sha256 ? res.sha256.substring(0, 8) + '...' : 'N/A'})`,
      );
    } catch (err: unknown) {
      console.error('Download contract PDF error:', err);
      const apiErr = err as { status?: number; message?: string };
      if (apiErr.status === 422 || apiErr.message?.includes('CONTRACT_PDF_NOT_READY')) {
        toast.warning('Tài liệu PDF đang được hệ thống tạo và lưu trữ an toàn. Vui lòng thử lại sau giây lát.');
      } else if (apiErr.status === 403 || apiErr.status === 401) {
        toast.error('Bạn không có quyền truy cập hoặc tải tệp tài liệu này.');
      } else if (apiErr.status === 404) {
        toast.error('Không tìm thấy tài liệu PDF hợp đồng được yêu cầu.');
      } else {
        toast.error(apiErr.message || 'Lỗi khi tải tệp hợp đồng điện tử.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const getStatusBadge = () => {
    const state = evidence?.documentStatus || contractDetail?.versionState || contractDetail?.state;
    switch (state) {
      case 'READY':
      case 'ACCEPTED':
        return (
          <span
            data-testid="contract-status-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
            }}
          >
            <CheckCircle2 size={13} /> Đã ghi nhận chấp thuận
          </span>
        );
      case 'GENERATING':
        return (
          <span
            data-testid="contract-status-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: '#eff6ff',
              color: '#1e40af',
              border: '1px solid #bfdbfe',
            }}
          >
            <RefreshCw size={13} className="animate-spin" /> Đang kết xuất PDF...
          </span>
        );
      case 'PENDING':
      case 'AWAITING_CUSTOMER':
        return (
          <span
            data-testid="contract-status-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: '#fffbeb',
              color: '#92400e',
              border: '1px solid #fde68a',
            }}
          >
            <Clock size={13} /> Chờ khách hàng chấp thuận
          </span>
        );
      case 'DECLINED':
      case 'FAILED':
        return (
          <span
            data-testid="contract-status-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
            }}
          >
            <AlertTriangle size={13} /> {state === 'DECLINED' ? 'Khách hàng đã từ chối' : 'Lỗi kết xuất PDF'}
          </span>
        );
      default:
        return (
          <span
            data-testid="contract-status-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
            }}
          >
            {state || 'Khởi tạo'}
          </span>
        );
    }
  };

  const isPdfReady = evidence?.documentStatus === 'READY';

  return (
    <div
      className="vh-contract-modal-overlay"
      data-testid="contract-detail-viewer-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="vh-contract-modal-container" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="vh-contract-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#76141c" />
            <h3 className="vh-contract-modal-title">
              {contractDetail?.presentationMode === 'QUICK' ? 'Thỏa thuận thuê nhanh' : 'Hợp đồng điện tử'}
            </h3>
          </div>
          <button
            type="button"
            className="vh-contract-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
            data-testid="close-contract-viewer-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="vh-contract-modal-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontWeight: 500 }}>Đang tải nội dung hợp đồng và chứng từ điện tử...</p>
            </div>
          )}

          {error && !loading && (
            <div className="vh-contract-banner" role="alert" style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5' }}>
              <AlertTriangle size={18} color="#dc2626" />
              <div>
                <strong>Lỗi tải dữ liệu:</strong> {error}
              </div>
            </div>
          )}

          {!loading && !error && contractDetail && (
            <>
              {/* Metadata strip */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  backgroundColor: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
                  <ContractCodeDisplay
                    code={evidence?.contractCode || contractDetail.contractCode || contractDetail.contractId || contractId}
                    truncate={false}
                    testId="modal-contract-code"
                  />
                  <div>
                    <span style={{ color: '#64748b' }}>Phiên bản: </span>
                    <strong style={{ color: '#0f172a' }}>v{evidence?.versionNumber || contractDetail.version || 1}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Mã đối tác: </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{contractDetail.providerId}</span>
                  </div>
                  {viewerRole === 'provider' && (
                    <div style={{ color: '#0284c7', fontSize: '12px', fontWeight: 600 }}>
                      ✓ Đối tác chấp thuận trước cơ chế theo quy chế nền tảng
                    </div>
                  )}
                </div>
                <div>{getStatusBadge()}</div>
              </div>

              {/* Rendered Contract Document Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} data-testid="contract-rendered-text">
                <ContractDocumentPreview
                  renderedText={contractDetail.renderedText}
                  contractId={contractDetail.contractId}
                  contractCode={evidence?.contractCode || contractDetail.contractCode}
                  version={evidence?.versionNumber || contractDetail.version}
                  bookingCode={contractDetail.snapshot?.booking?.bookingCode}
                  providerStatus={evidence?.customerConsent ? 'ACCEPTED' : undefined}
                  customerName={contractDetail.snapshot?.customer?.fullName}
                  bookingId={contractDetail.bookingId}
                  contentHash={evidence?.contentHash || contractDetail.contentHash}
                  bookingFingerprint={evidence?.bookingFingerprint || contractDetail.bookingFingerprint}
                  snapshot={contractDetail.snapshot}
                />
              </div>

              {/* Evidence & Cryptographic Integrity Card */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  fontSize: '12.5px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: '#0f172a', fontWeight: 700 }}>
                  <ShieldCheck size={16} color="#059669" />
                  <span>Chứng từ điện tử & Bằng chứng toàn vẹn (Evidence Integrity)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Hash size={12} /> Content SHA-256 (Nội dung điều khoản):
                    </div>
                    <code
                      style={{
                        display: 'block',
                        wordBreak: 'break-all',
                        fontSize: '11px',
                        backgroundColor: '#e2e8f0',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        marginTop: '3px',
                      }}
                      title={evidence?.contentHash || contractDetail.contentHash || ''}
                    >
                      {evidence?.contentHash || contractDetail.contentHash || 'Chưa ghi nhận'}
                    </code>
                  </div>

                  <div>
                    <div style={{ color: '#64748b', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={12} /> PDF SHA-256 (Tệp lưu trữ bất biến):
                    </div>
                    <code
                      style={{
                        display: 'block',
                        wordBreak: 'break-all',
                        fontSize: '11px',
                        backgroundColor: evidence?.pdfSha256 ? '#e0f2fe' : '#f1f5f9',
                        color: evidence?.pdfSha256 ? '#0369a1' : '#64748b',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        marginTop: '3px',
                      }}
                      title={evidence?.pdfSha256 || 'Chưa hoàn tất kết xuất'}
                    >
                      {evidence?.pdfSha256 || 'Đang chờ kết xuất tệp PDF...'}
                    </code>
                  </div>
                </div>

                {evidence?.customerConsent && (
                  <div style={{ marginTop: '10px', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', fontSize: '11.5px', color: '#475569' }}>
                    Khách hàng ghi nhận chấp thuận: <strong>{new Date(evidence.customerConsent.consentedAt).toLocaleString('vi-VN')}</strong> • Phương thức: <strong>{evidence.customerConsent.authMethod}</strong>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Hợp đồng dịch vụ điện tử theo quy định giao dịch điện tử của nền tảng VibeHue.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>

            <button
              type="button"
              data-testid="download-contract-pdf-btn"
              onClick={handleDownloadPdf}
              disabled={isDownloading || !isPdfReady}
              title={isPdfReady ? 'Tải tệp PDF hợp đồng chính thức' : 'Tài liệu PDF chưa sẵn sàng'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isPdfReady ? '#76141c' : '#94a3b8',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isPdfReady && !isDownloading ? 'pointer' : 'not-allowed',
                opacity: isPdfReady ? 1 : 0.7,
                transition: 'background-color 0.15s ease',
              }}
            >
              {isDownloading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Đang tải...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>{isPdfReady ? 'Tải PDF Hợp đồng' : 'PDF đang khởi tạo'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
