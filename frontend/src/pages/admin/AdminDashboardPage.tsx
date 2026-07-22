import React, { useState, useEffect } from 'react';
import { PrivateEvidenceImage } from '../../components/common/PrivateEvidenceImage';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Image as ImageIcon, Calendar, Eye,
  LayoutDashboard, Users, Store, TrendingUp, FileCheck,
  Search, Bell, Ban, Lock, CheckSquare, BarChart3, Tag,
  LogOut, Home, Star, Layers, Settings, DollarSign, ShieldCheck
} from 'lucide-react';
import Swal from 'sweetalert2';
import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { BookingDetailModal } from '../../components/common/BookingDetailModal';
import { API_BASE_URL } from '../../config/env';
import { tokenStorage } from '../../services/tokenStorage';
import { Modal } from '../../components/common/Modal';
import { PhotographyLocationPicker } from '../../features/photographers/components/PhotographyLocationPicker';
import type { LocationSelection } from '../../features/photographers/types/photographer.types';

// Modular Sub-components
import { CategoryManagement } from './components/CategoryManagement';
import { SettlementManagement } from './components/SettlementManagement';
import { PolicyManagement } from './components/PolicyManagement';
import { AccessControl } from './components/AccessControl';
import { ProductModerationManagement } from './components/ProductModerationManagement';
import { PortfolioModerationManagement } from './components/PortfolioModerationManagement';
import { RefundManagement } from './components/RefundManagement';
import { ComboModerationManagement } from './components/ComboModerationManagement';
import { NotificationsPage } from '../notifications/NotificationsPage';

const getImageUrl = (url: string) => {
  if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
};

// --- TYPE INTERFACES ---
interface DisputeItem {
  _id: string;
  bookingId: any;
  bookingItemId: any;
  productId: any;
  reportedBy: any;
  description: string;
  evidencePhotos: string[];
  requestedAmount: number;
  status: string;
  adminNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  isDirectDispute?: boolean;
}

interface VerificationDocumentVersion {
  versionNo?: number;
  fileUrl: string;
  mimeType: string;
  size: number;
  ocrStatus: string;
  ocrConfidence?: number | null;
  extractedFields: Record<string, any>;
  mismatchFlags: string[];
  ocr?: {
    executionStatus?: string;
    assessment?: string | null;
    warningCodes?: string[];
    nextAction?: string | null;
  };
}

interface VerificationDocument {
  documentType: string;
  versions: VerificationDocumentVersion[];
}

interface SelectedVerificationDocument {
  verificationId: string;
  documentType: string;
  versionNo?: number;
  mimeType?: string;
}

const verificationDocumentLabels: Record<string, string> = {
  IDENTITY_CARD_FRONT: 'CCCD Mặt trước',
  IDENTITY_CARD_BACK: 'CCCD Mặt sau',
  PASSPORT: 'Hộ chiếu',
  BUSINESS_LICENSE: 'Giấy phép kinh doanh',
  TAX_REGISTRATION: 'Giấy đăng ký thuế',
  SHOP_PHOTO_PROOF: 'Ảnh cửa hàng',
  STUDIO_PORTFOLIO_PROOF: 'Hồ sơ năng lực (Portfolio)',
  PROFESSIONAL_CERTIFICATE: 'Chứng chỉ hành nghề',
};

const ocrFieldValue = (value: unknown): string | null => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && 'value' in value) {
    const nested = (value as { value?: unknown }).value;
    return typeof nested === 'string' || typeof nested === 'number' ? String(nested) : null;
  }
  return null;
};

const OCR_WARNING_MESSAGES: Record<string, string> = {
  OCR_ID_NUMBER_NOT_FOUND: 'Không tìm thấy số CCCD trên ảnh',
  OWNER_NAME_MISMATCH: 'Tên chủ hồ sơ chưa khớp',
  IDENTITY_NUMBER_MISMATCH_BETWEEN_SIDES: 'Số CCCD hai mặt không khớp',
  OCR_LOW_CONFIDENCE: 'Độ tin cậy nhận dạng thấp',
  OCR_TEXT_EMPTY: 'Không đọc được nội dung trên ảnh',
  IMAGE_TOO_DARK: 'Ảnh quá tối',
  IMAGE_TOO_BRIGHT: 'Ảnh bị chói sáng',
  IMAGE_LOW_CONTRAST: 'Ảnh có độ tương phản thấp',
  OCR_ENGINE_UNAVAILABLE: 'Dịch vụ OCR đang tạm thời không khả dụng',
  OCR_QUEUE_DELIVERY_FAILED: 'Không thể gửi yêu cầu OCR',
};

function getOcrPresentation(version?: VerificationDocumentVersion) {
  const status = version?.ocrStatus ?? 'NOT_STARTED';
  const warningCodes = version?.ocr?.warningCodes?.length
    ? version.ocr.warningCodes
    : version?.mismatchFlags ?? [];
  const messages = warningCodes.map((code) => OCR_WARNING_MESSAGES[code] ?? code);
  const executionStatus = version?.ocr?.executionStatus;
  const isProcessing = executionStatus === 'PROCESSING' || status === 'OCR_PROCESSING';

  if (isProcessing) return { label: 'Đang quét OCR', message: 'Hệ thống đang xử lý tài liệu', allMessages: '', color: '#9A6700', background: '#FFFAEB', borderColor: '#FEC84B', isProcessing, retryLabel: 'Đang quét' };
  if (status === 'OCR_PASSED') return { label: 'Đã xác minh', message: '', allMessages: '', color: '#067647', background: '#ECFDF3', borderColor: '#ABEFC6', isProcessing, retryLabel: 'Quét lại' };
  if (status === 'OCR_LOW_CONFIDENCE') return { label: 'Độ tin cậy thấp', message: messages[0] ?? 'Hãy kiểm tra ảnh trước khi phê duyệt', allMessages: messages.join(' • '), color: '#9A6700', background: '#FFFAEB', borderColor: '#FEC84B', isProcessing, retryLabel: 'Quét lại' };
  if (status === 'MISMATCH_DETECTED') return { label: 'Cần đối chiếu', message: messages[0] ?? 'Thông tin OCR chưa khớp hồ sơ', allMessages: messages.join(' • '), color: '#B42318', background: '#FEF3F2', borderColor: '#FECDCA', isProcessing, retryLabel: 'Quét lại' };
  if (status === 'NEEDS_MANUAL_REVIEW') return { label: 'Cần kiểm tra thủ công', message: messages[0] ?? 'Admin cần đối chiếu tài liệu', allMessages: messages.join(' • '), color: '#6941C6', background: '#F9F5FF', borderColor: '#D9D6FE', isProcessing, retryLabel: 'Quét lại' };
  if (status === 'OCR_FAILED') {
    const completed = executionStatus === 'SUCCEEDED';
    return { label: completed ? 'Cần kiểm tra lại ảnh' : 'OCR không xử lý được', message: messages[0] ?? (completed ? 'Ảnh chưa cung cấp đủ thông tin cần thiết' : 'Có thể thử quét lại tài liệu'), allMessages: messages.join(' • '), color: '#B42318', background: '#FEF3F2', borderColor: '#FECDCA', isProcessing, retryLabel: 'Quét lại' };
  }
  return { label: 'Chưa chạy OCR', message: 'Chưa có kết quả nhận dạng', allMessages: '', color: '#475467', background: '#F2F4F7', borderColor: '#D0D5DD', isProcessing, retryLabel: 'Chạy OCR' };
}
function VerificationDocumentPreview({ document }: { document: SelectedVerificationDocument }) {
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isPdf = document.mimeType === 'application/pdf';

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setSource(null);
    setFailed(false);

    const load = async () => {
      try {
        const versionPath = document.versionNo == null ? '' : `/versions/${document.versionNo}`;
        const token = tokenStorage.getAccessToken();
        const response = await fetch(
          `${API_BASE_URL}/admin/provider-verifications/${document.verificationId}/documents/${document.documentType}${versionPath}/view`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined, signal: controller.signal },
        );
        if (!response.ok) throw new Error('Cannot load provider verification document');
        objectUrl = URL.createObjectURL(await response.blob());
        setSource(objectUrl);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };

    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document]);

  if (failed) return <div style={{ padding: '20px', color: '#991B1B', textAlign: 'center' }}>Không thể tải tài liệu.</div>;
  if (!source) return <div style={{ padding: '20px', color: '#7A7A7A', textAlign: 'center' }}>Đang tải tài liệu…</div>;
  if (isPdf) return <iframe src={source} title="Tài liệu đối chiếu" style={{ width: '100%', height: '360px', border: 0 }} />;
  return <img src={source} alt="Tài liệu đối chiếu" style={{ width: '100%', maxHeight: '480px', objectFit: 'contain', display: 'block' }} />;
}

interface VerificationItem {
  verificationId: string;
  userId: any;
  providerId?: any;
  verificationType: string;
  requestedCapabilities: string[];
  status: string;
  businessProfile: {
    businessName: string;
    ownerName: string;
    phone: string;
    email: string;
    address: string;
    province: string;
    description: string;
  };
  documents: VerificationDocument[];
  createdAt: string;
}

type ProviderChangeReason = {
  value: string;
  label: string;
  instruction: string;
};

const PROVIDER_CHANGE_REASONS: ProviderChangeReason[] = [
  {
    value: 'identity_front',
    label: 'CCCD mặt trước không đạt yêu cầu',
    instruction: 'Vui lòng tải lại CCCD mặt trước rõ nét, đủ 4 góc, không lóa hoặc mờ. Không dùng ảnh chụp màn hình.',
  },
  {
    value: 'identity_back',
    label: 'CCCD mặt sau chưa đạt yêu cầu',
    instruction: 'Vui lòng tải lại CCCD mặt sau rõ nét, đủ 4 góc, không lóa hoặc mờ.',
  },
  {
    value: 'identity_mismatch',
    label: 'Thông tin CCCD cần đối chiếu lại',
    instruction: 'Thông tin trên giấy tờ chưa đối chiếu được. Vui lòng kiểm tra và tải lại ảnh CCCD mặt trước và mặt sau của cùng một giấy tờ, rõ nét và không bị che khuất.',
  },
  {
    value: 'business_profile',
    label: 'Thông tin hồ sơ doanh nghiệp cần bổ sung',
    instruction: 'Vui lòng kiểm tra và cập nhật lại thông tin thương hiệu, chủ sở hữu, số điện thoại hoặc địa chỉ trong hồ sơ.',
  },
  {
    value: 'portfolio',
    label: 'Hồ sơ năng lực/portfolio cần bổ sung',
    instruction: 'Vui lòng bổ sung hoặc tải lại hồ sơ năng lực/portfolio để Admin có đủ thông tin đánh giá.',
  },
  {
    value: 'other',
    label: 'Yêu cầu khác',
    instruction: '',
  },
];

