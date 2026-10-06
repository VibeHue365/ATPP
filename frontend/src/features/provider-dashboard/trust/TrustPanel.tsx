import { useState, useMemo } from 'react';
import {
  Star,
  Search,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  ShoppingBag,
  Calendar,
  Eye,
  Award,
} from 'lucide-react';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { useProviderTrustState } from './useProviderTrustState';

type TrustPanelProps = Pick<
  ReturnType<typeof useProviderSessionState>,
  'isLoadingProvider'
> &
  Pick<
    ReturnType<typeof useProviderTrustState>,
    | 'searchCustId'
    | 'setSearchCustId'
    | 'trustScoreResult'
    | 'bookingsState'
    | 'setRatingBooking'
  > & {
    handleSearchTrustScore: (targetId?: string) => Promise<void>;
  };

export function TrustPanel({
  isLoadingProvider,
  searchCustId,
  setSearchCustId,
  handleSearchTrustScore,
  trustScoreResult,
  bookingsState,
  setRatingBooking,
}: TrustPanelProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed' | 'all'>('pending');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [isSearchingTrust, setIsSearchingTrust] = useState(false);

  // Helper trích xuất thông tin khách hàng từ booking
  const getCustomerInfo = (booking: any) => {
    const customer = booking.customerId;
    const isPopulated = customer && typeof customer === 'object';

    const customerId = isPopulated
      ? customer._id || customer.id
      : String(customer || '');
    const fullName =
      (isPopulated && customer.profile?.fullName) ||
      booking.customerName ||
      'Khách hàng';
    const avatarUrl = isPopulated ? customer.profile?.avatarUrl : null;
    const phone =
      (isPopulated &&
        (customer.auth?.phone || customer.profile?.phoneNumber)) ||
      booking.customerPhone ||
      '—';
    const email =
      (isPopulated && (customer.auth?.email || customer.email)) ||
      booking.customerEmail ||
      '';
    const userCode = isPopulated ? customer.userCode : '';

    const firstItem = booking.items?.[0];
    const serviceName =
      firstItem?.productId?.name ||
      firstItem?.photographyPackageId?.name ||
      firstItem?.title ||
      (booking.bookingType === 'PHOTOGRAPHY'
        ? 'Gói dịch vụ chụp ảnh'
        : 'Thuê trang phục Áo dài');
    const itemsCount = booking.items?.length || 1;

    return {
      customerId,
      fullName,
      avatarUrl,
      phone,
      email,
      userCode,
      serviceName,
      itemsCount,
    };
  };

  // Tất cả đơn hàng đã hoàn tất đủ điều kiện đánh giá hai chiều
  const completedBookings = useMemo(() => {
    return (bookingsState || []).filter((b: any) => {
      const status = (b.status || '').toUpperCase();
      return (
        status === 'COMPLETED' ||
        status === 'RETURNED' ||
        Boolean(b.customerReview)
      );
    });
  }, [bookingsState]);

  // Đơn chờ đánh giá (chưa có customerReview)
  const pendingBookings = useMemo(() => {
    return completedBookings.filter((b: any) => !b.customerReview);
  }, [completedBookings]);

  // Đơn đã đánh giá (đã có customerReview)
  const reviewedBookings = useMemo(() => {
    return completedBookings.filter((b: any) => Boolean(b.customerReview));
  }, [completedBookings]);

  // Danh sách hiển thị theo Tab
  const currentList = useMemo(() => {
    let list: any[] = [];
    if (activeTab === 'pending') list = pendingBookings;
    else if (activeTab === 'reviewed') list = reviewedBookings;
    else list = completedBookings;

    if (!filterKeyword.trim()) return list;

    const q = filterKeyword.toLowerCase().trim();
    return list.filter((b: any) => {
      const info = getCustomerInfo(b);
      const bookingCode = (b.bookingCode || '').toLowerCase();
      return (
        bookingCode.includes(q) ||
        info.fullName.toLowerCase().includes(q) ||
        info.phone.includes(q) ||
        info.serviceName.toLowerCase().includes(q)
      );
    });
  }, [activeTab, pendingBookings, reviewedBookings, completedBookings, filterKeyword]);

  const onSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchCustId.trim()) return;
    setIsSearchingTrust(true);
    try {
      await handleSearchTrustScore();
    } finally {
      setIsSearchingTrust(false);
    }
  };

  const onQuickSearchCustomer = async (custId: string) => {
    if (!custId) return;
    setSearchCustId(custId);
    setIsSearchingTrust(true);
    try {
      await handleSearchTrustScore(custId);
    } finally {
      setIsSearchingTrust(false);
    }
  };

  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  const formatDateTime = (dateStr?: string | Date) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <main
      style={{
        flex: 1,
        padding: '36px 32px',
        overflowY: 'auto',
        backgroundColor: '#F8F9FA',
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-header, inherit)',
                fontSize: '28px',
                fontWeight: 750,
                margin: 0,
                color: '#1F2937',
              }}
            >
              Đánh giá khách hàng & Tín nhiệm
            </h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: '#FDF2F2',
                color: 'var(--color-primary, #8B1D24)',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid #FECACA',
              }}
            >
              <ShieldCheck size={14} />
              Two-Way Trust
            </span>
          </div>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-text-secondary, #6B7280)',
              marginTop: '6px',
              maxWidth: '650px',
              lineHeight: 1.5,
            }}
          >
            Hệ thống đánh giá hành vi khách hàng sau khi hoàn tất đơn và tra cứu hồ
            sơ tín nhiệm trên toàn sàn VibeHue để chủ động quản lý rủi ro cho thuê.
          </p>
        </div>

        {/* Quick Summary Badges */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#FEF3C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={20} color="#D97706" />
            </div>
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                }}
              >
                Chờ đánh giá
              </span>
              <strong
                style={{
                  display: 'block',
                  fontSize: '18px',
                  fontWeight: 800,
                  color: '#D97706',
                }}
              >
                {pendingBookings.length}
              </strong>
            </div>
          </div>

          <div
            style={{
              padding: '12px 18px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#D1FAE5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={20} color="#059669" />
            </div>
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                }}
              >
                Đã đánh giá
              </span>
              <strong
                style={{
                  display: 'block',
                  fontSize: '18px',
                  fontWeight: 800,
                  color: '#059669',
                }}
              >
                {reviewedBookings.length}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {isLoadingProvider ? (
        <div
          style={{
            padding: '80px',
            textAlign: 'center',
            color: 'var(--color-text-secondary, #6B7280)',
            fontWeight: 600,
          }}
        >
          Đang tải dữ liệu tín nhiệm...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Card: Tra cứu tín nhiệm khách hàng */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E5E7EB',
              padding: '24px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #F3F4F6',
                paddingBottom: '14px',
                marginBottom: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="var(--color-primary, #8B1D24)" />
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 750,
                    color: '#1F2937',
                    margin: 0,
                    letterSpacing: '0.02em',
                  }}
                >
                  TRA CỨU HỒ SƠ TÍN NHIỆM KHÁCH HÀNG
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                Nhập User ID hoặc dùng nút "Tra cứu nhanh" bên dưới
              </span>
            </div>

            <form
              onSubmit={onSearchSubmit}
              style={{ display: 'flex', gap: '12px' }}
            >
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={18}
                  color="#9CA3AF"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Nhập mã ObjectId hoặc User ID của khách hàng để tra cứu..."
                  value={searchCustId}
                  onChange={(e) => setSearchCustId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '10px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isSearchingTrust}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-primary, #8B1D24)',
                  color: '#FFFFFF',
                  cursor: isSearchingTrust ? 'not-allowed' : 'pointer',
                  opacity: isSearchingTrust ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(139, 29, 36, 0.2)',
                }}
              >
                <Search size={16} />
                {isSearchingTrust ? 'Đang tra cứu...' : 'Tra cứu tín nhiệm'}
              </button>
            </form>

            {/* Kết quả tra cứu tín nhiệm */}
            {trustScoreResult && (
              <div
                style={{
                  marginTop: '18px',
                  padding: '20px',
                  backgroundColor: '#FAF7F2',
                  borderRadius: '12px',
                  border: '1px solid #EAE6DF',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '14px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #EAE6DF',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                    }}
                  >
                    <Star size={20} fill="#F59E0B" color="#F59E0B" />
                    <strong
                      style={{
                        fontSize: '15px',
                        fontWeight: 800,
                        color: '#1F2937',
                        marginTop: '2px',
                      }}
                    >
                      {trustScoreResult.averageRating}
                    </strong>
                  </div>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: 750,
                          color: '#1F2937',
                        }}
                      >
                        ĐIỂM TÍN NHIỆM TRUNG BÌNH
                      </h4>
                      {Number(trustScoreResult.averageRating) >= 4.5 ? (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#D1FAE5',
                            color: '#065F46',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          🌟 Rất uy tín
                        </span>
                      ) : Number(trustScoreResult.averageRating) >= 3.5 ? (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#FEF3C7',
                            color: '#92400E',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          👍 Uy tín tốt
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#FEE2E2',
                            color: '#991B1B',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          ⚠️ Cần lưu ý khi cho thuê
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        margin: '4px 0 0 0',
                        fontSize: '13px',
                        color: '#6B7280',
                      }}
                    >
                      Khách hàng nhận được{' '}
                      <strong style={{ color: '#1F2937' }}>
                        {trustScoreResult.totalReviews} lượt đánh giá hành vi
                      </strong>{' '}
                      từ các đối tác trên nền tảng VibeHue.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12.5px',
                    color: '#6B7280',
                  }}
                >
                  <Award size={18} color="#D97706" />
                  <span>Dữ liệu xác thực qua hợp đồng cho thuê hoàn tất</span>
                </div>
              </div>
            )}
          </div>

          {/* Section: Danh sách Đơn hàng & Bộ lọc Tab */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Header Tabs & Search in List */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              {/* Navigation Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  backgroundColor: '#F3F4F6',
                  padding: '4px',
                  borderRadius: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('pending')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor:
                      activeTab === 'pending' ? '#FFFFFF' : 'transparent',
                    color:
                      activeTab === 'pending'
                        ? 'var(--color-primary, #8B1D24)'
                        : '#4B5563',
                    boxShadow:
                      activeTab === 'pending'
                        ? '0 1px 3px rgba(0,0,0,0.1)'
                        : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Clock size={15} />
                  <span>Chờ đánh giá</span>
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 750,
                      backgroundColor:
                        activeTab === 'pending' ? '#FEF3C7' : '#E5E7EB',
                      color: activeTab === 'pending' ? '#B45309' : '#6B7280',
                    }}
                  >
                    {pendingBookings.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('reviewed')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor:
                      activeTab === 'reviewed' ? '#FFFFFF' : 'transparent',
                    color:
                      activeTab === 'reviewed'
                        ? 'var(--color-primary, #8B1D24)'
                        : '#4B5563',
                    boxShadow:
                      activeTab === 'reviewed'
                        ? '0 1px 3px rgba(0,0,0,0.1)'
                        : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>Đã đánh giá</span>
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 750,
                      backgroundColor:
                        activeTab === 'reviewed' ? '#D1FAE5' : '#E5E7EB',
                      color: activeTab === 'reviewed' ? '#047857' : '#6B7280',
                    }}
                  >
                    {reviewedBookings.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor:
                      activeTab === 'all' ? '#FFFFFF' : 'transparent',
                    color:
                      activeTab === 'all'
                        ? 'var(--color-primary, #8B1D24)'
                        : '#4B5563',
                    boxShadow:
                      activeTab === 'all'
                        ? '0 1px 3px rgba(0,0,0,0.1)'
                        : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>Tất cả đơn hoàn tất</span>
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 750,
                      backgroundColor: '#E5E7EB',
                      color: '#6B7280',
                    }}
                  >
                    {completedBookings.length}
                  </span>
                </button>
              </div>

              {/* Search filter in list */}
              <div style={{ position: 'relative', width: '280px' }}>
                <Search
                  size={15}
                  color="#9CA3AF"
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Lọc mã đơn, tên khách..."
                  value={filterKeyword}
                  onChange={(e) => setFilterKeyword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#FAFAFA',
                  }}
                />
              </div>
            </div>

            {/* List Body */}
            <div style={{ padding: '24px' }}>
              {currentList.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#6B7280',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px auto',
                    }}
                  >
                    <CheckCircle2 size={28} color="#9CA3AF" />
                  </div>
                  <h4
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#374151',
                      margin: '0 0 6px 0',
                    }}
                  >
                    {activeTab === 'pending'
                      ? 'Tuyệt vời! Bạn không có đơn nào đang chờ đánh giá.'
                      : activeTab === 'reviewed'
                      ? 'Chưa có đơn hàng nào được gửi đánh giá.'
                      : 'Không có đơn hoàn thành nào phù hợp.'}
                  </h4>
                  <p style={{ fontSize: '13px', margin: 0, color: '#9CA3AF' }}>
                    {activeTab === 'pending'
                      ? 'Tất cả các đơn đã hoàn thành đều đã được ghi nhận đánh giá tín nhiệm.'
                      : 'Khi hoàn tất các đơn thuê hoặc gói chụp, hãy đánh giá hành vi khách để tích lũy dữ liệu tín nhiệm hai chiều.'}
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {currentList.map((booking: any) => {
                    const info = getCustomerInfo(booking);
                    const review = booking.customerReview;
                    const hasReviewed = Boolean(review);

                    return (
                      <div
                        key={booking._id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '20px',
                          border: hasReviewed
                            ? '1px solid #E5E7EB'
                            : '1px solid #FCD34D',
                          borderRadius: '14px',
                          backgroundColor: hasReviewed ? '#FFFFFF' : '#FFFEFA',
                          boxShadow: hasReviewed
                            ? '0 1px 3px rgba(0,0,0,0.03)'
                            : '0 2px 6px rgba(217, 119, 6, 0.08)',
                          transition: 'all 0.2s ease',
                          gap: '14px',
                        }}
                      >
                        {/* Upper row: Customer profile + Booking info + Actions */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            flexWrap: 'wrap',
                            gap: '14px',
                          }}
                        >
                          {/* Left: Avatar & Customer info */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '14px',
                            }}
                          >
                            {/* Avatar */}
                            {info.avatarUrl ? (
                              <img
                                src={info.avatarUrl}
                                alt={info.fullName}
                                style={{
                                  width: '52px',
                                  height: '52px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '2px solid #EAE6DF',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '52px',
                                  height: '52px',
                                  borderRadius: '50%',
                                  background:
                                    'linear-gradient(135deg, #8B1D24 0%, #B89047 100%)',
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: '20px',
                                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                                }}
                              >
                                {info.fullName.charAt(0).toUpperCase()}
                              </div>
                            )}

                            {/* Names & Contact */}
                            <div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}
                              >
                                <strong
                                  style={{
                                    fontSize: '15.5px',
                                    fontWeight: 750,
                                    color: '#1F2937',
                                  }}
                                >
                                  {info.fullName}
                                </strong>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    backgroundColor: '#F3F4F6',
                                    color: '#4B5563',
                                    letterSpacing: '0.03em',
                                  }}
                                >
                                  #{booking.bookingCode}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '14px',
                                  fontSize: '12.5px',
                                  color: '#6B7280',
                                  marginTop: '4px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <Phone size={13} color="#9CA3AF" />
                                  <span>{info.phone}</span>
                                </span>
                                <span>•</span>
                                <span
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <ShoppingBag size={13} color="#9CA3AF" />
                                  <strong style={{ color: '#4B5563' }}>
                                    {info.serviceName}
                                  </strong>
                                </span>
                                <span>•</span>
                                <span
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <Calendar size={13} color="#9CA3AF" />
                                  <span>
                                    {formatDate(
                                      booking.completedAt || booking.updatedAt || booking.createdAt
                                    )}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
                            {/* Nút tra cứu nhanh tín nhiệm khách */}
                            <button
                              type="button"
                              onClick={() =>
                                onQuickSearchCustomer(info.customerId)
                              }
                              title="Tra cứu hồ sơ tín nhiệm của khách này"
                              style={{
                                padding: '8px 14px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 650,
                                backgroundColor: '#FFFFFF',
                                color: '#374151',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <Eye size={14} color="#6B7280" />
                              <span>Tra cứu tín nhiệm</span>
                            </button>

                            {/* Trạng thái / Nút đánh giá */}
                            {hasReviewed ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 14px',
                                  borderRadius: '8px',
                                  backgroundColor: '#ECFDF5',
                                  border: '1px solid #A7F3D0',
                                  color: '#065F46',
                                  fontSize: '12.5px',
                                  fontWeight: 700,
                                }}
                              >
                                <CheckCircle2 size={15} color="#059669" />
                                <span>Đã đánh giá</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setRatingBooking({
                                    bookingId: booking._id,
                                    customerId: info.customerId,
                                    bookingCode: booking.bookingCode,
                                    customerName: info.fullName,
                                    serviceTitle: info.serviceName,
                                  })
                                }
                                style={{
                                  padding: '8px 18px',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontSize: '12.5px',
                                  fontWeight: 700,
                                  backgroundColor: 'var(--color-primary, #8B1D24)',
                                  color: '#FFFFFF',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 2px 6px rgba(139, 29, 36, 0.2)',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <Star size={15} fill="#FFFFFF" />
                                <span>Đánh giá khách hàng</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Lower row: Nếu đã đánh giá thì hiển thị Box Chi tiết Đánh giá */}
                        {hasReviewed && (
                          <div
                            style={{
                              marginTop: '2px',
                              padding: '12px 16px',
                              backgroundColor: '#F9FAFB',
                              borderRadius: '10px',
                              border: '1px dashed #E5E7EB',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '10px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                              }}
                            >
                              {/* Stars */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                              >
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    size={15}
                                    fill={
                                      s <= (review.rating || 5)
                                        ? '#F59E0B'
                                        : '#E5E7EB'
                                    }
                                    color={
                                      s <= (review.rating || 5)
                                        ? '#F59E0B'
                                        : '#E5E7EB'
                                    }
                                  />
                                ))}
                                <strong
                                  style={{
                                    fontSize: '13px',
                                    marginLeft: '6px',
                                    color: '#1F2937',
                                  }}
                                >
                                  {review.rating}/5 sao
                                </strong>
                              </div>

                              {/* Comment quote */}
                              <div
                                style={{
                                  fontSize: '13px',
                                  color: '#4B5563',
                                  fontStyle: 'italic',
                                }}
                              >
                                “
                                {review.comment ||
                                  'Không có nhận xét chi tiết'}
                                ”
                              </div>
                            </div>

                            <span
                              style={{
                                fontSize: '11.5px',
                                color: '#9CA3AF',
                              }}
                            >
                              Gửi lúc: {formatDateTime(review.createdAt)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
