import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Archive,
  Layers,
  Sparkles,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { CONTRACTS_V2_ENABLED } from '../../../../config/features';
import { contractService } from '../../../../services/contractService';
import type { CustomerContractItem } from '../../../../services/contractService';
import { ContractDetailViewerModal } from '../../../../components/contracts/ContractDetailViewerModal';
import { ContractCodeDisplay } from '../../../../components/contracts/ContractCodeDisplay';

interface ProfileContractsTabProps {
  onNavigateRental?: () => void;
}

export const ProfileContractsTab: React.FC<ProfileContractsTabProps> = ({ onNavigateRental }) => {
  const [contracts, setContracts] = useState<CustomerContractItem[]>([]);
  const [loading, setLoading] = useState<boolean>(CONTRACTS_V2_ENABLED);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'history'>('active');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchContracts = async () => {
    if (!CONTRACTS_V2_ENABLED) return;
    try {
      setLoading(true);
      setError(null);
      const data = await contractService.getMyContracts();
      setContracts(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error('Failed to fetch customer contracts:', err);
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Không thể tải danh sách hợp đồng điện tử. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContracts();
  }, []);

  const handleDownloadPdf = async (contractId: string) => {
    try {
      setDownloadingId(contractId);
      const res = await contractService.triggerPdfDownload(contractId);
      await Swal.fire({
        icon: 'success',
        title: 'Tải hợp đồng thành công',
        text: `Tệp ${res.filename} đã được tải về máy an toàn (Mã SHA-256 xác thực).`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (err: unknown) {
      console.error('Failed to download contract PDF:', err);
      const apiErr = err as { message?: string };
      await Swal.fire({
        icon: 'error',
        title: 'Tải PDF thất bại',
        text: apiErr.message || 'Không thể tải bản PDF của hợp đồng lúc này. Vui lòng thử lại sau.',
        confirmButtonColor: '#76141c',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  if (!CONTRACTS_V2_ENABLED) {
    return (
      <div
        data-testid="contracts-v2-disabled"
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#64748b',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <FileText size={32} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
        <h4 style={{ margin: '0 0 6px', color: '#334155' }}>Tính năng Hợp đồng Điện tử đang tạm tắt</h4>
        <p style={{ margin: 0, fontSize: '13px' }}>
          Hệ thống đang hoạt động ở chế độ truyền thống. Vui lòng quay lại sau.
        </p>
      </div>
    );
  }

  // Segregate contracts into Active vs History/Cancelled
  // Active: Orders in progress (PENDING_PAYMENT, CONFIRMED, PREPARING, READY, PICKED_UP)
  // History: Completed rentals (RETURNED, COMPLETED) OR Cancelled bookings with signed contracts (Case B)
  const activeContracts = contracts.filter((c) => {
    const isCancelled = c.bookingStatus === 'CANCELLED';
    const isCompleted = c.bookingStatus === 'RETURNED' || c.bookingStatus === 'COMPLETED';
    return !isCancelled && !isCompleted;
  });

  const historyContracts = contracts.filter((c) => {
    const isCancelled = c.bookingStatus === 'CANCELLED';
    const isCompleted = c.bookingStatus === 'RETURNED' || c.bookingStatus === 'COMPLETED';
    // For cancelled bookings, only include if customer previously signed (Case B)
    if (isCancelled) {
      return Boolean(c.isSigned);
    }
    return isCompleted;
  });

  const displayedContracts = activeSubTab === 'active' ? activeContracts : historyContracts;

  return (
    <div data-testid="profile-contracts-tab" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Tab Header & Description */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#76141c" />
            Hợp đồng Điện tử của tôi
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Tra cứu, kiểm tra tính toàn vẹn và tải bản PDF hợp đồng thuê áo dài điện tử theo từng đơn hàng.
          </p>
        </div>

        <button
          type="button"
          data-testid="refresh-contracts-btn"
          onClick={() => void fetchContracts()}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#475569',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Sub-tab Switcher: Hiện hành vs Lịch sử / Đã hủy */}
      <div
        data-testid="contracts-subtab-bar"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          data-testid="subtab-active"
          onClick={() => setActiveSubTab('active')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeSubTab === 'active' ? '2.5px solid #76141c' : '2.5px solid transparent',
            backgroundColor: 'transparent',
            color: activeSubTab === 'active' ? '#76141c' : '#64748b',
            fontWeight: activeSubTab === 'active' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={15} />
          Hợp đồng hiện hành
          <span
            data-testid="active-contracts-count"
            style={{
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '10px',
              backgroundColor: activeSubTab === 'active' ? '#fdf2f2' : '#f1f5f9',
              color: activeSubTab === 'active' ? '#76141c' : '#64748b',
              fontWeight: 700,
            }}
          >
            {activeContracts.length}
          </span>
        </button>

        <button
          type="button"
          data-testid="subtab-history"
          onClick={() => setActiveSubTab('history')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeSubTab === 'history' ? '2.5px solid #76141c' : '2.5px solid transparent',
            backgroundColor: 'transparent',
            color: activeSubTab === 'history' ? '#76141c' : '#64748b',
            fontWeight: activeSubTab === 'history' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Archive size={15} />
          Lịch sử / Đơn đã hủy
          <span
            data-testid="history-contracts-count"
            style={{
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '10px',
              backgroundColor: activeSubTab === 'history' ? '#fdf2f2' : '#f1f5f9',
              color: activeSubTab === 'history' ? '#76141c' : '#64748b',
              fontWeight: 700,
            }}
          >
            {historyContracts.length}
          </span>
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div data-testid="contracts-loading" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
          <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 10px', color: '#76141c' }} />
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Đang tải hợp đồng điện tử...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div
          data-testid="contracts-error-alert"
          style={{
            padding: '16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '13.5px' }}>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchContracts()}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #f87171',
              backgroundColor: '#ffffff',
              color: '#991b1b',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && displayedContracts.length === 0 && (
        <div
          data-testid="no-contracts-message"
          style={{
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1',
          }}
        >
          {activeSubTab === 'active' ? (
            <>
              <ShoppingBag size={40} style={{ margin: '0 auto 14px', color: '#94a3b8' }} />
              <h4 style={{ margin: '0 0 6px', color: '#1e293b', fontSize: '15.5px', fontWeight: 700 }}>
                Chưa có hợp đồng nào đang có hiệu lực
              </h4>
              <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                Khi bạn đặt thuê trang phục áo dài trên VibeHue, hợp đồng điện tử cho các đơn hàng đang tiến hành sẽ xuất hiện tại đây.
              </p>
              {onNavigateRental && (
                <button
                  type="button"
                  data-testid="explore-rental-btn"
                  onClick={onNavigateRental}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#76141c',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Khám phá áo dài cho thuê
                </button>
              )}
            </>
          ) : (
            <>
              <Archive size={40} style={{ margin: '0 auto 14px', color: '#94a3b8' }} />
              <h4 style={{ margin: '0 0 6px', color: '#1e293b', fontSize: '15.5px', fontWeight: 700 }}>
                Chưa có lịch sử hợp đồng nào
              </h4>
              <p style={{ margin: '0', fontSize: '13px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                Các hợp đồng thuê áo dài đã hoàn tất trả đồ hoặc các đơn hủy đã được ký kết sẽ được lưu trữ an toàn tại mục này để bạn đối soát bất cứ lúc nào.
              </p>
            </>
          )}
        </div>
      )}

      {/* Contract Items List */}
      {!loading && !error && displayedContracts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {displayedContracts.map((c) => {
            const isBookingCancelled = c.bookingStatus === 'CANCELLED';
            const isQuick = c.presentationMode === 'QUICK';
            const isAccepted =
              Boolean(c.isSigned) ||
              ['ACCEPTED', 'EFFECTIVE', 'TERMINATED', 'SUPERSEDED'].includes(c.state || '') ||
              c.legacyStatus === 'ACCEPTED' ||
              c.legacyStatus === 'SIGNED';

            return (
              <div
                key={c.contractId}
                data-testid={`contract-item-card-${c.contractId}`}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                }}
              >
                {/* Header: Booking Code & Status */}
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 750, color: '#1e293b' }}>
                      Đơn hàng #{c.bookingCode || c.bookingId.slice(-6).toUpperCase()}
                    </span>
                    {c.bookingCreatedAt && (
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Ngày tạo: {new Date(c.bookingCreatedAt).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isBookingCancelled ? (
                      <span
                        data-testid={`booking-status-badge-${c.contractId}`}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#fef2f2',
                          color: '#991b1b',
                          border: '1px solid #fecaca',
                        }}
                      >
                        ĐƠN ĐÃ HỦY
                      </span>
                    ) : c.bookingStatus === 'CONFIRMED' ? (
                      <span
                        data-testid={`booking-status-badge-${c.contractId}`}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                        }}
                      >
                        ĐÃ XÁC NHẬN
                      </span>
                    ) : c.bookingStatus === 'RETURNED' || c.bookingStatus === 'COMPLETED' ? (
                      <span
                        data-testid={`booking-status-badge-${c.contractId}`}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        ĐÃ HOÀN TẤT
                      </span>
                    ) : (
                      <span
                        data-testid={`booking-status-badge-${c.contractId}`}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#fffbeb',
                          color: '#92400e',
                          border: '1px solid #fde68a',
                        }}
                      >
                        {c.bookingStatus}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body: Contract details */}
                <div
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: '280px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: isAccepted ? (isBookingCancelled ? '#f1f5f9' : '#ecfdf5') : '#fffbeb',
                        color: isAccepted ? (isBookingCancelled ? '#64748b' : '#059669') : '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isQuick ? <Sparkles size={20} /> : <FileText size={20} />}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* 1. Tên loại hợp đồng + Tag (QUICK hoặc A4 CHI TIẾT) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          data-testid={`contract-title-${c.contractId}`}
                          style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}
                        >
                          {isQuick ? 'Thỏa thuận thuê nhanh' : 'Hợp đồng điện tử'}
                        </span>
                        {isQuick ? (
                          <span
                            style={{
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              backgroundColor: '#ffedd5',
                              color: '#c2410c',
                              fontWeight: 700,
                              letterSpacing: '0.03em',
                            }}
                          >
                            QUICK
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              fontWeight: 700,
                              letterSpacing: '0.03em',
                            }}
                          >
                            A4 CHI TIẾT
                          </span>
                        )}
                      </div>

                      {/* 2. Mã hợp đồng rút gọn + Nút Copy */}
                      <ContractCodeDisplay
                        code={c.contractCode || c.contractId}
                        testId={`contract-code-${c.contractId}`}
                      />

                      {/* 3. Phiên bản & Thông tin đối tác */}
                      <div style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        <span>
                          Phiên bản <strong>{c.version || 1}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Đối tác: <strong style={{ color: '#334155' }}>{c.providerName || c.providerId}</strong>
                        </span>
                        {c.startDate && (
                          <>
                            <span>·</span>
                            <span>
                              Thời gian thuê: {new Date(c.startDate).toLocaleDateString('vi-VN')}
                              {c.endDate && ` - ${new Date(c.endDate).toLocaleDateString('vi-VN')}`}
                            </span>
                          </>
                        )}
                      </div>

                      {/* 4. Trạng thái chấp thuận */}
                      <div style={{ marginTop: '2px' }}>
                        {isAccepted ? (
                          <span
                            data-testid={`contract-status-badge-${c.contractId}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: isBookingCancelled ? '#475569' : '#065f46',
                              backgroundColor: isBookingCancelled ? '#f1f5f9' : '#ecfdf5',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: isBookingCancelled ? '1px solid #cbd5e1' : '1px solid #a7f3d0',
                            }}
                          >
                            <CheckCircle2 size={13} />
                            {isBookingCancelled ? 'Đã ký trước khi đơn bị hủy' : 'Đã ghi nhận chấp thuận'}
                          </span>
                        ) : (
                          <span
                            data-testid={`contract-status-badge-${c.contractId}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: '#92400e',
                              backgroundColor: '#fffbeb',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #fde68a',
                            }}
                          >
                            <Clock size={13} /> Chờ khách hàng chấp thuận
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Xem chi tiết & Tải PDF */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      data-testid={`view-contract-btn-${c.contractId}`}
                      onClick={() => setSelectedContractId(c.contractId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '7px 13px',
                        borderRadius: '7px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        color: '#334155',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <Eye size={14} /> Xem chi tiết
                    </button>

                    {isAccepted && (
                      <button
                        type="button"
                        data-testid={`download-pdf-btn-${c.contractId}`}
                        onClick={() => void handleDownloadPdf(c.contractId)}
                        disabled={downloadingId === c.contractId}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '7px 13px',
                          borderRadius: '7px',
                          border: '1px solid #76141c',
                          backgroundColor: '#76141c',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: downloadingId === c.contractId ? 'not-allowed' : 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {downloadingId === c.contractId ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" /> Đang tải...
                          </>
                        ) : (
                          <>
                            <Download size={14} /> Tải PDF
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contract Detail Modal */}
      {selectedContractId && (
        <ContractDetailViewerModal
          contractId={selectedContractId}
          isOpen={Boolean(selectedContractId)}
          onClose={() => setSelectedContractId(null)}
          viewerRole="customer"
        />
      )}
    </div>
  );
};