function toProviderChangeRequest(value: string, note?: string) {
  const mappings: Record<string, { target: string; action: string; reasonCode: string }> = {
    identity_front: { target: 'IDENTITY_CARD_FRONT', action: 'REUPLOAD', reasonCode: 'IMAGE_QUALITY' },
    identity_back: { target: 'IDENTITY_CARD_BACK', action: 'REUPLOAD', reasonCode: 'IMAGE_QUALITY' },
    identity_mismatch: { target: 'IDENTITY_CARD_FRONT', action: 'REUPLOAD', reasonCode: 'IDENTITY_MISMATCH' },
    business_profile: { target: 'BUSINESS_PROFILE', action: 'UPDATE_PROFILE', reasonCode: 'PROFILE_INCOMPLETE' },
    portfolio: { target: 'PORTFOLIO', action: 'PROVIDE_MORE_INFO', reasonCode: 'PORTFOLIO_INSUFFICIENT' },
    other: { target: 'OTHER', action: 'PROVIDE_MORE_INFO', reasonCode: 'OTHER' },
  };
  const request = mappings[value] ?? mappings.other;
  return { ...request, note: note || undefined };
}
function preferredProviderChangeReason(detail: any): string {
  const documents = Array.isArray(detail?.documents) ? detail.documents : [];
  const currentVersion = (document: any) =>
    document?.current ?? document?.versions?.find((version: any) => version?.isCurrent) ?? document?.versions?.[0];
  const front = currentVersion(documents.find((document: any) => document.documentType === 'IDENTITY_CARD_FRONT'));
  const back = currentVersion(documents.find((document: any) => document.documentType === 'IDENTITY_CARD_BACK'));
  if (front?.ocrStatus === 'OCR_FAILED' || (front?.mismatchFlags?.length ?? 0) > 0) return 'identity_front';
  if (back?.ocrStatus === 'OCR_FAILED' || back?.ocrStatus === 'NOT_STARTED') return 'identity_back';
  return 'business_profile';
}
export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [chartTimeRange, setChartTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [lineChartTimeRange, setLineChartTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [hoveredGroup, setHoveredGroup] = useState<any>(null);

  const [isNotiOpen, setIsNotiOpen] = useState<boolean>(false);
  const notiRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setIsNotiOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);



  // Lists & Stats States - initialized as empty to pull 100% real data
  const [statsData, setStatsData] = useState<any>(null);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [rentalMigrationReport, setRentalMigrationReport] = useState<any>(null);
  const [rentalMigrationReviewItems, setRentalMigrationReviewItems] = useState<any[]>([]);
  const [loadingRentalMigration, setLoadingRentalMigration] = useState(false);
  const [migrationLocationItem, setMigrationLocationItem] = useState<any>(null);
  const [migrationLocation, setMigrationLocation] = useState<LocationSelection | null>(null);
  const [resolvingRentalMigrationItem, setResolvingRentalMigrationItem] = useState<string | null>(null);

  // Reported Reviews states
  const [reportedReviews, setReportedReviews] = useState<any[]>([]);
  const [loadingReportedReviews, setLoadingReportedReviews] = useState<boolean>(false);

  const getAdminNotifications = () => {
    const list: Array<{ id: string; title: string; desc: string; type: string; tab: string; date?: string }> = [];

    // 1. Verifications pending
    verifications.forEach((v) => {
      if (v.status === 'PENDING' || v.status === 'NEEDS_CHANGES') {
        list.push({
          id: `verify-${v.verificationId}`,
          title: 'Hồ sơ đối tác chờ duyệt',
          desc: `Doanh nghiệp "${v.businessProfile?.businessName || 'Chưa rõ'}" đăng ký dịch vụ ${v.requestedCapabilities?.join(', ') || ''}`,
          type: 'verification',
          tab: 'verifications',
          date: v.createdAt
        });
      }
    });

    // 2. Disputes pending
    disputes.forEach((d) => {
      if (d.status === 'DISPUTED' || d.status === 'PENDING') {
        list.push({
          id: `dispute-${d._id}`,
          title: 'Yêu cầu giải quyết tranh chấp',
          desc: `Đơn hàng #${d.bookingId?.bookingCode || 'N/A'}: ${d.description}`,
          type: 'dispute',
          tab: 'disputes',
          date: d.createdAt
        });
      }
    });

    // 3. Reported reviews pending
    reportedReviews.forEach((r) => {
      list.push({
        id: `review-${r._id}`,
        title: 'Báo cáo vi phạm đánh giá',
        desc: `Đánh giá của "${r.userId?.profile?.fullName || 'Khách hàng'}" bị báo cáo: "${r.content || ''}"`,
        type: 'reported-review',
        tab: 'reported-reviews',
        date: r.createdAt
      });
    });

    // Sort by date descending
    return list.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  };

  const adminNotificationsList = getAdminNotifications();
  const unreadCount = adminNotificationsList.length;

  const fetchReportedReviews = async () => {
    setLoadingReportedReviews(true);
    try {
      const data = await httpClient.get<any[]>('/reviews/admin/reported');
      setReportedReviews(data || []);
    } catch (err: any) {
      console.warn('Lỗi gọi API Reported Reviews:', err);
      toast.error('Không thể tải danh sách báo cáo vi phạm');
    } finally {
      setLoadingReportedReviews(false);
    }
  };

  const handleReviewReportAction = async (reviewId: string, action: 'DELETE' | 'DISMISS') => {
    const actionText = action === 'DELETE' ? 'Gỡ bỏ đánh giá (Vi phạm)' : 'Bác bỏ báo cáo (Giữ lại)';
    const confirmButtonColor = action === 'DELETE' ? '#DC2626' : '#2563EB';

    const { value: reason, isConfirmed } = await Swal.fire({
      title: `Xác nhận: ${actionText}`,
      input: 'textarea',
      inputLabel: 'Nhập lý do để gửi thông báo nguyên nhân cho khách hàng & đối tác:',
      inputPlaceholder: 'Ví dụ: Đánh giá chứa ngôn từ thiếu chuẩn mực / Đánh giá phản ánh đúng trải nghiệm của khách hàng...',
      inputAttributes: {
        'aria-label': 'Nhập lý do chi tiết'
      },
      showCancelButton: true,
      confirmButtonText: 'Xác nhận phán quyết',
      cancelButtonText: 'Hủy bỏ',
      confirmButtonColor,
      background: 'white',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Vui lòng nhập lý do xử lý cụ thể!';
        }
        return null;
      }
    });

    if (isConfirmed && reason) {
      try {
        await httpClient.post(`/reviews/${reviewId}/handle-report`, {
          action,
          reason: reason.trim()
        });
        toast.success('Xử lý báo cáo đánh giá vi phạm thành công!');
        fetchReportedReviews();
      } catch (err: any) {
        toast.error(`Xử lý thất bại: ${err.message || 'Không xác định'}`);
      }
    }
  };

  // Pagination states for different tabs
  const [customerPage, setCustomerPage] = useState(1);
  const [customerTotalPages, setCustomerTotalPages] = useState(1);

  const [providerPage, setProviderPage] = useState(1);
  const [providerTotalPages, setProviderTotalPages] = useState(1);

  const [bookingPage, setBookingPage] = useState(1);
  const [bookingTotalPages, setBookingTotalPages] = useState(1);

  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotalPages, setTransactionTotalPages] = useState(1);

  // Filters & Drawer
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);
  const [selectedDocPreview, setSelectedDocPreview] = useState<SelectedVerificationDocument | null>(null);

  const [loading, setLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [splitRefundAmount, setSplitRefundAmount] = useState(0);
  const [splitCompensationAmount, setSplitCompensationAmount] = useState(0);

  // Check role: must be Admin
  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('admin');

  // --- API CALLS ---
  const fetchStats = async () => {
    try {
      const data = await httpClient.get<any>('/admin/stats');
      setStatsData(data);
    } catch (err: any) {
      console.warn('Lỗi gọi API Stats:', err);
    }
  };

  const fetchDisputes = async () => {
    try {
      const data = await httpClient.get<DisputeItem[]>('/api/disputes/admin/disputed');
      setDisputes(data || []);
    } catch (err: any) {
      console.warn('Lỗi gọi API Disputes:', err);
    }
  };

  const fetchVerifications = async () => {
    try {
      const res = await httpClient.get<any>('/admin/provider-verifications');
      const items = Array.isArray(res) ? res : res.items || [];
      setVerifications(items.map((item: any) => ({
        ...item,
        verificationId: item.verificationId || item._id,
        businessProfile: item.businessProfile || {
          businessName: item.businessName || '',
          ownerName: '',
          phone: '',
          email: '',
          address: '',
          province: '',
          description: '',
        },
        documents: item.documents || [],
      })));
    } catch (err: any) {
      console.warn('Lỗi gọi API Verifications:', err);
    }
  };

  const fetchCustomers = async (page = 1) => {
    try {
      const res = await httpClient.get<any>(`/admin/stats/customers?page=${page}&limit=10`);
      setCustomers(res.items || []);
      setCustomerPage(res.page || 1);
      setCustomerTotalPages(res.totalPages || 1);
    } catch (err) {
      console.warn('Lỗi tải danh sách khách hàng:', err);
    }
  };

  const fetchProviders = async (page = 1) => {
    try {
      const res = await httpClient.get<any>(`/admin/stats/providers?page=${page}&limit=10`);
      setProviders(res.items || []);
      setProviderPage(res.page || 1);
      setProviderTotalPages(res.totalPages || 1);
    } catch (err) {
      console.warn('Lỗi tải danh sách đối tác:', err);
    }
  };

  const fetchBookings = async (page = 1) => {
    try {
      const res = await httpClient.get<any>(`/admin/stats/bookings?page=${page}&limit=10`);
      setBookings(res.items || []);
      setBookingPage(res.page || 1);
      setBookingTotalPages(res.totalPages || 1);
    } catch (err) {
      console.warn('Lỗi tải danh sách đặt lịch:', err);
    }
  };

  const fetchRentalMigrationReview = async () => {
    setLoadingRentalMigration(true);
    try {
      const [report, review] = await Promise.all([
        httpClient.get<any>('/admin/rental-migration/report'),
        httpClient.get<any>('/admin/rental-migration/review?limit=20'),
      ]);
      setRentalMigrationReport(report);
      setRentalMigrationReviewItems(Array.isArray(review?.items) ? review.items : []);
    } catch (error) {
      console.warn('Không thể tải báo cáo migration áo dài:', error);
    } finally {
      setLoadingRentalMigration(false);
    }
  };
  const resolveLegacyLocation = async () => {
    if (!migrationLocationItem || !migrationLocation) {
      toast.error('Hãy xác nhận địa chỉ và pin vị trí thực tế trước khi lưu.');
      return;
    }
    setResolvingRentalMigrationItem(migrationLocationItem._id);
    try {
      await httpClient.post(`/admin/rental-migration/review/${migrationLocationItem._id}/resolve-pickup-return-location`, migrationLocation);
      toast.success('Đã bổ sung snapshot điểm nhận/trả và migrate item áo dài.');
      setMigrationLocationItem(null);
      setMigrationLocation(null);
      await fetchRentalMigrationReview();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể hoàn tất migration cho item này.');
    } finally {
      setResolvingRentalMigrationItem(null);
    }
  };

  const keepLegacyReadOnly = async (item: any) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Giữ dữ liệu legacy chỉ-đọc?',
      text: 'Thao tác này không tạo snapshot hoặc evidence giả. Item sẽ chỉ dùng để tra cứu lịch sử và không đi tiếp vào luồng thuê mới.',
      showCancelButton: true,
      confirmButtonText: 'Giữ chỉ-đọc',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#B45309',
    });
    if (!result.isConfirmed) return;

    setResolvingRentalMigrationItem(item._id);
    try {
      await httpClient.post(`/admin/rental-migration/review/${item._id}/keep-legacy-read-only`);
      toast.success('Đã chuyển item sang legacy read-only.');
      await fetchRentalMigrationReview();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật item legacy.');
    } finally {
      setResolvingRentalMigrationItem(null);
    }
  };
  const fetchTransactions = async (page = 1) => {
    try {
      const res = await httpClient.get<any>(`/admin/stats/transactions?page=${page}&limit=10`);
      setTransactions(res.items || []);
      setTransactionPage(res.page || 1);
      setTransactionTotalPages(res.totalPages || 1);
    } catch (err) {
      console.warn('Lỗi tải danh sách giao dịch:', err);
    }
  };

  // Run initial fetch on mount
  useEffect(() => {
    if (isAuthenticated) {
      if (!isAdmin) {
        toast.error('Bạn không có quyền truy cập trang quản trị!');
        navigate('/');
      } else {
        setLoading(true);
        Promise.all([
          fetchStats(),
          fetchDisputes(),
          fetchVerifications(),
          fetchReportedReviews()
        ]).finally(() => setLoading(false));
      }
    }
  }, [isAuthenticated, isAdmin]);

  // Reactive pagination updates
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchCustomers(customerPage);
    }
  }, [customerPage, isAuthenticated, isAdmin]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchProviders(providerPage);
    }
  }, [providerPage, isAuthenticated, isAdmin]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchBookings(bookingPage);
    }
  }, [bookingPage, isAuthenticated, isAdmin]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchTransactions(transactionPage);
    }
  }, [transactionPage, isAuthenticated, isAdmin]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && activeTab === 'bookings') void fetchRentalMigrationReview();
  }, [activeTab, isAuthenticated, isAdmin]);
  // Reset drawer and reset page counters when tab changes
  useEffect(() => {
    setSelectedDetailItem(null);
    setSelectedDocPreview(null);
    setSearchQuery('');
    setFilterStatus('ALL');
  }, [activeTab]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && activeTab === 'reported-reviews') {
      fetchReportedReviews();
    }
  }, [activeTab, isAuthenticated, isAdmin]);

  // --- ACTIONS HANDLERS ---
  const handleResolveDispute = async (decision: 'SHOP_RIGHT' | 'CUSTOMER_RIGHT' | 'SPLIT') => {
    if (!selectedDetailItem) return;
    if (!adminNotes.trim()) {
      toast.error('Vui lòng nhập ghi chú phán quyết của Admin!');
      return;
    }

    const depositTotal = selectedDetailItem.bookingId?.pricingSummary?.depositTotal || 0;
    if (
      decision === 'SPLIT' &&
      (splitRefundAmount < 0 ||
        splitCompensationAmount < 0 ||
        splitRefundAmount + splitCompensationAmount > depositTotal)
    ) {
      toast.error('Tổng tiền hoàn khách và bồi thường Shop không được vượt quá tiền cọc.');
      return;
    }

    const decisionText = decision === 'SHOP_RIGHT'
      ? 'Phán quyết Đối tác (Shop) đúng'
      : decision === 'CUSTOMER_RIGHT'
        ? 'Phán quyết Khách hàng đúng'
        : 'Phân chia tiền cọc cho hai bên';

    const explanation = decision === 'SHOP_RIGHT'
      ? `Hệ thống sẽ chuyển ${(selectedDetailItem.requestedAmount || 0).toLocaleString()}đ tiền đền bù sang tài khoản ngân hàng của Shop, phần cọc còn lại (nếu có) hoàn cho Khách.`
      : decision === 'CUSTOMER_RIGHT'
        ? `Hệ thống sẽ hoàn trả lại 100% tiền cọc (${depositTotal.toLocaleString()}đ) cho Khách hàng. Shop không nhận được đền bù.`
        : `Hoàn khách ${splitRefundAmount.toLocaleString()}đ và bồi thường Shop ${splitCompensationAmount.toLocaleString()}đ.`;

    const result = await Swal.fire({
      title: 'Xác nhận phán quyết?',
      html: `<div style="text-align: left; font-size: 14px; font-family: inherit;">
        <p><strong>Quyết định:</strong> <span style="color: #4A0E17; font-weight: 700;">${decisionText}</span></p>
        <p>${explanation}</p>
        <p>Thao tác chuyển tiền/hoàn cọc ngân hàng sẽ được thực thi trực tiếp.</p>
      </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4A0E17',
      cancelButtonColor: '#7A7A7A',
      confirmButtonText: 'Xác nhận thi hành',
      cancelButtonText: 'Quay lại',
      background: 'white',
    });

    if (result.isConfirmed) {
      setResolving(true);
      try {
        const bookingId = selectedDetailItem.bookingId?._id || selectedDetailItem.bookingId;
        await httpClient.post(`/api/disputes/admin/resolve/${bookingId}`, {
          decision,
          notes: adminNotes.trim(),
          ...(decision === 'SPLIT' && {
            refundAmount: splitRefundAmount,
            compensationAmount: splitCompensationAmount,
          }),
        });
        toast.success('Phán quyết tranh chấp thành công!');
        setAdminNotes('');
        setSplitRefundAmount(0);
        setSplitCompensationAmount(0);
        setSelectedDetailItem(null);
        fetchDisputes();
      } catch (err: any) {
        toast.error(err.message || 'Giải quyết tranh chấp thất bại');
      } finally {
        setResolving(false);
      }
    }
  };

  const handleStartReview = async (id: string) => {
    if (!id) {
      toast.error('Không xác định được mã hồ sơ cần đánh giá. Vui lòng tải lại danh sách.');
      return;
    }

    try {
      await httpClient.patch(`/admin/provider-verifications/${id}/start-review`, {});
      toast.success('Đã bắt đầu đánh giá hồ sơ');
      fetchVerifications();
      setVerifications(prev => prev.map(v => v.verificationId === id ? { ...v, status: 'UNDER_REVIEW' } : v));
      setSelectedDetailItem((prev: any) => prev ? { ...prev, status: 'UNDER_REVIEW' } : null);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi bắt đầu đánh giá');
    }
  };

  const handleVerificationDecision = async (id: string, decision: 'approve' | 'reject' | 'request-changes') => {
    if (!id) {
      toast.error('Không xác định được mã hồ sơ cần xử lý. Vui lòng tải lại danh sách.');
      return;
    }

    let payload: {
      reason?: string;
      note?: string;
      changeRequests?: Array<{ target: string; action: string; reasonCode: string; note?: string }>;
    } | null = null;

    if (decision === 'request-changes') {
      const defaultReason = preferredProviderChangeReason(selectedDetailItem);
      const options = PROVIDER_CHANGE_REASONS
        .map((reason) => `<option value="${reason.value}" ${reason.value === defaultReason ? 'selected' : ''}>${reason.label}</option>`)
        .join('');
      const result = await Swal.fire({
        title: 'Yêu cầu chỉnh sửa hồ sơ',
        html: `
          <div style="text-align:left">
            <label for="provider-change-reason" style="display:block;margin-bottom:6px;font-weight:700">Hạng mục cần chỉnh sửa *</label>
            <select id="provider-change-reason" class="swal2-select" multiple size="5" style="display:block;width:100%;margin:0">${options}</select>
            <label for="provider-change-note" style="display:block;margin:14px 0 6px;font-weight:700">Ghi chú cho đối tác</label>
            <textarea id="provider-change-note" class="swal2-textarea" style="display:block;width:100%;margin:0;min-height:96px" placeholder="Nêu rõ phần cần sửa nếu cần..."></textarea>
          </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#B89047',
        confirmButtonText: 'Gửi yêu cầu chỉnh sửa',
        cancelButtonText: 'Quay lại',
        preConfirm: () => {
          const select = document.getElementById('provider-change-reason') as HTMLSelectElement | null;
          const selectedValues = Array.from(select?.selectedOptions ?? []).map((option) => option.value);
          const extraNote = (document.getElementById('provider-change-note') as HTMLTextAreaElement | null)?.value.trim() ?? '';
          const selected = PROVIDER_CHANGE_REASONS.filter((reason) => selectedValues.includes(reason.value));
          if (!selected.length || (selected.some((reason) => reason.value === 'other') && !extraNote)) {
            Swal.showValidationMessage(selected.length ? 'Vui lòng mô tả yêu cầu khác.' : 'Vui lòng chọn ít nhất một hạng mục.');
            return false;
          }
          return {
            message: selected.map((reason) => reason.instruction || extraNote).filter(Boolean).join('\n\n'),
            selectedValues,
            extraNote,
          };
        },
      });
      if (!result.isConfirmed || !result.value) return;
      payload = {
        reason: result.value.message,
        note: result.value.message,
        changeRequests: result.value.selectedValues.map((value: string) => toProviderChangeRequest(value, result.value.extraNote)),
      };
    } else if (decision === 'approve') {
      const result = await Swal.fire({
        title: 'Phê duyệt hồ sơ đối tác?',
        text: 'Hệ thống sẽ cấp quyền đối tác và tự gửi thông báo phê duyệt.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#706E3B',
        confirmButtonText: 'Phê duyệt hồ sơ',
        cancelButtonText: 'Quay lại',
      });
      if (!result.isConfirmed) return;
      payload = {};
    } else {
      const result = await Swal.fire({
        title: 'Từ chối hồ sơ đối tác?',
        input: 'textarea',
        inputLabel: 'Lý do từ chối gửi cho đối tác *',
        inputPlaceholder: 'Nêu rõ lý do để đối tác có thể hiểu kết quả xét duyệt...',
        inputValidator: (value) => value.trim() ? undefined : 'Vui lòng nhập lý do từ chối.',
        showCancelButton: true,
        confirmButtonColor: '#4A0E17',
        confirmButtonText: 'Từ chối hồ sơ',
        cancelButtonText: 'Quay lại',
      });
      const note = typeof result.value === 'string' ? result.value.trim() : '';
      if (!result.isConfirmed || !note) return;
      payload = { reason: note, note };
    }

    try {
      const endpoint = decision === 'request-changes'
        ? `/admin/provider-verifications/${id}/request-changes`
        : `/admin/provider-verifications/${id}/${decision}`;
      await httpClient.patch(endpoint, payload);
      toast.success('Đã ghi nhận và gửi phản hồi thành công!');
      fetchVerifications();
      setSelectedDetailItem(null);
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật trạng thái hồ sơ');
    }
  };
  const openVerificationDetail = async (item: VerificationItem) => {
    const verificationId = item.verificationId || (item as any)._id;
    if (!verificationId) {
      toast.error('Hồ sơ không có mã định danh hợp lệ. Vui lòng tải lại danh sách.');
      return;
    }

    try {
      const detail = await httpClient.get<any>(`/admin/provider-verifications/${verificationId}`);
      const verification = { ...detail, verificationId, type: 'VERIFICATION' };
      setSelectedDetailItem(verification);
      const firstDocument = verification.documents?.[0];
      const firstVersion = firstDocument?.current ?? firstDocument?.versions?.find((version: any) => version.isCurrent) ?? firstDocument?.versions?.[0];
      setSelectedDocPreview(firstDocument && firstVersion ? {
        verificationId,
        documentType: firstDocument.documentType,
        versionNo: firstVersion.versionNo,
        mimeType: firstVersion.mimeType,
      } : null);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải chi tiết hồ sơ');
    }
  };
  const handleRunVerificationOcr = async (
    verificationId: string,
    documentType: string,
  ) => {
    try {
      await httpClient.post(
        `/provider-verifications/${verificationId}/documents/${documentType}/ocr`,
      );
      toast.success('Đã chạy OCR cho tài liệu.');
      await openVerificationDetail({ verificationId } as VerificationItem);
    } catch (err: any) {
      toast.error(err.message || 'Không thể chạy OCR cho tài liệu');
    }
  };

  const handleSuspendProvider = async (id: string, isSuspend: boolean) => {
    const actionText = isSuspend ? 'đình chỉ hoạt động' : 'kích hoạt lại';
    const endpoint = `/admin/providers/${id}/${isSuspend ? 'suspend' : 'unsuspend'}`;

    const result = await Swal.fire({
      title: `Xác nhận ${actionText} đối tác?`,
      text: isSuspend
        ? 'Sau khi đình chỉ, đối tác sẽ không thể tiếp nhận đơn hàng mới.'
        : 'Sau khi kích hoạt lại, đối tác có thể hoạt động bình thường.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: isSuspend ? '#4A0E17' : '#706E3B',
      confirmButtonText: 'Xác nhận',
      cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
      try {
        const reason = isSuspend ? 'Vi phạm điều khoản sử dụng' : 'Phục hồi tài khoản';
        await httpClient.patch(endpoint, { reason, note: reason });
        toast.success(`Đã ${isSuspend ? 'đình chỉ' : 'kích hoạt lại'} đối tác thành công!`);
        setProviders(prev => prev.map(p => p.id === id ? { ...p, status: isSuspend ? 'SUSPENDED' : 'ACTIVE' } : p));
        if (selectedDetailItem && selectedDetailItem.id === id) {
          setSelectedDetailItem((prev: any) => prev ? { ...prev, status: isSuspend ? 'SUSPENDED' : 'ACTIVE' } : null);
        }
      } catch (err: any) {
        toast.error(err.message || `Lỗi khi ${actionText} đối tác`);
      }
    }
  };

  const handleBanCustomer = async (id: string, isBan: boolean) => {
    const actionText = isBan ? 'Chặn (Ban)' : 'Mở khóa (Unban)';
    const result = await Swal.fire({
      title: `Xác nhận ${actionText} khách hàng này?`,
      text: isBan ? 'Khách hàng này sẽ không thể đăng nhập hoặc đặt lịch nữa.' : 'Khách hàng này sẽ có thể sử dụng lại hệ thống bình thường.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: isBan ? '#4A0E17' : '#706E3B',
      confirmButtonText: 'Xác nhận',
      cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
      try {
        const endpoint = isBan
          ? `/admin/stats/customers/${id}/ban`
          : `/admin/stats/customers/${id}/unban`;
        await httpClient.patch(endpoint, {});
        toast.success(`Đã ${isBan ? 'khóa' : 'mở khóa'} khách hàng thành công!`);
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: isBan ? 'BANNED' : 'ACTIVE' } : c));
        if (selectedDetailItem && selectedDetailItem.id === id) {
          setSelectedDetailItem((prev: any) => ({ ...prev, status: isBan ? 'BANNED' : 'ACTIVE' }));
        }
      } catch (err: any) {
        toast.error(err.message || `Lỗi khi ${isBan ? 'khóa' : 'mở khóa'} khách hàng`);
      }
    }
  };

  // --- SVG GRAPHICS COMPONENT HELPERS ---
  const renderBarChart = () => {
    const customerGrowth = statsData?.customers?.growth;
    const bookingGrowth = statsData?.bookings?.growth;
    const revenueGrowth = statsData?.revenue?.growth;

    let labels: string[] = [];
    let bookingCounts: number[] = [];
    let customerCounts: number[] = [];
    let revenueCounts: number[] = []; // In Million VND

    if (chartTimeRange === 'month') {
      labels = customerGrowth ? customerGrowth.map((g: any) => g.label) : ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
      bookingCounts = bookingGrowth ? bookingGrowth.map((g: any) => g.value) : [0, 0, 0, 0, 0, 0];
      customerCounts = customerGrowth ? customerGrowth.map((g: any) => g.value) : [0, 0, 0, 0, 0, 0];
      revenueCounts = revenueGrowth ? revenueGrowth.map((g: any) => Math.round(g.value / 1000000)) : [0, 0, 0, 0, 0, 0];
    } else if (chartTimeRange === 'week') {
      labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      const totalBookings = statsData?.bookings?.total || 8;
      const totalCustomers = statsData?.customers?.total || 12;
      const totalRevenue = statsData?.revenue?.total || 5000000;

      bookingCounts = [
        Math.round(totalBookings * 0.1),
        Math.round(totalBookings * 0.15),
        Math.round(totalBookings * 0.2),
        Math.round(totalBookings * 0.25),
        Math.round(totalBookings * 0.15),
        Math.round(totalBookings * 0.15),
        0
      ];
      customerCounts = [
        Math.round(totalCustomers * 0.08),
        Math.round(totalCustomers * 0.16),
        Math.round(totalCustomers * 0.08),
        Math.round(totalCustomers * 0.33),
        Math.round(totalCustomers * 0.25),
        Math.round(totalCustomers * 0.10),
        0
      ];
      revenueCounts = bookingCounts.map(v => Math.round(v * (totalRevenue / (totalBookings || 1)) / 1000000));
    } else {
      labels = ['2026'];
      bookingCounts = [statsData?.bookings?.total || 0];
      customerCounts = [statsData?.customers?.total || 0];
      revenueCounts = [Math.round((statsData?.revenue?.total || 0) / 1000000)];
    }

    const maxVal = Math.max(...bookingCounts, ...customerCounts, ...revenueCounts, 10) || 10;

    const chartHeight = 180;
    const chartWidth = 500;

    // Drawing area bounds (leaving padding for labels at the top)
    const topMargin = 28;
    const bottomMargin = 140;
    const drawHeight = bottomMargin - topMargin;

    const getX = (idx: number) => {
      if (labels.length === 1) return chartWidth / 2;
      return 65 + idx * ((chartWidth - 100) / (labels.length - 1));
    };
    const getY = (val: number) => topMargin + (drawHeight * (1 - val / maxVal));

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Y-axis ticks and horizontal grid lines */}
        {[0, Math.round(maxVal / 4), Math.round(maxVal / 2), Math.round(maxVal * 3 / 4), maxVal].map((val) => {
          const y = getY(val);
          return (
            <g key={`grid-${val}`}>
              <line x1="45" y1={y} x2={chartWidth - 20} y2={y} stroke="#E8E2D5" strokeDasharray="4 4" />
              <text x="15" y={y + 4} fontSize="10" fill="#7A7A7A" fontWeight="600" textAnchor="start">{val}</text>
            </g>
          );
        })}

        {/* Axis vertical line */}
        <line x1="45" y1={topMargin} x2="45" y2={bottomMargin} stroke="#E8E2D5" strokeWidth="1.2" />

        {/* X-axis labels */}
        {labels.map((lbl: string, idx: number) => {
          const x = getX(idx);
          return (
            <text key={lbl} x={x} y={bottomMargin + 22} textAnchor="middle" fontSize="11" fill="#2A2A2A" fontWeight="600">
              {lbl}
            </text>
          );
        })}

        {/* Columns for 3 Series side-by-side */}
        {labels.map((lbl: string, idx: number) => {
          const groupCenter = getX(idx);
          const colWidth = labels.length === 1 ? 24 : 10;
          const colGap = labels.length === 1 ? 8 : 1;

          const val1 = bookingCounts[idx];
          const val2 = customerCounts[idx];
          const val3 = revenueCounts[idx];

          const h1 = (val1 / maxVal) * drawHeight;
          const h2 = (val2 / maxVal) * drawHeight;
          const h3 = (val3 / maxVal) * drawHeight;

          const y1 = bottomMargin - h1;
          const y2 = bottomMargin - h2;
          const y3 = bottomMargin - h3;

          const xOffset1 = labels.length === 1 ? -(colWidth * 1.5 + colGap) : -16;
          const xOffset2 = labels.length === 1 ? -colWidth / 2 : -5;
          const xOffset3 = labels.length === 1 ? (colWidth / 2 + colGap) : 6;

          return (
            <g
              key={`group-${idx}`}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const parent = document.getElementById('overview-chart-card');
                const parentRect = parent?.getBoundingClientRect();
                const tooltipX = rect.left - (parentRect?.left || 0) + rect.width / 2;
                const tooltipY = rect.top - (parentRect?.top || 0);
                setHoveredGroup({
                  idx,
                  x: tooltipX,
                  y: tooltipY,
                  booking: val1,
                  customer: val2,
                  revenue: val3,
                  label: chartTimeRange === 'year' ? `Năm ${lbl}` : lbl
                });
              }}
              onMouseLeave={() => setHoveredGroup(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Column 1: Đơn đặt lịch */}
              <rect
                x={groupCenter + xOffset1}
                y={y1}
                width={colWidth}
                height={h1}
                fill="#4A0E17"
                rx="2"
              />
              {/* Column 2: Khách hàng mới */}
              <rect
                x={groupCenter + xOffset2}
                y={y2}
                width={colWidth}
                height={h2}
                fill="#706E3B"
                rx="2"
              />
              {/* Column 3: Doanh thu */}
              <rect
                x={groupCenter + xOffset3}
                y={y3}
                width={colWidth}
                height={h3}
                fill="#B89047"
                rx="2"
              />
            </g>
          );
        })}
      </svg>
    );
  };

  const renderLineChart = () => {
    let data: number[] = [];
    let labels: string[] = [];

    if (lineChartTimeRange === 'month') {
      const revGrowth = statsData?.revenue?.growth;
      data = revGrowth ? revGrowth.map((g: any) => g.value / 1000000) : [0, 0, 0, 0, 0, 0];
      labels = revGrowth ? revGrowth.map((g: any) => g.label) : ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
    } else if (lineChartTimeRange === 'week') {
      labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      const totalRevenue = statsData?.revenue?.total || 5000000;
      data = [
        (totalRevenue * 0.12) / 1000000,
        (totalRevenue * 0.18) / 1000000,
        (totalRevenue * 0.15) / 1000000,
        (totalRevenue * 0.22) / 1000000,
        (totalRevenue * 0.18) / 1000000,
        (totalRevenue * 0.15) / 1000000,
        0
      ].map(v => Math.round(v * 10) / 10);
    } else {
      labels = ['2024', '2025', '2026'];
      const totalRevenue = statsData?.revenue?.total || 0;
      data = [0, 0, totalRevenue / 1000000].map(v => Math.round(v * 10) / 10);
    }

    const chartHeight = 180;
    const chartWidth = 500;
    const maxVal = Math.max(...data, 10) || 10;

    const topMargin = 28;
    const bottomMargin = 160;
    const drawHeight = bottomMargin - topMargin;

    const getX = (idx: number) => {
      if (labels.length === 1) return chartWidth / 2;
      return 60 + idx * ((chartWidth - 80) / (labels.length - 1));
    };

    const points = data.map((val: number, idx: number) => {
      const x = getX(idx);
      const y = topMargin + (drawHeight * (1 - val / maxVal));
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0, Math.round(maxVal / 4), Math.round(maxVal / 2), Math.round(maxVal * 3 / 4), Math.round(maxVal)].map((val) => {
          const y = topMargin + (drawHeight * (1 - val / maxVal));
          return (
            <g key={val}>
              <line x1="45" y1={y} x2={chartWidth - 20} y2={y} stroke="#E8E2D5" strokeDasharray="4 4" />
              <text x="15" y={y + 4} fontSize="10" fill="#7A7A7A" fontWeight="500">{val}M</text>
            </g>
          );
        })}

        {data.length > 1 && (
          <>
            <polyline fill="none" stroke="#4A0E17" strokeWidth="3" points={points} />
            <path d={`M ${getX(0)} ${bottomMargin} L ${points} L ${getX(data.length - 1)} ${bottomMargin} Z`} fill="url(#grad)" opacity="0.1" />
          </>
        )}

        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4A0E17" />
            <stop offset="100%" stopColor="#4A0E17" stopOpacity="0" />
          </linearGradient>
        </defs>

        {data.map((val: number, idx: number) => {
          const x = getX(idx);
          const y = topMargin + (drawHeight * (1 - val / maxVal));
          return (
            <g key={idx}>
              <circle cx={x} cy={y} r="5" fill="#4A0E17" stroke="white" strokeWidth="2" />
              <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fill="#2A2A2A" fontWeight="700">{val.toFixed(1)}M</text>
              <text x={x} y={bottomMargin + 20} textAnchor="middle" fontSize="11" fill="#7A7A7A" fontWeight="600">{labels[idx]}</text>
            </g>
          );
        })}
      </svg>
    );
  };


  const renderDonutChart = () => {
    const agg = statsData?.userBehavior?.popularBookings || [];
    const valRental = agg.find((a: any) => a._id === 'AODAI_RENTAL')?.count || 0;
    const valPhoto = agg.find((a: any) => a._id === 'PHOTOGRAPHY')?.count || 0;
    const valCombo = agg.find((a: any) => a._id === 'COMBO')?.count || 0;
    const total = valRental + valPhoto + valCombo;

    const pctRental = total ? Math.round((valRental / total) * 100) : 0;
    const pctPhoto = total ? Math.round((valPhoto / total) * 100) : 0;
    const pctCombo = total ? Math.round((valCombo / total) * 100) : 0;

    const data = [
      { value: pctRental, color: '#4A0E17', name: 'Cho thuê áo dài' },
      { value: pctPhoto, color: '#706E3B', name: 'Dịch vụ chụp ảnh' },
      { value: pctCombo, color: '#B89047', name: 'Combo trọn gói' }
    ];

    let accumulatedLength = 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
        <svg width="440" height="440" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="45" fill="none" stroke="#FAF6F0" strokeWidth="14" />
          {total === 0 ? (
            <circle cx="60" cy="60" r="45" fill="none" stroke="#E8E2D5" strokeWidth="14" />
          ) : (
            data.map((item, idx) => {
              if (item.value === 0) return null;
              const strokeLength = (item.value / 100) * 282.7;
              const currentOffset = -accumulatedLength;
              accumulatedLength += strokeLength;
              return (
                <circle
                  key={idx}
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="14"
                  strokeDasharray={`${strokeLength} ${282.7 - strokeLength}`}
                  strokeDashoffset={currentOffset}
                  transform="rotate(-90 60 60)"
                  strokeLinecap="round"
                />
              );
            })
          )}
          <text x="60" y="58" textAnchor="middle" fontSize="11" fill="#7A7A7A" fontWeight="600">Tổng quan</text>
          <text x="60" y="74" textAnchor="middle" fontSize="15" fill="#2A2A2A" fontWeight="800">
            {total > 0 ? '100%' : '0%'}
          </text>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', width: '100%', marginTop: '4px' }}>
          {total === 0 ? (
            <span style={{ fontSize: '13px', color: '#7A7A7A', fontStyle: 'italic' }}>Chưa có giao dịch nào</span>
          ) : (
            data.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: item.color }} />
                <span style={{ color: '#2A2A2A', fontWeight: '600' }}>{item.name}:</span>
                <strong style={{ color: '#2A2A2A' }}>{item.value}%</strong>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // Shared Pagination Component
  const renderPagination = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
    if (totalPages <= 1) return null;

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px 20px', borderTop: '1px solid #E8E2D5', backgroundColor: '#FAF6F0' }}>
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          style={{
            padding: '6px 12px', border: '1px solid #E8E2D5', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
            backgroundColor: currentPage === 1 ? '#FAF6F0' : 'white',
            color: currentPage === 1 ? '#A0A0A0' : '#4A0E17',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
          }}
        >
          Trang trước
        </button>

        {Array.from({ length: totalPages }).map((_, idx) => {
          const p = idx + 1;
          const isCurrent = p === currentPage;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                width: '32px', height: '32px', border: '1px solid #E8E2D5', borderRadius: '4px', fontSize: '12px', fontWeight: 700,
                backgroundColor: isCurrent ? '#4A0E17' : 'white',
                color: isCurrent ? 'white' : '#2A2A2A',
                cursor: 'pointer'
              }}
            >
              {p}
            </button>
          );
        })}

        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          style={{
            padding: '6px 12px', border: '1px solid #E8E2D5', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
            backgroundColor: currentPage === totalPages ? '#FAF6F0' : 'white',
            color: currentPage === totalPages ? '#A0A0A0' : '#4A0E17',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
          }}
        >
          Trang sau
        </button>
      </div>
    );
  };

  // --- SUB-SECTIONS RENDERING ---

  // Tab 1: System Overview
  const renderOverviewTab = () => {
    const revVal = statsData ? statsData.revenue.total : 0;
    const custVal = statsData ? statsData.customers.total : 0;
    const shopVal = statsData ? statsData.shops.total : 0;
    const photoVal = statsData ? statsData.photographers.total : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng doanh thu</div>
            <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '8px', color: '#4A0E17' }}>{revVal.toLocaleString()}đ</div>
            <div style={{ fontSize: '12px', color: '#706E3B', marginTop: '6px', fontWeight: 600 }}>Cập nhật tự động từ PayOS</div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Khách hàng đăng ký</div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#2A2A2A' }}>{custVal}</div>
            <div style={{ fontSize: '12px', color: '#706E3B', marginTop: '6px', fontWeight: 600 }}>Hoạt động: {statsData ? statsData.customers.active : 0} khách</div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cửa hàng áo dài</div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#706E3B' }}>{shopVal}</div>
            <div style={{ fontSize: '12px', color: '#B89047', marginTop: '6px', fontWeight: 600 }}>Sản phẩm hoạt động: {statsData ? statsData.shops.activeProducts : 0}</div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nhiếp ảnh gia</div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#B89047' }}>{photoVal}</div>
            <div style={{ fontSize: '12px', color: '#706E3B', marginTop: '6px', fontWeight: 600 }}>Tổng Photo Bookings: {statsData ? statsData.photographers.bookings : 0}</div>
          </div>
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          <div id="overview-chart-card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Thống kê Đơn đặt lịch & Doanh thu</h3>
              <div style={{ display: 'flex', gap: '4px', backgroundColor: '#FAF6F0', padding: '2px', borderRadius: '6px', border: '1px solid #E8E2D5' }}>
                {(['week', 'month', 'year'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setChartTimeRange(r)}
                    style={{
                      padding: '4px 10px',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: chartTimeRange === r ? '#4A0E17' : 'transparent',
                      color: chartTimeRange === r ? 'white' : '#7A7A7A',
                      transition: 'all 0.15s'
                    }}
                  >
                    {r === 'week' ? 'Tuần' : r === 'month' ? 'Tháng' : 'Năm'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '11px', fontWeight: 600, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#4A0E17', borderRadius: '2px' }} />
                Đơn đặt lịch
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#706E3B', borderRadius: '2px' }} />
                Khách hàng mới
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#B89047', borderRadius: '2px' }} />
                Doanh thu (triệu đ)
              </div>
            </div>
            {renderBarChart()}
            {hoveredGroup && (
              <div style={{
                position: 'absolute',
                left: `${hoveredGroup.x}px`,
                top: `${hoveredGroup.y - 95}px`,
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(74, 14, 23, 0.95)',
                color: 'white',
                padding: '10px 14px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                pointerEvents: 'none',
                zIndex: 10,
                fontSize: '11px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                transition: 'all 0.1s ease-out'
              }}>
                <div style={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px', marginBottom: '4px', textAlign: 'center' }}>
                  {hoveredGroup.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#FF8A9A' }} />
                  <span>Đơn đặt lịch: <strong>{hoveredGroup.booking}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#CBE58B' }} />
                  <span>Khách hàng mới: <strong>{hoveredGroup.customer}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#FFE699' }} />
                  <span>Doanh thu: <strong>{hoveredGroup.revenue} triệu đ</strong></span>
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: '-6px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid rgba(74, 14, 23, 0.95)'
                }} />
              </div>
            )}
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Cơ cấu đặt dịch vụ hệ thống</h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#7A7A7A' }}>Tỷ lệ phần trăm booking các loại hình dịch vụ chính.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
              {renderDonutChart()}
            </div>
          </div>
        </div>

        {/* Latest Activity Table */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E2D5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Lịch sử giao dịch thanh toán gần đây</h3>
            <button onClick={() => setActiveTab('revenue')} style={{ fontSize: '12px', color: '#B89047', border: 'none', background: 'none', fontWeight: 700, cursor: 'pointer' }}>Xem tất cả →</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>MÃ GIAO DỊCH</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>ĐỐI TÁC</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>SỐ TIỀN CHI TRẢ</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TÀI KHOẢN NHẬN</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Không có giao dịch quyết toán nào</td>
                </tr>
              ) : (
                transactions.slice(0, 3).map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => {
                      if (tx.bookingId) {
                        setSelectedBookingId(tx.bookingId);
                        setIsDetailModalOpen(true);
                      }
                    }}
                    style={{ borderBottom: '1px solid #FAF6F0', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '16px 20px', fontWeight: 700 }}>{tx.id}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 600 }}>{tx.providerName}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: '#4A0E17' }}>{tx.amount.toLocaleString()}đ</td>
                    <td style={{ padding: '16px 20px', color: '#7A7A7A' }}>{tx.bank} • {tx.account}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: tx.status === 'PAID' ? '#F0FDF4' : tx.status === 'PENDING' ? '#FEF3C7' : '#FEE2E2',
                        color: tx.status === 'PAID' ? '#166534' : tx.status === 'PENDING' ? '#92400E' : '#991B1B'
                      }}>
                        {tx.status === 'PAID' ? 'Thành công' : tx.status === 'PENDING' ? 'Đang xử lý' : 'Thất bại'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Tab 2: Customer Management
  const renderCustomersTab = () => {
    const filtered = customers.filter(c => {
      const matchSearch = c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || c.email.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery);
      const matchStatus = filterStatus === 'ALL' || c.status === filterStatus;
      return matchSearch && matchStatus;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Search & Filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', backgroundColor: 'white', padding: '16px 20px', borderRadius: '8px', border: '1px solid #E8E2D5' }}>
          <div style={{ display: 'flex', flex: 1, maxWidth: '500px', alignItems: 'center', border: '1px solid #E8E2D5', borderRadius: '6px', padding: '0 12px', backgroundColor: '#FAF6F0' }}>
            <Search size={16} color="#7A7A7A" />
            <input
              type="text"
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'none', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'ACTIVE', 'BANNED'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '8px 16px', border: '1px solid #E8E2D5', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  backgroundColor: filterStatus === status ? '#4A0E17' : 'white',
                  color: filterStatus === status ? 'white' : '#2A2A2A',
                  transition: 'all 0.15s'
                }}
              >
                {status === 'ALL' ? 'Tất cả' : status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
              </button>
            ))}
          </div>
        </div>

        {/* Customer Table */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>KHÁCH HÀNG</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>EMAIL</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>ĐIỆN THOẠI</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>NGÀY ĐĂNG KÝ</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>ĐƠN ĐÃ ĐẶT</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>CHI TIÊU TÍCH LŨY</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TRẠNG THÁI</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Không tìm thấy khách hàng nào</td>
                </tr>
              ) : (
                filtered.map(cust => (
                  <tr key={cust.id} style={{ borderBottom: '1px solid #FAF6F0' }}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={cust.avatar} alt={cust.fullName} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #E8E2D5' }} />
                        <div>
                          <strong style={{ display: 'block', color: '#2A2A2A' }}>{cust.fullName}</strong>
                          <span style={{ fontSize: '10px', color: '#7A7A7A' }}>ID: {cust.id}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}>{cust.email}</td>
                    <td style={{ padding: '12px 20px' }}>{cust.phone || 'Chưa cung cấp'}</td>
                    <td style={{ padding: '12px 20px', color: '#7A7A7A' }}>{cust.date}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 600 }}>{cust.bookings}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, color: '#4A0E17' }}>{(cust.spent || 0).toLocaleString()}đ</td>
                    <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: cust.status === 'ACTIVE' ? '#EBF8FF' : '#FEE2E2',
                        color: cust.status === 'ACTIVE' ? '#2B6CB0' : '#991B1B'
                      }}>
                        {cust.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => setSelectedDetailItem({ ...cust, type: 'CUSTOMER' })}
                          style={{ padding: '6px', border: 'none', borderRadius: '4px', backgroundColor: '#FAF6F0', cursor: 'pointer', color: '#706E3B' }}
                          title="Xem chi tiết"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleBanCustomer(cust.id, cust.status === 'ACTIVE')}
                          style={{
                            padding: '6px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                            backgroundColor: cust.status === 'ACTIVE' ? '#FFF5F5' : '#F0FDF4',
                            color: cust.status === 'ACTIVE' ? '#E53E3E' : '#38A169'
                          }}
                          title={cust.status === 'ACTIVE' ? 'Khóa khách hàng' : 'Mở khóa khách hàng'}
                        >
                          <Ban size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {renderPagination(customerPage, customerTotalPages, setCustomerPage)}
        </div>
      </div>
    );
  };

  // Tab 3: Partner/Store Management
  const renderProvidersTab = () => {
    const filtered = providers.filter(p => {
      const matchSearch = p.businessName.toLowerCase().includes(searchQuery.toLowerCase()) || p.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery);
      const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;
      return matchSearch && matchStatus;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Search & Filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', backgroundColor: 'white', padding: '16px 20px', borderRadius: '8px', border: '1px solid #E8E2D5' }}>
          <div style={{ display: 'flex', flex: 1, maxWidth: '500px', alignItems: 'center', border: '1px solid #E8E2D5', borderRadius: '6px', padding: '0 12px', backgroundColor: '#FAF6F0' }}>
            <Search size={16} color="#7A7A7A" />
            <input
              type="text"
              placeholder="Tìm theo tên doanh nghiệp, chủ sở hữu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'none', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'ACTIVE', 'SUSPENDED'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '8px 16px', border: '1px solid #E8E2D5', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  backgroundColor: filterStatus === status ? '#4A0E17' : 'white',
                  color: filterStatus === status ? 'white' : '#2A2A2A',
                  transition: 'all 0.15s'
                }}
              >
                {status === 'ALL' ? 'Tất cả' : status === 'ACTIVE' ? 'Hoạt động' : 'Tạm đình chỉ'}
              </button>
            ))}
          </div>
        </div>

        {/* Providers Table */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>DOANH NGHIỆP / CỬA HÀNG</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>CHỦ SỞ HỮU</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>DỊCH VỤ</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>ĐÁNH GIÁ</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>SẢN PHẨM</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TỔNG DOANH THU</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TRẠNG THÁI</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Không tìm thấy đối tác nào</td>
                </tr>
              ) : (
                filtered.map(prov => (
                  <tr key={prov.id} style={{ borderBottom: '1px solid #FAF6F0' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div>
                        <strong style={{ display: 'block', color: '#4A0E17', fontSize: '14px' }}>{prov.businessName}</strong>
                        <span style={{ fontSize: '11px', color: '#7A7A7A' }}>{prov.phone} • {prov.email}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 500 }}>{prov.ownerName}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(prov.capability || []).map((cap: string) => (
                          <span key={cap} style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, backgroundColor: '#FAF6F0', color: '#706E3B', border: '1px solid #E8E2D5' }}>
                            {cap === 'RENTAL' || cap === 'AODAI_RENTAL' ? 'CHO THUÊ' : cap === 'PHOTOGRAPHY' ? 'CHỤP ẢNH' : cap}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 700, color: '#B89047' }}>★ {prov.rating}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{prov.totalProducts}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, color: '#2A2A2A' }}>{(prov.totalEarnings || 0).toLocaleString()}đ</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: prov.status === 'ACTIVE' ? '#F0FDF4' : '#FEE2E2',
                        color: prov.status === 'ACTIVE' ? '#166534' : '#991B1B'
                      }}>
                        {prov.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => setSelectedDetailItem({ ...prov, type: 'PROVIDER' })}
                          style={{ padding: '6px', border: 'none', borderRadius: '4px', backgroundColor: '#FAF6F0', cursor: 'pointer', color: '#706E3B' }}
                          title="Xem chi tiết"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleSuspendProvider(prov.id, prov.status === 'ACTIVE')}
                          style={{
                            padding: '6px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                            backgroundColor: prov.status === 'ACTIVE' ? '#FFF5F5' : '#F0FDF4',
                            color: prov.status === 'ACTIVE' ? '#E53E3E' : '#38A169'
                          }}
                          title={prov.status === 'ACTIVE' ? 'Đình chỉ đối tác' : 'Kích hoạt đối tác'}
                        >
                          {prov.status === 'ACTIVE' ? <Lock size={14} /> : <CheckSquare size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {renderPagination(providerPage, providerTotalPages, setProviderPage)}
        </div>
      </div>
    );
  };

  // Tab 4: Booking Schedules
  const renderBookingsTab = () => {
    const filtered = bookings.filter(b => {
      const matchSearch = b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || b.providerName.toLowerCase().includes(searchQuery.toLowerCase()) || b.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'ALL' || b.status === filterStatus;
      return matchSearch && matchStatus;
    });

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'COMPLETED': return { bg: '#F0FDF4', text: '#166534' };
        case 'RETURNED': return { bg: '#EBF8FF', text: '#2B6CB0' };
        case 'PICKED_UP': return { bg: '#FEF3C7', text: '#92400E' };
        case 'PENDING': return { bg: '#F3F4F6', text: '#374151' };
        default: return { bg: '#FEE2E2', text: '#991B1B' }; // CANCELLED
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {rentalMigrationReport && (
          <section style={{ border: '1px solid #FCD34D', background: '#FFFBEB', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div><h3 style={{ margin: 0, fontSize: '14px', color: '#92400E' }}>Migration áo dài cũ</h3><p style={{ margin: '5px 0 0', fontSize: '12px', color: '#78350F' }}>Các item thiếu snapshot hoặc evidence không được tự suy diễn.</p></div>
              <button type="button" onClick={() => void fetchRentalMigrationReview()} disabled={loadingRentalMigration} style={{ border: '1px solid #D97706', background: 'white', color: '#92400E', borderRadius: '6px', padding: '7px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>{loadingRentalMigration ? 'Đang tải…' : 'Làm mới'}</button>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px', fontSize: '12px', color: '#78350F' }}><span>Cần review: <strong>{rentalMigrationReport.needsReview || 0}</strong></span><span>Legacy read-only: <strong>{rentalMigrationReport.legacyReadOnly || 0}</strong></span><span>Đã migrate: <strong>{rentalMigrationReport.migrated || 0}</strong></span></div>
            {rentalMigrationReviewItems.length > 0 && (
              <div style={{ marginTop: '12px', display: 'grid', gap: '7px' }}>
                {rentalMigrationReviewItems.map((item) => {
                  const booking = item.bookingId || {};
                  const bookingId = booking._id || item.bookingId;
                  const reasons = item.rentalMigration?.reasons || [];
                  const canSupplyLocation = reasons.includes('MISSING_PICKUP_RETURN_SNAPSHOT');
                  const isResolving = resolvingRentalMigrationItem === item._id;
                  return (
                    <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', padding: '9px', background: 'white', border: '1px solid #FDE68A', borderRadius: '7px', fontSize: '12px' }}>
                      <div>
                        <strong>{booking.bookingCode || String(bookingId || '').slice(-6).toUpperCase() || 'Booking cũ'}</strong> · {item.productId?.name || 'Áo dài'}
                        <div style={{ color: '#92400E', marginTop: '3px' }}>{reasons.join(', ') || 'Cần kiểm tra dữ liệu legacy'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {bookingId && <button type="button" onClick={() => { setSelectedBookingId(String(bookingId)); setIsDetailModalOpen(true); }} style={{ border: 'none', color: '#1D4ED8', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>Mở booking</button>}
                        {canSupplyLocation && <button type="button" disabled={isResolving} onClick={() => { setMigrationLocationItem(item); setMigrationLocation(null); }} style={{ border: '1px solid #D97706', color: '#92400E', background: 'white', borderRadius: '6px', padding: '6px 8px', cursor: isResolving ? 'wait' : 'pointer', fontWeight: 700 }}>Bổ sung điểm nhận/trả</button>}
                        <button type="button" disabled={isResolving} onClick={() => void keepLegacyReadOnly(item)} style={{ border: '1px solid #B45309', color: '#92400E', background: '#FFFBEB', borderRadius: '6px', padding: '6px 8px', cursor: isResolving ? 'wait' : 'pointer', fontWeight: 700 }}>{isResolving ? 'Đang lưu…' : 'Giữ legacy'}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
        {/* Search & Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', backgroundColor: 'white', padding: '16px 20px', borderRadius: '8px', border: '1px solid #E8E2D5' }}>
          <div style={{ display: 'flex', flex: 1, maxWidth: '500px', alignItems: 'center', border: '1px solid #E8E2D5', borderRadius: '6px', padding: '0 12px', backgroundColor: '#FAF6F0' }}>
            <Search size={16} color="#7A7A7A" />
            <input
              type="text"
              placeholder="Tìm theo mã đặt lịch, khách hàng, đối tác..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'none', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['ALL', 'PENDING', 'PICKED_UP', 'RETURNED', 'COMPLETED', 'CANCELLED'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '6px 12px', border: '1px solid #E8E2D5', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  backgroundColor: filterStatus === status ? '#4A0E17' : 'white',
                  color: filterStatus === status ? 'white' : '#2A2A2A',
                  transition: 'all 0.15s'
                }}
              >
                {status === 'ALL' ? 'TẤT CẢ' : status}
              </button>
            ))}
          </div>
        </div>

        {/* Bookings Table */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>MÃ ĐƠN</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>KHÁCH HÀNG</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>ĐỐI TÁC CUNG CẤP</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>SẢN PHẨM/DỊCH VỤ</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>THỜI GIAN THUÊ / CHỤP</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TỔNG PHÍ</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Không tìm thấy booking nào</td>
                </tr>
              ) : (
                filtered.map(bk => {
                  const sColor = getStatusColor(bk.status);
                  return (
                    <tr key={bk.id} style={{ borderBottom: '1px solid #FAF6F0' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 700 }}>{bk.id}</td>
                      <td style={{ padding: '16px 20px', fontWeight: 600 }}>{bk.customerName}</td>
                      <td style={{ padding: '16px 20px', color: '#4A0E17', fontWeight: 600 }}>{bk.providerName}</td>
                      <td style={{ padding: '16px 20px', color: '#2A2A2A' }}>{bk.items}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', color: '#7A7A7A', fontSize: '12px' }}>
                        {bk.rentalDate} {bk.returnDate && bk.returnDate !== bk.rentalDate ? `→ ${bk.returnDate}` : ''}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700 }}>{bk.price.toLocaleString()}đ</td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                          backgroundColor: sColor.bg, color: sColor.text
                        }}>
                          {bk.status === 'COMPLETED' ? 'Hoàn thành' :
                            bk.status === 'RETURNED' ? 'Đã trả đồ' :
                              bk.status === 'PICKED_UP' ? 'Đang thuê' :
                                bk.status === 'PENDING' ? 'Chờ duyệt' : 'Đã hủy'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {renderPagination(bookingPage, bookingTotalPages, setBookingPage)}
        </div>
      </div>
    );
  };

  // Tab 5: Revenue & Settlements (UC-K23)
  const renderRevenueTab = () => {
    const revVal = statsData ? statsData.revenue.total : 0;
    const commVal = statsData ? statsData.revenue.commission : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 750, color: '#7A7A7A', textTransform: 'uppercase' }}>Tổng doanh số giao dịch</div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#4A0E17' }}>{revVal.toLocaleString()}đ</div>
            <div style={{ fontSize: '12px', color: '#706E3B', marginTop: '6px', fontWeight: 600 }}>Cập nhật tự động từ PayOS</div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 750, color: '#7A7A7A', textTransform: 'uppercase' }}>Doanh thu hệ thống (Commission - 10%)</div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#B89047' }}>{commVal.toLocaleString()}đ</div>
            <div style={{ fontSize: '12px', color: '#7A7A7A', marginTop: '6px', fontWeight: 500 }}>Khấu trừ trực tiếp trên mỗi đơn thành công</div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 750, color: '#7A7A7A', textTransform: 'uppercase' }}>Doanh thu đối tác thực nhận (90%)</div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#706E3B' }}>{(revVal - commVal).toLocaleString()}đ</div>
            <div style={{ fontSize: '12px', color: '#706E3B', marginTop: '6px', fontWeight: 600 }}>Doanh thu chi trả đối tác</div>
          </div>
        </div>

        {/* Trend line chart */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Biểu đồ tăng trưởng doanh thu hệ thống (triệu đồng)</h3>
            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#FAF6F0', padding: '2px', borderRadius: '6px', border: '1px solid #E8E2D5' }}>
              {(['week', 'month', 'year'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setLineChartTimeRange(r)}
                  style={{
                    padding: '4px 10px',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: lineChartTimeRange === r ? '#4A0E17' : 'transparent',
                    color: lineChartTimeRange === r ? 'white' : '#7A7A7A',
                    transition: 'all 0.15s'
                  }}
                >
                  {r === 'week' ? 'Tuần' : r === 'month' ? 'Tháng' : 'Năm'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: '85%', margin: '0 auto' }}>
            {renderLineChart()}
          </div>
        </div>

        {/* Transactions list */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E2D5' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#4A0E17' }}>LỊCH SỬ GIAO DỊCH THANH TOÁN</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>MÃ GIAO DỊCH</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>ĐỐI TÁC NHẬN TIỀN</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>NGÀY GIAO DỊCH</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>THÔNG TIN NGÂN HÀNG</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>SỐ TIỀN THỰC NHẬN (90%)</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>
                    Không có lịch sử giao dịch nào
                  </td>
                </tr>
              ) : (
                transactions.map(tx => (
                  <tr
                    key={tx.id}
                    onClick={() => {
                      if (tx.bookingId) {
                        setSelectedBookingId(tx.bookingId);
                        setIsDetailModalOpen(true);
                      }
                    }}
                    style={{ borderBottom: '1px solid #FAF6F0', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '16px 20px', fontWeight: 700 }}>{tx.id}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 600 }}>{tx.providerName}</td>
                    <td style={{ padding: '16px 20px', color: '#7A7A7A' }}>{tx.date}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontWeight: 600, color: '#2A2A2A' }}>{tx.bank}</span>
                      <span style={{ display: 'block', fontSize: '11px', color: '#7A7A7A' }}>STK: {tx.account}</span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, color: '#4A0E17' }}>{tx.amount.toLocaleString()}đ</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: tx.status === 'PAID' ? '#F0FDF4' : tx.status === 'PENDING' ? '#FEF3C7' : '#FEE2E2',
                        color: tx.status === 'PAID' ? '#166534' : tx.status === 'PENDING' ? '#92400E' : '#991B1B'
                      }}>
                        {tx.status === 'PAID' ? 'Thành công' : tx.status === 'PENDING' ? 'Đang xử lý' : 'Thất bại'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {renderPagination(transactionPage, transactionTotalPages, setTransactionPage)}
        </div>
      </div>
    );
  };

  // Tab 6: Provider Verifications (Partner Approval)
  const renderVerificationsTab = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E2D5', backgroundColor: '#FAF6F0' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#4A0E17' }}>DANH SÁCH HỒ SƠ ĐĂNG KÝ CHỜ DUYỆT</h3>
          </div>
          {verifications.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#7A7A7A', fontWeight: 600 }}>Không có hồ sơ đăng ký đối tác nào chờ phê duyệt.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E2D5', backgroundColor: '#FAF6F0' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TÊN ĐỐI TÁC</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>LOẠI YÊU CẦU</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>DỊCH VỤ ĐĂNG KÝ</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>NGÀY GỬI YÊU CẦU</th>
                  <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TRẠNG THÁI OCR/HỒ SƠ</th>
                  <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {verifications.map(v => {
                  const reqCaps = v.requestedCapabilities || [];
                  const isUnderReview = v.status === 'UNDER_REVIEW';
                  const isApproved = v.status === 'APPROVED';
                  const isRejected = v.status === 'REJECTED';
                  const isChanges = v.status === 'NEEDS_CHANGES';

                  return (
                    <tr key={v.verificationId} style={{ borderBottom: '1px solid #E8E2D5', backgroundColor: selectedDetailItem?.verificationId === v.verificationId ? '#FFF9F9' : 'transparent' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div>
                          <strong style={{ display: 'block', color: '#4A0E17', fontSize: '14px' }}>{v.businessProfile?.businessName || 'N/A'}</strong>
                          <span style={{ fontSize: '11px', color: '#7A7A7A' }}>{v.businessProfile?.phone} • {v.businessProfile?.email}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 600 }}>
                        {v.verificationType === 'NEW_PROVIDER' ? 'Đăng ký mới' : 'Thêm danh mục'}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {reqCaps.map(cap => (
                            <span key={cap} style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, backgroundColor: '#FAF6F0', color: '#706E3B', border: '1px solid #E8E2D5' }}>
                              {cap === 'RENTAL' || cap === 'AODAI_RENTAL' ? 'CHO THUÊ' : cap === 'PHOTOGRAPHY' ? 'NHIẾP ẢNH' : cap}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#7A7A7A' }}>
                        {new Date(v.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                          backgroundColor: isApproved ? '#F0FDF4' : isRejected ? '#FEE2E2' : isUnderReview ? '#FEF3C7' : isChanges ? '#FFFAF0' : '#E0F2FE',
                          color: isApproved ? '#166534' : isRejected ? '#991B1B' : isUnderReview ? '#92400E' : isChanges ? '#D69E2E' : '#0369A1'
                        }}>
                          {isApproved ? 'Đã duyệt' : isRejected ? 'Từ chối' : isUnderReview ? 'Đang duyệt' : isChanges ? 'Cần sửa đổi' : 'Mới gửi'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <button
                          onClick={() => openVerificationDetail(v)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                            border: 'none', borderRadius: '4px', backgroundColor: '#4A0E17',
                            color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          <Eye size={12} /> Xem Chi Tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  // Tab: Reported Reviews (Spam Management)
  const renderReportedReviewsTab = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E2D5', backgroundColor: '#FAF6F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#4A0E17' }}>DANH SÁCH BÁO CÁO VI PHẠM & SPAM ĐÁNH GIÁ</h3>
            <button
              onClick={fetchReportedReviews}
              style={{ padding: '6px 12px', border: '1px solid #B89047', borderRadius: '6px', backgroundColor: 'white', color: '#B89047', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              Làm mới
            </button>
          </div>
          {loadingReportedReviews ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#7A7A7A', fontWeight: 600 }}>Đang tải danh sách báo cáo vi phạm...</div>
          ) : reportedReviews.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#7A7A7A', fontWeight: 600 }}>Không có báo cáo vi phạm đánh giá nào cần xử lý.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>MÃ ĐƠN HÀNG</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>ĐỐI TÁC</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>KHÁCH HÀNG & ĐÁNH GIÁ</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>LÝ DO BÁO CÁO SPAM</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>NGÀY BÁO CÁO</th>
                  <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>HÀNH ĐỘNG HỆ THỐNG</th>
                </tr>
              </thead>
              <tbody>
                {reportedReviews.map((r) => {
                  const custName = r.customerId?.profile?.fullName || 'Khách hàng';
                  const studioName = r.providerId?.businessName || 'Nhà cung cấp';
                  const bCode = r.bookingId?.bookingCode || r.bookingId?._id?.toString()?.slice(-6)?.toUpperCase() || 'N/A';
                  const ratingStars = r.rating || 5;

                  return (
                    <tr key={r._id} style={{ borderBottom: '1px solid #E8E2D5', transition: 'background 0.15s' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: '#4A0E17' }}>
                        #{bCode}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <strong style={{ display: 'block', color: '#2A2A2A' }}>{studioName}</strong>
                        <span style={{ fontSize: '11px', color: '#7A7A7A' }}>ID: {r.providerId?._id}</span>
                      </td>
                      <td style={{ padding: '16px 20px', maxWidth: '350px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <strong style={{ color: '#2A2A2A' }}>{custName}</strong>
                          <span style={{ display: 'flex', gap: '1px', color: '#B89047' }}>
                            {Array.from({ length: ratingStars }).map((_, i) => (
                              <Star key={i} size={10} fill="currentColor" color="currentColor" />
                            ))}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12.5px', color: '#4A4A4A', lineHeight: '1.4', wordBreak: 'break-word' }}>
                          "{r.comment || 'Không có bình luận.'}"
                        </p>
                        {r.images && r.images.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            {r.images.map((img: string, idx: number) => (
                              <a href={getImageUrl(img)} target="_blank" rel="noreferrer" key={idx} style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', display: 'block' }}>
                                <img src={getImageUrl(img)} alt="review attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#991B1B', fontWeight: 600 }}>
                        {r.reportReason || 'Spam / Vi phạm tiêu chuẩn'}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#7A7A7A' }}>
                        {r.reportedAt ? new Date(r.reportedAt).toLocaleDateString('vi-VN') : 'N/A'}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleReviewReportAction(r._id, 'DELETE')}
                            style={{ width: '150px', padding: '6px 12px', border: 'none', borderRadius: '4px', backgroundColor: '#4A0E17', color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            XÓA ĐÁNH GIÁ (SPAM)
                          </button>
                          <button
                            onClick={() => handleReviewReportAction(r._id, 'DISMISS')}
                            style={{ width: '150px', padding: '6px 12px', border: '1px solid #706E3B', borderRadius: '4px', backgroundColor: 'white', color: '#706E3B', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            BÁC BỎ (GIỮ REVIEW)
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  // Tab 7: Dispute Resolution
  const renderDisputesTab = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E2D5', backgroundColor: '#FAF6F0' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#4A0E17' }}>DANH SÁCH YÊU CẦU ĐỀN BÙ SỰ CỐ & TRANH CHẤP ĐANG XỬ LÝ</h3>
          </div>
          {disputes.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#7A7A7A', fontWeight: 600 }}>Không có cuộc tranh chấp sự cố nào cần xử lý.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E2D5', backgroundColor: '#FAF6F0' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>MÃ ĐƠN HÀNG</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>LOẠI TRANH CHẤP</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>SẢN PHẨM</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>ĐỐI TÁC LIÊN QUAN</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>SỐ TIỀN TRANH CHẤP</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>GIỚI HẠN QUỸ</th>
                  <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map(d => {
                  const bookingCode = d.bookingId?.bookingCode || 'N/A';
                  const productName = d.productId?.name || d.bookingItemId?.name || 'Sản phẩm';
                  const shopName = d.reportedBy?.businessName || d.reportedBy?.profile?.fullName || d.reportedBy?.fullName || 'Shop';
                  const reqAmt = d.requestedAmount;
                  const limitTotal = d.isDirectDispute ? d.requestedAmount : (d.bookingId?.pricingSummary?.depositTotal || 0);
                  const disputeTypeLabel = d.isDirectDispute ? 'Từ chối nhận đồ' : 'Báo hỏng đền bù';
                  const disputeTypeColor = d.isDirectDispute ? '#C53030' : '#D69E2E';
                  const disputeTypeBg = d.isDirectDispute ? '#FFF5F5' : '#FEFCBF';

                  return (
                    <tr key={d._id} style={{ borderBottom: '1px solid #E8E2D5', backgroundColor: selectedDetailItem?._id === d._id ? '#FFF9F9' : 'transparent' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 700 }}>{bookingCode}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          color: disputeTypeColor, backgroundColor: disputeTypeBg, border: `1px solid ${disputeTypeColor}33`
                        }}>
                          {disputeTypeLabel.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 600 }}>{productName}</td>
                      <td style={{ padding: '16px 20px', color: '#4A0E17', fontWeight: 600 }}>{shopName}</td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: '#C53030', textAlign: 'right' }}>{reqAmt.toLocaleString()}đ</td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: '#2B6CB0', textAlign: 'right' }}>{limitTotal.toLocaleString()}đ</td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedDetailItem({ ...d, type: 'DISPUTE' });
                            setAdminNotes('');
                            setSplitRefundAmount(0);
                            setSplitCompensationAmount(0);
                            setAdminNotes('');
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                            border: 'none', borderRadius: '4px', backgroundColor: '#4A0E17',
                            color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          <Eye size={12} /> Xem Chi Tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  // Tab 8: User Behavior Analysis (UC-K25)
  const renderBehaviorTab = () => {
    const beh = statsData?.userBehavior;
    const topSearches = beh?.topSearches || [
      { keyword: 'áo dài nhật bình', count: 12 },
      { keyword: 'chụp ảnh ngoại cảnh huế', count: 8 },
      { keyword: 'áo dài cô ba sài gòn', count: 6 },
      { keyword: 'thuê áo dài cưới', count: 4 },
      { keyword: 'trang điểm kỷ yếu', count: 2 }
    ];

    const pageViews = beh?.pageViews || {
      homepage: 0,
      rentals: 0,
      photographers: 0,
      productDetails: 0
    };

    const maxView = Math.max(...Object.values(pageViews) as number[]) || 10;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

          {/* Top Searches table */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Từ khóa tìm kiếm phổ biến</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E2D5', color: '#7A7A7A' }}>
                  <th style={{ padding: '10px 0', textAlign: 'left', fontWeight: 700 }}>TỪ KHÓA</th>
                  <th style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700 }}>LƯỢT TÌM KIẾM</th>
                </tr>
              </thead>
              <tbody>
                {topSearches.map((ts: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #FAF6F0' }}>
                    <td style={{ padding: '12px 0', fontWeight: 600, color: '#2A2A2A' }}>
                      <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#FAF6F0', color: '#4A0E17', textAlign: 'center', lineHeight: '20px', fontSize: '11px', fontWeight: 700, marginRight: '10px' }}>
                        {idx + 1}
                      </span>
                      {ts.keyword}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: '#706E3B' }}>{ts.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Page Views visualization */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Lượt xem trang chi tiết</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
              {[
                { name: 'Trang chủ (Discovery)', key: 'homepage', color: '#4A0E17' },
                { name: 'Danh sách cho thuê áo dài', key: 'rentals', color: '#706E3B' },
                { name: 'Chi tiết sản phẩm / Áo dài', key: 'productDetails', color: '#B89047' },
                { name: 'Danh sách nhiếp ảnh gia', key: 'photographers', color: '#2A2A2A' },
              ].map(page => {
                const count = (pageViews as any)[page.key] || 0;
                const percent = maxView ? (count / maxView) * 100 : 0;
                return (
                  <div key={page.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                      <span style={{ color: '#2A2A2A' }}>{page.name}</span>
                      <span style={{ color: page.color }}>{count.toLocaleString()} views</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#FAF6F0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', backgroundColor: page.color, borderRadius: '4px', transition: 'width 0.5s ease-out' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Top Product Bookings / Popular Bookings */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E2D5', backgroundColor: '#FAF6F0' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase' }}>Danh sách sản phẩm được xem & đặt nhiều nhất</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>SẢN PHẨM / ÁO DÀI</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>GIÁ THUÊ</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>LƯỢT XEM</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>LƯỢT ĐẶT THUÊ</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {beh && beh.popularProducts && beh.popularProducts.length > 0 ? (
                beh.popularProducts.map((prod: any) => (
                  <tr key={prod._id || prod.name} style={{ borderBottom: '1px solid #FAF6F0' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: '#4A0E17' }}>{prod.name}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{prod.basePrice.toLocaleString()}đ</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', color: '#7A7A7A' }}>{prod.viewCount || 0}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 700, color: '#706E3B' }}>{prod.rentCount ?? prod.bookingCount ?? prod.rentedCount ?? prod.count ?? 0} lượt</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#F0FDF4', color: '#166534' }}>
                        Hoạt động
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>
                    Không có sản phẩm nào trong cơ sở dữ liệu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- DETAIL DRAWER RENDERER ---
  const renderDetailDrawer = () => {
    if (!selectedDetailItem) return null;

    if (selectedDetailItem.type === 'CUSTOMER') {
      const c = selectedDetailItem;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #E8E2D5', paddingBottom: '16px' }}>
            <img src={c.avatar} alt={c.fullName} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 750, color: '#4A0E17' }}>{c.fullName}</h3>
              <span style={{ fontSize: '12px', color: '#7A7A7A' }}>ID Khách hàng: {c.id}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Email:</span>
              <strong>{c.email}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Số điện thoại:</span>
              <strong>{c.phone || 'Chưa cung cấp'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Ngày đăng ký:</span>
              <strong>{c.date}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Trạng thái tài khoản:</span>
              <strong style={{ color: c.status === 'ACTIVE' ? '#2B6CB0' : '#E53E3E' }}>
                {c.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã bị khóa (Banned)'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #E8E2D5', paddingTop: '10px' }}>
              <span style={{ color: '#7A7A7A' }}>Số đơn đã đặt:</span>
              <strong>{c.bookings} đơn hàng</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Tổng tiền tích lũy:</span>
              <strong style={{ color: '#4A0E17', fontSize: '16px' }}>{(c.spent || 0).toLocaleString()}đ</strong>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #E8E2D5', paddingTop: '20px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#4A0E17', fontWeight: 700 }}>Nhật ký hoạt động bảo mật</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#7A7A7A' }}>
              <div style={{ padding: '6px', backgroundColor: '#FAF6F0', borderRadius: '4px' }}>• Đăng nhập thành công từ IP 113.161.42.1 (2026-06-29 19:34)</div>
              <div style={{ padding: '6px', backgroundColor: '#FAF6F0', borderRadius: '4px' }}>• Cập nhật thông tin số điện thoại cá nhân (2026-06-25 10:12)</div>
            </div>
          </div>
        </div>
      );
    }

    if (selectedDetailItem.type === 'PROVIDER') {
      const p = selectedDetailItem;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderBottom: '1px solid #E8E2D5', paddingBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 750, color: '#4A0E17' }}>{p.businessName}</h3>
            <span style={{ fontSize: '12px', color: '#7A7A7A' }}>Mã đối tác: {p.id}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Chủ sở hữu:</span>
              <strong>{p.ownerName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Điện thoại liên lạc:</span>
              <strong>{p.phone}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Email doanh nghiệp:</span>
              <strong>{p.email}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Xếp hạng đánh giá:</span>
              <strong style={{ color: '#B89047' }}>★ {p.rating} / 5.0</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Số lượng sản phẩm:</span>
              <strong>{p.totalProducts} tin đăng</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #E8E2D5', paddingTop: '10px' }}>
              <span style={{ color: '#7A7A7A' }}>Tổng doanh thu:</span>
              <strong style={{ color: '#2A2A2A', fontSize: '15px' }}>{(p.totalEarnings || 0).toLocaleString()}đ</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>Trạng thái hoạt động:</span>
              <strong style={{ color: p.status === 'ACTIVE' ? '#166534' : '#991B1B' }}>
                {p.status === 'ACTIVE' ? 'Đang hoạt động bình thường' : 'Tạm đình chỉ hoạt động'}
              </strong>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #E8E2D5', paddingTop: '20px', display: 'flex', gap: '12px' }}>
            <button
              onClick={() => handleSuspendProvider(p.id, p.status === 'ACTIVE')}
              style={{
                flex: 1, padding: '12px', borderRadius: '6px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                backgroundColor: p.status === 'ACTIVE' ? '#4A0E17' : '#706E3B',
                color: 'white'
              }}
            >
              {p.status === 'ACTIVE' ? 'ĐÌNH CHỈ ĐỐI TÁC' : 'KÍCH HOẠT LẠI'}
            </button>
          </div>
        </div>
      );
    }

    if (selectedDetailItem.type === 'VERIFICATION') {
      const v = selectedDetailItem as VerificationItem;
      const isPendingReview = v.status === 'SUBMITTED';
      const isUnderReview = v.status === 'UNDER_REVIEW';

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E8E2D5', paddingBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750, color: '#4A0E17' }}>CHI TIẾT HỒ SƠ ĐĂNG KÝ</h3>
            <span style={{
              padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
              backgroundColor: v.status === 'APPROVED' ? '#F0FDF4' : v.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
              color: v.status === 'APPROVED' ? '#166534' : v.status === 'REJECTED' ? '#991B1B' : '#92400E'
            }}>
              {v.status}
            </span>
          </div>

          {/* Info cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div><span style={{ color: '#7A7A7A' }}>Tên doanh nghiệp/Thương hiệu:</span> <strong style={{ display: 'block', fontSize: '14px', marginTop: '2px', color: '#4A0E17' }}>{v.businessProfile?.businessName}</strong></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><span style={{ color: '#7A7A7A' }}>Chủ sở hữu:</span> <strong style={{ display: 'block' }}>{v.businessProfile?.ownerName}</strong></div>
              <div><span style={{ color: '#7A7A7A' }}>Số điện thoại:</span> <strong style={{ display: 'block' }}>{v.businessProfile?.phone}</strong></div>
            </div>
            <div><span style={{ color: '#7A7A7A' }}>Email:</span> <strong>{v.businessProfile?.email}</strong></div>
            <div><span style={{ color: '#7A7A7A' }}>Địa chỉ:</span> <strong>{v.businessProfile?.address}, {v.businessProfile?.province}</strong></div>
            <div>
              <span style={{ color: '#7A7A7A' }}>Mô tả kinh nghiệm / giới thiệu:</span>
              <p style={{ margin: '4px 0 0 0', padding: '10px', backgroundColor: '#FAF6F0', borderRadius: '6px', fontSize: '12px', color: '#555', fontStyle: 'italic' }}>"{v.businessProfile?.description}"</p>
            </div>
          </div>

          {/* Documents Tabs */}
          <div style={{ borderTop: '1px solid #E8E2D5', paddingTop: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#4A0E17', fontWeight: 700 }}>GIẤY TỜ KHAI BÁO & KẾT QUẢ OCR</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {v.documents?.map((doc, idx) => {
                const ver = doc.versions?.find((version: any) => version.isCurrent) ?? doc.versions?.[0];
                const typeText = verificationDocumentLabels[doc.documentType] ?? doc.documentType;

                const ocrPresentation = getOcrPresentation(ver);
                const canRetryOcr = Boolean(ver) && !ocrPresentation.isProcessing && ['NOT_STARTED', 'OCR_FAILED', 'OCR_LOW_CONFIDENCE'].includes(ver.ocrStatus);

                return (
                  <div
                    key={idx}
                    onClick={() => ver && setSelectedDocPreview({ verificationId: v.verificationId, documentType: doc.documentType, versionNo: ver.versionNo, mimeType: ver.mimeType })}
                    style={{
                      padding: '10px 12px', border: '1px solid #E8E2D5', borderRadius: '6px', cursor: 'pointer',
                      backgroundColor: selectedDocPreview?.documentType === doc.documentType ? '#FFF9F9' : ocrPresentation.background,
                      borderColor: selectedDocPreview?.documentType === doc.documentType ? '#4A0E17' : ocrPresentation.borderColor,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', transition: 'all 0.2s'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '12px', display: 'block', color: '#2A2A2A' }}>{typeText}</strong>
                      {(() => {
                          const idNumber = ocrFieldValue(ver?.extractedFields?.idNumberMasked);
                          const taxCode = ocrFieldValue(ver?.extractedFields?.taxCode);
                          const value = idNumber ?? taxCode;
                          if (!value) return null;
                          return <span style={{ fontSize: '10px', color: '#7A7A7A' }}>{idNumber ? `Số CCCD: ${idNumber}` : `Mã MST: ${taxCode}`}</span>;
                        })()}
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', maxWidth: '180px' }}>
                      <span style={{ padding: '3px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, color: ocrPresentation.color, backgroundColor: ocrPresentation.background, border: `1px solid ${ocrPresentation.borderColor}`, display: 'inline-flex' }}>
                        {ocrPresentation.label}
                      </span>
                      {ocrPresentation.message && (
                        <span title={ocrPresentation.allMessages || ocrPresentation.message} style={{ fontSize: '9px', color: ocrPresentation.color, fontWeight: 600, lineHeight: 1.35 }}>
                          ⚠ {ocrPresentation.message}
                        </span>
                      )}
                      {typeof ver?.ocrConfidence === 'number' && (
                        <span style={{ fontSize: '9px', color: '#667085' }}>Độ tin cậy: {Math.round(ver.ocrConfidence * 100)}%</span>
                      )}
                      {canRetryOcr && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRunVerificationOcr(v.verificationId, doc.documentType);
                          }}
                          style={{ marginTop: '2px', border: '1px solid #706E3B', borderRadius: '4px', backgroundColor: 'white', color: '#706E3B', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {ocrPresentation.retryLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Document Preview Frame */}
          {selectedDocPreview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed #E8E2D5', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#7A7A7A', display: 'flex', alignItems: 'center', gap: '4px' }}><ImageIcon size={14} /> Ảnh phóng to tài liệu:</span>
              <div style={{ display: 'block', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E8E2D5' }}>
                <VerificationDocumentPreview document={selectedDocPreview} />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ borderTop: '1px solid #E8E2D5', paddingTop: '16px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isPendingReview && (
              <button
                onClick={() => handleStartReview(v.verificationId)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#706E3B', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                BẮT ĐẦU ĐÁNH GIÁ HỒ SƠ
              </button>
            )}

            {(isUnderReview || !isPendingReview) && v.status !== 'APPROVED' && v.status !== 'REJECTED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => handleVerificationDecision(v.verificationId, 'approve')}
                  style={{ padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#706E3B', color: 'white', fontWeight: 750, fontSize: '12px', cursor: 'pointer' }}
                >
                  PHÊ DUYỆT (CẤP QUYỀN ĐỐI TÁC)
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={() => handleVerificationDecision(v.verificationId, 'request-changes')}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #B89047', backgroundColor: 'white', color: '#B89047', fontWeight: 750, fontSize: '11px', cursor: 'pointer' }}
                  >
                    YÊU CẦU SỬA ĐỔI
                  </button>
                  <button
                    onClick={() => handleVerificationDecision(v.verificationId, 'reject')}
                    style={{ padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#4A0E17', color: 'white', fontWeight: 750, fontSize: '11px', cursor: 'pointer' }}
                  >
                    TỪ CHỐI HỒ SƠ
                  </button>
                </div>
              </div>
            )}

            {(v.status === 'APPROVED' || v.status === 'REJECTED' || v.status === 'NEEDS_CHANGES') && (
              <div style={{ padding: '10px', backgroundColor: '#FAF6F0', borderRadius: '6px', textAlign: 'center', fontSize: '12px', color: '#7A7A7A', fontWeight: 600 }}>
                Hồ sơ đã được xử lý (Trạng thái: {v.status})
              </div>
            )}
          </div>
        </div>
      );
    }

    if (selectedDetailItem.type === 'DISPUTE') {
      const d = selectedDetailItem as DisputeItem;
      const bookingCode = d.bookingId?.bookingCode || 'N/A';
      const shopName = d.reportedBy?.businessName || d.reportedBy?.fullName || 'Shop';
      const depositTotal = d.isDirectDispute ? d.requestedAmount : (d.bookingId?.pricingSummary?.depositTotal || 0);

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E8E2D5', paddingBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750, color: '#4A0E17' }}>CHI TIẾT TRANH CHẤP ĐƠN {bookingCode}</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>{d.isDirectDispute ? 'Đối tác bị khiếu nại:' : 'Đối tác báo cáo:'}</span> 
              <strong>{shopName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>{d.isDirectDispute ? 'Người mở tranh chấp (Khách):' : 'Khách hàng khiếu nại:'}</span> 
              <strong>{d.bookingId?.customerId?.profile?.fullName || d.bookingId?.customerId?.fullName || 'Khách hàng'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>{d.isDirectDispute ? 'SẢN PHẨM LIÊN QUAN:' : 'SẢN PHẨM HƯ HẠI:'}</span> 
              <strong>{d.productId?.name || d.bookingItemId?.name || 'Sản phẩm'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>{d.isDirectDispute ? 'Tiền tranh chấp đơn hàng:' : 'Yêu cầu đền bù của Shop:'}</span> 
              <strong style={{ color: '#C53030' }}>{d.requestedAmount.toLocaleString()}đ</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7A7A7A' }}>{d.isDirectDispute ? 'Giới hạn quỹ giải quyết:' : 'Tổng cọc giữ đồ của khách:'}</span> 
              <strong style={{ color: '#2B6CB0' }}>{depositTotal.toLocaleString()}đ</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              <span style={{ color: '#7A7A7A' }}>{d.isDirectDispute ? 'Mô tả từ Khách hàng (Lý do từ chối):' : 'Mô tả sự việc từ Shop:'}</span>
              <p style={{ margin: 0, padding: '10px', backgroundColor: '#FFF5F5', borderRadius: '6px', borderLeft: '4px solid #E53E3E', fontSize: '13px', fontStyle: 'italic' }}>
                "{d.description}"
              </p>
            </div>

            {d.bookingId?.deliveryDriveUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '10px 12px' }}>
                <span style={{ color: '#1D4ED8', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔗 Link Kho Ảnh Gốc từ Thợ chụp (Google Drive):
                </span>
                <a
                  href={d.bookingId.deliveryDriveUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#2563EB',
                    fontWeight: 700,
                    fontSize: '13px',
                    wordBreak: 'break-all',
                    textDecoration: 'underline'
                  }}
                >
                  {d.bookingId.deliveryDriveUrl}
                </a>
              </div>
            )}

            {d.bookingId?.deliveredPhotos && d.bookingId.deliveredPhotos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                <span style={{ color: '#7A7A7A', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <ImageIcon size={14} style={{ color: '#1D4ED8' }} /> Ảnh kết quả thợ chụp đã bàn giao ({d.bookingId.deliveredPhotos.length} ảnh):
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {d.bookingId.deliveredPhotos.map((photo: string, idx: number) => (
                    <PrivateEvidenceImage
                      key={idx}
                      reference={photo}
                      legacyUrl={getImageUrl(photo)}
                      alt={`Ảnh bàn giao kết quả ${idx + 1}`}
                      linkStyle={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid #BFDBFE' }}
                      imageStyle={{ width: '65px', height: '65px', objectFit: 'cover' }}
                    />
                  ))}
                </div>
              </div>
            )}

            {d.bookingId?.handoverPhotos && d.bookingId.handoverPhotos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <span style={{ color: '#7A7A7A', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}><ImageIcon size={14} style={{ color: '#706E3B' }} /> Ảnh bàn giao chuẩn bị đồ từ Shop:</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {d.bookingId.handoverPhotos.map((photo: string, idx: number) => (
                    <PrivateEvidenceImage
                      key={idx}
                      reference={photo}
                      legacyUrl={getImageUrl(photo)}
                      alt={`Ảnh bàn giao ${idx + 1}`}
                      linkStyle={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid #E8E2D5' }}
                      imageStyle={{ width: '65px', height: '65px', objectFit: 'cover' }}
                    />
                  ))}
                </div>
              </div>
            )}

            {d.evidencePhotos && d.evidencePhotos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                <span style={{ color: '#7A7A7A', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}><ImageIcon size={14} style={{ color: '#C53030' }} /> Bằng chứng khiếu nại gửi lên (Khách):</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {d.evidencePhotos.map((photo, idx) => (
                    <PrivateEvidenceImage
                      key={idx}
                      reference={photo}
                      legacyUrl={getImageUrl(photo)}
                      alt={`Bằng chứng ${idx + 1}`}
                      linkStyle={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid #E8E2D5' }}
                      imageStyle={{ width: '65px', height: '65px', objectFit: 'cover' }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Resolution */}
          <div style={{ borderTop: '1px solid #E8E2D5', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>GHI CHÚ PHÁN QUYẾT CỦA ADMIN *</span>
              <textarea
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', outline: 'none', resize: 'none', height: '70px', fontFamily: 'inherit' }}
                placeholder="Nhập lý do chi tiết đưa ra phán quyết để thông báo gửi email/SMS tới 2 bên..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                required
              />
            </div>

            <div style={{ padding: '12px', backgroundColor: '#F8F6F1', border: '1px solid #E8E2D5', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#4A0E17', marginBottom: '10px' }}>PHƯƠNG ÁN CHIA TIỀN CỌC</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', color: '#7A7A7A' }}>
                  Hoàn cho khách (VNĐ)
                  <input type="number" min={0} max={depositTotal} value={splitRefundAmount} onChange={(e) => setSplitRefundAmount(Number(e.target.value))} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #E8E2D5' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', color: '#7A7A7A' }}>
                  Bồi thường Shop (VNĐ)
                  <input type="number" min={0} max={depositTotal} value={splitCompensationAmount} onChange={(e) => setSplitCompensationAmount(Number(e.target.value))} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #E8E2D5' }} />
                </label>
              </div>
              <div style={{ marginTop: '8px', fontSize: '11px', color: splitRefundAmount + splitCompensationAmount > depositTotal ? '#C53030' : '#7A7A7A' }}>
                Đã phân bổ {(splitRefundAmount + splitCompensationAmount).toLocaleString()}đ / {depositTotal.toLocaleString()}đ tiền cọc
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleResolveDispute('SHOP_RIGHT')}
                disabled={resolving}
                style={{ flex: 1, padding: '12px 8px', backgroundColor: '#4A0E17', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}
              >
                SHOP ĐÚNG (ĐỀN BÙ)
              </button>
              <button
                onClick={() => handleResolveDispute('CUSTOMER_RIGHT')}
                disabled={resolving}
                style={{ flex: 1, padding: '12px 8px', backgroundColor: '#706E3B', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}
              >
                KHÁCH ĐÚNG (HOÀN CỌC)
              </button>
              <button
                onClick={() => handleResolveDispute('SPLIT')}
                disabled={resolving}
                style={{ flex: 1, padding: '12px 8px', backgroundColor: '#2B6CB0', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}
              >
                CHIA TIỀN
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#FAF6F0', fontFamily: 'var(--font-body)' }}>

      {/* SIDEBAR */}
      <div style={{ width: '280px', backgroundColor: '#4A0E17', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'white', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', borderRight: '1px solid #3E0B12' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', marginBottom: '16px' }}>
          {/* Logo brand */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '32px', flexShrink: 0 }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: 'white', letterSpacing: '0.02em', fontFamily: 'var(--font-header)' }}>Di sản Áo Dài</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#F3C06B', letterSpacing: '0.18em', marginTop: '2px' }}>CURATING ELEGANCE • ADMIN</span>
          </div>

          {/* User Profile Card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', marginBottom: '28px', border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <img src={user?.avatar || '/avatar_hanna.png'} alt="Admin" style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #F3C06B', objectFit: 'cover' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '13px', color: 'white' }}>{user?.fullName || 'Hanna Nguyễn'}</strong>
              <span style={{ fontSize: '10px', color: '#F3C06B', fontWeight: 600 }}>Quản Trị Viên Hệ Thống</span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1, paddingRight: '4px', scrollbarWidth: 'thin', scrollbarColor: '#B89047 transparent' }}>
            {[
              { id: 'overview', label: 'Tổng quan hệ thống', icon: LayoutDashboard },
              { id: 'customers', label: 'Quản lý Khách hàng', icon: Users },
              { id: 'providers', label: 'Quản lý Đối tác', icon: Store },
              { id: 'categories', label: 'Quản lý Danh mục', icon: Layers },
              { id: 'bookings', label: 'Lịch trình & Đặt lịch', icon: Calendar },
              { id: 'settlements', label: 'Đối soát & Quyết toán', icon: DollarSign },
              { id: 'revenue', label: 'Báo cáo Doanh thu', icon: TrendingUp },
              { id: 'verifications', label: 'Phê duyệt hồ sơ đối tác', icon: FileCheck },
              { id: 'disputes', label: 'Giải quyết tranh chấp', icon: AlertTriangle },
              { id: 'product-moderation', label: 'Kiểm duyệt sản phẩm', icon: CheckSquare },
              { id: 'combo-moderation', label: 'Phê duyệt Combo', icon: Tag },
              { id: 'reported-reviews', label: 'Báo cáo Đánh giá (Spam)', icon: Ban },
              { id: 'policies', label: 'Cấu hình Chính sách', icon: Settings },
              { id: 'users-roles', label: 'Tài khoản & Phân quyền', icon: ShieldCheck },
              { id: 'behavior', label: 'Phân tích hành vi', icon: BarChart3 },
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 16px',
                    border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: isActive ? 700 : 500,
                    backgroundColor: isActive ? 'white' : 'transparent',
                    color: isActive ? '#4A0E17' : '#E8E2D5',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  <Icon size={16} color={isActive ? '#4A0E17' : '#B89047'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button onClick={() => setActiveTab('refunds')} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 16px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: activeTab === 'refunds' ? 700 : 500, backgroundColor: activeTab === 'refunds' ? 'white' : 'transparent', color: activeTab === 'refunds' ? '#4A0E17' : '#E8E2D5', cursor: 'pointer', textAlign: 'left' }}><DollarSign size={16} color="#B89047" /><span>Quản lý hoàn tiền</span></button>
          </nav>
        </div>

        {/* Sidebar Footer — Home & Logout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 16px',
              border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
              backgroundColor: 'transparent', color: '#E8E2D5',
              cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' as const
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#B89047'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#E8E2D5'; }}
          >
            <Home size={16} color="#B89047" />
            <span>Trở về Trang chủ</span>
          </button>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 16px',
              border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
              backgroundColor: 'transparent', color: '#E8E2D5',
              cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' as const
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.08)'; e.currentTarget.style.color = '#F87171'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#E8E2D5'; }}
          >
            <LogOut size={16} color="#F87171" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* RIGHT MAIN VIEW */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>

        {/* HEADER */}
        <header style={{ height: '70px', backgroundColor: 'white', borderBottom: '1px solid #E8E2D5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#4A0E17', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {activeTab === 'overview' ? 'Tổng quan hệ thống' :
                activeTab === 'customers' ? 'Quản lý Khách hàng' :
                  activeTab === 'providers' ? 'Quản lý Đối tác & Nhà cung cấp' :
                    activeTab === 'categories' ? 'Quản lý Danh mục Dịch vụ' :
                      activeTab === 'bookings' ? 'Quản lý Lịch trình & Booking' :
                        activeTab === 'settlements' ? 'Đối soát & Quyết toán Tài chính' :
                          activeTab === 'revenue' ? 'Thống kê Doanh thu Hệ thống' :
                            activeTab === 'verifications' ? 'Phê duyệt hồ sơ đăng ký đối tác' :
                              activeTab === 'behavior' ? 'Phân tích hành vi người dùng' :
                                activeTab === 'product-moderation' ? 'Kiểm duyệt nội dung sản phẩm' :
                                    activeTab === 'reported-reviews' ? 'Báo cáo vi phạm & Spam Đánh giá' :
                                      activeTab === 'combo-moderation' ? 'Phê duyệt Combo Khuyến mãi' :
                                        activeTab === 'policies' ? 'Cấu hình Chính sách Hệ thống' :
                                          activeTab === 'users-roles' ? 'Tài khoản & Quản trị Phân quyền' :
                                            'Giải quyết tranh chấp sự cố'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative' }} ref={notiRef}>
              <button
                onClick={() => {
                  setIsNotiOpen(!isNotiOpen);
                  if (!isNotiOpen) {
                    fetchVerifications();
                    fetchDisputes();
                    fetchReportedReviews();
                  }
                }}
                style={{ border: 'none', background: 'none', color: '#7A7A7A', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Thông báo"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    backgroundColor: '#4A0E17', color: 'white',
                    borderRadius: '50%', minWidth: '16px', height: '16px',
                    fontSize: '9px', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', boxShadow: '0 1px 4px rgba(74,14,23,0.4)'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {isNotiOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 12px)', right: '-60px',
                  width: '380px', maxHeight: '480px',
                  backgroundColor: 'white', borderRadius: '12px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
                  zIndex: 999, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column'
                }}>
                  {/* Dropdown Header */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #FAF6F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAF6F0' }}>
                    <span style={{ fontWeight: 800, color: '#4A0E17', fontSize: '14px' }}>Cần xử lý ({unreadCount})</span>
                    {unreadCount > 0 && (
                      <span style={{ fontSize: '11px', color: '#B89047', fontWeight: 700 }}>Hành động cần Admin duyệt</span>
                    )}
                  </div>

                  {/* Dropdown List */}
                  <div style={{ overflowY: 'auto', flex: 1, maxHeight: '380px' }}>
                    {unreadCount === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#7A7A7A', fontSize: '13px' }}>
                        <Bell size={24} style={{ color: '#E8E2D5', marginBottom: '8px' }} />
                        <div>Không có thông báo mới nào cần xử lý.</div>
                      </div>
                    ) : (
                      adminNotificationsList.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.tab);
                            setIsNotiOpen(false);
                          }}
                          style={{
                            padding: '14px 20px',
                            borderBottom: '1px solid #FAF6F0',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF6F0'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '12.5px', color: '#4A0E17', fontWeight: 750 }}>{item.title}</strong>
                            <span style={{
                              fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                              backgroundColor: item.type === 'verification' ? '#F0FDF4' : item.type === 'dispute' ? '#FEF3C7' : '#FEE2E2',
                              color: item.type === 'verification' ? '#166534' : item.type === 'dispute' ? '#92400E' : '#991B1B'
                            }}>
                              {item.type === 'verification' ? 'HỒ SƠ' : item.type === 'dispute' ? 'TRANH CHẤP' : 'ĐÁNH GIÁ'}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '12px', color: '#555555', lineHeight: '1.4' }}>{item.desc}</p>
                          {item.date && (
                            <span style={{ fontSize: '10px', color: '#A0A0A0', display: 'block', marginTop: '6px' }}>
                              {new Date(item.date).toLocaleString('vi-VN')}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{
                    padding: '10px 16px', borderTop: '1px solid #FAF6F0',
                    textAlign: 'center', backgroundColor: '#FAF6F0'
                  }}>
                    <button
                      type="button"
                      onClick={() => { setIsNotiOpen(false); setActiveTab('notifications'); }}
                      style={{
                        background: 'none', border: 'none', color: '#4A0E17',
                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                        padding: '4px 12px', borderRadius: '4px', transition: 'all 0.15s'
                      }}
                      onMouseOver={e => { e.currentTarget.style.color = '#B89047'; }}
                      onMouseOut={e => { e.currentTarget.style.color = '#4A0E17'; }}
                    >
                      Xem tất cả thông báo hệ thống →
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#E8E2D5' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={user?.avatar || '/avatar_hanna.png'} alt="Admin" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#2A2A2A' }}>{user?.fullName || 'Admin'}</span>
            </div>
          </div>
        </header>

        {/* WORKSPACE & LAYOUT */}
        <div style={{ padding: '32px', display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>

          {/* Active Tab Panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', flexDirection: 'column', gap: '12px' }}>
                <div style={{ border: '3px solid #E8E2D5', borderTop: '3px solid #4A0E17', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '14px', color: '#7A7A7A', fontWeight: 600 }}>Đang tải dữ liệu từ máy chủ NestJS...</span>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'customers' && renderCustomersTab()}
                {activeTab === 'providers' && renderProvidersTab()}
                {activeTab === 'categories' && <CategoryManagement />}
                {activeTab === 'bookings' && renderBookingsTab()}
                {activeTab === 'settlements' && <SettlementManagement />}
                {activeTab === 'refunds' && <RefundManagement />}
                {activeTab === 'revenue' && renderRevenueTab()}
                {activeTab === 'verifications' && renderVerificationsTab()}
                {activeTab === 'disputes' && renderDisputesTab()}
                {activeTab === 'behavior' && renderBehaviorTab()}
                {activeTab === 'product-moderation' && <><ProductModerationManagement /><PortfolioModerationManagement /></>}
                {activeTab === 'reported-reviews' && renderReportedReviewsTab()}
                {activeTab === 'combo-moderation' && <ComboModerationManagement />}
                {activeTab === 'policies' && <PolicyManagement />}
                {activeTab === 'users-roles' && <AccessControl />}
                {activeTab === 'notifications' && <NotificationsPage hideBreadcrumb variant="admin" />}
              </>
            )}
          </div>

          {/* Collapsible Detail Drawer on the Right */}
          {selectedDetailItem && (
            <div style={{
              width: '360px', backgroundColor: 'white', border: '1px solid #E8E2D5', borderRadius: '12px',
              padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', position: 'sticky', top: '94px', height: 'fit-content',
              flexShrink: 0, display: 'flex', flexDirection: 'column', animation: 'fadeInScale 0.25s ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
                <button
                  onClick={() => { setSelectedDetailItem(null); setSelectedDocPreview(null); }}
                  style={{ background: 'none', border: 'none', fontSize: '18px', color: '#7A7A7A', cursor: 'pointer', padding: '4px' }}
                >
                  ✕
                </button>
              </div>
              {renderDetailDrawer()}
              <style>{`
                @keyframes fadeInScale {
                  from { opacity: 0; transform: scale(0.96); }
                  to { opacity: 1; transform: scale(1); }
                }
              `}</style>
            </div>
          )}

          <Modal
            isOpen={Boolean(migrationLocationItem)}
            onClose={() => { if (!resolvingRentalMigrationItem) { setMigrationLocationItem(null); setMigrationLocation(null); } }}
            title="Xác minh điểm nhận và trả áo dài"
            maxWidth="840px"
          >
            <p style={{ marginTop: 0, color: '#78350F', fontSize: '13px', lineHeight: 1.5 }}>
              Chỉ dùng điểm đã đối chiếu từ dữ liệu vận hành thực tế. MVP dùng cùng một điểm cho nhận và trả áo dài; thao tác này không tạo bằng chứng nhận/trả.
            </p>
            <PhotographyLocationPicker
              value={migrationLocation}
              onSelect={setMigrationLocation}
              title="Điểm nhận và trả đã xác minh"
              hint="Tìm địa chỉ, kéo pin chính xác, sau đó bấm “Xác nhận pin” trước khi lưu."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button type="button" className="vh-btn vh-btn-secondary" disabled={Boolean(resolvingRentalMigrationItem)} onClick={() => { setMigrationLocationItem(null); setMigrationLocation(null); }}>Hủy</button>
              <button type="button" className="vh-btn vh-btn-primary" disabled={!migrationLocation || Boolean(resolvingRentalMigrationItem)} onClick={() => void resolveLegacyLocation()}>{resolvingRentalMigrationItem ? 'Đang lưu…' : 'Lưu điểm và migrate'}</button>
            </div>
          </Modal>
          {/* Booking Details Modal */}
          <BookingDetailModal
            bookingId={selectedBookingId}
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            onCustomerClick={(_custId) => {
              setIsDetailModalOpen(false);
              setActiveTab('customers');
            }}
          />
        </div>
      </div>
    </div>
  );
};

class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AdminDashboardPage] Render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: '16px', backgroundColor: '#FAF6F0', fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h2 style={{ color: '#4A0E17', margin: 0 }}>Lỗi hiển thị trang Admin</h2>
          <pre style={{
            backgroundColor: '#fff', border: '1px solid #E8E2D5', borderRadius: '8px',
            padding: '16px', fontSize: '12px', color: '#C53030', maxWidth: '700px',
            overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack?.slice(0, 800)}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '10px 24px', backgroundColor: '#4A0E17', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700
            }}
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AdminDashboardPageWithBoundary: React.FC = () => (
  <AdminErrorBoundary>
    <AdminDashboardPage />
  </AdminErrorBoundary>
);

export default AdminDashboardPageWithBoundary;
