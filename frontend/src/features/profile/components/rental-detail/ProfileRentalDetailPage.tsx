import React from 'react';
import { RentalDetailHeader } from './RentalDetailHeader';
import { RentalMainCard } from './RentalMainCard';
import { RentalInfoColumns } from './RentalInfoColumns';
import { RentalTimelineAndPhotos } from './RentalTimelineAndPhotos';
import { RentalBottomActionBar } from './RentalBottomActionBar';
import Swal from 'sweetalert2';

interface ProfileRentalDetailPageProps {
  booking?: any;
  onBack: () => void;
  onOpenRescheduleOrExtend?: (item: any) => void;
  onOpenCancel?: (booking: any) => void;
}

export const ProfileRentalDetailPage: React.FC<ProfileRentalDetailPageProps> = ({
  booking,
  onBack,
  onOpenRescheduleOrExtend,
  onOpenCancel
}) => {
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
  const statusLabels: Record<string, string> = {
    CONFIRMED: isPhoto ? 'SẮP CHỤP' : 'SẮP NHẬN',
    DEPOSIT_PAID: isPhoto ? 'ĐÃ ĐẶT CỌC' : 'ĐÃ ĐẶT CỌC',
    PENDING_PAYMENT: 'CHỜ THANH TOÁN',
    PICKUP_PENDING: 'CHỜ NHẬN ĐỒ',
    PICKED_UP: isPhoto ? 'ĐANG CHỤP' : 'ĐANG THUÊ',
    IN_PROGRESS: isPhoto ? 'ĐANG CHỤP' : 'ĐANG THUÊ',
    AWAITING_REVIEW: 'CHỜ DUYỆT ẢNH',
    RETURN_PENDING: 'CHỜ TRẢ ĐỒ',
    RETURNED: isPhoto ? 'HOÀN THÀNH' : 'ĐÃ TRẢ ĐỒ',
    COMPLETED: 'HOÀN THÀNH',
    CANCELLED: 'ĐÃ HỦY'
  };

  const currentStatusLabel = statusLabels[booking?.status] || booking?.status || 'ĐANG THUÊ';

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
      title: 'Sẵn sàng nhận áo',
      description: 'Áo dài được kiểm tra và chuẩn bị tại cửa hàng',
      timestamp: readyTimeStr,
      status: ['PICKUP_PENDING', 'PICKED_UP', 'IN_PROGRESS', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(booking?.status) ? 'COMPLETED' : 'ACTIVE'
    },
    {
      id: 'step-2',
      title: 'Đã nhận áo',
      description: `Nhận áo tại ${storeName}`,
      timestamp: rawPickup ? new Date(rawPickup).toLocaleDateString('vi-VN') + ' • ' + pickupTimeStr : undefined,
      status: ['PICKED_UP', 'IN_PROGRESS', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(booking?.status) ? 'COMPLETED' : booking?.status === 'PICKUP_PENDING' ? 'ACTIVE' : 'PENDING'
    },
    {
      id: 'step-3',
      title: 'Đang thuê',
      description: 'Thời gian thuê đang diễn ra',
      status: ['RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(booking?.status) ? 'COMPLETED' : ['PICKED_UP', 'IN_PROGRESS'].includes(booking?.status) ? 'ACTIVE' : 'PENDING'
    },
    {
      id: 'step-4',
      title: 'Trả áo',
      description: ['RETURNED', 'COMPLETED'].includes(booking?.status) ? 'Đã hoàn tất kiểm tra và hoàn cọc' : 'Chưa hoàn thành',
      timestamp: ['RETURNED', 'COMPLETED'].includes(booking?.status) && rawReturn ? new Date(rawReturn).toLocaleDateString('vi-VN') : undefined,
      status: ['RETURNED', 'COMPLETED'].includes(booking?.status) ? 'COMPLETED' : booking?.status === 'RETURN_PENDING' ? 'ACTIVE' : 'PENDING'
    }
  ];

  // Photos
  const photos = (booking?.handoverPhotos || []).map((imgUrl: string, pIdx: number) => ({
    id: `photo-${pIdx}`,
    title: `Ảnh bàn giao #${pIdx + 1}`,
    timestamp: paymentTimeStr,
    image: imgUrl
  }));

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
          status: booking?.status || 'RENTING',
          statusLabel: currentStatusLabel,
          readyTime: readyTimeStr,
          pickupTime: rawPickup ? new Date(rawPickup).toLocaleDateString('vi-VN') + ' ' + pickupTimeStr : pickupTimeStr,
          dueTime: dueTimeStr,
          remainingTime: remainingTimeStr
        }}
      />

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
        onCancel={() => onOpenCancel?.(booking || { _id: 'demo-1', bookingCode: itemCode })}
        onExtend={() => onOpenRescheduleOrExtend?.(item)}
        onSupport={handleSupport}
        onReturn={handleReturn}
      />
    </div>
  );
};
