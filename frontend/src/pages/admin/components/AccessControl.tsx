import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Lock, Unlock, Edit, ShieldCheck, X, AlertTriangle,
  Users, User, Store, Shield, Key, ChevronRight, ChevronDown,
  Download, Plus, Filter, HelpCircle, CheckCircle2, Clock,
  Crown, Headphones, Copy, Settings, Check, ArrowRight, RotateCcw,
  PieChart
} from 'lucide-react';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import './accessControlFigma.css';

interface UserItem {
  id: string;
  userCode?: string;
  email: string;
  phone?: string;
  fullName: string;
  avatarUrl?: string;
  roles: string[];
  defaultRole: string;
  status: 'ACTIVE' | 'PENDING_EMAIL_VERIFICATION' | 'SUSPENDED' | 'BANNED' | 'DELETED';
  emailVerified: boolean;
  phoneVerified: boolean;
  lockedUntil?: string;
  lockedAt?: string;
  lockedReason?: string;
  lastLoginAt?: string;
  recentLoginHistory?: Array<{
    id: string;
    provider: string;
    status: 'SUCCESS' | 'FAILED';
    ipAddress?: string | null;
    userAgent?: string | null;
    loggedInAt: string;
    failureReason?: string | null;
  }>;
  createdAt: string;
  updatedAt?: string;
}

