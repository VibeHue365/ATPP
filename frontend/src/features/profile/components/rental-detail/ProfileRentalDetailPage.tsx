import React from 'react';
import { AlertTriangle, CheckSquare } from 'lucide-react';
import { RentalDetailHeader } from './RentalDetailHeader';
import { RentalMainCard } from './RentalMainCard';
import { RentalInfoColumns } from './RentalInfoColumns';
import { RentalTimelineAndPhotos } from './RentalTimelineAndPhotos';
import { RentalBottomActionBar } from './RentalBottomActionBar';
import { PrivateEvidenceImage } from '../../../../components/common/PrivateEvidenceImage';
import Swal from 'sweetalert2';
import { httpClient } from '../../../../services/httpClient';

interface ProfileRentalDetailPageProps {
  booking?: any;
  onBack: () => void;
  onOpenRescheduleOrExtend?: (item: any) => void;
  onOpenCancel?: (booking: any) => void;
  onRefreshBooking?: () => void;
}

export const ProfileRentalDetailPage: React.FC<ProfileRentalDetailPageProps> = ({
  booking,
  onBack,
  onOpenRescheduleOrExtend,
  onOpenCancel,
  onRefreshBooking
}) => {
  const [incident, setIncident] = React.useState<any>(null);
  const [respondingIncident, setRespondingIncident] = React.useState<boolean>(false);

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
    fetchIncidentDetails();
  }, [fetchIncidentDetails]);

  const item = booking?.items?.[0] || {};
  const isPhoto = item.itemType === 'PHOTOGRAPHY_PACKAGE';
  const pkgObj = item.photographyPackageId && typeof item.photographyPackageId === 'object' ? item.photographyPackageId : null;
  const prodObj = !isPhoto && item.productId && typeof item.productId === 'object' ? item.productId : null;
  const provider =
    (booking?.providerIds && booking.providerIds[0] && typeof booking.providerIds[0] === 'object' ? booking.providerIds[0] : null) ||
    (item.providerId && typeof item.providerId === 'object' ? item.providerId : null) ||
    {};

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

  const itemCode = booking?.bookingCode || (booking?._id ? 'RT-' + booking._id.slice(-4) : 'RT-LUME');
  const itemSize = isPhoto ? '' : (item.selectedSize || item.size || '');
  const itemColor = item.selectedColor || item.color || prodObj?.color || 'Đa sắc';
  const itemBrand = prodObj?.brand || provider?.businessName || provider?.fullName || 'LUMÉ Premium';
  const itemMaterial = prodObj?.material || 'Lụa cao cấp';
  const itemAccessories = item.accessories || prodObj?.accessories || 'Mấn đội đầu';

  // Dates & Times
  const rawPickup = item.rentalFrom || item.startDate || item.shootDate || booking?.startDate;
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

  const statusLabels: Record<string, string> = {
    CONFIRMED: isPhoto ? 'SẮP CHỤP' : 'SẮP NHẬN',
    DEPOSIT_PAID: isPhoto ? 'ĐÃ ĐẶT CỌC' : 'ĐÃ ĐẶT CỌC',
    PENDING_PAYMENT: 'CHỜ THANH TOÁN',
    PICKUP_PENDING: 'CHỜ NHẬN ĐỒ',
    READY_FOR_PICKUP: 'CHỜ NHẬN ĐỒ',
    PICKED_UP: isPhoto ? 'ĐANG CHỤP' : 'ĐANG THUÊ',
    IN_PROGRESS: isPhoto ? 'ĐANG CHỤP' : 'ĐANG THUÊ',
    RENTING: isPhoto ? 'ĐANG CHỤP' : 'ĐANG THUÊ',
    AWAITING_REVIEW: 'CHỜ DUYỆT ẢNH',
    RETURN_PENDING: isPendingCustomerIncident ? 'CHỜ DUYỆT SỰ CỐ' : 'CHỜ TRẢ ĐỒ',
    RETURNED: isPhoto ? 'HOÀN THÀNH' : 'ĐÃ TRẢ ĐỒ',
    COMPLETED: 'HOÀN THÀNH',
    CANCELLED: 'ĐÃ HỦY',
    DISPUTED: 'TRANH CHẤP'
  };

  const currentStatus = isDisputed
    ? 'DISPUTED'
    : booking?.status || item?.rentalFulfillment?.status || 'CONFIRMED';
  const currentStatusLabel = isPendingCustomerIncident
    ? 'CHỜ DUYỆT SỰ CỐ'
    : isDisputed
    ? 'TRANH CHẤP'
    : statusLabels[currentStatus] || currentStatus || (isPhoto ? 'SẮP CHỤP' : 'SẮP NHẬN');

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

  // Store information
  const storeName = provider?.businessName || provider?.fullName || 'Cửa hàng LUMÉ';
  const storeAddress =
    item.pickupReturnLocationSnapshot?.address ||
    provider?.address ||
    provider?.businessAddress ||
    booking?.deliveryAddress?.address ||
    '15 Lê Lợi, Phú Hội, TP. Huế';

  // Support hotline handler
  const handleSupport = () => {
    Swal.fire({
      title: 'Trung tâm Hỗ trợ Khách hàng LUMÉ',
      html: `
        <div style="text-align: left; font-size: 14px; color: #4A3F35; line-height: 1.6;">
          <p>Đội ngũ LUMÉ luôn sẵn sàng hỗ trợ bạn:</p>
          <div style="background: #FDF2F4; padding: 12px 16px; border-radius: 10px; border: 1px solid #F7D5DA; margin: 12px 0;">
            <p style="margin: 0; font-weight: 700; color: #8B1E2D; font-size: 16px;">📞 Hotline: 1900 9999</p>
            <p style="margin: 4px 0 0 0; color: #7D736B; font-size: 12px;">Hỗ trợ 24/7 toàn quốc</p>
          </div>
          <p style="margin: 0;">✉️ Email: <strong>support@lume.vn</strong></p>
          <p style="margin: 4px 0 0 0;">🏢 Cửa hàng: <strong>${storeAddress}</strong></p>
        </div>
      `,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#8B1E2D'
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
            <li><strong>Giặt ủi:</strong> Không tự ý giặt ủi hoặc tẩy trang phục. LUMÉ sẽ đảm nhận quy trình giặt sấy chuyên dụng sau khi nhận lại.</li>
            <li><strong>Thời hạn trả:</strong> Vui lòng hoàn trả trước giờ hẹn quy định. Trường hợp quá hạn sẽ tính phí phát sinh theo thỏa thuận.</li>
            <li><strong>Hoàn cọc:</strong> Tiền cọc (${depositFee.toLocaleString('vi-VN')}đ) sẽ được hoàn trả đầy đủ ngay sau khi nhân viên kiểm tra tình trạng áo dài.</li>
          </ol>
        </div>
      `,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#8B1E2D'
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
          <div style="border-top: 1px solid #ECE5DB; padding-top: 8px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #8B1E2D;">
            <span>Tổng thanh toán:</span>
            <span>${totalPrice.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="margin-top: 12px; background: ${isPaid ? '#ECFDF5' : '#FEF3C7'}; padding: 6px 12px; border-radius: 6px; color: ${isPaid ? '#047857' : '#B45309'}; font-weight: 700; font-size: 12px; text-align: center;">
            ${isPaid ? '✓ ĐÃ THANH TOÁN QUA VÍ/PAYOS' : '⏳ CHỜ THANH TOÁN'}
          </div>
        </div>
      `,
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#8B1E2D'
    });
  };

  // Return Ao Dai handler
  const handleReturn = () => {
    Swal.fire({
      title: 'Xác nhận hoàn trả áo dài?',
      text: `Nhân viên LUMÉ tại ${storeAddress} sẽ kiểm tra tình trạng áo và hoàn cọc ${depositFee.toLocaleString('vi-VN')}đ cho bạn.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đến điểm trả áo',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#8B1E2D',
      cancelButtonColor: '#7D736B'
    }).then((res) => {
      if (res.isConfirmed) {
        handleOpenMap();
      }
    });
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
        confirmButtonColor: '#8B1E2D'
      });
      onRefreshBooking?.();
      fetchIncidentDetails();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Có lỗi xảy ra',
        text: err?.response?.data?.message || err?.message || 'Không thể xác nhận đền bù.',
        confirmButtonColor: '#8B1E2D'
      });
    } finally {
      setRespondingIncident(false);
    }
  };

  // Handle customer disagrees / escalates incident to Admin
  const handleDisagreeIncident = async () => {
    if (!incident?._id) return;

    const result = await Swal.fire({
      title: 'Khiếu nại lên Ban Quản Trị?',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6;">
          <p style="margin-bottom: 12px;">
            Bạn không đồng ý với yêu cầu đền bù của Shop? Đơn hàng sẽ được chuyển lên Ban Quản Trị (Admin) để thẩm định và giải quyết.
          </p>
          <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; color: #991B1B;">
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
      cancelButtonColor: '#6B7280'
    });

    if (!result.isConfirmed) return;

    try {
      setRespondingIncident(true);
      await httpClient.post(`/api/disputes/incidents/${incident._id}/disagree`);
      await Swal.fire({
        icon: 'success',
        title: 'Đã gửi khiếu nại!',
        text: 'Đơn hàng đã được chuyển sang trạng thái tranh chấp. Ban Quản Trị sẽ kiểm tra và thông báo kết quả sớm nhất cho bạn.',
        confirmButtonColor: '#8B1E2D'
      });
      onRefreshBooking?.();
      fetchIncidentDetails();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Có lỗi xảy ra',
        text: err?.response?.data?.message || err?.message || 'Không thể gửi khiếu nại.',
        confirmButtonColor: '#8B1E2D'
      });
    } finally {
      setRespondingIncident(false);
    }
  };

  // Confirm pickup with optional photo upload
  const handleConfirmPickup = async () => {
    if (!booking?._id) return;

    let selectedFiles: File[] = [];

    const result = await Swal.fire({
      title: 'Xác nhận đã nhận áo dài',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6;">
          <p style="margin-bottom: 12px;">
            Bạn xác nhận đã nhận đầy đủ áo dài và phụ kiện trực tiếp từ cửa hàng <strong>${storeName}</strong>?
          </p>
          <div style="background-color: #F8F5F1; border: 1px dashed #DED7CB; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <label style="display: block; font-weight: 700; margin-bottom: 6px; color: #8B1E2D; font-size: 13px;">
              📸 Tải ảnh hiện trạng áo lúc nhận (Khuyến nghị):
            </label>
            <input
              type="file"
              id="swal-pickup-photos"
              accept="image/*"
              multiple
              style="width: 100%; font-size: 12px;"
            />
            <small style="color: #7D736B; display: block; margin-top: 4px; font-size: 11px;">
              Chụp rõ nếp áo, phụ kiện đi kèm để lưu bằng chứng đối soát khi hoàn trả tiền cọc.
            </small>
          </div>
          <p style="margin: 0; font-size: 12px; color: #059669; font-weight: 600;">
            ✓ Sau khi xác nhận, thời gian thuê của bạn sẽ chính thức bắt đầu tính.
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Xác nhận nhận áo',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#7D736B',
      didOpen: () => {
        const input = document.getElementById('swal-pickup-photos') as HTMLInputElement;
        if (input) {
          input.addEventListener('change', (e: any) => {
            selectedFiles = Array.from(e.target.files || []);
          });
        }
      },
      preConfirm: async () => {
        try {
          Swal.showLoading();
          const uploadedUrls: string[] = [];

          for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            try {
              const res: any = await httpClient.post('/bookings/upload-reference', formData);
              if (res?.url) uploadedUrls.push(res.url);
            } catch (upErr) {
              console.warn('Lỗi tải ảnh:', upErr);
            }
          }

          await httpClient.post(`/bookings/${booking._id}/customer-confirm-pickup`, {
            evidencePhotos: uploadedUrls.length > 0 ? uploadedUrls : undefined
          });
          return true;
        } catch (err: any) {
          Swal.showValidationMessage(err?.message || 'Có lỗi xảy ra khi xác nhận nhận áo.');
          return false;
        }
      }
    });

    if (result.isConfirmed) {
      await Swal.fire({
        icon: 'success',
        title: 'Nhận áo thành công!',
        text: 'Đơn thuê của bạn đã chuyển sang trạng thái Đang thuê. Chúc bạn có trải nghiệm tuyệt vời!',
        confirmButtonColor: '#8B1E2D'
      });
      onRefreshBooking?.();
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
      description: ['PICKUP_PENDING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(currentStatus)
        ? 'Đã chuẩn bị xong và kiểm tra chất lượng tại cửa hàng'
        : 'Cửa hàng đang kiểm tra và chuẩn bị áo dài',
      timestamp: readyTimeStr,
      status: ['PICKUP_PENDING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(currentStatus)
        ? 'COMPLETED'
        : 'ACTIVE'
    },
    {
      id: 'step-2',
      title: ['PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(currentStatus)
        ? 'Đã nhận áo'
        : 'Chờ nhận áo tại cửa hàng',
      description: ['PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(currentStatus)
        ? `Đã nhận áo tại ${storeName}`
        : `Vui lòng đến ${storeName} để nhận áo theo lịch hẹn`,
      timestamp: rawPickup ? new Date(rawPickup).toLocaleDateString('vi-VN') + ' • ' + pickupTimeStr : undefined,
      status: ['PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(currentStatus)
        ? 'COMPLETED'
        : ['PICKUP_PENDING', 'READY_FOR_PICKUP'].includes(currentStatus)
        ? 'ACTIVE'
        : 'PENDING'
    },
    {
      id: 'step-3',
      title: 'Khách đang thuê',
      description: ['RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(currentStatus)
        ? 'Đã hoàn tất thời gian trải nghiệm trang phục'
        : ['PICKED_UP', 'IN_PROGRESS', 'RENTING'].includes(currentStatus)
        ? 'Thời gian thuê đang diễn ra theo hợp đồng'
        : 'Chưa bắt đầu thời gian thuê',
      status: ['RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(currentStatus)
        ? 'COMPLETED'
        : ['PICKED_UP', 'IN_PROGRESS', 'RENTING'].includes(currentStatus)
        ? 'ACTIVE'
        : 'PENDING'
    },
    {
      id: 'step-4',
      title: 'Trả áo & Hoàn cọc',
      description: ['RETURNED', 'COMPLETED'].includes(currentStatus)
        ? 'Đã hoàn tất kiểm tra và hoàn cọc'
        : currentStatus === 'RETURN_PENDING'
        ? 'Đang kiểm tra áo và đối soát hoàn cọc'
        : `Trả áo tại ${storeAddress} để nhận lại tiền cọc`,
      timestamp: ['RETURNED', 'COMPLETED'].includes(currentStatus) && rawReturn ? new Date(rawReturn).toLocaleDateString('vi-VN') : undefined,
      status: ['RETURNED', 'COMPLETED'].includes(currentStatus)
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

  (booking?.handoverPhotos || []).forEach((url: string, idx: number) => {
    photos.push({
      id: `handover-${idx}`,
      title: `Ảnh xác nhận #${idx + 1}`,
      timestamp: paymentTimeStr,
      image: url,
    });
  });

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
      {/* 1. Top Header with Back button and Support/Extend actions */}
      <RentalDetailHeader
        onBack={onBack}
        onOpenSupport={handleSupport}
        onOpenRescheduleOrExtend={() => onOpenRescheduleOrExtend?.(item)}
      />

      {/* 2. Main Rental Overview Card & Horizontal Stepper */}
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
          remainingTime: remainingTimeStr
        }}
      />

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
              Bạn đã từ chối yêu cầu đền bù của Shop. Ban Quản Trị LUMÉ đang thụ lý hồ sơ, kiểm tra ảnh đối soát và sẽ liên hệ giải quyết công bằng trong vòng 24–48h làm việc. Toàn bộ tiền cọc và thanh toán được giữ an toàn trong Escrow.
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
            confirmButtonColor: '#8B1E2D'
          });
        }}
      />

      {/* 5. Bottom Action Bar */}
      <RentalBottomActionBar
        status={currentStatus}
        incident={incident}
        respondingIncident={respondingIncident}
        onCancel={() => onOpenCancel?.(booking || { _id: 'demo-1', bookingCode: itemCode })}
        onExtend={() => onOpenRescheduleOrExtend?.(item)}
        onSupport={handleSupport}
        onReturn={handleReturn}
        onOpenMap={handleOpenMap}
        onConfirmPickup={handleConfirmPickup}
        onAgreeIncident={handleAgreeIncident}
        onDisagreeIncident={handleDisagreeIncident}
      />
    </div>
  );
};
