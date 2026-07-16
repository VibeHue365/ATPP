import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Layers, Camera, Plus, Download, Bell,
  HelpCircle, MoreVertical, ChevronLeft, ChevronRight, CheckCircle, FileText, Trash2, Play, Pencil,Copy,Package,
  Upload, X, Award, Calendar, Tag, MessageSquare, Users, Save, Flag, Star, ArrowLeft, LogOut, BarChart3, DollarSign, Check, CheckCheck
} from 'lucide-react';
import { BookingDetailModal } from '../../components/common/BookingDetailModal';
import Swal from 'sweetalert2';
import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { API_BASE_URL } from '../../config/env';

interface Order {
  _id: string;
  id?: string;
  customerName: string;
  customerEmail: string;
  customerInitials: string;
  productName: string;
  orderDate: string;
  total: string;
  status: string;
  totalAmount?: number;
  createdAt?: string;
  customerId?: any;
  items?: any[];
  depositTotal?: number;
  rawStatus?: string;
}

interface Product {
  _id: string;
  name: string;
  categoryId: {
    _id: string;
    name: string;
  } | string;
  description?: string;
  images: string[];
  basePrice: number;
  depositAmount: number;
  sizes: string[];
  colors: string[];
  materials: string[];
  style?: string;
  occasions?: string[];
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
}

