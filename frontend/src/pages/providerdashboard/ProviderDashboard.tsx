import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Layers, Camera, Plus, Download, Bell,
  HelpCircle, MoreVertical, ChevronLeft, ChevronRight, CheckCircle, Trash2, Play, Pencil, Copy, Package, Eye,
  Upload, X, Award, Calendar, Tag, MessageSquare, Users, Save, Flag, Star, ArrowLeft, LogOut, BarChart3, DollarSign, Check, CheckCheck, Clock, ShieldCheck, AlertTriangle, Sparkles
} from 'lucide-react';
import { BookingDetailModal } from '../../components/common/BookingDetailModal';
import Swal from 'sweetalert2';
import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { API_BASE_URL } from '../../config/env';
import { SmartTagEditor } from '../../features/smart-tagging/components/SmartTagEditor';
import { PrivateEvidenceImage } from '../../components/common/PrivateEvidenceImage';
import { PortfolioItemFormModal, type PortfolioItemFormValues } from '../../features/photographers/components/PortfolioItemFormModal';
import { PhotographyPackageManager } from '../../features/photography-packages/components/PhotographyPackageManager';
import { categoryService } from '../../features/categories/services/categoryService';
import type { Category } from '../../features/categories/types';
import { PhotographyLocationPicker } from '../../features/photographers/components/PhotographyLocationPicker';

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
  bookingType?: 'AODAI_RENTAL' | 'PHOTOGRAPHY' | 'COMBO' | string;
  pickupDamageReport?: {
    reportedAt: string;
    description: string;
    evidencePhotos: string[];
  } | null;
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
  colorImages?: { color: string; images: string[] }[];
  videos?: string[];
  basePrice: number;
  depositAmount: number;
  sizes: string[];
  colors: string[];
  materials: string[];
  style?: string;
  occasions?: string[];
  styleCategoryIds?: Array<string | { _id?: string; id?: string }>;
  eventCategoryIds?: Array<string | { _id?: string; id?: string }>;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  taggingDecisionVersion?: number;
}

