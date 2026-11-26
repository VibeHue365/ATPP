import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CalendarOff,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  LogOut,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useToast } from '../../components/feedback/Toast';
import { ROUTES } from '../../config/routes';
import { chatService } from '../../services/chatService';
import { RoleChatWorkspace } from '../../features/chat/RoleChatWorkspace';
import {
  staffPortalApi,
  type StaffPortalProfileResponse,
  type StaffScheduleItem,
} from '../../features/staff-portal/staffPortalApi';
import {
  getBookingStatusLabel,
  getBookingStatusMeta,
} from '../../utils/bookingStatus';
import './StaffPortalPage.css';

type ScopeOption = 'today' | 'upcoming' | 'completed' | 'all';

const SCOPE_LABELS: Array<{ key: ScopeOption; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'completed', label: 'Đã hoàn thành' },
  { key: 'all', label: 'Tất cả' },
];

const formatDateTime = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
};

const getGoogleMapsUrl = (item: StaffScheduleItem) => {
  const coords = item.locationSnapshot?.geo?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const [lng, lat] = coords;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
  }
  const addr = item.locationAddress || item.locationSnapshot?.address;
  if (!addr) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
};

export const StaffPortalPage: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [scope, setScope] = useState<ScopeOption>('today');
  const [activeTab, setActiveTab] = useState<'schedules' | 'chat'>(() => {
    if (typeof window === 'undefined') return 'schedules';
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'chat' ? 'chat' : 'schedules';
  });
  const [activeChatRoomId, setActiveChatRoomId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('roomId');
  });
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [profile, setProfile] = useState<StaffPortalProfileResponse | null>(
    null,
  );
  const [schedules, setSchedules] = useState<StaffScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);

  // Self-managed blocked slots modal state
  const getTodayIctDateKey = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockDate, setBlockDate] = useState<string>(() => getTodayIctDateKey());
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockStartTime, setBlockStartTime] = useState('08:00');
  const [blockEndTime, setBlockEndTime] = useState('12:00');
  const [blockReason, setBlockReason] = useState('');
  const [submittingBlock, setSubmittingBlock] = useState(false);
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof chatService.getRooms !== 'function') return;
    let cancelled = false;
    chatService
      .getRooms()
      .then((rooms) => {
        if (!cancelled && Array.isArray(rooms)) {
          setChatUnreadCount(
            rooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Field action modal (check-in with photo / check-out with optional note)
  const [actionModal, setActionModal] = useState<{
    mode: 'check-in' | 'finish-shoot';
    item: StaffScheduleItem;
  } | null>(null);
  const [fieldNote, setFieldNote] = useState('');
  const [showFinishNote, setShowFinishNote] = useState(false);
  const [checkInFile, setCheckInFile] = useState<File | null>(null);
  const [checkInPreviewUrl, setCheckInPreviewUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const clearCheckInPhoto = useCallback(() => {
    setCheckInFile(null);
    setCheckInPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  }, []);

  const closeActionModal = useCallback(() => {
    stopCameraStream();
    clearCheckInPhoto();
    setCameraError(null);
    setFieldNote('');
    setShowFinishNote(false);
    setActionModal(null);
  }, [clearCheckInPhoto, stopCameraStream]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const handleOpenCamera = async () => {
    setCameraError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraError(
        'Trình duyệt không hỗ trợ mở camera trực tiếp. Bạn vui lòng bấm "Chụp / Chọn ảnh từ thiết bị".',
      );
      return;
    }
    try {
      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      clearCheckInPhoto();
      setCameraActive(true);
    } catch {
      setCameraError(
        'Không thể truy cập camera (chưa cấp quyền hoặc không tìm thấy camera). Bạn có thể chọn ảnh từ thiết bị.',
      );
    }
  };

  const handleCaptureFromCamera = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.error('Camera chưa sẵn sàng, vui lòng thử lại sau giây lát.');
      return;
    }
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Không thể chụp ảnh từ camera.');
          return;
        }
        const file = new File([blob], `checkin-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        clearCheckInPhoto();
        setCheckInFile(file);
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          setCheckInPreviewUrl(URL.createObjectURL(file));
        }
        stopCameraStream();
      },
      'image/jpeg',
      0.86,
    );
  };

  const handleSelectPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Chỉ hỗ trợ ảnh định dạng JPG, PNG hoặc WEBP.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Dung lượng ảnh tối đa 8MB.');
      return;
    }
    stopCameraStream();
    setCameraError(null);
    clearCheckInPhoto();
    setCheckInFile(file);
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      setCheckInPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Strict role guard: only STAFF may access /staff
  useEffect(() => {
    if (isAuthenticated === false) {
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }
    if (user) {
      const roles = (user.roles || []).map((r) => String(r).toUpperCase());
      if (!roles.includes('STAFF')) {
        toast.error('Trang này chỉ dành cho tài khoản Thợ chụp (STAFF).');
        if (roles.includes('PROVIDER')) {
          navigate(ROUTES.PROVIDER_DASHBOARD, { replace: true });
        } else if (roles.includes('ADMIN')) {
          navigate(ROUTES.ADMIN_DASHBOARD, { replace: true });
        } else {
          navigate(ROUTES.LANDING, { replace: true });
        }
      }
    }
  }, [user, isAuthenticated, navigate, toast]);

  const loadData = useCallback(
    async (selectedScope: ScopeOption = scope) => {
      try {
        setLoading(true);
        const [profileRes, schedulesRes] = await Promise.all([
          staffPortalApi.getProfile(),
          staffPortalApi.getMySchedules({ scope: selectedScope }),
        ]);
        setProfile(profileRes);
        setSchedules(
          Array.isArray(schedulesRes?.items) ? schedulesRes.items : [],
        );
      } catch (err: any) {
        toast.error(err?.message || 'Không thể tải lịch chụp của bạn.');
      } finally {
        setLoading(false);
      }
    },
    [scope, toast],
  );

  useEffect(() => {
    const roles = (user?.roles || []).map((r) => String(r).toUpperCase());
    if (roles.includes('STAFF')) {
      void loadData(scope);
    }
  }, [scope, user]);

  const handleOpenChatWithCustomer = async (item: StaffScheduleItem) => {
    if (!item.customer?.userId) {
      toast.error('Không tìm thấy tài khoản chat của khách hàng.');
      return;
    }
    try {
      setOpeningChatId(item.scheduleId);
      const room = await chatService.getOrCreateRoom(item.customer.userId);
      setActiveChatRoomId(room.id);
      setActiveTab('chat');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể mở cuộc trò chuyện với khách.');
    } finally {
      setOpeningChatId(null);
    }
  };

  const handleOpenChatWithStudio = async () => {
    const ownerUserId = profile?.studio?.ownerUserId;
    if (!ownerUserId) {
      setActiveTab('chat');
      return;
    }
    try {
      setOpeningChatId('studio-owner');
      const room = await chatService.getOrCreateRoom(ownerUserId);
      setActiveChatRoomId(room.id);
      setActiveTab('chat');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể mở cuộc trò chuyện với Chủ Studio.');
    } finally {
      setOpeningChatId(null);
    }
  };

  const handleOpenBlockModal = () => {
    setBlockDate(getTodayIctDateKey());
    setBlockAllDay(true);
    setBlockStartTime('08:00');
    setBlockEndTime('12:00');
    setBlockReason('');
    setBlockModalOpen(true);
  };

  const handleAddBlockedSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDate) {
      toast.error('Vui lòng chọn ngày bận.');
      return;
    }
    if (!blockAllDay && (!blockStartTime || !blockEndTime)) {
      toast.error('Vui lòng chọn đầy đủ giờ bắt đầu và giờ kết thúc.');
      return;
    }
    try {
      setSubmittingBlock(true);
      await staffPortalApi.addBlockedSlot({
        date: blockDate,
        ...(blockAllDay
          ? {}
          : { startTime: blockStartTime, endTime: blockEndTime }),
        reason: blockReason.trim() || undefined,
      });
      toast.success('Đã đăng ký lịch bận và gửi thông báo tới Chủ Studio.');
      setBlockModalOpen(false);
      await loadData(scope);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể đăng ký lịch bận.');
    } finally {
      setSubmittingBlock(false);
    }
  };

  const handleRemoveBlockedSlot = async (blockId: string) => {
    try {
      setRemovingBlockId(blockId);
      await staffPortalApi.removeBlockedSlot(blockId);
      toast.success('Đã gỡ lịch bận.');
      await loadData(scope);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể gỡ lịch bận.');
    } finally {
      setRemovingBlockId(null);
    }
  };

  const handleConfirmFieldAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;
    try {
      setSubmittingAction(true);
      if (actionModal.mode === 'check-in') {
        if (!checkInFile) {
          toast.error('Vui lòng chụp ảnh xác nhận đã đến điểm hẹn trước khi check-in.');
          return;
        }
        const uploaded = await staffPortalApi.uploadCheckInPhoto(checkInFile);
        if (!uploaded?.url) {
          throw new Error('Không thể tải ảnh xác nhận check-in lên máy chủ.');
        }
        await staffPortalApi.checkIn(actionModal.item.scheduleId, {
          photoUrl: uploaded.url,
        });
        toast.success(
          `Đã gửi ảnh check-in và bắt đầu chụp đơn ${actionModal.item.bookingCode}.`,
        );
      } else {
        await staffPortalApi.finishShoot(actionModal.item.scheduleId, {
          ...(fieldNote.trim() ? { note: fieldNote.trim() } : {}),
        });
        toast.success(
          `Đã check-out hoàn thành buổi chụp đơn ${actionModal.item.bookingCode}.`,
        );
      }
      closeActionModal();
      await loadData(scope);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể cập nhật tác nghiệp lịch chụp.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div className="staff-portal-page">
      {/* Isolated Staff Header */}
      <header className="staff-portal-header">
        <div className="staff-portal-brand">
          <div className="staff-portal-logo">T</div>
          <div>
            <div style={{ fontSize: '15.5px', fontWeight: 800, color: '#231F20' }}>
              Lịch chụp của tôi · {profile?.staff?.name || user?.fullName || 'Thợ chụp'}
            </div>
            <div style={{ fontSize: '12px', color: '#6B5E54' }}>
              {profile?.studio?.businessName
                ? `Studio: ${profile.studio.businessName}`
                : 'Cổng tác nghiệp Thợ chụp TàGo'}
              {profile?.staff?.specialty ? ` · ${profile.staff.specialty}` : ''}
            </div>
          </div>
        </div>

        <div className="staff-portal-header-actions">
          <button
            type="button"
            className={activeTab === 'schedules' ? 'staff-btn-active' : 'staff-btn-outline'}
            onClick={() => setActiveTab('schedules')}
          >
            <Camera size={15} />
            <span>Lịch chụp của tôi</span>
          </button>
          <button
            type="button"
            className={activeTab === 'chat' ? 'staff-btn-active' : 'staff-btn-outline'}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={15} />
            <span>Tin nhắn</span>
            {chatUnreadCount > 0 && (
              <span className="staff-unread-pill">{chatUnreadCount}</span>
            )}
          </button>
          {activeTab === 'schedules' && (
            <button
              type="button"
              className="staff-btn-outline"
              onClick={() => loadData(scope)}
            >
              <RefreshCw size={15} />
              <span>Làm mới</span>
            </button>
          )}
          <button
            type="button"
            className="staff-btn-outline"
            onClick={handleLogout}
          >
            <LogOut size={15} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      <main className="staff-portal-main">
        {activeTab === 'chat' ? (
          <RoleChatWorkspace
            mode="staff"
            embedded
            initialRoomId={activeChatRoomId}
            studioOwnerUserId={profile?.studio?.ownerUserId ?? null}
            studioOwnerName={profile?.studio?.businessName ?? null}
            onUnreadCountChange={setChatUnreadCount}
          />
        ) : (
          <>
            {/* 3 Non-financial Operational Metrics */}
        <section className="staff-metrics-grid" aria-label="Tổng quan ca chụp">
          <div className="staff-metric-card">
            <span>Ca chụp hôm nay</span>
            <strong>{profile?.metrics?.todayShoots ?? 0}</strong>
          </div>
          <div className="staff-metric-card">
            <span>Ca sắp tới</span>
            <strong>{profile?.metrics?.upcomingShoots ?? 0}</strong>
          </div>
          <div className="staff-metric-card">
            <span>Hoàn thành tháng này</span>
            <strong>{profile?.metrics?.completedThisMonth ?? 0}</strong>
          </div>
        </section>

        {/* Self-managed Staff Off-days / Busy Slots Section */}
        <section
          aria-label="Lịch nghỉ bận của tôi"
          style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '14px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            fontSize: '12.5px',
            color: '#92400E',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarOff size={15} />
              <strong>
                Lịch nghỉ / Bận của tôi (
                {profile?.staff?.blockedSlots?.length ?? 0})
              </strong>
            </div>
            <button
              type="button"
              className="staff-btn-outline"
              onClick={handleOpenBlockModal}
              style={{
                borderColor: '#F59E0B',
                color: '#92400E',
                padding: '6px 12px',
              }}
            >
              <Plus size={14} />
              <span>Báo lịch bận</span>
            </button>
          </div>

          {!profile?.staff?.blockedSlots ||
          profile.staff.blockedSlots.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#A16207' }}>
              Chưa có lịch bận nào. Bạn có thể tự báo bận vào các khung giờ rảnh
              để khách không đặt trùng và thông báo ngay tới Chủ Studio.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {profile.staff.blockedSlots.map((blk) => (
                <span
                  key={blk._id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#FFFFFF',
                    border: '1px solid #FCD34D',
                    borderRadius: '999px',
                    padding: '4px 10px 4px 12px',
                    fontWeight: 600,
                  }}
                >
                  <span>
                    {blk.date}{' '}
                    {blk.startTime && blk.endTime
                      ? `${blk.startTime}-${blk.endTime}`
                      : 'Cả ngày'}
                    {blk.reason ? ` · ${blk.reason}` : ''}
                  </span>
                  <button
                    type="button"
                    aria-label="Hủy lịch bận"
                    title="Hủy lịch bận"
                    disabled={removingBlockId === blk._id}
                    onClick={() => void handleRemoveBlockedSlot(blk._id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#B45309',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Scope Tabs */}
        <div className="staff-scope-tabs" role="tablist">
          {SCOPE_LABELS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={scope === tab.key}
              className={`staff-scope-tab ${scope === tab.key ? 'active' : ''}`}
              onClick={() => setScope(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Schedules List */}
        {loading ? (
          <div
            style={{
              padding: '48px',
              textAlign: 'center',
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #ECE5DB',
              color: '#7D736B',
            }}
          >
            Đang tải danh sách ca chụp được phân công...
          </div>
        ) : schedules.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px dashed #D8CAB9',
              color: '#6B5E54',
            }}
          >
            <Camera size={34} color="#8E1B2E" style={{ marginBottom: '8px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: '#231F20' }}>
              Chưa có ca chụp nào ở mục này
            </h3>
            <p style={{ margin: 0, fontSize: '13px' }}>
              Khi Studio phân công đơn mới cho bạn, lịch chụp sẽ hiển thị ngay
              tại đây.
            </p>
          </div>
        ) : (
          <div className="staff-schedule-list">
            {schedules.map((item) => {
              const statusMeta = getBookingStatusMeta(item.bookingStatus);
              const mapsUrl = getGoogleMapsUrl(item);

              return (
                <article key={item.scheduleId} className="staff-schedule-card">
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '15.5px', color: '#231F20' }}>
                          {item.packageName}
                        </strong>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: '#F5E6E8',
                            color: '#8E1B2E',
                          }}
                        >
                          {item.bookingCode}
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 750,
                        padding: '4px 10px',
                        borderRadius: '999px',
                        backgroundColor: statusMeta.bg,
                        color: statusMeta.color,
                      }}
                    >
                      {item.bookingStatus === 'DEPOSIT_PAID'
                        ? 'Chờ Chủ Studio duyệt'
                        : getBookingStatusLabel(item.bookingStatus)}
                    </span>
                  </div>

                  {/* Date, Time & Location */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '10px',
                      fontSize: '13px',
                      color: '#4A3F35',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Calendar size={14} color="#8E1B2E" />
                      <span>
                        Ngày: <strong>{item.providerLocalDate || '—'}</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Clock size={14} color="#8E1B2E" />
                      <span>
                        Khung giờ: <strong>{item.timeSlot || 'Linh hoạt'}</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <MapPin size={14} color="#8E1B2E" />
                      <span>{item.locationAddress || 'Chưa cập nhật điểm hẹn'}</span>
                    </div>
                  </div>

                  {/* Customer Info & Notes */}
                  <div
                    style={{
                      background: '#FCF9F2',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <User size={15} color="#8E1B2E" />
                      <div>
                        <strong>{item.customer?.fullName || 'Khách hàng'}</strong>
                        {item.customer?.phone && (
                          <span style={{ marginLeft: '8px', color: '#6B5E54' }}>
                            · {item.customer.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {item.customer?.phone && (
                        <a
                          href={`tel:${item.customer.phone}`}
                          className="staff-btn-outline"
                        >
                          <Phone size={13} />
                          <span>Gọi khách</span>
                        </a>
                      )}
                      {item.customer?.userId && (
                        <button
                          type="button"
                          className="staff-btn-outline"
                          disabled={openingChatId === item.scheduleId}
                          onClick={() => handleOpenChatWithCustomer(item)}
                        >
                          <MessageSquare size={13} />
                          <span>
                            {openingChatId === item.scheduleId
                              ? 'Đang mở...'
                              : 'Nhắn tin khách'}
                          </span>
                        </button>
                      )}
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="staff-btn-outline"
                        >
                          <ExternalLink size={13} />
                          <span>Google Maps</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {(item.customerNote || item.scheduleNotes) && (
                    <div style={{ fontSize: '12.5px', color: '#4A3F35' }}>
                      <strong>Ghi chú khách hàng:</strong>{' '}
                      {item.customerNote || item.scheduleNotes}
                    </div>
                  )}

                  {(item.checkedInAt ||
                    item.checkInPhotoUrl ||
                    item.shootFinishedAt ||
                    item.staffFieldNote) && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: '#4A3F35',
                      }}
                    >
                      {item.checkedInAt && (
                        <span
                          style={{
                            background: '#FFFBEB',
                            color: '#B45309',
                            padding: '3px 9px',
                            borderRadius: '999px',
                            fontWeight: 700,
                          }}
                        >
                          Check-in: {formatDateTime(item.checkedInAt)}
                        </span>
                      )}
                      {item.checkInPhotoUrl && (
                        <button
                          type="button"
                          className="staff-checkin-thumb-btn"
                          onClick={() => setPreviewPhotoUrl(item.checkInPhotoUrl || null)}
                        >
                          <img src={item.checkInPhotoUrl} alt="Ảnh check-in" />
                          <span>Ảnh check-in</span>
                        </button>
                      )}
                      {item.shootFinishedAt && (
                        <span
                          style={{
                            background: '#ECFDF5',
                            color: '#047857',
                            padding: '3px 9px',
                            borderRadius: '999px',
                            fontWeight: 700,
                          }}
                        >
                          Check-out: {formatDateTime(item.shootFinishedAt)}
                        </span>
                      )}
                      {item.staffFieldNote && (
                        <span>
                          · <strong>Ghi chú thợ:</strong> {item.staffFieldNote}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Field Ops Buttons / Approval Gate Notice */}
                  {(item.canCheckIn ||
                    item.canFinishShoot ||
                    (!item.shootFinishedAt &&
                      (item.checkInBlockedReason ||
                        item.bookingStatus === 'DEPOSIT_PAID'))) && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        paddingTop: '8px',
                        borderTop: '1px dashed #ECE5DB',
                      }}
                    >
                      {item.canCheckIn && (
                        <button
                          type="button"
                          className="staff-btn-primary"
                          onClick={() => {
                            clearCheckInPhoto();
                            stopCameraStream();
                            setCameraError(null);
                            setFieldNote('');
                            setShowFinishNote(false);
                            setActionModal({ mode: 'check-in', item });
                          }}
                        >
                          <Camera size={14} />
                          <span>Check-in bắt đầu chụp</span>
                        </button>
                      )}

                      {!item.canCheckIn &&
                        !item.canFinishShoot &&
                        !item.shootFinishedAt &&
                        (item.checkInBlockedReason ||
                          item.bookingStatus === 'DEPOSIT_PAID') && (
                          <>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '7px',
                                background: '#FFFBEB',
                                border: '1px solid #FDE68A',
                                color: '#92400E',
                                padding: '7px 12px',
                                borderRadius: '10px',
                                fontSize: '12.5px',
                                fontWeight: 600,
                              }}
                            >
                              <Clock size={14} />
                              <span>
                                {item.checkInBlockedReason ||
                                  'Chờ Chủ Studio duyệt xác nhận lịch chụp trước khi check-in.'}
                              </span>
                            </div>
                            {profile?.studio?.ownerUserId && (
                              <button
                                type="button"
                                className="staff-btn-outline"
                                disabled={openingChatId === 'studio-owner'}
                                onClick={() => void handleOpenChatWithStudio()}
                              >
                                <MessageSquare size={13} />
                                <span>Nhắn Chủ Studio</span>
                              </button>
                            )}
                          </>
                        )}

                      {item.canFinishShoot && (
                        <button
                          type="button"
                          className="staff-btn-success"
                          onClick={() => {
                            setFieldNote('');
                            setShowFinishNote(false);
                            setActionModal({ mode: 'finish-shoot', item });
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Check-out · Báo đã chụp xong</span>
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
          </>
        )}
      </main>

      {/* Check-in (Photo Verification) / Check-out (Quick Confirm + Optional Note) Modal */}
      {actionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 16, 14, 0.52)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmFieldAction}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '470px',
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <strong style={{ fontSize: '16px' }}>
                {actionModal.mode === 'check-in'
                  ? `Check-in bắt đầu chụp — ${actionModal.item.bookingCode}`
                  : `Check-out hoàn thành chụp — ${actionModal.item.bookingCode}`}
              </strong>
              <button
                type="button"
                aria-label="Đóng hộp thoại"
                onClick={closeActionModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#6B5E54', lineHeight: 1.5 }}>
              {actionModal.mode === 'check-in'
                ? 'Chụp ảnh tại điểm hẹn để xác nhận bạn đã đến nơi. Hệ thống sẽ chuyển đơn sang ĐANG THỰC HIỆN và gửi thông báo tới khách hàng.'
                : 'Bấm xác nhận để kết thúc ca chụp ngay và báo Chủ Studio hậu kỳ, bàn giao ảnh cho khách.'}
            </p>

            {actionModal.mode === 'check-in' ? (
              <div className="staff-checkin-capture">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  aria-label="Tải ảnh xác nhận check-in"
                  onChange={handleSelectPhotoFile}
                  style={{ display: 'none' }}
                />

                {cameraActive ? (
                  <div className="staff-camera-box">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="staff-camera-video"
                    />
                    <div className="staff-camera-actions">
                      <button
                        type="button"
                        className="staff-btn-outline"
                        onClick={stopCameraStream}
                      >
                        Đóng camera
                      </button>
                      <button
                        type="button"
                        className="staff-btn-primary"
                        onClick={handleCaptureFromCamera}
                      >
                        <Camera size={15} />
                        <span>Chụp ngay</span>
                      </button>
                    </div>
                  </div>
                ) : checkInFile ? (
                  <div className="staff-checkin-preview">
                    {checkInPreviewUrl ? (
                      <img src={checkInPreviewUrl} alt="Ảnh check-in tại điểm hẹn" />
                    ) : (
                      <div className="staff-checkin-preview-fallback">
                        <ImageIcon size={22} />
                        <span>{checkInFile.name}</span>
                      </div>
                    )}
                    <div className="staff-checkin-preview-bar">
                      <span className="staff-checkin-preview-badge">
                        <CheckCircle2 size={14} /> Đã có ảnh xác nhận
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="staff-btn-outline"
                          onClick={() => void handleOpenCamera()}
                        >
                          <RotateCcw size={13} />
                          <span>Chụp lại</span>
                        </button>
                        <button
                          type="button"
                          className="staff-btn-outline"
                          onClick={() => photoInputRef.current?.click()}
                        >
                          <Upload size={13} />
                          <span>Đổi ảnh</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="staff-checkin-empty">
                    <div className="staff-checkin-empty-icon">
                      <Camera size={24} />
                    </div>
                    <strong>Chụp ảnh xác nhận đã đến điểm hẹn *</strong>
                    <span>Ảnh sẽ được lưu để xác thực thời điểm bắt đầu ca chụp.</span>
                    <div className="staff-checkin-empty-actions">
                      <button
                        type="button"
                        className="staff-btn-primary"
                        onClick={() => void handleOpenCamera()}
                      >
                        <Camera size={14} />
                        <span>Mở camera chụp ảnh</span>
                      </button>
                      <button
                        type="button"
                        className="staff-btn-outline"
                        onClick={() => photoInputRef.current?.click()}
                      >
                        <Upload size={14} />
                        <span>Chọn ảnh từ thiết bị</span>
                      </button>
                    </div>
                  </div>
                )}

                {cameraError && (
                  <p className="staff-camera-error">{cameraError}</p>
                )}
              </div>
            ) : (
              <div className="staff-checkout-optional-note">
                {!showFinishNote ? (
                  <button
                    type="button"
                    className="staff-note-toggle-btn"
                    onClick={() => setShowFinishNote(true)}
                  >
                    <Plus size={14} />
                    <span>Thêm ghi chú (không bắt buộc)</span>
                  </button>
                ) : (
                  <textarea
                    rows={2}
                    placeholder="Ghi chú bàn giao file gốc cho Studio (tuỳ chọn)..."
                    value={fieldNote}
                    onChange={(e) => setFieldNote(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      border: '1px solid #D8CAB9',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '13px',
                    }}
                  />
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="staff-btn-outline"
                disabled={submittingAction}
                onClick={closeActionModal}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={
                  actionModal.mode === 'check-in'
                    ? 'staff-btn-primary'
                    : 'staff-btn-success'
                }
                disabled={
                  submittingAction ||
                  (actionModal.mode === 'check-in' && !checkInFile)
                }
                style={
                  actionModal.mode === 'check-in' && !checkInFile
                    ? { opacity: 0.5, cursor: 'not-allowed' }
                    : undefined
                }
              >
                {submittingAction
                  ? 'Đang xử lý...'
                  : actionModal.mode === 'check-in'
                    ? 'Xác nhận Check-in'
                    : 'Xác nhận Check-out'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Full-size Check-in Photo Preview Modal */}
      {previewPhotoUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(18, 14, 12, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            padding: '20px',
          }}
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            style={{ position: 'relative', maxWidth: '92vw', maxHeight: '88vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Đóng ảnh"
              onClick={() => setPreviewPhotoUrl(null)}
              style={{
                position: 'absolute',
                top: '-14px',
                right: '-14px',
                width: '34px',
                height: '34px',
                borderRadius: '999px',
                border: 'none',
                background: '#FFFFFF',
                color: '#231F20',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              }}
            >
              <X size={18} />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Ảnh xác nhận check-in"
              style={{
                display: 'block',
                maxWidth: '90vw',
                maxHeight: '84vh',
                borderRadius: '14px',
                objectFit: 'contain',
                background: '#111',
              }}
            />
          </div>
        </div>
      )}

      {/* Self-block Busy Slot Modal */}
      {blockModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(24, 18, 16, 0.5)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setBlockModalOpen(false)}
        >
          <form
            onSubmit={handleAddBlockedSlot}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              padding: '20px',
              width: '100%',
              maxWidth: '440px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <strong style={{ fontSize: '16px', color: '#231F20' }}>
                Đăng ký lịch bận / nghỉ phép
              </strong>
              <button
                type="button"
                onClick={() => setBlockModalOpen(false)}
                aria-label="Đóng hộp thoại lịch bận"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#6B5E54',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '12.5px', color: '#6B5E54' }}>
              Hệ thống tự động khóa khung giờ này khỏi lịch trống và thông báo
              ngay cho Chủ Studio. Các khung giờ đã có ca chụp sẽ không thể tự
              khóa.
            </p>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#3F362F' }}>
                Ngày bận *
              </span>
              <input
                type="date"
                required
                min={getTodayIctDateKey()}
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                style={{
                  border: '1px solid #D8CAB9',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontSize: '13px',
                }}
              />
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={blockAllDay ? 'staff-btn-active' : 'staff-btn-outline'}
                onClick={() => setBlockAllDay(true)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Cả ngày
              </button>
              <button
                type="button"
                className={!blockAllDay ? 'staff-btn-active' : 'staff-btn-outline'}
                onClick={() => setBlockAllDay(false)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Theo khung giờ
              </button>
            </div>

            {!blockAllDay && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#3F362F' }}>
                    Từ giờ
                  </span>
                  <input
                    type="time"
                    required
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                    style={{
                      border: '1px solid #D8CAB9',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      fontSize: '13px',
                    }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#3F362F' }}>
                    Đến giờ
                  </span>
                  <input
                    type="time"
                    required
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                    style={{
                      border: '1px solid #D8CAB9',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      fontSize: '13px',
                    }}
                  />
                </label>
              </div>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#3F362F' }}>
                Lý do (tuỳ chọn)
              </span>
              <input
                type="text"
                maxLength={300}
                placeholder="VD: Bận việc gia đình, bảo dưỡng thiết bị..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                style={{
                  border: '1px solid #D8CAB9',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontSize: '13px',
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="staff-btn-outline"
                onClick={() => setBlockModalOpen(false)}
              >
                Đóng
              </button>
              <button
                type="submit"
                className="staff-btn-primary"
                disabled={submittingBlock}
              >
                {submittingBlock ? 'Đang lưu...' : 'Xác nhận lịch bận'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
