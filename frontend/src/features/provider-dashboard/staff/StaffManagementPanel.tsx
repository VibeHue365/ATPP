import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarOff,
  Check,
  Copy,
  KeyRound,
  Lock,
  LockOpen,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  staffApi,
  type ProviderStaffItem,
  type ProviderStaffSummary,
} from './staffApi';
import './staffManagement.css';

interface StaffManagementPanelProps {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info?: (msg: string) => void;
  };
}

interface GeneratedCredentials {
  staffName: string;
  email: string;
  password: string;
  title: string;
}

export const StaffManagementPanel: React.FC<StaffManagementPanelProps> = ({
  toast,
}) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ProviderStaffSummary | null>(null);
  const [items, setItems] = useState<ProviderStaffItem[]>([]);

  // Capacity state (2A: Auto = active staff count, or Manual ceiling)
  const [capacityMode, setCapacityMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [maxConcurrentInput, setMaxConcurrentInput] = useState<string>('1');
  const [dailyLimitEnabled, setDailyLimitEnabled] = useState<boolean>(false);
  const [maxDailyInput, setMaxDailyInput] = useState<string>('');
  const [savingCapacity, setSavingCapacity] = useState(false);

  // Add / Edit modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<ProviderStaffItem | null>(
    null,
  );
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formExperience, setFormExperience] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formCreateAccount, setFormCreateAccount] = useState(false);
  const [formAccountEmail, setFormAccountEmail] = useState('');
  const [formAccountPassword, setFormAccountPassword] = useState('');
  const [savingStaff, setSavingStaff] = useState(false);

  // Provision / Reset Password modal
  const [accountModalMode, setAccountModalMode] = useState<
    'provision' | 'reset' | null
  >(null);
  const [accountTargetStaff, setAccountTargetStaff] =
    useState<ProviderStaffItem | null>(null);
  const [accountEmailInput, setAccountEmailInput] = useState('');
  const [accountPassInput, setAccountPassInput] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Generated credentials one-time modal
  const [generatedCreds, setGeneratedCreds] =
    useState<GeneratedCredentials | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Off-days / Blocked slots modal
  const [blocksTargetStaff, setBlocksTargetStaff] =
    useState<ProviderStaffItem | null>(null);
  const [blockDate, setBlockDate] = useState('');
  const [blockFullDay, setBlockFullDay] = useState(true);
  const [blockStartTime, setBlockStartTime] = useState('08:00');
  const [blockEndTime, setBlockEndTime] = useState('12:00');
  const [blockReason, setBlockReason] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);

  const [blockingAlert, setBlockingAlert] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const res = await staffApi.listMine();
      setSummary(res.summary);
      setItems(Array.isArray(res.items) ? res.items : []);
      const hasManualCap =
        res.summary.maxConcurrentSessions !== null &&
        res.summary.maxConcurrentSessions !== undefined &&
        res.summary.maxConcurrentSessions > 0;
      setCapacityMode(hasManualCap ? 'MANUAL' : 'AUTO');
      setMaxConcurrentInput(
        String(
          res.summary.maxConcurrentSessions ??
            res.summary.effectiveCapacity ??
            Math.max(1, res.summary.activeStaff ?? 1),
        ),
      );
      setDailyLimitEnabled(res.summary.maxDailySessions != null);
      setMaxDailyInput(
        res.summary.maxDailySessions != null
          ? String(res.summary.maxDailySessions)
          : '',
      );
      if (blocksTargetStaff) {
        const refreshedTarget = (res.items || []).find(
          (it) => it._id === blocksTargetStaff._id,
        );
        if (refreshedTarget) setBlocksTargetStaff(refreshedTarget);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải danh sách thợ chụp.');
    } finally {
      setLoading(false);
    }
  }, [blocksTargetStaff?._id]);

  useEffect(() => {
    void loadStaff();
  }, []);

  const handleSaveCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeCount = summary?.activeStaff ?? 0;
    const maxAllowed = Math.max(1, activeCount);

    let nextMaxConcurrent: number | null = null;
    if (capacityMode === 'MANUAL') {
      const parsedConcurrent = Number(maxConcurrentInput);
      if (
        !Number.isInteger(parsedConcurrent) ||
        parsedConcurrent < 1 ||
        parsedConcurrent > maxAllowed
      ) {
        toast.error(
          activeCount === 0
            ? 'Studio chưa có thợ hoạt động nên sức chứa đồng thời tối đa là 1.'
            : `Số ca đồng thời phải nằm trong khoảng từ 1 đến ${activeCount}.`,
        );
        return;
      }
      nextMaxConcurrent = parsedConcurrent;
    }

    let parsedDaily: number | null = null;
    if (dailyLimitEnabled) {
      if (maxDailyInput.trim() === '') {
        toast.error('Vui lòng nhập giới hạn tối đa ca/ngày hoặc tắt tuỳ chọn này.');
        return;
      }
      parsedDaily = Number(maxDailyInput);
      if (!Number.isInteger(parsedDaily) || parsedDaily < 1 || parsedDaily > 100) {
        toast.error('Giới hạn số ca mỗi ngày phải là số nguyên từ 1 đến 100.');
        return;
      }
    }

    try {
      setSavingCapacity(true);
      await staffApi.updateCapacity({
        maxConcurrentSessions: nextMaxConcurrent,
        maxDailySessions: parsedDaily,
      });
      toast.success(
        capacityMode === 'AUTO'
          ? 'Đã bật chế độ Tự động mở slot theo số thợ rảnh.'
          : `Đã lưu giới hạn tối đa ${nextMaxConcurrent} ca đồng thời mỗi khung giờ.`,
      );
      await loadStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể cập nhật sức chứa.');
    } finally {
      setSavingCapacity(false);
    }
  };

  const openAddModal = () => {
    setEditingStaff(null);
    setFormName('');
    setFormPhone('');
    setFormSpecialty('');
    setFormExperience('');
    setFormBio('');
    setFormNote('');
    setFormCreateAccount(false);
    setFormAccountEmail('');
    setFormAccountPassword('');
    setIsStaffModalOpen(true);
  };

  const openEditModal = (staff: ProviderStaffItem) => {
    setEditingStaff(staff);
    setFormName(staff.name);
    setFormPhone(staff.phone);
    setFormSpecialty(staff.specialty ?? '');
    setFormExperience(
      staff.experienceYears != null ? String(staff.experienceYears) : '',
    );
    setFormBio(staff.bio ?? '');
    setFormNote(staff.internalNote ?? '');
    setFormCreateAccount(false);
    setFormAccountEmail('');
    setFormAccountPassword('');
    setIsStaffModalOpen(true);
  };

  const handleSubmitStaffModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      toast.error('Vui lòng nhập đầy đủ họ tên và số điện thoại thợ.');
      return;
    }

    const expNum =
      formExperience.trim() !== '' ? Number(formExperience.trim()) : null;
    if (expNum !== null && (!Number.isInteger(expNum) || expNum < 0 || expNum > 60)) {
      toast.error('Số năm kinh nghiệm phải từ 0 đến 60.');
      return;
    }

    try {
      setSavingStaff(true);
      if (editingStaff) {
        await staffApi.update(editingStaff._id, {
          name: formName.trim(),
          phone: formPhone.trim(),
          specialty: formSpecialty.trim() || null,
          bio: formBio.trim() || null,
          experienceYears: expNum,
          internalNote: formNote.trim() || null,
        });
        toast.success(`Đã cập nhật hồ sơ thợ ${formName.trim()}.`);
      } else {
        if (formCreateAccount && !formAccountEmail.trim()) {
          toast.error('Vui lòng nhập email để tạo tài khoản STAFF.');
          return;
        }
        const created = await staffApi.create({
          name: formName.trim(),
          phone: formPhone.trim(),
          specialty: formSpecialty.trim() || null,
          bio: formBio.trim() || null,
          experienceYears: expNum,
          internalNote: formNote.trim() || null,
          ...(formCreateAccount
            ? {
                createAccount: true,
                email: formAccountEmail.trim(),
                ...(formAccountPassword.trim()
                  ? { password: formAccountPassword.trim() }
                  : {}),
              }
            : {}),
        });
        toast.success(`Đã thêm thợ chụp ${formName.trim()}.`);
        if (created.temporaryPassword && created.staffAccount?.email) {
          setCopiedCreds(false);
          setGeneratedCreds({
            staffName: formName.trim(),
            email: created.staffAccount.email,
            password: created.temporaryPassword,
            title: 'Tài khoản đăng nhập STAFF vừa tạo',
          });
        }
      }
      setIsStaffModalOpen(false);
      await loadStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu thông tin thợ chụp.');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleToggleRosterStatus = async (staff: ProviderStaffItem) => {
    const nextStatus = staff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setBlockingAlert(null);
    try {
      await staffApi.updateStatus(staff._id, nextStatus);
      toast.success(
        nextStatus === 'ACTIVE'
          ? `Đã kích hoạt lại thợ ${staff.name}.`
          : `Đã tạm ngưng hoạt động thợ ${staff.name}.`,
      );
      await loadStaff();
    } catch (err: any) {
      const msg = err?.message || 'Không thể đổi trạng thái hoạt động.';
      setBlockingAlert(msg);
      toast.error(msg);
    }
  };

  const openProvisionModal = (staff: ProviderStaffItem) => {
    setAccountTargetStaff(staff);
    setAccountModalMode('provision');
    setAccountEmailInput('');
    setAccountPassInput('');
  };

  const openResetModal = (staff: ProviderStaffItem) => {
    setAccountTargetStaff(staff);
    setAccountModalMode('reset');
    setAccountEmailInput(staff.staffAccount?.email ?? '');
    setAccountPassInput('');
  };

  const handleSubmitAccountModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountTargetStaff || !accountModalMode) return;
    try {
      setSavingAccount(true);
      if (accountModalMode === 'provision') {
        if (!accountEmailInput.trim()) {
          toast.error('Vui lòng nhập email đăng nhập cho thợ.');
          return;
        }
        const res = await staffApi.provisionAccount(accountTargetStaff._id, {
          email: accountEmailInput.trim(),
          ...(accountPassInput.trim()
            ? { password: accountPassInput.trim() }
            : {}),
        });
        toast.success(`Đã cấp tài khoản cho thợ ${accountTargetStaff.name}.`);
        if (res.temporaryPassword) {
          setCopiedCreds(false);
          setGeneratedCreds({
            staffName: accountTargetStaff.name,
            email: res.email,
            password: res.temporaryPassword,
            title: 'Tài khoản đăng nhập STAFF vừa cấp',
          });
        }
      } else {
        const res = await staffApi.resetPassword(accountTargetStaff._id, {
          ...(accountPassInput.trim()
            ? { newPassword: accountPassInput.trim() }
            : {}),
        });
        toast.success(
          `Đã đặt lại mật khẩu và thu hồi phiên cũ của ${accountTargetStaff.name}.`,
        );
        if (res.temporaryPassword) {
          setCopiedCreds(false);
          setGeneratedCreds({
            staffName: accountTargetStaff.name,
            email: accountTargetStaff.staffAccount?.email || '',
            password: res.temporaryPassword,
            title: 'Mật khẩu mới của tài khoản STAFF',
          });
        }
      }
      setAccountModalMode(null);
      await loadStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Thao tác tài khoản thất bại.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleToggleAccountLock = async (staff: ProviderStaffItem) => {
    if (!staff.linkedUserId || !staff.staffAccount) return;
    const isCurrentlyLocked = staff.staffAccount.status === 'SUSPENDED';
    try {
      await staffApi.toggleAccountLock(staff._id, {
        locked: !isCurrentlyLocked,
        ...(isCurrentlyLocked
          ? {}
          : { reason: 'Tạm khóa tài khoản bởi chủ Studio' }),
      });
      toast.success(
        isCurrentlyLocked
          ? `Đã mở khóa tài khoản đăng nhập cho ${staff.name}.`
          : `Đã khóa tài khoản đăng nhập của ${staff.name}.`,
      );
      await loadStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể thay đổi trạng thái khóa.');
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blocksTargetStaff || !blockDate) {
      toast.error('Vui lòng chọn ngày nghỉ.');
      return;
    }
    try {
      setSavingBlock(true);
      await staffApi.addBlock(blocksTargetStaff._id, {
        date: blockDate,
        ...(blockFullDay
          ? {}
          : { startTime: blockStartTime, endTime: blockEndTime }),
        reason: blockReason.trim() || null,
      });
      toast.success(`Đã thêm lịch nghỉ cho thợ ${blocksTargetStaff.name}.`);
      setBlockReason('');
      await loadStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể thêm lịch nghỉ.');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleRemoveBlock = async (staffId: string, blockId: string) => {
    try {
      await staffApi.removeBlock(staffId, blockId);
      toast.success('Đã gỡ lịch nghỉ.');
      await loadStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xóa lịch nghỉ.');
    }
  };

  const copyCredentialsToClipboard = async () => {
    if (!generatedCreds) return;
    const text = `Tài khoản TàGo (Thợ chụp - ${generatedCreds.staffName})\nEmail: ${generatedCreds.email}\nMật khẩu: ${generatedCreds.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreds(true);
    } catch {
      toast.info?.('Hãy sao chép thủ công thông tin ở khung trên.');
    }
  };

  return (
    <div className="pstaff-container">
      {/* Header */}
      <div className="pstaff-header">
        <div>
          <h2 className="pstaff-title">Quản lý Đội ngũ Thợ chụp</h2>
          <p className="pstaff-subtitle">
            Khai báo danh sách nhiếp ảnh gia thuộc Studio, thiết lập số ca nhận
            trùng giờ, lịch nghỉ riêng và cấp tài khoản STAFF tác nghiệp.
          </p>
        </div>
        <button
          type="button"
          className="pstaff-primary-btn"
          onClick={openAddModal}
        >
          <Plus size={16} />
          <span>Thêm thợ chụp mới</span>
        </button>
      </div>

      {/* 4 KPI Cards */}
      <div className="pstaff-kpi-grid">
        <div className="pstaff-kpi-card">
          <span className="pstaff-kpi-label">Thợ đang hoạt động</span>
          <span className="pstaff-kpi-value">
            {summary?.activeStaff ?? 0} / {summary?.totalStaff ?? 0}
          </span>
          <span className="pstaff-kpi-meta">
            Tạm ngưng: {summary?.inactiveStaff ?? 0} thợ
          </span>
        </div>

        <div className="pstaff-kpi-card">
          <span className="pstaff-kpi-label">Sức chứa nhận trùng giờ</span>
          <span className="pstaff-kpi-value">
            {summary?.effectiveCapacity ?? 1} ca / khung giờ
          </span>
          <span className="pstaff-kpi-meta">
            {summary?.maxConcurrentSessions == null
              ? 'Tự động theo số thợ rảnh'
              : `Giới hạn thủ công: tối đa ${summary.maxConcurrentSessions} ca/giờ`}
            {summary?.maxDailySessions
              ? ` · ${summary.maxDailySessions} ca/ngày`
              : ''}
          </span>
        </div>

        <div className="pstaff-kpi-card">
          <span className="pstaff-kpi-label">Thợ có ca hôm nay</span>
          <span className="pstaff-kpi-value">{summary?.activeTodayCount ?? 0}</span>
          <span className="pstaff-kpi-meta">Theo lịch chụp trong ngày (ICT)</span>
        </div>

        <div className="pstaff-kpi-card">
          <span className="pstaff-kpi-label">Đơn chờ phân công thợ</span>
          <span
            className="pstaff-kpi-value"
            style={{
              color:
                (summary?.pendingAssignmentCount ?? 0) > 0
                  ? '#b45309'
                  : '#047857',
            }}
          >
            {summary?.pendingAssignmentCount ?? 0}
          </span>
          <span className="pstaff-kpi-meta">
            Chọn thợ khi duyệt đơn trong Đơn đặt lịch
          </span>
        </div>
      </div>

      {blockingAlert && (
        <div
          role="alert"
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{blockingAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setBlockingAlert(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Capacity Settings (2A: Auto default + Optional Manual Cap) */}
      <form className="pstaff-capacity-card" onSubmit={handleSaveCapacity}>
        <div className="pstaff-capacity-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal size={18} color="#8E1B2E" />
            <strong style={{ fontSize: '15px', color: '#231f20' }}>
              Cấu hình sức chứa nhận ca đồng thời
            </strong>
          </div>
          <span
            className={`pstaff-capacity-pill ${
              summary?.maxConcurrentSessions == null ? 'is-auto' : 'is-manual'
            }`}
          >
            Đang mở: {summary?.effectiveCapacity ?? 1} ca / khung giờ
            {summary?.maxConcurrentSessions == null ? ' (Tự động)' : ' (Giới hạn trần)'}
          </span>
        </div>

        <div className="pstaff-mode-grid" role="radiogroup" aria-label="Chế độ tính sức chứa nhận ca">
          <button
            type="button"
            role="radio"
            aria-checked={capacityMode === 'AUTO'}
            className={`pstaff-mode-option ${capacityMode === 'AUTO' ? 'is-active' : ''}`}
            onClick={() => setCapacityMode('AUTO')}
          >
            <div className="pstaff-mode-option__top">
              <span className="pstaff-mode-dot" />
              <strong>Tự động theo số thợ rảnh</strong>
              <span className="pstaff-mode-badge">Khuyên dùng</span>
            </div>
            <p className="pstaff-mode-option__desc">
              Có bao nhiêu thợ hoạt động (không báo bận) sẽ tự động mở bấy nhiêu suất trong cùng 1 khung giờ.
              Hiện tại: <strong>{Math.max(1, summary?.activeStaff ?? 0)} ca/giờ</strong>.
            </p>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={capacityMode === 'MANUAL'}
            className={`pstaff-mode-option ${capacityMode === 'MANUAL' ? 'is-active' : ''}`}
            onClick={() => {
              setCapacityMode('MANUAL');
              if (!maxConcurrentInput || Number(maxConcurrentInput) < 1) {
                setMaxConcurrentInput(String(Math.max(1, summary?.activeStaff ?? 1)));
              }
            }}
          >
            <div className="pstaff-mode-option__top">
              <span className="pstaff-mode-dot" />
              <strong>Giới hạn trần thủ công</strong>
            </div>
            <p className="pstaff-mode-option__desc">
              Chủ động đặt mức tối đa nhận trùng giờ (VD: có 3 thợ nhưng chỉ mở 2 ca để chừa thợ dự bị).
            </p>
          </button>
        </div>

        <div className="pstaff-capacity-form">
          {capacityMode === 'MANUAL' && (
            <div className="pstaff-field">
              <label htmlFor="pstaff-max-concurrent">
                Số ca đồng thời tối đa (1 – {Math.max(1, summary?.activeStaff ?? 0)})
              </label>
              <input
                id="pstaff-max-concurrent"
                type="number"
                min={1}
                max={Math.max(1, summary?.activeStaff ?? 1)}
                className="pstaff-input"
                value={maxConcurrentInput}
                onChange={(e) => setMaxConcurrentInput(e.target.value)}
              />
            </div>
          )}

          <div className="pstaff-daily-box">
            <label className="pstaff-daily-toggle">
              <input
                type="checkbox"
                checked={dailyLimitEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDailyLimitEnabled(checked);
                  if (checked && maxDailyInput.trim() === '') {
                    const activeCount = Math.max(1, summary?.activeStaff ?? 1);
                    setMaxDailyInput(String(activeCount * 3));
                  }
                }}
              />
              <span>Bật giới hạn tổng số ca chụp trong 1 ngày (tuỳ chọn)</span>
            </label>

            {!dailyLimitEnabled ? (
              <p className="pstaff-daily-note">
                Đang tắt — Không giới hạn tổng ca/ngày, Studio nhận khách theo sức chứa từng khung giờ.
              </p>
            ) : (
              <div className="pstaff-field" style={{ minWidth: 0 }}>
                <label htmlFor="pstaff-max-daily">
                  Giới hạn tối đa ca / ngày
                </label>
                <input
                  id="pstaff-max-daily"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="VD: 9"
                  className="pstaff-input"
                  value={maxDailyInput}
                  onChange={(e) => setMaxDailyInput(e.target.value)}
                />
                {(() => {
                  const activeStaffCount = summary?.activeStaff ?? 0;
                  const parsedDailyPreview = Number(maxDailyInput);
                  if (
                    activeStaffCount >= 2 &&
                    Number.isInteger(parsedDailyPreview) &&
                    parsedDailyPreview >= 1 &&
                    parsedDailyPreview <= activeStaffCount
                  ) {
                    return (
                      <p className="pstaff-daily-warn" role="status">
                        Lưu ý: Con số này giới hạn TỔNG số ca của cả ngày (sáng + chiều + tối),
                        không phải số ca cùng 1 giờ. Với {activeStaffCount} thợ, mức thông thường
                        nên từ {activeStaffCount * 2}–{activeStaffCount * 3} ca/ngày trở lên.
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="pstaff-primary-btn"
            disabled={savingCapacity}
          >
            <ShieldCheck size={15} />
            <span>{savingCapacity ? 'Đang lưu...' : 'Lưu sức chứa'}</span>
          </button>
        </div>
        {(summary?.activeStaff ?? 0) === 0 && (
          <p style={{ margin: 0, fontSize: '12.5px', color: '#7d736b' }}>
            Studio chưa thêm thợ chụp nào nên mặc định nhận tối đa 1 ca mỗi
            khung giờ. Hãy thêm thợ chụp để tự động mở rộng khả năng nhận nhiều khách cùng giờ.
          </p>
        )}
      </form>

      {/* Roster */}
      {loading ? (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #ece5db',
            color: '#7d736b',
          }}
        >
          Đang tải danh sách đội ngũ thợ chụp...
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px dashed #d8cab9',
          }}
        >
          <Users size={36} color="#8E1B2E" style={{ marginBottom: '10px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: '#231f20' }}>
            Chưa có thợ chụp nào trong danh sách
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#6b5e54' }}>
            Thêm thợ chụp để khách hàng biết ai phụ trách và cho phép Studio nhận
            nhiều đơn trùng khung giờ khi còn thợ rảnh.
          </p>
          <button
            type="button"
            className="pstaff-primary-btn"
            onClick={openAddModal}
          >
            <Plus size={15} />
            <span>Thêm thợ chụp đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="pstaff-roster-grid">
          {items.map((staff) => {
            const isActive = staff.status === 'ACTIVE';
            const isAccountLocked = staff.staffAccount?.status === 'SUSPENDED';

            return (
              <div
                key={staff._id}
                className={`pstaff-card ${!isActive ? 'inactive' : ''}`}
              >
                <div className="pstaff-card-top">
                  <div className="pstaff-identity">
                    {staff.avatarUrl ? (
                      <img
                        src={staff.avatarUrl}
                        alt={staff.name}
                        className="pstaff-avatar"
                      />
                    ) : (
                      <div className="pstaff-avatar">
                        {staff.name.trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: 800,
                          color: '#231f20',
                        }}
                      >
                        {staff.name}
                      </h3>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '3px',
                          fontSize: '12.5px',
                          color: '#6b5e54',
                        }}
                      >
                        <Phone size={12} />
                        <span>{staff.phone}</span>
                        {staff.experienceYears != null && (
                          <span>· {staff.experienceYears} năm KN</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pstaff-badge-row">
                    <span className={`pstaff-badge ${isActive ? 'green' : 'gray'}`}>
                      {isActive ? 'Đang hoạt động' : 'Tạm ngưng'}
                    </span>
                    {staff.metrics.inProgressNow && (
                      <span className="pstaff-badge amber">Đang chụp</span>
                    )}
                  </div>
                </div>

                {staff.specialty && (
                  <div style={{ fontSize: '12.5px', color: '#4a3f35' }}>
                    <strong>Chuyên môn:</strong> {staff.specialty}
                  </div>
                )}

                {/* Linked STAFF account status */}
                <div className="pstaff-badge-row">
                  {staff.linkedUserId && staff.staffAccount ? (
                    <>
                      <span className="pstaff-badge blue">
                        <UserCheck size={12} />
                        <span>TK STAFF: {staff.staffAccount.email}</span>
                      </span>
                      <span
                        className={`pstaff-badge ${
                          isAccountLocked ? 'red' : 'green'
                        }`}
                      >
                        {isAccountLocked ? 'Đang khóa TK' : 'TK đang mở'}
                      </span>
                    </>
                  ) : (
                    <span className="pstaff-badge gray">Chưa cấp TK STAFF</span>
                  )}
                </div>

                {/* Performance Metrics */}
                <div className="pstaff-metrics-row">
                  <div>
                    <div className="pstaff-metric-val">
                      {staff.metrics.todayShoots}
                    </div>
                    <div className="pstaff-metric-lbl">Hôm nay</div>
                  </div>
                  <div>
                    <div className="pstaff-metric-val">
                      {staff.metrics.upcomingShoots}
                    </div>
                    <div className="pstaff-metric-lbl">Sắp tới</div>
                  </div>
                  <div>
                    <div className="pstaff-metric-val">
                      {staff.metrics.completedThisMonth}
                    </div>
                    <div className="pstaff-metric-lbl">Tháng này</div>
                  </div>
                  <div>
                    <div
                      className="pstaff-metric-val"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      {staff.metrics.averageRating != null ? (
                        <>
                          <span>{staff.metrics.averageRating}</span>
                          <Star size={12} fill="#f59e0b" stroke="#f59e0b" />
                        </>
                      ) : (
                        '—'
                      )}
                    </div>
                    <div className="pstaff-metric-lbl">
                      {staff.metrics.reviewCount} đánh giá
                    </div>
                  </div>
                </div>

                {/* Upcoming blocked slots summary */}
                {staff.blockedSlots.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {staff.blockedSlots.slice(0, 3).map((b) => (
                      <span key={b._id} className="pstaff-badge amber">
                        <CalendarOff size={11} />
                        <span>
                          {b.date}{' '}
                          {b.startTime && b.endTime
                            ? `${b.startTime}-${b.endTime}`
                            : 'Cả ngày'}
                        </span>
                      </span>
                    ))}
                    {staff.blockedSlots.length > 3 && (
                      <span className="pstaff-badge gray">
                        +{staff.blockedSlots.length - 3} lịch nghỉ
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="pstaff-actions">
                  <button
                    type="button"
                    className="pstaff-secondary-btn"
                    onClick={() => openEditModal(staff)}
                  >
                    <Pencil size={13} />
                    <span>Sửa</span>
                  </button>

                  <button
                    type="button"
                    className="pstaff-secondary-btn"
                    onClick={() => setBlocksTargetStaff(staff)}
                  >
                    <CalendarOff size={13} />
                    <span>Lịch nghỉ ({staff.blockedSlots.length})</span>
                  </button>

                  {!staff.linkedUserId ? (
                    <button
                      type="button"
                      className="pstaff-secondary-btn"
                      onClick={() => openProvisionModal(staff)}
                    >
                      <UserPlus size={13} />
                      <span>Cấp TK STAFF</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="pstaff-secondary-btn"
                        onClick={() => openResetModal(staff)}
                      >
                        <KeyRound size={13} />
                        <span>Đổi MK</span>
                      </button>
                      <button
                        type="button"
                        className="pstaff-secondary-btn"
                        onClick={() => handleToggleAccountLock(staff)}
                      >
                        {isAccountLocked ? (
                          <LockOpen size={13} />
                        ) : (
                          <Lock size={13} />
                        )}
                        <span>{isAccountLocked ? 'Mở khóa TK' : 'Khóa TK'}</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="pstaff-secondary-btn"
                    onClick={() => handleToggleRosterStatus(staff)}
                  >
                    <span>{isActive ? 'Tạm ngưng' : 'Kích hoạt lại'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {isStaffModalOpen && (
        <div className="pstaff-modal-backdrop" role="dialog" aria-modal="true">
          <form className="pstaff-modal" onSubmit={handleSubmitStaffModal}>
            <div className="pstaff-modal-header">
              <h3>
                {editingStaff
                  ? `Cập nhật hồ sơ — ${editingStaff.name}`
                  : 'Thêm thợ chụp mới vào Studio'}
              </h3>
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="pstaff-field">
              <label htmlFor="staff-form-name">Họ và tên *</label>
              <input
                id="staff-form-name"
                className="pstaff-input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="VD: Minh Khoa"
                required
              />
            </div>

            <div className="pstaff-field">
              <label htmlFor="staff-form-phone">Số điện thoại liên hệ *</label>
              <input
                id="staff-form-phone"
                className="pstaff-input"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="VD: 0905123456"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
              <div className="pstaff-field" style={{ minWidth: 0 }}>
                <label htmlFor="staff-form-specialty">Chuyên môn</label>
                <input
                  id="staff-form-specialty"
                  className="pstaff-input"
                  value={formSpecialty}
                  onChange={(e) => setFormSpecialty(e.target.value)}
                  placeholder="Áo dài, ngoại cảnh..."
                />
              </div>
              <div className="pstaff-field" style={{ minWidth: 0 }}>
                <label htmlFor="staff-form-exp">Số năm KN</label>
                <input
                  id="staff-form-exp"
                  type="number"
                  min={0}
                  max={60}
                  className="pstaff-input"
                  value={formExperience}
                  onChange={(e) => setFormExperience(e.target.value)}
                />
              </div>
            </div>

            <div className="pstaff-field">
              <label htmlFor="staff-form-bio">Giới thiệu ngắn (hiển thị cho khách)</label>
              <textarea
                id="staff-form-bio"
                className="pstaff-textarea"
                rows={2}
                value={formBio}
                onChange={(e) => setFormBio(e.target.value)}
              />
            </div>

            <div className="pstaff-field">
              <label htmlFor="staff-form-note">Ghi chú nội bộ Studio</label>
              <input
                id="staff-form-note"
                className="pstaff-input"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
              />
            </div>

            {!editingStaff && (
              <div
                style={{
                  background: '#fcf9f2',
                  border: '1px solid #e7dac9',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formCreateAccount}
                    onChange={(e) => setFormCreateAccount(e.target.checked)}
                  />
                  <span>Cấp luôn tài khoản đăng nhập riêng (role STAFF)</span>
                </label>
                {formCreateAccount && (
                  <>
                    <div className="pstaff-field">
                      <label htmlFor="staff-form-email">Email đăng nhập STAFF *</label>
                      <input
                        id="staff-form-email"
                        type="email"
                        className="pstaff-input"
                        value={formAccountEmail}
                        onChange={(e) => setFormAccountEmail(e.target.value)}
                        placeholder="thochup@studio.vn"
                      />
                    </div>
                    <div className="pstaff-field">
                      <label htmlFor="staff-form-password">
                        Mật khẩu ban đầu (để trống để tự sinh ngẫu nhiên)
                      </label>
                      <input
                        id="staff-form-password"
                        type="text"
                        className="pstaff-input"
                        value={formAccountPassword}
                        onChange={(e) => setFormAccountPassword(e.target.value)}
                        placeholder="Tối thiểu 8 ký tự gồm chữ & số"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="pstaff-secondary-btn"
                onClick={() => setIsStaffModalOpen(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="pstaff-primary-btn"
                disabled={savingStaff}
              >
                {savingStaff
                  ? 'Đang lưu...'
                  : editingStaff
                    ? 'Lưu thay đổi'
                    : 'Thêm thợ chụp'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Provision / Reset Password Modal */}
      {accountModalMode && accountTargetStaff && (
        <div className="pstaff-modal-backdrop" role="dialog" aria-modal="true">
          <form className="pstaff-modal" onSubmit={handleSubmitAccountModal}>
            <div className="pstaff-modal-header">
              <h3>
                {accountModalMode === 'provision'
                  ? `Cấp tài khoản STAFF — ${accountTargetStaff.name}`
                  : `Đặt lại mật khẩu — ${accountTargetStaff.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setAccountModalMode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {accountModalMode === 'provision' ? (
              <div className="pstaff-field">
                <label htmlFor="acc-email-input">Email đăng nhập STAFF *</label>
                <input
                  id="acc-email-input"
                  type="email"
                  className="pstaff-input"
                  value={accountEmailInput}
                  onChange={(e) => setAccountEmailInput(e.target.value)}
                  placeholder="thochup@studio.vn"
                  required
                />
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: '#6b5e54' }}>
                Tài khoản: <strong>{accountTargetStaff.staffAccount?.email}</strong>.
                Sau khi đổi mật khẩu, mọi phiên đăng nhập cũ trên Web/App của
                thợ sẽ bị đăng xuất ngay lập tức.
              </p>
            )}

            <div className="pstaff-field">
              <label htmlFor="acc-pass-input">
                {accountModalMode === 'provision'
                  ? 'Mật khẩu (bỏ trống để hệ thống tạo tự động)'
                  : 'Mật khẩu mới (bỏ trống để hệ thống tạo tự động)'}
              </label>
              <input
                id="acc-pass-input"
                type="text"
                className="pstaff-input"
                value={accountPassInput}
                onChange={(e) => setAccountPassInput(e.target.value)}
                placeholder="Ít nhất 8 ký tự gồm chữ & số"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="pstaff-secondary-btn"
                onClick={() => setAccountModalMode(null)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="pstaff-primary-btn"
                disabled={savingAccount}
              >
                {savingAccount ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* One-time Credentials Copy Modal */}
      {generatedCreds && (
        <div className="pstaff-modal-backdrop" role="dialog" aria-modal="true">
          <div className="pstaff-modal">
            <div className="pstaff-modal-header">
              <h3>{generatedCreds.title}</h3>
              <button
                type="button"
                onClick={() => setGeneratedCreds(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#6b5e54' }}>
              Hãy sao chép và gửi thông tin đăng nhập dưới đây cho thợ chụp{' '}
              <strong>{generatedCreds.staffName}</strong>. Mật khẩu tạm chỉ hiển
              thị một lần duy nhất.
            </p>

            <div className="pstaff-creds-box" data-testid="generated-staff-creds">
              <div>
                <strong>Email:</strong> {generatedCreds.email}
              </div>
              <div>
                <strong>Mật khẩu:</strong> {generatedCreds.password}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="pstaff-secondary-btn"
                onClick={copyCredentialsToClipboard}
              >
                {copiedCreds ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedCreds ? 'Đã sao chép' : 'Sao chép thông tin'}</span>
              </button>
              <button
                type="button"
                className="pstaff-primary-btn"
                onClick={() => setGeneratedCreds(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Blocked Slots Modal */}
      {blocksTargetStaff && (
        <div className="pstaff-modal-backdrop" role="dialog" aria-modal="true">
          <div className="pstaff-modal">
            <div className="pstaff-modal-header">
              <h3>Lịch nghỉ riêng — {blocksTargetStaff.name}</h3>
              <button
                type="button"
                onClick={() => setBlocksTargetStaff(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {blocksTargetStaff.blockedSlots.length === 0 ? (
                <p style={{ margin: 0, fontSize: '13px', color: '#7d736b' }}>
                  Chưa có lịch nghỉ nào sắp tới cho thợ này.
                </p>
              ) : (
                blocksTargetStaff.blockedSlots.map((b) => (
                  <div
                    key={b._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid #ece5db',
                      fontSize: '13px',
                    }}
                  >
                    <div>
                      <strong>{b.date}</strong> ·{' '}
                      {b.startTime && b.endTime
                        ? `${b.startTime} - ${b.endTime}`
                        : 'Nghỉ cả ngày'}
                      {b.reason ? ` (${b.reason})` : ''}
                    </div>
                    <button
                      type="button"
                      className="pstaff-secondary-btn"
                      onClick={() =>
                        handleRemoveBlock(blocksTargetStaff._id, b._id)
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleAddBlock}
              style={{
                borderTop: '1px solid #ece5db',
                paddingTop: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <strong style={{ fontSize: '13.5px' }}>Thêm lịch nghỉ mới</strong>
              <div className="pstaff-field">
                <label htmlFor="block-date-input">Ngày nghỉ *</label>
                <input
                  id="block-date-input"
                  type="date"
                  className="pstaff-input"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  required
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={blockFullDay}
                  onChange={(e) => setBlockFullDay(e.target.checked)}
                />
                <span>Khóa cả ngày</span>
              </label>

              {!blockFullDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="pstaff-field" style={{ minWidth: 0 }}>
                    <label htmlFor="block-start-input">Từ giờ</label>
                    <input
                      id="block-start-input"
                      type="time"
                      className="pstaff-input"
                      value={blockStartTime}
                      onChange={(e) => setBlockStartTime(e.target.value)}
                    />
                  </div>
                  <div className="pstaff-field" style={{ minWidth: 0 }}>
                    <label htmlFor="block-end-input">Đến giờ</label>
                    <input
                      id="block-end-input"
                      type="time"
                      className="pstaff-input"
                      value={blockEndTime}
                      onChange={(e) => setBlockEndTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="pstaff-field">
                <label htmlFor="block-reason-input">Lý do</label>
                <input
                  id="block-reason-input"
                  className="pstaff-input"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="VD: Bận việc gia đình / Sửa máy"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="pstaff-secondary-btn"
                  onClick={() => setBlocksTargetStaff(null)}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="pstaff-primary-btn"
                  disabled={savingBlock}
                >
                  {savingBlock ? 'Đang thêm...' : 'Thêm lịch nghỉ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
