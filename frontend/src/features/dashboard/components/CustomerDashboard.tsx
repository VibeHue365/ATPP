import React, { useState, useEffect } from 'react';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { CreditCard, Star, AlertTriangle, ShieldCheck } from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
  const toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'bookings' | 'payments' | 'reviews'>('bookings');
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Review modal states
  const [reviewingItem, setReviewingItem] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const bRes: any = await httpClient.get('/bookings/my');
      setBookings(bRes);

      const pRes: any = await httpClient.get('/payments/history');
      setPayments(pRes);
    } catch (err: any) {
      toast.error('Không thể tải dữ liệu tài khoản');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingItem) return;

    try {
      await httpClient.post('/reviews', {
        bookingId: reviewingItem.bookingId,
        bookingItemId: reviewingItem.itemId,
        rating,
        comment,
        productId: reviewingItem.productId || undefined,
        photographyPackageId: reviewingItem.photographyPackageId || undefined,
      });

      toast.success('Gửi đánh giá dịch vụ thành công!');
      setReviewingItem(null);
      setComment('');
      setRating(5);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Gửi đánh giá thất bại');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PENDING_PAYMENT': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'DEPOSIT_PAID': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-stone-100 text-stone-600 border-stone-200';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Sub tabs */}
      <div className="flex border-b border-stone-200/80 bg-white p-1 rounded-xl max-w-md shadow-sm">
        <button
          onClick={() => setActiveSubTab('bookings')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            activeSubTab === 'bookings' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'
          }`}
        >
          Lịch hẹn & Thuê đồ
        </button>
        <button
          onClick={() => setActiveSubTab('payments')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            activeSubTab === 'payments' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'
          }`}
        >
          Lịch sử giao dịch
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-3 border-stone-300 border-t-stone-900 rounded-full animate-spin"></span>
        </div>
      ) : (
        <div className="animate-fade-in">
          {/* Sub Tab: Bookings */}
          {activeSubTab === 'bookings' && (
            <div className="flex flex-col gap-4">
              {bookings.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-stone-200/80 text-stone-500">
                  Bạn chưa có lịch hẹn hay đơn thuê áo dài nào.
                </div>
              ) : (
                bookings.map((booking) => (
                  <div key={booking._id} className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-stone-50 border-b border-stone-100 flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <strong className="text-sm font-header text-stone-900 font-bold">{booking.bookingCode}</strong>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(booking.status)}`}>
                          {booking.status}
                        </span>
                      </div>
                      <span className="text-xs text-stone-400 font-medium">Đặt ngày: {new Date(booking.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>

                    <div className="p-6 flex flex-col gap-4">
                      {booking.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center border-b border-stone-100 pb-3 last:border-0 last:pb-0">
                          <div>
                            <h5 className="font-header text-sm font-bold text-stone-900">
                              {item.productId ? 'Mẫu Áo Dài Di Sản' : 'Gói Chụp Ảnh Cổ Phong'}
                            </h5>
                            <p className="text-stone-500 text-xs mt-1">Đơn giá: {item.unitPrice.toLocaleString()}đ x {item.quantity}</p>
                          </div>
                          <div className="flex gap-2">
                            {booking.status === 'COMPLETED' && (
                              <button
                                onClick={() => setReviewingItem({
                                  bookingId: booking._id,
                                  itemId: item._id,
                                  productId: item.productId,
                                  photographyPackageId: item.photographyPackageId,
                                })}
                                className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
                              >
                                <Star size={12} fill="currentColor" />
                                <span>Đánh giá</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="px-6 py-3 bg-stone-50 border-t border-stone-100 flex justify-between items-center">
                      <div className="text-xs text-stone-500 font-medium">
                        Tổng tiền: <strong className="text-stone-900 text-sm">{booking.pricingSummary.grandTotal.toLocaleString()}đ</strong>
                      </div>
                      {booking.status === 'PENDING_PAYMENT' && (
                        <button
                          onClick={async () => {
                            try {
                              const payRes: any = await httpClient.post('/payments/create-link', {
                                bookingId: booking._id,
                                purpose: 'DEPOSIT_PAYMENT',
                              });
                              window.location.href = payRes.payos.checkoutUrl;
                            } catch (err: any) {
                              toast.error('Không thể tạo cổng thanh toán');
                            }
                          }}
                          className="px-4 py-2 bg-[#a11e22] hover:bg-[#801418] text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
                        >
                          <CreditCard size={12} />
                          <span>Đặt cọc ngay (20%)</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub Tab: Payments */}
          {activeSubTab === 'payments' && (
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-600 border-b border-stone-200/80 text-xs font-bold">
                    <th className="px-6 py-4">MÃ GIAO DỊCH</th>
                    <th className="px-6 py-4">DỊCH VỤ</th>
                    <th className="px-6 py-4">SỐ TIỀN</th>
                    <th className="px-6 py-4">PHƯƠNG THỨC</th>
                    <th className="px-6 py-4">TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-stone-500">
                        Chưa có lịch sử giao dịch nào được ghi nhận.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p._id}>
                        <td className="px-6 py-4 font-bold text-stone-900">{p.paymentCode}</td>
                        <td className="px-6 py-4 text-xs text-stone-500">
                          {p.purpose === 'DEPOSIT_PAYMENT' ? 'Đặt cọc dịch vụ' : 'Thanh toán toàn bộ'}
                        </td>
                        <td className="px-6 py-4 font-extrabold text-stone-950">{p.amount.toLocaleString()}đ</td>
                        <td className="px-6 py-4 text-xs text-stone-500">{p.paymentMethod}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            p.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {p.status === 'SUCCESS' ? <ShieldCheck size={10} /> : <AlertTriangle size={10} />}
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Review Modal popup */}
      {reviewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleCreateReview} className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-up-fade">
            <div className="px-6 py-4 bg-stone-900 text-white flex justify-between items-center">
              <h4 className="font-header text-sm font-bold">Viết đánh giá dịch vụ</h4>
              <button type="button" onClick={() => setReviewingItem(null)} className="text-stone-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2 items-center">
                <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">Chọn số sao đánh giá</span>
                <div className="flex gap-2.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="text-amber-500 hover:scale-110 transition"
                    >
                      <Star size={32} fill={star <= rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-stone-700 font-bold uppercase">Nội dung nhận xét</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900 placeholder:text-stone-400"
                  rows={4}
                  placeholder="Chia sẻ trải nghiệm của bạn về phom dáng áo dài hoặc tác phong chụp ảnh..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs tracking-wider rounded-xl transition"
              >
                GỬI ĐÁNH GIÁ NGAY
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default CustomerDashboard;
