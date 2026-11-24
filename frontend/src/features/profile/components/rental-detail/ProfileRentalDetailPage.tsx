import React from 'react';
import { AlertTriangle, CheckSquare } from 'lucide-react';
import { RentalDetailHeader } from './RentalDetailHeader';
import { RentalMainCard } from './RentalMainCard';
import { RentalInfoColumns } from './RentalInfoColumns';
import { RentalTimelineAndPhotos } from './RentalTimelineAndPhotos';
import { RentalBottomActionBar } from './RentalBottomActionBar';
import { RentalPickupDamageReportCard } from './RentalPickupDamageReportCard';
import { RentalPickupReportModal, type PickupModalMode } from './RentalPickupReportModal';
import { RentalReturnModal } from './RentalReturnModal';
import { PrivateEvidenceImage } from '../../../../components/common/PrivateEvidenceImage';
import Swal from 'sweetalert2';
import { httpClient } from '../../../../services/httpClient';
import { useSocket } from '../../../../context/SocketContext';
import { getBookingStatusLabel } from '../../../../utils/bookingStatus';

interface ProfileRentalDetailPageProps {
  booking?: any;
  onBack: () => void;
  onOpenReschedule?: (item: any) => void;
  onOpenCancel?: (booking: any) => void;
  onRefreshBooking?: () => void;
  onContinuePayment?: (bookingId: string) => void;
}