interface PortfolioItem {
  _id: string;
  title: string;
  description?: string | null;
  images: string[];
  moderationStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
  moderationReason?: string | null;
}
export const ProviderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user, isAuthenticated } = useAuth();
  const toast = useToast();

  // Role Access Guard
  useEffect(() => {
    if (isAuthenticated !== undefined) {
      if (!isAuthenticated) {
        navigate('/auth/login', { replace: true });
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
  const [currentView, setCurrentView] = useState<'orders' | 'collections' | 'profile' | 'portfolio' | 'photography-packages' | 'calendar' | 'vouchers' | 'inventory' | 'reviews' | 'trust' | 'analytics' | 'payouts' | 'rental-operations' | 'role-management'>('analytics');
  const [collectionTab, setCollectionTab] = useState<'products' | 'inventory'>('products');

  // Provider Specific States
  const [provider, setProvider] = useState<any>(null);
  const providerDataLoadedRef = useRef(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [isPortfolioFormOpen, setIsPortfolioFormOpen] = useState(false);
  const [isPortfolioSaving, setIsPortfolioSaving] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [editingPortfolioItem, setEditingPortfolioItem] = useState<PortfolioItem | null>(null);
  const [previewPortfolioItem, setPreviewPortfolioItem] = useState<PortfolioItem | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);
  const hasPhotographyCapability = Array.isArray(provider?.capabilities) && provider.capabilities.includes('PHOTOGRAPHY');
  const hasAodaiCapability = Array.isArray(provider?.capabilities) && (provider.capabilities.includes('AODAI_RENTAL') || provider.capabilities.includes('RENTAL'));
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
  const [invSummaryPage, setInvSummaryPage] = useState(1);
  const [invLimit] = useState(10); // 10 items per page
  const [invTotal, setInvTotal] = useState(0);

  // Inventory States
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventorySummary, setInventorySummary] = useState<any[]>([]);
  const [myProductsList, setMyProductsList] = useState<any[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Thao tác trên cả một BIẾN THỂ (size + màu + chất liệu), khác với thao tác từng hiện vật
  const [variantEditRow, setVariantEditRow] = useState<any | null>(null);
  const [variantEditQty, setVariantEditQty] = useState<string>('1');
  const [variantBusy, setVariantBusy] = useState(false);

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
  const [addInvMaterial, setAddInvMaterial] = useState('');
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
  const [combos, setCombos] = useState<any[]>([]);
  const [photoPackages, setPhotoPackages] = useState<any[]>([]);
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cProductId, setCProductId] = useState('');
  const [cPackageId, setCPackageId] = useState('');
  const [cDiscount, setCDiscount] = useState<number | ''>(10);
  const [cPrice, setCPrice] = useState('');

  // Tự động tính toán giá combo hợp lý
  useEffect(() => {
    if (cProductId && cPackageId) {
      const prod = myProductsList.find(p => p._id === cProductId);
      const pkg = photoPackages.find(p => p._id === cPackageId);
      if (prod && pkg) {
        const discountPercent = Number(cDiscount) || 0;
        const originalPrice = (prod.basePrice || 0) + (pkg.price || 0);
        const calculatedPrice = Math.round(originalPrice * (1 - discountPercent / 100));
        setCPrice(String(calculatedPrice));
      }
    }
  }, [cProductId, cPackageId, cDiscount, myProductsList, photoPackages]);
  const [cValidFrom, setCValidFrom] = useState('');
  const [cValidTo, setCValidTo] = useState('');
  const [cMaxUsage, setCMaxUsage] = useState<number | ''>(10);
  const [cAoDaiQuantity, setCAoDaiQuantity] = useState<number | ''>(1);
  const [cShootPeopleCount, setCShootPeopleCount] = useState<number | ''>(1);
  const [isAoDaiModalOpen, setIsAoDaiModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [aoDaiSearch, setAoDaiSearch] = useState('');
  const [packageSearch, setPackageSearch] = useState('');
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [reviewsData, setReviewsData] = useState<any>(null);
  const [bookingsState, setBookingsState] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [walletData, setWalletData] = useState<{ pendingBalance: number; availableBalance: number; totalEarned: number } | null>(null);
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
  const [baseLatitude, setBaseLatitude] = useState('');
  const [baseLongitude, setBaseLongitude] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('');
  const [useBusinessAddressForPickup, setUseBusinessAddressForPickup] = useState(true);
  const [pickupAddressLine, setPickupAddressLine] = useState('');
  const [pickupLatitude, setPickupLatitude] = useState('');
  const [pickupLongitude, setPickupLongitude] = useState('');

  // Form states - Voucher
  const [vCode, setVCode] = useState('');
  const [vName, setVName] = useState('');
  const [vType, setVType] = useState('PERCENTAGE');
  const [vValue, setVValue] = useState(10);
  const vMinOrder = 0;

  // Form states - Calendar
  const [selectedScheduleDays, setSelectedScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [workingHourRanges, setWorkingHourRanges] = useState<Array<{ start: string; end: string }>>([
    { start: '08:00', end: '17:00' },
  ]);
  const [editingScheduleDay, setEditingScheduleDay] = useState<number | null>(null);
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
      setBaseLatitude(pRes.address?.geo?.coordinates?.[1]?.toString() ?? '');
      setBaseLongitude(pRes.address?.geo?.coordinates?.[0]?.toString() ?? '');
      setServiceRadiusKm(pRes.photographySettings?.serviceRadiusKm?.toString() ?? '');
      setUseBusinessAddressForPickup(pRes.rentalSettings?.useBusinessAddressForPickup !== false);
      setPickupAddressLine(pRes.rentalSettings?.pickupLocation?.addressLine ?? '');
      setPickupLatitude(pRes.rentalSettings?.pickupLocation?.geo?.coordinates?.[1]?.toString() ?? '');
      setPickupLongitude(pRes.rentalSettings?.pickupLocation?.geo?.coordinates?.[0]?.toString() ?? '');

      const hasPhotography = Array.isArray(pRes.capabilities) && pRes.capabilities.includes('PHOTOGRAPHY');
      const hasAodai = Array.isArray(pRes.capabilities) && (pRes.capabilities.includes('AODAI_RENTAL') || pRes.capabilities.includes('RENTAL'));
      const [portfolioRes, packagesRes, productsRes, summary, combosRes, schedulesRes, vouchersRes, reviewsRes, bookingsRes, analyticsRes] = await Promise.all([
        hasPhotography ? httpClient.get('/providers/me/portfolio-items') : Promise.resolve([]),
        hasPhotography ? httpClient.get('/providers/me/photography-packages') : Promise.resolve([]),
        hasAodai ? httpClient.get('/products/my-listings?limit=200') : Promise.resolve({ items: [] }),
        hasAodai ? httpClient.get('/inventory/summary') : Promise.resolve([]),
        hasAodai && hasPhotography ? httpClient.get('/combo-promotions/my') : Promise.resolve([]),
        httpClient.get('/providers/me/schedules'),
        httpClient.get('/promotions/provider'),
        httpClient.get('/reviews/stats'),
        httpClient.get('/bookings/provider'),
        httpClient.get('/providers/me/analytics'),
      ]) as any[];

      setPortfolioItems(Array.isArray(portfolioRes) ? portfolioRes : []);
      setPhotoPackages(Array.isArray(packagesRes) ? packagesRes : []);
      setMyProductsList(productsRes?.items || []);
      setInventorySummary(Array.isArray(summary) ? summary : []);
      setCombos(Array.isArray(combosRes) ? combosRes : []);
      setSchedules(Array.isArray(schedulesRes) ? schedulesRes : []);
      setVouchers(Array.isArray(vouchersRes) ? vouchersRes : []);
      setReviewsData(reviewsRes);
      setBookingsState(Array.isArray(bookingsRes) ? bookingsRes : []);
      setAnalyticsData(analyticsRes);
      providerDataLoadedRef.current = true;
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
          confirmButtonColor: 'var(--color-primary)',
          allowOutsideClick: false,
        }).then(() => {
          logout();
          navigate('/auth/login');
        });
      }
    } finally {
      setIsLoadingProvider(false);
    }
  };

  // silent: giữ nguyên bảng đang hiện (không chớp màn "Đang tải...") khi đổi trang/bộ lọc
  // itemsOnly: chỉ tải lại danh sách hiện vật, khỏi kéo lại summary + danh sách sản phẩm
  // page: truyền vào khi vừa đổi trang bằng tay — state React cập nhật bất đồng bộ nên
  // đọc invPage trong closure sẽ ra giá trị CŨ và tải nhầm trang.
  const fetchInventoryData = async (options?: { silent?: boolean; itemsOnly?: boolean; page?: number }) => {
    if (!options?.silent) setIsLoadingInventory(true);
    const pageToLoad = options?.page ?? invPage;
    try {
      const res: any = await httpClient.get(
        `/inventory?search=${encodeURIComponent(invSearch)}&status=${invStatusFilter}&conditionStatus=${invConditionFilter}&sortBy=${invSortBy}&page=${pageToLoad}&limit=${invLimit}`
      );
      setInventoryItems(res?.items || []);
      setInvTotal(res?.total || 0);

      if (!options?.itemsOnly) {
        const summary: any = await httpClient.get('/inventory/summary');
        setInventorySummary(summary || []);

        const productsRes: any = await httpClient.get('/products/my-listings?limit=999');
        setMyProductsList(productsRes?.items || []);
      }
    } catch (e) {
      console.error('Failed to load inventory:', e);
      toast.error('Không thể đồng bộ dữ liệu tồn kho');
    } finally {
      if (!options?.silent) setIsLoadingInventory(false);
    }
  };

  const handleCreateInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInvProductId) {
      toast.error('Vui lòng chọn sản phẩm');
      return;
    }
    if (!addInvMaterial) {
      toast.error('Vui lòng chọn chất liệu');
      return;
    }
    try {
      await httpClient.post('/inventory', {
        productId: addInvProductId,
        size: addInvSize,
        color: addInvColor,
        material: addInvMaterial,
        quantity: Number(addInvQuantity),
        conditionStatus: addInvCondition,
        notes: addInvNotes
      });
      toast.success('Nhập kho hiện vật thành công!');

      // Nhập kho có thể sinh ra MÀU MỚI chưa từng có ảnh riêng (backend $addToSet vào product.colors).
      // Không tạo mục ảnh rỗng dưới DB vì nó sẽ bị lọc bỏ khi lưu sản phẩm — thay vào đó nhắc luôn cho người bán.
      const targetProduct = myProductsList.find(p => p._id === addInvProductId);
      const hasColorImages = (targetProduct?.colorImages || []).some(
        (entry: any) => (entry?.color || '').toUpperCase() === addInvColor.toUpperCase() && (entry?.images || []).length > 0,
      );
      if (targetProduct && !hasColorImages) {
        Swal.fire({
          title: `Màu ${colorLabels[addInvColor] || addInvColor} chưa có ảnh riêng`,
          html: `Khách xem <b>${targetProduct.name}</b> và chọn màu này sẽ thấy ảnh chung của sản phẩm.<br/><br/>Vào <b>Sửa sản phẩm → bước 2 → Ảnh theo màu</b> để thêm ảnh cho đúng màu.`,
          icon: 'info',
          confirmButtonText: 'Đã hiểu',
          confirmButtonColor: 'var(--color-primary)',
        });
      }

      setIsAddInventoryOpen(false);
      // Reset form
      setAddInvProductId('');
      setAddInvSize('M');
      setAddInvColor('WHITE');
      setAddInvMaterial('');
      setAddInvQuantity(1);
      setAddInvCondition('GOOD');
      setAddInvNotes('');
      // Refetch
      fetchInventoryData({ silent: true });
      if (editingProduct) {
        void loadEditInvSummary(editingProduct._id);
      }
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
      fetchInventoryData({ silent: true });
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
      confirmButtonColor: 'var(--color-primary)',
      cancelButtonColor: '#71717A'
    });

    if (result.isConfirmed) {
      try {
        await httpClient.delete(`/inventory/${itemId}`);
        toast.success('Thanh lý hiện vật thành công!');
        fetchInventoryData({ silent: true });
      } catch (err: any) {
        Swal.fire({
          title: 'Không thể thanh lý',
          text: err.message || 'Lỗi xảy ra khi thanh lý hiện vật.',
          icon: 'error',
          confirmButtonColor: 'var(--color-primary)'
        });
      }
    }
  };

  const fetchWalletData = async () => {
    try {
      const res: any = await httpClient.get('/providers/me/wallet');
      if (res && res.wallet) {
        setWalletData(res.wallet);
      }
    } catch (err: any) {
      console.error('Không thể tải thông tin ví:', err);
    }
  };

  /** Khoá gửi lên backend để xác định biến thể — phải khớp đúng với bảng tổng hợp. */
  const variantKeyOf = (row: any) => ({
    productId: row.productId,
    size: row.size,
    color: row.color,
    ...(row.material ? { material: row.material } : {}),
  });

  const variantLabelOf = (row: any) =>
    `${row.size} / ${colorLabels[row.color] || row.color}${row.material ? ` / ${materialLabels[row.material] || row.material}` : ''}`;

  /** Sau mỗi thao tác biến thể: số dòng có thể đổi nên đưa về trang 1 rồi tải lại cả hai bảng. */
  const refreshAfterVariantChange = async () => {
    setInvSummaryPage(1);
    setInvPage(1);
    await fetchInventoryData({ silent: true, page: 1 });
    if (isModalOpen && editingProduct) {
      void loadEditInvSummary(editingProduct._id);
    }
  };

  const handleAdjustVariantQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantEditRow || variantBusy) return;
    const raw = variantEditQty.trim();
    const target = Number(raw);
    if (raw === '' || !Number.isInteger(target) || target < 0 || target > 100) {
      toast.error('Số lượng phải là số nguyên từ 0 đến 100.');
      return;
    }

    // Giảm số lượng là thao tác thanh lý, không lùi lại được — phải hỏi lại cho chắc
    const current = Number(variantEditRow.total) || 0;
    if (target < current) {
      const willRetire = current - target;
      const confirm = await Swal.fire({
        title: target === 0 ? 'Đưa biến thể về HẾT HÀNG?' : 'Xác nhận giảm số lượng?',
        html:
          `Sẽ thanh lý <b>${willRetire}</b> chiếc của <b>${variantLabelOf(variantEditRow)}</b>.` +
          (target === 0
            ? '<br/><br/>Biến thể vẫn còn trên sản phẩm nhưng khách sẽ không đặt được. Bạn có thể nhập thêm hàng bất cứ lúc nào.'
            : ''),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Đồng ý',
        cancelButtonText: 'Hủy bỏ',
        confirmButtonColor: 'var(--color-primary)',
        cancelButtonColor: '#71717A',
      });
      if (!confirm.isConfirmed) return;
    }

    setVariantBusy(true);
    try {
      const res: any = await httpClient.patch('/inventory/variants/quantity', {
        ...variantKeyOf(variantEditRow),
        targetQuantity: target,
      });
      setVariantEditRow(null);
      await refreshAfterVariantChange();
      if (res?.shortfall > 0) {
        await Swal.fire({
          title: 'Đã xử lý một phần',
          html: `${res.message}<br/><br/><b>Không thể thanh lý:</b><br/>${res.skipped
            .map((s: any) => `${s.sku} — ${s.reason}`)
            .join('<br/>')}`,
          icon: 'warning',
          confirmButtonColor: 'var(--color-primary)',
        });
      } else {
        toast.success(res?.message || 'Cập nhật số lượng thành công!');
      }
    } catch (err: any) {
      Swal.fire({
        title: 'Không thể đổi số lượng',
        text: err.message || 'Lỗi xảy ra khi cập nhật số lượng biến thể.',
        icon: 'error',
        confirmButtonColor: 'var(--color-primary)',
      });
    } finally {
      setVariantBusy(false);
    }
  };

  const handleRemoveVariant = async (row: any) => {
    if (variantBusy) return;
    const label = variantLabelOf(row);
    const result = await Swal.fire({
      title: 'Xoá biến thể này?',
      html: `Sẽ gỡ hẳn <b>${label}</b> khỏi sản phẩm <b>${row.productName}</b> và thanh lý <b>${row.total}</b> chiếc.<br/><br/>Khách sẽ không còn nhìn thấy lựa chọn này nữa. Nếu chỉ muốn tạm hết hàng, hãy dùng "Sửa số lượng" và đặt về 0.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xoá biến thể',
      cancelButtonText: 'Hủy bỏ',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#71717A',
    });
    if (!result.isConfirmed) return;

    setVariantBusy(true);
    try {
      const res: any = await httpClient.delete('/inventory/variants/remove', {
        body: JSON.stringify(variantKeyOf(row)),
      });
      await refreshAfterVariantChange();
      toast.success(res?.message || 'Đã xoá biến thể!');
    } catch (err: any) {
      Swal.fire({
        title: 'Không thể xoá biến thể',
        text: err.message || 'Lỗi xảy ra khi xoá biến thể.',
        icon: 'error',
        confirmButtonColor: 'var(--color-primary)',
      });
    } finally {
      setVariantBusy(false);
    }
  };

  const fetchPayouts = async () => {
    try {
      let data: any[] = [];
      try {
        const res: any = await httpClient.get('/provider/settlements');
        if (res && Array.isArray(res.items)) {
          data = res.items;
        } else if (Array.isArray(res)) {
          data = res;
        }
      } catch (_e) {
        const res: any = await httpClient.get('/payments/settlement-transfers/provider');
        if (Array.isArray(res)) data = res;
      }
      setPayouts(data);
      fetchWalletData();
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
        address: { ...provider?.address, addressLine, city, geo: baseLatitude && baseLongitude ? { type: 'Point', coordinates: [Number(baseLongitude), Number(baseLatitude)] } : null },
        rentalSettings: { useBusinessAddressForPickup, pickupLocation: useBusinessAddressForPickup ? null : { addressLine: pickupAddressLine, geo: pickupLatitude && pickupLongitude ? { type: 'Point', coordinates: [Number(pickupLongitude), Number(pickupLatitude)] } : null } },
        photographySettings: { serviceRadiusKm: serviceRadiusKm === '' ? null : Number(serviceRadiusKm) },
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

  const handleCreateOrUpdateCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cProductId || !cPackageId) {
      toast.error('Vui lòng chọn cả áo dài và gói chụp ảnh');
      return;
    }

    const selectedPkg = photoPackages.find(p => p._id === cPackageId);
    if (selectedPkg) {
      const maxPeopleAllowed = selectedPkg.maxPeople || 1;
      if (Number(cShootPeopleCount || 1) > maxPeopleAllowed) {
        toast.error(`Số người chụp trong combo (${cShootPeopleCount}) không được lớn hơn số người chụp tối đa của gói chụp ảnh (${maxPeopleAllowed} người)`);
        return;
      }
    }

    const selectedAoDaiStock = cProductId && inventorySummary
      ? inventorySummary
        .filter((item: any) => item.productId === cProductId)
        .reduce((sum: number, item: any) => sum + (item.available || 0), 0)
      : 0;
    if (selectedAoDaiStock > 0 && Number(cAoDaiQuantity || 1) > selectedAoDaiStock) {
      toast.error(`Số lượng áo dài trong combo (${cAoDaiQuantity}) không được vượt quá số lượng tồn kho khả dụng (${selectedAoDaiStock})`);
      return;
    }
    if (!cName.trim()) {
      toast.error('Vui lòng nhập tên combo');
      return;
    }
    if (cDiscount === '' || cDiscount < 1 || cDiscount > 80) {
      toast.error('Phần trăm giảm giá phải nằm trong khoảng 1 - 80%');
      return;
    }
    if (!cValidFrom || !cValidTo) {
      toast.error('Vui lòng chọn khoảng thời gian hiệu lực của combo');
      return;
    }
    if (cValidFrom > cValidTo) {
      toast.error('Ngày bắt đầu không được lớn hơn ngày kết thúc');
      return;
    }
    if (cMaxUsage === '' || Number(cMaxUsage) < 1) {
      toast.error('Số lượng giới hạn combo phải lớn hơn hoặc bằng 1');
      return;
    }

    const payload: any = {
      name: cName,
      description: cDesc,
      discountPercent: Number(cDiscount),
      comboPrice: cPrice ? Number(cPrice) : undefined,
      validFrom: new Date(cValidFrom).toISOString(),
      validTo: new Date(cValidTo).toISOString(),
      maxUsage: Number(cMaxUsage),
      aoDaiQuantity: Number(cAoDaiQuantity || 1),
      shootPeopleCount: Number(cShootPeopleCount || 1),
    };

    if (!editingComboId) {
      payload.productId = cProductId;
      payload.photographyPackageId = cPackageId;
    }

    try {
      if (editingComboId) {
        await httpClient.put(`/combo-promotions/${editingComboId}`, payload);
        toast.success(`Cập nhật combo "${cName}" thành công!`);
      } else {
        await httpClient.post('/combo-promotions', payload);
        toast.success(`Tạo combo "${cName}" thành công!`);
      }
      clearComboForm();
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Thao tác combo thất bại');
    }
  };

  const handleEditCombo = (combo: any) => {
    setEditingComboId(combo._id);
    setCName(combo.name);
    setCDesc(combo.description || '');
    setCProductId(combo.productId?._id || combo.productId || '');
    setCPackageId(combo.photographyPackageId?._id || combo.photographyPackageId || '');
    setCDiscount(combo.discountPercent);
    setCPrice(combo.comboPrice ? String(combo.comboPrice) : '');
    setCMaxUsage(combo.maxUsage || 10);
    setCAoDaiQuantity(combo.aoDaiQuantity || 1);
    setCShootPeopleCount(combo.shootPeopleCount || 1);

    if (combo.validFrom) {
      setCValidFrom(new Date(combo.validFrom).toISOString().split('T')[0]);
    }
    if (combo.validTo) {
      setCValidTo(new Date(combo.validTo).toISOString().split('T')[0]);
    }
  };

  const handleDeleteCombo = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa combo khuyến mãi này?')) return;
    try {
      await httpClient.delete(`/combo-promotions/${id}`);
      toast.success('Xóa combo thành công!');
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Xóa combo thất bại');
    }
  };

  const clearComboForm = () => {
    setEditingComboId(null);
    setCName('');
    setCDesc('');
    setCProductId('');
    setCPackageId('');
    setCDiscount(10);
    setCPrice('');
    setCValidFrom('');
    setCValidTo('');
    setCMaxUsage(10);
    setCAoDaiQuantity(1);
    setCShootPeopleCount(1);
  };

  const toggleScheduleDay = (day: number) => {
    setSelectedScheduleDays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day].sort((a, b) => a - b));
  };

  const updateWorkingHourRange = (
    index: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setWorkingHourRanges((current) => current.map((range, rangeIndex) =>
      rangeIndex === index ? { ...range, [field]: value } : range,
    ));
  };

  const handleSaveRecurringSchedules = async () => {
    if (selectedScheduleDays.length === 0) {
      toast.error('Hãy chọn ít nhất một ngày làm việc.');
      return;
    }

    const sortedRanges = [...workingHourRanges].sort((a, b) => a.start.localeCompare(b.start));
    const hasInvalidRange = sortedRanges.some((range) => !range.start || !range.end || range.start >= range.end);
    const hasOverlap = sortedRanges.some((range, index) =>
      index > 0 && range.start < sortedRanges[index - 1].end,
    );
    if (hasInvalidRange) {
      toast.error('Giờ bắt đầu của mỗi ca phải sớm hơn giờ kết thúc.');
      return;
    }
    if (hasOverlap) {
      toast.error('Các ca làm việc không được chồng lên nhau.');
      return;
    }

    try {
      await httpClient.post('/providers/me/schedules/recurring/bulk', {
        dayOfWeeks: selectedScheduleDays,
        workingHours: sortedRanges,
      });
      toast.success(`Đã lưu lịch cho ${selectedScheduleDays.length} ngày làm việc.`);
      setEditingScheduleDay(null);
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Lưu lịch làm việc thất bại.');
    }
  };

  const handleEditRecurringSchedule = (schedule: any) => {
    const dayOfWeek = Number(schedule.dayOfWeek);
    setSelectedScheduleDays(Number.isInteger(dayOfWeek) ? [dayOfWeek] : []);
    setWorkingHourRanges(
      Array.isArray(schedule.workingHours) && schedule.workingHours.length > 0
        ? schedule.workingHours.map((range: any) => ({ start: range.start, end: range.end }))
        : [{ start: '08:00', end: '17:00' }],
    );
    setEditingScheduleDay(dayOfWeek);
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
  // Kept temporarily for legacy data cleanup; the UI uses portfolio-items.
  void handleAddPortfolio;
  void handleRemovePortfolio;

  const handlePortfolioFormSubmit = async (values: PortfolioItemFormValues) => {
    setIsPortfolioSaving(true);
    try {
      if (editingPortfolioItem) {
        await httpClient.patch(`/providers/me/portfolio-items/${editingPortfolioItem._id}`, values);
        toast.success('Cập nhật tác phẩm thành công.');
      } else {
        await httpClient.post('/providers/me/portfolio-items', values);
        toast.success('Tác phẩm đã được gửi duyệt.');
      }
      setIsPortfolioFormOpen(false);
      setEditingPortfolioItem(null);
      await fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Không thể lưu tác phẩm portfolio.');
    } finally {
      setIsPortfolioSaving(false);
    }
  };
  const handleDeletePortfolioItem = async (itemId: string) => {
    const result = await Swal.fire({
      title: 'G\u1EE1 t\u00E1c ph\u1EA9m n\u00E0y?',
      text: 'T\u00E1c ph\u1EA9m s\u1EBD b\u1ECB g\u1EE1 kh\u1ECFi portfolio c\u1EE7a b\u1EA1n.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'G\u1EE1 t\u00E1c ph\u1EA9m',
      cancelButtonText: 'H\u1EE7y b\u1ECF',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#71717A',
    });
    if (!result.isConfirmed) return;
    try {
      await httpClient.delete(`/providers/me/portfolio-items/${itemId}`);
      toast.success('\u0110\u00E3 g\u1EE1 t\u00E1c ph\u1EA9m kh\u1ECFi portfolio.');
      fetchProviderData();
      return;
    } catch (err: any) {
      toast.error(err.message || 'Kh\u00F4ng th\u1EC3 g\u1EE1 t\u00E1c ph\u1EA9m.');
      return;
    }
    /* Legacy reply handler body kept out of this handler.

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
    */
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
  const [bookingTypeFilter, setBookingTypeFilter] = useState('Tất cả');
  const [activePage, setActivePage] = useState(1);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Incident Report States
  const [reportingOrder, setReportingOrder] = useState<Order | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [incidentDesc, setIncidentDesc] = useState<string>('');
  const [incidentPhotos, setIncidentPhotos] = useState<string[]>([]);
  const [incidentAmount, setIncidentAmount] = useState<number>(0);
  const [incidentActionType, setIncidentActionType] = useState<'CLEANING' | 'MAINTENANCE'>('CLEANING');

  const handleIncidentPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    toast.info('Đang tải ảnh lên...');
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }
      const res: any = await httpClient.post('/api/disputes/incidents/upload-evidence', formData);
      if (res.urls && Array.isArray(res.urls)) {
        setIncidentPhotos(prev => [...prev, ...res.urls]);
        toast.success('Tải ảnh thành công!');
      } else {
        toast.error('Tải ảnh thất bại: Phản hồi không hợp lệ từ máy chủ.');
      }
    } catch (err: any) {
      toast.error('Tải ảnh thất bại: ' + (err.message || ''));
    }
  };

  const handleSendIncidentReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingOrder || !selectedItemId) {
      toast.error('Vui lòng chọn sản phẩm gặp sự cố!');
      return;
    }
    if (incidentPhotos.length === 0) {
      toast.error('Báo cáo sự cố bắt buộc phải có ít nhất 1 hình ảnh làm bằng chứng!');
      return;
    }
    if (incidentAmount > (reportingOrder.depositTotal || 0)) {
      toast.error(`Tiền đền bù không được vượt quá số tiền cọc (${(reportingOrder.depositTotal || 0).toLocaleString()}đ)`);
      return;
    }
    try {
      await httpClient.post('/api/disputes/incidents', {
        bookingId: reportingOrder._id,
        bookingItemId: selectedItemId,
        description: incidentDesc,
        evidencePhotos: incidentPhotos,
        requestedAmount: incidentAmount,
        actionType: incidentActionType,
      });
      toast.success('Báo cáo sự cố thành công! Đơn đặt lịch đã chuyển sang trạng thái chờ giải quyết.');
      setReportingOrder(null);
      setSelectedItemId('');
      setIncidentDesc('');
      setIncidentPhotos([]);
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
        const productName = (b.items || []).map((item: any) => item?.name || item?.productId?.name || item?.photographyPackageId?.name).filter(Boolean).join(' + ') || 'Sản phẩm thuê';
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
          bookingType: b.bookingType,
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
  // Ảnh theo màu giữ tách riêng với ảnh chung; lúc gửi mới gộp lại thành product.images
  const [prodColorImages, setProdColorImages] = useState<Record<string, string[]>>({});
  const [uploadingColor, setUploadingColor] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [prodVideos, setProdVideos] = useState<string[]>([]);
  const [uploadingVideos, setUploadingVideos] = useState(false);
  const [prodStyle, setProdStyle] = useState('traditional');
  const [prodOccasions, setProdOccasions] = useState<string[]>([]);
  const [styleCategories, setStyleCategories] = useState<Category[]>([]);
  const [eventCategories, setEventCategories] = useState<Category[]>([]);
  const [prodStyleCategoryIds, setProdStyleCategoryIds] = useState<string[]>([]);
  const [prodEventCategoryIds, setProdEventCategoryIds] = useState<string[]>([]);

  // Onboarding wizard (3 steps) + variant table + hidden-draft lifecycle
  type VariantRow = { size: string; color: string; material: string; quantity: number; condition: string };
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [wizardStep, setWizardStep] = useState(1);
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [activeTagCodes, setActiveTagCodes] = useState<string[]>([]);
  const [editInvSummary, setEditInvSummary] = useState<any[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);

  const sizesOptions = ['S', 'M', 'L', 'XL', 'XXL'];
  const colorsOptions = ['RED', 'WHITE', 'GOLD', 'BLACK', 'PINK', 'BLUE', 'GREEN', 'BROWN'];
  const materialsOptions = ['SILK', 'VELVET', 'BROCADE', 'ORGANZA', 'LINEN'];
  const colorLabels: Record<string, string> = { RED: 'Đỏ', WHITE: 'Trắng', GOLD: 'Vàng', BLACK: 'Đen', PINK: 'Hồng', BLUE: 'Xanh dương', GREEN: 'Xanh lá', BROWN: 'Nâu' };
  const materialLabels: Record<string, string> = { SILK: 'Lụa', VELVET: 'Nhung', BROCADE: 'Gấm', ORGANZA: 'Organza', LINEN: 'Linen' };
  const conditionOptions = [{ value: 'NEW', label: 'Mới (New)' }, { value: 'GOOD', label: 'Tốt (Good)' }, { value: 'MINOR_DAMAGE', label: 'Hỏng nhẹ' }];
  const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
  const colorSwatches: Record<string, string> = { RED: '#C0392B', WHITE: '#FFFFFF', GOLD: '#D4AC0D', BLACK: '#1B1B1B', PINK: '#E5739C', BLUE: '#2E86C1', GREEN: '#27AE60', BROWN: '#8B5A2B' };
  // Suy ngược trường phái / dịp lễ từ thẻ thông minh đã chọn (nuôi hệ gợi ý cá nhân hóa)
  const TAG_TO_STYLE: Record<string, string> = { TRUYEN_THONG: 'traditional', CACH_TAN: 'modern', PHA_CACH: 'edgy' };
  const TAG_TO_OCCASION: Record<string, string> = { PHU_HOP_LE_CUOI: 'wedding', CHUP_ANH_KY_YEU: 'graduation', LE_HOI_TRUYEN_THONG: 'festival', BIEU_DIEN_SU_KIEN: 'event' };
  // Thẻ thông minh là nguồn sự thật duy nhất cho phân loại — suy luôn ra danh mục
  // PHONG CÁCH / DỊP PHÙ HỢP để áo dài vẫn lọt đúng bộ lọc bên trang khách,
  // thay cho khối "Phân loại bổ sung" phải chọn tay trước đây.
  const TAG_TO_STYLE_SLUG: Record<string, string> = { TRUYEN_THONG: 'truyen-thong', CACH_TAN: 'cach-tan', PHA_CACH: 'pha-cach' };
  const TAG_TO_EVENT_SLUG: Record<string, string> = { PHU_HOP_LE_CUOI: 'dam-cuoi', CHUP_ANH_KY_YEU: 'ky-yeu', LE_HOI_TRUYEN_THONG: 'le-hoi-truyen-thong', BIEU_DIEN_SU_KIEN: 'bieu-dien-va-su-kien' };

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
        setProdCategoryId(data[0]._id || data[0].id);
      }
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    }
  };

  const fetchServiceCategories = async () => {
    try {
      const [styles, events] = await Promise.all([
        categoryService.getPublic({ type: 'STYLE', status: 'ACTIVE', limit: 100 }),
        categoryService.getPublic({ type: 'EVENT', status: 'ACTIVE', limit: 100 }),
      ]);
      setStyleCategories(styles);
      setEventCategories(events);
    } catch (err) {
      console.error('Lỗi tải danh mục phong cách và dịp phù hợp:', err);
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
    if (currentView === 'orders' || currentView === 'rental-operations') {
      fetchOrders();
    } else if (currentView === 'collections') {
      fetchProducts();
      fetchCategories();
      fetchServiceCategories();
      fetchActiveCampaign();
    } else if (currentView === 'payouts') {
      fetchPayouts();
    } else if (currentView === 'inventory') {
      fetchInventoryData();
    } else if (['profile', 'portfolio', 'calendar', 'vouchers', 'reviews', 'trust', 'analytics', 'role-management'].includes(currentView)) {
      fetchProviderData();
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView === 'collections') {
      fetchProducts();
    }
  }, [prodSearch, prodSortBy, prodPage, prodSizeFilter, prodColorFilter]);

  // Vào tab Tồn kho -> tải đầy đủ (có màn loading lần đầu)
  useEffect(() => {
    if (currentView === 'collections' && collectionTab === 'inventory') {
      fetchInventoryData();
    }
  }, [currentView, collectionTab]);

  // Đổi trang / bộ lọc -> chỉ tải lại danh sách hiện vật, giữ nguyên màn hình
  useEffect(() => {
    if (currentView === 'collections' && collectionTab === 'inventory') {
      fetchInventoryData({ silent: true, itemsOnly: true });
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
    setProdColorImages({});
    setProdVideos([]);
    setProdStyle('traditional');
    setProdOccasions([]);
    setProdStyleCategoryIds([]);
    setProdEventCategoryIds([]);
    setVariants([emptyVariant()]);
    setWizardStep(1);
    setCreatedDraftId(null);
    setActiveTagCodes([]);
    if (categories.length > 0) {
      setProdCategoryId(categories[0]._id || categories[0].id);
    }
    setIsModalOpen(true);
  };

  // Tải bảng tồn kho của riêng 1 sản phẩm để nhúng vào bước 2 khi chỉnh sửa
  const loadEditInvSummary = async (productId: string) => {
    try {
      const summary: any = await httpClient.get('/inventory/summary');
      setEditInvSummary((Array.isArray(summary) ? summary : []).filter((row: any) => row.productId === productId));
    } catch {
      setEditInvSummary([]);
    }
  };

  const normalizeCategoryIds = (items?: Array<string | { _id?: string; id?: string }>) =>
    (items || [])
      .map(item => typeof item === 'string' ? item : item._id || item.id || '')
      .filter(Boolean);

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
    const loadedColorImages: Record<string, string[]> = {};
    (p.colorImages || []).forEach(entry => {
      if (entry?.color) loadedColorImages[entry.color] = [...(entry.images || [])];
    });
    setProdColorImages(loadedColorImages);
    const taggedUrls = new Set(Object.values(loadedColorImages).flat());
    setProdImages((p.images || []).filter(url => !taggedUrls.has(url)));
    setProdVideos(p.videos || []);
    setProdStyle(p.style || 'traditional');
    setProdOccasions(p.occasions || []);
    setProdStyleCategoryIds(normalizeCategoryIds(p.styleCategoryIds));
    setProdEventCategoryIds(normalizeCategoryIds(p.eventCategoryIds));
    setVariants([]);
    setWizardStep(1);
    setCreatedDraftId(null);
    setActiveTagCodes([]);
    void loadEditInvSummary(p._id);
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
    setProdColorImages({});
    setProdVideos([]);
    setProdStyle(p.style ? p.style.toLowerCase() : 'traditional');
    setProdOccasions(p.occasions || []);
    setProdStyleCategoryIds(normalizeCategoryIds(p.styleCategoryIds));
    setProdEventCategoryIds(normalizeCategoryIds(p.eventCategoryIds));
    // Sao chép biến thể từ áo gốc (số lượng đặt lại = 1 để provider tự nhập).
    const dupSizes = p.sizes && p.sizes.length ? p.sizes : ['M'];
    const dupColors = p.colors && p.colors.length ? p.colors : ['RED'];
    const dupMaterial = p.materials && p.materials.length ? p.materials[0] : 'SILK';
    const dupVariants: VariantRow[] = [];
    for (const s of dupSizes) for (const c of dupColors) dupVariants.push({ size: s, color: c, material: dupMaterial, quantity: 1, condition: 'GOOD' });
    setVariants(dupVariants.length ? dupVariants : [emptyVariant()]);
    setWizardStep(1);
    setCreatedDraftId(null);
    setActiveTagCodes([]);
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
    const result = await Swal.fire({
      title: 'Tắt chương trình khuyến mãi?',
      text: 'Tất cả sản phẩm sẽ quay về giá gốc ngay lập tức.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Tắt khuyến mãi',
      cancelButtonText: 'Giữ nguyên',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#71717A',
    });
    if (!result.isConfirmed) return;

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

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (prodVideos.length + e.target.files.length > 2) {
      toast.error('Tối đa 2 video cho mỗi sản phẩm');
      e.target.value = '';
      return;
    }
    setUploadingVideos(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < e.target.files.length; i++) {
        formData.append('videos', e.target.files[i]);
      }
      const res = await httpClient.post<{ urls: string[] }>('/products/upload-videos', formData);
      setProdVideos(prev => [...prev, ...res.urls]);
      toast.success('Đã tải video lên thành công!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Tải video lên thất bại');
    } finally {
      setUploadingVideos(false);
      e.target.value = '';
    }
  };

  const removeVideo = (index: number) => {
    setProdVideos(prev => prev.filter((_, i) => i !== index));
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

  // ──────────────────────────────────────────────────────────────────────────
  // Onboarding wizard (3 bước) + bảng biến thể + vòng đời "nháp ẩn"
  // ──────────────────────────────────────────────────────────────────────────
  const emptyVariant = (): VariantRow => ({ size: 'M', color: 'RED', material: 'SILK', quantity: 1, condition: 'GOOD' });
  const addVariantRow = () => setVariants(prev => [...prev, emptyVariant()]);
  const removeVariantRow = (idx: number) => setVariants(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  const updateVariantRow = (idx: number, field: keyof VariantRow, value: string | number) =>
    setVariants(prev => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));

  // Gộp các dòng trùng size+màu+chất liệu (cộng dồn số lượng), bỏ dòng thiếu size/màu.
  const normalizeVariants = (rows: VariantRow[]) => {
    const map = new Map<string, { size: string; color: string; material: string; quantity: number; conditionStatus: string }>();
    for (const v of rows) {
      const size = (v.size || '').trim().toUpperCase();
      const color = (v.color || '').trim().toUpperCase();
      const material = (v.material || '').trim();
      const quantity = Math.max(1, Number(v.quantity) || 1);
      if (!size || !color) continue;
      const key = `${size}|${color}|${material.toUpperCase()}`;
      const existing = map.get(key);
      if (existing) existing.quantity += quantity;
      else map.set(key, { size, color, material, quantity, conditionStatus: v.condition || 'GOOD' });
    }
    return Array.from(map.values());
  };


  /** Danh sách màu cần gắn ảnh: lúc tạo lấy từ bảng biến thể, lúc sửa lấy từ sản phẩm. */
  const colorsNeedingImages = (): string[] => {
    // Ở chế độ Sửa: editingProduct là ảnh chụp lúc mở form nên KHÔNG có màu vừa thêm
    // qua "Nhập thêm hàng". Bảng tồn kho editInvSummary được tải lại sau mỗi lần nhập
    // nên phải hợp cả hai nguồn, nếu không màu mới sẽ không hiện ô thêm ảnh.
    const source = editingProduct
      ? [...(editingProduct.colors || []), ...editInvSummary.map((row: any) => row.color)]
      : variants.map(v => v.color);
    return Array.from(new Set(source.map(c => (c || '').trim().toUpperCase()).filter(Boolean)));
  };

  const handleColorImageChange = async (color: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingColor(color);
    try {
      const formData = new FormData();
      for (let i = 0; i < e.target.files.length; i++) {
        formData.append('images', e.target.files[i]);
      }
      const res = await httpClient.post<{ urls: string[] }>('/products/upload', formData);
      setProdColorImages(prev => ({ ...prev, [color]: [...(prev[color] || []), ...res.urls] }));
      toast.success(`Đã thêm ${res.urls.length} ảnh cho màu ${colorLabels[color] || color}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Tải ảnh lên thất bại');
    } finally {
      setUploadingColor(null);
      e.target.value = '';
    }
  };

  const removeColorImage = (color: string, index: number) => {
    setProdColorImages(prev => ({ ...prev, [color]: (prev[color] || []).filter((_, i) => i !== index) }));
  };

  /** product.images là kho HỢP NHẤT (ảnh chung + mọi ảnh theo màu); ảnh chung đứng trước để images[0] vẫn là ảnh bìa. */
  const mergedImages = (): string[] => {
    const all = [...prodImages];
    Object.values(prodColorImages).forEach(urls => {
      urls.forEach(url => { if (!all.includes(url)) all.push(url); });
    });
    return all;
  };

  /** Chỉ gửi lên các màu còn tồn tại và thực sự có ảnh. */
  const buildColorImagesPayload = () => {
    const valid = new Set(colorsNeedingImages());
    return Object.entries(prodColorImages)
      .filter(([color, urls]) => valid.has(color) && urls.length > 0)
      .map(([color, images]) => ({ color, images }));
  };

  const buildBasePayload = () => ({
    name: prodName,
    categoryId: prodCategoryId,
    description: prodDescription,
    basePrice: Number(prodBasePrice),
    depositAmount: Number(prodDepositAmount),
    status: prodStatus,
    images: mergedImages().length > 0 ? mergedImages() : [DEFAULT_PRODUCT_IMAGE],
    colorImages: buildColorImagesPayload(),
    videos: prodVideos,
    style: prodStyle,
    occasions: prodOccasions,
    styleCategoryIds: prodStyleCategoryIds,
    eventCategoryIds: prodEventCategoryIds,
  });

  const validateWizardStep1 = () => {
    if (!prodName || !prodCategoryId || !prodBasePrice || !prodDepositAmount) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc ở bước 1');
      return false;
    }
    // Phải dùng >= cho khớp với backend (products.service.ts), nếu chỉ chặn > thì
    // trường hợp cọc BẰNG giá thuê sẽ lọt qua bước 1 rồi mới bị từ chối ở bước 2.
    if (Number(prodDepositAmount) >= Number(prodBasePrice)) {
      toast.error('Giá cọc phải nhỏ hơn giá thuê');
      return false;
    }
    if (mergedImages().length === 0) {
      toast.error('Cần tải lên ít nhất 1 hình ảnh sản phẩm');
      return false;
    }
    return true;
  };

  const handleWizardNext = async () => {
    if (wizardStep === 1) {
      if (!validateWizardStep1()) return;
      setWizardStep(2);
      return;
    }
    if (wizardStep === 2) {
      // Edit mode: biến thể được quản lý ở tab Tồn kho, chỉ cần sang bước gắn thẻ.
      if (editingProduct) { setWizardStep(3); return; }
      const normalized = normalizeVariants(variants);
      if (normalized.length === 0) {
        toast.error('Cần ít nhất 1 dòng biến thể hợp lệ (size + màu)');
        return;
      }
      // Tạo bản NHÁP ẨN để AI có productId mà gắn thẻ (khách chưa nhìn thấy).
      setSavingDraft(true);
      try {
        if (createdDraftId) {
          // Nháp đã tồn tại (quay lại rồi tiến tới): chỉ cập nhật thông tin cơ bản.
          await httpClient.patch(`/products/${createdDraftId}`, buildBasePayload());
        } else {
          const created: any = await httpClient.post('/products', {
            ...buildBasePayload(),
            status: 'DRAFT',
            variants: normalized,
          });
          setCreatedDraftId(created._id);
          if (normalized.length !== variants.length) {
            toast.success('Đã gộp các biến thể trùng size/màu/chất liệu.');
          }
        }
        setWizardStep(3);
      } catch (err: any) {
        toast.error(err.message || 'Lưu bản nháp thất bại. Vui lòng thử lại.');
      } finally {
        setSavingDraft(false);
      }
    }
  };

  const handleWizardBack = () => setWizardStep(step => Math.max(1, step - 1));

  const handleWizardFinish = async () => {
    if (!editingProduct && activeTagCodes.length < 1) {
      toast.error('Hãy tạo và chọn ít nhất 1 thẻ thông minh trước khi đăng.');
      return;
    }
    if (!validateWizardStep1()) return;
    try {
      const targetId = editingProduct?._id ?? createdDraftId;
      if (!targetId) return;
      // Trường phái & dịp lễ suy ngược từ thẻ đã chọn (thẻ là nguồn sự thật);
      // nếu chưa mở bước thẻ (edit nhanh giá/mô tả) thì giữ nguyên giá trị cũ.
      const styleFromTags = activeTagCodes.map(code => TAG_TO_STYLE[code]).find(Boolean);
      const occasionsFromTags = activeTagCodes.map(code => TAG_TO_OCCASION[code]).filter(Boolean);
      // Danh mục lọc cũng suy từ thẻ; nếu chưa có thẻ nào thì giữ nguyên giá trị cũ.
      const styleIdsFromTags = styleCategories
        .filter(category => activeTagCodes.some(code => TAG_TO_STYLE_SLUG[code] === category.slug))
        .map(category => category.id);
      const eventIdsFromTags = eventCategories
        .filter(category => activeTagCodes.some(code => TAG_TO_EVENT_SLUG[code] === category.slug))
        .map(category => category.id);
      await httpClient.patch(`/products/${targetId}`, {
        ...buildBasePayload(),
        status: 'ACTIVE',
        style: activeTagCodes.length ? (styleFromTags || prodStyle) : prodStyle,
        occasions: activeTagCodes.length ? occasionsFromTags : prodOccasions,
        styleCategoryIds: activeTagCodes.length ? styleIdsFromTags : prodStyleCategoryIds,
        eventCategoryIds: activeTagCodes.length ? eventIdsFromTags : prodEventCategoryIds,
      });
      toast.success(editingProduct ? `Cập nhật áo dài "${prodName}" thành công!` : `Đăng áo dài "${prodName}" thành công!`);
      setIsModalOpen(false);
      resetProductForm();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thất bại.');
    }
  };

  /** Xoá sạch trạng thái form sản phẩm — đóng form là mọi thay đổi chưa lưu phải mất hẳn. */
  const resetProductForm = () => {
    setEditingProduct(null);
    setCreatedDraftId(null);
    setActiveTagCodes([]);
    setWizardStep(1);
    setProdImages([]);
    setProdColorImages({});
    setProdVideos([]);
    setVariants([emptyVariant()]);
    setEditInvSummary([]);
  };

  const handleWizardCancel = async () => {
    // Bỏ dở một bản nháp vừa tạo -> xóa nó (kèm tồn kho) cho sạch.
    if (createdDraftId && !editingProduct) {
      const result = await Swal.fire({
        title: 'Hủy tạo áo dài?',
        html: 'Bản nháp vừa tạo sẽ bị xóa, kèm theo toàn bộ biến thể và số lượng đã nhập.<br/><br/>Thao tác này không thể hoàn tác.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Hủy và xóa nháp',
        cancelButtonText: 'Tiếp tục tạo',
        confirmButtonColor: '#DC2626',
        cancelButtonColor: '#71717A',
      });
      if (!result.isConfirmed) return;
      try { await httpClient.delete(`/products/${createdDraftId}`); } catch { /* ignore */ }
    }
    resetProductForm();
    setIsModalOpen(false);
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

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = orderTab === 'Tất cả' || getOrderGroup(order.status) === orderTab;
    const matchesType = bookingTypeFilter === 'Tất cả' || order.bookingType === bookingTypeFilter;
    return matchesStatus && matchesType;
  });

  const rentalOperationItems = React.useMemo(() => orders.flatMap((order) =>
    (order.items || [])
      .filter((item: any) => item?.rentalFulfillment && item.rentalFulfillment.status !== 'COMPLETED' && item.rentalFulfillment.status !== 'CANCELLED')
      .map((item: any) => ({ order, item })),
  ), [orders]);
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
    const base: React.CSSProperties = { display: 'inline-block', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'white', whiteSpace: 'nowrap' };
    if (status === 'HOÀN THÀNH') return { ...base, backgroundColor: '#2e7d32' };
    if (status === 'CHỜ KHÁCH DUYỆT SỰ CỐ') return { ...base, backgroundColor: '#ed6c02' };
    if (status === 'TRANH CHẤP') return { ...base, backgroundColor: '#d32f2f' };
    if (status === 'ĐÃ HỦY') return { ...base, backgroundColor: '#757575' };
    if (status === 'CHỜ XỬ LÝ') return { ...base, backgroundColor: 'var(--color-primary)' };
    if (status === 'CHỜ THANH TOÁN') return { ...base, backgroundColor: '#9C27B0' };
    if (status === 'ĐÃ ĐẶT CỌC') return { ...base, backgroundColor: '#1565C0' };
    if (status === 'ĐANG THỰC HIỆN') return { ...base, backgroundColor: 'var(--color-gold)' };
    if (status === 'ĐANG CHỤP') return { ...base, backgroundColor: '#059669' };
    if (status === 'CHỜ KHÁCH XÁC NHẬN') return { ...base, backgroundColor: '#0284C7' };
    if (status === 'CHỜ NHẬN ĐỒ') return { ...base, backgroundColor: '#E67E22' };
    if (status === 'ĐANG THUÊ') return { ...base, backgroundColor: '#27AE60' };
    if (status === 'ĐÃ TRẢ ĐỒ') return { ...base, backgroundColor: '#558B2F' };
    return { ...base, backgroundColor: '#ccc', color: '#555' };
  };

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', fontSize: '14px', fontWeight: 600,
    color: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.5)', textDecoration: 'none', borderRadius: '8px',
    backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'var(--transition-smooth)', cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    border: 'none',
  });

  // Map từ BookingStatus enum value → Trạng thái tiếng Việt hiển thị
  const statusDisplayMap: Record<string, string> = {
    PENDING: 'CHỜ XỬ LÝ',
    PENDING_PAYMENT: 'CHỜ THANH TOÁN',
    DEPOSIT_PAID: 'ĐÃ ĐẶT CỌC',
    CONFIRMED: 'ĐANG THỰC HIỆN',
    IN_PROGRESS: 'ĐANG CHỤP',
    AWAITING_REVIEW: 'CHỜ KHÁCH XÁC NHẬN',
    PICKUP_PENDING: 'CHỜ NHẬN ĐỒ',
    PICKED_UP: 'ĐANG THUÊ',
    RETURN_PENDING: 'CHỜ KHÁCH DUYỆT SỰ CỐ',
    RETURNED: 'ĐÃ TRẢ ĐỒ',
    COMPLETED: 'HOÀN THÀNH',
    CANCELLED: 'ĐÃ HỦY',
    DISPUTED: 'TRANH CHẤP',
  };

  const changeOrderStatus = async (_id: string, apiStatus: string) => {
    const order = orders.find(o => o._id === _id || o.id === _id);
    if (order && (apiStatus === 'PICKUP_PENDING' || apiStatus === 'PICKED_UP')) {
      const firstItem = order.items?.[0];
      const startDateStr = firstItem?.startDate || firstItem?.rentalFrom;
      if (startDateStr) {
        const today = new Date();
        const start = new Date(startDateStr);
        const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startZero = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const diffDays = (startZero.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDays > 1) {
          toast.error('Chưa đến thời gian bàn giao đồ! Chỉ được thực hiện tối đa trước ngày nhận 24 giờ.');
          return;
        }
      }
    }

    if (apiStatus === 'PICKUP_PENDING') {
      const result = await Swal.fire({
        title: 'Bàn giao trang phục',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
            <p style="font-size: 13px; color: #6B7280; margin-bottom: 18px; text-align: center; line-height: 1.5; max-width: 360px;">
              Ảnh chụp rõ nét tình trạng tổng thể, cổ áo, tà áo và các chi tiết quan trọng lúc giao hàng làm bằng chứng đối soát.
            </p>
            <label for="handover-file-input" style="
              width: 100%;
              max-width: 320px;
              height: 130px;
              border: 2px dashed #D1D5DB;
              border-radius: 12px;
              background-color: #F9FAFB;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s ease-in-out;
              gap: 8px;
              padding: 16px;
              box-sizing: border-box;
            "
            onmouseover="this.style.borderColor='var(--color-primary-dark)'; this.style.backgroundColor='#FFFDF9';"
            onmouseout="this.style.borderColor='#D1D5DB'; this.style.backgroundColor='#F9FAFB';"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8C827A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span style="font-size: 13px; font-weight: 700; color: #4B5563; margin-top: 4px;">Tải lên ảnh bàn giao</span>
              <span style="font-size: 11px; color: #9CA3AF;">Hỗ trợ nhiều hình ảnh JPG, PNG, WEBP</span>
              <input type="file" id="handover-file-input" multiple accept="image/*" style="display: none;" />
            </label>
            <div id="handover-preview-container" style="
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
              justify-content: center;
              margin-top: 20px;
              width: 100%;
              max-width: 360px;
            "></div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonColor: 'var(--color-primary-dark)',
        cancelButtonColor: '#9CA3AF',
        confirmButtonText: 'Xác nhận Bàn giao',
        cancelButtonText: 'Hủy',
        background: 'white',
        didOpen: () => {
          const fileInput = document.getElementById('handover-file-input') as HTMLInputElement;
          const previewContainer = document.getElementById('handover-preview-container') as HTMLDivElement;
          if (fileInput && previewContainer) {
            fileInput.addEventListener('change', async (e: any) => {
              const files = e.target.files;
              if (!files || files.length === 0) return;
              previewContainer.innerHTML = '<span style="font-size: 12px; color: #8C827A; font-weight: 600;">⏳ Đang tải ảnh...</span>';

              const uploadedUrls: string[] = [];
              try {
                for (let i = 0; i < files.length; i++) {
                  const formData = new FormData();
                  formData.append('file', files[i]);
                  const res: any = await httpClient.post('/api/bookings/upload-reference', formData);
                  if (res.url) uploadedUrls.push(res.url);
                }

                previewContainer.innerHTML = '';
                uploadedUrls.forEach(url => {
                  const wrapper = document.createElement('div');
                  wrapper.style.position = 'relative';
                  wrapper.style.width = '64px';
                  wrapper.style.height = '64px';
                  wrapper.style.borderRadius = '8px';
                  wrapper.style.overflow = 'hidden';
                  wrapper.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                  wrapper.style.border = '1px solid #E5E7EB';

                  const img = document.createElement('img');
                  img.src = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
                  img.style.width = '100%';
                  img.style.height = '100%';
                  img.style.objectFit = 'cover';
                  img.className = 'handover-uploaded-img';
                  img.dataset.url = url;

                  wrapper.appendChild(img);
                  previewContainer.appendChild(wrapper);
                });
              } catch (err) {
                previewContainer.innerHTML = '<span style="font-size: 12px; color: #C0392B; font-weight: 600;">❌ Tải ảnh thất bại!</span>';
              }
            });
          }
        },
        preConfirm: () => {
          const imgs = document.querySelectorAll('.handover-uploaded-img');
          const urls: string[] = [];
          imgs.forEach((img: any) => {
            if (img.dataset.url) urls.push(img.dataset.url);
          });
          if (urls.length === 0) {
            Swal.showValidationMessage('Vui lòng tải lên ít nhất 1 hình ảnh bàn giao!');
            return false;
          }
          return urls;
        }
      });

      if (!result.isConfirmed || !result.value) {
        setActionMenuId(null);
        return;
      }

      const handoverPhotos = result.value;
      try {
        await httpClient.patch(`/bookings/${_id}/status`, { status: apiStatus, handoverPhotos });
        const displayStatus = statusDisplayMap[apiStatus] || apiStatus;
        setOrders(prev => prev.map(o => (o._id === _id || o.id === _id) ? { ...o, status: displayStatus, rawStatus: apiStatus, handoverPhotos } : o));
        toast.success(`Đã bàn giao và cập nhật trạng thái đơn hàng thành "${displayStatus}"!`);
      } catch (err: any) {
        toast.error(err.message || 'Cập nhật trạng thái thất bại');
      }
      setActionMenuId(null);
      return;
    }

    try {
      await httpClient.patch(`/bookings/${_id}/status`, { status: apiStatus });
      const displayStatus = statusDisplayMap[apiStatus] || apiStatus;
      setOrders(prev => prev.map(o => (o._id === _id || o.id === _id) ? { ...o, status: displayStatus, rawStatus: apiStatus } : o));
      toast.success(`Đã cập nhật trạng thái đơn hàng thành "${displayStatus}"!`);
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật trạng thái thất bại');
    }
    setActionMenuId(null);
  };

  const resolveRescheduleRequest = async (order: Order, item: any, approved: boolean) => {
    const result = await Swal.fire({
      title: approved ? 'Duyệt yêu cầu đổi lịch?' : 'Từ chối yêu cầu đổi lịch?',
      text: approved
        ? 'Lịch chỉ được cập nhật nếu thời gian đề xuất vẫn còn trống tại thời điểm duyệt.'
        : 'Bạn có thể ghi chú để khách hiểu lý do từ chối.',
      input: 'textarea',
      inputLabel: approved ? 'Ghi chú cho khách (không bắt buộc)' : 'Lý do từ chối (không bắt buộc)',
      inputPlaceholder: 'Nhập ghi chú...',
      showCancelButton: true,
      confirmButtonText: approved ? 'Duyệt đổi lịch' : 'Từ chối yêu cầu',
      cancelButtonText: 'Hủy',
      confirmButtonColor: approved ? '#1E7A46' : '#C0392B',
    });
    if (!result.isConfirmed) return;

    try {
      await httpClient.patch(`/bookings/${order._id}/items/${item._id}/reschedule-requests/resolve`, {
        approved,
        note: typeof result.value === 'string' && result.value.trim() ? result.value.trim() : undefined,
      });
      toast.success(approved ? 'Đã duyệt yêu cầu đổi lịch.' : 'Đã từ chối yêu cầu đổi lịch.');
      setActionMenuId(null);
      await fetchOrders();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xử lý yêu cầu đổi lịch.');
    }
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
            <div style={{ width: '40px', height: '40px', border: '3px solid var(--color-light-border)', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
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
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)' }}>Quản trị Cửa hàng</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Phân tích số liệu vận hành và doanh thu áo dài của bạn.</p>
            </div>
            {isShop && isPhoto && (
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-light-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                <button type="button" onClick={() => setSubTab('shop')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: subTab === 'shop' ? 'white' : 'transparent', color: subTab === 'shop' ? 'var(--color-primary)' : 'var(--color-text-secondary)', boxShadow: subTab === 'shop' ? 'var(--shadow-sm)' : 'none' }}>Cửa hàng</button>
                <button type="button" onClick={() => setSubTab('photo')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: subTab === 'photo' ? 'white' : 'transparent', color: subTab === 'photo' ? 'var(--color-primary)' : 'var(--color-text-secondary)', boxShadow: subTab === 'photo' ? 'var(--shadow-sm)' : 'none' }}>Nhiếp ảnh</button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            {[
              { label: 'Doanh thu cửa hàng', val: `${(analyticsData.totalRevenue || 0).toLocaleString('vi-VN')} đ`, desc: 'Tổng doanh thu thực', color: 'var(--color-primary)', bg: '#FAF6F0' },
              { label: 'Tỷ lệ thành công', val: `${analyticsData.successRate}%`, desc: 'Booking hoàn thành', color: '#166534', bg: '#F0FDF4' },
              { label: 'Tỷ lệ hủy lịch', val: `${analyticsData.cancelRate}%`, desc: 'Lịch khách hủy', color: '#991B1B', bg: '#FEE2E2' },
              { label: 'Tổng sản phẩm', val: `${String(analyticsData.totalProducts).padStart(2, '0')} Item`, desc: 'Đồ đang hoạt động', color: 'var(--color-gold-dark)', bg: '#FAF6F0' },
              { label: 'Thời gian thuê tb', val: analyticsData.averageRentalDuration, desc: 'Thời gian mỗi đơn', color: '#15803D', bg: '#F0FDF4' }
            ].map((m, idx) => (
              <div key={idx} style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: idx === 0 ? 'var(--color-primary)' : 'var(--color-text-primary)', marginTop: '6px', wordBreak: 'break-all' }}>{m.val}</div>
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
              <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 750, color: 'var(--color-primary)', textTransform: 'uppercase' }}>Doanh thu Áo dài</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <svg viewBox="0 0 500 300" style={{ width: '100%', height: '100%' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                    const y = 40 + p * 200;
                    return (
                      <line key={idx} x1="40" y1={y} x2="480" y2={y} stroke="#F0ECE4" strokeDasharray="3 3" />
                    );
                  })}
                  <polyline fill="none" stroke="var(--color-primary)" strokeWidth="3" points={points} />
                  {analyticsData.revenueGrowth.map((r: any, idx: number) => {
                    const x = 50 + idx * 80;
                    const y = 260 - (r.value / maxRev) * 200;
                    return (
                      <g key={idx}>
                        <circle cx={x} cy={y} r="5" fill="var(--color-primary)" />
                        <circle cx={x} cy={y} r="2" fill="white" />
                        <text x={x} y={y - 12} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-text-primary)">{(r.value / 1000000).toFixed(1)}M</text>
                        <text x={x} y="285" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-text-secondary)">{r.label.replace('Tháng ', 'T')}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 750, color: 'var(--color-primary)', textTransform: 'uppercase' }}>Top Phổ biến</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {analyticsData.popularProducts && analyticsData.popularProducts.length > 0 ? (
                  analyticsData.popularProducts.map((p: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: idx < 2 ? '1px solid var(--color-light-border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={getImageUrl(p.image)} alt={p.name} style={{ width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover' }} />
                        <div>
                          <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)', display: 'block' }}>{p.name}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Mẫu áo được thuê nhiều</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--color-primary)' }}>{p.count}</strong>
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
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: 'var(--color-primary)', textTransform: 'uppercase' }}>Báo cáo hàng tồn kho & Bảo trì</h3>
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
                    <td style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.name}</td>
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
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)' }}>Tổng quan Hiệu suất</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Thống kê doanh thu, lịch trình chụp và phản hồi đánh giá của bạn.</p>
            </div>
            {isShop && isPhoto && (
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-light-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                <button type="button" onClick={() => setSubTab('shop')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: subTab === 'shop' ? 'white' : 'transparent', color: subTab === 'shop' ? 'var(--color-primary)' : 'var(--color-text-secondary)', boxShadow: subTab === 'shop' ? 'var(--shadow-sm)' : 'none' }}>Cửa hàng</button>
                <button type="button" onClick={() => setSubTab('photo')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: subTab === 'photo' ? 'white' : 'transparent', color: subTab === 'photo' ? 'var(--color-primary)' : 'var(--color-text-secondary)', boxShadow: subTab === 'photo' ? 'var(--shadow-sm)' : 'none' }}>Nhiếp ảnh</button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Doanh thu nhiếp ảnh</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '8px' }}>{(analyticsData.totalRevenue || 84250000).toLocaleString('vi-VN')} VND</div>
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
              <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 750, color: 'var(--color-primary)', textTransform: 'uppercase' }}>Doanh thu theo thời gian</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '280px', paddingTop: '20px' }}>
                {analyticsData.revenueGrowth.map((r: any, idx: number) => {
                  const barHeight = (r.value / maxVal) * 220;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{(r.value / 1000000).toFixed(1)}M</span>
                      <div style={{ width: '32px', height: `${barHeight}px`, backgroundColor: 'var(--color-primary)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{r.label.replace('Tháng ', 'T')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 750, color: 'var(--color-primary)', textTransform: 'uppercase' }}>Lịch chụp sắp tới</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analyticsData.upcomingSchedules && analyticsData.upcomingSchedules.length > 0 ? (
                  analyticsData.upcomingSchedules.map((s: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'var(--color-light-bg)' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)', display: 'block' }}>{s.customerName}</strong>
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
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: 'var(--color-primary)', textTransform: 'uppercase', alignSelf: 'flex-start' }}>Đánh giá trung bình</h3>
              <div style={{ fontSize: '64px', fontWeight: 900, color: 'var(--color-primary)', lineHeight: 1 }}>{analyticsData.averageRating}</div>
              <div style={{ display: 'flex', gap: '4px', fontSize: '20px', color: '#B89047' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Dựa trên tất cả feedback khách hàng</span>
            </div>

            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: 750, color: 'var(--color-primary)', textTransform: 'uppercase' }}>Phong cách phổ biến</h3>
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
    const invSummaryLimit = 8;
    const invSummaryTotalPages = Math.max(1, Math.ceil(inventorySummary.length / invSummaryLimit));
    const invSummaryCurrent = Math.min(invSummaryPage, invSummaryTotalPages);
    const pagedSummary = inventorySummary.slice((invSummaryCurrent - 1) * invSummaryLimit, invSummaryCurrent * invSummaryLimit);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                TỒN KHO THEO BIẾN THỂ — TẤT CẢ SẢN PHẨM
              </h3>
              {inventorySummary.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Chưa có biến thể áo dài nào trong kho.</div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-light-bg)', borderBottom: '1px solid var(--color-light-border)' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÊN SẢN PHẨM</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SIZE</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÀU SẮC</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHẤT LIỆU</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TỔNG KHO</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#166534' }}>KHẢ DỤNG</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1D4ED8' }}>ĐANG THUÊ</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#B45309' }}>GIẶT / BẢO TRÌ</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>THAO TÁC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedSummary.map((item, idx) => (
                          <tr key={`${item.productId}-${item.size}-${item.color}-${item.material || ''}-${idx}`} style={{ borderBottom: '1px solid var(--color-light-border)' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.productName}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{item.size}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{colorLabels[item.color] || item.color}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{materialLabels[item.material] || item.material || '—'}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>
                              {item.total > 0 ? item.total : (
                                <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 800, backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
                                  HẾT HÀNG
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#166534' }}>{item.available}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1D4ED8' }}>{item.rented}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#B45309' }}>{item.maintenance}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  disabled={variantBusy}
                                  onClick={() => { setVariantEditRow(item); setVariantEditQty(String(item.total)); }}
                                  style={{
                                    padding: '6px 12px', border: '1px solid var(--color-light-border)', borderRadius: '4px',
                                    backgroundColor: 'white', cursor: variantBusy ? 'not-allowed' : 'pointer',
                                    fontWeight: 700, fontSize: '11px', color: 'var(--color-primary)', opacity: variantBusy ? 0.5 : 1
                                  }}
                                >
                                  Sửa số lượng
                                </button>
                                <button
                                  disabled={variantBusy}
                                  onClick={() => handleRemoveVariant(item)}
                                  style={{
                                    padding: '6px 12px', border: '1px solid #FECACA', borderRadius: '4px',
                                    backgroundColor: '#FEF2F2', cursor: variantBusy ? 'not-allowed' : 'pointer',
                                    fontWeight: 700, fontSize: '11px', color: '#DC2626', opacity: variantBusy ? 0.5 : 1
                                  }}
                                >
                                  Xoá biến thể
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {inventorySummary.length > invSummaryLimit && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-light-bg)', border: '1px solid var(--color-light-border)', borderRadius: '8px', padding: '14px 20px', marginTop: '16px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                        Hiển thị {pagedSummary.length} trên tổng số {inventorySummary.length} biến thể
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          disabled={invSummaryCurrent <= 1}
                          onClick={() => setInvSummaryPage(p => Math.max(1, p - 1))}
                          style={{ padding: '6px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: invSummaryCurrent > 1 ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}
                        >
                          Trang trước
                        </button>
                        <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white' }}>
                          {invSummaryCurrent} / {invSummaryTotalPages}
                        </span>
                        <button
                          disabled={invSummaryCurrent >= invSummaryTotalPages}
                          onClick={() => setInvSummaryPage(p => Math.min(invSummaryTotalPages, p + 1))}
                          style={{ padding: '6px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: invSummaryCurrent < invSummaryTotalPages ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}
                        >
                          Trang sau
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 2. DETAIL VIEW */}
            <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>
                DANH SÁCH CHI TIẾT HIỆN VẬT ÁO DÀI
              </h3>
              {inventoryItems.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Chưa có chiếc áo dài nào trong kho. Tạo áo dài mới ở tab "Sản phẩm", hoặc mở Sửa sản phẩm → bước 2 để nhập thêm hàng.</div>
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
                              <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--color-primary)' }}>{item.sku}</td>
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
                                      disabled={variantBusy}
                                      onClick={() => {
                                        setEditInvItem(item);
                                        setEditInvStatus(item.status);
                                        setEditInvCondition(item.conditionStatus);
                                        setEditInvNotes(item.notes || '');
                                        setIsEditInventoryOpen(true);
                                      }}
                                      style={{
                                        padding: '6px 12px', border: '1px solid var(--color-light-border)', borderRadius: '4px',
                                        backgroundColor: 'white', cursor: variantBusy ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '11px',
                                        color: 'var(--color-primary)', opacity: variantBusy ? 0.5 : 1
                                      }}
                                    >
                                      Cập nhật
                                    </button>
                                    <button
                                      disabled={variantBusy}
                                      onClick={() => handleDeleteInventoryItem(item._id)}
                                      style={{
                                        padding: '6px 12px', border: 'none', borderRadius: '4px',
                                        backgroundColor: '#FEE2E2', cursor: variantBusy ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '11px',
                                        color: '#991B1B', opacity: variantBusy ? 0.5 : 1
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
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-light-bg)' }}>
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
            <button onClick={() => setCurrentView('rental-operations')} style={navItemStyle(currentView === 'rental-operations')}><Package size={18} /> Giao & nhận áo dài</button>
            <button onClick={() => { setCurrentView('collections'); setCollectionTab('products'); }} style={navItemStyle(currentView === 'collections' && collectionTab === 'products')}><Layers size={18} /> Bộ sưu tập</button>
            <button onClick={() => setCurrentView('profile')} style={navItemStyle(currentView === 'profile')}><Award size={18} /> Thông tin dịch vụ</button>
            {hasPhotographyCapability && (
              <button onClick={() => setCurrentView('portfolio')} style={navItemStyle(currentView === 'portfolio')}><Camera size={18} /> Quản lý Portfolio</button>
            )}
            {hasPhotographyCapability && (
              <button onClick={() => setCurrentView('photography-packages')} style={navItemStyle(currentView === 'photography-packages')}><Package size={18} /> Gói chụp ảnh</button>
            )}
            <button onClick={() => setCurrentView('calendar')} style={navItemStyle(currentView === 'calendar')}><Calendar size={18} /> Lịch làm việc & Chặn</button>
            <button onClick={() => setCurrentView('vouchers')} style={navItemStyle(currentView === 'vouchers')}><Tag size={18} /> Mã khuyến mãi & Combo</button>
            <button onClick={() => setCurrentView('reviews')} style={navItemStyle(currentView === 'reviews')}><MessageSquare size={18} /> Đánh giá & Phản hồi</button>
            <button onClick={() => setCurrentView('trust')} style={navItemStyle(currentView === 'trust')}><Users size={18} /> Đánh giá khách hàng</button>
            <button onClick={() => setCurrentView('payouts')} style={navItemStyle(currentView === 'payouts')}><DollarSign size={18} /> Lịch sử quyết toán</button>
            <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
            <button onClick={() => setCurrentView('role-management')} style={navItemStyle(currentView === 'role-management')}><ShieldCheck size={18} /> Quản lý vai trò</button>
          </nav>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
          <button onClick={() => navigate('/')} style={navItemStyle(false)}><ArrowLeft size={18} /> Trang chủ</button>
          <button onClick={handleLogoutClick} style={{ ...navItemStyle(false), color: '#FCA5A5' }}><LogOut size={18} /> Đăng xuất</button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: 'var(--color-light-bg)' }}>
        {/* TOP BAR */}
        <header style={{
          height: '60px', borderBottom: '1px solid var(--color-light-border)', backgroundColor: 'var(--color-light-card)',
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
                    padding: '14px 18px', borderBottom: '1px solid var(--color-light-border)',
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
                          padding: '4px 8px', border: '1px solid var(--color-light-border)', borderRadius: '5px',
                          backgroundColor: 'white', color: 'var(--color-gold-dark)', fontSize: '10px',
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
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Đang tải...</span>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <Bell size={28} color="var(--color-gold-light)" style={{ marginBottom: '8px' }} />
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Chưa có thông báo</p>
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
                              borderBottom: '1px solid var(--color-light-border)',
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
                                <span style={{ fontSize: '12px', fontWeight: noti.isRead ? 600 : 750, color: 'var(--color-text-primary)' }}>
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
                                margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)',
                                lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical' as any, overflow: 'hidden'
                              }}>
                                {noti.content}
                              </p>
                              <span style={{ fontSize: '9px', color: 'var(--color-text-secondary)', fontWeight: 500, marginTop: '3px', display: 'block' }}>
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
              <button onClick={() => toast.info('Tính năng xuất CSV đang được phát triển.')} style={{
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
<div style={{ borderTop: '1px dashed var(--color-light-border)', paddingTop: '16px', marginTop: '16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Loại đơn hàng:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                      { label: 'Tất cả', type: 'Tất cả', count: orders.length },
                      { label: 'Áo dài', type: 'AODAI_RENTAL', count: orders.filter(o => o.bookingType === 'AODAI_RENTAL').length },
                      { label: 'Thợ chụp', type: 'PHOTOGRAPHY', count: orders.filter(o => o.bookingType === 'PHOTOGRAPHY').length },
                      { label: 'Combo', type: 'COMBO', count: orders.filter(o => o.bookingType === 'COMBO').length },
                    ].map(t => <button key={t.type} onClick={() => setBookingTypeFilter(t.type)} style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: bookingTypeFilter === t.type ? 'var(--color-primary)' : 'var(--color-light-bg)', color: bookingTypeFilter === t.type ? 'white' : 'var(--color-text-secondary)' }}>{t.label} ({t.count})</button>)}
                  </div>
                </div>
              </div>
              <div style={{
                backgroundColor: 'var(--color-primary-trans)', border: '1px solid rgba(161,30,34,0.12)', borderRadius: 'var(--radius-md)',
                padding: '24px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Doanh thu tháng này</div>
                <div style={{ fontFamily: 'var(--font-header)', fontSize: '28px', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {monthlyRevenue > 0 ? `${monthlyRevenue.toLocaleString('vi-VN')}đ` : '—'}
                </div>
                <div style={{ position: 'absolute', right: '16px', bottom: '8px', opacity: 0.06, pointerEvents: 'none', color: 'var(--color-primary)' }}><ShoppingBag size={80} /></div>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-sm)' }}>
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
                  ) : (
                    filteredOrders.map(o => {
                      const hasRentalLifecycle = Array.isArray(o.items) && o.items.some((item: any) => Boolean(item.rentalFulfillment));
                      void hasRentalLifecycle;
                      return (
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
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={statusBadgeStyle(o.status)}>{o.status}</span>
                              {o.pickupDamageReport && (
                                <span style={{
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  backgroundColor: '#FEF9E7',
                                  color: '#D35400',
                                  border: '1px solid #F5CBA7',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap'
                                }}>
                                  ⚠️ KHÁCH BÁO LỖI
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'center', position: 'relative' }}>
                            <button onClick={() => setActionMenuId(actionMenuId === o._id ? null : o._id)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}><MoreVertical size={16} /></button>
                            {actionMenuId === o._id && (() => {
                              // Các bước tiếp theo hợp lệ cho từng trạng thái (khớp với backend allowedTransitions)
                              const nextStepsMap: Record<string, { label: string; apiStatus: string; icon: React.ReactNode; color: string }[]> = {
                                PENDING_PAYMENT: [
                                  { label: 'Xác nhận đơn', apiStatus: 'CONFIRMED', icon: <CheckCircle size={14} />, color: '#1565C0' },
                                  { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
                                ],
                                DEPOSIT_PAID: [
                                  { label: 'Xác nhận đơn', apiStatus: 'CONFIRMED', icon: <CheckCircle size={14} />, color: '#1565C0' },
                                  { label: 'Báo chờ nhận đồ', apiStatus: 'PICKUP_PENDING', icon: <Package size={14} />, color: 'var(--color-gold)' },
                                  { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
                                ],
                                CONFIRMED: [
                                  { label: 'Báo chờ nhận đồ', apiStatus: 'PICKUP_PENDING', icon: <Package size={14} />, color: 'var(--color-gold)' },
                                  { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
                                ],
                                PICKUP_PENDING: [
                                  { label: 'Xác nhận đã lấy đồ', apiStatus: 'PICKED_UP', icon: <CheckCheck size={14} />, color: '#2e7d32' },
                                  { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
                                ],
                                PICKED_UP: [
                                  { label: 'Xác nhận đã trả đồ', apiStatus: 'RETURNED', icon: <Check size={14} />, color: '#2e7d32' },
                                  { label: 'Chờ kiểm tra đồ', apiStatus: 'RETURN_PENDING', icon: <Eye size={14} />, color: 'var(--color-gold)' },
                                ],
                                RETURN_PENDING: [
                                  { label: 'Xác nhận đã trả đồ', apiStatus: 'RETURNED', icon: <Check size={14} />, color: '#2e7d32' },
                                ],
                                RETURNED: [
                                  { label: 'Hoàn thành đơn', apiStatus: 'COMPLETED', icon: <CheckCircle size={14} />, color: '#2e7d32' },
                                ],
                              };
                               const rawStatus = (o.rawStatus || '') as string;
                               const steps: { label: string; apiStatus: string; icon: React.ReactNode; color: string }[] = (nextStepsMap[rawStatus] || []).filter((step) => !(hasRentalLifecycle && step.apiStatus === 'COMPLETED'));
                               const canReport = ['CONFIRMED', 'PICKED_UP', 'RETURN_PENDING', 'RETURNED', 'DISPUTED'].includes(rawStatus);
                               const pendingReschedule = o.items?.find((item: any) => item?.rescheduleRequest?.status === 'PENDING');
                               if (steps.length === 0 && !canReport && !pendingReschedule) return null;
                               return (
                                 <div style={{ position: 'absolute', right: '20px', top: '40px', width: '210px', backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', padding: '4px 0', zIndex: 40 }}>
                                   {pendingReschedule && (
                                     <div style={{ padding: '8px 12px', borderBottom: steps.length > 0 || canReport ? '1px solid var(--color-light-border)' : 'none' }}>
                                       <div style={{ fontSize: '10px', fontWeight: 700, color: '#9A6700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Yêu cầu đổi lịch</div>
                                       <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.4, marginBottom: '7px' }}>
                                         {pendingReschedule.rescheduleRequest.newShootDate
                                           ? `${pendingReschedule.rescheduleRequest.newShootDate} • ${pendingReschedule.rescheduleRequest.newShootTimeSlot}`
                                           : `${new Date(pendingReschedule.rescheduleRequest.newRentalFrom).toLocaleDateString('vi-VN')} - ${new Date(pendingReschedule.rescheduleRequest.newRentalTo).toLocaleDateString('vi-VN')}`}
                                       </div>
                                       <div style={{ display: 'flex', gap: '6px' }}>
                                          <button type={'button'} onClick={() => void resolveRescheduleRequest(o, pendingReschedule, true)} style={{ flex: 1, border: 'none', borderRadius: '5px', padding: '6px', background: '#E8F5E9', color: '#1E7A46', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Duyệt</button>
                                          <button type={'button'} onClick={() => void resolveRescheduleRequest(o, pendingReschedule, false)} style={{ flex: 1, border: 'none', borderRadius: '5px', padding: '6px', background: '#FDECEC', color: '#C0392B', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Từ chối</button>
                                       </div>
                                     </div>
                                   )}
                                   {steps.length > 0 && (
                                    <div style={{ padding: '6px 12px 2px', fontSize: '10px', fontWeight: 700, color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Cập nhật trạng thái
                                    </div>
                                  )}
                                  {steps.map((a: { label: string; apiStatus: string; icon: React.ReactNode; color: string }) => {
                                    const isHandoverAction = a.apiStatus === 'PICKUP_PENDING' || a.apiStatus === 'PICKED_UP';
                                    let isDisabled = false;
                                    if (isHandoverAction) {
                                      const firstItem = o.items?.[0];
                                      const startDateStr = firstItem?.startDate || firstItem?.rentalFrom;
                                      if (startDateStr) {
                                        const today = new Date();
                                        const start = new Date(startDateStr);
                                        const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                        const startZero = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                                        const diffDays = (startZero.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24);
                                        if (diffDays > 1) {
                                          isDisabled = true;
                                        }
                                      }
                                    }
                                    return (
                                      <button
                                        key={a.apiStatus}
                                        disabled={isDisabled}
                                        onClick={() => changeOrderStatus(o._id, a.apiStatus)}
                                        style={{
                                          width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                          fontSize: '12px', border: 'none', background: 'none',
                                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                                          color: isDisabled ? '#CCCCCC' : a.color,
                                          opacity: isDisabled ? 0.6 : 1,
                                          fontWeight: 600, textAlign: 'left',
                                        }}
                                        title={isDisabled ? "Chưa đến thời gian bàn giao đồ (tối đa trước 24h)" : ""}
                                      >
                                        {a.icon} {a.label}
                                      </button>
                                    );
                                  })}
                                  {canReport && (
                                    <button onClick={() => {
                                      setReportingOrder(o);
                                      setSelectedItemId(o.items?.[0]?._id || '');
                                      setIncidentDesc('');
                                      setIncidentPhotos([]);
                                      setIncidentAmount(o.depositTotal || 0);
                                      setIncidentActionType('CLEANING');
                                      setActionMenuId(null);
                                    }} style={{
                                      width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                      fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-primary)',
                                      fontWeight: 700, textAlign: 'left', borderTop: steps.length > 0 ? '1px solid var(--color-light-border)' : 'none'
                                    }}><Flag size={14} /> Báo cáo hỏng đồ</button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    }))}
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

        {currentView === 'rental-operations' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Giao & nhận áo dài</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '660px', lineHeight: 1.5 }}>Danh sách áo dài shop cần chuẩn bị, giao hoặc nhận lại. Mỗi bước giao/nhận yêu cầu ảnh evidence riêng tư.</p>
              </div>
              <button type="button" onClick={() => void fetchOrders()} disabled={loadingOrders} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'white', border: '1px solid var(--color-light-border)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: loadingOrders ? 'wait' : 'pointer', color: 'var(--color-text-primary)' }}><CheckCircle size={15} /> {loadingOrders ? 'Đang tải…' : 'Làm mới'}</button>
            </div>

            <section style={{ border: '1px solid #F3D3D3', background: '#FFF8F7', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <strong style={{ color: 'var(--color-primary-dark)', fontSize: '14px' }}>{rentalOperationItems.length} áo dài đang cần theo dõi</strong>
              <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>Shop chỉ xác nhận chuẩn bị, giao/nhận kèm evidence và đề xuất phí. Admin mới được chốt cọc cùng trạng thái kho.</p>
            </section>

            {loadingOrders ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Đang tải danh sách áo dài…</div>
            ) : rentalOperationItems.length === 0 ? (
              <section style={{ background: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '42px', textAlign: 'center' }}>
                <Package size={34} color="var(--color-primary)" style={{ marginBottom: '12px' }} />
                <h3 style={{ margin: '0 0 8px', fontSize: '17px' }}>Chưa có áo dài nào cần vận hành</h3>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: 1.55 }}>Các đơn chụp ảnh, đơn đã hủy và áo dài legacy chưa được Admin migrate sẽ không xuất hiện ở đây. Tạo hoặc xác nhận một booking áo dài mới để bắt đầu.</p>
              </section>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {rentalOperationItems.map(({ order, item }: any) => {
                  const fulfillment = item.rentalFulfillment;
                  const labels: Record<string, string> = { PENDING: 'Chờ shop chuẩn bị', READY_FOR_PICKUP: 'Sẵn sàng giao áo', PICKED_UP: 'Khách đang thuê', RETURNED: 'Đã nhận lại, chờ tất toán' };
                  const productName = item.productId?.name || item.name || order.productName || 'Áo dài';
                  return (
                    <article key={item._id} style={{ background: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                        <div><div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>{order.id || 'BOOKING'}</div><h3 style={{ margin: '5px 0 0', fontSize: '16px' }}>{productName}</h3></div>
                        <span style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '999px', background: '#FFF1EE', color: 'var(--color-primary-dark)', fontWeight: 750 }}>{labels[fulfillment.status] || fulfillment.status}</span>
                      </div>
                      <div style={{ marginTop: '14px', display: 'grid', gap: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        <span>Khách: <strong style={{ color: 'var(--color-text-primary)' }}>{order.customerName}</strong></span>
                        <span>Hạn nhận: {fulfillment.pickupDueAt ? new Date(fulfillment.pickupDueAt).toLocaleString('vi-VN') : '—'}</span>
                        <span>Hạn trả: {fulfillment.returnDueAt ? new Date(fulfillment.returnDueAt).toLocaleString('vi-VN') : '—'}</span>
                      </div>
                      <button type="button" onClick={() => { setSelectedBookingId(order._id); setIsDetailModalOpen(true); }} style={{ marginTop: '16px', width: '100%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '7px', border: 'none', background: 'var(--color-primary)', color: 'white', borderRadius: '6px', padding: '10px 12px', cursor: 'pointer', fontWeight: 750, fontSize: '12px' }}><Package size={15} /> Mở giao diện vận hành</button>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        )}
        {currentView === 'collections' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Bộ sưu tập</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '560px' }}>
                  {collectionTab === 'inventory'
                    ? 'Xem tồn kho biến thể, bổ sung hàng hoặc cập nhật trạng thái làm sạch / bảo trì cho từng chiếc áo dài.'
                    : 'Thêm mới, cập nhật giá, hình ảnh và quản lý bộ sưu tập áo dài của bạn.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {collectionTab === 'products' ? (
                  <>
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
                  </>
                ) : null}
              </div>
            </div>

            {/* Tab con: Sản phẩm | Tồn kho */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--color-light-border)' }}>
              {[{ key: 'products', label: 'Sản phẩm' }, { key: 'inventory', label: 'Tồn kho' }].map(t => {
                const active = collectionTab === t.key;
                return (
                  <button key={t.key} type="button" onClick={() => setCollectionTab(t.key as 'products' | 'inventory')} style={{ padding: '10px 18px', border: 'none', borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {collectionTab === 'products' && (
              <>
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
              </>
            )}
            {collectionTab === 'inventory' && (
              <div>{renderInventoryView()}</div>
            )}
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
                  <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--color-light-border)', paddingTop: '20px', marginTop: '4px' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'var(--color-text-primary)' }}>Địa điểm và phạm vi phục vụ</h3>
                    <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Pin nội bộ này dùng để kiểm tra bán kính. Tọa độ chính xác không hiển thị công khai cho khách.</p>
                    <PhotographyLocationPicker
                      value={baseLatitude !== '' && baseLongitude !== '' ? { address: addressLine, latitude: Number(baseLatitude), longitude: Number(baseLongitude) } : null}
                      onSelect={(location) => {
                        setAddressLine(location.address);
                        setBaseLatitude(location.latitude.toString());
                        setBaseLongitude(location.longitude.toString());
                      }}
                      title="Pin địa chỉ kinh doanh / điểm xuất phát"
                      hint="Kéo pin để chọn vị trí chính xác. Đây là tâm để kiểm tra bán kính phục vụ chụp ảnh."
                      radiusKm={hasPhotographyCapability && serviceRadiusKm !== '' ? Number(serviceRadiusKm) : null}
                    />
                    {hasPhotographyCapability && <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px', maxWidth: '280px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>BÁN KÍNH PHỤC VỤ CHỤP (KM)</label>
                      <input type="number" min={0} max={500} step="0.1" value={serviceRadiusKm} onChange={(e) => setServiceRadiusKm(e.target.value)} placeholder="Ví dụ: 15" style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
                    </div>}
                  </div>
                  <div style={{ gridColumn: 'span 2', padding: '16px', border: '1px solid var(--color-light-border)', borderRadius: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: useBusinessAddressForPickup ? 0 : '14px' }}><input type="checkbox" checked={useBusinessAddressForPickup} onChange={(e) => setUseBusinessAddressForPickup(e.target.checked)} /> Dùng địa chỉ kinh doanh cho cả nhận và trả áo dài</label>
                    {!useBusinessAddressForPickup && <PhotographyLocationPicker
                      value={pickupLatitude !== '' && pickupLongitude !== '' ? { address: pickupAddressLine, latitude: Number(pickupLatitude), longitude: Number(pickupLongitude) } : null}
                      onSelect={(location) => {
                        setPickupAddressLine(location.address);
                        setPickupLatitude(location.latitude.toString());
                        setPickupLongitude(location.longitude.toString());
                      }}
                      title="Pin điểm nhận và trả áo dài"
                      hint="MVP dùng cùng một điểm cho cả nhận và trả áo dài."
                    />}
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

        {hasPhotographyCapability && currentView === 'photography-packages' && (
          <PhotographyPackageManager enabled={hasPhotographyCapability} />
        )}

        {hasPhotographyCapability && currentView === 'portfolio' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Portfolio</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Đăng tải các tác phẩm thiết kế mẫu hoặc các dự án đã hoàn thành của bạn.</p>
              </div>
              <button
                onClick={() => setIsPortfolioFormOpen(true)}
                style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} />
                Thêm tác phẩm mới
              </button>
            </div>

            {isLoadingProvider ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải portfolio...</div>
            ) : portfolioItems.length === 0 ? (
              <div style={{ padding: '80px 40px', textAlign: 'center', backgroundColor: 'white', border: '1px dashed var(--color-light-border)', borderRadius: 'var(--radius-md)' }}>
                <Camera size={48} style={{ color: 'var(--color-text-secondary)', opacity: 0.5, marginBottom: '16px', margin: '0 auto' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 700 }}>Chưa có tác phẩm nào trong Portfolio</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>Bắt đầu đăng tải hình ảnh chất lượng cao để thu hút khách hàng đặt lịch chụp.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px' }}>
                {portfolioItems.map((item) => {
                  const isHovered = hoveredItemId === item._id;

                  let statusLabel = 'Chờ duyệt';
                  let statusBgColor = '#F59E0B';
                  if (item.moderationStatus === 'APPROVED') {
                    statusLabel = 'Đã duyệt';
                    statusBgColor = '#10B981';
                  } else if (item.moderationStatus === 'REJECTED') {
                    statusLabel = 'Từ chối';
                    statusBgColor = '#EF4444';
                  } else if (item.moderationStatus === 'HIDDEN') {
                    statusLabel = 'Tạm ẩn';
                    statusBgColor = '#6B7280';
                  }

                  return (
                    <div
                      key={item._id}
                      onMouseEnter={() => setHoveredItemId(item._id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '1px solid var(--color-light-border)',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                        transform: isHovered ? 'translateY(-4px)' : 'none',
                      }}
                    >
                      {/* Artwork Image */}
                      <img
                        src={item.images[0].startsWith('http') ? item.images[0] : getImageUrl(item.images[0])}
                        alt={item.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease',
                          transform: isHovered ? 'scale(1.05)' : 'none',
                        }}
                      />

                      {/* Always visible status badge at top-right */}
                      <span
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '12px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          backgroundColor: statusBgColor,
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 700,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          zIndex: 2,
                          pointerEvents: 'none',
                        }}
                      >
                        {statusLabel}
                      </span>

                      {/* Always visible dark gradient title overlay at bottom */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          padding: '24px 12px 12px 12px',
                          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%)',
                          color: '#FFFFFF',
                          zIndex: 1,
                          pointerEvents: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '13.5px',
                            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.title}
                        </span>
                      </div>

                      {/* Hover blur overlay containing actions */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          backdropFilter: 'blur(3px)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          opacity: isHovered ? 1 : 0,
                          transition: 'opacity 0.25s ease',
                          zIndex: 3,
                          pointerEvents: isHovered ? 'auto' : 'none',
                        }}
                      >
                        {/* Xem ảnh lớn */}
                        <button
                          onClick={() => {
                            setPreviewPortfolioItem(item);
                            setPreviewImageIndex(0);
                          }}
                          style={{
                            width: '130px',
                            padding: '8px 12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'var(--color-text-primary)',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <Eye size={12} />
                          Xem ảnh lớn
                        </button>

                        {/* Sửa thông tin */}
                        <button
                          onClick={() => {
                            setEditingPortfolioItem(item);
                            setIsPortfolioFormOpen(true);
                          }}
                          style={{
                            width: '130px',
                            padding: '8px 12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'var(--color-text-primary)',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <Pencil size={11} />
                          Sửa thông tin
                        </button>

                        {/* Gỡ ảnh */}
                        <button
                          onClick={() => handleDeletePortfolioItem(item._id)}
                          style={{
                            width: '130px',
                            padding: '8px 12px',
                            backgroundColor: '#EF4444',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.2)',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <Trash2 size={11} />
                          Gỡ tác phẩm
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '20px', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '14px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0 }}>KHUNG GIỜ LÀM VIỆC HẰNG TUẦN</h3>
                      <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>Chọn nhiều ngày và thêm các ca phù hợp. Lịch cũ của các ngày được chọn sẽ được cập nhật.</p>
                    </div>
                    {editingScheduleDay !== null && <span style={{ padding: '6px 10px', backgroundColor: '#FFF7ED', color: '#9A3412', borderRadius: '999px', fontWeight: 700, fontSize: '12px' }}>Đang sửa {daysOfWeekVn[editingScheduleDay]}</span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 750, color: 'var(--color-text-secondary)' }}>CHỌN NGÀY LÀM VIỆC</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setSelectedScheduleDays([1, 2, 3, 4, 5])} style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>Thứ 2 - Thứ 6</button>
                      <button type="button" onClick={() => setSelectedScheduleDays([0, 1, 2, 3, 4, 5, 6])} style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>Cả tuần</button>
                      <button type="button" onClick={() => setSelectedScheduleDays([])} style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>Bỏ chọn</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
                    {daysOfWeekVn.map((day, index) => {
                      const isSelected = selectedScheduleDays.includes(index);
                      return <button key={day} type="button" onClick={() => toggleScheduleDay(index)} style={{ padding: '10px 14px', minWidth: '104px', borderRadius: '8px', border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)', backgroundColor: isSelected ? 'var(--color-primary)' : 'white', color: isSelected ? 'white' : 'var(--color-text-primary)', fontWeight: 700, cursor: 'pointer' }}>{day}</button>;
                    })}
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-light-border)', paddingTop: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>Các ca làm việc</strong>
                        <p style={{ margin: '3px 0 0', color: 'var(--color-text-secondary)', fontSize: '12px' }}>Ví dụ: 08:00 - 12:00 và 13:30 - 17:30.</p>
                      </div>
                      <button type="button" onClick={() => setWorkingHourRanges((current) => [...current, { start: '08:00', end: '17:00' }])} style={{ padding: '8px 12px', border: '1px solid var(--color-primary)', borderRadius: '6px', backgroundColor: 'white', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Plus size={15} /> Thêm ca</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {workingHourRanges.map((range, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1fr) minmax(130px, 1fr) auto', gap: '12px', alignItems: 'end', padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-light-bg)' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>BẮT ĐẦU<input type="time" value={range.start} onChange={(event) => updateWorkingHourRange(index, 'start', event.target.value)} style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white' }} /></label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>KẾT THÚC<input type="time" value={range.end} onChange={(event) => updateWorkingHourRange(index, 'end', event.target.value)} style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white' }} /></label>
                          <button type="button" disabled={workingHourRanges.length === 1} onClick={() => setWorkingHourRanges((current) => current.filter((_, rangeIndex) => rangeIndex !== index))} title="Xóa ca" style={{ width: '40px', height: '40px', border: '1px solid #FECACA', borderRadius: '6px', backgroundColor: workingHourRanges.length === 1 ? '#F9FAFB' : '#FFF1F2', color: workingHourRanges.length === 1 ? '#9CA3AF' : '#DC2626', cursor: workingHourRanges.length === 1 ? 'not-allowed' : 'pointer' }}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
                    {editingScheduleDay !== null && <button type="button" onClick={() => { setEditingScheduleDay(null); setSelectedScheduleDays([1, 2, 3, 4, 5]); setWorkingHourRanges([{ start: '08:00', end: '17:00' }]); }} style={{ padding: '11px 16px', border: '1px solid var(--color-light-border)', borderRadius: '6px', backgroundColor: 'white', color: 'var(--color-text-primary)', fontWeight: 700, cursor: 'pointer' }}>Hủy sửa</button>}
                    <button type="button" onClick={handleSaveRecurringSchedules} style={{ padding: '11px 20px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>{editingScheduleDay !== null ? 'Cập nhật khung giờ' : 'Lưu lịch đã chọn'}</button>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '10px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0 }}>LỊCH TRÌNH ĐÃ THIẾT LẬP</h3>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 700 }}>{schedules.length} thiết lập</span>
                  </div>
                  {schedules.length === 0 ? (
                    <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>Chưa có thiết lập khung giờ nào.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {schedules.filter((schedule) => schedule.scheduleType === 'RECURRING').sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek)).map((schedule) => (
                        <div key={schedule._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', padding: '14px 16px', backgroundColor: 'var(--color-light-bg)', border: '1px solid var(--color-light-border)', borderRadius: '8px' }}>
                          <div>
                            <strong style={{ display: 'block', fontSize: '14px', color: 'var(--color-text-primary)' }}>{daysOfWeekVn[Number(schedule.dayOfWeek)]}</strong>
                            <span style={{ display: 'block', marginTop: '4px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{schedule.workingHours?.map((range: any) => `${range.start} - ${range.end}`).join(' · ') || 'Chưa có ca làm việc'}</span>
                          </div>
                          <button type="button" onClick={() => handleEditRecurringSchedule(schedule)} style={{ padding: '8px 12px', border: '1px solid var(--color-primary)', borderRadius: '6px', backgroundColor: 'white', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Pencil size={14} /> Sửa</button>
                        </div>
                      ))}
                      {schedules.filter((schedule) => schedule.scheduleType !== 'RECURRING').map((schedule) => (
                        <div key={schedule._id} style={{ padding: '14px 16px', backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px' }}>
                          <strong style={{ fontSize: '14px', color: '#9A3412' }}>Đã chặn ngày {schedule.specificDate ? new Date(schedule.specificDate).toLocaleDateString('vi-VN') : 'không xác định'}</strong>
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

                {/* COMBO PROMOTION SECTION */}
                {hasPhotographyCapability && hasAodaiCapability && (
                  <div style={{ borderTop: '2px dashed var(--color-light-border)', paddingTop: '40px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div>
                      <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: 0 }}>Quản lý Combo Khuyến Mãi (Áo Dài + Photographer)</h3>
                      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                        Tạo gói combo kết hợp thuê áo dài và thuê thợ chụp ảnh để được hưởng mức chiết khấu hấp dẫn hơn.
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
                      {/* Form Create/Edit Combo */}
                      <form onSubmit={handleCreateOrUpdateCombo} style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0, borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>
                          {editingComboId ? 'CẬP NHẬT COMBO' : 'TẠO COMBO MỚI'}
                        </h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÊN COMBO KHUYẾN MÃI</span>
                          <input
                            type="text"
                            placeholder="Ví dụ: Combo Tràng An - Lưu giữ khoảnh khắc"
                            value={cName}
                            onChange={(e) => setCName(e.target.value)}
                            style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                            required
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÔ TẢ COMBO (MÔ TẢ NGẮN)</span>
                          <textarea
                            placeholder="Mô tả quyền lợi combo, ví dụ: Bao gồm 1 bộ áo dài và 2 tiếng chụp hình ngoại cảnh..."
                            value={cDesc}
                            onChange={(e) => setCDesc(e.target.value)}
                            rows={2}
                            style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHỌN ÁO DÀI</span>
                            {cProductId ? (
                              (() => {
                                const prod = myProductsList.find(p => p._id === cProductId);
                                return (
                                  <div style={{ display: 'flex', gap: '10px', padding: '8px', border: '1px solid var(--color-primary)', borderRadius: '8px', backgroundColor: 'var(--color-primary-trans)', alignItems: 'center' }}>
                                    <img src={prod?.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'} alt={prod?.name} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod?.name}</div>
                                      <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>{prod?.basePrice?.toLocaleString('vi-VN')}đ</div>
                                    </div>
                                    <button type="button" onClick={() => setIsAoDaiModalOpen(true)} style={{ border: 'none', background: 'none', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Đổi</button>
                                  </div>
                                );
                              })()
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsAoDaiModalOpen(true)}
                                style={{ padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#64748B', backgroundColor: '#F8FAFC', cursor: 'pointer', textAlign: 'center' }}
                              >
                                + Chọn Áo Dài
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHỌN GÓI CHỤP ẢNH</span>
                            {cPackageId ? (
                              (() => {
                                const pkg = photoPackages.find(p => p._id === cPackageId);
                                return (
                                  <div style={{ display: 'flex', gap: '10px', padding: '8px', border: '1px solid var(--color-primary)', borderRadius: '8px', backgroundColor: 'var(--color-primary-trans)', alignItems: 'center' }}>
                                    <img src={pkg?.images?.[0] || 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb'} alt={pkg?.name} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg?.name}</div>
                                      <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>{pkg?.price?.toLocaleString('vi-VN')}đ ({pkg?.durationHours}h)</div>
                                    </div>
                                    <button type="button" onClick={() => setIsPackageModalOpen(true)} style={{ border: 'none', background: 'none', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Đổi</button>
                                  </div>
                                );
                              })()
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsPackageModalOpen(true)}
                                style={{ padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#64748B', backgroundColor: '#F8FAFC', cursor: 'pointer', textAlign: 'center' }}
                              >
                                + Chọn Gói Chụp
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>PHẦN TRĂM GIẢM GIÁ (%)</span>
                            <input
                              type="number"
                              min={1}
                              max={80}
                              value={cDiscount}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  setCDiscount('');
                                } else {
                                  const num = Number(val);
                                  if (!isNaN(num)) {
                                    setCDiscount(num);
                                  }
                                }
                              }}
                              onBlur={() => {
                                if (cDiscount === '' || cDiscount < 1) {
                                  setCDiscount(1);
                                } else if (cDiscount > 80) {
                                  setCDiscount(80);
                                }
                              }}
                              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                              required
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GIÁ COMBO TỰ ĐỊNH NGHĨA (Đ - TÙY CHỌN)</span>
                            <input
                              type="number"
                              placeholder="Để trống nếu tính theo %"
                              value={cPrice}
                              onChange={(e) => setCPrice(e.target.value)}
                              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>NGÀY BẮT ĐẦU COMBO</span>
                            <input
                              type="date"
                              value={cValidFrom}
                              onChange={(e) => setCValidFrom(e.target.value)}
                              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                              required
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>NGÀY KẾT THÚC COMBO</span>
                            <input
                              type="date"
                              value={cValidTo}
                              onChange={(e) => setCValidTo(e.target.value)}
                              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                              required
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SỐ LƯỢNG COMBO GIỚI HẠN (STOCK)</span>
                            <input
                              type="number"
                              min={1}
                              value={cMaxUsage}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCMaxUsage(val === '' ? '' : Number(val));
                              }}
                              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                              required
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SỐ LƯỢNG NGƯỜI CHỤP TRONG COMBO</span>
                            {(() => {
                              const selectedPkg = photoPackages.find(p => p._id === cPackageId);
                              const maxPeopleAllowed = selectedPkg ? (selectedPkg.maxPeople || 1) : 1;
                              return (
                                <>
                                  <input
                                    type="number"
                                    min={1}
                                    max={maxPeopleAllowed}
                                    value={cShootPeopleCount}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const num = val === '' ? '' : Number(val);
                                      if (num !== '' && num > maxPeopleAllowed) {
                                        setCShootPeopleCount(maxPeopleAllowed);
                                      } else {
                                        setCShootPeopleCount(num);
                                      }
                                    }}
                                    style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                                    required
                                  />
                                  {selectedPkg && (
                                    <small style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                      Số người chụp tối đa của gói: <strong style={{ color: 'var(--color-primary)' }}>{maxPeopleAllowed}</strong> người
                                    </small>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SỐ LƯỢNG ÁO DÀI THUÊ TRONG COMBO</span>
                            {(() => {
                              const selectedAoDaiStock = cProductId && inventorySummary
                                ? inventorySummary
                                  .filter((item: any) => item.productId === cProductId)
                                  .reduce((sum: number, item: any) => sum + (item.available || 0), 0)
                                : 0;
                              return (
                                <>
                                  <input
                                    type="number"
                                    min={1}
                                    max={selectedAoDaiStock || 1}
                                    value={cAoDaiQuantity}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const num = val === '' ? '' : Number(val);
                                      if (num !== '' && num > selectedAoDaiStock && selectedAoDaiStock > 0) {
                                        setCAoDaiQuantity(selectedAoDaiStock);
                                      } else {
                                        setCAoDaiQuantity(num);
                                      }
                                    }}
                                    style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                                    required
                                  />
                                  <small style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                    Tồn kho áo dài khả dụng: <strong style={{ color: 'var(--color-primary)' }}>{selectedAoDaiStock}</strong> sản phẩm
                                  </small>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            type="submit"
                            style={{ padding: '11px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
                          >
                            {editingComboId ? 'Cập nhật Combo' : 'Tạo Combo ngay'}
                          </button>
                          {editingComboId && (
                            <button
                              type="button"
                              onClick={clearComboForm}
                              style={{ padding: '11px 24px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', color: 'var(--color-text-primary)', cursor: 'pointer' }}
                            >
                              Hủy bỏ
                            </button>
                          )}
                        </div>

                        {/* Modal chọn Áo Dài */}
                        {isAoDaiModalOpen && (
                          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                            <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Chọn Áo Dài Cho Combo</h3>
                                <button type="button" onClick={() => setIsAoDaiModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}><X size={20} /></button>
                              </div>
                              <div style={{ padding: '16px', borderBottom: '1px solid #E2E8F0' }}>
                                <input
                                  type="text"
                                  placeholder="Tìm kiếm áo dài theo tên..."
                                  value={aoDaiSearch}
                                  onChange={(e) => setAoDaiSearch(e.target.value)}
                                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                                />
                              </div>
                              <div style={{ padding: '20px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {myProductsList.filter(p => p.name.toLowerCase().includes(aoDaiSearch.toLowerCase())).map((prod) => (
                                  <div
                                    key={prod._id}
                                    onClick={() => { setCProductId(prod._id); setIsAoDaiModalOpen(false); }}
                                    style={{ display: 'flex', gap: '12px', padding: '12px', border: cProductId === prod._id ? '2px solid var(--color-primary)' : '1px solid #E2E8F0', borderRadius: '12px', cursor: 'pointer', backgroundColor: cProductId === prod._id ? 'var(--color-primary-trans)' : 'white', transition: 'all 0.2s', alignItems: 'center' }}
                                  >
                                    <img src={prod.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'} alt={prod.name} style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                                    <div style={{ flex: 1 }}>
                                      <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{prod.name}</strong>
                                      <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700, marginTop: '2px' }}>{prod.basePrice?.toLocaleString('vi-VN')}đ</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Modal chọn Gói chụp ảnh */}
                        {isPackageModalOpen && (
                          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                            <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Chọn Gói Chụp Cho Combo</h3>
                                <button type="button" onClick={() => setIsPackageModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}><X size={20} /></button>
                              </div>
                              <div style={{ padding: '16px', borderBottom: '1px solid #E2E8F0' }}>
                                <input
                                  type="text"
                                  placeholder="Tìm kiếm gói chụp theo tên..."
                                  value={packageSearch}
                                  onChange={(e) => setPackageSearch(e.target.value)}
                                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                                />
                              </div>
                              <div style={{ padding: '20px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {photoPackages.filter(p => p.name.toLowerCase().includes(packageSearch.toLowerCase())).map((pkg) => (
                                  <div
                                    key={pkg._id}
                                    onClick={() => { setCPackageId(pkg._id); setIsPackageModalOpen(false); }}
                                    style={{ display: 'flex', gap: '12px', padding: '12px', border: cPackageId === pkg._id ? '2px solid var(--color-primary)' : '1px solid #E2E8F0', borderRadius: '12px', cursor: 'pointer', backgroundColor: cPackageId === pkg._id ? 'var(--color-primary-trans)' : 'white', transition: 'all 0.2s', alignItems: 'center' }}
                                  >
                                    <img src={pkg.images?.[0] || 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb'} alt={pkg.name} style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                                    <div style={{ flex: 1 }}>
                                      <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{pkg.name}</strong>
                                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Thời lượng: {pkg.durationHours}h</div>
                                      <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700, marginTop: '2px' }}>{pkg.price?.toLocaleString('vi-VN')}đ</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </form>

                      {/* Danh sách Combo */}
                      <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>
                          DANH SÁCH COMBO ĐANG CHẠY
                        </h4>
                        {combos.length === 0 ? (
                          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', margin: 'auto' }}>Chưa có combo khuyến mãi nào được tạo.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '480px' }}>
                            {combos.map((cb) => (
                              <div key={cb._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'var(--color-light-bg)' }}>
                                <div style={{ flex: 1, marginRight: '16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ padding: '2px 8px', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '4px', fontWeight: 700, fontSize: '11px' }}>
                                      -{cb.discountPercent}%
                                    </span>
                                    <h5 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{cb.name}</h5>
                                  </div>
                                  {cb.description && (
                                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 8px 0' }}>{cb.description}</p>
                                  )}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--color-text-primary)', marginTop: '8px' }}>
                                    <div><strong>Áo dài:</strong> {cb.productId?.name || 'Sản phẩm đã bị xóa'}</div>
                                    <div><strong>Gói chụp:</strong> {cb.photographyPackageId?.name || 'Gói chụp đã bị xóa'}</div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '11px' }}>
                                      {((cb.productId?.basePrice || 0) + (cb.photographyPackageId?.price || 0)).toLocaleString('vi-VN')}đ
                                    </div>
                                    <div style={{ color: '#EF4444', fontWeight: 700, fontSize: '15px' }}>
                                      {cb.comboPrice ? cb.comboPrice.toLocaleString('vi-VN') : Math.round(((cb.productId?.basePrice || 0) + (cb.photographyPackageId?.price || 0)) * (1 - cb.discountPercent / 100)).toLocaleString('vi-VN')}đ
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                    <button
                                      onClick={() => handleEditCombo(cb)}
                                      style={{ padding: '6px 10px', border: '1px solid var(--color-primary)', borderRadius: '4px', backgroundColor: 'white', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCombo(cb._id)}
                                      style={{ padding: '6px 10px', border: '1px solid #EF4444', borderRadius: '4px', backgroundColor: 'white', color: '#EF4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Mã khách hàng: {booking.customerId?._id || booking.customerId?.id || String(booking.customerId || '—')}</p>
                          </div>
                          <button
                            onClick={() => setRatingBooking({ bookingId: booking._id, customerId: booking.customerId?._id || booking.customerId?.id || String(booking.customerId || '') })}
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
                {/* WALLET SUMMARY CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                  <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', letterSpacing: '0.05em' }}>ĐANG GIỮ (PENDING)</span>
                      <Clock size={20} style={{ color: '#D97706' }} />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      {(walletData?.pendingBalance || 0).toLocaleString('vi-VN')}đ
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      Tiền đơn đang thực hiện & chờ khách xác nhận
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', letterSpacing: '0.05em' }}>KHẢ DỤNG (AVAILABLE)</span>
                      <DollarSign size={20} style={{ color: '#059669' }} />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669' }}>
                      {(walletData?.availableBalance || 0).toLocaleString('vi-VN')}đ
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      Tiền đã hoàn thành, sẵn sàng đối soát
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284C7', letterSpacing: '0.05em' }}>TỔNG THU NHẬP</span>
                      <ShieldCheck size={20} style={{ color: '#0284C7' }} />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284C7' }}>
                      {(walletData?.totalEarned || 0).toLocaleString('vi-VN')}đ
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      Doanh thu tích lũy toàn thời gian
                    </div>
                  </div>
                </div>

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
                              key={p._id || p.settlementCode}
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
                              <td style={{ padding: '16px 20px', fontWeight: 700 }}>{p.settlementCode || p.id}</td>
                              <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-primary-dark)' }}>{p.bookingId?.bookingCode || p.bookingCode || '—'}</td>
                              <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>{(p.payableAmount ?? p.netAmount ?? p.amount ?? 0).toLocaleString('vi-VN')}đ</td>
                              <td style={{ padding: '16px 20px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.bank}</span>
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
                              <td style={{ padding: '16px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{new Date(p.settledAt || p.createdAt || p.date).toLocaleDateString('vi-VN')}</td>
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

        {/* Footer */}
        {/* ==================== ROLE MANAGEMENT VIEW ==================== */}
        {currentView === 'role-management' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý vai trò dịch vụ</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Xem và quản lý các loại dịch vụ bạn đang cung cấp. Bạn có thể đăng ký thêm vai trò mới để mở rộng kinh doanh.</p>
              </div>
            </div>

            {isLoadingProvider ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải dữ liệu...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Current Capabilities */}
                <div style={{ background: 'var(--color-light-card)', borderRadius: '16px', border: '1px solid var(--color-light-border)', padding: '28px' }}>
                  <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={20} style={{ color: 'var(--color-primary)' }} />
                    Vai trò hiện tại
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {/* AODAI_RENTAL capability card */}
                    {(() => {
                      const hasAodai = hasAodaiCapability;
                      const hasPhoto = hasPhotographyCapability;
                      const allCapabilities = [
                        {
                          key: 'AODAI_RENTAL',
                          label: 'Cho thuê Áo dài',
                          description: 'Quản lý cửa hàng áo dài, bộ sưu tập sản phẩm, tồn kho và đơn hàng cho thuê.',
                          icon: <Layers size={24} />,
                          active: hasAodai,
                          gradient: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)',
                          borderColor: '#F9A8D4',
                          iconBg: '#FBD5E8',
                          iconColor: '#BE185D',
                        },
                        {
                          key: 'PHOTOGRAPHY',
                          label: 'Thợ chụp ảnh',
                          description: 'Quản lý portfolio ảnh, tạo các gói chụp ảnh chuyên nghiệp và nhận đơn đặt lịch.',
                          icon: <Camera size={24} />,
                          active: hasPhoto,
                          gradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                          borderColor: '#93C5FD',
                          iconBg: '#BFDBFE',
                          iconColor: '#1D4ED8',
                        },
                      ];
                      return allCapabilities.map((cap) => (
                        <div key={cap.key} style={{
                          background: cap.active ? cap.gradient : '#F9FAFB',
                          borderRadius: '14px',
                          border: `2px solid ${cap.active ? cap.borderColor : '#E5E7EB'}`,
                          padding: '24px',
                          position: 'relative',
                          overflow: 'hidden',
                          opacity: cap.active ? 1 : 0.65,
                          transition: 'all 0.3s ease',
                        }}>
                          {cap.active && (
                            <div style={{
                              position: 'absolute', top: '12px', right: '12px',
                              background: '#10B981', color: 'white',
                              borderRadius: '20px', padding: '3px 12px', fontSize: '11px', fontWeight: 700,
                              display: 'flex', alignItems: 'center', gap: '4px',
                            }}>
                              <CheckCircle size={12} /> Đang hoạt động
                            </div>
                          )}
                          <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: cap.active ? cap.iconBg : '#E5E7EB',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: cap.active ? cap.iconColor : '#9CA3AF',
                            marginBottom: '16px',
                          }}>
                            {cap.icon}
                          </div>
                          <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: cap.active ? 'var(--color-text-primary)' : '#9CA3AF' }}>{cap.label}</h4>
                          <p style={{ fontSize: '13px', color: cap.active ? 'var(--color-text-secondary)' : '#D1D5DB', margin: 0, lineHeight: '1.5' }}>{cap.description}</p>
                          {!cap.active && (
                            <button
                              onClick={() => navigate(`/provider/register?upgrade=${cap.key}`)}
                              style={{
                                marginTop: '16px', width: '100%', padding: '10px 16px',
                                background: 'var(--color-primary)', color: 'white',
                                border: 'none', borderRadius: '10px', fontWeight: 700,
                                fontSize: '13px', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', gap: '8px',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(184,144,71,0.3)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                              <Plus size={16} /> Đăng ký thêm vai trò này
                            </button>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Benefits info */}
                <div style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', borderRadius: '16px', border: '1px solid #FDE68A', padding: '24px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} style={{ color: '#D97706' }} />
                    Lợi ích khi kết hợp nhiều vai trò
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {[
                      { icon: '📦', text: 'Tạo combo ưu đãi "Áo dài + Chụp ảnh" thu hút khách hàng' },
                      { icon: '💰', text: 'Tăng doanh thu từ đa nguồn dịch vụ trên cùng một nền tảng' },
                      { icon: '⭐', text: 'Nâng cao uy tín thương hiệu với portfolio đa dạng' },
                      { icon: '🎯', text: 'Được đề xuất ưu tiên trong kết quả tìm kiếm' },
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#78350F', lineHeight: '1.5' }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* How it works */}
                <div style={{ background: 'var(--color-light-card)', borderRadius: '16px', border: '1px solid var(--color-light-border)', padding: '28px' }}>
                  <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-text-primary)' }}>
                    Quy trình đăng ký thêm vai trò
                  </h3>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {[
                      { step: '1', title: 'Chọn vai trò', desc: 'Bấm nút "Đăng ký thêm" ở vai trò bạn muốn' },
                      { step: '2', title: 'Bổ sung hồ sơ', desc: 'Điền thông tin nghiệp vụ và tải tài liệu cần thiết' },
                      { step: '3', title: 'Chờ phê duyệt', desc: 'Admin sẽ xét duyệt hồ sơ trong 1-3 ngày làm việc' },
                      { step: '4', title: 'Bắt đầu hoạt động', desc: 'Vai trò mới được kích hoạt sau khi phê duyệt' },
                    ].map((s, idx) => (
                      <div key={idx} style={{
                        flex: '1 1 200px', display: 'flex', gap: '12px', alignItems: 'flex-start',
                        padding: '16px', borderRadius: '12px', background: '#F9FAFB',
                      }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'var(--color-primary)', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '13px', fontWeight: 800, flexShrink: 0,
                        }}>
                          {s.step}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>{s.title}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>
        )}

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
        onClose={handleWizardCancel}
        title={editingProduct ? 'Chỉnh sửa thông tin Áo Dài' : 'Đăng ký Áo Dài mới'}
        maxWidth="720px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
          {/* Thanh chi buoc wizard */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ n: 1, label: 'Thông tin & phân loại' }, { n: 2, label: 'Biến thể & kho' }, { n: 3, label: 'Thẻ thông minh' }].map(step => {
              const active = wizardStep === step.n;
              const done = wizardStep > step.n;
              return (
                <button
                  key={step.n}
                  type="button"
                  onClick={() => { if (editingProduct) setWizardStep(step.n); }}
                  style={{ flex: 1, textAlign: 'center', fontSize: '11.5px', fontWeight: 700, padding: '7px 4px', borderRadius: '6px', border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)', backgroundColor: active ? 'var(--color-primary-trans)' : done ? 'var(--color-light-bg)' : 'white', color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)', cursor: editingProduct ? 'pointer' : 'default' }}
                >
                  <span style={{ marginRight: '4px' }}>{done ? '✓' : step.n}</span>{step.label}
                </button>
              );
            })}
          </div>

          {wizardStep === 1 && (
            <>

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
                      <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
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

              {/* Video Upload (tuỳ chọn) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>VIDEO GIỚI THIỆU (TÙY CHỌN)</label>
                <div
                  style={{
                    border: '2px dashed var(--color-light-border)',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    backgroundColor: 'var(--color-light-bg)',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)',
                  }}
                  onClick={() => document.getElementById('product-video-upload')?.click()}
                >
                  <input
                    id="product-video-upload"
                    type="file"
                    multiple
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={handleVideoChange}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <Play size={22} style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {uploadingVideos ? 'Đang tải video lên máy chủ...' : 'Click để chọn video từ máy của bạn'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Hỗ trợ MP4, WEBM, MOV (Tối đa 50MB / video · tối đa 2 video)</span>
                  </div>
                </div>

                {prodVideos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginTop: '8px' }}>
                    {prodVideos.map((videoUrl, index) => (
                      <div key={index} style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-light-border)', backgroundColor: '#000' }}>
                        <video
                          src={getImageUrl(videoUrl)}
                          controls
                          preload="metadata"
                          style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
                        />
                        <button
                          type="button"
                          onClick={() => removeVideo(index)}
                          style={{
                            position: 'absolute', top: '4px', right: '4px',
                            width: '20px', height: '20px', borderRadius: '50%',
                            backgroundColor: 'rgba(0,0,0,0.65)', color: 'white',
                            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', zIndex: 2,
                          }}
                          title="Xóa video này"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </>
          )}

          {wizardStep === 2 && (
            <>
              {editingProduct ? (
                <div style={{ padding: '16px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'var(--color-light-bg)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Biến thể & tồn kho hiện có</p>
                    <button type="button" onClick={() => { setAddInvProductId(editingProduct._id); setIsAddInventoryOpen(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                      <Plus size={13} /> Nhập thêm hàng
                    </button>
                  </div>
                  {editInvSummary.length === 0 ? (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(prodSizes || []).map(sz => (<span key={'s' + sz} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', backgroundColor: 'white', fontSize: '11px', fontWeight: 700 }}>{sz}</span>))}
                      {(prodColors || []).map(c => (<span key={'c' + c} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', backgroundColor: 'white', fontSize: '11px', fontWeight: 700 }}>{colorLabels[c] || c}</span>))}
                      {(prodMaterials || []).map(m => (<span key={'m' + m} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', backgroundColor: 'white', fontSize: '11px', fontWeight: 700 }}>{materialLabels[m] || m}</span>))}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--color-light-border)', backgroundColor: 'white' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--color-light-border)', color: 'var(--color-text-secondary)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>SIZE</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>MÀU</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>CHẤT LIỆU</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>TỔNG</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#166534' }}>KHẢ DỤNG</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>THAO TÁC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editInvSummary.map((row: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--color-light-border)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.size}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{colorLabels[row.color] || row.color}</td>
                              <td style={{ padding: '8px 12px' }}>{materialLabels[row.material] || row.material || '—'}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{row.total}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#166534' }}>{row.available}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    disabled={variantBusy}
                                    onClick={() => { setVariantEditRow(row); setVariantEditQty(String(row.total)); }}
                                    style={{ padding: '5px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', backgroundColor: 'white', cursor: variantBusy ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '11px', color: 'var(--color-primary)', opacity: variantBusy ? 0.5 : 1 }}
                                  >
                                    Sửa số lượng
                                  </button>
                                  <button
                                    type="button"
                                    disabled={variantBusy}
                                    onClick={() => handleRemoveVariant(row)}
                                    style={{ padding: '5px 10px', border: '1px solid #FECACA', borderRadius: '4px', backgroundColor: '#FEF2F2', cursor: variantBusy ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '11px', color: '#DC2626', opacity: variantBusy ? 0.5 : 1 }}
                                  >
                                    Xoá
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    Nhập thêm hàng và sửa/xoá biến thể là thao tác trên KHO — có hiệu lực ngay, không chờ bấm "Lưu thay đổi". Nhập nhầm thì bấm Xoá ngay tại dòng đó.
                    Trạng thái giặt / bảo trì / thanh lý của từng chiếc quản lý ở tab Tồn kho.
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>Mỗi dòng là một biến thể (khác màu / chất liệu / số lượng). Kho sẽ tự sinh theo số lượng.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 0.7fr 1.2fr 30px', gap: '8px', fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', padding: '0 2px 6px' }}>
                    <span>Size</span><span>Màu</span><span>Chất liệu</span><span>SL</span><span>Tình trạng</span><span></span>
                  </div>
                  {variants.map((v, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 0.7fr 1.2fr 30px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <select value={v.size} onChange={e => updateVariantRow(idx, 'size', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-light-border)', fontSize: '13px', outline: 'none', backgroundColor: 'white', width: '100%' }}>
                        {sizesOptions.map(sz => (<option key={sz} value={sz}>{sz}</option>))}
                      </select>
                      <select value={v.color} onChange={e => updateVariantRow(idx, 'color', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-light-border)', fontSize: '13px', outline: 'none', backgroundColor: 'white', width: '100%' }}>
                        {colorsOptions.map(c => (<option key={c} value={c}>{colorLabels[c] || c}</option>))}
                      </select>
                      <select value={v.material} onChange={e => updateVariantRow(idx, 'material', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-light-border)', fontSize: '13px', outline: 'none', backgroundColor: 'white', width: '100%' }}>
                        {materialsOptions.map(m => (<option key={m} value={m}>{materialLabels[m] || m}</option>))}
                      </select>
                      <input type="number" min={1} value={v.quantity} onChange={e => updateVariantRow(idx, 'quantity', Math.max(1, Number(e.target.value) || 1))} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-light-border)', fontSize: '13px', outline: 'none', backgroundColor: 'white', width: '100%' }} />
                      <select value={v.condition} onChange={e => updateVariantRow(idx, 'condition', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-light-border)', fontSize: '13px', outline: 'none', backgroundColor: 'white', width: '100%' }}>
                        {conditionOptions.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                      <button type="button" onClick={() => removeVariantRow(idx)} title="Xóa dòng" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <button type="button" onClick={addVariantRow} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px dashed var(--color-primary)', background: 'white', color: 'var(--color-primary)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      <Plus size={14} /> Thêm dòng biến thể
                    </button>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Tổng kho: {variants.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} chiếc · {variants.length} biến thể</span>
                  </div>
                </div>
              )}

              {/* Ảnh theo màu — mỗi màu khác nhau một ô, không phụ thuộc size nên không phải tải lặp */}
              {colorsNeedingImages().length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'var(--color-light-bg)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>ẢNH THEO MÀU</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Khách đổi màu ở trang sản phẩm thì ảnh đổi theo. Màu nào bỏ trống sẽ dùng ảnh chung ở bước 1.
                    </p>
                  </div>

                  {colorsNeedingImages().map(color => {
                    const shots = prodColorImages[color] || [];
                    const busy = uploadingColor === color;
                    return (
                      <div key={`ci-${color}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-light-border)', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 700 }}>
                            <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1px solid var(--color-light-border)', backgroundColor: colorSwatches[color] || '#D4D4D8' }} />
                            {colorLabels[color] || color}
                            {shots.length === 0 && (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#B45309' }}>— chưa có ảnh riêng</span>
                            )}
                          </span>
                          <label style={{ padding: '6px 12px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'white', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                            {busy ? 'Đang tải...' : '+ Thêm ảnh'}
                            <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={e => handleColorImageChange(color, e)} />
                          </label>
                        </div>

                        {shots.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {shots.map((url, idx) => (
                              <div key={`${color}-${url}-${idx}`} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-light-border)' }}>
                                <img src={getImageUrl(url)} alt={`${color} ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button
                                  type="button"
                                  onClick={() => removeColorImage(color, idx)}
                                  style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', border: 'none', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', lineHeight: 1, cursor: 'pointer' }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {wizardStep === 3 && (
            <>
              <SmartTagEditor
                productId={editingProduct?._id ?? createdDraftId ?? undefined}
                initialDecisionVersion={editingProduct?.taggingDecisionVersion}
                onActiveTagsChange={setActiveTagCodes}
              />
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                {editingProduct
                  ? 'Trường phái & dịp lễ của sản phẩm được suy tự động từ các thẻ đã chọn.'
                  : 'Bấm "Tạo gợi ý", chọn thẻ phù hợp (cần ít nhất 1 thẻ). Trường phái & dịp lễ sẽ được suy tự động từ thẻ.'}
              </p>
            </>
          )}

          {/* Dieu huong wizard */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--color-light-border)', paddingTop: '16px' }}>
            <button type="button" onClick={handleWizardCancel} style={{ padding: '10px 20px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', cursor: 'pointer' }}>
              Hủy
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              {editingProduct ? (
                // Edit: nhảy tab tự do, nút Lưu luôn hiện — sửa nhanh giá/mô tả không phải đi hết 3 bước
                <button type="button" onClick={handleWizardFinish} style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
                  Lưu thay đổi
                </button>
              ) : (
                <>
                  {wizardStep > 1 && (
                    <button type="button" onClick={handleWizardBack} style={{ padding: '10px 20px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', cursor: 'pointer' }}>
                      Quay lại
                    </button>
                  )}
                  {wizardStep < 3 && (
                    <button type="button" onClick={handleWizardNext} disabled={savingDraft} style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: savingDraft ? 'not-allowed' : 'pointer', opacity: savingDraft ? 0.7 : 1, boxShadow: 'var(--shadow-sm)' }}>
                      {savingDraft ? 'Đang lưu...' : (wizardStep === 2 ? 'Lưu & tạo thẻ' : 'Tiếp tục')}
                    </button>
                  )}
                  {wizardStep === 3 && (
                    <button type="button" onClick={handleWizardFinish} disabled={activeTagCodes.length < 1} style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: activeTagCodes.length < 1 ? 'not-allowed' : 'pointer', opacity: activeTagCodes.length < 1 ? 0.6 : 1, boxShadow: 'var(--shadow-sm)' }}>
                      Đăng áo dài
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
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

              {/* Pickup Damage Report Warning */}
              {reportingOrder.pickupDamageReport && (
                <div style={{
                  backgroundColor: '#FEF9E7',
                  border: '1px solid #F5CBA7',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#7E5109',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <AlertTriangle size={15} style={{ color: '#D35400' }} />
                    <span>Chú ý: Khách hàng đã báo lỗi khi nhận đồ!</span>
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    <strong>Mô tả của khách:</strong> {reportingOrder.pickupDamageReport.description}
                  </div>
                  {reportingOrder.pickupDamageReport.evidencePhotos && reportingOrder.pickupDamageReport.evidencePhotos.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {reportingOrder.pickupDamageReport.evidencePhotos.map((photo: string, index: number) => (
                        <a key={index} href={photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`} target="_blank" rel="noreferrer" style={{ width: '45px', height: '45px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #F5CBA7' }}>
                          <img src={photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </a>
                      ))}
                    </div>
                  )}
                  <strong style={{ fontSize: '11px', color: '#C0392B', marginTop: '4px' }}>
                    * Vui lòng đối soát kỹ và không phạt tiền đối với các vết bẩn/hỏng hóc khách hàng đã khai báo ở trên.
                  </strong>
                </div>
              )}

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>ẢNH CHỤP BẰNG CHỨNG HỎNG HÓC *</span>

                <label htmlFor="incident-photo-file" style={{
                  border: '2px dashed #D1D5DB',
                  borderRadius: '12px',
                  backgroundColor: '#F9FAFB',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  gap: '8px',
                  transition: 'all 0.2s ease-in-out'
                }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary-dark)';
                    e.currentTarget.style.backgroundColor = '#FFFDF9';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#D1D5DB';
                    e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8C827A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#4B5563' }}>Tải ảnh bằng chứng lên</span>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Chọn một hoặc nhiều hình ảnh vết bẩn, rách</span>
                  <input
                    id="incident-photo-file"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleIncidentPhotoUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                {incidentPhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', padding: '8px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
                    {incidentPhotos.map((photo, index) => {
                      const url = photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`;
                      return (
                        <div key={index} style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #D1D5DB' }}>
                          <PrivateEvidenceImage
                            reference={photo}
                            legacyUrl={url}
                            alt="Incident preview"
                            linkStyle={{ display: 'block', width: '100%', height: '100%' }}
                            imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            onClick={() => setIncidentPhotos(prev => prev.filter((_, i) => i !== index))}
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              border: 'none',
                              fontSize: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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

      <PortfolioItemFormModal
        isOpen={isPortfolioFormOpen}
        isSaving={isPortfolioSaving}
        onClose={() => {
          setIsPortfolioFormOpen(false);
          setEditingPortfolioItem(null);
        }}
        onSubmit={handlePortfolioFormSubmit}
        initialValues={editingPortfolioItem ? { title: editingPortfolioItem.title, description: editingPortfolioItem.description || undefined, images: editingPortfolioItem.images } : null}
      />

      {previewPortfolioItem && (
        <div
          onClick={() => setPreviewPortfolioItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setPreviewPortfolioItem(null)}
            style={{
              position: 'absolute',
              right: '24px',
              top: '24px',
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              fontSize: '20px',
              zIndex: 10002,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
          >
            ✕
          </button>

          {/* Navigation Buttons for multiple images */}
          {previewPortfolioItem.images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewImageIndex(prev => (prev === 0 ? previewPortfolioItem.images.length - 1 : prev - 1));
                }}
                style={{
                  position: 'absolute',
                  left: '24px',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '24px',
                  zIndex: 10002,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewImageIndex(prev => (prev === previewPortfolioItem.images.length - 1 ? 0 : prev + 1));
                }}
                style={{
                  position: 'absolute',
                  right: '24px',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '24px',
                  zIndex: 10002,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
              >
                ›
              </button>
            </>
          )}

          {/* Image & Description Box */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              maxWidth: '90%',
              maxHeight: '90%',
              cursor: 'default',
            }}
          >
            <img
              src={previewPortfolioItem.images[previewImageIndex].startsWith('http')
                ? previewPortfolioItem.images[previewImageIndex]
                : getImageUrl(previewPortfolioItem.images[previewImageIndex])}
              alt={previewPortfolioItem.title}
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            />

            {/* Caption */}
            <div style={{ textAlign: 'center', color: 'white' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700 }}>
                {previewPortfolioItem.title}
                {previewPortfolioItem.images.length > 1 && ` (${previewImageIndex + 1}/${previewPortfolioItem.images.length})`}
              </h4>
              {previewPortfolioItem.description && (
                <p style={{ margin: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.8)', maxWidth: '600px', lineHeight: 1.5 }}>
                  {previewPortfolioItem.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      <BookingDetailModal
        bookingId={selectedBookingId}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onCustomerClick={viewCustomerTrust}
        viewerRole="provider"
        onBookingChanged={fetchOrders}
      />

      {/* Modal Nhập Kho Áo Dài */}
      {isAddInventoryOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <form onSubmit={handleCreateInventoryItem} style={{ width: '100%', maxWidth: '480px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>NHẬP THÊM HÀNG VÀO KHO</h4>
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
                  {editingProduct && !myProductsList.some((prod: any) => prod._id === editingProduct._id) && (
                    <option value={editingProduct._id}>{editingProduct.name}</option>
                  )}
                  {myProductsList.map((prod: any) => (
                    <option key={prod._id} value={prod._id}>{prod.name}</option>
                  ))}
                </select>
              </div>

              {/* Kích cỡ & Màu sắc — chọn nhanh bằng nút, không dùng dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>KÍCH CỠ (SIZE) *</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {sizesOptions.map(sz => {
                    const isSelected = addInvSize === sz;
                    return (
                      <button key={sz} type="button" onClick={() => setAddInvSize(sz)} style={{ padding: '7px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)', backgroundColor: isSelected ? 'var(--color-primary-trans)' : 'white', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÀU SẮC *</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {colorsOptions.map(c => {
                    const isSelected = addInvColor === c;
                    return (
                      <button key={c} type="button" onClick={() => setAddInvColor(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)', backgroundColor: isSelected ? 'var(--color-primary-trans)' : 'white', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: colorSwatches[c] || '#ccc', border: '1px solid rgba(0,0,0,0.15)', display: 'inline-block' }} />
                        {colorLabels[c] || c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chất liệu (đồng bộ với biến thể sản phẩm) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHẤT LIỆU *</label>
                <select
                  value={addInvMaterial}
                  onChange={(e) => setAddInvMaterial(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px', backgroundColor: 'white' }}
                  required
                >
                  <option value="" disabled>— Chọn chất liệu —</option>
                  {materialsOptions.map(m => (<option key={m} value={m}>{materialLabels[m] || m}</option>))}
                </select>
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
                  {/* Cố ý bỏ "Thanh lý" ở đây — thanh lý phải đi qua nút Thanh lý để được kiểm tra lịch thuê */}
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

      {/* MODAL: SỬA SỐ LƯỢNG CỦA CẢ MỘT BIẾN THỂ */}
      {variantEditRow && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <form onSubmit={handleAdjustVariantQuantity} style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '440px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-light-border)' }}>
              <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>SỬA SỐ LƯỢNG BIẾN THỂ</h4>
              <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                {variantEditRow.productName} — <b>{variantLabelOf(variantEditRow)}</b>
              </p>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-light-bg)', border: '1px solid var(--color-light-border)', borderRadius: '8px', padding: '12px 16px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Hiện có trong kho</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>{variantEditRow.total} chiếc</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>ĐỔI THÀNH *</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={variantEditQty}
                  onChange={(e) => setVariantEditQty(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '14px', outline: 'none' }}
                  required
                />
                <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Tăng lên thì hệ thống nhập thêm hiện vật mới. Giảm xuống thì thanh lý bớt, ưu tiên hàng hỏng và hàng đang bảo trì — chiếc nào đang có lịch thuê sẽ được giữ lại và báo cho bạn.
                  {' '}Đặt <b>0</b> nghĩa là <b>hết hàng</b>: khách vẫn thấy biến thể này nhưng không đặt được, sau này nhập thêm là bán lại bình thường.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setVariantEditRow(null)}
                  disabled={variantBusy}
                  style={{ padding: '10px 18px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', cursor: variantBusy ? 'not-allowed' : 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={variantBusy}
                  style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: variantBusy ? 'not-allowed' : 'pointer', opacity: variantBusy ? 0.6 : 1 }}
                >
                  {variantBusy ? 'Đang lưu...' : 'Lưu số lượng'}
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
