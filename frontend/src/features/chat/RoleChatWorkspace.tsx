import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Camera,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/env';
import { useToast } from '../../components/feedback/Toast';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../auth/hooks/useAuth';
import { chatService, type AvailableChatPartner } from '../../services/chatService';
import type { ChatMessage, ChatPartner, ChatRoom } from '../../types/chat.types';
import './roleChatWorkspace.css';

export type RoleChatMode = 'customer' | 'provider' | 'staff';

export interface RoleChatWorkspaceProps {
  mode: RoleChatMode;
  embedded?: boolean;
  initialRoomId?: string | null;
  excludeProviderId?: string;
  studioOwnerUserId?: string | null;
  studioOwnerName?: string | null;
  onUnreadCountChange?: (count: number) => void;
}

interface FilterTabConfig {
  id: string;
  label: string;
}

interface ModeCopy {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  newButtonLabel: string | null;
  modalTitle: string;
  modalEmptyText: string;
  emptyInboxText: string;
  emptyActiveTitle: string;
  emptyActiveSubtitle: string;
  composerPlaceholder: string;
  filterTabs: FilterTabConfig[];
  quickReplies: string[];
}

const MODE_CONFIG: Record<RoleChatMode, ModeCopy> = {
  customer: {
    title: 'Tin nhắn của tôi',
    subtitle: 'Trao đổi với Studio, Tiệm Áo Dài & Thợ chụp',
    searchPlaceholder: 'Tìm tên Studio, Thợ chụp hoặc mã đơn...',
    newButtonLabel: 'Nhắn Studio',
    modalTitle: 'Chọn Studio / Tiệm Áo Dài',
    modalEmptyText: 'Bạn đã tạo hội thoại với tất cả đối tác đang hoạt động.',
    emptyInboxText:
      'Chưa có cuộc trò chuyện nào. Hãy chọn một Studio hoặc Thợ chụp để bắt đầu trao đổi.',
    emptyActiveTitle: 'Chọn một hội thoại để xem chi tiết',
    emptyActiveSubtitle:
      'Bạn có thể hỏi Studio về lịch trống, size Áo Dài hoặc trao đổi điểm hẹn với Thợ chụp.',
    composerPlaceholder: 'Nhập tin nhắn gửi Studio hoặc Thợ chụp...',
    filterTabs: [
      { id: 'ALL', label: 'Tất cả' },
      { id: 'STUDIOS', label: 'Studio / Tiệm Áo Dài' },
      { id: 'STAFF', label: 'Thợ chụp phụ trách' },
    ],
    quickReplies: [
      'Cho mình hỏi lịch chụp & size Áo Dài còn trống ạ',
      'Điểm hẹn & giờ chụp chính xác ở đâu vậy ạ?',
      'Nhờ Studio cập nhật giúp mình tiến độ ảnh',
    ],
  },
  provider: {
    title: 'Hộp thư Studio',
    subtitle: 'Chăm sóc khách hàng & điều phối đội ngũ Thợ chụp',
    searchPlaceholder: 'Tìm tên khách hàng, Thợ chụp hoặc mã đơn...',
    newButtonLabel: 'Nhắn Thợ chụp',
    modalTitle: 'Chọn Thợ chụp trong Studio',
    modalEmptyText: 'Toàn bộ Thợ chụp có tài khoản đã có kênh chat với bạn.',
    emptyInboxText:
      'Chưa có hội thoại nào. Tin nhắn từ khách hàng hoặc trao đổi nội bộ với Thợ chụp sẽ hiển thị tại đây.',
    emptyActiveTitle: 'Chọn hội thoại khách hàng hoặc Thợ chụp',
    emptyActiveSubtitle:
      'Tách biệt rõ hội thoại khách đặt lịch và điều phối Thợ chụp nội bộ.',
    composerPlaceholder: 'Nhập phản hồi khách hàng hoặc dặn dò Thợ chụp...',
    filterTabs: [
      { id: 'ALL', label: 'Tất cả' },
      { id: 'CUSTOMERS', label: 'Khách hàng' },
      { id: 'STAFF', label: 'Đội ngũ Thợ chụp' },
    ],
    quickReplies: [
      'Studio đã tiếp nhận và xác nhận lịch hẹn của bạn!',
      'Nhờ bạn kiểm tra lại địa điểm & khung giờ ca chụp hôm nay',
      'Ảnh hậu kỳ của bạn đang được hoàn thiện',
    ],
  },
  staff: {
    title: 'Trao đổi công việc',
    subtitle: 'Chỉ gồm Chủ Studio & Khách chụp bạn phụ trách',
    searchPlaceholder: 'Tìm Chủ Studio, tên khách hoặc mã đơn...',
    newButtonLabel: 'Liên hệ mới',
    modalTitle: 'Chủ Studio & Khách được phân công',
    modalEmptyText: 'Chưa có đối tượng nào khác ngoài các hội thoại hiện tại.',
    emptyInboxText:
      'Chưa có cuộc trò chuyện nào. Bạn chỉ nhắn tin với Chủ Studio và khách thuộc ca chụp được phân công.',
    emptyActiveTitle: 'Chọn hội thoại để trao đổi ca chụp',
    emptyActiveSubtitle:
      'Trao đổi nhanh điểm hẹn với khách hoặc báo cáo tiến độ cho Chủ Studio.',
    composerPlaceholder: 'Nhập tin nhắn gửi khách chụp hoặc Chủ Studio...',
    filterTabs: [
      { id: 'ALL', label: 'Tất cả' },
      { id: 'OWNER', label: 'Chủ Studio' },
      { id: 'CUSTOMERS', label: 'Khách chụp' },
    ],
    quickReplies: [
      'Mình đã có mặt tại điểm chụp rồi ạ',
      'Mình đang di chuyển tới điểm hẹn, khoảng 10 phút nữa tới',
      'Đã hoàn thành buổi chụp hôm nay!',
    ],
  },
};

