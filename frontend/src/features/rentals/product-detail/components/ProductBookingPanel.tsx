import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Heart,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import type {
  ProductAvailabilityView,
  ProductDetail,
  RentalCalendarDay,
  RentalTimeSlot,
} from "../types/product-detail.types";
import { RentalDateTimeModal } from "./RentalDateTimeModal";

export interface ProductBookingPanelProps {
  product: ProductDetail;
  displayPrice: string;
  selectedColor: string;
  selectedSize: string;
  rentalMode: "DAILY" | "HOURLY";
  startDate: string;
  endDate: string;
  singleDate: string;
  startTime: string;
  endTime: string;
  bookingQty: number;
  calendarDate: Date;
  calendarDays: RentalCalendarDay[];
  timeSlots: RentalTimeSlot[];
  startSlotIndex: number;
  endSlotIndex: number;
  bookedSlotsOnSelectedDate: string[];
  availability: ProductAvailabilityView;
  isCurrentTimeSlotBusy: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onNavigateProvider: () => void;
  onOpenAiStyling?: () => void;
  onOpenAiSize?: () => void;
  onSelectColor: (color: string) => void;
  onSelectSize: (size: string) => void;
  onSelectRentalMode: (mode: "DAILY" | "HOURLY") => void;
  onSelectDate: (date: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectSlot: (index: number) => void;
  onDecreaseQuantity?: () => void;
  onIncreaseQuantity?: () => void;
  onAddToCart?: () => void;
  onBookNow: () => void;
  formatDate: (date?: string | null) => string;
  colorToHex: (color: string) => string;
  isTimeSlotOverlap: (slot1: string, slot2: string) => boolean;
}

const formatAddress = (product: ProductDetail) => {
  const address = product.providerId?.address;
  if (!address) return "Địa chỉ cửa hàng chưa được cập nhật";
  return [address.addressLine, address.ward, address.district, address.city].filter(Boolean).join(", ");
};

const getBasePrice = (product: ProductDetail) => (
  product.activeCampaign && product.discountedPrice ? product.discountedPrice : product.basePrice
);

const getDurationLabel = (displayPrice: string, rentalMode: "DAILY" | "HOURLY") => {
  const duration = displayPrice.split(" / ")[1];
  return duration || (rentalMode === "DAILY" ? "1 ngày" : "2 giờ");
};

export const ProductBookingPanel: React.FC<{
  product: ProductDetail;
  booking: Omit<ProductBookingPanelProps, "product">;
}> = ({ product, booking }) => {
  const {
    displayPrice,
    selectedColor,
    selectedSize,
    rentalMode,
    startDate,
    endDate,
    singleDate,
    startTime,
    endTime,
    calendarDate,
    calendarDays,
    timeSlots,
    startSlotIndex,
    endSlotIndex,
    bookedSlotsOnSelectedDate,
    availability,
    isCurrentTimeSlotBusy,
    onNavigateProvider,
    onSelectColor,
    onSelectSize,
    onSelectRentalMode,
    onSelectDate,
    onPreviousMonth,
    onNextMonth,
    onSelectSlot,
    onBookNow,
    formatDate,
    colorToHex,
    isTimeSlotOverlap,
    isFavorite,
    onToggleFavorite,
  } = booking;
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);

  const basePrice = getBasePrice(product);
  const hourlyRate = product.hourlyPrice || Math.round(basePrice * 0.3);
  const dailyLabel = `${basePrice.toLocaleString("vi-VN")}đ / ngày`;
  const hourlyLabel = `${hourlyRate.toLocaleString("vi-VN")}đ / giờ - tối thiểu 2 giờ`;
  const durationLabel = getDurationLabel(displayPrice, rentalMode);
  const rating = Number(product.rating?.averageRating || 0);
  const providerName = product.providerId?.businessName || "Cửa hàng áo dài";
  const providerInitial = providerName.trim().charAt(0).toUpperCase() || "L";
  const colorLabel = selectedColor || product.colors?.[0] || "Chưa chọn";
  const address = formatAddress(product);
  const summaryAmount = displayPrice.split(" / ")[0] || `${basePrice.toLocaleString("vi-VN")}đ`;
  const isUnavailable = isCurrentTimeSlotBusy || availability.state === "unavailable";