export const ProviderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user, isAuthenticated } = useAuth();
  const toast = useToast();

  // Role Access Guard
  useEffect(() => {
    if (isAuthenticated !== undefined) {
      if (!isAuthenticated) {
        navigate('/login', { replace: true });
        return;
      }
      const roles = user?.roles || [];
      const isProvider = roles.some(r => r.toUpperCase() === 'PROVIDER');
      if (!isProvider) {
        toast.error('Bạn không có quyền truy cập trang quản trị của Đối tác!');
        navigate('/', { replace: true });
      }
    }
  }, [user, isAuthenticated, navigate, toast]);
  
  // Views navigation state
  const [currentView, setCurrentView] = useState<'orders' | 'collections' | 'profile' | 'portfolio' | 'calendar' | 'vouchers' | 'inventory' | 'reviews' | 'trust' | 'analytics' | 'payouts'>('analytics');

  // Provider Specific States
  const [provider, setProvider] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [subTab, setSubTab] = useState<'shop' | 'photo'>('shop');

  // Product Search / Sort / Filter States
  const [prodSearch, setProdSearch] = useState('');
  const [prodSortBy, setProdSortBy] = useState('newest');
  const [prodPage, setProdPage] = useState(1);
  const [prodLimit] = useState(6); // 6 items per page for a nice grid
  const [prodTotal, setProdTotal] = useState(0);
  const [prodSizeFilter, setProdSizeFilter] = useState('');
  const [prodColorFilter, setProdColorFilter] = useState('');

  // Inventory Search / Sort / Filter / Pagination States
  const [invSearch, setInvSearch] = useState('');
  const [invSortBy, setInvSortBy] = useState('newest');
  const [invStatusFilter, setInvStatusFilter] = useState('');
  const [invConditionFilter, setInvConditionFilter] = useState('');
  const [invPage, setInvPage] = useState(1);
  const [invLimit] = useState(10); // 10 items per page
  const [invTotal, setInvTotal] = useState(0);

  // Inventory States
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventorySummary, setInventorySummary] = useState<any[]>([]);
  const [myProductsList, setMyProductsList] = useState<any[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Discount Campaign State
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [campaignOccasion, setCampaignOccasion] = useState('');
  const [campaignPercent, setCampaignPercent] = useState('10');
  const [campaignStart, setCampaignStart] = useState('');
  const [campaignEnd, setCampaignEnd] = useState('');
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [submittingCampaign, setSubmittingCampaign] = useState(false);

  // Add Item Modal State
  const [isAddInventoryOpen, setIsAddInventoryOpen] = useState(false);
  const [addInvProductId, setAddInvProductId] = useState('');
  const [addInvSize, setAddInvSize] = useState('M');
  const [addInvColor, setAddInvColor] = useState('WHITE');
  const [addInvQuantity, setAddInvQuantity] = useState(1);
  const [addInvCondition, setAddInvCondition] = useState('GOOD');
  const [addInvNotes, setAddInvNotes] = useState('');

  // Update Item Modal State
  const [isEditInventoryOpen, setIsEditInventoryOpen] = useState(false);
  const [editInvItem, setEditInvItem] = useState<any>(null);
  const [editInvStatus, setEditInvStatus] = useState('AVAILABLE');
  const [editInvCondition, setEditInvCondition] = useState('GOOD');
  const [editInvNotes, setEditInvNotes] = useState('');

  useEffect(() => {
    if (analyticsData) {
      const isShop = analyticsData.capabilities?.includes('AODAI_RENTAL') || analyticsData.capabilities?.includes('RENTAL');
      if (!isShop) {
        setSubTab('photo');
      }
    }
  }, [analyticsData]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [reviewsData, setReviewsData] = useState<any>(null);
  const [bookingsState, setBookingsState] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingProvider, setIsLoadingProvider] = useState(false);

  // Form states - Profile
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [comboDiscountPercent, setComboDiscountPercent] = useState(0);

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

  // Notification states
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNoti, setLoadingNoti] = useState(false);
  const notiRef = useRef<HTMLDivElement>(null);

  // Click outside to close notification panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNoti(true);
      const data = await httpClient.request<any[]>('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setLoadingNoti(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const providerUnreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotiMarkAsRead = async (id: string) => {
    try {
      await httpClient.request(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (e) { console.error(e); }
  };

  const handleNotiMarkAllAsRead = async () => {
    try {
      await httpClient.request('/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) { console.error(e); }
  };

  const getNotiTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const getNotiTypeStyle = (type: string) => {
    switch (type) {
      case 'BOOKING': return { bg: '#EEF2FF', color: '#4338CA', icon: '📋' };
      case 'PAYMENT': return { bg: '#F0FDF4', color: '#166534', icon: '💳' };
      case 'HANDOVER': return { bg: '#FFF7ED', color: '#C2410C', icon: '🤝' };
      case 'REFUND': return { bg: '#FEF3C7', color: '#92400E', icon: '💰' };
      case 'DISPUTE': return { bg: '#FEE2E2', color: '#991B1B', icon: '⚠️' };
      case 'SYSTEM': return { bg: '#F5F3FF', color: '#7C3AED', icon: '🔔' };
      default: return { bg: '#F9FAFB', color: '#6B7280', icon: '📌' };
    }
  };

  const fetchProviderData = async () => {
    setIsLoadingProvider(true);
    try {
      const pRes: any = await httpClient.get('/providers/me');
      setProvider(pRes);
      setBusinessName(pRes.businessName || '');
      setPhone(pRes.contact?.phone || '');
      setAddressLine(pRes.address?.addressLine || '');
      setCity(pRes.address?.city || '');
      setCancellationPolicy(pRes.policies?.cancellationPolicy || '');
      setComboDiscountPercent(pRes.comboDiscountPercent ?? 0);

      const sRes: any = await httpClient.get('/providers/me/schedules');
      setSchedules(sRes);

      const vRes: any = await httpClient.get('/promotions/provider');
      setVouchers(vRes);

      const rRes: any = await httpClient.get('/reviews/stats');
      setReviewsData(rRes);

      const bRes: any = await httpClient.get('/bookings/provider');
      setBookingsState(bRes);

      const aRes: any = await httpClient.get('/providers/me/analytics');
      setAnalyticsData(aRes);
    } catch (err: any) {
      const msg = err.message || 'Không thể đồng bộ dữ liệu đối tác';
      toast.error(msg);
      if (msg.includes('đình chỉ') || msg.includes('susp')) {
        Swal.fire({
          title: 'Dịch vụ đối tác bị tạm ngưng',
          text: msg,
          icon: 'warning',
          confirmButtonText: 'Quay lại trang chủ',
          confirmButtonColor: '#B89047',
          allowOutsideClick: false,
        }).then(() => {
          navigate('/');
        });
      } else if (msg.includes('khoá') || msg.includes('khóa') || msg.includes('ban') || msg.includes('unauth')) {
        Swal.fire({
          title: 'Tài khoản bị khóa',
          text: msg,
          icon: 'error',
          confirmButtonText: 'Đăng xuất',
          confirmButtonColor: '#4A0E17',
          allowOutsideClick: false,
        }).then(() => {
          logout();
          navigate('/login');
        });
      }
    } finally {
      setIsLoadingProvider(false);
    }
  };

  const fetchInventoryData = async () => {
    setIsLoadingInventory(true);
    try {
      const res: any = await httpClient.get(
        `/inventory?search=${encodeURIComponent(invSearch)}&status=${invStatusFilter}&conditionStatus=${invConditionFilter}&sortBy=${invSortBy}&page=${invPage}&limit=${invLimit}`
      );
      setInventoryItems(res?.items || []);
      setInvTotal(res?.total || 0);

      const summary: any = await httpClient.get('/inventory/summary');
      setInventorySummary(summary || []);

      const productsRes: any = await httpClient.get('/products/my-listings?limit=999');
      setMyProductsList(productsRes?.items || []);
    } catch (e) {
      console.error('Failed to load inventory:', e);
      toast.error('Không thể đồng bộ dữ liệu tồn kho');
    } finally {
      setIsLoadingInventory(false);
    }
  };

  const handleCreateInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInvProductId) {
      toast.error('Vui lòng chọn sản phẩm');
      return;
    }
    try {
      await httpClient.post('/inventory', {
        productId: addInvProductId,
        size: addInvSize,
        color: addInvColor,
        quantity: Number(addInvQuantity),
        conditionStatus: addInvCondition,
        notes: addInvNotes
      });
      toast.success('Nhập kho hiện vật thành công!');
      setIsAddInventoryOpen(false);
      // Reset form
      setAddInvProductId('');
      setAddInvSize('M');
      setAddInvColor('WHITE');
      setAddInvQuantity(1);
      setAddInvCondition('GOOD');
      setAddInvNotes('');
      // Refetch
      fetchInventoryData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi nhập kho hiện vật');
    }
  };

  const handleUpdateInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInvItem) return;
    try {
      await httpClient.patch(`/inventory/${editInvItem._id}`, {
        status: editInvStatus,
        conditionStatus: editInvCondition,
        notes: editInvNotes
      });
      toast.success('Cập nhật trạng thái hiện vật thành công!');
      setIsEditInventoryOpen(false);
      setEditInvItem(null);
      fetchInventoryData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  const handleDeleteInventoryItem = async (itemId: string) => {
    const result = await Swal.fire({
      title: 'Xác nhận thanh lý?',
      text: 'Hiện vật này sẽ được chuyển sang trạng thái RETIRED và không thể cho thuê tiếp.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý thanh lý',
      cancelButtonText: 'Hủy bỏ',
      confirmButtonColor: '#4A0E17',
      cancelButtonColor: '#71717A'
    });

    if (result.isConfirmed) {
      try {
        await httpClient.delete(`/inventory/${itemId}`);
        toast.success('Thanh lý hiện vật thành công!');
        fetchInventoryData();
      } catch (err: any) {
        Swal.fire({
          title: 'Không thể thanh lý',
          text: err.message || 'Lỗi xảy ra khi thanh lý hiện vật.',
          icon: 'error',
          confirmButtonColor: '#4A0E17'
        });
      }
    }
  };

  const fetchPayouts = async () => {
    try {
      const res: any = await httpClient.get('/payments/settlement-transfers/provider');
      setPayouts(res || []);
    } catch (err: any) {
      console.error('Không thể tải lịch sử quyết toán:', err);
    }
  };

  const viewCustomerTrust = async (custId: string) => {
    setIsDetailModalOpen(false);
    setCurrentView('trust');
    setSearchCustId(custId);
    try {
      const res = await httpClient.get(`/users/${custId}/trust-score`);
      setTrustScoreResult(res);
    } catch (err) {
      console.error('Không thể tải điểm tín nhiệm:', err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await httpClient.patch('/providers/me', {
        businessName,
        contact: { ...provider?.contact, phone },
        address: { ...provider?.address, addressLine, city },
        policies: { ...provider?.policies, cancellationPolicy },
        comboDiscountPercent: Number(comboDiscountPercent),
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
    const { value: imageUrl, isConfirmed } = await Swal.fire({
      title: 'Thêm ảnh mẫu Portfolio',
      input: 'url',
      inputLabel: 'Đường dẫn URL ảnh (JPEG/PNG)',
      inputPlaceholder: 'https://example.com/image.jpg',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-primary-dark)',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'Thêm ảnh',
      cancelButtonText: 'Hủy',
      background: 'white',
      inputValidator: (value) => {
        if (!value) return 'Vui lòng nhập URL ảnh!';
        try { new URL(value); } catch { return 'URL không hợp lệ!'; }
      },
    });
    if (!isConfirmed || !imageUrl) return;
    try {
      await httpClient.post('/providers/me/portfolio', { imageUrl });
      toast.success('Đã thêm ảnh mẫu thiết kế vào Portfolio!');
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

  // Orders State — loaded from API via bookingsState
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderTab, setOrderTab] = useState('Tất cả');
  const [activePage, setActivePage] = useState(1);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Incident Report States
  const [reportingOrder, setReportingOrder] = useState<Order | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [incidentDesc, setIncidentDesc] = useState<string>('');
  const [incidentEvidence, setIncidentEvidence] = useState<string>('');
  const [incidentAmount, setIncidentAmount] = useState<number>(0);
  const [incidentActionType, setIncidentActionType] = useState<'CLEANING' | 'MAINTENANCE'>('CLEANING');

  const handleSendIncidentReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingOrder || !selectedItemId) {
      toast.error('Vui lòng chọn sản phẩm gặp sự cố!');
      return;
    }
    if (incidentAmount > (reportingOrder.depositTotal || 0)) {
      toast.error(`Tiền đền bù không được vượt quá số tiền cọc (${(reportingOrder.depositTotal || 0).toLocaleString()}đ)`);
      return;
    }
    try {
      const photos = incidentEvidence ? incidentEvidence.split(',').map(s => s.trim()).filter(Boolean) : [];
      await httpClient.post('/api/disputes/incidents', {
        bookingId: reportingOrder._id,
        bookingItemId: selectedItemId,
        description: incidentDesc,
        evidencePhotos: photos,
        requestedAmount: incidentAmount,
        actionType: incidentActionType,
      });
      toast.success('Báo cáo sự cố thành công! Đơn đặt lịch đã chuyển sang trạng thái chờ giải quyết.');
      setReportingOrder(null);
      setSelectedItemId('');
      setIncidentDesc('');
      setIncidentEvidence('');
      setIncidentAmount(0);
      setIncidentActionType('CLEANING');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Gửi báo cáo sự cố thất bại');
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const bRes: any = await httpClient.get('/bookings/provider');
      const mapped: Order[] = (Array.isArray(bRes) ? bRes : []).map((b: any) => {
        const cust = b.customerId;
        const custName = cust?.profile?.fullName || cust?.email?.split('@')[0] || 'Khách hàng';
        const custEmail = cust?.email || '';
        const initials = custName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
        const firstItem = b.items?.[0];
        const productName = firstItem?.name || firstItem?.productId?.name || firstItem?.photographyPackageId?.name || 'Sản phẩm thuê';
        const dateStr = b.createdAt ? new Date(b.createdAt).toLocaleDateString('vi-VN') : '';
        
        let totalAmt = 0;
        if (b.items && b.items.length > 0) {
          totalAmt = b.items.reduce((sum: number, item: any) => {
            const price = item.unitPrice ?? 0;
            const qty = item.quantity ?? 1;
            return sum + (price * qty);
          }, 0);
        }
        if (totalAmt === 0 && b.pricingSummary?.grandTotal) {
          totalAmt = b.pricingSummary.grandTotal;
        }

        const statusMap: Record<string, string> = {
          PENDING: 'CHỜ XỬ LÝ',
          PENDING_PAYMENT: 'CHỜ THANH TOÁN',
          DEPOSIT_PAID: 'ĐÃ ĐẶT CỌC',
          CONFIRMED: 'ĐANG THỰC HIỆN',
          PICKUP_PENDING: 'CHỜ NHẬN ĐỒ',
          PICKED_UP: 'ĐANG THUÊ',
          RETURN_PENDING: 'CHỜ KHÁCH DUYỆT SỰ CỐ',
          RETURNED: 'ĐÃ TRẢ ĐỒ',
          COMPLETED: 'HOÀN THÀNH',
          CANCELLED: 'ĐÃ HỦY',
          DISPUTED: 'TRANH CHẤP',
        };
        return {
          _id: b._id,
          id: `#${b._id?.slice(-6).toUpperCase()}`,
          customerName: custName,
          customerEmail: custEmail,
          customerInitials: initials,
          productName,
          orderDate: dateStr,
          total: `${totalAmt.toLocaleString('vi-VN')}đ`,
          status: statusMap[b.status] || b.status,
          totalAmount: totalAmt,
          items: b.items,
          depositTotal: b.pricingSummary?.depositTotal || 0,
          rawStatus: b.status,
        };
      });
      setOrders(mapped);
    } catch (err: any) {
      toast.error('Không thể tải danh sách đơn hàng');
    } finally {
      setLoadingOrders(false);
    }
  };

  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Add/Edit Product Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Product Form Fields
  const [prodName, setProdName] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodBasePrice, setProdBasePrice] = useState('');
  const [prodDepositAmount, setProdDepositAmount] = useState('');
  const [prodSizes, setProdSizes] = useState<string[]>([]);
  const [prodColors, setProdColors] = useState<string[]>([]);
  const [prodMaterials, setProdMaterials] = useState<string[]>([]);
  const [prodStatus, setProdStatus] = useState<'ACTIVE' | 'DRAFT' | 'INACTIVE'>('ACTIVE');
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [prodStyle, setProdStyle] = useState('traditional');
  const [prodOccasions, setProdOccasions] = useState<string[]>([]);

  const sizesOptions = ['S', 'M', 'L', 'XL', 'XXL'];
  const colorsOptions = ['RED', 'WHITE', 'GOLD', 'BLACK', 'PINK', 'BLUE', 'GREEN', 'BROWN'];
  const materialsOptions = ['SILK', 'VELVET', 'BROCADE', 'ORGANZA', 'LINEN'];

  // Fetch products and categories
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res: any = await httpClient.get(
        `/products/my-listings?search=${encodeURIComponent(prodSearch)}&sortBy=${prodSortBy}&page=${prodPage}&limit=${prodLimit}&sizes=${prodSizeFilter}&colors=${prodColorFilter}`
      );
      setProducts(res?.items || []);
      setProdTotal(res?.total || 0);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi tải danh sách sản phẩm');
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await httpClient.get<any[]>('/products/categories');
      setCategories(data);
      if (data.length > 0 && !prodCategoryId) {
        setProdCategoryId(data[0]._id);
      }
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    }
  };

  const fetchActiveCampaign = async () => {
    try {
      const res = await httpClient.get('/campaigns/mine') as any;
      if (res && res._id) {
        setActiveCampaign(res);
        setCampaignOccasion(res.occasion);
        setCampaignPercent(res.discountPercent.toString());
        setCampaignStart(new Date(res.startDate).toISOString().split('T')[0]);
        setCampaignEnd(new Date(res.endDate).toISOString().split('T')[0]);
      } else {
        setActiveCampaign(null);
        // Default dates
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        setCampaignStart(today.toISOString().split('T')[0]);
        setCampaignEnd(nextWeek.toISOString().split('T')[0]);
      }
    } catch (err) {
      console.error('Error fetching campaign:', err);
    }
  };

  useEffect(() => {
    if (currentView === 'orders') {
      fetchOrders();
    } else if (currentView === 'collections') {
      fetchProducts();
      fetchCategories();
      fetchActiveCampaign();
    } else if (currentView === 'payouts') {
      fetchPayouts();
    } else if (currentView === 'inventory') {
      fetchInventoryData();
    } else if (['profile', 'portfolio', 'calendar', 'vouchers', 'reviews', 'trust', 'analytics'].includes(currentView)) {
      fetchProviderData();
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView === 'collections') {
      fetchProducts();
    }
  }, [prodSearch, prodSortBy, prodPage, prodSizeFilter, prodColorFilter]);

  useEffect(() => {
    if (currentView === 'inventory') {
      fetchInventoryData();
    }
  }, [invSearch, invSortBy, invStatusFilter, invConditionFilter, invPage]);

  const getImageUrl = (url: string) => {
    if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${API_BASE_URL}${url}`;
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdDescription('');
    setProdBasePrice('');
    setProdDepositAmount('');
    setProdSizes(['M']);
    setProdColors(['RED']);
    setProdMaterials(['SILK']);
    setProdStatus('ACTIVE');
    setProdImages([]);
    setProdStyle('traditional');
    setProdOccasions(['wedding']);
    if (categories.length > 0) {
      setProdCategoryId(categories[0]._id);
    }
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdCategoryId(typeof p.categoryId === 'object' ? p.categoryId._id : p.categoryId);
    setProdDescription(p.description || '');
    setProdBasePrice(p.basePrice.toString());
    setProdDepositAmount(p.depositAmount.toString());
    setProdSizes(p.sizes || []);
    setProdColors(p.colors || []);
    setProdMaterials(p.materials || []);
    setProdStatus(p.status);
    setProdImages(p.images || []);
    setProdStyle(p.style || 'traditional');
    setProdOccasions(p.occasions || []);
    setIsModalOpen(true);
  };

  const handleDuplicateProduct = (p: Product) => {
    setEditingProduct(null);
    setProdName('');
    setProdCategoryId(typeof p.categoryId === 'object' ? p.categoryId._id : p.categoryId);
    setProdDescription(p.description || '');
    setProdBasePrice(p.basePrice.toString());
    setProdDepositAmount(p.depositAmount.toString());
    setProdSizes(p.sizes || []);
    setProdColors(p.colors || []);
    setProdMaterials(p.materials || []);
    setProdStatus(p.status);
    setProdImages([]);
    setProdStyle(p.style ? p.style.toLowerCase() : 'traditional');
    setProdOccasions(p.occasions || []);
    setIsModalOpen(true);
  };

  const openCampaignModal = () => {
    setIsCampaignModalOpen(true);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignOccasion.trim()) {
      toast.error('Vui lòng nhập dịp khuyến mãi');
      return;
    }
    const percent = parseInt(campaignPercent, 10);
    if (isNaN(percent) || percent < 1 || percent > 90) {
      toast.error('Phần trăm giảm giá phải từ 1% đến 90%');
      return;
    }
    if (!campaignStart || !campaignEnd) {
      toast.error('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc');
      return;
    }

    setSubmittingCampaign(true);
    try {
      await httpClient.post('/campaigns', {
        occasion: campaignOccasion.trim(),
        discountPercent: percent,
        startDate: new Date(campaignStart).toISOString(),
        endDate: new Date(campaignEnd).toISOString(),
      });
      toast.success('Tạo chiến dịch khuyến mãi thành công');
      setIsCampaignModalOpen(false);
      fetchActiveCampaign();
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Lỗi khi tạo khuyến mãi');
    } finally {
      setSubmittingCampaign(false);
    }
  };

  const handleDeactivateCampaign = async () => {
    const confirm = window.confirm('Bạn có chắc chắn muốn tắt chương trình khuyến mãi và quay về giá gốc?');
    if (!confirm) return;

    setSubmittingCampaign(true);
    try {
      await httpClient.delete('/campaigns/active');
      toast.success('Đã tắt khuyến mãi thành công, các sản phẩm quay về giá gốc');
      setActiveCampaign(null);
      setCampaignOccasion('');
      setCampaignPercent('10');
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      setCampaignStart(today.toISOString().split('T')[0]);
      setCampaignEnd(nextWeek.toISOString().split('T')[0]);
      setIsCampaignModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Lỗi khi tắt khuyến mãi');
    } finally {
      setSubmittingCampaign(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploadingImages(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < e.target.files.length; i++) {
        formData.append('images', e.target.files[i]);
      }
      const res = await httpClient.post<{ urls: string[] }>('/products/upload', formData);
      setProdImages(prev => [...prev, ...res.urls]);
      toast.success('Đã tải lên hình ảnh thành công!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Tải ảnh lên thất bại');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setProdImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleOccasionToggle = (key: string) => {
    setProdOccasions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodCategoryId || !prodBasePrice || !prodDepositAmount) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }

    if (Number(prodDepositAmount) > Number(prodBasePrice)) {
      toast.error('Giá cọc không được lớn hơn giá thuê');
      return;
    }


    const payload = {
      name: prodName,
      categoryId: prodCategoryId,
      description: prodDescription,
      basePrice: Number(prodBasePrice),
      depositAmount: Number(prodDepositAmount),
      sizes: prodSizes,
      colors: prodColors,
      materials: prodMaterials,
      status: prodStatus,
      images: prodImages.length > 0 ? prodImages : ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'],
      style: prodStyle,
      occasions: prodOccasions,
    };

    try {
      if (editingProduct) {
        await httpClient.patch(`/products/${editingProduct._id}`, payload);
        toast.success(`Cập nhật áo dài "${prodName}" thành công!`);
      } else {
        await httpClient.post('/products', payload);
        toast.success(`Thêm mới áo dài "${prodName}" thành công!`);
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Thao tác lưu sản phẩm thất bại.');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa?',
      text: `Bạn có chắc chắn muốn xóa áo dài "${name}" không?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-primary)',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      background: 'white',
      customClass: {
        popup: 'font-body',
      }
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await httpClient.delete(`/products/${id}`);
      Swal.fire({
        title: 'Đã xóa!',
        text: `Đã xóa thành công sản phẩm "${name}".`,
        icon: 'success',
        confirmButtonColor: 'var(--color-primary)',
      });
      fetchProducts();
    } catch (err: any) {
      Swal.fire({
        title: 'Thất bại!',
        text: err.message || 'Xóa sản phẩm thất bại.',
        icon: 'error',
        confirmButtonColor: 'var(--color-primary)',
      });
    }
  };

  const handleSizeToggle = (size: string) => {
    setProdSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]);
  };

  const handleColorToggle = (color: string) => {
    setProdColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);
  };

  const handleMaterialToggle = (material: string) => {
    setProdMaterials(prev => prev.includes(material) ? prev.filter(m => m !== material) : [...prev, material]);
  };

  // Orders Tab filter & helpers — counts computed dynamically
  const getOrderGroup = (status: string): string => {
    const s = (status || '').toUpperCase();
    if (['CHỜ XỬ LÝ', 'CHỜ THANH TOÁN', 'PENDING', 'PENDING_PAYMENT'].includes(s)) {
      return 'Chờ xử lý';
    }
    if ([
      'ĐÃ ĐẶT CỌC', 'ĐANG THỰC HIỆN', 'CHỜ NHẬN ĐỒ', 'ĐANG THUÊ', 
      'CHỜ KHÁCH DUYỆT SỰ CỐ', 'ĐÃ TRẢ ĐỒ', 'TRANH CHẤP', 'ĐANG XỬ LÝ',
      'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP',
      'RETURN_PENDING', 'RETURNED', 'DISPUTED'
    ].includes(s)) {
      return 'Đang thực hiện';
    }
    if (['HOÀN THÀNH', 'COMPLETED'].includes(s)) {
      return 'Hoàn thành';
    }
    if (['ĐÃ HỦY', 'CANCELLED'].includes(s)) {
      return 'Đã hủy';
    }
    return 'Khác';
  };

  const tabs = React.useMemo(() => [
    { label: 'Tất cả', count: orders.length },
    { label: 'Chờ xử lý', count: orders.filter(o => getOrderGroup(o.status) === 'Chờ xử lý').length },
    { label: 'Đang thực hiện', count: orders.filter(o => getOrderGroup(o.status) === 'Đang thực hiện').length },
    { label: 'Hoàn thành', count: orders.filter(o => getOrderGroup(o.status) === 'Hoàn thành').length },
    { label: 'Đã hủy', count: orders.filter(o => getOrderGroup(o.status) === 'Đã hủy').length },
  ], [orders]);

  const filteredOrders = orderTab === 'Tất cả' 
    ? orders 
    : orders.filter(o => getOrderGroup(o.status) === orderTab);

  // Monthly revenue from completed orders
  const monthlyRevenue = React.useMemo(() => {
    const now = new Date();
    return orders
      .filter(o => {
        const d = o.orderDate ? new Date(o.orderDate.split('/').reverse().join('-')) : null;
        return o.status === 'HOÀN THÀNH' && d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
  }, [orders]);

  const statusBadgeStyle = (status: string): React.CSSProperties => {
    const base: React.CSSProperties = { display: 'inline-block', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'white' };
    if (status === 'HOÀN THÀNH') return { ...base, backgroundColor: '#2e7d32' };
    if (status === 'CHỜ KHÁCH DUYỆT SỰ CỐ') return { ...base, backgroundColor: '#ed6c02' };
    if (status === 'TRANH CHẤP') return { ...base, backgroundColor: '#d32f2f' };
    if (status === 'ĐÃ HỦY') return { ...base, backgroundColor: '#757575' };
    if (status === 'CHỜ XỬ LÝ' || status === 'CHỜ THANH TOÁN') return { ...base, backgroundColor: 'var(--color-primary)' };
    if (status === 'ĐANG XỬ LÝ' || status === 'ĐANG THỰC HIỆN' || status === 'ĐANG THUÊ') return { ...base, backgroundColor: 'var(--color-gold)' };
    return { ...base, backgroundColor: '#ccc', color: '#555' };
  };

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', fontSize: '14px', fontWeight: 600,
    color: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.5)', textDecoration: 'none', borderRadius: '8px',
    backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'var(--transition-smooth)', cursor: 'pointer',
    borderRight: active ? '2px solid var(--color-primary)' : 'none',
    textAlign: 'left',
    width: '100%',
    border: 'none',
  });

  // Map từ trạng thái tiếng Việt → BookingStatus enum value
  const statusApiMap: Record<string, string> = {
    'HOÀN THÀNH': 'COMPLETED',
    'ĐANG XỬ LÝ': 'CONFIRMED',
    'CHỜ XỬ LÝ': 'PENDING_PAYMENT',
    'ĐÃ HỦY': 'CANCELLED',
  };

  const changeOrderStatus = async (_id: string, s: string) => {
    const apiStatus = statusApiMap[s] || s;
    try {
      await httpClient.patch(`/bookings/${_id}/status`, { status: apiStatus });
      setOrders(prev => prev.map(o => (o._id === _id || o.id === _id) ? { ...o, status: s } : o));
      toast.success(`Đã cập nhật trạng thái đơn hàng thành "${s}"!`);
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật trạng thái thất bại');
    }
    setActionMenuId(null);
  };

  const handleLogoutClick = async () => {
    const result = await Swal.fire({
      title: 'Đăng xuất?',
      text: 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-primary)',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Hủy',
      background: 'white',
      customClass: {
        popup: 'font-body',
      }
    });

    if (result.isConfirmed) {
      logout();
      toast.success('Đã đăng xuất thành công!');
      navigate('/');
    }
  };

  const renderAnalyticsView = () => {
    if (!analyticsData) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #E8E2D5', borderTop: '3px solid #4A0E17', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
            <p style={{ fontWeight: 600 }}>Đang tải số liệu phân tích...</p>
          </div>
        </div>
      );
    }

    const isShop = analyticsData.capabilities?.includes('AODAI_RENTAL') || analyticsData.capabilities?.includes('RENTAL');
    const isPhoto = analyticsData.capabilities?.includes('PHOTOGRAPHY');

    const renderShopAnalytics = () => {
      const maxRev = Math.max(...analyticsData.revenueGrowth.map((r: any) => r.value), 1000000);
      const points = analyticsData.revenueGrowth.map((r: any, idx: number) => {
        const x = 50 + idx * 80;
        const y = 260 - (r.value / maxRev) * 200;
        return `${x},${y}`;
      }).join(' ');

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#4A0E17' }}>Quản trị Cửa hàng</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Phân tích số liệu vận hành và doanh thu áo dài của bạn.</p>
            </div>
            {isShop && isPhoto && (
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-light-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                <button type="button" onClick={() => setSubTab('shop')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: subTab === 'shop' ? 'white' : 'transparent', color: subTab === 'shop' ? '#4A0E17' : 'var(--color-text-secondary)', boxShadow: subTab === 'shop' ? 'var(--shadow-sm)' : 'none' }}>Cửa hàng</button>
                <button type="button" onClick={() => setSubTab('photo')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: subTab === 'photo' ? 'white' : 'transparent', color: subTab === 'photo' ? '#4A0E17' : 'var(--color-text-secondary)', boxShadow: subTab === 'photo' ? 'var(--shadow-sm)' : 'none' }}>Nhiếp ảnh</button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            {[
              { label: 'Doanh thu cửa hàng', val: `${(analyticsData.totalRevenue || 0).toLocaleString('vi-VN')} đ`, desc: 'Tổng doanh thu thực', color: '#4A0E17', bg: '#FAF6F0' },
              { label: 'Tỷ lệ thành công', val: `${analyticsData.successRate}%`, desc: 'Booking hoàn thành', color: '#166534', bg: '#F0FDF4' },
              { label: 'Tỷ lệ hủy lịch', val: `${analyticsData.cancelRate}%`, desc: 'Lịch khách hủy', color: '#991B1B', bg: '#FEE2E2' },
              { label: 'Tổng sản phẩm', val: `${String(analyticsData.totalProducts).padStart(2, '0')} Item`, desc: 'Đồ đang hoạt động', color: '#706E3B', bg: '#FAF6F0' },
              { label: 'Thời gian thuê tb', val: analyticsData.averageRentalDuration, desc: 'Thời gian mỗi đơn', color: '#15803D', bg: '#F0FDF4' }
            ].map((m, idx) => (
              <div key={idx} style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: idx === 0 ? '#4A0E17' : '#2A2A2A', marginTop: '6px', wordBreak: 'break-all' }}>{m.val}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid #F0ECE4', paddingTop: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{m.desc}</span>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color, fontWeight: 700, fontSize: '10px' }}>
                    {idx === 0 ? '💰' : idx === 1 ? '✓' : idx === 2 ? '✕' : idx === 3 ? '📦' : '⏱'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Doanh thu Áo dài</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <svg viewBox="0 0 500 300" style={{ width: '100%', height: '100%' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                    const y = 40 + p * 200;
                    return (
                      <line key={idx} x1="40" y1={y} x2="480" y2={y} stroke="#F0ECE4" strokeDasharray="3 3" />
                    );
                  })}
                  <polyline fill="none" stroke="#4A0E17" strokeWidth="3" points={points} />
                  {analyticsData.revenueGrowth.map((r: any, idx: number) => {
                    const x = 50 + idx * 80;
                    const y = 260 - (r.value / maxRev) * 200;
                    return (
                      <g key={idx}>
                        <circle cx={x} cy={y} r="5" fill="#4A0E17" />
                        <circle cx={x} cy={y} r="2" fill="white" />
                        <text x={x} y={y - 12} textAnchor="middle" fontSize="9" fontWeight="700" fill="#2A2A2A">{(r.value/1000000).toFixed(1)}M</text>
                        <text x={x} y="285" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-text-secondary)">{r.label.replace('Tháng ', 'T')}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Top Phổ biến</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {analyticsData.popularProducts && analyticsData.popularProducts.length > 0 ? (
                  analyticsData.popularProducts.map((p: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: idx < 2 ? '1px solid var(--color-light-border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={getImageUrl(p.image)} alt={p.name} style={{ width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover' }} />
                        <div>
                          <strong style={{ fontSize: '13px', color: '#2A2A2A', display: 'block' }}>{p.name}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Mẫu áo được thuê nhiều</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '14px', color: '#4A0E17' }}>{p.count}</strong>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block' }}>lượt thuê</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600 }}>Chưa có lượt thuê áo dài nào.</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-light-border)' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Báo cáo hàng tồn kho & Bảo trì</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-light-bg)', borderBottom: '1px solid var(--color-light-border)' }}>
                  <th style={{ padding: '14px 24px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>TÊN SẢN PHẨM</th>
                  <th style={{ padding: '14px 24px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>TRẠNG THÁI</th>
                  <th style={{ padding: '14px 24px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>SỐ LƯỢNG</th>
                  <th style={{ padding: '14px 24px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>CHI TIẾT</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.inventoryStatus.map((item: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-light-border)' }}>
                    <td style={{ padding: '16px 24px', fontWeight: 700, color: '#2A2A2A' }}>{item.name}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                        backgroundColor: item.color === 'rental' ? '#EBF8FF' : '#FEF3C7',
                        color: item.color === 'rental' ? '#2B6CB0' : '#D69E2E'
                      }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 600 }}>{item.count}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--color-text-secondary)' }}>{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    const renderPhotoAnalytics = () => {
      const maxVal = Math.max(...analyticsData.revenueGrowth.map((r: any) => r.value), 1000000);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#4A0E17' }}>Tổng quan Hiệu suất</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Thống kê doanh thu, lịch trình chụp và phản hồi đánh giá của bạn.</p>
            </div>
            {isShop && isPhoto && (
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-light-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                <button type="button" onClick={() => setSubTab('shop')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: subTab === 'shop' ? 'white' : 'transparent', color: subTab === 'shop' ? '#4A0E17' : 'var(--color-text-secondary)', boxShadow: subTab === 'shop' ? 'var(--shadow-sm)' : 'none' }}>Cửa hàng</button>
                <button type="button" onClick={() => setSubTab('photo')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: subTab === 'photo' ? 'white' : 'transparent', color: subTab === 'photo' ? '#4A0E17' : 'var(--color-text-secondary)', boxShadow: subTab === 'photo' ? 'var(--shadow-sm)' : 'none' }}>Nhiếp ảnh</button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Doanh thu nhiếp ảnh</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#4A0E17', marginTop: '8px' }}>{(analyticsData.totalRevenue || 84250000).toLocaleString('vi-VN')} VND</div>
              <span style={{ fontSize: '12px', color: '#166534', marginTop: '6px', display: 'block', fontWeight: 600 }}>↑ Tăng trưởng tốt trong mùa lễ</span>
            </div>
            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Phí hoa hồng hệ thống (15%)</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#B89047', marginTop: '8px' }}>{(analyticsData.commissionFee || 12800000).toLocaleString('vi-VN')} VND</div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px', display: 'block' }}>Thu phí tự động hàng tuần</span>
            </div>
            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Hiệu suất đặt lịch</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}><span style={{ color: '#166534' }}>● Thành công:</span> {analyticsData.successRate}%</div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}><span style={{ color: '#991B1B' }}>● Hủy lịch:</span> {analyticsData.cancelRate}%</div>
                </div>
              </div>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534', fontSize: '20px', fontWeight: 700 }}>✓</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Doanh thu theo thời gian</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '280px', paddingTop: '20px' }}>
                {analyticsData.revenueGrowth.map((r: any, idx: number) => {
                  const barHeight = (r.value / maxVal) * 220;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{(r.value/1000000).toFixed(1)}M</span>
                      <div style={{ width: '32px', height: `${barHeight}px`, backgroundColor: '#4A0E17', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{r.label.replace('Tháng ', 'T')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Lịch chụp sắp tới</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analyticsData.upcomingSchedules && analyticsData.upcomingSchedules.length > 0 ? (
                  analyticsData.upcomingSchedules.map((s: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'var(--color-light-bg)' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#2A2A2A', display: 'block' }}>{s.customerName}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{s.date} • {s.time}</span>
                      </div>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                        backgroundColor: s.color === 'deposit' ? '#F0FDF4' : '#FEF3C7',
                        color: s.color === 'deposit' ? '#166534' : '#92400E'
                      }}>{s.status}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600 }}>Chưa có lịch đặt chụp nào.</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '20px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase', alignSelf: 'flex-start' }}>Đánh giá trung bình</h3>
              <div style={{ fontSize: '64px', fontWeight: 900, color: '#4A0E17', lineHeight: 1 }}>{analyticsData.averageRating}</div>
              <div style={{ display: 'flex', gap: '4px', fontSize: '20px', color: '#B89047' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Dựa trên tất cả feedback khách hàng</span>
            </div>

            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Phong cách phổ biến</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {analyticsData.popularConcepts && analyticsData.popularConcepts.length > 0 ? (
                  analyticsData.popularConcepts.map((c: any, idx: number) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                        <span>{c.name}</span>
                        <span>{c.percentage}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-light-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${c.percentage}%`, height: '100%', backgroundColor: c.color, borderRadius: '4px' }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600 }}>Chưa có gói concept nào được đặt.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return subTab === 'shop' ? renderShopAnalytics() : renderPhotoAnalytics();
  };

  const renderInventoryView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý kho áo dài</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              Xem bảng tổng hợp tồn kho, thêm hiện vật mới hoặc cập nhật trạng thái làm sạch/bảo trì cho từng chiếc áo dài.
            </p>
          </div>
          <button 
            onClick={() => {
              if (myProductsList.length > 0) {
                setAddInvProductId(myProductsList[0]._id);
              }
              setIsAddInventoryOpen(true);
            }} 
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-primary)', color: 'white',
              border: 'none', padding: '12px 24px', borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              boxShadow: 'var(--shadow-md)', transition: 'var(--transition-smooth)',
            }}
          >
            <Plus size={16} /> Nhập kho áo dài
          </button>
        </div>

        {/* Search, Filter, Sort Controls */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-sm)' }}>
          {/* Search bar */}
          <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Tìm kiếm hiện vật</label>
            <input
              type="text"
              placeholder="Tìm theo SKU hoặc tên áo dài..."
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Trạng thái hoạt động</label>
            <select
              value={invStatusFilter}
              onChange={(e) => setInvStatusFilter(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none', backgroundColor: 'white' }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="AVAILABLE">Sẵn sàng (Available)</option>
              <option value="RENTED">Đang thuê (Rented)</option>
              <option value="CLEANING">Đang giặt (Cleaning)</option>
              <option value="MAINTENANCE">Bảo trì (Maintenance)</option>
            </select>
          </div>

          {/* Condition Filter */}
          <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Tình trạng chất lượng</label>
            <select
              value={invConditionFilter}
              onChange={(e) => setInvConditionFilter(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none', backgroundColor: 'white' }}
            >
              <option value="">Tất cả chất lượng</option>
              <option value="NEW">Mới (New)</option>
              <option value="GOOD">Tốt (Good)</option>
              <option value="MINOR_DAMAGE">Hỏng nhẹ</option>
              <option value="LOCKED">Đang khóa (Locked)</option>
              <option value="RETIRED">Đã thanh lý (Retired)</option>
            </select>
          </div>

          {/* Sort */}
          <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Sắp xếp theo</label>
            <select
              value={invSortBy}
              onChange={(e) => setInvSortBy(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none', backgroundColor: 'white' }}
            >
              <option value="newest">Mới nhất (Nhập sau)</option>
              <option value="oldest">Cũ nhất (Nhập trước)</option>
              <option value="sku_asc">Mã SKU: A - Z</option>
              <option value="sku_desc">Mã SKU: Z - A</option>
            </select>
          </div>
        </div>

        {isLoadingInventory ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            Đang tải dữ liệu kho áo dài...
          </div>
        ) : (
          <>
            {/* 1. SUMMARY VIEW */}
            <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>
                BẢNG TỔNG HỢP TỒN KHO BIẾN THỂ
              </h3>
              {inventorySummary.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Chưa có biến thể áo dài nào trong kho.</div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-light-bg)', borderBottom: '1px solid var(--color-light-border)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÊN SẢN PHẨM</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SIZE</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÀU SẮC</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TỔNG KHO</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#166534' }}>KHẢ DỤNG</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1D4ED8' }}>ĐANG THUÊ</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#B45309' }}>GIẶT / BẢO TRÌ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventorySummary.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--color-light-border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2A2A2A' }}>{item.productName}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{item.size}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{item.color}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>{item.total}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#166534' }}>{item.available}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1D4ED8' }}>{item.rented}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#B45309' }}>{item.maintenance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. DETAIL VIEW */}
            <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>
                DANH SÁCH CHI TIẾT HIỆN VẬT ÁO DÀI
              </h3>
              {inventoryItems.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Chưa có chiếc áo dài nào trong kho. Hãy bấm "Nhập kho áo dài" để bắt đầu.</div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-light-bg)', borderBottom: '1px solid var(--color-light-border)' }}>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SKU</th>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÊN SẢN PHẨM</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SIZE</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÀU</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHẤT LƯỢNG</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TRẠNG THÁI</th>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GHI CHÚ</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>THAO TÁC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryItems.map((item: any) => {
                        const isRetired = item.conditionStatus === 'RETIRED';
                        return (
                          <tr key={item._id} style={{ borderBottom: '1px solid var(--color-light-border)', opacity: isRetired ? 0.6 : 1 }}>
                            <td style={{ padding: '16px 20px', fontWeight: 700, color: '#4A0E17' }}>{item.sku}</td>
                            <td style={{ padding: '16px 20px', fontWeight: 700 }}>{item.productId?.name || 'Sản phẩm lỗi'}</td>
                            <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{item.size}</td>
                            <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{item.color}</td>
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              <span style={{ 
                                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                backgroundColor: item.conditionStatus === 'NEW' ? '#EEF2F6' : item.conditionStatus === 'GOOD' ? '#F0FDF4' : item.conditionStatus === 'MINOR_DAMAGE' ? '#FFFBEB' : item.conditionStatus === 'LOCKED' ? '#FEF2F2' : '#F4F4F5',
                                color: item.conditionStatus === 'NEW' ? '#475569' : item.conditionStatus === 'GOOD' ? '#166534' : item.conditionStatus === 'MINOR_DAMAGE' ? '#B45309' : item.conditionStatus === 'LOCKED' ? '#991B1B' : '#71717A'
                              }}>
                                {item.conditionStatus === 'NEW' ? 'Mới (New)' : item.conditionStatus === 'GOOD' ? 'Tốt (Good)' : item.conditionStatus === 'MINOR_DAMAGE' ? 'Hỏng nhẹ' : item.conditionStatus === 'LOCKED' ? 'Khóa (Locked)' : 'Thanh lý (Retired)'}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              <span style={{ 
                                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                backgroundColor: item.status === 'AVAILABLE' ? '#ECFDF5' : item.status === 'RENTED' ? '#EFF6FF' : '#FFF7ED',
                                color: item.status === 'AVAILABLE' ? '#047857' : item.status === 'RENTED' ? '#1D4ED8' : '#C2410C'
                              }}>
                                {item.status === 'AVAILABLE' ? 'Sẵn sàng' : item.status === 'RENTED' ? 'Đang thuê' : item.status === 'CLEANING' ? 'Đang giặt' : 'Bảo trì'}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{item.notes || '—'}</td>
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              {!isRetired && (
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button 
                                    onClick={() => {
                                      setEditInvItem(item);
                                      setEditInvStatus(item.status);
                                      setEditInvCondition(item.conditionStatus);
                                      setEditInvNotes(item.notes || '');
                                      setIsEditInventoryOpen(true);
                                    }}
                                    style={{
                                      padding: '6px 12px', border: '1px solid var(--color-light-border)', borderRadius: '4px',
                                      backgroundColor: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '11px', color: '#4A0E17'
                                    }}
                                  >
                                    Cập nhật
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteInventoryItem(item._id)}
                                    style={{
                                      padding: '6px 12px', border: 'none', borderRadius: '4px',
                                      backgroundColor: '#FEE2E2', cursor: 'pointer', fontWeight: 700, fontSize: '11px', color: '#991B1B'
                                    }}
                                  >
                                    Thanh lý
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Inventory pagination controls */}
                {invTotal > invLimit && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-light-bg)', border: '1px solid var(--color-light-border)', borderRadius: '8px', padding: '14px 20px', marginTop: '16px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      Hiển thị {inventoryItems.length} trên tổng số {invTotal} hiện vật
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        disabled={invPage <= 1} 
                        onClick={() => setInvPage(p => Math.max(1, p - 1))} 
                        style={{ padding: '6px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: invPage > 1 ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}
                      >
                        Trang trước
                      </button>
                      <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white' }}>
                        {invPage} / {Math.ceil(invTotal / invLimit)}
                      </span>
                      <button 
                        disabled={invPage >= Math.ceil(invTotal / invLimit)} 
                        onClick={() => setInvPage(p => p + 1)} 
                        style={{ padding: '6px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: invPage < Math.ceil(invTotal / invLimit) ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </>)}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}>
      {/* SIDEBAR */}
      <aside style={{ width: '280px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px 20px', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div>
          <div style={{ marginBottom: '40px' }}>
            <h1 style={{ fontFamily: 'var(--font-header)', fontSize: '22px', fontWeight: 800, color: 'white', margin: 0 }}>Silk & Stone</h1>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>Rental Marketplace</p>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button onClick={() => setCurrentView('analytics')} style={navItemStyle(currentView === 'analytics')}><BarChart3 size={18} /> Thống kê & Hiệu suất</button>
            <button onClick={() => setCurrentView('orders')} style={navItemStyle(currentView === 'orders')}><ShoppingBag size={18} /> Đơn hàng</button>
            <button onClick={() => setCurrentView('collections')} style={navItemStyle(currentView === 'collections')}><Layers size={18} /> Bộ sưu tập</button>
            <button onClick={() => setCurrentView('profile')} style={navItemStyle(currentView === 'profile')}><Award size={18} /> Thông tin dịch vụ</button>
            <button onClick={() => setCurrentView('portfolio')} style={navItemStyle(currentView === 'portfolio')}><Camera size={18} /> Quản lý Portfolio</button>
            <button onClick={() => setCurrentView('calendar')} style={navItemStyle(currentView === 'calendar')}><Calendar size={18} /> Lịch làm việc & Chặn</button>
            <button onClick={() => setCurrentView('vouchers')} style={navItemStyle(currentView === 'vouchers')}><Tag size={18} /> Mã khuyến mãi</button>
            <button onClick={() => setCurrentView('inventory')} style={navItemStyle(currentView === 'inventory')}><Package size={18} /> Quản lý kho áo dài</button>
            <button onClick={() => setCurrentView('reviews')} style={navItemStyle(currentView === 'reviews')}><MessageSquare size={18} /> Đánh giá & Phản hồi</button>
            <button onClick={() => setCurrentView('trust')} style={navItemStyle(currentView === 'trust')}><Users size={18} /> Đánh giá khách hàng</button>
            <button onClick={() => setCurrentView('payouts')} style={navItemStyle(currentView === 'payouts')}><DollarSign size={18} /> Lịch sử quyết toán</button>
          </nav>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
          <button onClick={() => navigate('/')} style={navItemStyle(false)}><ArrowLeft size={18} /> Trang chủ</button>
          <button onClick={handleLogoutClick} style={{ ...navItemStyle(false), color: '#FCA5A5' }}><LogOut size={18} /> Đăng xuất</button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOP BAR */}
        <header style={{
          height: '60px', borderBottom: '1px solid var(--color-light-border)', backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hệ thống Quản lý nhà cung cấp</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative' }} ref={notiRef}>
              <button 
                onClick={() => { setIsNotiOpen(!isNotiOpen); if (!isNotiOpen) fetchNotifications(); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', position: 'relative' }}
              >
                <Bell size={18} />
                {providerUnreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-5px', right: '-5px',
                    backgroundColor: 'var(--color-primary)', color: 'white',
                    borderRadius: '50%', minWidth: '14px', height: '14px',
                    fontSize: '8px', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}>
                    {providerUnreadCount > 99 ? '99+' : providerUnreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotiOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 10px)', right: '-20px',
                  width: '380px', maxHeight: '480px',
                  backgroundColor: 'white', borderRadius: '12px',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.04)',
                  zIndex: 9999, overflow: 'hidden',
                  animation: 'noti-slide-in 0.2s ease-out'
                }}>
                  {/* Header */}
                  <div style={{
                    padding: '14px 18px', borderBottom: '1px solid #F0EBE3',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, #FAF6F0 0%, #FFF 100%)'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>Thông báo</h3>
                      {providerUnreadCount > 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--color-gold)', fontWeight: 600 }}>{providerUnreadCount} chưa đọc</span>
                      )}
                    </div>
                    {providerUnreadCount > 0 && (
                      <button
                        onClick={handleNotiMarkAllAsRead}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '4px 8px', border: '1px solid #E8E2D5', borderRadius: '5px',
                          backgroundColor: 'white', color: '#706E3B', fontSize: '10px',
                          fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        <CheckCheck size={11} />
                        Đọc tất cả
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                    {loadingNoti ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: '#7A7A7A' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Đang tải...</span>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <Bell size={28} color="#D4C5A9" style={{ marginBottom: '8px' }} />
                        <p style={{ margin: 0, fontSize: '12px', color: '#7A7A7A', fontWeight: 600 }}>Chưa có thông báo</p>
                      </div>
                    ) : (
                      notifications.map((noti) => {
                        const ts = getNotiTypeStyle(noti.type);
                        return (
                          <div
                            key={noti._id}
                            onClick={() => !noti.isRead && handleNotiMarkAsRead(noti._id)}
                            style={{
                              padding: '12px 18px', cursor: 'pointer',
                              borderBottom: '1px solid #F5F0E8',
                              backgroundColor: noti.isRead ? 'white' : '#FFFCF7',
                              transition: 'background 0.15s',
                              display: 'flex', gap: '10px', alignItems: 'flex-start',
                              position: 'relative'
                            }}
                            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#FAF6F0'; }}
                            onMouseOut={e => { e.currentTarget.style.backgroundColor = noti.isRead ? 'white' : '#FFFCF7'; }}
                          >
                            {!noti.isRead && (
                              <div style={{
                                position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)',
                                width: '5px', height: '5px', borderRadius: '50%',
                                backgroundColor: 'var(--color-primary)'
                              }} />
                            )}
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '8px',
                              backgroundColor: ts.bg, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              fontSize: '14px', flexShrink: 0
                            }}>
                              {ts.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                                <span style={{ fontSize: '12px', fontWeight: noti.isRead ? 600 : 750, color: '#2A2A2A' }}>
                                  {noti.title}
                                </span>
                                <span style={{
                                  padding: '1px 4px', borderRadius: '3px', fontSize: '7px',
                                  fontWeight: 700, backgroundColor: ts.bg, color: ts.color,
                                  textTransform: 'uppercase', flexShrink: 0
                                }}>
                                  {noti.type}
                                </span>
                              </div>
                              <p style={{
                                margin: 0, fontSize: '11px', color: '#6B6B6B',
                                lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical' as any, overflow: 'hidden'
                              }}>
                                {noti.content}
                              </p>
                              <span style={{ fontSize: '9px', color: '#B0A89A', fontWeight: 500, marginTop: '3px', display: 'block' }}>
                                {getNotiTimeAgo(noti.createdAt)}
                              </span>
                            </div>
                            {!noti.isRead && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleNotiMarkAsRead(noti._id); }}
                                title="Đánh dấu đã đọc"
                                style={{ background: 'none', border: 'none', padding: '3px', cursor: 'pointer', color: 'var(--color-gold)', flexShrink: 0, opacity: 0.6 }}
                                onMouseOver={e => { e.currentTarget.style.opacity = '1'; }}
                                onMouseOut={e => { e.currentTarget.style.opacity = '0.6'; }}
                              >
                                <Check size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <style>{`
                    @keyframes noti-slide-in {
                      from { opacity: 0; transform: translateY(-6px); }
                      to { opacity: 1; transform: translateY(0); }
                    }
                  `}</style>
                </div>
              )}
            </div>
            <button style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}><HelpCircle size={18} /></button>
            <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--color-light-border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>{provider?.businessName || 'Provider'}</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>PROVIDER</div>
              </div>
              {provider?.avatar || provider?.logoUrl ? (
                <img src={getImageUrl(provider.avatar || provider.logoUrl)} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-light-border)' }} />
              ) : (
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--color-primary-trans)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', color: 'var(--color-primary-dark)', border: '1px solid var(--color-light-border)' }}>
                  {(provider?.businessName || 'P').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CONTENT SWITCH PANEL */}
        {currentView === 'analytics' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            {renderAnalyticsView()}
          </main>
        )}

        {currentView === 'orders' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Đơn hàng</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Theo dõi và cập nhật trạng thái đơn hàng từ các bộ sưu tập di sản Silk & Stone.</p>
              </div>
              <button onClick={() => alert('Export CSV')} style={{
                display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'white', border: '1px solid var(--color-light-border)',
                padding: '10px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                color: 'var(--color-text-primary)', boxShadow: 'var(--shadow-sm)', transition: 'var(--transition-smooth)',
              }}><Download size={14} /> Export CSV</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Trạng thái:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {tabs.map(t => (
                    <button key={t.label} onClick={() => setOrderTab(t.label)} style={{
                      padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
                      backgroundColor: orderTab === t.label ? 'var(--color-dark-bg)' : 'var(--color-light-bg)',
                      color: orderTab === t.label ? 'white' : 'var(--color-text-secondary)',
                      transition: 'var(--transition-smooth)',
                    }}>{t.label} ({t.count})</button>
                  ))}
                </div>
              </div>
              <div style={{
                backgroundColor: '#FDF4F4', border: '1px solid rgba(161,30,34,0.12)', borderRadius: 'var(--radius-md)',
                padding: '24px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Doanh thu tháng này</div>
                <div style={{ fontFamily: 'var(--font-header)', fontSize: '28px', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {monthlyRevenue > 0 ? `${monthlyRevenue.toLocaleString('vi-VN')}đ` : '—'}
                </div>
                <div style={{ position: 'absolute', right: '16px', bottom: '8px', opacity: 0.06, pointerEvents: 'none', color: 'var(--color-primary)' }}><ShoppingBag size={80} /></div>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-light-border)', backgroundColor: 'var(--color-light-bg)' }}>
                    {['MÃ ĐƠN HÀNG', 'KHÁCH HÀNG', 'SẢN PHẨM', 'NGÀY ĐẶT', 'TỔNG CỘNG', 'TRẠNG THÁI', 'THAO TÁC'].map(h => (
                      <th key={h} style={{ padding: '14px 20px', fontWeight: 700, fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: h === 'TỔNG CỘNG' ? 'right' : h === 'TRẠNG THÁI' || h === 'THAO TÁC' ? 'center' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingOrders ? (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải đơn hàng...</td></tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Không có đơn hàng nào.</td></tr>
                  ) : filteredOrders.map(o => (
                    <tr key={o._id} style={{ borderBottom: '1px solid var(--color-light-border)', transition: 'var(--transition-smooth)' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 700 }}>{o.id}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-light-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-secondary)', border: '1px solid var(--color-light-border)' }}>{o.customerInitials}</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px' }}>{o.customerName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{o.customerEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 600 }}>{o.productName}</td>
                      <td style={{ padding: '16px 20px', color: 'var(--color-text-secondary)' }}>{o.orderDate}</td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'right' }}>{o.total}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}><span style={statusBadgeStyle(o.status)}>{o.status}</span></td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', position: 'relative' }}>
                        <button onClick={() => setActionMenuId(actionMenuId === o._id ? null : o._id)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}><MoreVertical size={16} /></button>
                        {actionMenuId === o._id && (
                          <div style={{ position: 'absolute', right: '20px', top: '40px', width: '180px', backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', padding: '4px 0', zIndex: 40 }}>
                            {[
                              { label: 'Hoàn thành', status: 'HOÀN THÀNH', icon: <CheckCircle size={14} />, color: '#2e7d32' },
                              { label: 'Đang thực hiện', status: 'ĐANG XỬ LÝ', icon: <Play size={14} />, color: 'var(--color-gold)' },
                              { label: 'Chờ xử lý', status: 'CHỜ XỬ LÝ', icon: <FileText size={14} />, color: 'var(--color-primary)' },
                            ].map(a => (
                              <button key={a.label} onClick={() => changeOrderStatus(o._id, a.status)} style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer', color: a.color,
                                fontWeight: 500, textAlign: 'left',
                              }}>{a.icon} {a.label}</button>
                            ))}
                            {(o.rawStatus === 'CONFIRMED' || o.rawStatus === 'COMPLETED' || o.rawStatus === 'PICKED_UP' || o.rawStatus === 'RETURNED' || o.rawStatus === 'RETURN_PENDING' || o.rawStatus === 'DISPUTED') && (
                              <button onClick={() => {
                                setReportingOrder(o);
                                setSelectedItemId(o.items?.[0]?._id || '');
                                setIncidentDesc('');
                                setIncidentEvidence('');
                                setIncidentAmount(o.depositTotal || 0);
                                setIncidentActionType('CLEANING');
                                setActionMenuId(null);
                              }} style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-primary)',
                                fontWeight: 700, textAlign: 'left', borderTop: '1px solid var(--color-light-border)'
                              }}><Flag size={14} /> Báo cáo hỏng đồ</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ borderTop: '1px solid var(--color-light-border)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-light-bg)', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Hiển thị {filteredOrders.length} đơn hàng</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button disabled={activePage <= 1} onClick={() => setActivePage(p => Math.max(1, p - 1))} style={{ padding: '6px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: activePage > 1 ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}><ChevronLeft size={14} /></button>
                  <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white' }}>{activePage}</span>
                  <button disabled={filteredOrders.length < 20} onClick={() => setActivePage(p => p + 1)} style={{ padding: '6px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: filteredOrders.length >= 20 ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}><ChevronRight size={14} /></button>
                </div>
              </div>
            </div>
          </main>
        )}

        {currentView === 'collections' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Bộ sưu tập</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>
                  Thêm mới, cập nhật giá, hình ảnh và quản lý kho áo dài của bạn.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={openCampaignModal} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: activeCampaign ? '#B91C1C' : '#EF4444',
                  padding: '10px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  color: 'white', border: 'none', boxShadow: 'var(--shadow-sm)', transition: 'var(--transition-smooth)',
                }}>
                  <Tag size={14} /> {activeCampaign ? `Khuyến mãi (-${activeCampaign.discountPercent}%)` : 'Khuyến mãi'}
                </button>
                <button onClick={openAddModal} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-primary)',
                  padding: '10px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  color: 'white', border: 'none', boxShadow: 'var(--shadow-sm)', transition: 'var(--transition-smooth)',
                }}><Plus size={14} /> Thêm Áo Dài mới</button>
              </div>
            </div>

            {/* Search and Sort controls */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
              <input
                type="text"
                placeholder="Tìm kiếm áo dài theo tên..."
                value={prodSearch}
                onChange={(e) => { setProdSearch(e.target.value); setProdPage(1); }}
                style={{ flex: 1, minWidth: '200px', padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
              />
              <select
                value={prodSizeFilter}
                onChange={(e) => { setProdSizeFilter(e.target.value); setProdPage(1); }}
                style={{ width: '130px', padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none', backgroundColor: 'white' }}
              >
                <option value="">Tất cả Size</option>
                <option value="S">Size S</option>
                <option value="M">Size M</option>
                <option value="L">Size L</option>
                <option value="XL">Size XL</option>
                <option value="XXL">Size XXL</option>
              </select>
              <select
                value={prodColorFilter}
                onChange={(e) => { setProdColorFilter(e.target.value); setProdPage(1); }}
                style={{ width: '140px', padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none', backgroundColor: 'white' }}
              >
                <option value="">Tất cả Màu</option>
                <option value="RED">Đỏ (Red)</option>
                <option value="WHITE">Trắng (White)</option>
                <option value="GOLD">Vàng (Gold)</option>
                <option value="BLACK">Đen (Black)</option>
                <option value="PINK">Hồng (Pink)</option>
                <option value="BLUE">Xanh dương</option>
                <option value="GREEN">Xanh lá</option>
                <option value="BROWN">Nâu</option>
              </select>
              <select
                value={prodSortBy}
                onChange={(e) => { setProdSortBy(e.target.value); setProdPage(1); }}
                style={{ width: '180px', padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none', backgroundColor: 'white' }}
              >
                <option value="newest">Mới nhất (Newest)</option>
                <option value="price_asc">Giá thuê: Thấp - Cao</option>
                <option value="price_desc">Giá thuê: Cao - Thấp</option>
              </select>
            </div>

            {loadingProducts ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Đang tải dữ liệu sản phẩm...
              </div>
            ) : products.length === 0 ? (
              <div style={{ padding: '100px 40px', textAlign: 'center', backgroundColor: 'white', border: '1px dashed var(--color-light-border)', borderRadius: 'var(--radius-md)' }}>
                <Layers size={48} style={{ color: 'var(--color-text-secondary)', opacity: 0.5, marginBottom: '16px', margin: '0 auto' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Bộ sưu tập của bạn đang trống</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '6px', marginBottom: '20px' }}>Bắt đầu bằng việc thêm sản phẩm đầu tiên để tiếp cận hàng ngàn khách hàng.</p>
                <button onClick={openAddModal} className="vh-btn vh-btn-primary" style={{ padding: '10px 20px', borderRadius: '6px' }}>Thêm Áo Dài đầu tiên</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                {products.map((p) => (
                  <div key={p._id} style={{
                    backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)',
                    boxShadow: 'var(--shadow-sm)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease',
                  }}>
                    {/* Image */}
                    <div style={{ height: '220px', overflow: 'hidden', position: 'relative', backgroundColor: 'var(--color-light-bg)' }}>
                      <img 
                        src={getImageUrl(p.images?.[0])} 
                        alt={p.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      <span style={{
                        position: 'absolute', top: '12px', right: '12px',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                        backgroundColor: p.status === 'ACTIVE' ? 'var(--color-dark-bg)' : p.status === 'DRAFT' ? 'var(--color-gold)' : '#999',
                        color: 'white',
                      }}>
                        {p.status === 'ACTIVE' ? 'ĐANG BÁN' : p.status === 'DRAFT' ? 'DỰ THẢO' : 'ẨN'}
                      </span>
                    </div>

                    {/* Meta */}
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {typeof p.categoryId === 'object' ? p.categoryId.name : 'Áo dài'}
                      </span>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.4 }}>
                        {p.name}
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '36px' }}>
                        {p.description || 'Không có mô tả sản phẩm.'}
                      </p>

                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {p.sizes?.map(s => (
                          <span key={s} style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', border: '1px solid var(--color-light-border)', borderRadius: '4px', backgroundColor: 'var(--color-light-bg)' }}>{s}</span>
                        ))}
                      </div>

                      <div style={{ borderTop: '1px solid var(--color-light-border)', paddingTop: '12px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>GIÁ THUÊ / NGÀY</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>{(p.basePrice ?? (p as any).price ?? 0).toLocaleString('vi-VN')}đ</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>TIỀN ĐẶT CỌC</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right' }}>{(p.depositAmount ?? 0).toLocaleString('vi-VN')}đ</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--color-light-border)', paddingTop: '12px' }}>
                        <button 
                          onClick={() => openEditModal(p)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            backgroundColor: 'white', border: '1px solid var(--color-light-border)', padding: '8px',
                            borderRadius: '4px', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)',
                            cursor: 'pointer', transition: 'all 0.2s',
                          }}
                        >
                          <Pencil size={12} /> Chỉnh sửa
                        </button>
                        <button 
                          onClick={() => handleDuplicateProduct(p)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            backgroundColor: 'white', border: '1px solid var(--color-light-border)', padding: '8px',
                            borderRadius: '4px', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)',
                            cursor: 'pointer', transition: 'all 0.2s',
                          }}
                        >
                          <Copy size={12} /> Nhân bản
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(p._id, p.name)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px',
                            backgroundColor: 'white', border: '1px solid #FCA5A5', borderRadius: '4px',
                            color: '#EF4444', cursor: 'pointer', transition: 'all 0.2s',
                          }}
                          title="Xóa sản phẩm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Product list pagination bar */}
              {prodTotal > prodLimit && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '8px', padding: '14px 20px', marginTop: '24px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    Hiển thị {products.length} trên tổng số {prodTotal} thiết kế
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      disabled={prodPage <= 1} 
                      onClick={() => setProdPage(p => Math.max(1, p - 1))} 
                      style={{ padding: '6px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: prodPage > 1 ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}
                    >
                      Trang trước
                    </button>
                    <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white' }}>
                      {prodPage} / {Math.ceil(prodTotal / prodLimit)}
                    </span>
                    <button 
                      disabled={prodPage >= Math.ceil(prodTotal / prodLimit)} 
                      onClick={() => setProdPage(p => p + 1)} 
                      style={{ padding: '6px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: prodPage < Math.ceil(prodTotal / prodLimit) ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              )}
            </>)}
          </main>
        )}

        {currentView === 'profile' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Thông tin dịch vụ</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Thiết lập thông tin thương hiệu, showroom nhận đồ và chính sách hủy dịch vụ.</p>
              </div>
            </div>

            {isLoadingProvider ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải thông tin dịch vụ...</div>
            ) : (
              <form onSubmit={handleUpdateProfile} style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '32px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>TÊN THƯƠNG HIỆU / CỬA HÀNG</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>SỐ ĐIỆN THOẠI LIÊN HỆ</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>ĐỊA CHỈ SHOWROOM / ĐỊA ĐIỂM NHẬN ĐỒ</label>
                    <input
                      type="text"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>THÀNH PHỐ</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>TỶ LỆ GIẢM GIÁ COMBO (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={comboDiscountPercent}
                      onChange={(e) => setComboDiscountPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>CHÍNH SÁCH HỦY DỊCH VỤ / HOÀN CỌC</label>
                    <textarea
                      value={cancellationPolicy}
                      onChange={(e) => setCancellationPolicy(e.target.value)}
                      rows={3}
                      style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  style={{ alignSelf: 'flex-start', padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-sm)' }}
                >
                  <Save size={14} />
                  Lưu thay đổi
                </button>
              </form>
            )}
          </main>
        )}

        {currentView === 'portfolio' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Portfolio</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Đăng tải các tác phẩm thiết kế mẫu hoặc các dự án đã hoàn thành của bạn.</p>
              </div>
              <button
                onClick={handleAddPortfolio}
                style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} />
                Thêm tác phẩm mới
              </button>
            </div>

            {isLoadingProvider ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải portfolio...</div>
            ) : !provider?.media?.images || provider.media.images.length === 0 ? (
              <div style={{ padding: '80px 40px', textAlign: 'center', backgroundColor: 'white', border: '1px dashed var(--color-light-border)', borderRadius: 'var(--radius-md)' }}>
                <Camera size={48} style={{ color: 'var(--color-text-secondary)', opacity: 0.5, marginBottom: '16px', margin: '0 auto' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 700 }}>Chưa có tác phẩm nào trong Portfolio</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>Bắt đầu đăng tải hình ảnh chất lượng cao để thu hút khách hàng đặt lịch chụp.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                {provider.media.images.map((img: string, idx: number) => (
                  <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-sm)' }}>
                    <img src={img.startsWith('http') ? img : getImageUrl(img)} alt="Portfolio item" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}>
                      <button
                        onClick={() => handleRemovePortfolio(img)}
                        style={{ padding: '8px 12px', backgroundColor: '#EF4444', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                      >
                        Gỡ ảnh
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        )}

        {currentView === 'calendar' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Lịch làm việc & Chặn</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Thiết lập khung giờ làm việc cố định hàng tuần và chặn các ngày bận đột xuất.</p>
              </div>
            </div>

            {isLoadingProvider ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải lịch trình...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>
                    KHUNG GIỜ LÀM VIỆC CỐ ĐỊNH HẰNG TUẦN
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>NGÀY TRONG TUẦN</span>
                      <select
                        value={selectedDayOfWeek}
                        onChange={(e) => setSelectedDayOfWeek(Number(e.target.value))}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      >
                        {daysOfWeekVn.map((day, idx) => (
                          <option key={idx} value={idx}>{day}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GIỜ MỞ CỬA</span>
                      <input
                        type="text"
                        value={startHour}
                        onChange={(e) => setStartHour(e.target.value)}
                        placeholder="Ví dụ: 08:00"
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GIỜ ĐÓNG CỬA</span>
                      <input
                        type="text"
                        value={endHour}
                        onChange={(e) => setEndHour(e.target.value)}
                        placeholder="Ví dụ: 18:00"
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                    <button
                      onClick={handleAddRecurringSchedule}
                      style={{ padding: '11px 20px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
                    >
                      Lưu khung giờ
                    </button>
                  </div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>
                    CHẶN LỊCH NGHỈ / LỊCH BẬN ĐỘT XUẤT
                  </h3>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '240px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHỌN NGÀY CHẶN</span>
                      <input
                        type="date"
                        value={blockedDate}
                        onChange={(e) => setBlockedDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                    <button
                      onClick={handleBlockDate}
                      style={{ padding: '11px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: '#EF4444', color: 'white', cursor: 'pointer' }}
                    >
                      Xác nhận chặn ngày bận
                    </button>
                  </div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>
                    LỊCH TRÌNH ĐÃ THIẾT LẬP
                  </h3>
                  {schedules.length === 0 ? (
                    <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>Chưa có thiết lập khung giờ nào.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {schedules.map((sch) => (
                        <div key={sch._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', backgroundColor: 'var(--color-light-bg)', border: '1px solid var(--color-light-border)', borderRadius: '6px' }}>
                          <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                            {sch.scheduleType === 'RECURRING'
                              ? `Mỗi tuần vào ${daysOfWeekVn[sch.dayOfWeek]}`
                              : `Nghỉ ngày bận đột xuất: ${new Date(sch.specificDate).toLocaleDateString('vi-VN')}`}
                          </strong>
                          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                            {sch.scheduleType === 'RECURRING'
                              ? sch.workingHours?.map((h: any) => `${h.start} - ${h.end}`).join(', ')
                              : 'CHẶN NGHỈ CẢ NGÀY'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        )}

        {currentView === 'vouchers' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Mã khuyến mãi</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Tạo các chương trình khuyến mãi, giảm giá trực tiếp theo % hoặc tiền mặt cho khách hàng.</p>
              </div>
            </div>

            {isLoadingProvider ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải danh sách voucher...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <form onSubmit={handleAddVoucher} style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0, borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>TẠO MÃ KHUYẾN MÃI MỚI</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÃ CODE (IN HOA, VIẾT LIỀN)</span>
                      <input
                        type="text"
                        placeholder="Ví dụ: SILKSTONE10"
                        value={vCode}
                        onChange={(e) => setVCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÊN CHƯƠNG TRÌNH KHUYẾN MÃI</span>
                      <input
                        type="text"
                        placeholder="Ví dụ: Giảm giá hè rực rỡ"
                        value={vName}
                        onChange={(e) => setVName(e.target.value)}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>LOẠI GIẢM GIÁ</span>
                      <select
                        value={vType}
                        onChange={(e) => setVType(e.target.value)}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                      >
                        <option value="PERCENTAGE">Giảm theo Phần trăm (%)</option>
                        <option value="FIXED_AMOUNT">Giảm số tiền mặt cố định (đ)</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GIÁ TRỊ GIẢM</span>
                      <input
                        type="number"
                        value={vValue}
                        onChange={(e) => setVValue(Number(e.target.value))}
                        style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    style={{ alignSelf: 'flex-start', padding: '11px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
                  >
                    Tạo Voucher ngay
                  </button>
                </form>

                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>DANH SÁCH VOUCHERS HOẠT ĐỘNG</h3>
                  {vouchers.length === 0 ? (
                    <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>Chưa có mã khuyến mãi nào được tạo.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {vouchers.map((v) => (
                        <div key={v._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'var(--color-light-bg)' }}>
                          <div>
                            <span style={{ padding: '4px 10px', backgroundColor: 'var(--color-dark-bg)', color: 'white', borderRadius: '4px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em' }}>{v.code}</span>
                            <h5 style={{ fontSize: '14px', fontWeight: 700, margin: '10px 0 4px 0' }}>{v.name}</h5>
                            <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 700 }}>
                              Giảm {v.discountValue.toLocaleString()}{v.discountType === 'PERCENTAGE' ? '%' : 'đ'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteVoucher(v._id)}
                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '6px' }}
                            title="Xóa Voucher"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        )}

        {currentView === 'reviews' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Đánh giá & Phản hồi</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Theo dõi mức độ đánh giá trung bình và trả lời các thắc mắc, phản hồi từ khách hàng.</p>
              </div>
            </div>

            {isLoadingProvider ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải thống kê đánh giá...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: 'var(--radius-md)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>RATING TRUNG BÌNH</span>
                    <strong style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '8px 0' }}>{reviewsData?.averageRating || 0} / 5.0</strong>
                    <div style={{ display: 'flex', gap: '2px', color: 'var(--color-gold)' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={14} fill={s <= Math.round(reviewsData?.averageRating || 0) ? 'currentColor' : 'none'} />
                      ))}
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: 'var(--radius-md)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>TỔNG LƯỢT ĐÁNH GIÁ</span>
                    <strong style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-text-primary)', margin: '8px 0' }}>{reviewsData?.totalReviews || 0}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Lượt nhận xét thực tế từ khách</span>
                  </div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 20px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>DANH SÁCH BÌNH LUẬN NỔI BẬT</h3>
                  {!reviewsData?.reviews || reviewsData.reviews.length === 0 ? (
                    <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>Chưa có lượt đánh giá nào cho cửa hàng của bạn.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {reviewsData.reviews.map((r: any) => (
                        <div key={r._id} style={{ padding: '16px', border: '1px solid var(--color-light-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', gap: '2px', color: 'var(--color-gold)' }}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star key={s} size={11} fill={s <= r.rating ? 'currentColor' : 'none'} />
                                ))}
                              </div>
                              <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '8px 0 0 0' }}>{r.comment || 'Không có bình luận.'}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleReportReview(r._id)}
                                style={{ padding: '4px 10px', backgroundColor: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: '6px', color: '#C53030', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Flag size={11} />
                                Báo cáo Spam
                              </button>
                              <button
                                onClick={() => { setReplyingReviewId(r._id); setReplyText(r.reply || ''); }}
                                style={{ padding: '4px 12px', backgroundColor: 'var(--color-dark-bg)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Phản hồi
                              </button>
                            </div>
                          </div>

                          {/* Reply display */}
                          {r.reply && (
                            <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-light-bg)', borderRadius: '6px', borderLeft: '3px solid var(--color-primary)', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                              <strong>Phản hồi của shop: </strong> {r.reply}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        )}

        {currentView === 'trust' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Đánh giá khách hàng & Tín nhiệm</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Đánh giá hai chiều sau khi hoàn thành dịch vụ và tra cứu độ uy tín của khách hàng.</p>
              </div>
            </div>

            {isLoadingProvider ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải dữ liệu...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0, borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>TRA CỨU ĐỘ TÍN NHIỆM KHÁCH HÀNG</h3>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="text"
                      placeholder="Nhập mã ID khách hàng để tra cứu..."
                      value={searchCustId}
                      onChange={(e) => setSearchCustId(e.target.value)}
                      style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                    />
                    <button
                      onClick={handleSearchTrustScore}
                      style={{ padding: '11px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
                    >
                      Tra cứu tín nhiệm
                    </button>
                  </div>
                  {trustScoreResult && (
                    <div style={{ padding: '16px', backgroundColor: 'var(--color-light-bg)', borderRadius: '8px', border: '1px solid var(--color-light-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>ĐIỂM TÍN NHIỆM TRUNG BÌNH</span>
                        <strong style={{ display: 'block', fontSize: '24px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                          {trustScoreResult.averageRating} / 5.0
                        </strong>
                      </div>
                      <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>Dựa trên {trustScoreResult.totalReviews} lượt đánh giá hành vi từ các đối tác.</span>
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 20px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>ĐƠN HÀNG CHỜ ĐÁNH GIÁ HÀNH VI</h3>
                  {bookingsState.length === 0 ? (
                    <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>Không có đơn đặt lịch nào khả dụng để đánh giá.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {bookingsState.map((booking) => (
                        <div key={booking._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'white' }}>
                          <div>
                            <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{booking.bookingCode}</strong>
                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Mã khách hàng: {booking.customerId}</p>
                          </div>
                          <button
                            onClick={() => setRatingBooking({ bookingId: booking._id, customerId: booking.customerId })}
                            style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
                          >
                            Đánh giá khách hàng
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        )}

        {currentView === 'payouts' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Lịch sử quyết toán từ hệ thống</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Danh sách các khoản thanh toán đã được hệ thống chuyển khoản cho bạn sau khi đơn hàng hoàn thành.</p>
              </div>
            </div>

            {isLoadingProvider ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải dữ liệu quyết toán...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 20px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>DANH SÁCH CÁC KHOẢN QUYẾT TOÁN</h3>
                  {payouts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--color-text-secondary)' }}>
                      <DollarSign size={40} style={{ margin: '0 auto 12px auto', opacity: 0.3 }} />
                      <p style={{ fontWeight: 700 }}>Chưa có khoản quyết toán nào</p>
                      <p style={{ fontSize: '12.5px', marginTop: '4px' }}>Khi đơn hàng được hoàn thành, tiền quyết toán sẽ tự động gửi vào tài khoản ngân hàng của bạn.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--color-light-bg)', borderBottom: '1px solid var(--color-light-border)' }}>
                            <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>MÃ QUYẾT TOÁN</th>
                            <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>MÃ BOOKING</th>
                            <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>SỐ TIỀN THỰC NHẬN</th>
                            <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>TÀI KHOẢN NHẬN</th>
                            <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>TRẠNG THÁI</th>
                            <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>NGÀY THỰC HIỆN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payouts.map((p: any) => (
                            <tr 
                              key={p.id} 
                              onClick={() => {
                                const bId = p.bookingId?._id || p.bookingId;
                                if (bId) {
                                  setSelectedBookingId(bId);
                                  setIsDetailModalOpen(true);
                                }
                              }}
                              style={{ borderBottom: '1px solid var(--color-light-border)', cursor: 'pointer' }}
                              className="hover:bg-stone-50 transition"
                            >
                              <td style={{ padding: '16px 20px', fontWeight: 700 }}>{p.id}</td>
                              <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-primary-dark)' }}>{p.bookingCode || '—'}</td>
                              <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>{(p.amount || 0).toLocaleString('vi-VN')}đ</td>
                              <td style={{ padding: '16px 20px' }}>
                                <span style={{ fontWeight: 600, color: '#2A2A2A' }}>{p.bank}</span>
                                <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)' }}>{p.account} • {p.accountHolder}</span>
                              </td>
                              <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                <span style={{ 
                                  padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                  backgroundColor: p.status === 'SUCCESS' ? '#F0FDF4' : p.status === 'PENDING' ? '#FEF3C7' : '#FEE2E2',
                                  color: p.status === 'SUCCESS' ? '#166534' : p.status === 'PENDING' ? '#92400E' : '#991B1B'
                                }}>
                                  {p.status === 'SUCCESS' ? 'Thành công' : p.status === 'PENDING' ? 'Đang xử lý' : 'Thất bại'}
                                </span>
                              </td>
                              <td style={{ padding: '16px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{p.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        )}

        {currentView === 'inventory' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            {renderInventoryView()}
          </main>
        )}

        {/* Footer */}
        <footer style={{ borderTop: '1px solid var(--color-light-border)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            <CheckCircle size={14} style={{ color: 'var(--color-primary)' }} />
            <span>HỆ THỐNG QUẢN LÝ DỮ LIỆU DI SẢN SILK & STONE</span>
          </div>
          <div style={{ display: 'flex', gap: '24px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            <a href="#" onClick={e => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Báo cáo hệ thống</a>
            <a href="#" onClick={e => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Trung tâm hỗ trợ</a>
            <a href="#" onClick={e => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Chính sách bảo mật</a>
          </div>
        </footer>
      </div>

      {/* -------------------- MODAL: CAMPAIGN MANAGEMENT -------------------- */}
      <Modal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
        title="Thiết lập chương trình khuyến mãi"
        maxWidth="480px"
      >
        <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
          {activeCampaign && (
            <div style={{ padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '13px', color: '#B91C1C', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 700 }}>Đang chạy chiến dịch: {activeCampaign.occasion} (-{activeCampaign.discountPercent}%)</span>
              <span>Thời gian: {new Date(activeCampaign.startDate).toLocaleDateString('vi-VN')} - {new Date(activeCampaign.endDate).toLocaleDateString('vi-VN')}</span>
              <button 
                type="button" 
                onClick={handleDeactivateCampaign} 
                style={{ 
                  marginTop: '8px', padding: '8px 12px', backgroundColor: '#EF4444', color: 'white', border: 'none', 
                  borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', alignSelf: 'flex-start' 
                }}
              >
                Về giá gốc (Hủy khuyến mãi)
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>DỊP KHUYẾN MÃI *</label>
            <input 
              type="text" 
              placeholder="Ví dụ: Sale Tết 2027, Khai xuân..." 
              value={campaignOccasion}
              onChange={(e) => setCampaignOccasion(e.target.value)}
              required
              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>PHẦN TRĂM GIẢM GIÁ (%) *</label>
            <input 
              type="number" 
              min="1" 
              max="90" 
              placeholder="10" 
              value={campaignPercent}
              onChange={(e) => setCampaignPercent(e.target.value)}
              required
              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>TỪ NGÀY *</label>
              <input 
                type="date" 
                value={campaignStart}
                onChange={(e) => setCampaignStart(e.target.value)}
                required
                style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>ĐẾN NGÀY *</label>
              <input 
                type="date" 
                value={campaignEnd}
                onChange={(e) => setCampaignEnd(e.target.value)}
                required
                style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--color-light-border)', paddingTop: '16px' }}>
            <button 
              type="button" 
              onClick={() => setIsCampaignModalOpen(false)}
              style={{ flex: 1, padding: '10px', backgroundColor: '#F3F4F6', color: '#4B5563', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={submittingCampaign}
              style={{ 
                flex: 2, padding: '10px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', 
                borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: submittingCampaign ? 'not-allowed' : 'pointer' 
              }}
            >
              {submittingCampaign ? 'Đang xử lý...' : activeCampaign ? 'Cập nhật khuyến mãi mới' : 'Kích hoạt khuyến mãi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* -------------------- MODALS: CREATE & EDIT PRODUCT -------------------- */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProduct ? 'Chỉnh sửa thông tin Áo Dài' : 'Đăng ký Áo Dài mới'} 
        maxWidth="650px"
      >
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
          
          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>TÊN ÁO DÀI *</label>
            <input 
              type="text" 
              value={prodName} 
              onChange={e => setProdName(e.target.value)} 
              placeholder="Ví dụ: Áo Dài Gấm Hoa Đỏ Hỷ Sự" 
              style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
              required 
            />
          </div>

          {/* Category & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>DANH MỤC *</label>
              <select 
                value={prodCategoryId} 
                onChange={e => setProdCategoryId(e.target.value)} 
                style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white', outline: 'none' }}
                required
              >
                {categories.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>TRẠNG THÁI HIỂN THỊ</label>
              <select 
                value={prodStatus} 
                onChange={e => setProdStatus(e.target.value as any)} 
                style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white', outline: 'none' }}
              >
                <option value="ACTIVE">Đang hoạt động (Bán)</option>
                <option value="DRAFT">Bản nháp (Ẩn)</option>
                <option value="INACTIVE">Ngừng kinh doanh</option>
              </select>
            </div>
          </div>

          {/* Prices */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>GIÁ THUÊ (VNĐ / NGÀY) *</label>
              <input 
                type="number" 
                value={prodBasePrice} 
                onChange={e => setProdBasePrice(e.target.value)} 
                placeholder="Ví dụ: 350000" 
                style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                required 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>TIỀN ĐẶT CỌC ĐỒ (VNĐ) *</label>
              <input 
                type="number" 
                value={prodDepositAmount} 
                onChange={e => setProdDepositAmount(e.target.value)} 
                placeholder="Ví dụ: 500000" 
                style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                required 
              />
            </div>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>MÔ TẢ SẢN PHẨM</label>
            <textarea 
              value={prodDescription} 
              onChange={e => setProdDescription(e.target.value)} 
              placeholder="Chất liệu lụa, độ co giãn, lưu ý giặt là..." 
              rows={3}
              style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none', resize: 'vertical' }}
            />
          </div>

          {/* Image Upload Component */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>HÌNH ẢNH SẢN PHẨM *</label>
            
            {/* Drag & Drop Area */}
            <div 
              style={{
                border: '2px dashed var(--color-light-border)',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--color-light-bg)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                position: 'relative'
              }}
              onClick={() => document.getElementById('product-image-upload')?.click()}
            >
              <input 
                id="product-image-upload"
                type="file" 
                multiple 
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }} 
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Upload size={28} style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {uploadingImages ? 'Đang tải ảnh lên máy chủ...' : 'Click hoặc Kéo thả nhiều ảnh từ máy của bạn'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Hỗ trợ JPG, PNG, WEBP (Tối đa 10MB)</span>
              </div>
            </div>

            {/* Uploaded Images Preview */}
            {prodImages.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '12px', marginTop: '8px' }}>
                {prodImages.map((imgUrl, index) => (
                  <div key={index} style={{ width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', position: 'relative', border: '1px solid var(--color-light-border)' }}>
                    <img 
                      src={getImageUrl(imgUrl)} 
                      alt={`preview-${index}`} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      style={{
                        position: 'absolute', top: '2px', right: '2px',
                        width: '18px', height: '18px', borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.6)', color: 'white',
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: '10px'
                      }}
                      title="Xóa hình này"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attributes Grid (Sizes, Colors, Materials, Styles, Occasions) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: '20px',
            border: '1px solid var(--color-light-border)',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: '#FAFAFA'
          }}>
            {/* Cột 1: Thuộc tính Vật lý */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Sizes */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kích thước có sẵn (Size)</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {sizesOptions.map(sz => {
                    const isSelected = prodSizes.includes(sz);
                    return (
                      <button 
                        key={sz} 
                        type="button"
                        onClick={() => handleSizeToggle(sz)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          backgroundColor: isSelected ? '#FDF4F4' : 'white',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Colors */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Màu sắc chủ đạo</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {colorsOptions.map(c => {
                    const isSelected = prodColors.includes(c);
                    const colorLabel = {
                      RED: 'Đỏ', WHITE: 'Trắng', GOLD: 'Vàng', BLACK: 'Đen',
                      PINK: 'Hồng', BLUE: 'Xanh dương', GREEN: 'Xanh lá', BROWN: 'Nâu'
                    }[c] || c;
                    return (
                      <button 
                        key={c} 
                        type="button"
                        onClick={() => handleColorToggle(c)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          backgroundColor: isSelected ? '#FDF4F4' : 'white',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {colorLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Materials */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chất liệu</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {materialsOptions.map(m => {
                    const isSelected = prodMaterials.includes(m);
                    const materialLabel = {
                      SILK: 'Lụa', VELVET: 'Nhung', BROCADE: 'Gấm', ORGANZA: 'Organza', LINEN: 'Linen'
                    }[m] || m;
                    return (
                      <button 
                        key={m} 
                        type="button"
                        onClick={() => handleMaterialToggle(m)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          backgroundColor: isSelected ? '#FDF4F4' : 'white',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {materialLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cột 2: Phân loại Onboarding (Trường phái & Dịp lễ) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '1px solid var(--color-light-border)', paddingLeft: '20px' }}>
              {/* Design Style */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trường phái thiết kế *</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[
                    { key: 'traditional', label: 'Truyền thống' },
                    { key: 'modern', label: 'Cách tân' },
                    { key: 'edgy', label: 'Phá cách' }
                  ].map(st => {
                    const isSelected = prodStyle === st.key;
                    return (
                      <button 
                        key={st.key} 
                        type="button"
                        onClick={() => setProdStyle(st.key)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          backgroundColor: isSelected ? '#FDF4F4' : 'white',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Occasions */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dịp lễ / Sự kiện phù hợp</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {[
                    { key: 'graduation', label: 'Chụp ảnh kỷ yếu' },
                    { key: 'wedding', label: 'Dự đám cưới' },
                    { key: 'festival', label: 'Lễ hội truyền thống' },
                    { key: 'event', label: 'Biểu diễn/Sự kiện' }
                  ].map(oc => {
                    const isSelected = prodOccasions.includes(oc.key);
                    return (
                      <button 
                        key={oc.key} 
                        type="button"
                        onClick={() => handleOccasionToggle(oc.key)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          backgroundColor: isSelected ? '#FDF4F4' : 'white',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ marginRight: '6px' }}>{isSelected ? '✓' : '+'}</span>
                        {oc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--color-light-border)', paddingTop: '16px' }}>
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              style={{ padding: '10px 20px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', cursor: 'pointer' }}
            >
              Hủy
            </button>
            <button 
              type="submit"
              style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
            >
              {editingProduct ? 'Lưu thay đổi' : 'Đăng áo dài'}
            </button>
          </div>

        </form>
      </Modal>
      {/* Review reply modal popup */}
      {replyingReviewId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <form onSubmit={handleReplyReview} style={{ width: '100%', maxWidth: '440px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>PHẢN HỒI ĐÁNH GIÁ CỦA KHÁCH HÀNG</h4>
              <button type="button" onClick={() => setReplyingReviewId(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <textarea
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '14px', outline: 'none', resize: 'none', height: '100px', fontFamily: 'inherit' }}
                placeholder="Nhập nội dung phản hồi nhận xét..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                required
              />
              <button
                type="submit"
                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}
              >
                GỬI PHẢN HỒI
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Report incident modal popup */}
      {reportingOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <form onSubmit={handleSendIncidentReport} style={{ width: '100%', maxWidth: '500px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>BÁO CÁO SỰ CỐ / HỎNG ĐỒ</h4>
              <button type="button" onClick={() => setReportingOrder(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto' }}>
              
              {/* Chọn sản phẩm bị hỏng */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SẢN PHẨM GẶP SỰ CỐ *</span>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none' }}
                  required
                >
                  <option value="">-- Chọn sản phẩm trong đơn hàng --</option>
                  {(reportingOrder.items || []).map((item: any) => (
                    <option key={item._id} value={item._id}>
                      {item.name || 'Sản phẩm'} ({item.quantity}x - {item.unitPrice?.toLocaleString()}đ)
                    </option>
                  ))}
                </select>
              </div>

              {/* Loại xử lý */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>HÌNH THỨC XỬ LÝ *</span>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="actionType"
                      value="CLEANING"
                      checked={incidentActionType === 'CLEANING'}
                      onChange={() => setIncidentActionType('CLEANING')}
                    />
                    Giặt là vết bẩn (CLEANING)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="actionType"
                      value="MAINTENANCE"
                      checked={incidentActionType === 'MAINTENANCE'}
                      onChange={() => setIncidentActionType('MAINTENANCE')}
                    />
                    Sửa chữa / Đền bù rách, hỏng (MAINTENANCE)
                  </label>
                </div>
              </div>

              {/* Mô tả chi tiết */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÔ TẢ CHI TIẾT SỰ CỐ *</span>
                <textarea
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '14px', outline: 'none', resize: 'none', height: '80px', fontFamily: 'inherit' }}
                  placeholder="Nhập chi tiết vết bẩn hoặc vị trí rách hỏng của sản phẩm..."
                  value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  required
                />
              </div>

              {/* Ảnh bằng chứng */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>ẢNH CHỤP BẰNG CHỨNG (CÁCH NHAU BẰNG DẤU PHẨY)</span>
                <input
                  type="text"
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', fontSize: '13px', outline: 'none' }}
                  placeholder="Link ảnh bằng chứng 1, Link ảnh bằng chứng 2..."
                  value={incidentEvidence}
                  onChange={(e) => setIncidentEvidence(e.target.value)}
                />
              </div>

              {/* Số tiền yêu cầu đền bù */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TIỀN ĐỀN BÙ YÊU CẦU *</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>Tối đa cọc giữ đồ: {reportingOrder.depositTotal?.toLocaleString()}đ</span>
                </div>
                <input
                  type="number"
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', fontSize: '14px', outline: 'none' }}
                  placeholder="Nhập số tiền yêu cầu đền bù..."
                  value={incidentAmount}
                  onChange={(e) => setIncidentAmount(Number(e.target.value))}
                  min={0}
                  max={reportingOrder.depositTotal}
                  required
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', marginTop: '8px' }}
              >
                GỬI BÁO CÁO SỰ CỐ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rate customer modal popup */}
      {ratingBooking && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <form onSubmit={handleRateCustomer} style={{ width: '100%', maxWidth: '440px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>ĐÁNH GIÁ KHÁCH HÀNG (TWO-WAY REVIEW)</h4>
              <button type="button" onClick={() => setRatingBooking(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>MỨC ĐỘ UY TÍN / TÍN NHIỆM</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setCRating(star)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-gold)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Star size={24} fill={star <= cRating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '14px', outline: 'none', resize: 'none', height: '80px', fontFamily: 'inherit' }}
                placeholder="Ghi nhận xét về khách hàng (ví dụ: trả trang phục đúng hạn, giữ gìn sạch sẽ)..."
                value={cComment}
                onChange={(e) => setCComment(e.target.value)}
              />
              <button
                type="submit"
                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}
              >
                XÁC NHẬN ĐÁNH GIÁ KHÁCH
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
        onCustomerClick={viewCustomerTrust}
        viewerRole="provider"
      />

      {/* Modal Nhập Kho Áo Dài */}
      {isAddInventoryOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <form onSubmit={handleCreateInventoryItem} style={{ width: '100%', maxWidth: '480px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>NHẬP KHO ÁO DÀI MỚI</h4>
              <button type="button" onClick={() => setIsAddInventoryOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Chọn sản phẩm */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SẢN PHẨM *</label>
                <select
                  value={addInvProductId}
                  onChange={(e) => setAddInvProductId(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px', backgroundColor: 'white' }}
                  required
                >
                  <option value="">-- Chọn áo dài của shop --</option>
                  {myProductsList.map((prod: any) => (
                    <option key={prod._id} value={prod._id}>{prod.name}</option>
                  ))}
                </select>
              </div>

              {/* Kích cỡ & Màu sắc */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>KÍCH CỠ (SIZE) *</label>
                  <input
                    type="text"
                    value={addInvSize}
                    onChange={(e) => setAddInvSize(e.target.value)}
                    placeholder="M, L, XL..."
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px' }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÀU SẮC *</label>
                  <input
                    type="text"
                    value={addInvColor}
                    onChange={(e) => setAddInvColor(e.target.value)}
                    placeholder="RED, WHITE, GOLD..."
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px' }}
                    required
                  />
                </div>
              </div>

              {/* Số lượng & Chất lượng ban đầu */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SỐ LƯỢNG NHẬP KHO *</label>
                  <input
                    type="number"
                    value={addInvQuantity}
                    onChange={(e) => setAddInvQuantity(Number(e.target.value))}
                    min={1}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px' }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÌNH TRẠNG CHẤT LƯỢNG *</label>
                  <select
                    value={addInvCondition}
                    onChange={(e) => setAddInvCondition(e.target.value)}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px', backgroundColor: 'white' }}
                    required
                  >
                    <option value="NEW">Mới (New)</option>
                    <option value="GOOD">Tốt (Good)</option>
                    <option value="MINOR_DAMAGE">Hỏng nhẹ (Minor Damage)</option>
                  </select>
                </div>
              </div>

              {/* Ghi chú */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GHI CHÚ KHO</label>
                <input
                  type="text"
                  value={addInvNotes}
                  onChange={(e) => setAddInvNotes(e.target.value)}
                  placeholder="Nhập ghi chú hoặc mã lô hàng..."
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddInventoryOpen(false)}
                  style={{ padding: '10px 18px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
                >
                  Thêm vào kho
                </button>
              </div>

            </div>
          </form>
        </div>
      )}

      {/* Modal Cập Nhật Trạng Thái & Chất Lượng */}
      {isEditInventoryOpen && editInvItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <form onSubmit={handleUpdateInventoryItem} style={{ width: '100%', maxWidth: '440px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>CẬP NHẬT HIỆN VẬT: {editInvItem.sku}</h4>
              <button type="button" onClick={() => setIsEditInventoryOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Thông tin cố định */}
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-light-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                <strong>Sản phẩm:</strong> {editInvItem.productId?.name} <br />
                <strong>Kích cỡ / Màu sắc:</strong> {editInvItem.size} / {editInvItem.color}
              </div>

              {/* Chọn trạng thái (AVAILABLE, CLEANING, MAINTENANCE) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TRẠNG THÁI HOẠT ĐỘNG *</label>
                {editInvItem.status === 'RENTED' ? (
                  <div style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: '13.5px', fontWeight: 700 }}>
                    ĐANG CHO THUÊ (Hệ thống tự động khóa)
                  </div>
                ) : (
                  <select
                    value={editInvStatus}
                    onChange={(e) => setEditInvStatus(e.target.value)}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px', backgroundColor: 'white' }}
                    required
                  >
                    <option value="AVAILABLE">Sẵn sàng (Available)</option>
                    <option value="CLEANING">Đang giặt ủi (Cleaning)</option>
                    <option value="MAINTENANCE">Bảo trì (Maintenance)</option>
                  </select>
                )}
              </div>

              {/* Chọn chất lượng (NEW, GOOD, MINOR_DAMAGE, LOCKED, RETIRED) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÌNH TRẠNG CHẤT LƯỢNG *</label>
                <select
                  value={editInvCondition}
                  onChange={(e) => setEditInvCondition(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px', backgroundColor: 'white' }}
                  required
                >
                  <option value="NEW">Mới (New)</option>
                  <option value="GOOD">Tốt (Good)</option>
                  <option value="MINOR_DAMAGE">Hỏng nhẹ (Minor Damage)</option>
                  <option value="LOCKED">Khóa tạm thời (Locked)</option>
                  <option value="RETIRED">Thanh lý (Retired)</option>
                </select>
              </div>

              {/* Ghi chú */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GHI CHÚ CHI TIẾT</label>
                <textarea
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '13.5px', outline: 'none', resize: 'none', height: '60px', fontFamily: 'inherit' }}
                  placeholder="Mô tả sự cố hoặc tình trạng hiện tại..."
                  value={editInvNotes}
                  onChange={(e) => setEditInvNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditInventoryOpen(false)}
                  style={{ padding: '10px 18px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
                >
                  Lưu thay đổi
                </button>
              </div>

            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ProviderDashboard;
