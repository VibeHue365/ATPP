import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { CONTRACTS_V2_ENABLED } from '../../config/features';
import { contractService } from '../../services/contractService';
import type { ContractSummary } from '../../services/contractService';
import { ContractDetailViewerModal } from './ContractDetailViewerModal';
import { ContractCodeDisplay } from './ContractCodeDisplay';
import { useToast } from '../feedback/Toast';

interface BookingContractsSectionProps {
  bookingId: string;
  bookingStatus?: string;
  viewerRole?: 'customer' | 'provider' | 'admin';
  title?: string;
  hideWhenEmpty?: boolean;
  onContractsLoaded?: (contracts: ContractSummary[]) => void;
}

export const BookingContractsSection: React.FC<BookingContractsSectionProps> = ({
  bookingId,
  bookingStatus,
  viewerRole = 'customer',
  title = 'Hợp đồng điện tử',
  hideWhenEmpty = true,
  onContractsLoaded,
}) => {
  const toast = useToast();
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(CONTRACTS_V2_ENABLED && bookingId));
  const [error, setError] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [downloadingContractId, setDownloadingContractId] = useState<string | null>(null);

  useEffect(() => {
    if (!CONTRACTS_V2_ENABLED || !bookingId) {
      return;
    }

    let isMounted = true;

    const fetchContracts = async () => {
      try {
        setError(null);
        setLoading(true);
        const data = await contractService.listContractsForBooking(bookingId);
        if (isMounted) {
          // If the booking is CANCELLED, filter out void unaccepted draft contracts
          const filtered = (data || []).filter((c) => {
            const isSigned =
              Boolean(c.isSigned) ||
              ['ACCEPTED', 'EFFECTIVE', 'TERMINATED', 'SUPERSEDED'].includes(c.state || '') ||
              c.legacyStatus === 'ACCEPTED' ||
              c.legacyStatus === 'SIGNED';
            if (bookingStatus === 'CANCELLED') {
              return isSigned;
            }
            return true;
          });
          setContracts(filtered);
          onContractsLoaded?.(filtered);
        }
      } catch (err: unknown) {
        console.error('Failed to list contracts for booking:', err);
        if (isMounted) {
          const apiErr = err as { status?: number; message?: string };
          // If 404 or empty list, handle gracefully
          if (apiErr.status === 404) {
            setContracts([]);
            onContractsLoaded?.([]);
          } else {
            setError(apiErr.message || 'Không thể tải danh sách hợp đồng.');
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchContracts();

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  if (!CONTRACTS_V2_ENABLED) {
    return null;
  }

  if (loading) {
    return (
      <div
        data-testid="booking-contracts-loading"
        style={{
          padding: '12px 16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#64748b',
          fontSize: '13px',
        }}
      >
        <RefreshCw size={14} className="animate-spin" />
        <span>Đang kiểm tra hợp đồng điện tử...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="booking-contracts-error"
        style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          border: '1px solid #fecaca',
          color: '#991b1b',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (contracts.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <div
        data-testid="booking-contracts-empty"
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px dashed #cbd5e1',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '13px',
        }}
      >
        Không có hợp đồng điện tử nào cho đơn hàng này.
      </div>
    );
  }

  const handleDownload = async (contractId: string, versionId?: string | null) => {
    if (downloadingContractId) return;
    setDownloadingContractId(contractId);
    try {
      const res = await contractService.triggerPdfDownload(contractId, versionId || undefined);
      toast.success(`Đã tải xuống thành công tài liệu: ${res.filename}`);
    } catch (err: unknown) {
      console.error('Download contract PDF error:', err);
      const apiErr = err as { status?: number; message?: string };
      if (apiErr.status === 422 || apiErr.message?.includes('CONTRACT_PDF_NOT_READY')) {
        toast.warning('Tài liệu PDF đang được hệ thống tạo và lưu trữ an toàn. Vui lòng thử lại sau giây lát.');
      } else if (apiErr.status === 403 || apiErr.status === 401) {
        toast.error('Bạn không có quyền truy cập hoặc tải hợp đồng này.');
      } else {
        toast.error(apiErr.message || 'Lỗi khi tải hợp đồng điện tử.');
      }
    } finally {
      setDownloadingContractId(null);
    }
  };

  return (
    <section
      data-testid="booking-contracts-section"
      style={{
        marginTop: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 750,
            color: '#76141c',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <FileText size={16} />
          {title} ({contracts.length})
        </h4>

        {viewerRole === 'provider' && (
          <span style={{ fontSize: '11.5px', color: '#0284c7', fontWeight: 600 }}>
            Phạm vi đối tác (Isolated)
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {contracts.map((c) => {
          const isAccepted =
            Boolean(c.isSigned) ||
            ['ACCEPTED', 'EFFECTIVE', 'TERMINATED', 'SUPERSEDED'].includes(c.state || '') ||
            c.legacyStatus === 'ACCEPTED' ||
            c.legacyStatus === 'SIGNED';
          const isDeclined = c.state === 'DECLINED' || c.legacyStatus === 'DECLINED';
          const isBookingCancelled = bookingStatus === 'CANCELLED';

          return (
            <div
              key={c.contractId}
              data-testid={`contract-summary-card-${c.contractId}`}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: isAccepted ? '#ecfdf5' : '#f1f5f9',
                    color: isAccepted ? '#059669' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={18} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 750, color: '#1e293b' }}>
                      {c.presentationMode === 'QUICK' ? 'Thỏa thuận thuê nhanh' : 'Hợp đồng điện tử'}
                    </span>
                    {c.presentationMode === 'QUICK' ? (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#ffedd5',
                          color: '#c2410c',
                          fontWeight: 700,
                        }}
                      >
                        QUICK
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          fontWeight: 600,
                        }}
                      >
                        A4 CHI TIẾT
                      </span>
                    )}
                  </div>

                  <ContractCodeDisplay
                    code={c.contractCode || c.contractId}
                    testId={`booking-contract-code-${c.contractId}`}
                  />

                  <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>Phiên bản <strong>{c.version || 1}</strong></span>
                    <span>·</span>
                    <span>Đối tác: <strong style={{ color: '#334155' }}>{c.providerName || c.providerId}</strong></span>
                    {c.scope && <span>(Phạm vi: {c.scope})</span>}
                  </div>
                </div>
              </div>

              {/* Status & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isAccepted ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: isBookingCancelled ? '#475569' : '#065f46',
                      backgroundColor: isBookingCancelled ? '#f1f5f9' : '#ecfdf5',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: isBookingCancelled ? '1px solid #cbd5e1' : '1px solid #a7f3d0',
                    }}
                  >
                    <CheckCircle2 size={13} /> {isBookingCancelled ? 'Đã ký (Đơn đã hủy)' : 'Đã ghi nhận chấp thuận'}
                  </span>
                ) : isDeclined ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#991b1b',
                      backgroundColor: '#fef2f2',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                    }}
                  >
                    <AlertTriangle size={13} /> Khách hàng đã từ chối
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#92400e',
                      backgroundColor: '#fffbeb',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #fde68a',
                    }}
                  >
                    <Clock size={13} /> Chờ khách hàng chấp thuận
                  </span>
                )}

                <button
                  type="button"
                  data-testid={`view-contract-btn-${c.contractId}`}
                  onClick={() => setSelectedContractId(c.contractId)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Eye size={13} />
                  <span>Xem</span>
                </button>

                <button
                  type="button"
                  data-testid={`download-contract-btn-${c.contractId}`}
                  onClick={() => handleDownload(c.contractId, c.versionId)}
                  disabled={downloadingContractId === c.contractId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#76141c',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: downloadingContractId === c.contractId ? 'not-allowed' : 'pointer',
                    opacity: downloadingContractId === c.contractId ? 0.7 : 1,
                  }}
                >
                  {downloadingContractId === c.contractId ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Download size={13} />
                  )}
                  <span>Tải PDF</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {viewerRole === 'provider' && (
        <div
          style={{
            fontSize: '11.5px',
            color: '#64748b',
            backgroundColor: '#f8fafc',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <ShieldCheck size={14} color="#0284c7" />
          <span>
            Đối tác chấp thuận trước cơ chế theo quy chế nền tảng VibeHue khi công bố sản phẩm.
          </span>
        </div>
      )}

      {selectedContractId && (
        <ContractDetailViewerModal
          contractId={selectedContractId}
          isOpen={Boolean(selectedContractId)}
          onClose={() => setSelectedContractId(null)}
          viewerRole={viewerRole}
        />
      )}
    </section>
  );
};