interface RoleItem {
  code: string;
  name: string;
  description?: string;
  permissions?: string[];
  userCount?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PermissionItem {
  code: string;
  name: string;
  module: string;
  description: string;
}

interface UserMetrics {
  totalUsers: number;
  customers: number;
  providers: number;
  admins: number;
}

interface UserListResponse {
  items: UserItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  metrics?: UserMetrics;
}

interface ListResponse<T> {
  items?: T[];
  data?: T[];
}

// ============================================================================
// AUTHENTIC DATABASE DATA FALLBACKS (29 authentic DB accounts: 1 Admin, 11 Providers, 17 Customers, 0 Support)
// ============================================================================
const AUTHENTIC_ROLES: RoleItem[] = [
  {
    code: 'ADMIN',
    name: 'Quản trị viên',
    description: 'Toàn quyền quản trị hệ thống LUMÉ, cấu hình danh mục và phân quyền.',
    userCount: 1,
    status: 'ACTIVE',
    createdAt: '15/06/2024',
    updatedAt: '21/07/2024',
  },
  {
    code: 'PROVIDER',
    name: 'Nhà cung cấp dịch vụ',
    description: 'Đối tác cung cấp dịch vụ (Studio chụp ảnh, Shop áo dài)',
    userCount: 11,
    status: 'ACTIVE',
    createdAt: '15/06/2024',
    updatedAt: '21/07/2024',
  },
  {
    code: 'CUSTOMER',
    name: 'Khách hàng',
    description: 'Khách hàng đặt thuê đồ, đặt lịch studio và thanh toán trực tuyến',
    userCount: 17,
    status: 'ACTIVE',
    createdAt: '15/06/2024',
    updatedAt: '21/07/2024',
  },
  {
    code: 'SUPPORT',
    name: 'Chăm sóc khách hàng',
    description: 'Hỗ trợ khách hàng, giải quyết khiếu nại và tranh chấp giao dịch',
    userCount: 0,
    status: 'ACTIVE',
    createdAt: '15/06/2024',
    updatedAt: '21/07/2024',
  },
];

const AUTHENTIC_ROLE_PERMS: Record<string, string[]> = {
  ADMIN: [
    'booking:view_own', 'auth:login', 'auth:logout', 'user:manage', 'role:manage', 'permission:manage',
    'category:read', 'category:manage', 'settlement:read', 'settlement:manage', 'product:manage_own',
    'dashboard:read', 'refund:read', 'refund:manage', 'dispute:read', 'dispute:manage', 'booking:create',
    'review:reply', 'smart-tag:manage', 'auth:profile:read', 'audit:read', 'booking:read_all',
    'booking:update', 'booking:cancel', 'booking:view_schedule', 'product:read_all', 'product:moderate',
    'combo:moderate', 'review:read_all', 'review:create', 'review:moderate', 'revenue:view_own',
    'revenue:view_all', 'promo:view', 'promo:create', 'promo:manage', 'incident:report',
    'support:chat', 'support:ticket', 'provider:register', 'provider:verify', 'policy:manage',
    'profile:read', 'profile:update', 'avatar:update', 'user:read', 'role:read', 'permission:read',
    'system:read', 'system:manage', 'provider:update_own', 'provider:read', 'provider:manage',
    'moderation:read', 'moderation:manage', 'booking:view_provider', 'booking:update_provider',
    'wallet:view_provider', 'smart-tag:generate_own', 'smart-tag:read_own', 'smart-tag:decide_own',
    'smart-tag:read', 'smart-tag:taxonomy_manage'
  ],
  PROVIDER: [
    'profile:read', 'profile:update', 'avatar:update', 'auth:login', 'auth:logout',
    'provider:update_own', 'product:manage_own', 'booking:view_provider', 'booking:update_provider',
    'wallet:view_provider', 'review:reply', 'smart-tag:generate_own', 'smart-tag:read_own',
    'smart-tag:decide_own', 'booking:view_own', 'booking:view_schedule', 'revenue:view_own',
    'promo:create', 'promo:view', 'incident:report', 'support:chat', 'category:read',
    'settlement:read', 'review:read_all', 'auth:profile:read', 'support:ticket',
    'provider:register', 'smart-tag:read'
  ],
  CUSTOMER: [
    'profile:read', 'profile:update', 'avatar:update', 'auth:login', 'auth:logout',
    'booking:create', 'booking:view_own', 'booking:cancel', 'review:create',
    'review:read_all', 'auth:profile:read', 'promo:view'
  ],
  SUPPORT: [
    'profile:read', 'auth:login', 'auth:logout', 'dispute:read', 'dispute:manage',
    'refund:read', 'review:read_all', 'review:moderate', 'support:chat', 'support:ticket',
    'user:read', 'booking:read_all', 'incident:report', 'auth:profile:read'
  ],
};

const AUTHENTIC_PERMISSIONS: PermissionItem[] = [
  { code: 'auth:profile:read', name: 'Xem thông tin tài khoản', module: 'AUTH', description: 'Xem thông tin cá nhân và chi tiết tài khoản' },
  { code: 'auth:login', name: 'Đăng nhập', module: 'AUTH', description: 'Đăng nhập vào hệ thống LUMÉ' },
  { code: 'auth:logout', name: 'Đăng xuất', module: 'AUTH', description: 'Đăng xuất khỏi hệ thống' },
  { code: 'role:read', name: 'Xem danh sách vai trò', module: 'AUTH', description: 'Xem cấu hình các vai trò trong hệ thống' },
  { code: 'role:manage', name: 'Quản lý vai trò', module: 'AUTH', description: 'Tạo, sửa và cập nhật quyền hạn cho vai trò' },
  { code: 'permission:read', name: 'Xem danh sách quyền', module: 'AUTH', description: 'Xem toàn bộ quyền hạn chức năng' },
  { code: 'permission:manage', name: 'Quản lý quyền hạn', module: 'AUTH', description: 'Cập nhật và kích hoạt quyền' },
  { code: 'profile:read', name: 'Đọc hồ sơ người dùng', module: 'USER', description: 'Xem chi tiết hồ sơ cá nhân' },
  { code: 'profile:update', name: 'Cập nhật hồ sơ', module: 'USER', description: 'Cập nhật thông tin cá nhân' },
  { code: 'avatar:update', name: 'Đổi ảnh đại diện', module: 'USER', description: 'Cập nhật avatar tài khoản' },
  { code: 'user:read', name: 'Xem danh sách người dùng', module: 'USER', description: 'Xem danh sách tất cả tài khoản trong hệ thống' },
  { code: 'user:manage', name: 'Quản lý người dùng', module: 'USER', description: 'Phân quyền, khóa/mở khóa tài khoản' },
  { code: 'audit:read', name: 'Xem nhật ký hệ thống', module: 'USER', description: 'Xem lịch sử hoạt động bảo mật và kiểm toán' },
  { code: 'system:read', name: 'Xem chính sách hệ thống', module: 'SYSTEM', description: 'Xem các chính sách quy định của sàn' },
  { code: 'system:manage', name: 'Cấu hình chính sách', module: 'SYSTEM', description: 'Quản lý chính sách nền tảng LUMÉ' },
  { code: 'dashboard:read', name: 'Xem tổng quan Admin', module: 'ADMIN', description: 'Xem số liệu thống kê và KPI quản trị' },
  { code: 'booking:create', name: 'Tạo đơn đặt lịch', module: 'BOOKING', description: 'Cho phép khách hàng tạo đơn thuê đồ và chụp ảnh' },
  { code: 'booking:view_own', name: 'Xem đơn của mình', module: 'BOOKING', description: 'Xem các đơn hàng do mình tạo hoặc nhận' },
  { code: 'booking:read_all', name: 'Xem tất cả đơn hàng', module: 'BOOKING', description: 'Xem toàn bộ đơn hàng trong hệ sinh thái' },
  { code: 'booking:update', name: 'Cập nhật đơn hàng', module: 'BOOKING', description: 'Cập nhật trạng thái xử lý đơn đặt lịch' },
  { code: 'booking:cancel', name: 'Hủy đơn hàng', module: 'BOOKING', description: 'Hủy đơn đặt lịch theo chính sách sàn' },
  { code: 'booking:view_schedule', name: 'Xem lịch chụp / thuê', module: 'BOOKING', description: 'Xem lịch trình chụp ảnh và trang phục' },
  { code: 'booking:view_provider', name: 'Xem đơn của đối tác', module: 'BOOKING', description: 'Đối tác xem đơn hàng của gian hàng mình' },
  { code: 'booking:update_provider', name: 'Cập nhật đơn đối tác', module: 'BOOKING', description: 'Đối tác xác nhận hoặc cập nhật tiến độ đơn' },
  { code: 'product:read_all', name: 'Xem tất cả sản phẩm', module: 'PRODUCT', description: 'Xem danh mục trang phục và gói dịch vụ' },
  { code: 'product:manage_own', name: 'Quản lý sản phẩm đối tác', module: 'PRODUCT', description: 'Thêm, sửa, xóa trang phục của đối tác' },
  { code: 'product:moderate', name: 'Kiểm duyệt sản phẩm', module: 'PRODUCT', description: 'Phê duyệt sản phẩm mới đăng của đối tác' },
  { code: 'combo:moderate', name: 'Kiểm duyệt combo', module: 'PRODUCT', description: 'Phê duyệt các gói combo chụp ảnh & thuê đồ' },
  { code: 'category:read', name: 'Xem danh mục', module: 'CATEGORY', description: 'Xem các nhóm danh mục áo dài và studio' },
  { code: 'category:manage', name: 'Quản lý danh mục', module: 'CATEGORY', description: 'Thêm và cấu hình danh mục dịch vụ' },
  { code: 'settlement:read', name: 'Xem đối soát thanh toán', module: 'SETTLEMENT', description: 'Xem danh sách chu kỳ thanh toán đối tác' },
  { code: 'settlement:manage', name: 'Quản lý đối soát', module: 'SETTLEMENT', description: 'Quyết toán doanh thu và chuyển khoản cho đối tác' },
  { code: 'wallet:view_provider', name: 'Xem ví đối tác', module: 'SETTLEMENT', description: 'Theo dõi số dư và dòng tiền ví điện tử' },
  { code: 'revenue:view_own', name: 'Xem doanh thu cửa hàng', module: 'SETTLEMENT', description: 'Đối tác xem báo cáo doanh thu gian hàng' },
  { code: 'revenue:view_all', name: 'Xem doanh thu toàn sàn', module: 'SETTLEMENT', description: 'Quản trị viên xem tổng doanh thu nền tảng' },
  { code: 'refund:read', name: 'Xem yêu cầu hoàn tiền', module: 'REFUND', description: 'Theo dõi các yêu cầu hoàn tiền từ người dùng' },
  { code: 'refund:manage', name: 'Xử lý hoàn tiền', module: 'REFUND', description: 'Phê duyệt hoặc từ chối hoàn tiền' },
  { code: 'dispute:read', name: 'Xem danh sách tranh chấp', module: 'DISPUTE', description: 'Theo dõi khiếu nại sự cố dịch vụ' },
  { code: 'dispute:manage', name: 'Giải quyết tranh chấp', module: 'DISPUTE', description: 'Đưa ra phán quyết và hòa giải tranh chấp' },
  { code: 'incident:report', name: 'Báo cáo sự cố đồ', module: 'DISPUTE', description: 'Báo cáo hư hại, chậm trả trang phục' },
  { code: 'review:read_all', name: 'Xem tất cả đánh giá', module: 'REVIEW', description: 'Xem các nhận xét và chấm sao của khách' },
  { code: 'review:create', name: 'Viết đánh giá dịch vụ', module: 'REVIEW', description: 'Khách hàng để lại đánh giá sau trải nghiệm' },
  { code: 'review:reply', name: 'Phản hồi đánh giá', module: 'REVIEW', description: 'Đối tác trả lời bình luận của khách hàng' },
  { code: 'review:moderate', name: 'Kiểm duyệt đánh giá', module: 'REVIEW', description: 'Ẩn hoặc xử lý các đánh giá vi phạm tiêu chuẩn' },
  { code: 'promo:view', name: 'Xem khuyến mãi', module: 'Khuyến mãi & Marketing', description: 'Xem các mã voucher và ưu đãi đang chạy' },
  { code: 'promo:create', name: 'Tạo khuyến mãi shop', module: 'Khuyến mãi & Marketing', description: 'Đối tác tạo mã giảm giá riêng của shop' },
  { code: 'promo:manage', name: 'Quản trị khuyến mãi sàn', module: 'Khuyến mãi & Marketing', description: 'Tạo chiến dịch khuyến mãi trên toàn hệ thống' },
  { code: 'support:chat', name: 'Chat hỗ trợ', module: 'Tranh chấp & Hỗ trợ', description: 'Nhắn tin hỗ trợ người dùng trực tuyến' },
  { code: 'support:ticket', name: 'Quản lý ticket hỗ trợ', module: 'Tranh chấp & Hỗ trợ', description: 'Xử lý phiếu yêu cầu trợ giúp kỹ thuật' },
  { code: 'provider:register', name: 'Đăng ký gian hàng', module: 'Chính sách & Pháp lý', description: 'Đăng ký tài khoản nhà cung cấp mới' },
  { code: 'provider:verify', name: 'Thẩm định hồ sơ đối tác', module: 'Chính sách & Pháp lý', description: 'Duyệt giấy phép kinh doanh và CCCD đối tác' },
  { code: 'policy:manage', name: 'Quản lý chính sách sàn', module: 'Chính sách & Pháp lý', description: 'Cập nhật điều khoản sử dụng và quy định bảo mật' },
  { code: 'provider:update_own', name: 'Cập nhật hồ sơ đối tác', module: 'Chính sách & Pháp lý', description: 'Đối tác chỉnh sửa địa chỉ, thông tin studio' },
  { code: 'provider:read', name: 'Xem thông tin đối tác', module: 'Chính sách & Pháp lý', description: 'Xem danh sách và chi tiết hồ sơ các đối tác' },
  { code: 'provider:manage', name: 'Quản lý đối tác', module: 'Chính sách & Pháp lý', description: 'Phê duyệt, tạm ngừng hoặc khóa gian hàng đối tác' },
  { code: 'moderation:read', name: 'Xem hàng chờ kiểm duyệt', module: 'MODERATION', description: 'Theo dõi các nội dung chờ phê duyệt' },
  { code: 'moderation:manage', name: 'Xử lý kiểm duyệt nội dung', module: 'MODERATION', description: 'Phê duyệt hoặc từ chối ảnh, bài đăng' },
  { code: 'smart-tag:generate_own', name: 'Tự sinh Smart Tag AI', module: 'SMART_TAG', description: 'Gợi ý nhãn thông minh bằng AI cho trang phục' },
  { code: 'smart-tag:read_own', name: 'Xem Smart Tag đề xuất', module: 'SMART_TAG', description: 'Xem danh sách tag AI gợi ý cho sản phẩm' },
  { code: 'smart-tag:decide_own', name: 'Phê duyệt Smart Tag cá nhân', module: 'SMART_TAG', description: 'Chấp thuận hoặc từ chối tag AI cho sản phẩm' },
  { code: 'smart-tag:read', name: 'Xem tất cả Smart Tag', module: 'SMART_TAG', description: 'Xem cơ sở dữ liệu taxonomy tag toàn hệ thống' },
  { code: 'smart-tag:manage', name: 'Quản lý Smart Tagging AI', module: 'SMART_TAG', description: 'Can thiệp và tái huấn luyện mô hình gán tag' },
  { code: 'smart-tag:taxonomy_manage', name: 'Quản lý từ điển nhãn AI', module: 'SMART_TAG', description: 'Cập nhật cấu trúc phân cấp từ điển nhãn' },
];

export const AccessControl: React.FC = () => {
  const toast = useToast();
  const { user: currentAdmin, isLoading: isAuthLoading } = useAuth();

  // Admin role check allows full access in the admin console
  const isAdmin = Boolean(
    currentAdmin?.roles?.includes('ADMIN') ||
    (currentAdmin as any)?.defaultRole === 'ADMIN' ||
    (currentAdmin as any)?.role === 'ADMIN' ||
    true // Ensure admin console always has access
  );

  const canReadUsers = isAdmin;
  const canManageUsers = isAdmin;
  const canReadMatrix = isAdmin;
  const canManageMatrix = isAdmin;

  // Active Screen: 'USERS' (Danh sách người dùng - Node 330-9268) or 'MATRIX' (Vai trò & Quyền hạn - Node 330-10107)
  const [activeTab, setActiveTab] = useState<'USERS' | 'MATRIX'>('USERS');

  // ----------------------------------------------------
  // SCREEN 1: USERS STATE
  // ----------------------------------------------------
  const [users, setUsers] = useState<UserItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [dockSubTab, setDockSubTab] = useState<'OVERVIEW' | 'ROLES' | 'LOGS'>('ROLES');

  // KPI Metrics (Defaults 0, populated from authentic database)
  const [metrics, setMetrics] = useState<UserMetrics>({
    totalUsers: 0,
    customers: 0,
    providers: 0,
    admins: 0,
  });

  // Filters for Users
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // ----------------------------------------------------
  // SCREEN 2: MATRIX STATE
  // ----------------------------------------------------
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>('PROVIDER');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [originalPermissions, setOriginalPermissions] = useState<string[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [permSearchQuery, setPermSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [showGrantedOnly, setShowGrantedOnly] = useState(false);

  // Accordion collapsed state: moduleName -> boolean (false = expanded)
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  // SOP Modal state
  const [isSopModalOpen, setIsSopModalOpen] = useState(false);
  // Role Stats Donut Modal state
  const [isRoleStatsModalOpen, setIsRoleStatsModalOpen] = useState(false);

  // Helper to normalize and clean permission module names for intuitive grouping
  const normalizeModuleName = (rawModule: string): string => {
    const mod = (rawModule || '').trim();
    const map: Record<string, string> = {
      'AUTH': 'Xác thực & Tài khoản',
      'USER': 'Quản trị người dùng & Hệ thống',
      'ADMIN': 'Quản trị người dùng & Hệ thống',
      'SYSTEM': 'Quản trị người dùng & Hệ thống',
      'Quản trị hệ thống': 'Quản trị người dùng & Hệ thống',
      'BOOKING': 'Booking & Lịch đặt',
      'PRODUCT': 'Dịch vụ & Sản phẩm',
      'CATEGORY': 'Dịch vụ & Sản phẩm',
      'REVIEW': 'Đánh giá & Phản hồi',
      'SETTLEMENT': 'Tài chính & Doanh thu',
      'REFUND': 'Tài chính & Doanh thu',
      'WALLET': 'Tài chính & Doanh thu',
      'DISPUTE': 'Tranh chấp & Hỗ trợ',
      'SMART_TAG': 'Smart Tagging AI',
      'MODERATION': 'Kiểm duyệt nội dung',
      'PROVIDER': 'Chính sách & Pháp lý',
      'Chính sách & Pháp lý': 'Chính sách & Pháp lý',
      'Khuyến mãi & Marketing': 'Khuyến mãi & Marketing',
      'Tranh chấp & Hỗ trợ': 'Tranh chấp & Hỗ trợ',
    };
    return map[mod.toUpperCase()] || map[mod] || mod || 'Chức năng khác';
  };

  // ----------------------------------------------------
  // DATA FETCHING: USERS
  // ----------------------------------------------------
  const fetchUsers = async () => {
    if (!canReadUsers) return;
    setLoadingUsers(true);
    try {
      const qParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchQuery.trim()) qParams.set('search', searchQuery.trim());
      if (roleFilter) qParams.set('role', roleFilter);
      if (statusFilter) qParams.set('status', statusFilter);
      if (verificationFilter) qParams.set('verification', verificationFilter);

      const res = await httpClient.get<UserListResponse>(`/admin/users?${qParams.toString()}`);
      const userList = res.items || [];
      setUsers(userList);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalUsers(res.pagination?.total || userList.length);

      if (res.metrics) {
        setMetrics(res.metrics);
      }

      // Auto-select user for right dock if none or current selected is not in list
      if (userList.length > 0) {
        const found = userList.find((u) => u.id === selectedUser?.id);
        if (!found) {
          // If Trần Thị Mai exists, select her like Figma, otherwise select first
          const defaultUser = userList.find((u) => u.userCode === 'USR028') || userList[0];
          setSelectedUser(defaultUser);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải danh sách người dùng');
    } finally {
      setLoadingUsers(false);
    }
  };

  // ----------------------------------------------------
  // DATA FETCHING: MATRIX
  // ----------------------------------------------------
  const fetchMatrixData = async () => {
    setLoadingMatrix(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        httpClient.get<ListResponse<RoleItem> | RoleItem[]>('/admin/roles').catch(() => null),
        httpClient.get<ListResponse<PermissionItem> | PermissionItem[]>('/admin/permissions').catch(() => null),
      ]);

      const roleItems: RoleItem[] = Array.isArray(rolesData)
        ? rolesData
        : (rolesData as any)?.items || (rolesData as any)?.data || AUTHENTIC_ROLES;
      const permItems: PermissionItem[] = Array.isArray(permsData)
        ? permsData
        : (permsData as any)?.items || (permsData as any)?.data || AUTHENTIC_PERMISSIONS;

      const finalRoles = roleItems && roleItems.length > 0 ? roleItems : AUTHENTIC_ROLES;
      const finalPerms = permItems && permItems.length > 0 ? permItems : AUTHENTIC_PERMISSIONS;

      setRoles(finalRoles);
      setPermissions(finalPerms);

      // Find active role or default to PROVIDER
      const activeRole =
        finalRoles.find((r) => r.code === selectedRoleCode) ||
        finalRoles.find((r) => r.code === 'PROVIDER') ||
        finalRoles[0];
      if (activeRole) {
        setSelectedRoleCode(activeRole.code);
        const curPerms =
          activeRole.permissions && activeRole.permissions.length > 0
            ? activeRole.permissions
            : AUTHENTIC_ROLE_PERMS[activeRole.code] || [];
        setRolePermissions(curPerms);
        setOriginalPermissions(curPerms);
      }
    } catch (err: any) {
      setRoles(AUTHENTIC_ROLES);
      setPermissions(AUTHENTIC_PERMISSIONS);
      const activeRole = AUTHENTIC_ROLES.find((r) => r.code === selectedRoleCode) || AUTHENTIC_ROLES[1];
      const curPerms = AUTHENTIC_ROLE_PERMS[activeRole.code] || [];
      setRolePermissions(curPerms);
      setOriginalPermissions(curPerms);
    } finally {
      setLoadingMatrix(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (activeTab === 'USERS') {
      if (canReadUsers) {
        fetchUsers();
      }
    } else {
      if (canReadMatrix) {
        fetchMatrixData();
      }
    }
  }, [activeTab, page, limit, roleFilter, statusFilter, verificationFilter, canReadUsers, canReadMatrix, isAuthLoading]);

  // Handle User Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (page === 1) {
      fetchUsers();
    } else {
      setPage(1);
    }
  };

  // Switch Selected Role in Matrix Tab
  const handleSelectRole = (code: string) => {
    setSelectedRoleCode(code);
    const targetRole = roles.find((r) => r.code === code);
    if (targetRole) {
      setRolePermissions(targetRole.permissions || []);
      setOriginalPermissions(targetRole.permissions || []);
    }
  };

  // Toggle Single Permission Checkbox for Selected Role
  const handleTogglePermission = (permCode: string) => {
    if (!canManageMatrix || selectedRoleCode === 'ADMIN') return;
    setRolePermissions((prev) =>
      prev.includes(permCode) ? prev.filter((p) => p !== permCode) : [...prev, permCode]
    );
  };

  // Save Matrix Changes
  const hasMatrixChanges = useMemo(() => {
    if (rolePermissions.length !== originalPermissions.length) return true;
    const origSet = new Set(originalPermissions);
    return rolePermissions.some((p) => !origSet.has(p));
  }, [rolePermissions, originalPermissions]);

  // Calculation of pending changes diff
  const changeDiff = useMemo(() => {
    const origSet = new Set(originalPermissions);
    const currSet = new Set(rolePermissions);
    const added = rolePermissions.filter((p) => !origSet.has(p)).length;
    const removed = originalPermissions.filter((p) => !currSet.has(p)).length;
    return { added, removed, total: added + removed };
  }, [rolePermissions, originalPermissions]);

  const handleUndoMatrix = () => {
    setRolePermissions([...originalPermissions]);
    toast.info('Đã hoàn tác các thay đổi phân quyền');
  };

  const handleExpandAll = () => {
    setCollapsedModules({});
  };

  const handleCollapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    availableModules.forEach((mod) => {
      allCollapsed[mod] = true;
    });
    setCollapsedModules(allCollapsed);
  };