  const availabilityView = useMemo(() => {
    if (isCurrentTimeSlotBusy || availability.state === "unavailable") {
      return { className: "is-error", title: "Lịch thuê không còn trống", message: availability.result?.message || "Vui lòng chọn ngày hoặc khung giờ khác." };
    }
    if (availability.state === "checking") {
      return { className: "is-warning", title: "Đang kiểm tra lịch trống", message: "Hệ thống đang kiểm tra lịch thuê của mẫu này." };
    }
    if (availability.state === "error") {
      return { className: "is-warning", title: "Chưa thể kiểm tra lịch", message: "Hệ thống sẽ kiểm tra lại trước khi xác nhận thuê." };
    }
    if (availability.state === "available" && availability.result) {
      return { className: "is-success", title: "Còn lịch trong ngày đã chọn", message: `Mẫu size ${selectedSize || "đã chọn"} đang sẵn sàng tại điểm nhận ${product.providerId?.address?.city || "cửa hàng"}.` };
    }
    return null;
  }, [availability, isCurrentTimeSlotBusy, product.providerId?.address?.city, selectedSize]);

  return (
    <section className="figma-product-booking" id="booking-section">
      <div className="figma-product-booking__store">
        <div className="figma-product-booking__store-brand">
          <span className="figma-product-booking__store-avatar">{providerInitial}</span>
          <div><strong>{providerName}</strong><span><CheckCircle2 size={13} /> Cửa hàng đã xác minh</span></div>
        </div>
        <button type="button" onClick={onNavigateProvider}>Xem cửa hàng <ExternalLink size={15} /></button>
      </div>

      <div className="figma-product-booking__intro">
        <h1>{product.name}</h1>
        {product.description && <p>{product.description}</p>}
        <div className="figma-product-booking__rating" aria-label={`Đánh giá ${rating} trên 5`}>
          <Star size={16} fill="currentColor" /><strong>{rating.toFixed(1)}</strong><span>{product.rating?.totalReviews || 0} đánh giá</span>
          {typeof product.rentedCount === "number" && <span>Đã được thuê {product.rentedCount} lần</span>}
          <button type="button" onClick={() => document.getElementById("product-reviews")?.scrollIntoView({ behavior: "smooth" })}>Xem đánh giá</button>
        </div>
      </div>

      <div className="figma-product-booking__divider" />

      <div className="figma-product-booking__price-row">
        <div><span className="figma-product-booking__eyebrow">GIÁ THUÊ</span><strong>{rentalMode === "DAILY" ? dailyLabel : hourlyLabel}</strong></div>
        <div className="figma-product-booking__deposit"><span className="figma-product-booking__eyebrow">TIỀN CỌC HOÀN LẠI</span><strong>{(product.depositAmount || 0).toLocaleString("vi-VN")}đ</strong></div>
      </div>

      <div className="figma-product-booking__section-heading"><div><h2>Hình thức thuê</h2><span>Tính giá theo số ngày thực tế</span></div></div>
      <div className="figma-rental-modes">
        <button type="button" className={rentalMode === "DAILY" ? "is-selected" : ""} onClick={() => onSelectRentalMode("DAILY")}><strong>Theo ngày</strong><span>{dailyLabel}</span></button>
        <button type="button" className={rentalMode === "HOURLY" ? "is-selected" : ""} onClick={() => onSelectRentalMode("HOURLY")}><strong>Theo giờ</strong><span>{hourlyLabel}</span></button>
      </div>
      <p className="figma-product-booking__helper">Thuê từ 3 ngày được áp dụng giá gói nếu cửa hàng có hỗ trợ.</p>

      {product.colors?.length > 0 && (
        <div className="figma-product-booking__choice">
          <div className="figma-product-booking__section-heading"><h2>Màu sắc</h2><strong>{colorLabel}</strong></div>
          <div className="figma-color-options">{product.colors.map((color) => <button key={color} type="button" className={selectedColor === color ? "is-selected" : ""} onClick={() => onSelectColor(color)}><span style={{ backgroundColor: colorToHex(color) }} />{color}</button>)}</div>
        </div>
      )}

      {product.sizes?.length > 0 && (
        <div className="figma-product-booking__choice">
          <div className="figma-product-booking__section-heading"><h2>Chọn size</h2><button type="button" className="figma-inline-link">Hướng dẫn chọn size</button></div>
          <div className="figma-size-options">{product.sizes.map((size) => <button key={size} type="button" className={selectedSize === size ? "is-selected" : ""} onClick={() => onSelectSize(size)}>{size}</button>)}</div>
        </div>
      )}

      <div className="figma-product-booking__choice figma-product-booking__dates">
        <div className="figma-product-booking__section-heading"><h2>Thời gian thuê</h2><strong>{durationLabel}</strong></div>
        <div className="figma-date-fields">
          <button type="button" className="figma-date-field" onClick={() => setIsRentalModalOpen(true)}><span>NGÀY NHẬN</span><strong>{startDate ? formatDate(startDate) : "Chưa chọn"}</strong><CalendarDays size={18} /></button>
          <button type="button" className="figma-date-field" onClick={() => setIsRentalModalOpen(true)}><span>{rentalMode === "HOURLY" ? "KHUNG GIỜ" : "NGÀY TRẢ"}</span><strong>{rentalMode === "HOURLY" ? `${startTime} – ${endTime}` : endDate ? formatDate(endDate) : "Chưa chọn"}</strong><CalendarDays size={18} /></button>
        </div>
        <p className="figma-product-booking__helper">Một ngày thuê được tính theo 24 giờ kể từ thời điểm nhận áo.</p>
      </div>

      {availabilityView && <div className={`figma-status-box ${availabilityView.className}`}><Check size={18} /><div><strong>{availabilityView.title}</strong><span>{availabilityView.message}</span></div></div>}
      {availability.state === "idle" && <p className="figma-product-booking__availability-hint">Chọn màu, size và thời gian thuê để kiểm tra lịch trống.</p>}

      <div className="figma-pickup-box"><MapPin size={19} /><div><strong>Nhận và trả tại cửa hàng</strong><span>{address}</span></div><button type="button" onClick={onNavigateProvider}>Xem bản đồ</button></div>

      <div className="figma-summary-box">
        <div><span>Hình thức thuê</span><strong>{rentalMode === "DAILY" ? "Theo ngày" : "Theo giờ"}</strong></div>
        <div><span>Thời lượng</span><strong>{durationLabel}</strong></div>
        <div><span>Màu đã chọn</span><strong>{colorLabel}</strong></div>
        <div className="figma-summary-box__total"><span>Tiền thuê tạm tính</span><strong>{summaryAmount}</strong></div>
      </div>

      <div className="figma-product-booking__actions">
        <button type="button" className={`figma-favorite-button${isFavorite ? " is-active" : ""}`} onClick={onToggleFavorite} aria-label="Yêu thích sản phẩm"><Heart size={19} fill={isFavorite ? "currentColor" : "none"} /></button>
        <button type="button" className="figma-primary-button" disabled={isUnavailable} onClick={onBookNow}>Chọn lịch &amp; đặt thuê <ChevronRight size={18} /></button>
      </div>
      <div className="figma-assurances"><span><ShieldCheck size={14} /> Giữ lịch sau khi đặt</span><span><ShieldCheck size={14} /> Được đổi size nếu còn</span><span><ShieldCheck size={14} /> Hoàn cọc sau khi trả</span></div>

      <RentalDateTimeModal
        isOpen={isRentalModalOpen}
        rentalMode={rentalMode}
        calendarDate={calendarDate}
        calendarDays={calendarDays}
        startDate={startDate}
        endDate={endDate}
        singleDate={singleDate}
        startTime={startTime}
        endTime={endTime}
        timeSlots={timeSlots}
        startSlotIndex={startSlotIndex}
        endSlotIndex={endSlotIndex}
        bookedSlotsOnSelectedDate={bookedSlotsOnSelectedDate}
        availability={availability}
        isCurrentTimeSlotBusy={isCurrentTimeSlotBusy}
        onClose={() => setIsRentalModalOpen(false)}
        onSelectRentalMode={onSelectRentalMode}
        onSelectDate={onSelectDate}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        onSelectSlot={onSelectSlot}
        formatDate={formatDate}
        isTimeSlotOverlap={isTimeSlotOverlap}
      />
    </section>
  );
};
