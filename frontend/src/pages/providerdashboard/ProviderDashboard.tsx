import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Layers, Camera, Plus, Download, Bell,
  HelpCircle, MoreVertical, ChevronLeft, ChevronRight, CheckCircle, FileText, Trash2, Play, Pencil,
  Upload, X, Award, Calendar, Tag, MessageSquare, Users, Save, Flag, Star, ArrowLeft, LogOut, BarChart3
} from 'lucide-react';
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
  const [currentView, setCurrentView] = useState<'orders' | 'collections' | 'profile' | 'portfolio' | 'calendar' | 'vouchers' | 'reviews' | 'trust' | 'analytics'>('analytics');

  // Provider Specific States
  const [provider, setProvider] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [subTab, setSubTab] = useState<'shop' | 'photo'>('shop');

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
      const data = await httpClient.get<Product[]>('/products/my-listings');
      setProducts(data);
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

  useEffect(() => {
    if (currentView === 'orders') {
      fetchOrders();
    } else if (currentView === 'collections') {
      fetchProducts();
      fetchCategories();
    } else if (['profile', 'portfolio', 'calendar', 'vouchers', 'reviews', 'trust', 'analytics'].includes(currentView)) {
      fetchProviderData();
    }
  }, [currentView]);

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}>
      {/* SIDEBAR */}
      <aside style={{ width: '260px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px 24px', flexShrink: 0 }}>
        <div>
          <div style={{ marginBottom: '40px' }}>
            <h1 style={{ fontFamily: 'var(--font-header)', fontSize: '22px', fontWeight: 800, color: 'white', margin: 0 }}>Silk & Stone</h1>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>Rental Marketplace</p>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button onClick={() => setCurrentView('analytics')} style={navItemStyle(currentView === 'analytics')}><BarChart3 size={18} /> Thống kê & Hiệu suất</button>
            <button onClick={() => setCurrentView('orders')} style={navItemStyle(currentView === 'orders')}><ShoppingBag size={18} /> Đơn hàng</button>
            <button onClick={() => setCurrentView('collections')} style={navItemStyle(currentView === 'collections')}><Layers size={18} /> Bộ sưu tập</button>
            <button onClick={() => setCurrentView('profile')} style={navItemStyle(currentView === 'profile')}><Award size={18} /> Thông tin dịch vụ (UC-B06)</button>
            <button onClick={() => setCurrentView('portfolio')} style={navItemStyle(currentView === 'portfolio')}><Camera size={18} /> Quản lý Portfolio (UC-B08)</button>
            <button onClick={() => setCurrentView('calendar')} style={navItemStyle(currentView === 'calendar')}><Calendar size={18} /> Lịch làm việc & Chặn (UC-F01)</button>
            <button onClick={() => setCurrentView('vouchers')} style={navItemStyle(currentView === 'vouchers')}><Tag size={18} /> Mã khuyến mãi (UC-P01)</button>
            <button onClick={() => setCurrentView('reviews')} style={navItemStyle(currentView === 'reviews')}><MessageSquare size={18} /> Đánh giá & Phản hồi (UC-H04/05)</button>
            <button onClick={() => setCurrentView('trust')} style={navItemStyle(currentView === 'trust')}><Users size={18} /> Đánh giá khách hàng (UC-H06)</button>
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
            <button style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', position: 'relative' }}><Bell size={18} /><span style={{ position: 'absolute', top: '0', right: '0', width: '7px', height: '7px', backgroundColor: 'var(--color-primary)', borderRadius: '50%', border: '1px solid white' }} /></button>
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
                              { label: 'Hủy đơn', status: 'ĐÃ HỦY', icon: <Trash2 size={14} />, color: 'var(--color-error)' },
                            ].map(a => (
                              <button key={a.label} onClick={() => changeOrderStatus(o._id, a.status)} style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer', color: a.color,
                                fontWeight: a.label === 'Hủy đơn' ? 700 : 500, textAlign: 'left',
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
              <button onClick={openAddModal} style={{
                display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-primary)',
                padding: '10px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                color: 'white', border: 'none', boxShadow: 'var(--shadow-sm)', transition: 'var(--transition-smooth)',
              }}><Plus size={14} /> Thêm Áo Dài mới</button>
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
            )}
          </main>
        )}

        {currentView === 'profile' && (
          <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Thông tin dịch vụ (UC-B06)</h2>
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
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>CHÍNH SÁCH HỦY DỊCH VỤ / HOÀN CỌC (UC-B06)</label>
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
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Portfolio (UC-B08)</h2>
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
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Lịch làm việc & Chặn (UC-F01)</h2>
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
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý Mã khuyến mãi (UC-P01)</h2>
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
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Đánh giá & Phản hồi (UC-H04/H05/H03)</h2>
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
                                Báo cáo Spam (UC-H03)
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
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Đánh giá khách hàng & Tín nhiệm (UC-H06)</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Đánh giá hai chiều sau khi hoàn thành dịch vụ và tra cứu độ uy tín của khách hàng.</p>
              </div>
            </div>

            {isLoadingProvider ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải dữ liệu...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0, borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>TRA CỨU ĐỘ TÍN NHIỆM KHÁCH HÀNG (UC-B05)</h3>
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

    </div>
  );
};

export default ProviderDashboard;
