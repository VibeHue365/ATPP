import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Eye,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { httpClient } from '../../../../services/httpClient';
import {
  staffApi,
  type ScheduleAvailableStaffItem,
  type StaffChatSupervisionResponse,
} from '../../staff/staffApi';

interface OrderStaffAssignmentCardProps {
  orderId: string;
  bookingStatus: string;
  schedule: any;
  toast: any;
  onOrderRefreshed?: (freshOrder: any) => void;
  fetchOrders?: (silent?: boolean, force?: boolean) => Promise<void>;
}

const formatTime = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
};

export const OrderStaffAssignmentCard: React.FC<
  OrderStaffAssignmentCardProps
> = ({
  orderId,
  bookingStatus,
  schedule,
  toast,
  onOrderRefreshed,
  fetchOrders,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<
    ScheduleAvailableStaffItem[]
  >([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatData, setChatData] =
    useState<StaffChatSupervisionResponse | null>(null);

  if (!schedule?._id) return null;

  const isTerminal = [
    'IN_PROGRESS',
    'AWAITING_REVIEW',
    'COMBO_PHOTOS_APPROVED',
    'RETURNED',
    'CANCELLED',
    'COMPLETED',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
  ].includes((bookingStatus || '').toUpperCase());
  const assignedSnap = schedule.assignedStaffSnapshot;

  const openPicker = async () => {
    setIsPickerOpen(true);
    setSelectedStaffId(schedule.assignedStaffId?.toString?.() || '');
    setReassignReason('');
    try {
      setLoadingStaff(true);
      const res = await staffApi.getAvailableStaffForSchedule(
        orderId,
        schedule._id,
      );
      setAvailableStaff(res.staff || []);
    } catch (err: any) {
      toast?.error?.(
        err?.message || 'Không thể tải danh sách thợ chụp cho lịch này.',
      );
      setIsPickerOpen(false);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      toast?.error?.('Vui lòng chọn một thợ chụp.');
      return;
    }
    try {
      setSavingAssign(true);
      await staffApi.assignStaffToSchedule(orderId, schedule._id, {
        staffId: selectedStaffId,
        ...(reassignReason.trim() ? { reason: reassignReason.trim() } : {}),
      });
      toast?.success?.('Đã cập nhật phân công thợ chụp.');
      setIsPickerOpen(false);
      const fresh = await httpClient.get<any>(`/api/bookings/${orderId}`);
      if (fresh) {
        onOrderRefreshed?.(fresh);
      }
      await fetchOrders?.(true);
    } catch (err: any) {
      toast?.error?.(err?.message || 'Không thể phân công thợ chụp.');
    } finally {
      setSavingAssign(false);
    }
  };

  const openSupervisionChat = async () => {
    setIsChatOpen(true);
    try {
      setLoadingChat(true);
      const data = await staffApi.getStaffChatSupervision(
        orderId,
        schedule.assignedStaffId || undefined,
      );
      setChatData(data);
    } catch (err: any) {
      toast?.error?.(
        err?.message || 'Không thể tải lịch sử chat Khách ↔ Thợ.',
      );
      setIsChatOpen(false);
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <div
      style={{
        background: '#FCF9F2',
        border: '1px solid #E7DAC9',
        borderRadius: '12px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
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
            gap: '8px',
            fontSize: '13px',
            fontWeight: 800,
            color: '#8E1B2E',
          }}
        >
          <Camera size={16} />
          <span>Điều phối Thợ chụp phụ trách</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {!isTerminal && (
            <button
              type="button"
              onClick={openPicker}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#8E1B2E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 11px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} />
              <span>{assignedSnap ? 'Đổi thợ chụp' : 'Chọn thợ chụp'}</span>
            </button>
          )}

          {assignedSnap && (
            <button
              type="button"
              onClick={openSupervisionChat}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#FFFFFF',
                color: '#3F362F',
                border: '1px solid #D8CAB9',
                borderRadius: '8px',
                padding: '6px 11px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Eye size={12} />
              <span>Xem chat Khách ↔ Thợ (Chỉ đọc)</span>
            </button>
          )}
        </div>
      </div>

      {/* Current staff summary */}
      {assignedSnap ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            background: '#FFFFFF',
            borderRadius: '10px',
            padding: '10px 12px',
            border: '1px solid #ECE5DB',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '999px',
                background: '#F5E6E8',
                color: '#8E1B2E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '13px',
              }}
            >
              {assignedSnap.name?.charAt(0)?.toUpperCase() || 'T'}
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 750, color: '#231F20' }}>
                {assignedSnap.name}
                {assignedSnap.specialty ? ` · ${assignedSnap.specialty}` : ''}
              </div>
              {assignedSnap.phone && (
                <div style={{ fontSize: '12px', color: '#6B5E54' }}>
                  SĐT: {assignedSnap.phone}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {schedule.checkedInAt && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#FFFBEB',
                  color: '#B45309',
                  padding: '3px 8px',
                  borderRadius: '999px',
                }}
              >
                Check-in: {formatTime(schedule.checkedInAt)}
              </span>
            )}
            {schedule.shootFinishedAt && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#ECFDF5',
                  color: '#047857',
                  padding: '3px 8px',
                  borderRadius: '999px',
                }}
              >
                Chụp xong: {formatTime(schedule.shootFinishedAt)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            fontSize: '12.5px',
            color: '#92400E',
            background: '#FFFBEB',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #FDE68A',
          }}
        >
          Chưa phân công thợ cụ thể cho lịch chụp này. Bấm{' '}
          <strong>Chọn thợ chụp</strong> để chỉ định thợ phù hợp.
        </div>
      )}

      {schedule.staffFieldNote && (
        <div style={{ fontSize: '12px', color: '#4A3F35' }}>
          <strong>Ghi chú tác nghiệp từ thợ:</strong> {schedule.staffFieldNote}
        </div>
      )}

      {/* Inline Staff Reassignment Picker */}
      {isPickerOpen && (
        <form
          onSubmit={handleAssignSubmit}
          style={{
            background: '#FFFFFF',
            border: '1px solid #D8CAB9',
            borderRadius: '10px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <strong style={{ fontSize: '13px' }}>
              Chọn thợ chụp phù hợp cho ca này
            </strong>
            <button
              type="button"
              onClick={() => setIsPickerOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>

          {loadingStaff ? (
            <div style={{ fontSize: '12.5px', color: '#7D736B' }}>
              Đang kiểm tra lịch rảnh/bận từng thợ...
            </div>
          ) : availableStaff.length === 0 ? (
            <div style={{ fontSize: '12.5px', color: '#7D736B' }}>
              Studio chưa khai báo thợ chụp nào ở mục Quản lý Thợ chụp.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {availableStaff.map((st) => {
                const disabled = !st.available && !st.isCurrentAssigned;
                return (
                  <label
                    key={st.staffId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border:
                        selectedStaffId === st.staffId
                          ? '1.5px solid #8E1B2E'
                          : '1px solid #ECE5DB',
                      background: disabled ? '#F9FAFB' : '#FFFFFF',
                      opacity: disabled ? 0.65 : 1,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontSize: '12.5px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        name={`assign-staff-${schedule._id}`}
                        checked={selectedStaffId === st.staffId}
                        disabled={disabled}
                        onChange={() => setSelectedStaffId(st.staffId)}
                      />
                      <div>
                        <strong>{st.name}</strong>
                        {st.specialty ? ` · ${st.specialty}` : ''}
                        <div style={{ fontSize: '11.5px', color: '#6B5E54' }}>
                          {st.phone}
                        </div>
                      </div>
                    </div>

                    {st.available ? (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#047857',
                          background: '#ECFDF5',
                          padding: '2px 8px',
                          borderRadius: '999px',
                        }}
                      >
                        {st.isCurrentAssigned ? 'Đang phụ trách' : 'Đang rảnh'}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#B91C1C',
                          background: '#FEF2F2',
                          padding: '2px 8px',
                          borderRadius: '999px',
                        }}
                      >
                        {st.conflictReason || 'Đang bận'}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <input
            type="text"
            placeholder="Lý do điều phối / đổi thợ (tuỳ chọn)"
            value={reassignReason}
            onChange={(e) => setReassignReason(e.target.value)}
            style={{
              border: '1px solid #D8CAB9',
              borderRadius: '8px',
              padding: '7px 10px',
              fontSize: '12.5px',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsPickerOpen(false)}
              style={{
                border: '1px solid #D8CAB9',
                background: '#FFFFFF',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={savingAssign || !selectedStaffId}
              style={{
                border: 'none',
                background: '#8E1B2E',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: savingAssign ? 'not-allowed' : 'pointer',
              }}
            >
              {savingAssign ? 'Đang lưu...' : 'Xác nhận phân công'}
            </button>
          </div>
        </form>
      )}

      {/* Read-Only Supervision Chat Modal */}
      {isChatOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 16, 14, 0.52)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            padding: '16px',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '580px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #ECE5DB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} color="#8E1B2E" />
                <strong style={{ fontSize: '15px' }}>
                  Giám sát trao đổi Khách ↔ Thợ ({chatData?.bookingCode || 'Đơn hàng'})
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                background: '#FFFBEB',
                borderBottom: '1px solid #FDE68A',
                padding: '10px 20px',
                fontSize: '12px',
                color: '#92400E',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={14} />
              <span>
                Chế độ giám sát chỉ đọc — Chủ Studio xem nội dung trao đổi và
                không gửi tin nhắn trực tiếp vào luồng này.
              </span>
            </div>

            <div
              style={{
                padding: '16px 20px',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: '#FAF8F5',
              }}
            >
              {loadingChat ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#7D736B', fontSize: '13px' }}>
                  Đang tải lịch sử hội thoại...
                </div>
              ) : !chatData || chatData.messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#7D736B', fontSize: '13px' }}>
                  {chatData?.note || 'Chưa có tin nhắn nào giữa khách và thợ.'}
                </div>
              ) : (
                chatData.messages.map((msg) => {
                  const isStaffSender =
                    chatData.staff?.linkedUserId &&
                    msg.senderId === chatData.staff.linkedUserId;
                  return (
                    <div
                      key={msg._id}
                      style={{
                        alignSelf: isStaffSender ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        background: isStaffSender ? '#8E1B2E' : '#FFFFFF',
                        color: isStaffSender ? '#FFFFFF' : '#231F20',
                        border: isStaffSender ? 'none' : '1px solid #ECE5DB',
                        borderRadius: '12px',
                        padding: '9px 13px',
                        fontSize: '13px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          opacity: 0.8,
                          marginBottom: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {isStaffSender ? (
                          <CheckCircle2 size={10} />
                        ) : (
                          <UserCheck size={10} />
                        )}
                        <span>
                          {isStaffSender
                            ? chatData.staff?.name || 'Thợ chụp'
                            : chatData.customer?.fullName || 'Khách hàng'}
                        </span>
                      </div>
                      <div>{msg.messageText}</div>
                      <div
                        style={{
                          fontSize: '10px',
                          opacity: 0.72,
                          marginTop: '4px',
                          textAlign: 'right',
                        }}
                      >
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
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
