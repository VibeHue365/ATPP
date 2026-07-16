import React, { useState, useEffect } from 'react';
import {
  Search, Lock, Unlock, Edit, ShieldCheck, X, AlertTriangle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { useAuth } from '../../../features/auth/hooks/useAuth';

interface UserItem {
  id: string;
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
}

interface RoleItem {
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

interface PermissionItem {
  code: string;
  name: string;
  module: string;
  description: string;
}

interface ListResponse<T> {
  items?: T[];
  data?: T[];
}

interface UserListResponse {
  items: UserItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const AccessControl: React.FC = () => {
  const toast = useToast();
  const { user: currentAdmin, hasPermission, refreshPermissions } = useAuth();
  const canReadUsers = hasPermission('user:read');
  const canManageUsers = hasPermission('user:manage');
  const canReadMatrix = hasPermission('role:read') && hasPermission('permission:read');
  const canManageMatrix = hasPermission('role:manage') && hasPermission('permission:manage');

  // Sub-tabs: 'USERS' (Danh sách tài khoản) or 'MATRIX' (Ma trận phân quyền)
  const [subTab, setSubTab] = useState<'USERS' | 'MATRIX'>('USERS');

  // Accounts state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected User for details drawer
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Matrix State
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>('PROVIDER');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!canReadUsers) {
      setUsers([]);
      setUsersError('Bạn không có quyền xem danh sách người dùng.');
      return;
    }
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const qParams = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      const keyword = searchQuery.trim();
      if (keyword) qParams.set('keyword', keyword);
      if (roleFilter) qParams.set('role', roleFilter);
      if (statusFilter) qParams.set('status', statusFilter);
      const res = await httpClient.get<UserListResponse>(`/admin/users?${qParams.toString()}`);
      setUsers(res.items || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalUsers(res.pagination?.total || 0);
    } catch (err: any) {
      setUsersError(err?.message || 'Khong the tai danh sach tai khoan');
      toast.error(err.message || 'Không thể tải danh sách tài khoản');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchMatrixData = async () => {
    if (!canReadMatrix) {
      setRoles([]);
      setPermissions([]);
      setMatrixError('Bạn không có đủ quyền xem ma trận phân quyền.');
      return;
    }
    setLoadingMatrix(true);
    setMatrixError(null);
    try {
      const [rolesData, permsData] = await Promise.all([
        httpClient.get<ListResponse<RoleItem> | RoleItem[]>('/admin/roles'),
        httpClient.get<ListResponse<PermissionItem> | PermissionItem[]>('/admin/permissions')
      ]);
      const roleItems = Array.isArray(rolesData)
        ? rolesData
        : rolesData.items || rolesData.data || [];
      const permissionItems = Array.isArray(permsData)
        ? permsData
        : permsData.items || permsData.data || [];
      setRoles(roleItems);
      setPermissions(permissionItems);

      // Load current role's permissions
      const activeRole = roleItems.find(r => r.code === selectedRoleCode) || roleItems[0];
      if (activeRole) {
        if (activeRole.code !== selectedRoleCode) setSelectedRoleCode(activeRole.code);
        setRolePermissions(activeRole.permissions || []);
      }
    } catch (err: any) {
      setMatrixError(err?.message || 'Khong the tai cau hinh vai tro va quyen han');
      toast.error(err.message || 'Không thể tải cấu hình vai trò & quyền hạn');
    } finally {
      setLoadingMatrix(false);
    }
  };

  useEffect(() => {
    if (subTab === 'USERS') {
      fetchUsers();
    } else {
      fetchMatrixData();
    }
  }, [subTab, page, roleFilter, statusFilter, canReadUsers, canReadMatrix]);

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (page === 1) {
      void fetchUsers();
    } else {
      setPage(1);
    }
  };

  // Reload selected user details
  const fetchUserDetail = async (userId: string) => {
    if (!canReadUsers) return;
    try {
      const res = await httpClient.get<any>(`/admin/users/${userId}`);
      setSelectedUser(res as UserItem);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải chi tiết người dùng');
    }
  };

  // Guard Helper: check if target user is the logged-in admin
  const isSelf = (targetUserId: string) => {
    if (!currentAdmin) return false;
    const adminId = currentAdmin.id || '';
    return adminId.toString() === targetUserId.toString();
  };

  // Edit Roles (PATCH /admin/users/:id/roles)
  const handleEditRoles = async (user: UserItem) => {
    if (!canManageUsers) return;
    // Safety guard check
    const isSelfAdmin = isSelf(user.id);

    // Initial role flags
    const hasCustomer = user.roles.includes('CUSTOMER');
    const hasProvider = user.roles.includes('PROVIDER');
    const hasAdmin = user.roles.includes('ADMIN') || user.roles.includes('admin');

    const { value: formResult } = await Swal.fire({
      title: `Thay đổi vai trò của ${user.fullName}`,
      html: `
        <div style="text-align: left; font-size: 14px; font-family: inherit;">
          <p style="color: #7A7A7A; margin-bottom: 12px;">Chọn các vai trò áp dụng cho tài khoản này:</p>

          <div style="margin-bottom: 8px;">
            <input type="checkbox" id="role-customer" ${hasCustomer ? 'checked' : ''} style="margin-right: 6px; accent-color: #4A0E17;">
            <label htmlFor="role-customer" style="font-weight: 600;">CUSTOMER (Khách hàng)</label>
          </div>

          <div style="margin-bottom: 8px;">
            <input type="checkbox" id="role-provider" ${hasProvider ? 'checked' : ''} style="margin-right: 6px; accent-color: #4A0E17;">
            <label htmlFor="role-provider" style="font-weight: 600;">PROVIDER (Đối tác cung cấp)</label>
          </div>

          <div style="margin-bottom: 16px;">
            <input type="checkbox" id="role-admin" ${hasAdmin ? 'checked' : ''} ${isSelfAdmin ? 'disabled' : ''} style="margin-right: 6px; accent-color: #4A0E17;">
            <label htmlFor="role-admin" style="font-weight: 600; color: ${isSelfAdmin ? '#A0A0A0' : '#2A2A2A'}">
              ADMIN (Quản trị viên) ${isSelfAdmin ? ' <span style="font-size: 11px; color: #4A0E17;">(Bạn không thể tự gỡ quyền admin)</span>' : ''}
            </label>
          </div>

          <div>
            <label style="font-weight: 700; color: #7A7A7A; font-size: 11px; display: block; margin-bottom: 4px;">LÝ DO CẬP NHẬT PHÂN QUYỀN *</label>
            <input id="swal-role-reason" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; height: 38px; font-size: 13px;" placeholder="Nhập lý do thay đổi vai trò...">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#4A0E17',
      confirmButtonText: 'Lưu thay đổi',
      cancelButtonText: 'Hủy',
      background: 'white',
      preConfirm: () => {
        const checkCust = (document.getElementById('role-customer') as HTMLInputElement).checked;
        const checkProv = (document.getElementById('role-provider') as HTMLInputElement).checked;
        const checkAdminRole = (document.getElementById('role-admin') as HTMLInputElement).checked;
        const reason = (document.getElementById('swal-role-reason') as HTMLInputElement).value;

        if (!reason || !reason.trim()) {
          Swal.showValidationMessage('Vui lòng nhập lý do thay đổi!');
          return false;
        }

        const selectedRoles: string[] = [];
        if (checkCust) selectedRoles.push('CUSTOMER');
        if (checkProv) selectedRoles.push('PROVIDER');
        if (checkAdminRole) selectedRoles.push('ADMIN');

        if (selectedRoles.length === 0) {
          Swal.showValidationMessage('Tài khoản phải có ít nhất một vai trò!');
          return false;
        }

        return { roles: selectedRoles, reason: reason.trim() };
      }
    });

    if (formResult) {
      try {
        await httpClient.patch(`/admin/users/${user.id}/roles`, formResult);
        toast.success('Cập nhật vai trò người dùng thành công!');
        fetchUsers();
        if (selectedUser && selectedUser.id === user.id) {
          fetchUserDetail(user.id);
        }
      } catch (err: any) {
        toast.error(err.message || 'Lỗi khi cập nhật vai trò');
      }
    }
  };

  // Lock / Unlock user accounts (PATCH /admin/users/:id/lock and /unlock)
  const handleLockUser = async (user: UserItem) => {
    if (!canManageUsers) return;
    // Safety guard check
    if (isSelf(user.id)) {
      Swal.fire({
        title: 'Thao tác bị chặn!',
        text: 'Bạn không thể tự khóa tài khoản quản trị hiện tại của chính mình!',
        icon: 'error',
        confirmButtonColor: '#4A0E17'
      });
      return;
    }

    const { value: lockForm } = await Swal.fire({
      title: `Khóa tài khoản ${user.fullName}`,
      html: `
        <div style="text-align: left; font-size: 14px; font-family: inherit;">
          <div style="margin-bottom: 12px;">
            <label style="font-weight: 700; color: #7A7A7A; font-size: 11px; display: block; margin-bottom: 4px;">PHƯƠNG THỨC KHÓA</label>
            <select id="lock-type" class="swal2-select" style="width: 100%; margin: 0; font-size: 13px; height: 38px;">
              <option value="SUSPENDED">Tạm đình chỉ (Suspended)</option>
              <option value="BANNED">Khóa vĩnh viễn (Banned)</option>
            </select>
          </div>

          <div id="date-container" style="margin-bottom: 12px;">
            <label style="font-weight: 700; color: #7A7A7A; font-size: 11px; display: block; margin-bottom: 4px;">KHÓA ĐẾN NGÀY (CHỈ DÀNH CHO TẠM ĐÌNH CHỈ)</label>
            <input type="datetime-local" id="lock-until" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; height: 38px; font-size: 13px;">
          </div>

          <div>
            <label style="font-weight: 700; color: #7A7A7A; font-size: 11px; display: block; margin-bottom: 4px;">LÝ DO KHÓA TÀI KHOẢN *</label>
            <input id="lock-reason" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; height: 38px; font-size: 13px;" placeholder="Ví dụ: Vi phạm điều khoản hủy lịch nhiều lần...">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#4A0E17',
      confirmButtonText: 'Khóa tài khoản',
      cancelButtonText: 'Hủy',
      background: 'white',
      didOpen: () => {
        const select = document.getElementById('lock-type') as HTMLSelectElement;
        const dateContainer = document.getElementById('date-container') as HTMLDivElement;

        // Set default lock until date (tomorrow)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
        (document.getElementById('lock-until') as HTMLInputElement).value = tomorrow.toISOString().slice(0, 16);

        select.addEventListener('change', () => {
          if (select.value === 'BANNED') {
            dateContainer.style.display = 'none';
          } else {
            dateContainer.style.display = 'block';
          }
        });
      },
      preConfirm: () => {
        const type = (document.getElementById('lock-type') as HTMLSelectElement).value;
        const lockedUntil = (document.getElementById('lock-until') as HTMLInputElement).value;
        const reason = (document.getElementById('lock-reason') as HTMLInputElement).value;

        if (!reason || !reason.trim()) {
          Swal.showValidationMessage('Vui lòng nhập lý do khóa!');
          return false;
        }

        if (type === 'SUSPENDED') {
          if (!lockedUntil) {
            Swal.showValidationMessage('Vui lòng chọn ngày mở khóa tạm thời!');
            return false;
          }
          if (new Date(lockedUntil).getTime() <= Date.now()) {
            Swal.showValidationMessage('Thời hạn khóa phải nằm trong tương lai!');
            return false;
          }
        }

        return {
          type,
          lockedUntil: type === 'SUSPENDED' ? new Date(lockedUntil).toISOString() : undefined,
          reason: reason.trim()
        };
      }
    });

    if (lockForm) {
      try {
        await httpClient.patch(`/admin/users/${user.id}/lock`, lockForm);
        toast.success(`Đã khóa tài khoản của ${user.fullName}`);
        fetchUsers();
        if (selectedUser && selectedUser.id === user.id) {
          fetchUserDetail(user.id);
        }
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
      inputPlaceholder: 'Ví dụ: Đã xác thực thông tin / Cam kết không tái phạm...',
      inputAttributes: { required: 'true' },
      showCancelButton: true,
      confirmButtonColor: '#706E3B',
      cancelButtonColor: '#7A7A7A',
      confirmButtonText: 'Mở khóa tài khoản',
      cancelButtonText: 'Quay lại',
      background: 'white',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Vui lòng nhập lý do mở khóa tài khoản!';
        }
        return null;
      }
    });

    if (reason) {
      try {
        await httpClient.patch(`/admin/users/${user.id}/unlock`, { reason: reason.trim() });
        toast.success(`Đã mở khóa tài khoản của ${user.fullName}`);
        fetchUsers();
        if (selectedUser && selectedUser.id === user.id) {
          fetchUserDetail(user.id);
        }
      } catch (err: any) {
        toast.error(err.message || 'Mở khóa tài khoản thất bại');
      }
    }
  };

  // Matrix permission checkbox change
  const handlePermissionToggle = (permCode: string) => {
    if (!canManageMatrix) return;
    setRolePermissions(prev =>
      prev.includes(permCode) ? prev.filter(c => c !== permCode) : [...prev, permCode]
    );
  };

  // Save role permissions matrix update
  const handleSaveMatrix = async () => {
    if (!canManageMatrix) return;
    const roleObj = roles.find(r => r.code === selectedRoleCode);
    if (!roleObj) return;

    const { value: reason } = await Swal.fire({
      title: `Cập nhật quyền hạn cho vai trò: ${roleObj.name}`,
      text: 'Mọi tài khoản có vai trò này sẽ lập tức chịu ảnh hưởng bởi ma trận phân quyền mới.',
      input: 'textarea',
      inputLabel: 'Nhập lý do cập nhật ma trận quyền *',
      inputPlaceholder: 'Ví dụ: Bổ sung quyền cập nhật danh mục cho nhân viên / Thu hồi quyền xóa...',
      inputAttributes: { required: 'true' },
      showCancelButton: true,
      confirmButtonColor: '#4A0E17',
      confirmButtonText: 'Xác nhận lưu',
      cancelButtonText: 'Quay lại',
      background: 'white',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Vui lòng nhập lý do điều chỉnh quyền hạn!';
        }
        return null;
      }
    });

    if (reason) {
      try {
        await httpClient.patch(`/admin/roles/${selectedRoleCode}/permissions`, {
          permissions: rolePermissions,
          reason: reason.trim()
        });
        toast.success('Đã lưu cấu hình ma trận phân quyền mới!');
        await refreshPermissions();
        await fetchMatrixData();
      } catch (err: any) {
        toast.error(err.message || 'Cập nhật ma trận quyền thất bại');
      }
    }
  };

  // Load active role permissions when selection changes
  useEffect(() => {
    const roleObj = roles.find(r => r.code === selectedRoleCode);
    if (roleObj) {
      setRolePermissions(roleObj.permissions || []);
    }
  }, [selectedRoleCode, roles]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Sub-tab Selectors */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E8E2D5', gap: '8px' }}>
        <button
          onClick={() => setSubTab('USERS')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            color: subTab === 'USERS' ? '#4A0E17' : '#7A7A7A',
            borderBottom: subTab === 'USERS' ? '3px solid #4A0E17' : '3px solid transparent',
            transition: 'all 0.15s'
          }}
        >
          Danh sách người dùng & Phân quyền
        </button>
        <button
          disabled={!canReadMatrix}
          onClick={() => canReadMatrix && setSubTab('MATRIX')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: canReadMatrix ? 'pointer' : 'not-allowed',
            color: !canReadMatrix ? '#B8B3AA' : subTab === 'MATRIX' ? '#4A0E17' : '#7A7A7A',
            borderBottom: subTab === 'MATRIX' ? '3px solid #4A0E17' : '3px solid transparent',
            transition: 'all 0.15s'
          }}
        >
          Ma trận phân quyền (Role-Permissions Matrix)
        </button>
      </div>

      {subTab === 'USERS' ? (
        /* TAB 1: ACCOUNTS LIST */
        <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 360px' : '1fr', gap: '24px', transition: 'all 0.3s' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Filter toolbar */}
            <form onSubmit={handleSearchSubmit} style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              backgroundColor: 'white',
              padding: '16px 20px',
              borderRadius: '8px',
              border: '1px solid #E8E2D5'
            }}>
              <div style={{
                display: 'flex',
                flex: 1,
                maxWidth: '380px',
                alignItems: 'center',
                border: '1px solid #E8E2D5',
                borderRadius: '6px',
                padding: '0 12px',
                backgroundColor: '#FAF6F0'
              }}>
                <Search size={16} color="#7A7A7A" />
                <input
                  type="text"
                  placeholder="Tìm theo email, tên hoặc số điện thoại..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: 'none', background: 'none', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <select
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', backgroundColor: 'white', fontWeight: 600 }}
                >
                  <option value="">Lọc theo vai trò (Roles)</option>
                  <option value="CUSTOMER">Customer (Khách)</option>
                  <option value="PROVIDER">Provider (Đối tác)</option>
                  <option value="ADMIN">Admin (Quản trị)</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', backgroundColor: 'white', fontWeight: 600 }}
                >
                  <option value="">Lọc trạng thái tài khoản</option>
                  <option value="ACTIVE">Hoạt động (Active)</option>
                  <option value="SUSPENDED">Bị tạm ngưng (Suspended)</option>
                  <option value="BANNED">Đã khóa (Banned)</option>
                </select>

                <button
                  type="submit"
                  style={{ backgroundColor: '#4A0E17', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Lọc
                </button>
              </div>
            </form>

            {/* Users Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TÀI KHOẢN NGƯỜI DÙNG</th>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>EMAIL / SĐT</th>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>VAI TRÒ</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TRẠNG THÁI</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px', width: '130px' }}>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Đang tải danh sách tài khoản...</td>
                    </tr>
                  ) : usersError ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#991B1B' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <span>{usersError}</span>
                          <button onClick={() => void fetchUsers()} style={{ padding: '7px 14px', border: '1px solid #4A0E17', borderRadius: '6px', background: 'white', color: '#4A0E17', cursor: 'pointer', fontWeight: 700 }}>Thu lai</button>
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Không có tài khoản nào phù hợp</td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isBanned = u.status === 'BANNED' || u.status === 'SUSPENDED';
                      const isSelfAccount = isSelf(u.id);

                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid #FAF6F0', backgroundColor: selectedUser?.id === u.id ? '#FFF9F9' : 'transparent' }}>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => fetchUserDetail(u.id)}>
                              <img
                                src={u.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'}
                                alt={u.fullName}
                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: isSelfAccount ? '2px solid #4A0E17' : '1px solid #E8E2D5' }}
                              />
                              <div>
                                <strong style={{ color: '#2A2A2A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {u.fullName}
                                  {isSelfAccount && <span style={{ fontSize: '9px', fontWeight: 700, color: '#4A0E17', backgroundColor: '#FFF5F5', padding: '2px 4px', borderRadius: '4px', border: '1px solid #4A0E17' }}>BẠN</span>}
                                </strong>
                                <span style={{ fontSize: '10px', color: '#7A7A7A' }}>ID: {u.id}</span>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '16px 20px' }}>
                            <span style={{ fontWeight: 600, display: 'block', color: '#2A2A2A' }}>{u.email}</span>
                            <span style={{ fontSize: '11px', color: '#7A7A7A' }}>{u.phone || 'Chưa cung cấp'}</span>
                          </td>

                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {u.roles.map(role => (
                                <span key={role} style={{
                                  padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                                  backgroundColor: role === 'ADMIN' ? '#4A0E17' : role === 'PROVIDER' ? '#FAF6F0' : '#E8E2D5',
                                  color: role === 'ADMIN' ? 'white' : role === 'PROVIDER' ? '#706E3B' : '#2A2A2A',
                                  border: '1px solid #E8E2D5'
                                }}>
                                  {role}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                              backgroundColor: u.status === 'ACTIVE' ? '#F0FDF4' : u.status === 'BANNED' ? '#FEE2E2' : '#FEF3C7',
                              color: u.status === 'ACTIVE' ? '#166534' : u.status === 'BANNED' ? '#991B1B' : '#92400E'
                            }}>
                              {u.status === 'ACTIVE' ? 'Hoạt động' : u.status === 'BANNED' ? 'Khóa' : u.status === 'SUSPENDED' ? 'Tạm ngưng' : u.status}
                            </span>
                          </td>

                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                disabled={!canManageUsers}
                                onClick={() => handleEditRoles(u)}
                                style={{ padding: '6px', border: 'none', borderRadius: '4px', backgroundColor: canManageUsers ? '#FAF6F0' : '#F3F4F6', cursor: canManageUsers ? 'pointer' : 'not-allowed', color: canManageUsers ? '#706E3B' : '#A0A0A0' }}
                                title={canManageUsers ? 'Phân vai trò' : 'Bạn chỉ có quyền xem'}
                              >
                                <Edit size={13} />
                              </button>

                              {/* Lock / Unlock buttons with safety guards */}
                              {isBanned ? (
                                <button
                                  onClick={() => handleUnlockUser(u)}
                                  disabled={!canManageUsers}
                                  style={{ padding: '6px', border: 'none', borderRadius: '4px', backgroundColor: canManageUsers ? '#F0FDF4' : '#F3F4F6', cursor: canManageUsers ? 'pointer' : 'not-allowed', color: canManageUsers ? '#166534' : '#A0A0A0' }}
                                  title={canManageUsers ? 'Mở khóa tài khoản' : 'Bạn chỉ có quyền xem'}
                                >
                                  <Unlock size={13} />
                                </button>
                              ) : (
                                <button
                                  disabled={isSelfAccount || !canManageUsers}
                                  onClick={() => handleLockUser(u)}
                                  style={{
                                    padding: '6px', border: 'none', borderRadius: '4px',
                                    backgroundColor: isSelfAccount || !canManageUsers ? '#F3F4F6' : '#FFF5F5',
                                    color: isSelfAccount || !canManageUsers ? '#A0A0A0' : '#E53E3E',
                                    cursor: isSelfAccount || !canManageUsers ? 'not-allowed' : 'pointer'
                                  }}
                                  title={isSelfAccount ? 'Bạn không thể tự khóa chính mình' : canManageUsers ? 'Khóa tài khoản' : 'Bạn chỉ có quyền xem'}
                                >
                                  <Lock size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Pagination controls */}
              {totalUsers > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '16px 20px', borderTop: '1px solid #E8E2D5', backgroundColor: '#FAF6F0' }}>
                  <span style={{ fontSize: '12px', color: '#7A7A7A' }}>{totalUsers.toLocaleString('vi-VN')} tài khoản</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button disabled={page === 1} onClick={() => setPage(page - 1)} style={{ padding: '6px 12px', border: '1px solid #E8E2D5', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Trước</button>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{page} / {totalPages}</span>
                  <button disabled={page === totalPages} onClick={() => setPage(page + 1)} style={{ padding: '6px 12px', border: '1px solid #E8E2D5', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Sau</button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* User Details Drawer Panel */}
          {selectedUser && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #E8E2D5',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E8E2D5', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <img src={selectedUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#4A0E17' }}>{selectedUser.fullName}</h3>
                    <span style={{ fontSize: '11px', color: '#7A7A7A' }}>ID: {selectedUser.id}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7A7A7A' }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#7A7A7A' }}>Email:</span>
                  <strong style={{ color: '#2A2A2A' }}>{selectedUser.email}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#7A7A7A' }}>Điện thoại:</span>
                  <strong style={{ color: '#2A2A2A' }}>{selectedUser.phone || 'Chưa có'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#7A7A7A' }}>Vai trò hiện tại:</span>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {selectedUser.roles.map(r => (
                      <span key={r} style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#FAF6F0', color: '#706E3B', padding: '1px 4px', borderRadius: '3px' }}>{r}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#7A7A7A' }}>Trạng thái tài khoản:</span>
                  <strong style={{ color: selectedUser.status === 'ACTIVE' ? '#166534' : '#E53E3E' }}>{selectedUser.status}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#7A7A7A' }}>Ngày tạo:</span>
                  <strong>{new Date(selectedUser.createdAt).toLocaleDateString('vi-VN')}</strong>
                </div>
                {selectedUser.lockedUntil && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#FFF5F5', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #E53E3E', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#C53030', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> BỊ KHÓA ĐẾN:</span>
                    <strong style={{ color: '#C53030' }}>{new Date(selectedUser.lockedUntil).toLocaleString('vi-VN')}</strong>
                  </div>
                )}
                {selectedUser.lockedReason && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#FFF8F8', padding: '10px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#991B1B' }}>LÝ DO KHÓA</span>
                    <span style={{ color: '#5F1D25' }}>{selectedUser.lockedReason}</span>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #E8E2D5', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#4A0E17', fontWeight: 800 }}>NHẬT KÝ ĐĂNG NHẬP GẦN ĐÂY</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#7A7A7A' }}>
                  {(selectedUser.recentLoginHistory || []).length === 0 ? (
                    <div style={{ padding: '8px', backgroundColor: '#FAF6F0', borderRadius: '4px' }}>Chưa có lịch sử đăng nhập.</div>
                  ) : selectedUser.recentLoginHistory?.map((entry) => (
                    <div key={entry.id} style={{ padding: '8px', backgroundColor: entry.status === 'SUCCESS' ? '#F0FDF4' : '#FFF5F5', borderRadius: '4px' }}>
                      <strong style={{ color: entry.status === 'SUCCESS' ? '#166534' : '#991B1B' }}>{entry.status === 'SUCCESS' ? 'Đăng nhập thành công' : 'Đăng nhập thất bại'}</strong>
                      <span style={{ display: 'block', marginTop: '2px' }}>{entry.provider} · {new Date(entry.loggedInAt).toLocaleString('vi-VN')}</span>
                      <span style={{ display: 'block', marginTop: '2px' }}>{entry.ipAddress || 'Không rõ IP'}{entry.failureReason ? ` · ${entry.failureReason}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        /* TAB 2: ROLE-PERMISSIONS MATRIX */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #E8E2D5',
            padding: '24px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#4A0E17' }}>
              THIẾT LẬP QUYỀN HẠN CHO VAI TRÒ HỆ THỐNG
            </h3>

            {/* Role Select Bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              {roles.map(r => {
                const isSelected = selectedRoleCode === r.code;
                return (
                  <button
                    key={r.code}
                    onClick={() => setSelectedRoleCode(r.code)}
                    style={{
                      padding: '10px 18px',
                      border: isSelected ? '1px solid #4A0E17' : '1px solid #E8E2D5',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#4A0E17' : 'white',
                      color: isSelected ? 'white' : '#2A2A2A',
                      transition: 'all 0.15s'
                    }}
                  >
                    {r.name} ({r.code})
                  </button>
                );
              })}
            </div>

            {/* Matrix grid checklist */}
            {loadingMatrix ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Đang tải ma trận quyền...</div>
            ) : matrixError ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#991B1B' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <span>{matrixError}</span>
                  <button onClick={() => void fetchMatrixData()} style={{ padding: '7px 14px', border: '1px solid #4A0E17', borderRadius: '6px', background: 'white', color: '#4A0E17', cursor: 'pointer', fontWeight: 700 }}>Thu lai</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#7A7A7A' }}>
                  {roles.find(r => r.code === selectedRoleCode)?.description || 'Chưa thiết lập mô tả vai trò'}
                </p>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  border: '1px solid #E8E2D5',
                  borderRadius: '8px',
                  padding: '20px',
                  backgroundColor: '#FAF6F0'
                }}>
                  {permissions.map((p) => {
                    const isChecked = rolePermissions.includes(p.code);

                    return (
                      <div
                        key={p.code}
                        onClick={() => handlePermissionToggle(p.code)}
                        style={{
                          padding: '10px 14px',
                          backgroundColor: 'white',
                          border: isChecked ? '1px solid #4A0E17' : '1px solid #E8E2D5',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          cursor: canManageMatrix ? 'pointer' : 'not-allowed',
                          opacity: canManageMatrix ? 1 : 0.7,
                          transition: 'all 0.15s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!canManageMatrix}
                          onChange={() => {}} // Controlled click via parent div onClick
                          style={{ marginTop: '3px', accentColor: '#4A0E17', cursor: 'pointer' }}
                        />
                        <div>
                          <strong style={{ fontSize: '13px', color: '#2A2A2A', display: 'block' }}>{p.name}</strong>
                          <span style={{ fontSize: '11px', color: '#7A7A7A', display: 'block', marginTop: '2px' }}>Quyền: <code style={{ color: '#4A0E17' }}>{p.code}</code></span>
                          <span style={{ fontSize: '11px', color: '#A0A0A0', display: 'block', marginTop: '2px' }}>{p.description}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Save action button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E8E2D5', paddingTop: '16px' }}>
                  <button
                    disabled={!canManageMatrix}
                    onClick={handleSaveMatrix}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: canManageMatrix ? '#4A0E17' : '#A0A0A0',
                      color: 'white',
                      border: 'none',
                      padding: '10px 24px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: canManageMatrix ? 'pointer' : 'not-allowed',
                      boxShadow: '0 2px 4px rgba(74,14,23,0.15)'
                    }}
                  >
                    <ShieldCheck size={16} /> {canManageMatrix ? 'Lưu Ma Trận Phân Quyền' : 'Chỉ có quyền xem'}
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};