const normalizeEntityId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'string') return record.id;
    if (typeof record._id === 'string') return record._id;
    if (typeof (value as { toString?: () => string }).toString === 'function') {
      const str = (value as { toString: () => string }).toString();
      if (str !== '[object Object]') return str;
    }
  }
  return '';
};

const resolveAssetUrl = (raw?: string | null): string | null => {
  if (!raw) return null;
  if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }
  return `${API_BASE_URL}${raw}`;
};

const getInitials = (name?: string | null): string => {
  const clean = (name || '').trim();
  if (!clean) return 'VH';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const resolveParticipantMeta = (
  partner: ChatPartner | null,
  mode: RoleChatMode,
): { badge: string; tone: 'provider' | 'staff' | 'customer' | 'admin' } => {
  if (partner?.roleBadge && partner?.participantRole) {
    const toneMap = {
      PROVIDER: 'provider',
      STAFF: 'staff',
      CUSTOMER: 'customer',
      ADMIN: 'admin',
    } as const;
    return {
      badge: partner.roleBadge,
      tone: toneMap[partner.participantRole] || 'customer',
    };
  }

  const roles = (partner?.roles || []).map((r) => String(r).toUpperCase());
  const def = String(partner?.defaultRole || '').toUpperCase();

  if (roles.includes('ADMIN') || def === 'ADMIN') {
    return { badge: 'Hỗ trợ VibeHue', tone: 'admin' };
  }
  if (
    roles.includes('PROVIDER') ||
    roles.includes('PHOTOGRAPHER') ||
    roles.includes('MERCHANT') ||
    roles.includes('STORE_OWNER') ||
    def === 'PROVIDER'
  ) {
    return {
      badge: mode === 'staff' ? 'Chủ Studio' : 'Studio / Đối tác',
      tone: 'provider',
    };
  }
  if (roles.includes('STAFF') || def === 'STAFF') {
    return {
      badge: mode === 'provider' ? 'Thợ chụp Studio' : 'Thợ chụp phụ trách',
      tone: 'staff',
    };
  }
  return {
    badge: mode === 'staff' ? 'Khách chụp của bạn' : 'Khách hàng',
    tone: 'customer',
  };
};

const formatRelativeTime = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const formatDayDivider = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Hôm nay';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hôm nay';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatShootDateShort = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const RoleChatWorkspace: React.FC<RoleChatWorkspaceProps> = ({
  mode,
  embedded = false,
  initialRoomId = null,
  excludeProviderId,
  studioOwnerUserId = null,
  studioOwnerName = null,
  onUnreadCountChange,
}) => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const toast = useToast();

  const copy = MODE_CONFIG[mode];

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [inputText, setInputText] = useState('');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [potentialPartners, setPotentialPartners] = useState<AvailableChatPartner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [openingStudioChat, setOpeningStudioChat] = useState(false);

  const messagesRequestIdRef = useRef(0);
  const activeRoomRef = useRef<ChatRoom | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  const fetchRooms = async (selectRoomId?: string | null, silent = false) => {
    try {
      if (!silent) setLoadingRooms(true);
      const data = await chatService.getRooms();
      setRooms(data);
      onUnreadCountChange?.(
        data.reduce((total, room) => total + (room.unreadCount || 0), 0),
      );

      if (selectRoomId) {
        const found = data.find(
          (r) => normalizeEntityId(r.id) === normalizeEntityId(selectRoomId),
        );
        if (found) {
          setActiveRoom(found);
          return;
        }
      }

      if (activeRoomRef.current) {
        const refreshedActive = data.find(
          (r) =>
            normalizeEntityId(r.id) === normalizeEntityId(activeRoomRef.current?.id),
        );
        if (refreshedActive) {
          setActiveRoom(refreshedActive);
        }
      } else if (data.length > 0 && typeof window !== 'undefined' && window.innerWidth > 768) {
        setActiveRoom(data[0]);
      }
    } catch {
      if (!silent) {
        toast.error('Không thể tải danh sách hội thoại');
      }
    } finally {
      if (!silent) setLoadingRooms(false);
    }
  };

  useEffect(() => {
    void fetchRooms(initialRoomId);
  }, [initialRoomId, mode]);

  useEffect(() => {
    if (!activeRoom) {
      setMessages([]);
      return;
    }

    const roomId = normalizeEntityId(activeRoom.id);
    const requestId = ++messagesRequestIdRef.current;

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const data = await chatService.getMessages(roomId);
        if (messagesRequestIdRef.current !== requestId) return;
        setMessages(data);
        setRooms((prev) => {
          const next = prev.map((r) =>
            normalizeEntityId(r.id) === roomId ? { ...r, unreadCount: 0 } : r,
          );
          onUnreadCountChange?.(
            next.reduce((sum, r) => sum + (r.unreadCount || 0), 0),
          );
          return next;
        });

        if (socket && isConnected) {
          socket.emit('join_room', { roomId });
          socket.emit('mark_read', { roomId });
        }
      } catch {
        if (messagesRequestIdRef.current === requestId) {
          toast.error('Không thể tải lịch sử tin nhắn');
        }
      } finally {
        if (messagesRequestIdRef.current === requestId) {
          setLoadingMessages(false);
        }
      }
    };

    void loadMessages();
  }, [activeRoom?.id, socket, isConnected]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, activeRoom?.id]);

  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (message: ChatMessage) => {
      const current = activeRoomRef.current;
      if (
        current &&
        normalizeEntityId(message.roomId) === normalizeEntityId(current.id)
      ) {
        setMessages((prev) => {
          if (
            prev.some(
              (item) => normalizeEntityId(item._id) === normalizeEntityId(message._id),
            )
          ) {
            return prev;
          }
          return [...prev, message];
        });
        if (normalizeEntityId(message.senderId) !== normalizeEntityId(user?.id)) {
          socket.emit('mark_read', { roomId: normalizeEntityId(current.id) });
        }
      }
      void fetchRooms(current?.id, true);
    };

    const onRoomUpdate = () => {
      void fetchRooms(activeRoomRef.current?.id, true);
    };

    const onMessagesRead = (data: { roomId: string; userId: string }) => {
      const current = activeRoomRef.current;
      if (
        current &&
        normalizeEntityId(data.roomId) === normalizeEntityId(current.id) &&
        normalizeEntityId(data.userId) !== normalizeEntityId(user?.id)
      ) {
        setMessages((prev) =>
          prev.map((msg) =>
            normalizeEntityId(msg.senderId) === normalizeEntityId(user?.id)
              ? { ...msg, isRead: true }
              : msg,
          ),
        );
      }
    };

    socket.on('new_message', onNewMessage);
    socket.on('room_update', onRoomUpdate);
    socket.on('messages_read', onMessagesRead);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('room_update', onRoomUpdate);
      socket.off('messages_read', onMessagesRead);
    };
  }, [socket, user?.id]);

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rooms.filter((room) => {
      if (activeFilter !== 'ALL') {
        const meta = resolveParticipantMeta(room.otherParticipant, mode);
        if (mode === 'customer') {
          if (activeFilter === 'STUDIOS' && room.roomCategory !== 'CUSTOMER_TO_PROVIDER' && meta.tone !== 'provider') {
            return false;
          }
          if (activeFilter === 'STAFF' && room.roomCategory !== 'CUSTOMER_TO_STAFF' && meta.tone !== 'staff') {
            return false;
          }
        } else if (mode === 'provider') {
          if (activeFilter === 'STAFF' && room.roomCategory !== 'OWNER_TO_STAFF' && meta.tone !== 'staff') {
            return false;
          }
          if (activeFilter === 'CUSTOMERS' && room.roomCategory === 'OWNER_TO_STAFF') {
            return false;
          }
        } else if (mode === 'staff') {
          if (activeFilter === 'OWNER' && room.roomCategory !== 'STAFF_TO_OWNER' && meta.tone !== 'provider') {
            return false;
          }
          if (activeFilter === 'CUSTOMERS' && room.roomCategory === 'STAFF_TO_OWNER') {
            return false;
          }
        }
      }

      if (!q) return true;
      const haystack = [
        room.otherParticipant?.fullName,
        room.otherParticipant?.studioName,
        room.bookingContext?.bookingCode,
        room.lastMessage?.messageText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rooms, activeFilter, searchQuery, mode]);

  const hasStaffOwnerRoom = useMemo(() => {
    if (mode !== 'staff') return true;
    return rooms.some(
      (r) =>
        r.roomCategory === 'STAFF_TO_OWNER' ||
        resolveParticipantMeta(r.otherParticipant, 'staff').tone === 'provider',
    );
  }, [rooms, mode]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachmentUrls.length + files.length > 5) {
      toast.error('Mỗi tin nhắn chỉ đính kèm tối đa 5 ảnh.');
      return;
    }

    try {
      setIsUploading(true);
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await chatService.uploadChatImage(files[i]);
        uploaded.push(url);
      }
      setAttachmentUrls((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      toast.error(err?.message || 'Tải ảnh thất bại');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async () => {
    const cleanText = inputText.trim();
    if ((!cleanText && attachmentUrls.length === 0) || !activeRoom || isUploading) {
      return;
    }

    const roomId = normalizeEntityId(activeRoom.id);
    const pendingAttachments = [...attachmentUrls];
    setInputText('');
    setAttachmentUrls([]);

    try {
      if (socket && isConnected) {
        socket.emit('send_message', {
          roomId,
          messageText: cleanText,
          attachments: pendingAttachments,
        });
      } else {
        const sent = await chatService.sendMessage(
          roomId,
          cleanText,
          pendingAttachments,
        );
        setMessages((prev) => [...prev, sent]);
        void fetchRooms(roomId, true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể gửi tin nhắn');
      setInputText(cleanText);
      setAttachmentUrls(pendingAttachments);
    }
  };

  const handleOpenNewChatModal = async () => {
    setIsPartnerModalOpen(true);
    try {
      setLoadingPartners(true);
      const partners = await chatService.getAvailablePartners();
      setPotentialPartners(
        excludeProviderId
          ? partners.filter((p) => String(p._id) !== String(excludeProviderId))
          : partners,
      );
    } catch {
      toast.error('Không thể tải danh sách liên hệ');
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleStartRoomWithPartner = async (partnerUserId: string) => {
    try {
      const room = await chatService.getOrCreateRoom(partnerUserId);
      setIsPartnerModalOpen(false);
      setActiveRoom(room);
      await fetchRooms(room.id, true);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể mở cuộc trò chuyện');
    }
  };

  const handleQuickChatStudioOwner = async () => {
    if (!studioOwnerUserId) return;
    try {
      setOpeningStudioChat(true);
      const room = await chatService.getOrCreateRoom(studioOwnerUserId);
      setActiveRoom(room);
      await fetchRooms(room.id, true);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể mở kênh chat Chủ Studio');
    } finally {
      setOpeningStudioChat(false);
    }
  };

  const activePartnerMeta = activeRoom
    ? resolveParticipantMeta(activeRoom.otherParticipant, mode)
    : null;
  const activeAvatarSrc = resolveAssetUrl(activeRoom?.otherParticipant?.avatarUrl);
  const myAvatarSrc = resolveAssetUrl(user?.avatar);

  return (
    <div
      className={`rcw-root ${embedded ? 'rcw-embedded' : 'rcw-full'} ${
        activeRoom ? 'has-active-mobile' : ''
      }`}
      data-chat-mode={mode}
    >
      {/* Left Sidebar: Inbox */}
      <aside className="rcw-sidebar">
        <div className="rcw-sidebar-header">
          <div className="rcw-sidebar-title-row">
            <div>
              <h2 className="rcw-sidebar-title">{copy.title}</h2>
              <p className="rcw-sidebar-subtitle">{copy.subtitle}</p>
            </div>
            {copy.newButtonLabel && (
              <button
                type="button"
                className="rcw-new-btn"
                onClick={handleOpenNewChatModal}
              >
                <Plus size={14} />
                <span>{copy.newButtonLabel}</span>
              </button>
            )}
          </div>

          <div className="rcw-search-wrap">
            <Search size={15} className="rcw-search-icon" />
            <input
              type="text"
              className="rcw-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
            />
          </div>

          <div className="rcw-tabs" role="tablist" aria-label="Bộ lọc hội thoại">
            {copy.filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeFilter === tab.id}
                className={`rcw-tab ${activeFilter === tab.id ? 'active' : ''}`}
                onClick={() => setActiveFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rcw-room-list">
          {mode === 'staff' && studioOwnerUserId && !hasStaffOwnerRoom && (
            <button
              type="button"
              className="rcw-pinned-cta"
              onClick={handleQuickChatStudioOwner}
              disabled={openingStudioChat}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#8e1b2e' }}>
                  Nhắn Chủ Studio {studioOwnerName ? `(${studioOwnerName})` : ''}
                </div>
                <div style={{ fontSize: '11.5px', color: '#7d736b' }}>
                  Kênh trao đổi trực tiếp về lịch chụp & thiết bị
                </div>
              </div>
              <MessageSquare size={16} color="#8e1b2e" />
            </button>
          )}

          {loadingRooms ? (
            <div className="rcw-empty-state">Đang tải danh sách hội thoại...</div>
          ) : filteredRooms.length === 0 ? (
            <div className="rcw-empty-state">
              <MessageSquare size={26} color="#b5aba0" />
              <p style={{ margin: 0, fontSize: '13px' }}>{copy.emptyInboxText}</p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const roomId = normalizeEntityId(room.id);
              const isSelected =
                normalizeEntityId(activeRoom?.id) === roomId;
              const partner = room.otherParticipant;
              const meta = resolveParticipantMeta(partner, mode);
              const avatarSrc = resolveAssetUrl(partner?.avatarUrl);
              const unreadCount = room.unreadCount || 0;
              const hasUnread =
                unreadCount > 0 ||
                Boolean(
                  room.lastMessage &&
                    normalizeEntityId(room.lastMessage.senderId) !==
                      normalizeEntityId(user?.id) &&
                    !room.lastMessage.isRead,
                );

              return (
                <button
                  key={roomId}
                  type="button"
                  className={`rcw-room-item ${isSelected ? 'active' : ''} ${
                    room.isPinned ? 'pinned' : ''
                  }`}
                  onClick={() => setActiveRoom(room)}
                >
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={partner?.fullName || 'Avatar'}
                      className="rcw-avatar"
                    />
                  ) : (
                    <span className={`rcw-avatar-fallback rcw-avatar-role-${meta.tone}`}>
                      {getInitials(partner?.fullName)}
                    </span>
                  )}

                  <div className="rcw-room-body">
                    <div className="rcw-room-top">
                      <span className="rcw-room-name">
                        {partner?.fullName || 'Người dùng'}
                      </span>
                      <span className="rcw-room-time">
                        {formatRelativeTime(
                          room.lastMessage?.createdAt || room.lastMessageAt,
                        )}
                      </span>
                    </div>

                    <div className="rcw-badge-row">
                      <span className={`rcw-role-badge ${meta.tone}`}>
                        {room.isPinned && <Pin size={10} />}
                        {meta.badge}
                      </span>
                      {room.bookingContext?.bookingCode && (
                        <span className="rcw-booking-pill">
                          #{room.bookingContext.bookingCode}
                        </span>
                      )}
                    </div>

                    <div className="rcw-room-preview-row">
                      <span className={`rcw-room-preview ${hasUnread ? 'unread' : ''}`}>
                        {room.lastMessage
                          ? `${
                              normalizeEntityId(room.lastMessage.senderId) ===
                              normalizeEntityId(user?.id)
                                ? 'Bạn: '
                                : ''
                            }${
                              room.lastMessage.messageText || '[Đã gửi hình ảnh]'
                            }`
                          : 'Bắt đầu cuộc trò chuyện'}
                      </span>
                      {unreadCount > 0 && (
                        <span className="rcw-unread-dot">{unreadCount}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Main Panel: Conversation */}
      <section className="rcw-main">
        {!activeRoom ? (
          <div className="rcw-empty-state">
            <MessageSquare size={36} color="#8e1b2e" />
            <h3 style={{ margin: '4px 0 0', fontSize: '16px', color: '#231f20' }}>
              {copy.emptyActiveTitle}
            </h3>
            <p style={{ margin: 0, maxWidth: '420px', fontSize: '13.5px' }}>
              {copy.emptyActiveSubtitle}
            </p>
          </div>
        ) : (
          <>
            <header className="rcw-conv-header">
              <div className="rcw-conv-user">
                <button
                  type="button"
                  className="rcw-back-btn"
                  aria-label="Quay lại danh sách hội thoại"
                  onClick={() => setActiveRoom(null)}
                >
                  <ArrowLeft size={16} />
                </button>

                {activeAvatarSrc ? (
                  <img
                    src={activeAvatarSrc}
                    alt={activeRoom.otherParticipant?.fullName || 'Avatar'}
                    className="rcw-avatar"
                  />
                ) : (
                  <span
                    className={`rcw-avatar-fallback rcw-avatar-role-${
                      activePartnerMeta?.tone || 'customer'
                    }`}
                  >
                    {getInitials(activeRoom.otherParticipant?.fullName)}
                  </span>
                )}

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong style={{ fontSize: '15px', color: '#231f20' }}>
                      {activeRoom.otherParticipant?.fullName || 'Người dùng'}
                    </strong>
                    {activePartnerMeta && (
                      <span className={`rcw-role-badge ${activePartnerMeta.tone}`}>
                        {activePartnerMeta.badge}
                      </span>
                    )}
                  </div>
                  {(activeRoom.otherParticipant?.studioName ||
                    activeRoom.otherParticipant?.staffSpecialty) && (
                    <div style={{ fontSize: '12px', color: '#7d736b', marginTop: '2px' }}>
                      {[
                        activeRoom.otherParticipant?.studioName,
                        activeRoom.otherParticipant?.staffSpecialty,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </div>
                  )}
                </div>
              </div>

              <div className="rcw-conn-status">
                <span
                  className={`rcw-conn-dot ${isConnected ? 'online' : 'offline'}`}
                />
                <span>{isConnected ? 'Trực tuyến' : 'Đang kết nối...'}</span>
              </div>
            </header>

            {activeRoom.bookingContext && (
              <div className="rcw-context-strip">
                <span className="rcw-context-tag">
                  <Camera size={12} />
                  Đơn #{activeRoom.bookingContext.bookingCode} •{' '}
                  {activeRoom.bookingContext.serviceLabel}
                </span>
                {(activeRoom.bookingContext.shootDate ||
                  activeRoom.bookingContext.timeSlot) && (
                  <span className="rcw-context-meta">
                    <Calendar size={12} />
                    {[
                      formatShootDateShort(activeRoom.bookingContext.shootDate),
                      activeRoom.bookingContext.timeSlot,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </span>
                )}
                {activeRoom.bookingContext.locationAddress && (
                  <span className="rcw-context-meta">
                    <MapPin size={12} />
                    {activeRoom.bookingContext.locationAddress}
                  </span>
                )}
              </div>
            )}

            <div className="rcw-messages" ref={messagesContainerRef}>
              {loadingMessages ? (
                <div className="rcw-empty-state">Đang tải tin nhắn...</div>
              ) : messages.length === 0 ? (
                <div className="rcw-empty-state">
                  Hãy gửi lời chào hoặc chọn gợi ý nhanh bên dưới để bắt đầu trao đổi.
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe =
                    normalizeEntityId(msg.senderId) === normalizeEntityId(user?.id);
                  const currentDay = msg.createdAt
                    ? formatDayDivider(msg.createdAt)
                    : '';
                  const prevDay =
                    idx > 0 && messages[idx - 1]?.createdAt
                      ? formatDayDivider(messages[idx - 1].createdAt)
                      : '';
                  const showDivider = currentDay && currentDay !== prevDay;
                  const readByOthers =
                    msg.isRead || (msg.readBy && msg.readBy.length > 1);

                  return (
                    <React.Fragment key={msg._id || idx}>
                      {showDivider && (
                        <div className="rcw-day-divider">
                          <span>{currentDay}</span>
                        </div>
                      )}
                      <div className={`rcw-msg-row ${isMe ? 'me' : 'other'}`}>
                        {isMe ? (
                          myAvatarSrc ? (
                            <img src={myAvatarSrc} alt="Tôi" className="rcw-avatar-sm" />
                          ) : (
                            <span className="rcw-avatar-fallback sm rcw-avatar-role-customer">
                              {getInitials(user?.fullName)}
                            </span>
                          )
                        ) : activeAvatarSrc ? (
                          <img
                            src={activeAvatarSrc}
                            alt={activeRoom.otherParticipant?.fullName || 'Avatar'}
                            className="rcw-avatar-sm"
                          />
                        ) : (
                          <span
                            className={`rcw-avatar-fallback sm rcw-avatar-role-${
                              activePartnerMeta?.tone || 'customer'
                            }`}
                          >
                            {getInitials(activeRoom.otherParticipant?.fullName)}
                          </span>
                        )}

                        <div>
                          <div className={`rcw-bubble ${isMe ? 'me' : 'other'}`}>
                            {msg.messageText && (
                              <div style={{ whiteSpace: 'pre-wrap' }}>
                                {msg.messageText}
                              </div>
                            )}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="rcw-attachments">
                                {msg.attachments.map((att, aIdx) => {
                                  const src = resolveAssetUrl(att);
                                  if (!src) return null;
                                  return (
                                    <a
                                      key={aIdx}
                                      href={src}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <img
                                        src={src}
                                        alt="Ảnh đính kèm"
                                        className="rcw-attachment-img"
                                      />
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className={`rcw-msg-meta ${isMe ? 'me' : ''}`}>
                            <span>
                              {msg.createdAt
                                ? new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                            {isMe && <span>{readByOthers ? 'Đã xem' : 'Đã gửi'}</span>}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messageEndRef} />
            </div>

            <div className="rcw-composer-wrap">
              <div className="rcw-quick-replies">
                {copy.quickReplies.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rcw-quick-chip"
                    onClick={() => setInputText(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {attachmentUrls.length > 0 && (
                <div className="rcw-preview-strip">
                  {attachmentUrls.map((url, idx) => (
                    <div key={idx} className="rcw-preview-item">
                      <img src={resolveAssetUrl(url) || url} alt="Xem trước" />
                      <button
                        type="button"
                        className="rcw-preview-remove"
                        aria-label="Xóa ảnh đính kèm"
                        onClick={() =>
                          setAttachmentUrls((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rcw-input-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  className="rcw-icon-btn"
                  title="Đính kèm hình ảnh"
                  aria-label="Đính kèm hình ảnh"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <ImageIcon size={17} />
                </button>
                <textarea
                  className="rcw-textarea"
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder={copy.composerPlaceholder}
                />
                <button
                  type="button"
                  className="rcw-send-btn"
                  onClick={() => void handleSendMessage()}
                  disabled={
                    (!inputText.trim() && attachmentUrls.length === 0) || isUploading
                  }
                >
                  <Send size={15} />
                  <span>Gửi</span>
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Scoped New Conversation Modal */}
      {isPartnerModalOpen && (
        <div
          className="rcw-modal-backdrop"
          onClick={() => setIsPartnerModalOpen(false)}
        >
          <div className="rcw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rcw-modal-header">
              <strong style={{ fontSize: '15.5px', color: '#231f20' }}>
                {copy.modalTitle}
              </strong>
              <button
                type="button"
                className="rcw-icon-btn"
                aria-label="Đóng hộp thoại"
                onClick={() => setIsPartnerModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="rcw-modal-list">
              {loadingPartners ? (
                <div className="rcw-empty-state">Đang tải danh sách...</div>
              ) : potentialPartners.length === 0 ? (
                <div className="rcw-empty-state">{copy.modalEmptyText}</div>
              ) : (
                potentialPartners.map((partner) => {
                  const avatarSrc = resolveAssetUrl(partner.avatarUrl);
                  return (
                    <button
                      key={partner.userId}
                      type="button"
                      className="rcw-partner-card"
                      onClick={() => void handleStartRoomWithPartner(partner.userId)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt={partner.businessName}
                            className="rcw-avatar"
                          />
                        ) : (
                          <span className="rcw-avatar-fallback rcw-avatar-role-provider">
                            {getInitials(partner.businessName)}
                          </span>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#231f20' }}>
                            {partner.businessName}
                          </div>
                          <div style={{ fontSize: '12px', color: '#7d736b' }}>
                            {partner.subtitle || 'Bắt đầu hội thoại'}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#8e1b2e',
                        }}
                      >
                        Nhắn tin
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleChatWorkspace;
