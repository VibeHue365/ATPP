import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Phone, UserCheck, Clock } from 'lucide-react';
import { chatService } from '../../../../services/chatService';
import { ROUTES } from '../../../../config/routes';
import { useToast } from '../../../../components/feedback/Toast';
import { getMediaUrl } from '../../../../shared/media/mediaUrl';

interface AssignedStaffContactCardProps {
  booking: any;
  studioName?: string;
}

function resolveIdString(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    if (typeof raw._id === 'string') return raw._id;
    if (raw._id?.toString) return raw._id.toString();
    if (typeof raw.id === 'string') return raw.id;
  }
  return raw?.toString ? raw.toString() : null;
}

function formatTimeShort(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export const AssignedStaffContactCard: React.FC<AssignedStaffContactCardProps> = ({
  booking,
  studioName,
}) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [openingChatKey, setOpeningChatKey] = useState<'staff' | 'studio' | null>(null);

  if (!booking) return null;

  const schedules: any[] = Array.isArray(booking.schedules) ? booking.schedules : [];
  const photoshootSchedule =
    schedules.find(
      (s: any) =>
        s?.scheduleType === 'PHOTOSHOOT' &&
        s?.status !== 'CANCELLED' &&
        s?.status !== 'EXPIRED',
    ) ||
    schedules.find((s: any) => s?.scheduleType === 'PHOTOSHOOT') ||
    booking.photoshootSchedule ||
    null;

  const assignedStaffSnap = photoshootSchedule?.assignedStaffSnapshot || null;
  const assignedStaffTargetId =
    resolveIdString(assignedStaffSnap?.linkedUserId) ||
    resolveIdString(photoshootSchedule?.assignedStaffId) ||
    resolveIdString(assignedStaffSnap?.staffId) ||
    null;

  const photoItem = booking.items?.find(
    (it: any) => it.itemType === 'PHOTOGRAPHY_PACKAGE' || it.photographyPackageId,
  );
  const photoProviderObj =
    (photoItem?.providerId && typeof photoItem.providerId === 'object' ? photoItem.providerId : null) ||
    (booking.providerIds?.find((p: any) => p && typeof p === 'object') ?? null);

  const photoProviderId =
    resolveIdString(photoProviderObj?.userId) ||
    resolveIdString(photoshootSchedule?.providerId) ||
    resolveIdString(photoItem?.providerId) ||
    resolveIdString(booking.providerIds?.[0]) ||
    null;

  const handleOpenChat = async (targetId: string | null, kind: 'staff' | 'studio') => {
    if (!targetId) {
      toast.error('Chưa có thông tin tài khoản trò chuyện cho lựa chọn này.');
      return;
    }
    try {
      setOpeningChatKey(kind);
      const room = await chatService.getOrCreateRoom(targetId);
      navigate(ROUTES.CHAT, { state: { activeRoomId: room.id } });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Không thể mở cuộc trò chuyện lúc này.',
      );
    } finally {
      setOpeningChatKey(null);
    }
  };

  const avatarSrc = assignedStaffSnap?.avatarUrl
    ? getMediaUrl(assignedStaffSnap.avatarUrl) || assignedStaffSnap.avatarUrl
    : null;

  return (
    <div
      style={{
        backgroundColor: '#FCF9F2',
        border: '1px solid #E7DAC9',
        borderRadius: '16px',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 16px rgba(142, 27, 46, 0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            color: '#8E1B2E',
            fontWeight: 800,
            fontSize: '13.5px',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          <UserCheck size={16} />
          <span>Thợ chụp phụ trách ca của bạn</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {!assignedStaffSnap?.name && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '999px',
                backgroundColor: '#FFFBEB',
                color: '#B45309',
                border: '1px solid #FDE68A',
              }}
            >
              <Clock size={12} />
              Đang chờ Studio điều phối
            </span>
          )}
          {photoshootSchedule?.checkedInAt && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '999px',
                backgroundColor: '#FFFBEB',
                color: '#B45309',
                border: '1px solid #FDE68A',
              }}
            >
              <Clock size={12} />
              Thợ đã check-in ({formatTimeShort(photoshootSchedule.checkedInAt)})
            </span>
          )}
          {photoshootSchedule?.checkInPhotoUrl && (
            <a
              href={photoshootSchedule.checkInPhotoUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '2px 10px 2px 4px',
                borderRadius: '999px',
                backgroundColor: '#FFFFFF',
                color: '#8E1B2E',
                border: '1px solid #F0DADC',
                textDecoration: 'none',
              }}
            >
              <img
                src={photoshootSchedule.checkInPhotoUrl}
                alt="Ảnh xác nhận check-in"
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '999px',
                  objectFit: 'cover',
                }}
              />
              <span>Xem ảnh check-in</span>
            </a>
          )}
          {photoshootSchedule?.shootFinishedAt && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '999px',
                backgroundColor: '#ECFDF5',
                color: '#047857',
                border: '1px solid #A7F3D0',
              }}
            >
              ✓ Đã hoàn tất chụp ({formatTimeShort(photoshootSchedule.shootFinishedAt)})
            </span>
          )}
        </div>
      </div>

      {assignedStaffSnap?.name ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={assignedStaffSnap.name}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '999px',
                  objectFit: 'cover',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '999px',
                  backgroundColor: '#F5E6E8',
                  color: '#8E1B2E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '16px',
                  flexShrink: 0,
                }}
              >
                {assignedStaffSnap.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#231F20' }}>
                {assignedStaffSnap.name}
                {assignedStaffSnap.specialty ? (
                  <span style={{ fontWeight: 600, color: '#6B5E54' }}>
                    {' '}
                    · {assignedStaffSnap.specialty}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: '12.5px', color: '#6B5E54' }}>
                {assignedStaffSnap.phone ? (
                  <>
                    SĐT thợ: <strong style={{ color: '#231F20' }}>{assignedStaffSnap.phone}</strong>
                  </>
                ) : null}
                {studioName ? (
                  <>
                    {assignedStaffSnap.phone ? ' • ' : ''}
                    Studio: <strong style={{ color: '#231F20' }}>{studioName}</strong>
                  </>
                ) : null}
              </div>
              {photoshootSchedule?.staffFieldNote && (
                <div style={{ fontSize: '12px', color: '#4A3F35', marginTop: '2px' }}>
                  <strong>Ghi chú hiện trường:</strong> {photoshootSchedule.staffFieldNote}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {assignedStaffTargetId && (
              <button
                type="button"
                disabled={openingChatKey === 'staff'}
                onClick={() => void handleOpenChat(assignedStaffTargetId, 'staff')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#8E1B2E',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '9px',
                  padding: '9px 14px',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  cursor: openingChatKey === 'staff' ? 'wait' : 'pointer',
                  boxShadow: '0 2px 8px rgba(142, 27, 46, 0.2)',
                }}
              >
                <MessageSquare size={14} />
                <span>
                  {openingChatKey === 'staff'
                    ? 'Đang mở...'
                    : `Chat với ${assignedStaffSnap.name}`}
                </span>
              </button>
            )}

            {assignedStaffSnap.phone && (
              <a
                href={`tel:${assignedStaffSnap.phone}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#3F362F',
                  border: '1px solid #D8CAB9',
                  borderRadius: '9px',
                  padding: '9px 13px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <Phone size={14} />
                <span>Gọi thợ</span>
              </a>
            )}

            {photoProviderId && (
              <button
                type="button"
                disabled={openingChatKey === 'studio'}
                onClick={() => void handleOpenChat(photoProviderId, 'studio')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#3F362F',
                  border: '1px solid #D8CAB9',
                  borderRadius: '9px',
                  padding: '9px 13px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: openingChatKey === 'studio' ? 'wait' : 'pointer',
                }}
              >
                <MessageSquare size={14} />
                <span>
                  {openingChatKey === 'studio' ? 'Đang mở...' : 'Chat với Studio'}
                </span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            backgroundColor: '#FFFFFF',
            border: '1px dashed #E4D4C3',
            borderRadius: '12px',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '220px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '999px',
                backgroundColor: '#FFFBEB',
                color: '#B45309',
                border: '1px solid #FDE68A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 750, color: '#231F20' }}>
                Studio đang điều phối thợ chụp phụ trách
              </div>
              <div style={{ fontSize: '12.5px', color: '#6B5E54', lineHeight: 1.45 }}>
                Tên thợ chụp, số điện thoại và nút nhắn tin trực tiếp sẽ hiển thị ngay sau khi{' '}
                <strong style={{ color: '#231F20' }}>{studioName || 'Studio'}</strong> xác nhận lịch hẹn của bạn.
              </div>
            </div>
          </div>
          {photoProviderId && (
            <button
              type="button"
              disabled={openingChatKey === 'studio'}
              onClick={() => void handleOpenChat(photoProviderId, 'studio')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#8E1B2E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9px',
                padding: '9px 14px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: openingChatKey === 'studio' ? 'wait' : 'pointer',
                boxShadow: '0 2px 8px rgba(142, 27, 46, 0.18)',
              }}
            >
              <MessageSquare size={14} />
              <span>{openingChatKey === 'studio' ? 'Đang mở...' : 'Chat với Studio'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