export const ProfileRentalDetailPage: React.FC<ProfileRentalDetailPageProps> = ({
  booking,
  onBack,
  onOpenReschedule,
  onOpenCancel,
  onRefreshBooking,
  onContinuePayment
}) => {
  const [incident, setIncident] = React.useState<any>(booking?.incident || null);
  const [respondingIncident, setRespondingIncident] = React.useState<boolean>(false);
  const [pickupModalMode, setPickupModalMode] = React.useState<PickupModalMode | null>(null);
  const [isSubmittingPickup, setIsSubmittingPickup] = React.useState<boolean>(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = React.useState<boolean>(false);

  const { socket } = useSocket();

  const fetchIncidentDetails = React.useCallback(async () => {
    if (!booking?._id) return;
    try {
      const res = await httpClient.get<any>(`/api/disputes/incidents/booking/${booking._id}`);
      setIncident(res || null);
    } catch {
      setIncident(null);
    }
  }, [booking?._id]);

  React.useEffect(() => {
    if (booking?.incident) {
      setIncident(booking.incident);
    } else {
      fetchIncidentDetails();
    }
  }, [booking?.incident, booking?.status, booking?.updatedAt, fetchIncidentDetails]);

  // Targeted socket refresh: Only refetch if booking_updated event matches this open booking
  React.useEffect(() => {
    if (!socket || !booking?._id) return;
    const handler = (payload: { bookingId: string }) => {
      if (payload?.bookingId === booking._id) {
        fetchIncidentDetails();
        onRefreshBooking?.();
      }
    };
    socket.on('booking_updated', handler);
    return () => {
      socket.off('booking_updated', handler);
    };
  }, [socket, booking?._id, fetchIncidentDetails, onRefreshBooking]);

  const items = booking?.items || [];
  const item = items[0] || {};
  const isPhoto = item.itemType === 'PHOTOGRAPHY_PACKAGE';
  const pkgObj = item.photographyPackageId && typeof item.photographyPackageId === 'object' ? item.photographyPackageId : null;
  const prodObj = !isPhoto && item.productId && typeof item.productId === 'object' ? item.productId : null;

  const resolvedProvider =
    (booking?.providerIds && booking.providerIds[0] && typeof booking.providerIds[0] === 'object' ? booking.providerIds[0] : null) ||
    (item.providerId && typeof item.providerId === 'object' ? item.providerId : null) ||
    (prodObj?.providerId && typeof prodObj.providerId === 'object' ? prodObj.providerId : null) ||
    (pkgObj?.providerId && typeof pkgObj.providerId === 'object' ? pkgObj.providerId : null) ||
    null;

  const [cachedProvider, setCachedProvider] = React.useState<any>(resolvedProvider);

  React.useEffect(() => {
    if (resolvedProvider && (resolvedProvider.businessName || resolvedProvider.fullName)) {
      setCachedProvider(resolvedProvider);
    } else {
      const p0 = booking?.providerIds?.[0];
      const provId =
        (typeof p0 === 'string' ? p0 : (p0?._id ? String(p0._id) : null)) ||
        (typeof item?.providerId === 'string' ? item.providerId : (item?.providerId?._id ? String(item.providerId._id) : null)) ||
        (typeof prodObj?.providerId === 'string' ? prodObj.providerId : (prodObj?.providerId?._id ? String(prodObj.providerId._id) : null));
      if (provId) {
        httpClient.get<any>(`/api/providers/${provId}`)
          .then((p) => {
            if (p) setCachedProvider(p);
          })
          .catch(() => {});
      }
    }
  }, [resolvedProvider, booking?.providerIds, item?.providerId, prodObj?.providerId]);

  const provider = (resolvedProvider && (resolvedProvider.businessName || resolvedProvider.fullName)) ? resolvedProvider : (cachedProvider || {});

  const dressItems = items.map((it: any) => {
    const itProd = it.productId && typeof it.productId === 'object' ? it.productId : null;
    const itPkg = it.photographyPackageId && typeof it.photographyPackageId === 'object' ? it.photographyPackageId : null;
    const itName = itProd?.name || itPkg?.name || it.packageSnapshot?.name || it.name || it.productName || 'Áo Dài Di Sản';
    const itImage =
      itProd?.images?.[0] ||
      itProd?.coverImage ||
      itPkg?.coverImage ||
      it.images?.[0] ||
      it.coverImage ||
      it.image ||
      it.productImage;
    const itSize = it.selectedSize || it.size || 'M';
    const itColor = it.selectedColor || it.color || itProd?.color || 'Đa sắc';
    const itMaterial =
      (Array.isArray(itProd?.materials) ? itProd.materials.join(', ') : itProd?.material) ||
      it.material ||
      'Lụa cao cấp';
    const itBrand = itProd?.brand || provider?.businessName || provider?.fullName || 'TàGo Premium';
    const itAccessories =
      (Array.isArray(it.accessories) ? it.accessories.join(', ') : it.accessories) ||
      (Array.isArray(itProd?.accessories) ? itProd.accessories.join(', ') : itProd?.accessories) ||
      'Mấn đội đầu';
    const itPrice = it.unitPrice || it.price || itProd?.rentalPrice;
    const itQty = it.quantity || 1;

    return {
      id: it._id,
      title: itName,
      image: itImage,
      size: itSize,
      color: itColor,
      material: itMaterial,
      brand: itBrand,
      accessories: itAccessories,
      price: itPrice,
      quantity: itQty
    };
  });

  const itemName =
    prodObj?.name ||
    pkgObj?.name ||
    item.packageSnapshot?.name ||
    item.name ||
    (isPhoto ? 'Gói Chụp Ảnh Nghệ Thuật' : 'Áo Dài Truyền Thống');

  const itemImage =
    prodObj?.images?.[0] ||
    prodObj?.coverImage ||
    pkgObj?.coverImage ||
    item.images?.[0] ||
    item.coverImage ||
    item.image ||
    item.productImage;

  const itemCode = booking?.bookingCode || (booking?._id ? 'RT-' + String(booking._id).slice(-4) : 'RT-TAGO');
  const itemSize = isPhoto ? '' : (item.selectedSize || item.size || '');
  const itemColor =
    item.selectedColor ||
    item.color ||
    (Array.isArray(prodObj?.colors) ? prodObj.colors.join(', ') : prodObj?.color) ||
    'Đa sắc';
  const itemBrand = prodObj?.brand || provider?.businessName || provider?.fullName || 'TàGo Premium';
  const itemMaterial =
    (Array.isArray(prodObj?.materials) ? prodObj.materials.join(', ') : prodObj?.material) ||
    'Lụa cao cấp';
  const itemAccessories =
    (Array.isArray(item.accessories) ? item.accessories.join(', ') : item.accessories) ||
    (Array.isArray(prodObj?.accessories) ? prodObj.accessories.join(', ') : prodObj?.accessories) ||
    'Mấn đội đầu';

  // Dates & Times
  const rawPickup = item.rentalFrom || booking?.rentalFrom || item.startDate || item.shootDate || booking?.startDate;
  const rawReturn = item.rentalTo || item.endDate || booking?.endDate;

  const pickupDateStr = rawPickup
    ? new Date(rawPickup).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' })
    : 'Chưa cập nhật';
  const pickupTimeStr = item.shootTimeSlot || item.pickupTime || '09:00';
  const readyTimeStr = rawPickup
    ? new Date(rawPickup).toLocaleDateString('vi-VN') + ' 08:00'
    : 'Trước giờ nhận 1h';
  const dueTimeStr = rawReturn
    ? new Date(rawReturn).toLocaleDateString('vi-VN') + ' • Trước 18:00'
    : isPhoto
    ? 'Hoàn tất sau buổi chụp'
    : 'Theo thỏa thuận';

  // Remaining time calculation
  const calculateRemaining = () => {
    if (!rawReturn) return 'Chưa có hạn trả';
    const dueMs = new Date(rawReturn).getTime();
    const now = Date.now();
    const diff = dueMs - now;
    if (diff < 0) {
      const hours = Math.abs(Math.floor(diff / (1000 * 60 * 60)));
      const days = Math.floor(hours / 24);
      return days > 0 ? `Quá hạn ${days} ngày` : `Quá hạn ${hours} giờ`;
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return days > 0 ? `${days} ngày ${remHours > 0 ? `${remHours} giờ` : ''}` : `${Math.max(1, hours)} giờ`;
  };

  const remainingTimeStr = calculateRemaining();

  // Status & Stepper
  const isPendingCustomerIncident =
    (booking?.status === 'RETURN_PENDING' || booking?.status === 'PENDING_CUSTOMER') &&
    incident?.status === 'PENDING_CUSTOMER';
  const isDisputed = booking?.status === 'DISPUTED' || incident?.status === 'DISPUTED';

  const currentStatus = isDisputed
    ? 'DISPUTED'
    : booking?.status || item?.rentalFulfillment?.status || 'CONFIRMED';
  const currentStatusLabel = getBookingStatusLabel(currentStatus, {
    hasPendingIncident: isPendingCustomerIncident,
    uppercase: true,
  });

  // Financial values
  const rentalPrice = (item.unitPrice || 0) * (item.quantity || 1) || booking?.pricingSummary?.subTotal || 0;
  const cleaningFee = booking?.pricingSummary?.serviceFee || 0;
  const depositFee = item.depositAmount || booking?.pricingSummary?.depositTotal || 0;
  const totalPrice = booking?.pricingSummary?.grandTotal || booking?.totalAmount || 0;
  const isPaid = booking?.status !== 'PENDING_PAYMENT' && booking?.status !== 'WAITING_PAYMENT';
  const paymentTimeStr = booking?.paymentSummary?.paidAt
    ? new Date(booking.paymentSummary.paidAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : booking?.createdAt
    ? new Date(booking.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Gần đây';

  // Helper to safely format address object or string
  const formatStoreAddress = (addr: any): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr.trim();
    if (typeof addr === 'object') {
      const parts = [
        addr.addressLine || addr.street || addr.address,
        addr.ward,
        addr.district,
        addr.city || addr.province
      ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
      if (parts.length > 0) return parts.join(', ');
      if (addr.formattedAddress && typeof addr.formattedAddress === 'string') return addr.formattedAddress;
    }
    return '';
  };

  // Store information
  const storeName = provider?.businessName || provider?.fullName || 'Cửa hàng đối tác';
  const rawAddress =
    item.pickupReturnLocationSnapshot?.address ||
    item.pickupReturnLocationSnapshot ||
    provider?.rentalSettings?.pickupLocation ||
    provider?.pickupLocation ||
    provider?.address ||
    provider?.businessAddress ||
    booking?.deliveryAddress?.address ||
    booking?.deliveryAddress;

  const storeAddress = formatStoreAddress(rawAddress) || 'Đang cập nhật địa chỉ cửa hàng';

  // Support hotline handler
  const handleSupport = () => {
    Swal.fire({
      title: 'Trung tâm Hỗ trợ Khách hàng TàGo',
      html: `
        <div style="text-align: left; font-size: 14px; color: #4A3F35; line-height: 1.6;">
          <p>Đội ngũ TàGo luôn sẵn sàng hỗ trợ bạn:</p>
          <div style="background: #FDF2F4; padding: 12px 16px; border-radius: 10px; border: 1px solid #F7D5DA; margin: 12px 0;">
            <p style="margin: 0; font-weight: 700; color: #8E1B2E; font-size: 16px;">📞 Hotline: 1900 9999</p>
            <p style="margin: 4px 0 0 0; color: #7D736B; font-size: 12px;">Hỗ trợ 24/7 toàn quốc</p>
          </div>
          <p style="margin: 0;">✉️ Email: <strong>support@tago.vn</strong></p>
          <p style="margin: 4px 0 0 0;">🏢 Cửa hàng: <strong>${storeAddress}</strong></p>
        </div>
      `,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#8E1B2E'
    });
  };

  // Open Map handler
  const handleOpenMap = () => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(storeAddress)}`, '_blank');
  };

  // View Rules modal
  const handleViewRules = () => {
    Swal.fire({
      title: 'Quy định & Chính sách Thuê trang phục',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6;">
          <ol style="padding-left: 18px; margin: 0; display: flex; flex-direction: column; gap: 8px;">
            <li><strong>Bảo quản trang phục:</strong> Giữ áo cẩn thận, không để dính vết bẩn cứng đầu, mực, hóa chất hoặc rách vải.</li>
            <li><strong>Giặt ủi:</strong> Không tự ý giặt ủi hoặc tẩy trang phục. Cửa hàng và TàGo sẽ đảm nhận quy trình giặt sấy chuyên dụng sau khi nhận lại.</li>
            <li><strong>Thời hạn trả:</strong> Vui lòng hoàn trả trước giờ hẹn quy định. Trường hợp quá hạn sẽ tính phí phát sinh theo thỏa thuận.</li>
            <li><strong>Hoàn cọc:</strong> Tiền cọc (${depositFee.toLocaleString('vi-VN')}đ) sẽ được hoàn trả đầy đủ ngay sau khi nhân viên kiểm tra tình trạng áo dài.</li>
          </ol>
        </div>
      `,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#8E1B2E'
    });
  };

  // View Invoice modal
  const handleViewInvoice = () => {
    Swal.fire({
      title: `Hóa đơn điện tử #${itemCode}`,
      html: `
        <div style="text-align: left; font-size: 13px; color: #4A3F35;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #ECE5DB; padding-bottom: 8px; margin-bottom: 8px;">
            <span>Dịch vụ / Sản phẩm:</span>
            <strong>${itemName} ${itemSize ? `(Size ${itemSize})` : ''}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Tiền dịch vụ:</span>
            <span>${rentalPrice.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Phí dịch vụ:</span>
            <span>${cleaningFee.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Tiền đặt cọc:</span>
            <span>${depositFee.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="border-top: 1px solid #ECE5DB; padding-top: 8px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #8E1B2E;">
            <span>Tổng thanh toán:</span>
            <span>${totalPrice.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="margin-top: 12px; background: ${isPaid ? '#ECFDF5' : '#FEF3C7'}; padding: 6px 12px; border-radius: 6px; color: ${isPaid ? '#047857' : '#B45309'}; font-weight: 700; font-size: 12px; text-align: center;">
            ${isPaid ? '✓ ĐÃ THANH TOÁN QUA VÍ/PAYOS' : '⏳ CHỜ THANH TOÁN'}
          </div>
        </div>
      `,
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#8E1B2E'
    });
  };

  // Return Ao Dai handler: Mở modal trả áo kèm bắt buộc tải ảnh tình trạng áo khi trả
  const handleReturn = () => {
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async (data: { evidencePhotos: string[]; note?: string }) => {
    if (!booking?._id) return;
    await httpClient.post(`/bookings/${booking._id}/customer-return`, data);
    await Swal.fire({
      icon: 'success',
      title: 'Đã gửi thông báo trả áo!',
      text: `Cửa hàng ${storeName} đã nhận được thông báo kèm ảnh bằng chứng trả áo. Nhân viên sẽ kiểm tra và đối soát hoàn cọc ${depositFee.toLocaleString('vi-VN')}đ cho bạn.`,
      confirmButtonColor: '#8E1B2E',
    });
    onRefreshBooking?.();
  };

  // Handle customer agrees to incident compensation
  const handleAgreeIncident = async () => {
    if (!incident?._id) return;
    const requestedAmount = incident.requestedAmount || 0;
    const remainingRefund = Math.max(0, depositFee - requestedAmount);

    const result = await Swal.fire({
      title: 'Đồng ý bồi thường sự cố?',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6;">
          <p style="margin-bottom: 12px;">
            Bạn xác nhận đồng ý bồi thường chi phí sự cố hư hỏng theo yêu cầu của Shop. Số tiền sẽ được khấu trừ trực tiếp từ tiền cọc của bạn.
          </p>
          <div style="background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
              <span style="color: #78350F;">Tiền cọc giữ đồ ban đầu:</span>
              <strong style="color: #78350F;">${depositFee.toLocaleString('vi-VN')}đ</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #DC2626; font-size: 13px;">
              <span>Khấu trừ bồi thường cho Shop:</span>
              <strong style="color: #DC2626;">-${requestedAmount.toLocaleString('vi-VN')}đ</strong>
            </div>
            <div style="border-top: 1px dashed #D1D5DB; margin: 8px 0;"></div>
            <div style="display: flex; justify-content: space-between; color: #059669; font-size: 14px; font-weight: 800;">
              <span>Tiền cọc còn lại hoàn trả bạn:</span>
              <span style="color: #059669;">${remainingRefund.toLocaleString('vi-VN')}đ</span>
            </div>
          </div>
          <p style="margin: 0; font-size: 12px; color: #4B5563;">
            ${remainingRefund > 0
              ? '✓ Số tiền cọc còn lại sẽ được hệ thống hoàn tự động về tài khoản thanh toán của bạn.'
              : '✓ Toàn bộ tiền cọc được dùng để bồi thường thiệt hại cho cửa hàng.'}
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận đồng ý',
      cancelButtonText: 'Xem lại',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6B7280'
    });

    if (!result.isConfirmed) return;

    try {
      setRespondingIncident(true);
      await httpClient.post(`/api/disputes/incidents/${incident._id}/agree`);
      await Swal.fire({
        icon: 'success',
        title: 'Xử lý thành công!',
        text: 'Đã hoàn tất thủ tục bồi thường sự cố. Đơn thuê đã hoàn thành.',
        confirmButtonColor: '#8E1B2E'
      });
      onRefreshBooking?.();
      fetchIncidentDetails();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Có lỗi xảy ra',
        text: err?.response?.data?.message || err?.message || 'Không thể xác nhận đền bù.',
        confirmButtonColor: '#8E1B2E'
      });
    } finally {
      setRespondingIncident(false);
    }
  };

  // Handle customer disagrees / escalates incident to Admin
  const handleDisagreeIncident = async () => {
    if (!incident?._id) return;

    const { value: reasonText, isConfirmed } = await Swal.fire({
      title: 'Khiếu nại lên Ban Quản Trị?',
      input: 'textarea',
      inputLabel: 'Lý do khiếu nại (tùy chọn):',
      inputPlaceholder: 'Nêu rõ lý do bạn không đồng ý với yêu cầu đền bù của Shop...',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6; margin-bottom: 12px;">
          <p style="margin-bottom: 10px;">
            Bạn không đồng ý với yêu cầu đền bù của Shop? Đơn hàng sẽ được chuyển lên Ban Quản Trị (Admin) để thẩm định và giải quyết.
          </p>
          <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 12px 14px; color: #991B1B;">
            <p style="margin: 0 0 6px 0; font-weight: 700; font-size: 13px;">⚠️ Quy trình xử lý tranh chấp:</p>
            <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.6;">
              <li>Tiền cọc và doanh thu thuê được <strong>đóng băng an toàn</strong> trong tài khoản ký quỹ.</li>
              <li>Admin sẽ đối soát ảnh bàn giao lúc nhận, ảnh trả đồ và liên hệ hai bên để đưa ra phán quyết công bằng.</li>
            </ul>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Gửi khiếu nại lên Admin',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
    });

    if (!isConfirmed) return;

    try {
      setRespondingIncident(true);
      await httpClient.post(`/api/disputes/incidents/${incident._id}/disagree`, {
        reason: reasonText?.trim() || undefined,
      });
      await Swal.fire({
        icon: 'success',
        title: 'Đã gửi khiếu nại!',
        text: 'Đơn hàng đã được chuyển sang trạng thái tranh chấp. Ban Quản Trị sẽ kiểm tra và thông báo kết quả sớm nhất cho bạn.',
        confirmButtonColor: '#8E1B2E',
      });
      onRefreshBooking?.();
      fetchIncidentDetails();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Có lỗi xảy ra',
        text: err?.response?.data?.message || err?.message || 'Không thể gửi khiếu nại.',
        confirmButtonColor: '#8E1B2E',
      });
    } finally {
      setRespondingIncident(false);
    }
  };

  // Handle pickup modal submit for CONFIRM, DAMAGE, and REJECT flows
  const handlePickupModalSubmit = async (data: { description?: string; reason?: string; evidencePhotos: string[] }) => {
    if (!booking?._id || !pickupModalMode) return;
    setIsSubmittingPickup(true);
    try {
      if (pickupModalMode === 'CONFIRM') {
        await httpClient.post(`/bookings/${booking._id}/customer-confirm-pickup`, {
          evidencePhotos: data.evidencePhotos.length > 0 ? data.evidencePhotos : undefined
        });
        await Swal.fire({
          icon: 'success',
          title: 'Nhận áo thành công!',
          text: 'Đơn thuê của bạn đã chuyển sang trạng thái Đang thuê. Chúc bạn có trải nghiệm tuyệt vời!',
          confirmButtonColor: '#8E1B2E'
        });
      } else if (pickupModalMode === 'DAMAGE') {
        await httpClient.post(`/bookings/${booking._id}/customer-report-damage`, {
          description: data.description,
          evidencePhotos: data.evidencePhotos
        });
        await Swal.fire({
          icon: 'success',
          title: 'Báo cáo thành công!',
          text: 'Báo cáo được ghi nhận là tình trạng có sẵn trước khi thuê và dùng để bảo vệ tiền cọc của bạn. Đơn thuê đã bắt đầu.',
          confirmButtonColor: '#8E1B2E'
        });
      } else if (pickupModalMode === 'REJECT') {
        await httpClient.post(`/bookings/${booking._id}/customer-reject-handover`, {
          reason: data.reason,
          evidencePhotos: data.evidencePhotos
        });
        await Swal.fire({
          icon: 'warning',
          title: 'Đã từ chối nhận áo!',
          text: 'Đơn sẽ được chuyển sang quy trình tranh chấp để Admin đối soát. Bạn sẽ không bắt đầu thời gian thuê.',
          confirmButtonColor: '#8E1B2E'
        });
      }
      setPickupModalMode(null);
      onRefreshBooking?.();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi xử lý yêu cầu.';
      throw new Error(errorMsg);
    } finally {
      setIsSubmittingPickup(false);
    }
  };

  // Confirm complete rental and refund deposit
  const handleConfirmComplete = async () => {
    if (!booking?._id) return;

    const result = await Swal.fire({
      title: 'Xác nhận hoàn tất đơn thuê?',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6;">
          <p style="margin-bottom: 12px;">
            Cửa hàng đã xác nhận nhận lại trang phục nguyên vẹn. Bạn xác nhận hoàn tất đơn để hệ thống tiến hành giải ngân và hoàn trả tiền cọc <strong>${depositFee.toLocaleString('vi-VN')}đ</strong> cho bạn?
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận hoàn tất & Nhận cọc',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#7D736B'
    });

    if (!result.isConfirmed) return;

    try {
      await httpClient.post(`/bookings/${booking._id}/confirm-complete`, {});
      await Swal.fire({
        icon: 'success',
        title: 'Hoàn tất đơn hàng thành công!',
        text: 'Cảm ơn bạn đã sử dụng dịch vụ của TàGo. Tiền cọc đang được hệ thống xử lý hoàn trả.',
        confirmButtonColor: '#8E1B2E'
      });
      onRefreshBooking?.();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Có lỗi xảy ra',
        text: err?.response?.data?.message || err?.message || 'Không thể xác nhận hoàn tất đơn.',
        confirmButtonColor: '#8E1B2E'
      });
    }
  };

  // Timeline steps
  const timelineSteps: {
    id: string;
    title: string;
    description: string;
    timestamp?: string;
    status: 'COMPLETED' | 'ACTIVE' | 'PENDING';
  }[] = [
    {
      id: 'step-1',
      title: 'Shop chuẩn bị áo',
      description: ['PICKUP_PENDING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
        ? 'Đã chuẩn bị xong và kiểm tra chất lượng tại cửa hàng'
        : 'Cửa hàng đang kiểm tra và chuẩn bị áo dài',
      timestamp: readyTimeStr,
      status: ['PICKUP_PENDING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
        ? 'COMPLETED'
        : 'ACTIVE'
    },
    {
      id: 'step-2',
      title: ['PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
        ? 'Đã nhận áo'
        : 'Chờ nhận áo tại cửa hàng',
      description: ['PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
        ? `Đã nhận áo tại ${storeName}`
        : `Vui lòng đến ${storeName} để nhận áo theo lịch hẹn`,
      timestamp: rawPickup ? new Date(rawPickup).toLocaleDateString('vi-VN') + ' • ' + pickupTimeStr : undefined,
      status: ['PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
        ? 'COMPLETED'
        : ['PICKUP_PENDING', 'READY_FOR_PICKUP'].includes(currentStatus)
        ? 'ACTIVE'
        : 'PENDING'
    },
    {
      id: 'step-3',
      title: 'Khách đang thuê',
      description: ['RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
        ? 'Đã hoàn tất thời gian trải nghiệm trang phục'
        : ['PICKED_UP', 'IN_PROGRESS', 'RENTING'].includes(currentStatus)
        ? 'Thời gian thuê đang diễn ra theo hợp đồng'
        : 'Chưa bắt đầu thời gian thuê',
      status: ['RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
        ? 'COMPLETED'
        : ['PICKED_UP', 'IN_PROGRESS', 'RENTING'].includes(currentStatus)
        ? 'ACTIVE'
        : 'PENDING'
    },
    {
      id: 'step-4',
      title: 'Trả áo & Hoàn cọc',
      description: ['RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
        ? 'Đã hoàn tất kiểm tra và hoàn cọc'
        : currentStatus === 'RETURN_PENDING'
        ? 'Đang kiểm tra áo và đối soát hoàn cọc'
        : `Trả áo tại ${storeAddress} để nhận lại tiền cọc`,
      timestamp: ['RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus) && rawReturn ? new Date(rawReturn).toLocaleDateString('vi-VN') : undefined,
      status: ['RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
        ? 'COMPLETED'
        : currentStatus === 'RETURN_PENDING'
        ? 'ACTIVE'
        : 'PENDING'
    }
  ];

  // Photos
  const bookingId = booking?._id?.toString() || '';
  const itemId = item?._id?.toString() || '';

  const pickupFiles = item?.rentalFulfillment?.pickupEvidence?.files || [];
  const returnFiles = item?.rentalFulfillment?.returnEvidence?.files || [];

  const photos: any[] = [];
  pickupFiles.forEach((f: any, idx: number) => {
    photos.push({
      id: `pickup-${f.fileId || idx}`,
      title: `Ảnh bàn giao #${idx + 1}`,
      timestamp: f.uploadedAt ? new Date(f.uploadedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : paymentTimeStr,
      fileId: f.fileId,
      bookingId,
      itemId,
      image: f.url || '',
    });
  });

  returnFiles.forEach((f: any, idx: number) => {
    photos.push({
      id: `return-${f.fileId || idx}`,
      title: `Ảnh nhận lại #${idx + 1}`,
      timestamp: f.uploadedAt ? new Date(f.uploadedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : paymentTimeStr,
      fileId: f.fileId,
      bookingId,
      itemId,
      image: f.url || '',
    });
  });

  (Array.isArray(booking?.handoverPhotos) ? booking.handoverPhotos : []).forEach((photoItem: any, idx: number) => {
    const url = typeof photoItem === 'string' ? photoItem : photoItem?.url || '';
    photos.push({
      id: `handover-${idx}`,
      title: `Ảnh xác nhận #${idx + 1}`,
      timestamp: paymentTimeStr,
      image: url,
    });
  });

  let canReschedule = false;
  if (['CONFIRMED', 'DEPOSIT_PAID'].includes(currentStatus)) {
    try {
      const pickupDate = rawPickup ? new Date(rawPickup) : null;
      if (pickupDate && !isNaN(pickupDate.getTime())) {
        const msUntilPickup = pickupDate.getTime() - Date.now();
        canReschedule = msUntilPickup >= 24 * 60 * 60 * 1000;
      }
    } catch {
      canReschedule = false;
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        minWidth: 0
      }}
    >
      {/* 1. Top Header with Back button and Support/Reschedule actions */}
      <RentalDetailHeader
        onBack={onBack}
        onOpenSupport={handleSupport}
        canReschedule={canReschedule}
        onOpenReschedule={() => onOpenReschedule?.(item)}
      />

      {/* 2. Main Rental Overview Card & Horizontal Stepper with Integrated Handover Inspection */}
      <RentalMainCard
        rentalData={{
          image: itemImage,
          title: itemName,
          code: itemCode,
          size: itemSize,
          brand: itemBrand,
          color: itemColor,
          material: itemMaterial,
          accessories: itemAccessories,
          status: currentStatus,
          statusLabel: currentStatusLabel,
          readyTime: readyTimeStr,
          pickupTime: rawPickup ? new Date(rawPickup).toLocaleDateString('vi-VN') + ' ' + pickupTimeStr : pickupTimeStr,
          dueTime: dueTimeStr,
          remainingTime: remainingTimeStr,
          items: dressItems
        }}
        pickupInspection={
          ['PICKUP_PENDING', 'READY_FOR_PICKUP'].includes(currentStatus)
            ? {
                // New fulfillment evidence is private and belongs to the item;
                // fall back to legacy booking-level URLs only for old bookings.
                handoverPhotos: pickupFiles.length > 0 ? pickupFiles : booking?.handoverPhotos,
                bookingId,
                itemId,
                isSubmitting: isSubmittingPickup,
                onConfirm: () => setPickupModalMode('CONFIRM'),
                onReportDamage: () => setPickupModalMode('DAMAGE'),
                onReject: () => setPickupModalMode('REJECT'),
                onViewPhoto: (url) => {
                  Swal.fire({
                    title: 'Ảnh bàn giao từ Cửa hàng',
                    imageUrl: url,
                    confirmButtonText: 'Đóng',
                    confirmButtonColor: '#8E1B2E'
                  });
                }
              }
            : undefined
        }
      />

      {(() => {
        const result = booking?.disputeResult || (() => {
          const timeline = Array.isArray((booking as any)?.statusTimeline) ? (booking as any).statusTimeline : [];
          const resolved = [...timeline].reverse().find((entry: any) => typeof entry?.note === 'string' && entry.note.includes('Admin giải quyết tranh chấp'));
          return resolved ? { decisionLabel: resolved.note, resolvedAt: resolved.changedAt } : null;
        })();
        if (!result) return null;
        return (
        <div style={{ background: '#FFFBEA', border: '1px solid #F3C969', borderRadius: 14, padding: '16px 20px', color: '#5B3A00' }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>⚖️ Kết quả giải quyết tranh chấp từ Admin</div>
          <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
            <div><strong>Phán quyết:</strong> {result.decisionLabel || result.decision || 'Đã xử lý'}</div>
            {typeof result.refundAmount === 'number' && <div><strong>Hoàn tiền cho khách:</strong> {result.refundAmount.toLocaleString('vi-VN')}đ</div>}
            {result.notes && <div><strong>Ghi chú Admin:</strong> {result.notes}</div>}
            {result.resolvedAt && <div style={{ color: '#8A6A35', fontSize: 12 }}>Thời gian xử lý: {new Date(result.resolvedAt).toLocaleString('vi-VN')}</div>}
          </div>
        </div>
        );
      })()}

      {/* 2a. Ghi nhận tình trạng áo có sẵn trước khi thuê nếu khách đã báo cáo */}
      {booking?.pickupDamageReport && (
        <RentalPickupDamageReportCard
          report={booking.pickupDamageReport}
          onViewPhoto={(url) => {
            Swal.fire({
              title: 'Ảnh bằng chứng hư hỏng khi nhận áo',
              imageUrl: url,
              confirmButtonText: 'Đóng',
              confirmButtonColor: '#8E1B2E'
            });
          }}
        />
      )}

      {/* 2b. Khách hàng xem xét & xử lý yêu cầu đền bù sự cố từ Shop */}
      {isPendingCustomerIncident && (
        <div
          style={{
            backgroundColor: '#FFFDF9',
            borderRadius: '16px',
            border: '1.5px solid #FCD34D',
            boxShadow: '0 4px 20px rgba(217, 119, 6, 0.08)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* Header of Incident Card */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#D97706',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#92400E' }}>
                  Yêu Cầu Bồi Thường Sự Cố Hư Hỏng Trang Phục
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#B45309' }}>
                  Cửa hàng đã nhận lại đồ và gửi báo cáo sự cố cần bạn xác nhận xử lý
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFF1F2',
                border: '1px solid #FECDD3',
                color: '#E11D48',
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 750
              }}
            >
              Chờ bạn duyệt
            </div>
          </div>

          {/* Description & Financial deduction */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '14px'
            }}
          >
            {/* Box 1: Description */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EFE9E1',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#7D736B', textTransform: 'uppercase' }}>
                Mô tả sự cố từ Cửa hàng
              </span>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#231F20', fontWeight: 600, lineHeight: 1.5 }}>
                "{incident.description || 'Hư hỏng trang phục khi sử dụng'}"
              </p>
              <span style={{ fontSize: '11px', color: '#8C827A' }}>
                Phương án đề xuất: {incident.actionType === 'MAINTENANCE' ? 'Sửa chữa / Bảo dưỡng' : 'Giặt ủi / Làm sạch chuyên sâu'}
              </span>
            </div>

            {/* Box 2: Financial deduction */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EFE9E1',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#7D736B', textTransform: 'uppercase' }}>
                  Tiền cọc giữ đồ:
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#231F20' }}>
                  {depositFee.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#DC2626' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>
                  Khấu trừ đền bù sự cố:
                </span>
                <span style={{ fontSize: '14px', fontWeight: 800 }}>
                  -{(incident.requestedAmount || 0).toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div style={{ borderTop: '1px dashed #E5E7EB', margin: '2px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#059669' }}>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>
                  Tiền cọc hoàn trả lại bạn:
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800 }}>
                  {Math.max(0, depositFee - (incident.requestedAmount || 0)).toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
          </div>

          {/* Evidence Photos */}
          {incident.evidencePhotos && incident.evidencePhotos.length > 0 && (
            <div>
              <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 750, color: '#4B5563', marginBottom: '8px' }}>
                📸 Bằng chứng hình ảnh do Shop chụp ({incident.evidencePhotos.length} ảnh):
              </span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {incident.evidencePhotos.map((ref: string, index: number) => (
                  <div
                    key={index}
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1.5px solid #FCD34D',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                    }}
                  >
                    <PrivateEvidenceImage
                      reference={ref}
                      legacyUrl={ref}
                      alt={`Bằng chứng hư hỏng ${index + 1}`}
                      linkStyle={{ display: 'block', width: '100%', height: '100%' }}
                      imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Buttons Inside Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid #F3EDE4',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={handleDisagreeIncident}
              disabled={respondingIncident}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: respondingIncident ? 'not-allowed' : 'pointer'
              }}
            >
              <AlertTriangle size={14} color="#DC2626" />
              <span>{respondingIncident ? 'Đang gửi...' : 'Từ chối / Khiếu nại lên Admin'}</span>
            </button>

            <button
              type="button"
              onClick={handleAgreeIncident}
              disabled={respondingIncident}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 750,
                cursor: respondingIncident ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
              }}
            >
              <CheckSquare size={14} />
              <span>
                {respondingIncident
                  ? 'Đang xử lý...'
                  : `Đồng ý đền bù (${(incident.requestedAmount || 0).toLocaleString('vi-VN')}đ)`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 2c. Disputed Banner Card */}
      {isDisputed && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            borderRadius: '14px',
            border: '1.5px solid #FECACA',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#991B1B',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#991B1B' }}>
              Đơn Hàng Đang Trong Quá Trình Giải Quyết Tranh Chấp
            </h4>
            <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#B91C1C', lineHeight: 1.5 }}>
              Bạn đã từ chối yêu cầu đền bù của Shop. Ban Quản Trị TàGo đang thụ lý hồ sơ, kiểm tra ảnh đối soát và sẽ liên hệ giải quyết công bằng trong vòng 24–48h làm việc. Toàn bộ tiền cọc và thanh toán được giữ an toàn trong Escrow.
            </p>
          </div>
        </div>
      )}

      {/* 3. 3-Column Info Cards (Pickup/Return, Payment, Rules) */}
      <RentalInfoColumns
        pickupDate={pickupDateStr}
        pickupTime={pickupTimeStr}
        storeName={storeName}
        storeAddress={storeAddress}
        rentalPrice={rentalPrice}
        cleaningFee={cleaningFee}
        depositFee={depositFee}
        totalPrice={totalPrice}
        paymentTime={paymentTimeStr}
        onOpenMap={handleOpenMap}
        onGetDirections={handleOpenMap}
        onViewInvoice={handleViewInvoice}
        onViewRules={handleViewRules}
      />

      {/* 4. 2-Column Quá trình thuê & Ảnh bàn giao */}
      <RentalTimelineAndPhotos
        timelineSteps={timelineSteps}
        photos={photos}
        onViewPhoto={(photo) => {
          Swal.fire({
            title: photo.title,
            imageUrl: photo.image,
            imageAlt: photo.title,
            text: `Chụp lúc: ${photo.timestamp}`,
            confirmButtonText: 'Đóng',
            confirmButtonColor: '#8E1B2E'
          });
        }}
      />

      {/* 5. Bottom Action Bar */}
      <RentalBottomActionBar
        status={currentStatus}
        incident={incident}
        respondingIncident={respondingIncident}
        onCancel={() => onOpenCancel?.(booking || { _id: 'demo-1', bookingCode: itemCode })}
        onSupport={handleSupport}
        onReturn={handleReturn}
        onOpenMap={handleOpenMap}
        onConfirmPickup={() => setPickupModalMode('CONFIRM')}
        onReportDamage={() => setPickupModalMode('DAMAGE')}
        onRejectHandover={() => setPickupModalMode('REJECT')}
        isSubmittingPickup={isSubmittingPickup}
        onConfirmComplete={handleConfirmComplete}
        onAgreeIncident={handleAgreeIncident}
        onDisagreeIncident={handleDisagreeIncident}
        onContinuePayment={() => onContinuePayment?.(booking?._id)}
        canCustomerConfirmCompletion={Boolean(booking?.canCustomerConfirmCompletion)}
      />

      {/* 6. Modal Báo cáo hiện trạng / Xác nhận / Từ chối nhận áo */}
      {pickupModalMode && (
        <RentalPickupReportModal
          isOpen={Boolean(pickupModalMode)}
          mode={pickupModalMode}
          bookingCode={itemCode}
          onClose={() => {
            if (!isSubmittingPickup) setPickupModalMode(null);
          }}
          onSubmit={handlePickupModalSubmit}
        />
      )}

      {/* 7. Modal Xác nhận trả áo dài kèm ảnh bằng chứng */}
      <RentalReturnModal
        isOpen={isReturnModalOpen}
        bookingCode={itemCode}
        storeName={storeName}
        storeAddress={storeAddress}
        depositAmount={depositFee}
        onClose={() => setIsReturnModalOpen(false)}
        onOpenMap={handleOpenMap}
        onSubmit={handleReturnSubmit}
      />
    </div>
  );
};
