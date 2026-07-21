import React, { useState, useEffect } from 'react';
import { PrivateEvidenceImage } from './PrivateEvidenceImage';
import { httpClient } from '../../services/httpClient';
import { Modal } from './Modal';
import { ShieldAlert, User, Clock, FileText, CheckCircle, XCircle, Camera, Download, Scale } from 'lucide-react';
import { CustomerRefundPanel } from './CustomerRefundPanel';
import { RentalPickupReturnPanel } from '../../features/rentals/components/RentalPickupReturnPanel';
import { RentalFulfillmentOperationsPanel } from '../../features/rentals/components/RentalFulfillmentOperationsPanel';
import { API_BASE_URL } from '../../config/env';
import { downloadPhotosAsZip, downloadSinglePhoto } from '../../utils/downloadUtils';

interface BookingDetailModalProps {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCustomerClick?: (customerId: string) => void;
  viewerRole?: 'customer' | 'provider' | 'admin';
  onBookingChanged?: () => void;
  onWriteReview?: (itemDetails: { bookingId: string, itemId: string, productId?: string, photographyPackageId?: string }) => void;
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  bookingId,
  isOpen,
  onClose,
  onCustomerClick,
  viewerRole = 'admin',
  onBookingChanged,
  onWriteReview
}) => {
  const getEvidenceUrl = (url: string) =>
    url?.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [respondingIncident, setRespondingIncident] = useState(false);
  const [resolvingLocationChangeId, setResolvingLocationChangeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incident, setIncident] = useState<any>(null);

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchBookingDetails();
      fetchIncidentDetails();
    } else {
      setBooking(null);
      setIncident(null);
      setError(null);
    }
  }, [isOpen, bookingId]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    setError(null);
    console.log('BookingDetailModal fetchBookingDetails for ID:', bookingId);
    try {
      const res = await httpClient.get<any>(`/bookings/${bookingId}`);
      setBooking(res);
    } catch (err: any) {
      console.error('Lỗi khi lấy chi tiết đơn hàng:', err);
      setError(`Không thể tải chi tiết đơn hàng này (ID: ${bookingId}). Lỗi: ${err?.message || err}. Vui lòng thử lại sau.`);
    } finally {
      setLoading(false);
    }
  };

  const fetchIncidentDetails = async () => {
    try {
      const res = await httpClient.get<any>(`/api/disputes/incidents/booking/${bookingId}`);
      setIncident(res);
    } catch {
      setIncident(null);
    }
  };

  const handleAgreeIncident = async () => {
    if (!incident?._id) return;
    setRespondingIncident(true);
    try {
      await httpClient.post(`/api/disputes/incidents/${incident._id}/agree`);
      alert('Bạn đã đồng ý đền bù sự cố. Số tiền đền bù sẽ được khấu trừ từ tiền cọc.');
      fetchBookingDetails();
      fetchIncidentDetails();
      onBookingChanged?.();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Có lỗi xảy ra khi xử lý. Vui lòng thử lại.');
    } finally {
      setRespondingIncident(false);
    }
  };

  const handleDisagreeIncident = async () => {
    if (!incident?._id) return;
    setRespondingIncident(true);
    try {
      await httpClient.post(`/api/disputes/incidents/${incident._id}/disagree`);
      alert('Bạn đã gửi khiếu nại. Đơn hàng sẽ được chuyển sang trạng thái Tranh chấp để Admin xem xét.');
      fetchBookingDetails();
      fetchIncidentDetails();
      onBookingChanged?.();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Có lỗi xảy ra khi gửi khiếu nại. Vui lòng thử lại.');
    } finally {
      setRespondingIncident(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; bg: string; color: string }> = {
      PENDING_PAYMENT: { text: 'Chờ thanh toán', bg: '#FEF3C7', color: '#D97706' },
      CONFIRMED: { text: 'Đã xác nhận', bg: '#E0F2FE', color: '#0284C7' },
      PICKUP_PENDING: { text: 'Chờ nhận đồ', bg: '#EEF2F6', color: '#4B5563' },
      PICKED_UP: { text: 'Đang thuê', bg: '#F5F3FF', color: '#7C3AED' },
      RETURN_PENDING: { text: 'Chờ duyệt sự cố', bg: '#FFF1F2', color: '#E11D48' },
      RETURNED: { text: 'Đã trả đồ', bg: '#ECFDF5', color: '#059669' },
      COMPLETED: { text: 'Đã hoàn thành', bg: '#D1FAE5', color: '#065F46' },
      CANCELLED: { text: 'Đã hủy', bg: '#FEE2E2', color: '#B91C1C' },
      DISPUTED: { text: 'Tranh chấp', bg: '#FEE2E2', color: '#991B1B' }
    };

    const config = statusMap[status] || { text: status, bg: '#F3F4F6', color: '#374151' };
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        backgroundColor: config.bg,
        color: config.color,
        textTransform: 'uppercase'
      }}>
        {config.text}
      </span>
    );
  };

  const resolveLocationChange = async (scheduleId: string, approved: boolean) => {
    if (!bookingId) return;
    setResolvingLocationChangeId(scheduleId);
    try {
      await httpClient.patch(
        '/api/bookings/' + bookingId + '/photoshoot-schedules/' + scheduleId + '/location-change-requests/resolve',
        { approved },
      );
      await fetchBookingDetails();
      onBookingChanged?.();
    } catch (requestError: any) {
      alert(requestError?.message || 'Không thể xử lý yêu cầu đổi địa điểm.');
    } finally {
      setResolvingLocationChangeId(null);
    }
  };
  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('vi-VN') + 'đ';
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  // Tính toán thời hạn dịch vụ chung dựa trên các items
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (booking?.items && booking.items.length > 0) {
    const dates = booking.items.map((item: any) => ({
      from: item.rentalFrom || item.shootDate,
      to: item.rentalTo || item.shootDate
    })).filter((d: any) => d.from);
    if (dates.length > 0) {
      startDate = dates.reduce((min: string, d: any) => d.from < min ? d.from : min, dates[0].from);
      endDate = dates.reduce((max: string, d: any) => d.to < max ? d.to : max, dates[0].to);
    }
  }

  const renderRefundOrDisputeInfo = () => {
    if (!booking) return null;

    let infoText = '';
    let titleText = 'Thông tin hoàn cọc';
    let bgColor = '#F9FAFB';
    let borderColor = '#E5E7EB';
    let textColor = '#374151';
    let hasInfo = false;

    const adminTimeline = booking.statusTimeline?.find((t: any) =>
      t.note?.includes('Admin giải quyết tranh chấp')
    );

    if (booking.status === 'COMPLETED') {
      if (incident) {
        if (incident.status === 'ACCEPTED') {
          hasInfo = true;
          titleText = 'Quyết định đền bù (Thỏa thuận giữa hai bên)';
          bgColor = '#FFFBEB';
          borderColor = '#FDE68A';
          textColor = '#92400E';
          const remaining = (booking.pricingSummary?.depositTotal || 0) - (incident.requestedAmount || 0);
          infoText = `Khách hàng đã đồng ý đền bù sự cố hỏng đồ cho cửa hàng.\nSố tiền đền bù (khấu trừ từ cọc): ${formatCurrency(incident.requestedAmount)}.${remaining > 0 ? `\nSố tiền cọc hoàn trả lại cho khách hàng: ${formatCurrency(remaining)}.` : ''}`;
        } else if (incident.status === 'RESOLVED') {
          hasInfo = true;
          titleText = 'Phán quyết sự cố từ Ban quản trị (Admin)';
          bgColor = '#EFF6FF';
          borderColor = '#BFDBFE';
          textColor = '#1E40AF';
          let decisionText = 'Đã giải quyết.';
          if (adminTimeline) {
            if (adminTimeline.note?.includes('Provider đúng')) {
              decisionText = 'Nhà cung cấp đúng. Tiền đền bù được khấu trừ từ tiền cọc.';
            } else if (adminTimeline.note?.includes('Khách hàng đúng')) {
              decisionText = 'Khách hàng đúng. Toàn bộ tiền cọc được hoàn cho khách hàng.';
            } else if (adminTimeline.note?.includes('Chia tiền')) {
              decisionText = 'Admin quyết định phân chia tiền cọc cho hai bên theo phán quyết.';
            }
          }
          infoText = `${decisionText}\n\nLý do / Ghi chú của Admin: "${incident.adminNotes || 'Không có ghi chú thêm.'}"`;
        }
      } else {
        if ((booking.pricingSummary?.depositTotal || 0) > 0) {
          hasInfo = true;
          bgColor = '#ECFDF5';
          borderColor = '#A7F3D0';
          textColor = '#065F46';
          infoText = `Đơn hàng hoàn thành an toàn. Hệ thống đã tự động hoàn trả 100% tiền cọc giữ đồ (${formatCurrency(booking.pricingSummary.depositTotal)}) cho khách hàng.`;
        }
      }
    } else if (booking.status === 'CANCELLED') {
      if ((booking.paymentSummary?.totalPaid || 0) > 0) {
        hasInfo = true;
        titleText = 'Thông tin hủy đơn & cọc';
        const refundNote = booking.statusTimeline?.find((t: any) =>
          t.note?.includes('hoàn trả') || t.note?.includes('hoàn cọc') || t.note?.includes('100%')
        );
        const penaltyNote = booking.statusTimeline?.find((t: any) =>
          t.note?.includes('phạt') || t.note?.includes('mất cọc')
        );
        if (refundNote) {
          bgColor = '#EFF6FF';
          borderColor = '#BFDBFE';
          textColor = '#1E40AF';
          infoText = `Đơn hàng đã được hủy thành công. Khách hàng được hoàn trả tiền cọc giữ chỗ theo chính sách hủy lịch.`;
        } else if (penaltyNote) {
          bgColor = '#FEF2F2';
          borderColor = '#FCA5A5';
          textColor = '#991B1B';
          infoText = `Đơn hàng hủy sát giờ. Khách hàng bị phạt 100% tiền cọc (${formatCurrency(booking.pricingSummary?.depositTotal)}) chuyển trả cho đối tác.`;
        } else {
          bgColor = '#F9FAFB';
          borderColor = '#E5E7EB';
          textColor = '#374151';
          infoText = `Đơn đặt lịch đã bị hủy. Trạng thái cọc giữ đồ được cập nhật dựa trên thời gian hủy thực tế.`;
        }
      }
    } else if (booking.status === 'DISPUTED') {
      hasInfo = true;
      titleText = 'Tranh chấp đang xử lý';
      bgColor = '#FFF1F2';
      borderColor = '#FECDD3';
      textColor = '#9F1239';
      infoText = `Đơn hàng đang trong trạng thái tranh chấp sự cố hỏng đồ. Ban quản trị đang tiến hành xác minh bằng chứng để đưa ra phán quyết cuối cùng.`;
    } else if (booking.status === 'RETURN_PENDING') {
      hasInfo = true;
      titleText = 'Yêu cầu đền bù sự cố hỏng đồ';
      bgColor = '#FFFBEB';
      borderColor = '#FDE68A';
      textColor = '#92400E';
      infoText = incident
        ? `Cửa hàng yêu cầu đền bù sự cố hỏng đồ với số tiền: ${formatCurrency(incident.requestedAmount)}.\nMô tả sự cố: "${incident.description || ''}".\nĐang chờ khách hàng phản hồi (Đồng ý đền bù hoặc Khiếu nại).`
        : 'Đơn hàng đang chờ xác nhận sự cố hỏng đồ từ phía khách hàng.';
    }

    if (!hasInfo) return null;

    return (
      <div style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '16px',
        fontSize: '13px',
        color: textColor,
        whiteSpace: 'pre-line',
        fontFamily: 'Inter, sans-serif'
      }}>
        <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase' }}>
          {titleText}
        </h5>
        <p style={{ margin: 0, lineHeight: 1.6, fontSize: '12.5px' }}>
          {infoText}
        </p>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chi tiết hóa đơn đặt lịch"
      maxWidth="680px"
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #E5E7EB',
            borderTopColor: '#4A0E17',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#EF4444' }}>
          <ShieldAlert size={32} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px', fontWeight: 600 }}>{error}</p>
        </div>
      ) : booking ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#1F2937' }}>
          {/* Header Info */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#FAF6F0',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #E8E2D5'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#7A7A7A' }}>MÃ ĐƠN HÀNG:</span>
                <strong style={{ fontSize: '15px', color: '#4A0E17' }}>{booking.bookingCode}</strong>
              </div>
              <div style={{ fontSize: '11px', color: '#7A7A7A', marginTop: '4px' }}>
                Ngày đặt: {formatDate(booking.createdAt)}
              </div>
            </div>
            <div>{getStatusBadge(booking.status)}</div>
          </div>

          {/* Pickup Damage Report */}
          {booking.pickupDamageReport && (
            <div style={{
              backgroundColor: '#FEF9E7',
              border: '1px solid #F5CBA7',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#B9770E', fontWeight: 700, fontSize: '13px' }}>
                <ShieldAlert size={16} />
                <span>BÁO CÁO LỖI LÚC NHẬN ĐỒ CỦA KHÁCH HÀNG</span>
              </div>
              <p style={{ fontSize: '13px', margin: 0, color: '#4E340E' }}>
                <strong>Mô tả:</strong> {booking.pickupDamageReport.description || 'Không có mô tả'}
              </p>
              {booking.pickupDamageReport.evidencePhotos && booking.pickupDamageReport.evidencePhotos.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {booking.pickupDamageReport.evidencePhotos.map((photo: string, index: number) => (
                    <a key={index} href={getEvidenceUrl(photo)} target="_blank" rel="noreferrer" style={{ width: '60px', height: '60px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #F5D3A7' }}>
                      <img src={getEvidenceUrl(photo)} alt="Damage report evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </a>
                  ))}
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#9A6B24', fontStyle: 'italic', marginTop: '2px' }}>
                Ghi nhận lúc: {new Date(booking.pickupDamageReport.reportedAt).toLocaleString('vi-VN')}
              </div>
            </div>
          )}

          {/* Shop Handover Photos */}
          {booking.handoverPhotos && booking.handoverPhotos.length > 0 && (
            <div style={{
              backgroundColor: '#EDF9F2',
              border: '1px solid #C2F0D7',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#27AE60', fontWeight: 700, fontSize: '13px' }}>
                <CheckCircle size={16} />
                <span>ẢNH BÀN GIAO SẢN PHẨM CỦA CỬA HÀNG</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {booking.handoverPhotos.map((photo: string, index: number) => (
                  <a key={index} href={getEvidenceUrl(photo)} target="_blank" rel="noreferrer" style={{ width: '60px', height: '60px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #C2F0D7' }}>
                    <img src={getEvidenceUrl(photo)} alt="Shop handover evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Photography Delivered Photos */}
          {(() => {
            const isPhotography = booking.bookingType === 'PHOTOGRAPHY' || booking.items?.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE');
            const photos = (booking.deliveredPhotos && booking.deliveredPhotos.length > 0)
              ? booking.deliveredPhotos
              : (isPhotography && booking.handoverPhotos && booking.handoverPhotos.length > 0)
                ? booking.handoverPhotos
                : [];
            const driveUrl = booking.deliveryDriveUrl;

            if (photos.length === 0 && !driveUrl) return null;

            return (
              <div style={{
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '10px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1D4ED8', fontWeight: 700, fontSize: '13px' }}>
                    <Camera size={16} />
                    <span>📸 ẢNH KẾT QUẢ TỪ THỢ CHỤP</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {driveUrl && (
                      <a
                        href={driveUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          background: '#2563EB', color: 'white', border: 'none',
                          borderRadius: '6px', padding: '6px 12px', fontSize: '12px',
                          fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s',
                          boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                        }}
                      >
                        🔗 Mở Kho Ảnh Gốc (Google Drive)
                      </a>
                    )}
                    {photos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const fullPhotoUrls = photos.map((p: string) => getEvidenceUrl(p));
                          const zipName = `anh_chup_${booking.bookingCode || 'ket_qua'}.zip`;
                          void downloadPhotosAsZip(fullPhotoUrls, zipName);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          background: '#1D4ED8', color: 'white', border: 'none',
                          borderRadius: '6px', padding: '5px 10px', fontSize: '11px',
                          fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                        }}
                      >
                        <Download size={12} /> Tải tất cả ({photos.length})
                      </button>
                    )}
                  </div>
                </div>

                {photos.length > 0 && (
                  <>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {photos.map((photo: string, index: number) => (
                        <div key={index} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #BFDBFE', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
                          <a href={getEvidenceUrl(photo)} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                            <img src={getEvidenceUrl(photo)} alt={`Ảnh kết quả ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </a>
                          <button
                            type="button"
                            onClick={() => void downloadSinglePhoto(getEvidenceUrl(photo), `photo_${index + 1}.jpg`)}
                            style={{
                              position: 'absolute', bottom: '3px', right: '3px',
                              background: 'rgba(29, 78, 216, 0.85)', color: 'white',
                              border: 'none', borderRadius: '4px', padding: '3px', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', transition: 'all 0.2s',
                            }}
                            title="Tải xuống"
                          >
                            <Download size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: '11px', color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
                      Thợ chụp đã bàn giao {photos.length} ảnh. Bấm vào ảnh để xem hoặc nút ⬇ để tải về.
                    </p>
                  </>
                )}
              </div>
            );
          })()}

          {/* Cancellation Reason Display */}
          {booking.status === 'CANCELLED' && booking.cancellation?.reason && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 700, fontSize: '13px' }}>
                <XCircle size={16} />
                <span>LÝ DO HỦY ĐƠN</span>
              </div>
              <p style={{ fontSize: '13px', color: '#7F1D1D', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                {booking.cancellation.reason}
              </p>
              {booking.cancellation.cancelledAt && (
                <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
                  Thời gian hủy: {new Date(booking.cancellation.cancelledAt).toLocaleString('vi-VN')}
                </p>
              )}
            </div>
          )}

          {/* Admin Dispute Result Display */}
          {(() => {
            const resInput = booking.disputeResult || (() => {
              const log = [...(booking.statusTimeline || [])].reverse().find((t: any) => t.note?.includes('Admin giải quyết tranh chấp'));
              if (!log) return null;
              return {
                decisionLabel: log.note,
                resolvedAt: log.changedAt,
              };
            })();

            if (!resInput) return null;

            let decisionText = resInput.decisionLabel || 'Admin đã phán quyết';
            let adminNote = resInput.notes || '';
            let refundAmt: any = resInput.refundAmount;
            let compAmt: any = resInput.compensationAmount;

            if (typeof decisionText === 'string' && decisionText.includes('Admin giải quyết tranh chấp.')) {
              const raw = decisionText;
              const decMatch = raw.match(/Quyết định:\s*([^.]+)/);
              if (decMatch) decisionText = decMatch[1].trim();

              const noteMatch = raw.match(/Ghi chú:\s*(.*)$/);
              if (noteMatch && !adminNote) adminNote = noteMatch[1].trim();

              const refMatch = raw.match(/Hoàn khách:\s*([\d.,\s]+đ)/);
              if (refMatch && (refundAmt === undefined || refundAmt === null)) {
                refundAmt = refMatch[1];
              }
              const compMatch = raw.match(/bồi thường provider:\s*([\d.,\s]+đ)/);
              if (compMatch && (compAmt === undefined || compAmt === null)) {
                compAmt = compMatch[1];
              }
            }

            return (
              <div style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #FCD34D',
                borderRadius: '10px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', fontWeight: 750, fontSize: '14px' }}>
                  <Scale size={18} />
                  <span>⚖️ KẾT QUẢ GIẢI QUYẾT TRANH CHẤP TỪ ADMIN</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px', borderTop: '1px solid #FDE68A', paddingTop: '10px' }}>
                  <div>
                    <span style={{ color: '#6B7280' }}>Quyết định: </span>
                    <strong style={{ color: '#D97706', fontSize: '13.5px' }}>{decisionText}</strong>
                  </div>
                  {refundAmt !== undefined && refundAmt !== null && (
                    <div>
                      <span style={{ color: '#6B7280' }}>Hoàn tiền khách: </span>
                      <strong style={{ color: '#059669' }}>
                        {typeof refundAmt === 'number' ? `${refundAmt.toLocaleString('vi-VN')}đ` : refundAmt}
                      </strong>
                    </div>
                  )}
                  {compAmt !== undefined && compAmt !== null && (
                    <div>
                      <span style={{ color: '#6B7280' }}>Bồi thường shop/thợ: </span>
                      <strong style={{ color: '#D97706' }}>
                        {typeof compAmt === 'number' ? `${compAmt.toLocaleString('vi-VN')}đ` : compAmt}
                      </strong>
                    </div>
                  )}
                </div>

                {adminNote && (
                  <div style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #FDE68A',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginTop: '2px',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', marginBottom: '4px' }}>
                      💬 Ghi chú phán quyết từ Admin:
                    </div>
                    <div style={{ fontSize: '13px', color: '#1F2937', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontWeight: 500 }}>
                      "{adminNote}"
                    </div>
                  </div>
                )}

                {resInput.resolvedAt && (
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                    Thời gian phán quyết: {new Date(resInput.resolvedAt).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Customer / Service Provider info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', borderBottom: '1px solid #F3F4F6', paddingBottom: '6px' }}>
                <User size={14} color="#B89047" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4A0E17', textTransform: 'uppercase' }}>Khách hàng</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                {onCustomerClick ? (
                  <span 
                    onClick={() => {
                      const custId = booking.customerId?._id || booking.customerId;
                      if (custId) onCustomerClick(custId);
                    }}
                    style={{ color: '#2563EB', textDecoration: 'underline', cursor: 'pointer', fontWeight: 750 }}
                    title="Bấm để xem thông tin tín nhiệm khách hàng"
                  >
                    {booking.customerName || 'Khách hàng'}
                  </span>
                ) : (
                  booking.customerName || 'Khách vãng lai'
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>SĐT: {booking.customerPhone || '—'}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', borderBottom: '1px solid #F3F4F6', paddingBottom: '6px' }}>
                <Clock size={14} color="#B89047" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4A0E17', textTransform: 'uppercase' }}>Thời hạn dịch vụ</span>
              </div>
              <div style={{ fontSize: '12px', color: '#374151' }}>
                Bắt đầu: <strong>{formatDate(startDate)}</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
                Kết thúc: <strong>{formatDate(endDate)}</strong>
              </div>
            </div>
          </div>

          {/* List Items */}
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} />
              Chi tiết sản phẩm / Dịch vụ
            </h4>
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#4B5563', fontSize: '11px' }}>TÊN DỊCH VỤ / MẪU MÃ</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#4B5563', fontSize: '11px' }}>TÙY CHỌN</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#4B5563', fontSize: '11px' }}>ĐƠN GIÁ</th>
                    {viewerRole === 'customer' && booking.status === 'COMPLETED' && (
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#4B5563', fontSize: '11px' }}>ĐÁNH GIÁ</th>
                    )}
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#4B5563', fontSize: '11px' }}>THÀNH TIỀN</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.items && booking.items.length > 0 ? (
                    booking.items.map((item: any) => {
                      const isProduct = item.itemType === 'PRODUCT' || !!item.productId;
                      const name = isProduct 
                        ? (item.productId?.name || 'Sản phẩm áo dài')
                        : (item.photographyPackageId?.name || 'Gói chụp ảnh');
                      
                      return (
                        <tr key={item._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 600 }}>{name}</div>
                            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                              Loại: {isProduct ? 'Thuê áo dài' : 'Lịch chụp ảnh'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                              {isProduct 
                                ? `Thời gian thuê: ${formatDate(item.rentalFrom)} - ${formatDate(item.rentalTo)}`
                                : `Ngày chụp: ${formatDate(item.shootDate)}`
                              }
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px' }}>
                            {isProduct ? (
                              <span>Size {item.selectedSize || '—'} • Màu {item.selectedColor || '—'}</span>
                            ) : (
                              <span>Khung giờ: {item.shootTimeSlot || '—'}</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            {formatCurrency(item.unitPrice)}
                          </td>
                          {viewerRole === 'customer' && booking.status === 'COMPLETED' && (
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {item.isReviewed ? (
                                <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 650 }}>Đã đánh giá</span>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (onWriteReview) {
                                      onWriteReview({
                                        bookingId: booking._id,
                                        itemId: item._id,
                                        productId: item.productId?._id || item.productId,
                                        photographyPackageId: item.photographyPackageId?._id || item.photographyPackageId
                                      });
                                    }
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: 'var(--color-primary-dark)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'}
                                >
                                  Đánh giá
                                </button>
                              )}
                            </td>
                          )}
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(item.unitPrice * (item.quantity || 1))}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={viewerRole === 'customer' && booking.status === 'COMPLETED' ? 5 : 4} style={{ padding: '12px', textAlign: 'center', color: '#6B7280', fontStyle: 'italic' }}>
                        Không có chi tiết mặt hàng
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {booking.items?.some((item: any) => (item.itemType === 'PRODUCT' || item.productId) && item.pickupReturnLocationSnapshot?.address) && (
            <section>
              <h4 style={{ fontSize: '12px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase', marginBottom: '8px' }}>Nhận và trả áo dài</h4>
              {booking.items.filter((item: any) => (item.itemType === 'PRODUCT' || item.productId) && item.pickupReturnLocationSnapshot?.address).map((item: any) => (
                <RentalPickupReturnPanel key={item._id} location={item.pickupReturnLocationSnapshot} itemName={item.productId?.name || 'Sản phẩm áo dài'} />
              ))}
            </section>
          )}
          {booking.items?.some((item: any) => (item.itemType === 'PRODUCT' || item.productId) && item.rentalFulfillment) && (
            <section>
              <h4 style={{ fontSize: '12px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase', marginBottom: '8px' }}>Tiến trình giao – nhận áo dài</h4>
              <div style={{ display: 'grid', gap: '10px' }}>
                {booking.items.filter((item: any) => (item.itemType === 'PRODUCT' || item.productId) && item.rentalFulfillment).map((item: any) => (
                  <RentalFulfillmentOperationsPanel
                    key={item._id}
                    bookingId={booking._id}
                    item={item}
                    viewerRole={viewerRole}
                    onChanged={() => { void fetchBookingDetails(); onBookingChanged?.(); }}
                  />
                ))}
              </div>
            </section>
          )}
          {booking.rentalDepositRefund && booking.items?.some((item: any) => (item.itemType === 'PRODUCT' || item.productId) && item.rentalFulfillment) && (
            <section style={{ border: '1px solid #BFDBFE', background: '#EFF6FF', borderRadius: '12px', padding: '12px', color: '#1E3A8A' }}>
              <h4 style={{ margin: '0 0 5px', fontSize: '13px' }}>Hoàn cọc áo dài</h4>
              <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.45 }}>
                {booking.rentalDepositRefund.status === 'PENDING' && 'Đang chờ tất toán tất cả áo dài trong booking.'}
                {booking.rentalDepositRefund.status === 'NO_REFUND' && 'Cọc áo dài đã được khấu trừ toàn bộ theo quyết định Admin.'}
                {booking.rentalDepositRefund.status === 'REQUESTED' && `Yêu cầu hoàn ${formatCurrency(booking.rentalDepositRefund.amount)} đã được tạo, đang chờ xử lý thanh toán.`}
                {booking.rentalDepositRefund.status === 'REFUNDED' && `Đã hoàn ${formatCurrency(booking.rentalDepositRefund.amount)} tiền cọc áo dài.`}
                {booking.rentalDepositRefund.status === 'FAILED' && 'Yêu cầu hoàn cọc gặp lỗi; Admin sẽ xử lý lại.'}
              </p>
            </section>
          )}
          {viewerRole === 'provider' && booking.schedules?.some((schedule: any) => schedule.locationChangeRequest?.status === 'PENDING') && (
            <section style={{ border: '1px solid #FCD34D', background: '#FFFBEB', borderRadius: '12px', padding: '14px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#92400E' }}>Yêu cầu đổi địa điểm chụp</h4>
              {booking.schedules.filter((schedule: any) => schedule.locationChangeRequest?.status === 'PENDING').map((schedule: any) => {
                const request = schedule.locationChangeRequest;
                const isResolving = resolvingLocationChangeId === schedule._id;
                return <div key={schedule._id} style={{ padding: '10px 0', borderTop: '1px solid #FDE68A' }}>
                  <div style={{ fontSize: '12px', marginBottom: '6px' }}><strong>Địa điểm mới:</strong> {request.requestedLocation?.address}</div>
                  {request.note && <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>Ghi chú: {request.note}</div>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" disabled={isResolving} onClick={() => void resolveLocationChange(schedule._id, true)} style={{ border: 'none', borderRadius: '6px', padding: '7px 10px', background: '#166534', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Duyệt</button>
                    <button type="button" disabled={isResolving} onClick={() => void resolveLocationChange(schedule._id, false)} style={{ border: '1px solid #B91C1C', borderRadius: '6px', padding: '7px 10px', background: 'white', color: '#B91C1C', fontWeight: 700, cursor: 'pointer' }}>Từ chối</button>
                  </div>
                </div>;
              })}
            </section>
          )}
          {/* Refund / Dispute Decision Info */}
          {renderRefundOrDisputeInfo()}

          {viewerRole === 'customer' && bookingId && <CustomerRefundPanel bookingId={bookingId} />}

          {/* Pricing & Billing Summary */}
          <div style={{
            backgroundColor: '#FAF9F6',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '13px'
          }}>
            {(() => {
              const bType = booking.bookingType || 'PHOTOGRAPHY';
              const grandTotal = booking.pricingSummary?.grandTotal || booking.paymentSummary?.totalPaid || 0;
              const subTotal = booking.paymentSummary?.subTotal || booking.pricingSummary?.subTotal || grandTotal;
              const depositTotal = booking.paymentSummary?.depositTotal || booking.pricingSummary?.depositTotal || 0;
              const photoBasePrice = grandTotal || subTotal;
              const photoDeposit = Math.round(photoBasePrice * 0.3);

              if (bType === 'PHOTOGRAPHY') {
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#4B5563' }}>Tiền gói dịch vụ chụp ảnh:</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(photoBasePrice)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#D97706', paddingLeft: '8px' }}>
                      <span>• Trong đó: Cọc giữ lịch chụp (30%):</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(photoDeposit)}</span>
                    </div>
                  </>
                );
              }

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4B5563' }}>{bType === 'AODAI_RENTAL' ? 'Tiền thuê áo dài:' : 'Tiền dịch vụ:'}</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(subTotal)}</span>
                  </div>
                  {depositTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#4B5563' }}>Tiền cọc giữ đồ trang phục (Sẽ hoàn lại khi trả đồ):</span>
                      <span style={{ fontWeight: 600, color: '#D97706' }}>{formatCurrency(depositTotal)}</span>
                    </div>
                  )}
                </>
              );
            })()}
            {booking.pricingSummary?.serviceFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#4B5563' }}>Phí dịch vụ Heritage:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(booking.pricingSummary.serviceFee)}</span>
              </div>
            )}
            <div style={{ borderTop: '1px dashed #D1D5DB', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800 }}>
              <span style={{ color: '#4A0E17' }}>TỔNG CỘNG HÓA ĐƠN:</span>
              <span style={{ color: '#4A0E17' }}>{formatCurrency(booking.pricingSummary?.grandTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '4px' }}>
              <span style={{ color: '#047857', fontWeight: 700 }}>Số tiền đã thanh toán:</span>
              <span style={{ color: '#047857', fontWeight: 800 }}>{formatCurrency(booking.paymentSummary?.totalPaid)}</span>
            </div>
          </div>

          {/* Customer Incident Response Buttons */}
          {viewerRole === 'customer' && booking.status === 'RETURN_PENDING' && incident && incident.status === 'PENDING_CUSTOMER' && (
            <div style={{
              backgroundColor: '#FFF7ED',
              border: '1px solid #FDE68A',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontFamily: 'Inter, sans-serif'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>
                ⚠️ Cửa hàng yêu cầu đền bù sự cố hỏng đồ — Vui lòng chọn phương án xử lý:
              </div>
              {incident.description && (
                <div style={{ fontSize: '12px', color: '#78350F', backgroundColor: '#FFFBEB', padding: '10px 12px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                  <strong>Mô tả sự cố:</strong> {incident.description}
                </div>
              )}
              {incident.evidencePhotos?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '8px' }}>
                  {incident.evidencePhotos.map((photo: string, index: number) => (
                    <PrivateEvidenceImage
                      key={photo}
                      reference={photo}
                      legacyUrl={getEvidenceUrl(photo)}
                      alt={`Bằng chứng sự cố ${index + 1}`}
                      linkStyle={{ display: 'block', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid #FDE68A' }}
                      imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ))}
                </div>
              )}
              <div style={{ fontSize: '13px', color: '#92400E', fontWeight: 600 }}>
                Số tiền yêu cầu đền bù: <span style={{ color: '#DC2626', fontWeight: 800 }}>{formatCurrency(incident.requestedAmount)}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleAgreeIncident}
                  disabled={respondingIncident}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: respondingIncident ? '#D1D5DB' : '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: respondingIncident ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseOver={(e) => !respondingIncident && (e.currentTarget.style.backgroundColor = '#047857')}
                  onMouseOut={(e) => !respondingIncident && (e.currentTarget.style.backgroundColor = '#059669')}
                >
                  <CheckCircle size={16} />
                  {respondingIncident ? 'Đang xử lý...' : 'Đồng ý đền bù'}
                </button>
                <button
                  onClick={handleDisagreeIncident}
                  disabled={respondingIncident}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: respondingIncident ? '#D1D5DB' : '#DC2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: respondingIncident ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseOver={(e) => !respondingIncident && (e.currentTarget.style.backgroundColor = '#B91C1C')}
                  onMouseOut={(e) => !respondingIncident && (e.currentTarget.style.backgroundColor = '#DC2626')}
                >
                  <XCircle size={16} />
                  {respondingIncident ? 'Đang xử lý...' : 'Khiếu nại (Không đồng ý)'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px', color: '#6B7280' }}>
          Không tìm thấy đơn hàng tương ứng.
        </div>
      )}
    </Modal>
  );
};
export default BookingDetailModal;
