import React, { useState, useEffect } from 'react';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import {
  Camera, Calendar, Tag, MessageSquare,
  Users, Trash2, Award, Save, Plus, Star, Flag
} from 'lucide-react';

export const ProviderDashboard: React.FC = () => {
  const toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'portfolio' | 'calendar' | 'vouchers' | 'reviews' | 'trust'>('profile');
  const [provider, setProvider] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [reviewsData, setReviewsData] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form states - Profile
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');

  // Form states - Voucher
  const [vCode, setVCode] = useState('');
  const [vName, setVName] = useState('');
  const [vType, setVType] = useState('PERCENTAGE');
  const [vValue, setVValue] = useState(10);
  const vMinOrder = 0;

  // Form states - Calendar
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(0);
  const [startHour, setStartHour] = useState('08:00');
  const [endHour, setEndHour] = useState('17:00');
  const [blockedDate, setBlockedDate] = useState('');

  // Reply states
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Two-way rating state
  const [ratingBooking, setRatingBooking] = useState<any>(null);
  const [cRating, setCRating] = useState(5);
  const [cComment, setCComment] = useState('');

  // Trust search score
  const [searchCustId, setSearchCustId] = useState('');
  const [trustScoreResult, setTrustScoreResult] = useState<any>(null);

  const fetchProviderData = async () => {
    setIsLoading(true);
    try {
      const pRes: any = await httpClient.get('/providers/me');
      setProvider(pRes);
      setBusinessName(pRes.businessName || '');
      setPhone(pRes.contact?.phone || '');
      setAddressLine(pRes.address?.addressLine || '');
      setCity(pRes.address?.city || '');
      setCancellationPolicy(pRes.policies?.cancellationPolicy || '');

      const sRes: any = await httpClient.get('/providers/me/schedules');
      setSchedules(sRes);

      const vRes: any = await httpClient.get('/promotions/provider');
      setVouchers(vRes);

      const rRes: any = await httpClient.get('/reviews/stats');
      setReviewsData(rRes);

      const bRes: any = await httpClient.get('/bookings/provider');
      setBookings(bRes);
    } catch (err: any) {
      toast.error('Không thể đồng bộ dữ liệu đối tác');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderData();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await httpClient.patch('/providers/me', {
        businessName,
        contact: { ...provider.contact, phone },
        address: { ...provider.address, addressLine, city },
        policies: { ...provider.policies, cancellationPolicy },
      });
      toast.success('Cập nhật thông tin dịch vụ thành công!');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Cập nhật thất bại');
    }
  };

  const handleAddVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await httpClient.post('/promotions', {
        code: vCode,
        name: vName,
        discountType: vType,
        discountValue: Number(vValue),
        minOrderValue: Number(vMinOrder),
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), // 30 days expiry
      });
      toast.success(`Tạo mã ưu đãi "${vCode}" thành công!`);
      setVCode('');
      setVName('');
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Không thể tạo voucher');
    }
  };

  const handleDeleteVoucher = async (id: string) => {
    try {
      await httpClient.delete(`/promotions/${id}`);
      toast.success('Đã xóa mã ưu đãi thành công!');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Xóa voucher thất bại');
    }
  };

  const handleAddRecurringSchedule = async () => {
    try {
      await httpClient.post('/providers/me/schedules/recurring', {
        dayOfWeek: Number(selectedDayOfWeek),
        workingHours: [{ start: startHour, end: endHour }],
      });
      toast.success('Thiết lập khung giờ làm việc recurring thành công!');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Lưu lịch làm việc thất bại');
    }
  };

  const handleBlockDate = async () => {
    if (!blockedDate) return;
    try {
      await httpClient.post('/providers/me/schedules/specific-date', {
        date: blockedDate,
        isOffDay: true,
        customSlots: [],
      });
      toast.success(`Đã chặn lịch bận ngày ${blockedDate}!`);
      setBlockedDate('');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Không thể chặn lịch ngày bận');
    }
  };

  const handleAddPortfolio = async () => {
    // Generate simulated stock portfolio image
    const imagesList = ['/phuong_hoang.png', '/tuyet_mai.png', '/lam_ngoc.png'];
    const randomImg = imagesList[Math.floor(Math.random() * imagesList.length)];
    try {
      await httpClient.post('/providers/me/portfolio', { imageUrl: randomImg });
      toast.success('Đã tải ảnh mẫu thiết kế mới lên Portfolio!');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Tải ảnh portfolio thất bại');
    }
  };

  const handleRemovePortfolio = async (imgUrl: string) => {
    try {
      await httpClient.delete(`/providers/me/portfolio?imageUrl=${encodeURIComponent(imgUrl)}`);
      toast.success('Đã gỡ ảnh khỏi Portfolio');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Gỡ ảnh thất bại');
    }
  };

  const handleReplyReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingReviewId) return;
    try {
      await httpClient.post(`/reviews/${replyingReviewId}/reply`, { reply: replyText });
      toast.success('Gửi phản hồi đánh giá thành công!');
      setReplyingReviewId(null);
      setReplyText('');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Không thể gửi phản hồi');
    }
  };

  const handleReportReview = async (reviewId: string) => {
    try {
      await httpClient.post(`/reviews/${reviewId}/report`, { reason: 'Spam, ngôn từ không phù hợp' });
      toast.success('Đã gửi báo cáo vi phạm nội dung lên hệ thống admin!');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Báo cáo review thất bại');
    }
  };

  const handleRateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingBooking) return;
    try {
      await httpClient.post('/reviews/customer', {
        bookingId: ratingBooking.bookingId,
        rating: cRating,
        comment: cComment,
      });
      toast.success('Đã gửi đánh giá tín nhiệm khách hàng thành công!');
      setRatingBooking(null);
      setCComment('');
      setCRating(5);
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Đánh giá khách hàng thất bại');
    }
  };

  const handleSearchTrustScore = async () => {
    if (!searchCustId) return;
    try {
      const res: any = await httpClient.get(`/reviews/customer/${searchCustId}/trust`);
      setTrustScoreResult(res);
      toast.success('Đồng bộ tín nhiệm khách hàng hoàn tất!');
    } catch (err: any) {
      toast.error('Không thể tìm thấy khách hàng này');
      setTrustScoreResult(null);
    }
  };

  const daysOfWeekVn = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Sidebar Nav */}
      <aside className="flex flex-col gap-1 bg-white p-3 rounded-2xl border border-stone-200/80 shadow-sm h-fit">
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left transition flex items-center gap-2 ${
            activeSubTab === 'profile' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'
          }`}
        >
          <Award size={14} />
          <span>Thông tin dịch vụ (UC-B06)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('portfolio')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left transition flex items-center gap-2 ${
            activeSubTab === 'portfolio' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'
          }`}
        >
          <Camera size={14} />
          <span>Quản lý portfolio (UC-B08)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('calendar')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left transition flex items-center gap-2 ${
            activeSubTab === 'calendar' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'
          }`}
        >
          <Calendar size={14} />
          <span>Lịch làm việc & Chặn (UC-F01)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('vouchers')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left transition flex items-center gap-2 ${
            activeSubTab === 'vouchers' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'
          }`}
        >
          <Tag size={14} />
          <span>Tạo mã giảm giá (UC-P01)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('reviews')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left transition flex items-center gap-2 ${
            activeSubTab === 'reviews' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'
          }`}
        >
          <MessageSquare size={14} />
          <span>Đánh giá & Phản hồi (UC-H04/05/03)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('trust')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left transition flex items-center gap-2 ${
            activeSubTab === 'trust' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'
          }`}
        >
          <Users size={14} />
          <span>Đánh giá khách hàng (UC-H06/B05)</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="md:col-span-3 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm animate-fade-in">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-3 border-stone-300 border-t-stone-900 rounded-full animate-spin"></span>
          </div>
        ) : (
          <>
            {/* Tab: Profile Business Details */}
            {activeSubTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
                <h3 className="font-header text-sm font-bold text-stone-900 uppercase tracking-wide">Cập nhật thông tin kinh doanh</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-stone-500 uppercase">TÊN THƯƠNG HIỆU / CỬA HÀNG</label>
                    <input
                      type="text"
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-stone-500 uppercase">SỐ ĐIỆN THOẠI LIÊN HỆ</label>
                    <input
                      type="text"
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-stone-500 uppercase">ĐỊA CHỈ SHOWROOM / ĐỊA ĐIỂM CHỤP</label>
                    <input
                      type="text"
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-stone-500 uppercase">THÀNH PHỐ</label>
                    <input
                      type="text"
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase">CHÍNH SÁCH HỦY DỊCH VỤ / HOÀN CỌC</label>
                    <textarea
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                      rows={3}
                      value={cancellationPolicy}
                      onChange={(e) => setCancellationPolicy(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold w-fit mt-2 flex items-center gap-1.5 transition shadow-sm"
                >
                  <Save size={14} />
                  <span>Lưu thay đổi</span>
                </button>
              </form>
            )}

            {/* Tab: Portfolio */}
            {activeSubTab === 'portfolio' && (
              <div className="flex flex-col gap-5">
                <div className="flex justify-between items-center">
                  <h3 className="font-header text-sm font-bold text-stone-900 uppercase tracking-wide">Kho ảnh thiết kế Portfolio</h3>
                  <button
                    onClick={handleAddPortfolio}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-sm"
                  >
                    <Plus size={14} />
                    <span>Thêm tác phẩm</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {provider?.media?.images?.map((img: string, idx: number) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-stone-100">
                      <img src={img} alt="portfolio item" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleRemovePortfolio(img)}
                          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition"
                          title="Xóa ảnh"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Calendar Schedule */}
            {activeSubTab === 'calendar' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="font-header text-sm font-bold text-stone-900 uppercase tracking-wide">Thiết lập khung giờ làm việc hàng tuần</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
                    <select
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                      value={selectedDayOfWeek}
                      onChange={(e) => setSelectedDayOfWeek(Number(e.target.value))}
                    >
                      {daysOfWeekVn.map((day, idx) => (
                        <option key={idx} value={idx}>{day}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      placeholder="Bắt đầu, ví dụ: 08:00"
                    />
                    <input
                      type="text"
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                      placeholder="Kết thúc, ví dụ: 17:00"
                    />
                    <button
                      onClick={handleAddRecurringSchedule}
                      className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition"
                    >
                      Lưu khung giờ
                    </button>
                  </div>
                </div>

                <div className="h-px bg-stone-200" />

                <div>
                  <h3 className="font-header text-sm font-bold text-stone-900 uppercase tracking-wide">Chặn lịch nghỉ / lịch bận đột xuất</h3>
                  <div className="flex gap-3 mt-3">
                    <input
                      type="date"
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none"
                      value={blockedDate}
                      onChange={(e) => setBlockedDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <button
                      onClick={handleBlockDate}
                      className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl transition shadow-sm"
                    >
                      Chặn lịch ngay
                    </button>
                  </div>
                </div>

                <div className="h-px bg-stone-200" />

                <div>
                  <h3 className="font-header text-sm font-bold text-stone-900 uppercase tracking-wide">Lịch làm việc đã lưu</h3>
                  <div className="flex flex-col gap-2 mt-3">
                    {schedules.map((sch) => (
                      <div key={sch._id} className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100 text-sm">
                        <span className="font-bold text-stone-900">
                          {sch.scheduleType === 'RECURRING'
                            ? `Khung giờ ${daysOfWeekVn[sch.dayOfWeek]}`
                            : `Chặn nghỉ ngày ${new Date(sch.specificDate).toLocaleDateString('vi-VN')}`}
                        </span>
                        <span className="text-stone-600 text-xs">
                          {sch.scheduleType === 'RECURRING'
                            ? sch.workingHours.map((h: any) => `${h.start} - ${h.end}`).join(', ')
                            : 'CHẶN NGHỈ CẢ NGÀY'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Vouchers */}
            {activeSubTab === 'vouchers' && (
              <div className="flex flex-col gap-6">
                <form onSubmit={handleAddVoucher} className="flex flex-col gap-4">
                  <h3 className="font-header text-sm font-bold text-stone-900 uppercase tracking-wide">Tự tạo mã ưu đãi / Vouchers</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-stone-500 uppercase">MÃ CODE (IN HOA)</label>
                      <input
                        type="text"
                        className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none"
                        placeholder="VÍ DỤ: KHAIPHONG10"
                        value={vCode}
                        onChange={(e) => setVCode(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-stone-500 uppercase">TÊN CHƯƠNG TRÌNH</label>
                      <input
                        type="text"
                        className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none"
                        value={vName}
                        onChange={(e) => setVName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-stone-500 uppercase">LOẠI GIẢM GIÁ</label>
                      <select
                        className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none"
                        value={vType}
                        onChange={(e) => setVType(e.target.value)}
                      >
                        <option value="PERCENTAGE">Phần trăm (%)</option>
                        <option value="FIXED_AMOUNT">Giá trị cố định (đ)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-stone-500 uppercase">GIÁ TRỊ GIẢM GIA</label>
                      <input
                        type="number"
                        className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none"
                        value={vValue}
                        onChange={(e) => setVValue(Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold w-fit mt-2 transition shadow-sm"
                  >
                    Tạo Voucher
                  </button>
                </form>

                <div className="h-px bg-stone-200" />

                <div>
                  <h3 className="font-header text-sm font-bold text-stone-900 uppercase tracking-wide">Vouchers đang hoạt động</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    {vouchers.map((v) => (
                      <div key={v._id} className="p-4 rounded-xl border border-stone-200 bg-stone-50 flex justify-between items-center">
                        <div>
                          <span className="px-2 py-0.5 bg-stone-900 text-white rounded font-bold text-xs tracking-wider uppercase">{v.code}</span>
                          <h5 className="font-header text-sm font-bold text-stone-900 mt-2">{v.name}</h5>
                          <p className="text-stone-500 text-xs mt-1">
                            Giảm {v.discountValue.toLocaleString()}{v.discountType === 'PERCENTAGE' ? '%' : 'đ'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteVoucher(v._id)}
                          className="p-2 text-stone-400 hover:text-red-600 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Reviews and replies */}
            {activeSubTab === 'reviews' && (
              <div className="flex flex-col gap-6">
                {/* Stats summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Rating trung bình</span>
                    <strong className="text-3xl font-header font-bold text-stone-900 mt-1">{reviewsData?.averageRating || 0}</strong>
                    <div className="flex gap-0.5 text-amber-500 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={12} fill={s <= Math.round(reviewsData?.averageRating || 0) ? 'currentColor' : 'none'} />
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tổng số lượt đánh giá</span>
                    <strong className="text-3xl font-header font-bold text-stone-900 mt-1">{reviewsData?.totalReviews || 0}</strong>
                  </div>
                </div>

                <div className="h-px bg-stone-200" />

                <div className="flex flex-col gap-4">
                  <h3 className="font-header text-sm font-bold text-stone-900 uppercase tracking-wide">Danh sách nhận xét của khách</h3>
                  {reviewsData?.reviews?.length === 0 ? (
                    <p className="text-center py-6 text-stone-500">Chưa có đánh giá nào.</p>
                  ) : (
                    reviewsData?.reviews?.map((r: any) => (
                      <div key={r._id} className="p-4 rounded-xl border border-stone-200 bg-white flex flex-col gap-3">
                        <div className="flex justify-between items-start flex-wrap gap-2">
                          <div>
                            <div className="flex gap-0.5 text-amber-500">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} size={10} fill={s <= r.rating ? 'currentColor' : 'none'} />
                              ))}
                            </div>
                            <p className="text-stone-800 text-sm mt-1.5">{r.comment}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReportReview(r._id)}
                              className="px-2.5 py-1 bg-stone-100 hover:bg-red-50 text-stone-500 hover:text-red-700 text-[10px] font-bold rounded-lg border border-stone-200/50 transition flex items-center gap-1"
                            >
                              <Flag size={10} />
                              <span>Báo cáo Spam (UC-H03)</span>
                            </button>
                            <button
                              onClick={() => setReplyingReviewId(r._id)}
                              className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white text-[10px] font-bold rounded-lg transition"
                            >
                              Phản hồi
                            </button>
                          </div>
                        </div>

                        {/* Reply content if already has one */}
                        {r.reply && (
                          <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-600 leading-relaxed pl-4 border-l-3 border-l-stone-400">
                            <strong>Phản hồi của đối tác:</strong> {r.reply}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab: Two-way Review & Trust Checks */}
            {activeSubTab === 'trust' && (
              <div className="flex flex-col gap-6">
                {/* Search customer trust score */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-stone-50 border border-stone-100">
                  <h3 className="font-header text-xs font-bold text-stone-900 uppercase">Tra cứu điểm uy tín khách hàng (UC-B05)</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white placeholder:text-stone-400 focus:outline-none"
                      placeholder="Nhập mã ID khách hàng..."
                      value={searchCustId}
                      onChange={(e) => setSearchCustId(e.target.value)}
                    />
                    <button
                      onClick={handleSearchTrustScore}
                      className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition"
                    >
                      Tra cứu
                    </button>
                  </div>
                  {trustScoreResult && (
                    <div className="mt-3 p-4 bg-white border border-stone-200 rounded-xl flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-bold text-stone-400 uppercase tracking-wider">ĐIỂM TÍN NHIỆM TRUNG BÌNH</h5>
                        <strong className="text-2xl font-header font-bold text-[#a11e22] mt-1 inline-block">
                          {trustScoreResult.averageRating} / 5.0
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-stone-500">Dựa trên {trustScoreResult.totalReviews} lượt đánh giá từ các shop</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-stone-200" />

                {/* Rating customers list */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-header text-sm font-bold text-stone-900 uppercase tracking-wide">Đánh giá hành vi khách hàng sau sự kiện</h3>
                  {bookings.map((booking) => (
                    <div key={booking._id} className="p-4 rounded-xl border border-stone-200 bg-white flex justify-between items-center text-sm">
                      <div>
                        <span className="font-bold text-stone-900">{booking.bookingCode}</span>
                        <p className="text-stone-500 text-xs mt-1">Mã khách hàng: {booking.customerId}</p>
                      </div>
                      <button
                        onClick={() => setRatingBooking({ bookingId: booking._id, customerId: booking.customerId })}
                        className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition"
                      >
                        Đánh giá khách
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Review reply modal popup */}
      {replyingReviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleReplyReview} className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-stone-900 text-white flex justify-between items-center">
              <h4 className="font-header text-sm font-bold">Phản hồi khách hàng</h4>
              <button type="button" onClick={() => setReplyingReviewId(null)} className="text-stone-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900 placeholder:text-stone-400"
                rows={4}
                placeholder="Viết phản hồi trả lời nhận xét..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                required
              />
              <button
                type="submit"
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs tracking-wider rounded-xl transition animate-pulse"
              >
                GỬI PHẢN HỒI
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rate customer modal popup */}
      {ratingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleRateCustomer} className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-stone-900 text-white flex justify-between items-center">
              <h4 className="font-header text-sm font-bold">Đánh giá khách hàng (Two-way Review)</h4>
              <button type="button" onClick={() => setRatingBooking(null)} className="text-stone-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2 items-center">
                <span className="text-xs text-stone-500 font-bold uppercase">Mức độ tín nhiệm hành vi</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setCRating(star)}
                      className="text-[#a11e22]"
                    >
                      <Star size={24} fill={star <= cRating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900 placeholder:text-stone-400"
                rows={3}
                placeholder="Ghi nhận xét về khách hàng (trả đúng giờ, giữ đồ sạch sẽ)..."
                value={cComment}
                onChange={(e) => setCComment(e.target.value)}
              />
              <button
                type="submit"
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs tracking-wider rounded-xl transition"
              >
                XÁC NHẬN ĐÁNH GIÁ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default ProviderDashboard;
