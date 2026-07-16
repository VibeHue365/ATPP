import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { Calendar, MapPin, User, History, Plus, Heart, Star, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { BookingDetailModal } from '../../../components/common/BookingDetailModal';

interface CustomerDashboardProps {
  user: any;
  bookings: any[];
  onViewDetails: (booking: any) => void;
  onRefresh: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  user,
  bookings,
  onViewDetails,
  onRefresh
}) => {
  const toast = useToast();
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'appointments' | 'rentals' | 'favorites' | 'payments'>('appointments');
  const [favoriteSubTab, setFavoriteSubTab] = useState<'aodai' | 'photographer'>('aodai');
  const [payments, setPayments] = useState<any[]>([]);
  const [realProductList, setRealProductList] = useState<any[]>([]);
  const [realPhotographersList, setRealPhotographersList] = useState<any[]>([]);

  const [reviewingItem, setReviewingItem] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const handleContinuePayment = async (bookingId: string) => {
    try {
      toast.info('Đang tải liên kết thanh toán...');
      const paymentRes: any = await httpClient.post('/payments/create-link', {
        bookingId,
        purpose: 'FULL_PAYMENT',
      });
      if (paymentRes.payos && paymentRes.payos.checkoutUrl) {
        toast.success('Đang chuyển hướng tới cổng thanh toán PayOS Simulator...');
        setTimeout(() => {
          window.location.href = paymentRes.payos.checkoutUrl;
        }, 1200);
      } else {
        toast.error('Không tìm thấy liên kết thanh toán cho đơn hàng này.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi kết nối đến cổng thanh toán.');
    }
  };

  const fetchPayments = async () => {
    try {
      const pRes: any = await httpClient.get('/payments/history');
      setPayments(pRes || []);
    } catch (err: any) {
      console.error('Không thể tải lịch sử thanh toán:', err);
    }
  };

  const fetchRealDataForFavorites = async () => {
    try {
      const prods = await httpClient.get<any[]>('/products');
      setRealProductList(prods || []);
    } catch (e) {
      console.error('Failed to fetch products for dashboard favorites', e);
    }
    try {
      const phs = await httpClient.get<any[]>('/api/photographers');
      setRealPhotographersList(phs || []);
    } catch (e) {
      console.error('Failed to fetch photographers for dashboard favorites', e);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchRealDataForFavorites();
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
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Gửi đánh giá thất bại');
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Chưa xác định';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // --- 1. APPOINTMENTS (Lịch hẹn của tôi) ---
  const realAppointments = bookings.filter(b => 
    b.items?.some((item: any) => item.itemType === 'PHOTOGRAPHY_PACKAGE')
  ).map(b => {
    const photoItem = b.items.find((item: any) => item.itemType === 'PHOTOGRAPHY_PACKAGE');
    const isPast = ['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(b.status);
    return {
      id: b._id,
      isReal: true,
      booking: b,
      statusType: isPast ? 'PAST' : 'UPCOMING',
      dateStr: photoItem?.shootDate ? formatDate(photoItem.shootDate) : '',
      title: photoItem?.name || 'Gói Chụp Ảnh Cổ Phong',
      detailText: photoItem?.photographerName ? `Thợ ảnh: ${photoItem.photographerName}` : 'Showroom Nam Kỳ Khởi Nghĩa, Q.1',
      detailType: photoItem?.photographerName ? 'USER' : 'LOCATION',
      timeStr: photoItem?.shootTimeSlot || '09:00 - 11:00',
      statusLabel: b.status === 'COMPLETED' ? 'Hoàn thành' : b.status === 'CANCELLED' ? 'Đã hủy' : 'Sắp tới'
    };
  });

  const displayAppointments = realAppointments;

  // --- 2. RENTED AO DAI (Áo dài đã thuê) ---
  const rentalItems: any[] = [];
  bookings.forEach(b => {
    if (b.items) {
      b.items.forEach((item: any) => {
        if (item.itemType === 'PRODUCT') {
          rentalItems.push({
            id: item._id,
            bookingId: b._id,
            bookingCode: b.bookingCode,
            status: b.status,
            name: item.name || 'Mẫu Áo Dài Di Sản',
            image: item.image || item.productImage || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
            size: item.size || 'M',
            color: item.color || 'RED',
            rentalType: item.rentalType || 'DAILY',
            startDate: item.startDate || item.rentalFrom,
            endDate: item.endDate || item.rentalTo,
            startTime: item.startTime,
            endTime: item.endTime,
            unitPrice: item.unitPrice,
            quantity: item.quantity || 1,
            depositAmount: item.depositAmount || 0,
            booking: b
          });
        }
      });
    }
  });

  const displayRentals = rentalItems;

  // --- 3. FAVORITES (Danh sách yêu thích) ---
  const realFavorites = React.useMemo(() => {
    if (!user?.favorites || !Array.isArray(user.favorites)) return [];
    
    const list: any[] = [];
    user.favorites.forEach((fav: any) => {
      const targetId = fav.targetId?.toString() || fav.targetId;
      if (fav.targetType === 'PRODUCT' || fav.targetType === 'Product') {
        const prod = realProductList.find(p => p._id === targetId);
        if (prod) {
          list.push({
            id: prod._id,
            itemType: 'PRODUCT',
            name: prod.name,
            image: prod.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
            price: prod.basePrice,
            material: prod.materials?.[0] || 'Lụa truyền thống',
            link: `/rentals/${prod._id}`
          });
        }
      } else if (fav.targetType === 'PROVIDER' || fav.targetType === 'Provider' || fav.targetType === 'PHOTOGRAPHER' || fav.targetType === 'Photographer') {
        const photo = realPhotographersList.find(p => {
          const pid = p._id?.toString() || p._id;
          const provId = p.providerId?.toString() || p.providerId;
          return pid === targetId || provId === targetId;
        });
        if (photo) {
          list.push({
            id: photo._id,
            itemType: 'PHOTOGRAPHY_PACKAGE',
            name: photo.businessName || photo.name,
            image: photo.portfolio?.[0] || photo.image || '/avatar_hanna.png',
            price: photo.packages && photo.packages.length > 0 ? Math.min(...photo.packages.map((p: any) => p.price)) : 1500000,
            material: photo.quote || 'Nhiếp ảnh gia chuyên nghiệp',
            link: `/photographers`
          });
        }
      }
    });
    return list;
  }, [user?.favorites, realProductList, realPhotographersList]);

  const pendingBookings = (bookings || []).filter(
    (b) => b.status === 'PENDING_PAYMENT' || b.status === 'WAITING_PAYMENT'
  );

  const pendingIncidents = (bookings || []).filter(
    (b) => b.status === 'RETURN_PENDING'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      
      {/* Pending incident compensation notification section */}
      {pendingIncidents.length > 0 && (
        <div style={{
          backgroundColor: '#FDF2F2',
          border: '1px solid #FDE8E8',
          borderRadius: '16px',
          padding: '20px',
          fontFamily: 'Inter, sans-serif'
        }}>
          <h4 style={{ margin: 0, color: '#9B1C1C', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle size={18} style={{ color: '#E53E3E' }} />
            Yêu cầu đền bù hỏng đồ cần phản hồi ({pendingIncidents.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingIncidents.map((b) => {
              return (
                <div key={b._id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  border: '1px solid #FEE2E2',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1F2937' }}>Mã đơn: {b.bookingCode}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#E53E3E', backgroundColor: '#FEE2E2', padding: '2px 8px', borderRadius: '6px' }}>CHỜ XÁC NHẬN SỰ CỐ</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      Đơn hàng bị báo cáo gặp sự cố hỏng đồ. Vui lòng bấm vào chi tiết để xem hình ảnh bằng chứng và thực hiện Đồng ý đền bù hoặc Khiếu nại.
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => onViewDetails(b)}
                      style={{
                        padding: '8px 20px',
                        backgroundColor: '#C0392B',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#A93226'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#C0392B'}
                    >
                      Xem & Phản hồi
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending payments notification section */}
      {pendingBookings.length > 0 && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '16px',
          padding: '20px',
          fontFamily: 'Inter, sans-serif'
        }}>
          <h4 style={{ margin: 0, color: '#92400E', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Clock size={18} style={{ color: '#D97706' }} />
            Đơn hàng chờ cọc / thanh toán ({pendingBookings.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingBookings.map((b) => {
              const formattedDate = b.createdAt ? new Date(b.createdAt).toLocaleString('vi-VN') : 'Vừa xong';
              return (
                <div key={b._id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  border: '1px solid #F3F4F6',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1F2937' }}>Mã đơn: {b.bookingCode}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '6px' }}>CHỜ THANH TOÁN</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      Thời gian tạo: {formattedDate} • Tổng tiền: <strong style={{ color: '#8B1E22' }}>{(b.pricingSummary?.grandTotal || 0).toLocaleString('vi-VN')}đ</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => onViewDetails(b)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#F3F4F6',
                        color: '#4B5563',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#E5E7EB'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                    >
                      Chi tiết
                    </button>
                    <button
                      onClick={() => handleContinuePayment(b._id)}
                      style={{
                        padding: '8px 20px',
                        backgroundColor: '#8B1E22',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#72181B'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8B1E22'}
                    >
                      Tiếp tục thanh toán
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation tabs row */}
      <div className="vh-profile-tabs-navigation-row">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`vh-profile-navigation-tab-btn ${activeTab === 'appointments' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
        >
          Lịch hẹn của tôi
        </button>
        <button
          onClick={() => setActiveTab('rentals')}
          className={`vh-profile-navigation-tab-btn ${activeTab === 'rentals' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
        >
          Áo dài đã thuê
        </button>
        <button
          onClick={() => setActiveTab('favorites')}
          className={`vh-profile-navigation-tab-btn ${activeTab === 'favorites' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
        >
          Danh sách yêu thích
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`vh-profile-navigation-tab-btn ${activeTab === 'payments' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
        >
          Lịch sử thanh toán
        </button>
      </div>

      {/* Tab Panels */}
      <div className="vh-profile-tab-content-panel">
        
        {/* PANEL 1: APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="vh-profile-appointments-grid">
            {displayAppointments.length === 0 ? (
              <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8' }}>
                <Calendar size={32} style={{ color: '#8C827A', margin: '0 auto 12px' }} />
                <h5 className="font-header" style={{ fontSize: '16px', color: '#2D2926', marginBottom: '4px' }}>Chưa có lịch hẹn nào</h5>
                <p style={{ fontSize: '13px', color: '#8C827A' }}>Bạn chưa đặt lịch chụp ảnh nào với nhiếp ảnh gia.</p>
              </div>
            ) : (
              displayAppointments.map((app) => (
                <div 
                  key={app.id} 
                  className={`vh-profile-appointment-card ${app.statusType === 'UPCOMING' ? 'vh-appointment-upcoming' : 'vh-appointment-past'}`}
                >
                  <div className="vh-appointment-card-header">
                    {app.statusType === 'UPCOMING' ? (
                      <span className="vh-appointment-status-label-upcoming">
                        <Calendar size={13} style={{ marginRight: '6px' }} />
                        SẮP TỚI • {app.dateStr}
                      </span>
                    ) : (
                      <span className="vh-appointment-status-label-past">
                        <History size={13} style={{ marginRight: '6px' }} />
                        ĐÃ QUA • {app.dateStr}
                      </span>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="vh-appointment-card-title font-header">{app.title}</h4>
                    <div className="vh-appointment-card-detail-item">
                      {app.detailType === 'LOCATION' ? (
                        <MapPin size={14} className="vh-appointment-icon-muted" />
                      ) : (
                        <User size={14} className="vh-appointment-icon-muted" />
                      )}
                      <span>{app.detailText}</span>
                    </div>
                  </div>
                  
                  <div className="vh-appointment-card-footer">
                    {app.statusType === 'UPCOMING' ? (
                      <span className="vh-appointment-time-badge">{app.timeStr}</span>
                    ) : (
                      <span className="vh-appointment-status-success">{app.timeStr}</span>
                    )}
                    
                    {app.isReal ? (
                      <button 
                        className="vh-appointment-action-link"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        onClick={() => onViewDetails(app.booking)}
                      >
                        Chi tiết
                      </button>
                    ) : (
                      <span className="vh-appointment-action-link" style={{ cursor: 'pointer' }}>
                        {app.statusType === 'UPCOMING' ? 'Chi tiết' : 'Đặt lại'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Dashed placeholder card to book new appointment */}
            <button 
              onClick={() => navigate('/photographers')}
              className="vh-profile-appointment-card-dashed-btn"
              style={{ width: '100%', height: '100%', minHeight: '184px' }}
            >
              <div className="vh-appointment-dashed-circle" style={{ backgroundColor: '#FDE8E8', color: '#8B1E22' }}>
                <Plus size={20} />
              </div>
              <h5 className="vh-appointment-dashed-title font-header">Đặt lịch hẹn mới</h5>
              <p className="vh-appointment-dashed-desc">Trải nghiệm dịch vụ cá nhân hóa</p>
            </button>
          </div>
        )}

        {/* PANEL 2: RENTALS */}
        {activeTab === 'rentals' && (
          <div className="vh-profile-rentals-grid-layout">
            {displayRentals.length === 0 ? (
              <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', width: '100%' }}>
                <History size={32} style={{ color: '#8C827A', margin: '0 auto 12px' }} />
                <h5 className="font-header" style={{ fontSize: '16px', color: '#2D2926', marginBottom: '4px' }}>Chưa có trang phục nào được thuê</h5>
                <p style={{ fontSize: '13px', color: '#8C827A' }}>Hãy khám phá các bộ sưu tập áo dài của chúng tôi để bắt đầu thuê.</p>
              </div>
            ) : (
              displayRentals.map((item) => {
                const isReturned = item.status === 'RETURNED' || item.status === 'COMPLETED';
                const isIncidentPending = item.status === 'RETURN_PENDING';
                const isDisputed = item.status === 'DISPUTED';
                const rentalDateFormatted = item.rentalType === 'DAILY'
                  ? `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`
                  : `Ngày ${formatDate(item.startDate)} (${item.startTime} - ${item.endTime})`;

                return (
                  <div key={item.id} className="vh-profile-rental-product-card">
                    <div className="vh-profile-rental-img-wrapper" style={{ height: '280px' }}>
                      <img src={item.image} alt={item.name} className="vh-profile-rental-img" />
                      <span 
                        className={`vh-profile-rental-status-badge ${isReturned ? 'status-returned' : 'status-renting'}`}
                        style={{
                          backgroundColor: isIncidentPending ? '#FEF3C7' : isDisputed ? '#FEE2E2' : undefined,
                          color: isIncidentPending ? '#D97706' : isDisputed ? '#B91C1C' : undefined,
                          border: isIncidentPending ? '1px solid #FDE68A' : isDisputed ? '1px solid #FCA5A5' : undefined
                        }}
                      >
                        {isReturned ? 'ĐÃ TRẢ ĐỒ' : isIncidentPending ? 'YÊU CẦU ĐỀN BÙ' : isDisputed ? 'ĐANG TRANH CHẤP' : 'ĐANG THUÊ'}
                      </span>
                    </div>
                    <div className="vh-profile-rental-details">
                      <div>
                        <div className="vh-profile-rental-name-row">
                          <h4 className="vh-profile-rental-name font-header">{item.name}</h4>
                        </div>
                        <span className="vh-profile-rental-material" style={{ marginTop: '8px', display: 'block' }}>
                          Kích cỡ: <strong>{item.size}</strong> • Màu: <strong>{item.color}</strong>
                        </span>
                        <span className="vh-profile-rental-date" style={{ marginTop: '8px', display: 'block' }}>
                          Thời hạn: <strong>{rentalDateFormatted}</strong>
                        </span>
                      </div>

                      <div className="vh-profile-rental-price-row">
                        <div className="vh-profile-rental-price-sub">
                          <span>TỔNG CHI PHÍ</span>
                          <strong>{item.unitPrice?.toLocaleString('vi-VN')}đ</strong>
                        </div>
                        {item.booking ? (
                          <button 
                            className="vh-appointment-action-link"
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              padding: 0, 
                              cursor: 'pointer',
                              color: (isIncidentPending || isDisputed) ? '#C0392B' : undefined,
                              fontWeight: (isIncidentPending || isDisputed) ? 700 : undefined
                            }}
                            onClick={() => onViewDetails(item.booking)}
                          >
                            {isIncidentPending ? 'Phản hồi đền bù' : isDisputed ? 'Chi tiết tranh chấp' : 'Hóa đơn'}
                          </button>
                        ) : (
                          <span className="vh-appointment-action-link" style={{ cursor: 'pointer' }}>
                            Hóa đơn
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PANEL 3: FAVORITES */}
        {activeTab === 'favorites' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
            {/* Sub-tabs header */}
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #EAEAE8', paddingBottom: '12px' }}>
              <button
                onClick={() => setFavoriteSubTab('aodai')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: favoriteSubTab === 'aodai' ? 'var(--color-primary)' : '#8C827A',
                  borderBottom: favoriteSubTab === 'aodai' ? '2px solid var(--color-primary)' : 'none',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                Trang phục áo dài ({realFavorites.filter(item => item.itemType === 'PRODUCT').length})
              </button>
              <button
                onClick={() => setFavoriteSubTab('photographer')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: favoriteSubTab === 'photographer' ? 'var(--color-primary)' : '#8C827A',
                  borderBottom: favoriteSubTab === 'photographer' ? '2px solid var(--color-primary)' : 'none',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                Nhiếp ảnh gia ({realFavorites.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE').length})
              </button>
            </div>

            {/* Sub-tab content */}
            {favoriteSubTab === 'aodai' ? (
              <div className="vh-profile-favorites-grid-layout">
                {realFavorites.filter(item => item.itemType === 'PRODUCT').length === 0 ? (
                  <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', width: '100%' }}>
                    <Heart size={32} style={{ color: '#8C827A', margin: '0 auto 12px' }} />
                    <h5 className="font-header" style={{ fontSize: '16px', color: '#2D2926', marginBottom: '4px' }}>Chưa có áo dài yêu thích</h5>
                    <p style={{ fontSize: '13px', color: '#8C827A' }}>Hãy tìm kiếm những bộ áo dài tuyệt vời và lưu lại tại đây.</p>
                  </div>
                ) : (
                  realFavorites.filter(item => item.itemType === 'PRODUCT').map((item) => (
                    <div key={item.id} className="vh-profile-rental-product-card">
                      <div className="vh-profile-rental-img-wrapper" style={{ height: '280px' }}>
                        <img src={item.image} alt={item.name} className="vh-profile-rental-img" />
                      </div>
                      <div className="vh-profile-rental-details">
                        <div>
                          <h4 className="vh-profile-rental-name font-header">{item.name}</h4>
                          <span className="vh-profile-rental-material" style={{ marginTop: '6px', display: 'block' }}>{item.material}</span>
                        </div>
                        <div className="vh-profile-rental-price-row">
                          <div className="vh-profile-rental-price-sub">
                            <span>Giá cọc / dịch vụ tham khảo</span>
                            <strong>{item.price.toLocaleString('vi-VN')}đ</strong>
                          </div>
                          <button 
                            className="vh-appointment-action-link"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            onClick={() => navigate(item.link)}
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="vh-profile-favorites-grid-layout">
                {realFavorites.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE').length === 0 ? (
                  <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', width: '100%' }}>
                    <Heart size={32} style={{ color: '#8C827A', margin: '0 auto 12px' }} />
                    <h5 className="font-header" style={{ fontSize: '16px', color: '#2D2926', marginBottom: '4px' }}>Chưa có nhiếp ảnh gia yêu thích</h5>
                    <p style={{ fontSize: '13px', color: '#8C827A' }}>Hãy khám phá các thợ chụp hình và lưu nhiếp ảnh gia bạn thích.</p>
                  </div>
                ) : (
                  realFavorites.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE').map((item) => (
                    <div key={item.id} className="vh-profile-rental-product-card">
                      <div className="vh-profile-rental-img-wrapper" style={{ height: '280px' }}>
                        <img src={item.image} alt={item.name} className="vh-profile-rental-img" />
                      </div>
                      <div className="vh-profile-rental-details">
                        <div>
                          <h4 className="vh-profile-rental-name font-header">{item.name}</h4>
                          <span className="vh-profile-rental-material" style={{ marginTop: '6px', display: 'block' }}>{item.material}</span>
                        </div>
                        <div className="vh-profile-rental-price-row">
                          <div className="vh-profile-rental-price-sub">
                            <span>Giá dịch vụ tham khảo</span>
                            <strong>{item.price.toLocaleString('vi-VN')}đ</strong>
                          </div>
                          <button 
                            className="vh-appointment-action-link"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            onClick={() => navigate(item.link)}
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* PANEL 4: PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="vh-profile-payments-table-wrapper">
            {payments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', width: '100%' }}>
                <ShieldCheck size={32} style={{ color: '#8C827A', margin: '0 auto 12px' }} />
                <h5 className="font-header" style={{ fontSize: '16px', color: '#2D2926', marginBottom: '4px' }}>Chưa có lịch sử giao dịch</h5>
                <p style={{ fontSize: '13px', color: '#8C827A' }}>Bạn chưa thực hiện bất kỳ giao dịch thanh toán nào.</p>
              </div>
            ) : (
              <table className="vh-profile-payments-table">
                <thead>
                  <tr>
                    <th>Mã giao dịch</th>
                    <th>Dịch vụ</th>
                    <th>Số tiền</th>
                    <th>Phương thức</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr 
                      key={p._id || p.paymentCode} 
                      onClick={() => {
                        let bId = p.bookingId;
                        if (bId && typeof bId === 'object') {
                          bId = bId.id || bId._id;
                        }
                        if (bId) {
                          setSelectedBookingId(bId);
                          setIsDetailModalOpen(true);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                      className="hover:bg-stone-50 transition"
                    >
                      <td style={{ fontWeight: 700 }}>{p.paymentCode}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {p.purpose === 'DEPOSIT_PAYMENT' 
                          ? 'Đặt cọc giữ chỗ' 
                          : p.purpose === 'DEPOSIT_REFUND' 
                            ? 'Hoàn trả tiền cọc' 
                            : 'Thanh toán hoàn tất'}
                      </td>
                      <td style={{ 
                        fontWeight: 800, 
                        color: p.purpose === 'DEPOSIT_REFUND' ? '#2e7d32' : 'var(--color-primary-dark)' 
                      }}>
                        {p.purpose === 'DEPOSIT_REFUND' ? '+' : ''}{p.amount?.toLocaleString('vi-VN')}đ
                      </td>
                      <td>
                        {p.paymentMethod === 'PAYOS_REFUND' 
                          ? 'Hoàn tiền (PayOS)' 
                          : p.paymentMethod || 'PayOS (VietQR)'}
                      </td>
                      <td>
                        <span className="vh-profile-payment-status-success-badge" style={{
                          backgroundColor: p.purpose === 'DEPOSIT_REFUND' ? '#e8f5e9' : undefined,
                          color: p.purpose === 'DEPOSIT_REFUND' ? '#2e7d32' : undefined,
                        }}>
                          <ShieldCheck size={12} style={{ marginRight: '4px' }} />
                          <span>Thành công</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>

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

      {/* Booking Details Modal */}
      <BookingDetailModal 
        bookingId={selectedBookingId}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        viewerRole="customer"
        onBookingChanged={onRefresh}
        onWriteReview={(itemDetails) => {
          setIsDetailModalOpen(false);
          setReviewingItem(itemDetails);
        }}
      />
    </div>
  );
};

export default CustomerDashboard;
