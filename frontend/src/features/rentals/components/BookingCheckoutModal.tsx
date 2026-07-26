import React, { useState } from 'react';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { Calendar, Tag, ShieldCheck, CreditCard, X } from 'lucide-react';

interface BookingCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    name: string;
    price: number;
    providerId: string;
    images?: string[];
    image?: string;
    description?: string;
  };
  bookingType: 'AODAI_RENTAL' | 'PHOTOGRAPHY';
}

export const BookingCheckoutModal: React.FC<BookingCheckoutModalProps> = ({
  isOpen,
  onClose,
  item,
  bookingType,
}) => {
  const toast = useToast();
  const [dateStr, setDateStr] = useState('');
  const [timeSlot, setTimeSlot] = useState('09:00-11:00');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setErrorMsg(null);
    try {
      const res: any = await httpClient.post('/promotions/validate', {
        code: promoCode,
        orderValue: item.price,
        providerIds: [item.providerId],
      });
      setAppliedPromo(res);
      toast.success(`Đã áp dụng mã giảm giá "${res.name}"!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Mã giảm giá không hợp lệ');
      setAppliedPromo(null);
    }
  };

  const getDiscountAmount = () => {
    if (!appliedPromo) return 0;
    if (appliedPromo.discountType === 'PERCENTAGE') {
      const discount = Math.round((item.price * appliedPromo.discountValue) / 100);
      return appliedPromo.maxDiscountAmount && discount > appliedPromo.maxDiscountAmount
        ? appliedPromo.maxDiscountAmount
        : discount;
    }
    return appliedPromo.discountValue;
  };

  const discount = getDiscountAmount();
  const travelFee = 0;
  const grandTotal = Math.max(item.price - discount + travelFee, 0);
  const depositTotal = Math.round(grandTotal * 0.2);

  const handleCheckout = async () => {
    if (!dateStr) {
      toast.error('Vui lòng chọn ngày thực hiện dịch vụ!');
      return;
    }

    setIsLoading(true);
    try {
      if (bookingType === 'PHOTOGRAPHY') {
        throw new Error('Vui lòng đặt gói chụp từ trang nhiếp ảnh gia để chọn vị trí trên bản đồ.');
      }
      // 1. Create booking
      const bookingPayload = {
        bookingType,
        items: [
          {
            productId: item.id,
            quantity: 1,
            rentalFrom: dateStr,
            rentalTo: new Date(new Date(dateStr).getTime() + 3 * 24 * 3600 * 1000).toISOString(),
          },
        ],
        promoCode: appliedPromo?.code || undefined,
        travelFee,
      };

      const bookingRes: any = await httpClient.post('/bookings', bookingPayload);
      toast.info('Đơn đã được giữ tạm thời. Đang chuyển đến thanh toán…');

      // 2. Create PayOS Simulated Payment Link
      const paymentRes: any = await httpClient.post('/payments/create-link', {
        bookingId: bookingRes._id,
        purpose: 'FULL_PAYMENT',
      });

      if (paymentRes.payos && paymentRes.payos.checkoutUrl) {
        toast.info('Đang chuyển hướng tới cổng thanh toán PayOS Simulator...');
        setTimeout(() => {
          window.location.href = paymentRes.payos.checkoutUrl;
        }, 1500);
      } else {
        throw new Error('Không thể khởi tạo liên kết thanh toán');
      }
    } catch (err: any) {
      toast.error(err.message || 'Thao tác đặt hàng thất bại');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-up-fade">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-white">
          <h3 className="font-header text-lg font-bold">Thông tin thanh toán & Đặt cọc</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-800 text-stone-300 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[80vh] flex flex-col gap-5">
          {/* Selected Product Summary */}
          <div className="flex gap-4 p-4 rounded-xl bg-stone-50 border border-stone-100">
            <img
              src={item.images?.[0] || item.image || '/cuc_hoa_mi.png'}
              alt={item.name}
              className="w-20 h-20 object-cover rounded-lg border border-stone-200"
            />
            <div className="flex flex-col justify-center">
              <h4 className="font-header text-stone-900 font-bold text-base leading-snug">{item.name}</h4>
              <p className="text-stone-500 text-xs mt-1">Dịch vụ: {bookingType === 'AODAI_RENTAL' ? 'Thuê Áo Dài' : 'Chụp Ảnh'}</p>
              <strong className="text-stone-950 font-header text-base mt-2">{item.price.toLocaleString()}đ</strong>
            </div>
          </div>

          {/* Date Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-stone-700 font-bold text-xs tracking-wider uppercase flex items-center gap-1.5">
              <Calendar size={14} className="text-stone-500" />
              <span>CHỌN NGÀY THỰC HIỆN DỊCH VỤ</span>
            </label>
            <input
              type="date"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Time Slot for Photo */}
          {bookingType === 'PHOTOGRAPHY' && (
            <div className="flex flex-col gap-2">
              <label className="text-stone-700 font-bold text-xs tracking-wider uppercase">KHUNG GIỜ CHỤP</label>
              <select
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
              >
                <option value="07:00-09:00">Sáng sớm (07:00 - 09:00)</option>
                <option value="09:00-11:00">Sáng (09:00 - 11:00)</option>
                <option value="14:00-16:00">Chiều (14:00 - 16:00)</option>
                <option value="16:00-18:00">Chiều muộn (16:00 - 18:00)</option>
              </select>
            </div>
          )}

          {/* Voucher Code Input */}
          <div className="flex flex-col gap-2">
            <label className="text-stone-700 font-bold text-xs tracking-wider uppercase flex items-center gap-1.5">
              <Tag size={14} className="text-stone-500" />
              <span>MÃ GIẢM GIÁ (VOUCHER)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900 placeholder:text-stone-400"
                placeholder="Nhập Voucher..."
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
              />
              <button
                onClick={handleApplyPromo}
                className="px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 transition"
              >
                Áp dụng
              </button>
            </div>
            {errorMsg && <p className="text-red-500 text-xs font-medium">{errorMsg}</p>}
            {appliedPromo && (
              <p className="text-emerald-600 text-xs font-semibold flex items-center gap-1">
                <ShieldCheck size={14} />
                <span>Đã áp dụng mã {appliedPromo.code}: Giảm {discount.toLocaleString()}đ</span>
              </p>
            )}
          </div>

          {/* Separator */}
          <div className="h-px bg-stone-200 my-1" />

          {/* Pricing Breakdown & Deposit */}
          <div className="flex flex-col gap-2 bg-stone-50 p-4 rounded-xl border border-stone-100">
            <div className="flex justify-between text-xs text-stone-500 font-medium">
              <span>Đơn giá gốc:</span>
              <span>{item.price.toLocaleString()}đ</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 font-medium">
                <span>Khuyến mãi giảm giá:</span>
                <span>-{discount.toLocaleString()}đ</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-stone-500 font-medium">
              <span>Phí vận chuyển/đi lại:</span>
              <span>Miễn phí</span>
            </div>
            <div className="flex justify-between text-sm text-stone-900 font-bold mt-1">
              <span>Tổng thanh toán đơn hàng:</span>
              <span>{grandTotal.toLocaleString()}đ</span>
            </div>
            <div className="h-px bg-stone-200 my-2" />
            <div className="flex justify-between text-sm text-stone-950 font-bold">
              <span className="flex items-center gap-1 text-stone-900">
                <CreditCard size={16} className="text-amber-600" />
                <span>Tiền cọc cần trả trước (20%):</span>
              </span>
              <span className="text-amber-700 text-base font-extrabold">{depositTotal.toLocaleString()}đ</span>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleCheckout}
            disabled={isLoading}
            className="w-full py-3.5 bg-[#a11e22] text-white font-bold text-sm tracking-wider rounded-xl hover:bg-[#801418] transition flex items-center justify-center gap-2 shadow-md disabled:bg-stone-400 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Đang xử lý đặt hàng...</span>
              </>
            ) : (
              <span>TIẾN HÀNH ĐẶT CỌC & THANH TOÁN (PAYOS)</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
