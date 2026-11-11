import React, { useState } from 'react';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { Calendar, Tag, ShieldCheck, CreditCard, X } from 'lucide-react';
import { CONTRACTS_V2_ENABLED, CONTRACTS_TIERED_ENABLED } from '../../../config/features';
import { translateError } from '../../../utils/errorTranslator';
import { contractService, type ContractDetail } from '../../../services/contractService';
import { ContractReviewModal } from '../../../components/contracts/ContractReviewModal';
import { ContractQuickConsentCard } from '../../../components/contracts/ContractQuickConsentCard';

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
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [pendingBookingCode, setPendingBookingCode] = useState<string | null>(null);
  const [quickContract, setQuickContract] = useState<ContractDetail | null>(null);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);

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

      // Early Contract Eligibility Check (BEFORE creating booking or holding inventory)
      if (CONTRACTS_V2_ENABLED && bookingType === 'AODAI_RENTAL') {
        try {
          if (typeof contractService.checkEligibility === 'function') {
            const eligRes = await contractService.checkEligibility([{ productId: item.id }]);
            if (!eligRes.eligible && eligRes.ineligibleItems.length > 0) {
              const firstFail = eligRes.ineligibleItems[0];
              toast.error(firstFail.message);
              setIsLoading(false);
              return;
            }
          }
        } catch (eligErr: any) {
          console.warn('Early contract eligibility check warning:', eligErr);
          toast.error(translateError(eligErr?.message) || 'Không thể kiểm tra điều kiện hợp đồng');
          setIsLoading(false);
          return;
        }
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
      toast.info('Đơn đã được giữ tạm thời.');

      // If booking was explicitly marked as legacy (null), skip contracts completely
      const isLegacyBooking = bookingRes?.contractFlowVersion === null;

      if (CONTRACTS_V2_ENABLED && !isLegacyBooking) {
        try {
          const readiness = await contractService.getBookingReadiness(bookingRes._id);
          if (readiness.requirement === 'REQUIRED' && !readiness.ready) {
            setPendingBookingId(bookingRes._id);
            setPendingBookingCode(bookingRes.bookingCode || null);

            if (
              CONTRACTS_TIERED_ENABLED &&
              readiness.presentationMode === 'QUICK' &&
              readiness.providers?.[0]?.contractId
            ) {
              try {
                const detail = await contractService.getContractDetail(
                  readiness.providers[0].contractId,
                );
                setQuickContract(detail);
                setIsLoading(false);
                return;
              } catch (detailErr) {
                console.warn('Failed to load quick contract detail, fallback to modal:', detailErr);
              }
            }

            setIsContractModalOpen(true);
            setIsLoading(false);
            return;
          }
        } catch (readinessErr: any) {
          toast.error(translateError(readinessErr?.message) || 'Không thể kiểm tra trạng thái hợp đồng điện tử');
          setIsLoading(false);
          return;
        }
      }

      await proceedToPayment(bookingRes._id);
    } catch (err: any) {
      const errMsg = err?.message || err?.response?.data?.message || '';
      if (errMsg.includes('MIXED_CONTRACT_FLOW_UNSUPPORTED')) {
        toast.error(
          'Đơn hàng không thể kết hợp giữa Shop truyền thống và Shop áp dụng Hợp đồng điện tử. Quý khách vui lòng đặt hàng riêng cho từng Shop.',
        );
      } else if (errMsg.includes('PROVIDER_CONTRACT_SUSPENDED')) {
        toast.error(
          'Shop đang tạm ngưng nhận đơn thuê do cần cập nhật lại quy chế sàn giao dịch điện tử. Vui lòng liên hệ Shop.',
        );
      } else {
        toast.error(translateError(errMsg) || 'Thao tác đặt hàng thất bại');
      }
      setIsLoading(false);
    }
  };

  const proceedToPayment = async (targetBookingId: string) => {
    setIsLoading(true);
    try {
      const paymentRes: any = await httpClient.post('/payments/create-link', {
        bookingId: targetBookingId,
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
              src={item.images?.[0] || item.image || '/cuc_hoa_mi.webp'}
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

          {/* Quick Consent Card (INLINE) when presentationMode === 'QUICK' */}
          {quickContract && pendingBookingId && (
            <div className="mt-2" data-testid="inline-quick-consent-section">
              <ContractQuickConsentCard
                contract={quickContract}
                bookingId={pendingBookingId}
                bookingCode={pendingBookingCode || undefined}
                onConsented={() => {
                  const bId = pendingBookingId;
                  setQuickContract(null);
                  void proceedToPayment(bId);
                }}
                onRefreshed={(updatedContract, readiness) => {
                  if (
                    updatedContract.presentationMode === 'DETAILED' ||
                    readiness.presentationMode === 'DETAILED'
                  ) {
                    setQuickContract(null);
                    setIsContractModalOpen(true);
                  } else {
                    setQuickContract(updatedContract);
                  }
                }}
                onModeSwitchToDetailed={() => {
                  setQuickContract(null);
                  setIsContractModalOpen(true);
                }}
              />
            </div>
          )}

          {/* Confirm Button */}
          {!quickContract && (
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
          )}
        </div>
      </div>

      {CONTRACTS_V2_ENABLED && pendingBookingId && (
        <ContractReviewModal
          isOpen={isContractModalOpen}
          bookingId={pendingBookingId}
          onClose={() => {
            setIsContractModalOpen(false);
            setPendingBookingId(null);
          }}
          onAllAccepted={() => {
            const bId = pendingBookingId;
            setIsContractModalOpen(false);
            setPendingBookingId(null);
            if (bId) {
              void proceedToPayment(bId);
            }
          }}
        />
      )}
    </div>
  );
};