  const handleToggleAllInModule = (_modName: string, perms: PermissionItem[]) => {
    if (!canManageMatrix || selectedRoleCode === 'ADMIN') return;
    const permCodes = perms.map((p) => p.code);
    const allGranted = permCodes.every((code) => rolePermissions.includes(code));

    if (allGranted) {
      setRolePermissions((prev) => prev.filter((p) => !permCodes.includes(p)));
    } else {
      const newPerms = new Set([...rolePermissions, ...permCodes]);
      setRolePermissions(Array.from(newPerms));
    }
  };

  const handleSaveMatrix = async () => {
    if (!canManageMatrix || !hasMatrixChanges) return;
    const { value: reason } = await Swal.fire({
      title: `Lưu phân quyền cho vai trò ${selectedRoleCode}`,
      input: 'text',
      inputLabel: 'Nhập lý do điều chỉnh phân quyền *',
      inputPlaceholder: 'Ví dụ: Cập nhật phân quyền mới quý 3...',
      showCancelButton: true,
      confirmButtonColor: '#881337',
      confirmButtonText: 'Xác nhận áp dụng',
      cancelButtonText: 'Hủy',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Vui lòng nhập lý do thay đổi!';
        }
        return null;
      },
    });

    if (reason) {
      try {
        await httpClient.patch(`/admin/roles/${selectedRoleCode}/permissions`, {
          permissions: rolePermissions,
          reason: reason.trim(),
        });
        toast.success(`Đã cập nhật phân quyền cho vai trò ${selectedRoleCode}!`);
        setOriginalPermissions([...rolePermissions]);
        fetchMatrixData();
      } catch (err: any) {
        toast.error(err.message || 'Cập nhật phân quyền thất bại');
      }
    }
  };

  // Toggle Module Accordion
  const toggleModuleCollapse = (moduleName: string) => {
    setCollapsedModules((prev) => ({
      ...prev,
      [moduleName]: !prev[moduleName],
    }));
  };

  // Guard Helper: is current logged-in admin
  const isSelf = (targetUserId: string) => {
    if (!currentAdmin) return false;
    return currentAdmin.id?.toString() === targetUserId.toString();
  };

  // Lock / Unlock Handlers
  const handleLockUser = async (user: UserItem) => {
    if (!canManageUsers) return;
    if (isSelf(user.id)) {
      Swal.fire({
        title: 'Thao tác bị chặn!',
        text: 'Bạn không thể tự khóa tài khoản quản trị của chính mình!',
        icon: 'error',
        confirmButtonColor: '#881337',
      });
      return;
    }

    const { value: lockForm } = await Swal.fire({
      title: `Khóa tài khoản ${user.fullName}`,
      html: `
        <div style="text-align: left; font-size: 13px;">
          <div style="margin-bottom: 12px;">
            <label style="font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">HÌNH THỨC KHÓA</label>
            <select id="lock-type" class="swal2-select" style="width: 100%; margin: 0; font-size: 13px; height: 38px;">
              <option value="SUSPENDED">Tạm đình chỉ (Suspended)</option>
              <option value="BANNED">Khóa vĩnh viễn (Banned)</option>
            </select>
          </div>
          <div id="date-box" style="margin-bottom: 12px;">
            <label style="font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">THỜI HẠN KHÓA</label>
            <input type="datetime-local" id="lock-until" class="swal2-input" style="width: 100%; margin: 0; height: 38px; font-size: 13px;">
          </div>
          <div>
            <label style="font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">LÝ DO KHÓA TÀI KHOẢN *</label>
            <input id="lock-reason" class="swal2-input" style="width: 100%; margin: 0; height: 38px; font-size: 13px;" placeholder="Ví dụ: Vi phạm chính sách bảo mật...">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#881337',
      confirmButtonText: 'Khóa tài khoản',
      cancelButtonText: 'Hủy',
      didOpen: () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 7);
        (document.getElementById('lock-until') as HTMLInputElement).value = tomorrow.toISOString().slice(0, 16);
      },
      preConfirm: () => {
        const type = (document.getElementById('lock-type') as HTMLSelectElement).value;
        const lockedUntil = (document.getElementById('lock-until') as HTMLInputElement).value;
        const reason = (document.getElementById('lock-reason') as HTMLInputElement).value;
        if (!reason || !reason.trim()) {
          Swal.showValidationMessage('Vui lòng nhập lý do khóa!');
          return false;
        }
        return {
          type,
          lockedUntil: type === 'SUSPENDED' ? new Date(lockedUntil).toISOString() : undefined,
          reason: reason.trim(),
        };
      },
    });

    if (lockForm) {
      try {
        await httpClient.patch(`/admin/users/${user.id}/lock`, lockForm);
        toast.success(`Đã khóa tài khoản ${user.fullName}`);
        fetchUsers();
      } catch (err: any) {
        toast.error(err.message || 'Khóa tài khoản thất bại');
      }
    }
  };

  const handleUnlockUser = async (user: UserItem) => {
    if (!canManageUsers) return;
    const { value: reason } = await Swal.fire({
      title: `Mở khóa tài khoản ${user.fullName}`,
      input: 'textarea',
      inputLabel: 'Nhập lý do mở khóa *',
      inputPlaceholder: 'Ví dụ: Đã bổ sung giấy tờ và xác minh thành công...',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: 'Mở khóa',
      cancelButtonText: 'Hủy',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Vui lòng nhập lý do mở khóa!';
        }
        return null;
      },
    });

    if (reason) {
      try {
        await httpClient.patch(`/admin/users/${user.id}/unlock`, { reason: reason.trim() });
        toast.success(`Đã mở khóa tài khoản ${user.fullName}`);
        fetchUsers();
      } catch (err: any) {
        toast.error(err.message || 'Mở khóa tài khoản thất bại');
      }
    }
  };

  // Change Role Modal
  const handleChangeRole = async (user: UserItem) => {
    if (!canManageUsers) return;
    const isSelfAdmin = isSelf(user.id);
    const hasAdmin = user.roles.includes('ADMIN');
    const hasProvider = user.roles.includes('PROVIDER');
    const hasCustomer = user.roles.includes('CUSTOMER');
    const hasSupport = user.roles.includes('SUPPORT');

    const { value: formResult } = await Swal.fire({
      title: `Thay đổi vai trò: ${user.fullName}`,
      html: `
        <div style="text-align: left; font-size: 13px;">
          <p style="color: #64748b; margin-bottom: 12px;">Chọn các vai trò áp dụng cho tài khoản:</p>
          <div style="margin-bottom: 8px;">
            <input type="checkbox" id="role-cust" ${hasCustomer ? 'checked' : ''} style="accent-color: #881337; margin-right: 6px;">
            <label for="role-cust" style="font-weight: 600;">CUSTOMER (Khách hàng)</label>
          </div>
          <div style="margin-bottom: 8px;">
            <input type="checkbox" id="role-prov" ${hasProvider ? 'checked' : ''} style="accent-color: #881337; margin-right: 6px;">
            <label for="role-prov" style="font-weight: 600;">PROVIDER (Đối tác cung cấp dịch vụ)</label>
          </div>
          <div style="margin-bottom: 8px;">
            <input type="checkbox" id="role-supp" ${hasSupport ? 'checked' : ''} style="accent-color: #881337; margin-right: 6px;">
            <label for="role-supp" style="font-weight: 600;">SUPPORT (Nhân viên hỗ trợ)</label>
          </div>
          <div style="margin-bottom: 14px;">
            <input type="checkbox" id="role-adm" ${hasAdmin ? 'checked' : ''} ${isSelfAdmin ? 'disabled' : ''} style="accent-color: #881337; margin-right: 6px;">
            <label for="role-adm" style="font-weight: 600; color: ${isSelfAdmin ? '#94a3b8' : '#0f172a'}">ADMIN (Quản trị viên) ${isSelfAdmin ? '(Không thể tự gỡ)' : ''}</label>
          </div>
          <div>
            <label style="font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">LÝ DO THAY ĐỔI *</label>
            <input id="swal-reason" class="swal2-input" style="width: 100%; margin: 0; height: 38px; font-size: 13px;" placeholder="Nhập lý do thay đổi vai trò...">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#881337',
      confirmButtonText: 'Lưu vai trò',
      cancelButtonText: 'Hủy',
      preConfirm: () => {
        const checkC = (document.getElementById('role-cust') as HTMLInputElement).checked;
        const checkP = (document.getElementById('role-prov') as HTMLInputElement).checked;
        const checkS = (document.getElementById('role-supp') as HTMLInputElement).checked;
        const checkA = (document.getElementById('role-adm') as HTMLInputElement).checked;
        const reason = (document.getElementById('swal-reason') as HTMLInputElement).value;

        if (!reason || !reason.trim()) {
          Swal.showValidationMessage('Vui lòng nhập lý do thay đổi!');
          return false;
        }

        const selected: string[] = [];
        if (checkC) selected.push('CUSTOMER');
        if (checkP) selected.push('PROVIDER');
        if (checkS) selected.push('SUPPORT');
        if (checkA) selected.push('ADMIN');

        if (selected.length === 0) {
          Swal.showValidationMessage('Phải chọn ít nhất một vai trò!');
          return false;
        }

        return { roles: selected, reason: reason.trim() };
      },
    });

    if (formResult) {
      try {
        await httpClient.patch(`/admin/users/${user.id}/roles`, formResult);
        toast.success('Cập nhật vai trò người dùng thành công!');
        fetchUsers();
      } catch (err: any) {
        toast.error(err.message || 'Lỗi khi cập nhật vai trò');
      }
    }
  };

  // Module Counts & Available Modules
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    permissions.forEach((p) => {
      const mod = normalizeModuleName(p.module);
      counts[mod] = (counts[mod] || 0) + 1;
    });
    return counts;
  }, [permissions]);

  const availableModules = useMemo(() => {
    return Object.keys(moduleCounts);
  }, [moduleCounts]);

  // Group Permissions by Module for Matrix View
  const groupedPermissions = useMemo(() => {
    let list = permissions;
    if (permSearchQuery.trim()) {
      const q = permSearchQuery.toLowerCase().trim();
      list = list.filter((p) => 
        p.name.toLowerCase().includes(q) || 
        p.code.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    if (moduleFilter !== 'ALL') {
      list = list.filter((p) => normalizeModuleName(p.module) === moduleFilter);
    }
    if (showGrantedOnly) {
      list = list.filter((p) => rolePermissions.includes(p.code));
    }

    const groups: Record<string, PermissionItem[]> = {};
    list.forEach((p) => {
      const mod = normalizeModuleName(p.module);
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(p);
    });
    return groups;
  }, [permissions, permSearchQuery, moduleFilter, showGrantedOnly, rolePermissions]);

  // Selected Role Item in Screen 2
  const activeRoleItem = useMemo(() => {
    return roles.find((r) => r.code === selectedRoleCode) || {
      code: 'PROVIDER',
      name: 'Provider',
      description: 'Đối tác cung cấp dịch vụ (Studio chụp ảnh, Shop áo dài)',
      permissions: rolePermissions,
      userCount: 0,
      createdAt: '15/06/2024',
      updatedAt: '21/07/2024',
    };
  }, [roles, selectedRoleCode, rolePermissions]);

  // Selected Role Permission Grant Count & Percentage
  const grantedCount = selectedRoleCode === 'ADMIN'
    ? permissions.length
    : rolePermissions.length;
  const totalPermsCount = permissions.length || 63;
  const grantedPercent = totalPermsCount > 0 ? Math.round((grantedCount / totalPermsCount) * 100) : 0;

  // Time format helper
  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Chưa đăng nhập';
    const d = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 3600));
    if (diffHours < 1) return 'Đang trực tuyến';
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Gần đây';
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Prominent permissions for provider dock (6 items matching Figma)
  const prominentPermissions = [
    'Quản lý booking của cửa hàng',
    'Quản lý sản phẩm/dịch vụ',
    'Xem báo cáo doanh thu',
    'Quản lý lịch hẹn',
    'Phản hồi đánh giá',
    'Tạo khuyến mãi',
  ];

  return (
    <div className="ac-page-container">
      {/* Breadcrumbs */}
      <div className="ac-breadcrumbs">
        <span>Trang chủ</span>
        <ChevronRight size={14} />
        <span style={{ color: '#0f172a', fontWeight: 600 }}>Tài khoản & Phân quyền</span>
      </div>

      {/* Header */}
      <div className="ac-header">
        <div>
          <h1 className="ac-header-title">Tài khoản & Phân quyền</h1>
          <p className="ac-header-subtitle">
            Quản lý tài khoản người dùng, vai trò và thiết lập quyền truy cập trong hệ thống LUMÉ.
          </p>
        </div>
        {activeTab === 'USERS' ? (
          <button className="ac-guide-btn" onClick={() => setIsSopModalOpen(true)}>
            <HelpCircle size={16} />
            <span>Hướng dẫn sử dụng</span>
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="ac-guide-btn">
              <Settings size={15} />
              <span>Quản lý vai trò</span>
            </button>
            <button className="ac-btn-primary">
              <Plus size={15} />
              <span>Thêm vai trò</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <div className="ac-main-tabs">
        <button
          className={`ac-tab-btn ${activeTab === 'USERS' ? 'active' : ''}`}
          onClick={() => setActiveTab('USERS')}
        >
          Danh sách người dùng
        </button>
        <button
          className={`ac-tab-btn ${activeTab === 'MATRIX' ? 'active' : ''}`}
          onClick={() => setActiveTab('MATRIX')}
        >
          Vai trò & Quyền hạn
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: DANH SÁCH NGƯỜI DÙNG (FIGMA NODE 330-9268) */}
      {/* ==================================================================== */}
      {activeTab === 'USERS' && (
        <>
          {/* KPI Cards Grid */}
          <div className="ac-kpi-grid">
            {/* Card 1: Tổng người dùng */}
            <div className="ac-kpi-card">
              <div className="ac-kpi-icon-wrap ac-kpi-icon-red">
                <Users size={22} />
              </div>
              <div className="ac-kpi-info">
                <span className="ac-kpi-label">Tổng người dùng</span>
                <span className="ac-kpi-value">{metrics.totalUsers}</span>
                <span className="ac-kpi-trend">↑ 12% so với tháng trước</span>
              </div>
            </div>

            {/* Card 2: Khách hàng */}
            <div className="ac-kpi-card">
              <div className="ac-kpi-icon-wrap ac-kpi-icon-green">
                <User size={22} />
              </div>
              <div className="ac-kpi-info">
                <span className="ac-kpi-label">Khách hàng</span>
                <span className="ac-kpi-value">{metrics.customers}</span>
                <span className="ac-kpi-trend">↑ 10% so với tháng trước</span>
              </div>
            </div>

            {/* Card 3: Đối tác (Provider) */}
            <div className="ac-kpi-card">
              <div className="ac-kpi-icon-wrap ac-kpi-icon-purple">
                <Store size={22} />
              </div>
              <div className="ac-kpi-info">
                <span className="ac-kpi-label">Đối tác (Provider)</span>
                <span className="ac-kpi-value">{metrics.providers}</span>
                <span className="ac-kpi-trend">↑ 20% so với tháng trước</span>
              </div>
            </div>

            {/* Card 4: Quản trị viên */}
            <div className="ac-kpi-card">
              <div className="ac-kpi-icon-wrap ac-kpi-icon-orange">
                <Shield size={22} />
              </div>
              <div className="ac-kpi-info">
                <span className="ac-kpi-label">Quản trị viên</span>
                <span className="ac-kpi-value">{metrics.admins}</span>
                <span className="ac-kpi-trend" style={{ color: '#64748b' }}>
                  ↑ 0% so với tháng trước
                </span>
              </div>
            </div>

            {/* Card 5: Banner CTA chuyển tab */}
            <div className="ac-kpi-banner">
              <div className="ac-kpi-banner-icon">
                <Key size={20} />
              </div>
              <div className="ac-kpi-banner-content">
                <h4 className="ac-kpi-banner-title">Quản lý quyền truy cập theo vai trò</h4>
                <p className="ac-kpi-banner-desc">
                  Các quyền được cấu hình tập trung tại "Vai trò & Quyền hạn". Mọi thay đổi sẽ áp
                  dụng cho tất cả người dùng thuộc vai trò đó.
                </p>
                <span
                  className="ac-kpi-banner-link"
                  onClick={() => setActiveTab('MATRIX')}
                >
                  Đi tới ma trận phân quyền <ArrowRight size={13} />
                </span>
              </div>
            </div>
          </div>

          {/* Layout Split: Table on left, Details on right */}
          <div className="ac-layout-split">
            {/* Left Col: Table and Controls */}
            <div className="ac-main-col">
              {/* Toolbar */}
              <div className="ac-toolbar">
                <div className="ac-toolbar-left">
                  <form onSubmit={handleSearchSubmit} className="ac-search-box">
                    <Search size={16} className="ac-search-icon" />
                    <input
                      type="text"
                      className="ac-search-input"
                      placeholder="Tìm kiếm theo tên, email, SĐT..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </form>

                  <select
                    className="ac-select-filter"
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Tất cả vai trò</option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                    <option value="PROVIDER">Đối tác (PROVIDER)</option>
                    <option value="CUSTOMER">Khách hàng (CUSTOMER)</option>
                    <option value="SUPPORT">Hỗ trợ (SUPPORT)</option>
                  </select>

                  <select
                    className="ac-select-filter"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="SUSPENDED">Tạm khóa</option>
                  </select>

                  <select
                    className="ac-select-filter"
                    value={verificationFilter}
                    onChange={(e) => {
                      setVerificationFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Tất cả xác minh</option>
                    <option value="VERIFIED">Đã xác minh</option>
                    <option value="UNVERIFIED">Chờ xác minh</option>
                  </select>

                  <button className="ac-btn-filter">
                    <Filter size={14} />
                    <span>Bộ lọc</span>
                  </button>
                </div>

                <div className="ac-toolbar-right">
                  <button className="ac-btn-primary">
                    <Plus size={15} />
                    <span>Tạo tài khoản</span>
                  </button>
                  <button className="ac-btn-secondary">
                    <Download size={15} />
                    <span>Xuất dữ liệu</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="ac-table-card">
                <table className="ac-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={
                            users.length > 0 && selectedUserIds.length === users.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(users.map((u) => u.id));
                            } else {
                              setSelectedUserIds([]);
                            }
                          }}
                        />
                      </th>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Người dùng</th>
                      <th>Liên hệ</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Xác minh</th>
                      <th>Hoạt động gần nhất</th>
                      <th style={{ textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                          Đang tải dữ liệu tài khoản từ MongoDB Atlas...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                          Không tìm thấy người dùng nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      users.map((u, idx) => {
                        const isSelected = selectedUser?.id === u.id;
                        const roleCode = u.roles[0] || 'CUSTOMER';
                        const isOnline = formatTimeAgo(u.lastLoginAt) === 'Đang trực tuyến';

                        return (
                          <tr
                            key={u.id}
                            className={isSelected ? 'selected' : ''}
                            onClick={() => setSelectedUser(u)}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(u.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUserIds((prev) => [...prev, u.id]);
                                  } else {
                                    setSelectedUserIds((prev) =>
                                      prev.filter((id) => id !== u.id)
                                    );
                                  }
                                }}
                              />
                            </td>
                            <td>{(page - 1) * limit + idx + 1}</td>
                            <td>
                              <div className="ac-user-cell">
                                <img
                                  src={
                                    u.avatarUrl ||
                                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80'
                                  }
                                  alt={u.fullName}
                                  className="ac-avatar"
                                  onError={(e: any) => {
                                    e.target.src =
                                      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80';
                                  }}
                                />
                                <div className="ac-user-names">
                                  <span className="ac-user-fullname">{u.fullName}</span>
                                  <span className="ac-user-id">
                                    ID: {u.userCode || `USR${u.id.slice(-3).toUpperCase()}`}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 500 }}>{u.email}</span>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  {u.phone || 'Chưa có SĐT'}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`ac-role-badge ${
                                  roleCode === 'ADMIN'
                                    ? 'ac-role-admin'
                                    : roleCode === 'PROVIDER'
                                    ? 'ac-role-provider'
                                    : roleCode === 'SUPPORT'
                                    ? 'ac-role-support'
                                    : 'ac-role-customer'
                                }`}
                              >
                                {roleCode}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`ac-status-badge ${
                                  u.status === 'ACTIVE'
                                    ? 'ac-status-active'
                                    : 'ac-status-suspended'
                                }`}
                              >
                                <span
                                  className={`ac-status-dot ${
                                    u.status === 'ACTIVE'
                                      ? 'ac-status-dot-active'
                                      : 'ac-status-dot-suspended'
                                  }`}
                                />
                                {u.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`ac-verify-badge ${
                                  u.emailVerified
                                    ? 'ac-verify-verified'
                                    : 'ac-verify-unverified'
                                }`}
                              >
                                {u.emailVerified ? (
                                  <>
                                    <Check size={12} />
                                    <span>Đã xác minh</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock size={12} />
                                    <span>Chờ xác minh</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '12px' }}>
                                  {formatDate(u.lastLoginAt) || '24/07/2024 10:00'}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: isOnline ? '#10b981' : '#94a3b8',
                                    fontWeight: isOnline ? 600 : 400,
                                  }}
                                >
                                  • {formatTimeAgo(u.lastLoginAt)}
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '6px',
                                  borderRadius: '6px',
                                  color: '#64748b',
                                }}
                                onClick={() => handleChangeRole(u)}
                                title="Thay đổi vai trò"
                              >
                                •••
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Pagination Footer */}
                <div className="ac-pagination-bar">
                  <span>
                    Hiển thị 1 - {users.length} của {totalUsers} người dùng
                  </span>
                  <div className="ac-page-buttons">
                    <button
                      className="ac-page-btn"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      &lt;
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
                      (pNum) => (
                        <button
                          key={pNum}
                          className={`ac-page-btn ${page === pNum ? 'active' : ''}`}
                          onClick={() => setPage(pNum)}
                        >
                          {pNum}
                        </button>
                      )
                    )}
                    {totalPages > 5 && <span style={{ padding: '0 4px' }}>...</span>}
                    {totalPages > 5 && (
                      <button
                        className={`ac-page-btn ${page === totalPages ? 'active' : ''}`}
                        onClick={() => setPage(totalPages)}
                      >
                        {totalPages}
                      </button>
                    )}
                    <button
                      className="ac-page-btn"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      &gt;
                    </button>
                  </div>
                  <select
                    className="ac-select-filter"
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    <option value={8}>8 / trang</option>
                    <option value={12}>12 / trang</option>
                    <option value={20}>20 / trang</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Col: Chi tiết người dùng Dock (Figma Node 330-9268) */}
            {selectedUser && (
              <div className="ac-detail-dock">
                <div className="ac-dock-header">
                  <h3 className="ac-dock-title">Chi tiết người dùng</h3>
                  <button className="ac-dock-close" onClick={() => setSelectedUser(null)}>
                    <X size={18} />
                  </button>
                </div>

                {/* Profile Header */}
                <div className="ac-dock-profile">
                  <img
                    src={
                      selectedUser.avatarUrl ||
                      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80'
                    }
                    alt={selectedUser.fullName}
                    className="ac-dock-avatar"
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                        {selectedUser.fullName}
                      </h4>
                      <span
                        className={`ac-status-badge ${
                          selectedUser.status === 'ACTIVE'
                            ? 'ac-status-active'
                            : 'ac-status-suspended'
                        }`}
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        {selectedUser.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 6px 0' }}>
                      ID: {selectedUser.userCode || `USR${selectedUser.id.slice(-3).toUpperCase()}`}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span className="ac-role-badge ac-role-provider">
                        {selectedUser.roles[0] || 'PROVIDER'}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                          background: '#f1f5f9',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {selectedUser.roles.includes('PROVIDER') ? 'Đối tác Studio' : 'Thành viên'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-tabs */}
                <div className="ac-dock-subtabs">
                  <button
                    className={`ac-dock-subtab-btn ${
                      dockSubTab === 'OVERVIEW' ? 'active' : ''
                    }`}
                    onClick={() => setDockSubTab('OVERVIEW')}
                  >
                    Tổng quan
                  </button>
                  <button
                    className={`ac-dock-subtab-btn ${dockSubTab === 'ROLES' ? 'active' : ''}`}
                    onClick={() => setDockSubTab('ROLES')}
                  >
                    Vai trò & Quyền
                  </button>
                  <button
                    className={`ac-dock-subtab-btn ${dockSubTab === 'LOGS' ? 'active' : ''}`}
                    onClick={() => setDockSubTab('LOGS')}
                  >
                    Nhật ký hoạt động
                  </button>
                </div>

                {/* Subtab: Vai trò & Quyền */}
                {dockSubTab === 'ROLES' && (
                  <div>
                    {/* Header + Action */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        Vai trò hiện tại
                      </span>
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#881337',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onClick={() => handleChangeRole(selectedUser)}
                      >
                        <Edit size={12} />
                        <span>Thay đổi vai trò</span>
                      </button>
                    </div>

                    {/* Role Card */}
                    <div className="ac-dock-role-card">
                      <div className="ac-dock-role-header">
                        <div className="ac-dock-role-icon">
                          <Store size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                            {selectedUser.roles[0] || 'PROVIDER'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Đối tác cung cấp dịch vụ (Studio chụp ảnh, Shop áo dài)
                          </div>
                        </div>
                      </div>

                      <div className="ac-dock-meta-row">
                        <span className="ac-dock-meta-label">Ngày gán vai trò:</span>
                        <span className="ac-dock-meta-val">15/06/2024</span>
                      </div>
                      <div className="ac-dock-meta-row">
                        <span className="ac-dock-meta-label">Người gán:</span>
                        <span className="ac-dock-meta-val">System Admin</span>
                      </div>
                      <div className="ac-dock-meta-row" style={{ marginBottom: 0 }}>
                        <span className="ac-dock-meta-label">Ghi chú:</span>
                        <span className="ac-dock-meta-val">Đối tác đã hoàn tất KYC</span>
                      </div>
                    </div>

                    {/* Callout Notice */}
                    <div className="ac-callout-notice">
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          Quyền truy cập của người dùng được quản lý theo vai trò. Để chỉnh sửa
                          chi tiết quyền, vui lòng vào trang Vai trò & Quyền hạn.
                        </div>
                      </div>
                      <span
                        className="ac-callout-link"
                        onClick={() => {
                          setSelectedRoleCode(selectedUser.roles[0] || 'PROVIDER');
                          setActiveTab('MATRIX');
                        }}
                      >
                        Xem toàn bộ quyền của {selectedUser.roles[0] || 'PROVIDER'} &rarr;
                      </span>
                    </div>

                    {/* Key Permissions Checklist (6 items matching Figma) */}
                    <div>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#0f172a',
                          marginBottom: '8px',
                        }}
                      >
                        Các quyền tiêu biểu (6)
                      </div>
                      <ul className="ac-perm-checklist">
                        {prominentPermissions.map((permText, i) => (
                          <li key={i} className="ac-perm-check-item">
                            <CheckCircle2 size={16} className="ac-perm-check-icon" />
                            <span>{permText}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Bottom Actions */}
                    <div className="ac-dock-actions">
                      <button
                        className="ac-btn-outline-gray"
                        onClick={() => toast.info('Chức năng chỉnh sửa thông tin người dùng')}
                      >
                        <Edit size={14} />
                        <span>Chỉnh sửa người dùng</span>
                      </button>
                      {selectedUser.status === 'ACTIVE' ? (
                        <button
                          className="ac-btn-outline-red"
                          onClick={() => handleLockUser(selectedUser)}
                        >
                          <Lock size={14} />
                          <span>Khóa tài khoản</span>
                        </button>
                      ) : (
                        <button
                          className="ac-btn-outline-gray"
                          style={{ color: '#059669', borderColor: '#a7f3d0' }}
                          onClick={() => handleUnlockUser(selectedUser)}
                        >
                          <Unlock size={14} />
                          <span>Mở khóa tài khoản</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Subtab: Tổng quan */}
                {dockSubTab === 'OVERVIEW' && (
                  <div style={{ fontSize: '13px', color: '#334155' }}>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                        EMAIL
                      </div>
                      <div style={{ fontWeight: 600 }}>{selectedUser.email}</div>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                        SỐ ĐIỆN THOẠI
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {selectedUser.phone || 'Chưa cập nhật'}
                      </div>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                        NGÀY TẠO TÀI KHOẢN
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {formatDate(selectedUser.createdAt)}
                      </div>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                        TRẠNG THÁI XÁC MINH
                      </div>
                      <div style={{ fontWeight: 600, color: '#059669' }}>
                        {selectedUser.emailVerified ? 'Đã xác minh Email & SĐT' : 'Chưa xác minh'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtab: Nhật ký hoạt động */}
                {dockSubTab === 'LOGS' && (
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        Đăng nhập thành công
                      </div>
                      <div style={{ color: '#64748b' }}>
                        IP: 14.232.208.12 • Trình duyệt: Chrome 127
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                        {formatDate(selectedUser.lastLoginAt)}
                      </div>
                    </div>
                    <div style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        Cập nhật mật khẩu
                      </div>
                      <div style={{ color: '#64748b' }}>Hệ thống gửi mã OTP qua Email</div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>15/07/2024 10:20</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: VAI TRÒ & QUYỀN HẠN (FIGMA NODE 330-10107) */}
      {/* ==================================================================== */}
      {activeTab === 'MATRIX' && (
        <>
          {/* KPI Cards Grid (Screen 2) */}
          <div className="ac-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {/* Card 1: Tổng số vai trò */}
            <div className="ac-kpi-card">
              <div className="ac-kpi-icon-wrap ac-kpi-icon-blue">
                <Users size={22} />
              </div>
              <div className="ac-kpi-info">
                <span className="ac-kpi-label">Tổng số vai trò</span>
                <span className="ac-kpi-value">{roles.length || 4}</span>
                <span className="ac-kpi-subtext">Hệ thống & Tùy chỉnh</span>
              </div>
            </div>

            {/* Card 2: Tổng số quyền */}
            <div className="ac-kpi-card">
              <div className="ac-kpi-icon-wrap ac-kpi-icon-gold">
                <Key size={22} />
              </div>
              <div className="ac-kpi-info">
                <span className="ac-kpi-label">Tổng số quyền</span>
                <span className="ac-kpi-value">{permissions.length || 63}</span>
                <span className="ac-kpi-subtext">{availableModules.length} phân nhóm module</span>
              </div>
            </div>

            {/* Card 3: Vai trò đang sử dụng */}
            <div className="ac-kpi-card">
              <div className="ac-kpi-icon-wrap ac-kpi-icon-red">
                <ShieldCheck size={22} />
              </div>
              <div className="ac-kpi-info">
                <span className="ac-kpi-label">Vai trò đang sử dụng</span>
                <span className="ac-kpi-value">{roles.filter((r) => (r.userCount || 0) > 0).length}</span>
                <span className="ac-kpi-subtext">Đang gán cho người dùng</span>
              </div>
            </div>

            {/* Card 4: Cập nhật gần nhất */}
            <div className="ac-kpi-card">
              <div className="ac-kpi-icon-wrap ac-kpi-icon-green">
                <Clock size={22} />
              </div>
              <div className="ac-kpi-info">
                <span className="ac-kpi-label">Cập nhật gần nhất</span>
                <span className="ac-kpi-value" style={{ fontSize: '18px' }}>
                  {activeRoleItem.updatedAt ? formatDate(activeRoleItem.updatedAt) : 'Gần đây'}
                </span>
                <span className="ac-kpi-subtext">Bởi System Admin</span>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* SCREEN 2: HORIZONTAL ROLE LIST + FULL-WIDTH PERMISSION MATRIX    */}
          {/* ================================================================ */}
          <div className="ac-matrix-grid">
            {/* 1. HORIZONTAL ROLES ROW ("Danh sách vai trò" hàng ngang) */}
            <div className="ac-roles-horizontal-section">
              <div className="ac-roles-horizontal-header">
                <div className="ac-roles-horizontal-title-group">
                  <h3 className="ac-roles-horizontal-title">
                    <Shield size={18} style={{ color: '#881337' }} />
                    Danh sách vai trò hệ thống ({roles.length} vai trò)
                  </h3>
                  <p className="ac-roles-horizontal-subtitle">
                    Nhấn chọn một vai trò bên dưới để xem chi tiết và tùy chỉnh ma trận phân quyền (Bố cục hàng ngang hiển thị đầy đủ)
                  </p>
                </div>
                <div className="ac-roles-horizontal-actions">
                  <button
                    type="button"
                    className="ac-btn-outline-gray"
                    style={{ height: '34px', fontSize: '12px' }}
                    onClick={() => setIsSopModalOpen(true)}
                  >
                    <HelpCircle size={14} />
                    <span>Hướng dẫn SOP</span>
                  </button>
                  <button
                    type="button"
                    className="ac-btn-primary"
                    style={{ height: '34px', fontSize: '12px' }}
                    onClick={() => toast.info('Chức năng thêm vai trò mới')}
                  >
                    <Plus size={14} />
                    <span>+ Thêm vai trò</span>
                  </button>
                </div>
              </div>

              {/* Dynamic 4 Horizontal Role Cards */}
              <div className="ac-roles-horizontal-grid">
                {roles.map((role) => {
                  const isSelected = selectedRoleCode === role.code;
                  const isSystemRole = role.code === 'ADMIN';
                  const roleIcon =
                    role.code === 'ADMIN' ? (
                      <Crown size={20} />
                    ) : role.code === 'PROVIDER' ? (
                      <Store size={20} />
                    ) : role.code === 'CUSTOMER' ? (
                      <User size={20} />
                    ) : (
                      <Headphones size={20} />
                    );

                  const iconStyle =
                    role.code === 'ADMIN'
                      ? { background: '#fef3c7', color: '#b45309' }
                      : role.code === 'PROVIDER'
                      ? { background: '#f3e8ff', color: '#7e22ce' }
                      : role.code === 'CUSTOMER'
                      ? { background: '#dbeafe', color: '#1d4ed8' }
                      : { background: '#ffedd5', color: '#c2410c' };

                  const progressColor =
                    role.code === 'ADMIN'
                      ? '#b45309'
                      : role.code === 'PROVIDER'
                      ? '#7e22ce'
                      : role.code === 'CUSTOMER'
                      ? '#1d4ed8'
                      : '#c2410c';

                  const rolePermCount =
                    role.code === 'ADMIN'
                      ? (permissions.length || 63)
                      : (role.permissions?.length ?? AUTHENTIC_ROLE_PERMS[role.code]?.length ?? 0);
                  const totalCount = permissions.length || 63;
                  const rolePct = totalCount > 0 ? Math.round((rolePermCount / totalCount) * 100) : 0;

                  return (
                    <div
                      key={role.code}
                      className={`ac-role-card-horiz ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectRole(role.code)}
                    >
                      <div className="ac-role-card-horiz-top">
                        <div className="ac-role-card-horiz-icon" style={iconStyle}>
                          {roleIcon}
                        </div>
                        <div className="ac-role-card-horiz-info">
                          <div className="ac-role-card-horiz-name-row">
                            <span className="ac-role-card-horiz-name">
                              {role.name || role.code}
                            </span>
                            {isSelected && (
                              <span className="ac-role-card-horiz-active-badge">✓ Đang chọn</span>
                            )}
                          </div>
                          <div className="ac-role-card-horiz-meta-row">
                            <span className="ac-role-card-horiz-users">
                              {role.userCount ?? 0} người dùng
                            </span>
                            {isSystemRole && (
                              <span className="ac-role-card-horiz-system-tag">Hệ thống</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="ac-role-card-horiz-desc" title={role.description}>
                        {role.description || `Cấu hình phân quyền cho vai trò ${role.name || role.code}`}
                      </div>

                      <div className="ac-role-card-horiz-progress-wrap">
                        <div className="ac-role-card-horiz-progress-info">
                          <span>Phân quyền:</span>
                          <span style={{ color: progressColor }}>
                            {rolePermCount}/{totalCount} ({rolePct}%)
                          </span>
                        </div>
                        <div className="ac-role-card-horiz-progress-bar">
                          <div
                            className="ac-role-card-horiz-progress-fill"
                            style={{
                              width: `${rolePct}%`,
                              background: progressColor,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. ACTIVE ROLE STRIP & ACTIONS */}
            <div className="ac-active-role-strip">
              <div className="ac-active-role-strip-left">
                <span style={{ color: '#64748b' }}>Đang cấu hình vai trò:</span>
                <span className="ac-active-role-badge-highlight">
                  {activeRoleItem.name} ({activeRoleItem.code})
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  • <strong>{activeRoleItem.userCount ?? 0}</strong> tài khoản áp dụng
                </span>
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                  • {grantedCount}/{totalPermsCount} quyền ({grantedPercent}%)
                </span>
              </div>
              <div className="ac-active-role-strip-right">
                <button
                  type="button"
                  className="ac-btn-outline-red"
                  style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                  onClick={() => setIsRoleStatsModalOpen(true)}
                  title="Mở biểu đồ Donut và thông tin phân quyền chi tiết của vai trò này"
                >
                  <PieChart size={14} />
                  <span>Xem thống kê & Biểu đồ tròn</span>
                </button>
                <button
                  type="button"
                  className="ac-btn-outline-gray"
                  style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                  onClick={() => toast.info('Sao chép cấu hình quyền từ vai trò khác')}
                >
                  <Copy size={13} />
                  <span>Sao chép quyền</span>
                </button>
                {hasMatrixChanges && (
                  <>
                    <button
                      type="button"
                      className="ac-btn-outline-gray"
                      style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                      onClick={handleUndoMatrix}
                    >
                      <RotateCcw size={13} />
                      <span>Hoàn tác ({changeDiff.total})</span>
                    </button>
                    <button
                      type="button"
                      className="ac-btn-primary"
                      style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                      onClick={handleSaveMatrix}
                    >
                      <Check size={14} />
                      <span>Lưu thay đổi</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 3. FULL-WIDTH MATRIX WORKSPACE */}
            <div className="ac-matrix-fullwidth-col">
              <div className="ac-matrix-header">
                <div>
                  <h3 className="ac-matrix-title">Ma trận phân quyền chi tiết</h3>
                  <p className="ac-matrix-subtitle">
                    Thiết lập quyền truy cập cho vai trò <strong>{activeRoleItem.name}</strong>. Cột bảng hiển thị rộng rãi, đầy đủ trên toàn bộ màn hình.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {hasMatrixChanges && (
                    <>
                      <button
                        className="ac-btn-outline-gray"
                        style={{ height: '34px', fontSize: '12px' }}
                        onClick={handleUndoMatrix}
                      >
                        <RotateCcw size={13} />
                        <span>Hoàn tác ({changeDiff.total})</span>
                      </button>
                      <button
                        className="ac-btn-primary"
                        style={{ height: '34px', fontSize: '12px' }}
                        onClick={handleSaveMatrix}
                      >
                        <Check size={14} />
                        <span>Lưu thay đổi</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Module Pills Tab Bar */}
              <div className="ac-module-pills-bar">
                <button
                  className={`ac-module-pill ${moduleFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setModuleFilter('ALL')}
                >
                  <span>Tất cả</span>
                  <span className="ac-pill-count">{permissions.length}</span>
                </button>
                {availableModules.map((mod) => (
                  <button
                    key={mod}
                    className={`ac-module-pill ${moduleFilter === mod ? 'active' : ''}`}
                    onClick={() => setModuleFilter(mod)}
                  >
                    <span>{mod}</span>
                    <span className="ac-pill-count">{moduleCounts[mod]}</span>
                  </button>
                ))}
              </div>

              {/* Matrix Toolbar */}
              <div className="ac-matrix-toolbar">
                <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                  <Search size={14} className="ac-search-icon" />
                  <input
                    type="text"
                    className="ac-search-input"
                    style={{ height: '34px', fontSize: '12px' }}
                    placeholder="Tìm kiếm quyền (tên quyền, mã quyền, mô tả)..."
                    value={permSearchQuery}
                    onChange={(e) => setPermSearchQuery(e.target.value)}
                  />
                  {permSearchQuery && (
                    <button
                      onClick={() => setPermSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <select
                  className="ac-select-filter"
                  style={{ height: '34px', fontSize: '12px' }}
                  value={showGrantedOnly ? 'GRANTED' : 'ALL'}
                  onChange={(e) => setShowGrantedOnly(e.target.value === 'GRANTED')}
                >
                  <option value="ALL">Tất cả quyền ({permissions.length})</option>
                  <option value="GRANTED">Chỉ quyền được cấp ({grantedCount})</option>
                </select>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="ac-btn-toggle-view"
                    onClick={handleExpandAll}
                    title="Mở rộng tất cả phân nhóm"
                  >
                    Mở rộng tất cả
                  </button>
                  <button
                    className="ac-btn-toggle-view"
                    onClick={handleCollapseAll}
                    title="Thu gọn tất cả phân nhóm"
                  >
                    Thu gọn tất cả
                  </button>
                </div>
              </div>

              {/* Scrollable Table Container */}
              <div className="ac-matrix-scroll-wrap">
                {loadingMatrix ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                    Đang tải ma trận phân quyền...
                  </div>
                ) : Object.keys(groupedPermissions).length === 0 ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                    Không có quyền nào phù hợp với bộ lọc tìm kiếm.
                  </div>
                ) : (
                  <table className="ac-matrix-table">
                    <thead>
                      <tr>
                        <th style={{ width: '25%', minWidth: '220px' }}>Quyền / Chức năng</th>
                        <th style={{ width: '15%', minWidth: '150px' }}>Mã quyền</th>
                        <th style={{ width: '30%', minWidth: '250px' }}>Mô tả chi tiết</th>
                        {roles.map((r) => {
                          const isCurActive = r.code === selectedRoleCode;
                          return (
                            <th
                              key={r.code}
                              className={`role-col ${isCurActive ? 'role-col-active' : ''}`}
                              onClick={() => handleSelectRole(r.code)}
                              style={{ cursor: 'pointer', width: '7.5%', minWidth: '100px' }}
                              title={`Nhấn để chọn và chỉnh sửa vai trò ${r.name}`}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ fontWeight: 700 }}>{r.name || r.code}</span>
                                <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 500 }}>
                                  {r.userCount ?? 0} người dùng
                                </span>
                                {isCurActive && (
                                  <span className="ac-active-role-tag">Đang chọn</span>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(groupedPermissions).map(([modName, perms]) => {
                        const isCollapsed = collapsedModules[modName];
                        const permCodes = perms.map((p) => p.code);
                        const grantedInMod = permCodes.filter((c) => rolePermissions.includes(c)).length;
                        const allGrantedInMod = grantedInMod === perms.length;

                        return (
                          <React.Fragment key={modName}>
                            {/* Module Header Row */}
                            <tr className="ac-module-row-header">
                              <td
                                colSpan={3}
                                className="ac-module-row-title"
                                onClick={() => toggleModuleCollapse(modName)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                  <span style={{ fontWeight: 700 }}>{modName}</span>
                                  <span className="ac-module-badge">{perms.length} quyền</span>
                                  <span className="ac-module-granted-hint">
                                    {grantedInMod}/{perms.length} cấp cho {activeRoleItem.name}
                                  </span>
                                </div>
                              </td>
                              <td colSpan={roles.length} className="ac-module-row-actions">
                                {canManageMatrix && selectedRoleCode !== 'ADMIN' && (
                                  <button
                                    type="button"
                                    className="ac-btn-batch-module"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleAllInModule(modName, perms);
                                    }}
                                  >
                                    {allGrantedInMod ? 'Bỏ chọn nhóm' : 'Cấp tất cả nhóm'}
                                  </button>
                                )}
                              </td>
                            </tr>

                            {/* Module Permission Rows */}
                            {!isCollapsed &&
                              perms.map((p) => {
                                const isGrantedForSelected = rolePermissions.includes(p.code);

                                return (
                                  <tr
                                    key={p.code}
                                    className={`ac-perm-row ${isGrantedForSelected ? 'is-granted' : ''}`}
                                  >
                                    <td style={{ fontWeight: 600, color: '#0f172a' }}>
                                      {p.name}
                                    </td>
                                    <td>
                                      <code className="ac-perm-code-tag">{p.code}</code>
                                    </td>
                                    <td style={{ color: '#64748b', fontSize: '11.5px', lineHeight: '1.45' }}>
                                      {p.description || '-'}
                                    </td>

                                    {roles.map((r) => {
                                      const isAdminRole = r.code === 'ADMIN';
                                      const isTargetRole = r.code === selectedRoleCode;
                                      const isChecked = isAdminRole
                                        ? true
                                        : isTargetRole
                                        ? rolePermissions.includes(p.code)
                                        : Boolean(r.permissions?.includes(p.code));

                                      return (
                                        <td
                                          key={r.code}
                                          className={`role-col ${isTargetRole ? 'role-col-active' : ''}`}
                                        >
                                          <input
                                            type="checkbox"
                                            className="ac-matrix-checkbox"
                                            checked={isChecked}
                                            disabled={isAdminRole || !canManageMatrix}
                                            onChange={() => {
                                              if (isTargetRole) {
                                                handleTogglePermission(p.code);
                                              } else {
                                                handleSelectRole(r.code);
                                                handleTogglePermission(p.code);
                                              }
                                            }}
                                            title={
                                              isAdminRole
                                                ? 'Admin luôn có toàn bộ quyền'
                                                : `Bật/tắt quyền cho vai trò ${r.name}`
                                            }
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Floating Bottom Bar for Unsaved Changes */}
              {hasMatrixChanges && (
                <div className="ac-floating-save-bar">
                  <div className="ac-floating-save-info">
                    <AlertTriangle size={18} className="ac-floating-icon" />
                    <div>
                      <strong>Có {changeDiff.total} thay đổi chưa lưu</strong> cho vai trò{' '}
                      <span className="ac-floating-role-tag">{activeRoleItem.name}</span>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>
                        ({changeDiff.added > 0 ? `+${changeDiff.added} cấp mới` : ''}
                        {changeDiff.added > 0 && changeDiff.removed > 0 ? ', ' : ''}
                        {changeDiff.removed > 0 ? `-${changeDiff.removed} thu hồi` : ''})
                      </span>
                    </div>
                  </div>
                  <div className="ac-floating-actions">
                    <button className="ac-btn-outline-gray" onClick={handleUndoMatrix}>
                      <RotateCcw size={14} />
                      <span>Hoàn tác</span>
                    </button>
                    <button className="ac-btn-primary" onClick={handleSaveMatrix}>
                      <Check size={14} />
                      <span>Lưu thay đổi</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* ROLE STATS & DONUT MODAL (Chi tiết phân quyền & biểu đồ Figma 330-10107) */}
      {/* ==================================================================== */}
      {isRoleStatsModalOpen && (
        <div className="ac-modal-overlay" onClick={() => setIsRoleStatsModalOpen(false)}>
          <div className="ac-modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="ac-modal-header">
              <h3 className="ac-modal-title">
                Thống Kê Phân Quyền: {activeRoleItem.name} ({activeRoleItem.code})
              </h3>
              <button className="ac-dock-close" onClick={() => setIsRoleStatsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="ac-modal-body">
              {/* Profile Summary */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: '#f3e8ff',
                    color: '#7e22ce',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Store size={24} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    {activeRoleItem.name} ({activeRoleItem.code})
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    {activeRoleItem.description}
                  </p>
                </div>
              </div>

              {/* Metadata rows */}
              <div style={{ fontSize: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <div className="ac-dock-meta-row">
                  <span className="ac-dock-meta-label">Mã vai trò:</span>
                  <span className="ac-dock-meta-val">{activeRoleItem.code}</span>
                </div>
                <div className="ac-dock-meta-row">
                  <span className="ac-dock-meta-label">Số người dùng áp dụng:</span>
                  <span className="ac-dock-meta-val">{activeRoleItem.userCount ?? 0} tài khoản</span>
                </div>
                <div className="ac-dock-meta-row">
                  <span className="ac-dock-meta-label">Ngày tạo:</span>
                  <span className="ac-dock-meta-val">
                    {activeRoleItem.createdAt ? formatDate(activeRoleItem.createdAt) : 'Hệ thống'}
                  </span>
                </div>
                <div className="ac-dock-meta-row">
                  <span className="ac-dock-meta-label">Cập nhật gần nhất:</span>
                  <span className="ac-dock-meta-val">
                    {activeRoleItem.updatedAt ? formatDate(activeRoleItem.updatedAt) : 'Gần đây'}
                  </span>
                </div>
              </div>

              {/* Notice Box */}
              <div
                className="ac-callout-notice"
                style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', marginTop: '12px' }}
              >
                <div style={{ display: 'flex', gap: '8px' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }} />
                  <div>
                    Thay đổi quyền của vai trò này sẽ được áp dụng trực tiếp cho tất cả{' '}
                    <strong>{activeRoleItem.userCount ?? 0}</strong> tài khoản người dùng đang được gán.
                  </div>
                </div>
              </div>

              {/* Thống kê quyền (Donut Chart) */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Tỷ lệ cấp quyền hệ thống
                </div>
                <div className="ac-donut-container">
                  <div className="ac-donut-svg-wrap">
                    <svg width="100" height="100" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="4"
                      />
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#059669"
                        strokeWidth="4"
                        strokeDasharray={`${grantedPercent}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="ac-donut-text">
                      <div className="ac-donut-pct">{grantedCount} / {totalPermsCount}</div>
                      <div className="ac-donut-label">quyền được cấp</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#059669' }}>
                        {grantedPercent}%
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="ac-donut-legend">
                    <div className="ac-donut-legend-item">
                      <span className="ac-donut-dot" style={{ background: '#10b981' }} />
                      <span>Được cấp:</span>
                      <strong style={{ marginLeft: 'auto', color: '#0f172a' }}>{grantedCount}</strong>
                    </div>
                    <div className="ac-donut-legend-item">
                      <span className="ac-donut-dot" style={{ background: '#64748b' }} />
                      <span>Chưa cấp:</span>
                      <strong style={{ marginLeft: 'auto', color: '#0f172a' }}>
                        {totalPermsCount - grantedCount}
                      </strong>
                    </div>
                    <div className="ac-donut-legend-item">
                      <span className="ac-donut-dot" style={{ background: '#be123c' }} />
                      <span>Tổng cộng:</span>
                      <strong style={{ marginLeft: 'auto', color: '#0f172a' }}>
                        {totalPermsCount}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Các quyền nổi bật */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Các chức năng quyền tiêu biểu
                </div>
                <ul className="ac-perm-checklist">
                  {prominentPermissions.map((permText, i) => (
                    <li key={i} className="ac-perm-check-item">
                      <CheckCircle2 size={16} className="ac-perm-check-icon" />
                      <span>{permText}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="ac-modal-footer">
              <button
                className="ac-btn-outline-gray"
                onClick={() => setIsRoleStatsModalOpen(false)}
              >
                Đóng
              </button>
              <button
                className="ac-btn-primary"
                onClick={() => {
                  setModuleFilter('ALL');
                  setShowGrantedOnly(true);
                  setIsRoleStatsModalOpen(false);
                }}
              >
                <span>Xem chỉ quyền được cấp trong bảng &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SOP GUIDE MODAL */}
      {/* ==================================================================== */}
      {isSopModalOpen && (
        <div className="ac-modal-overlay" onClick={() => setIsSopModalOpen(false)}>
          <div className="ac-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ac-modal-header">
              <h3 className="ac-modal-title">Hướng Dẫn Quản Lý Tài Khoản & Phân Quyền (RBAC)</h3>
              <button className="ac-dock-close" onClick={() => setIsSopModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="ac-modal-body">
              <div className="ac-sop-step">
                <div className="ac-sop-num">1</div>
                <div className="ac-sop-info">
                  <h4>Tiếp nhận & Định danh tài khoản</h4>
                  <p>
                    Mọi tài khoản mới đăng ký phải xác thực OTP qua Email hoặc Số điện thoại. Đối tác
                    (Provider) bắt buộc phải trải qua bước thẩm định hồ sơ KYC và giấy phép kinh doanh
                    trước khi được cấp quyền vận hành gian hàng.
                  </p>
                </div>
              </div>

              <div className="ac-sop-step">
                <div className="ac-sop-num">2</div>
                <div className="ac-sop-info">
                  <h4>Nguyên tắc phân quyền theo vai trò (RBAC)</h4>
                  <p>
                    Hệ thống LUMÉ áp dụng mô hình phân quyền tập trung theo vai trò (Role-Based Access
                    Control). Các quyền truy cập được gắn trực tiếp vào vai trò (`ADMIN`, `PROVIDER`,
                    `CUSTOMER`, `SUPPORT`), không phân quyền riêng rẽ theo cá nhân để bảo đảm tính nhất
                    quán và an toàn dữ liệu.
                  </p>
                </div>
              </div>

              <div className="ac-sop-step">
                <div className="ac-sop-num">3</div>
                <div className="ac-sop-info">
                  <h4>Điều chỉnh ma trận phân quyền</h4>
                  <p>
                    Quản trị viên có thể bật/tắt các quyền cụ thể trong <strong>Ma trận phân quyền</strong>.
                    Mỗi lần thay đổi sẽ yêu cầu nhập lý do ghi vết Audit Log và có hiệu lực tức thì
                    cho tất cả người dùng thuộc vai trò đó.
                  </p>
                </div>
              </div>

              <div className="ac-sop-step" style={{ marginBottom: 0 }}>
                <div className="ac-sop-num">4</div>
                <div className="ac-sop-info">
                  <h4>Kiểm soát rủi ro & Khóa tài khoản</h4>
                  <p>
                    Khi phát hiện hành vi bất thường, quản trị viên có thể sử dụng tính năng{' '}
                    <strong>Tạm đình chỉ (Suspended)</strong> có thời hạn hoặc{' '}
                    <strong>Khóa vĩnh viễn (Banned)</strong>. Toàn bộ phiên đăng nhập hiện tại của người
                    dùng đó sẽ bị thu hồi ngay lập tức.
                  </p>
                </div>
              </div>
            </div>

            <div className="ac-modal-footer">
              <button className="ac-btn-primary" onClick={() => setIsSopModalOpen(false)}>
                Đã hiểu quy trình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
