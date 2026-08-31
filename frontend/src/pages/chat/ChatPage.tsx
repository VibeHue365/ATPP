import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../components/feedback/Toast';
import { chatService } from '../../services/chatService';
import { httpClient } from '../../services/httpClient';
import type { ChatRoom, ChatMessage } from '../../types/chat.types';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Plus,
  X
} from 'lucide-react';
import { API_BASE_URL } from '../../config/env';

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const location = useLocation();
  const toast = useToast();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // New Chat Dialog States
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [potentialPartners, setPotentialPartners] = useState<any[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);

  // File attachments state
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll ref for messages
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Initial redirect state from detail pages
  const stateActiveRoomId = location.state?.activeRoomId;

  // Fetch rooms list
  const fetchRooms = async (selectRoomId?: string) => {
    try {
      setLoadingRooms(true);
      const data = await chatService.getRooms();
      setRooms(data);

      // Select active room if passed or select first
      if (selectRoomId) {
        const found = data.find((r) => r.id === selectRoomId);
        if (found) setActiveRoom(found);
      } else if (data.length > 0 && !activeRoom) {
        setActiveRoom(data[0]);
      }
    } catch (err: any) {
      toast.error('Không thể tải danh sách phòng chat');
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms(stateActiveRoomId);
  }, [stateActiveRoomId]);

  // Load messages when active room changes
  useEffect(() => {
    if (!activeRoom) return;

    const fetchMessages = async () => {
      try {
        setLoadingMessages(true);
        const data = await chatService.getMessages(activeRoom.id);
        setMessages(data);

        // Join socket room
        if (socket) {
          socket.emit('join_room', { roomId: activeRoom.id });
          socket.emit('mark_read', { roomId: activeRoom.id });
        }
      } catch (err: any) {
        toast.error('Không thể tải lịch sử tin nhắn');
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeRoom, socket]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket listener for new messages
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (message: ChatMessage) => {
      // If message is for the active room, append it and mark as read
      if (activeRoom && message.roomId === activeRoom.id) {
        setMessages((prev) => [...prev, message]);
        socket.emit('mark_read', { roomId: activeRoom.id });
      }

      // Refresh the rooms list to update last message preview
      fetchRooms(activeRoom?.id);
    };

    const onRoomUpdate = () => {
      fetchRooms(activeRoom?.id);
    };

    const onMessagesRead = (data: { roomId: string; userId: string }) => {
      if (activeRoom && data.roomId === activeRoom.id && data.userId !== user?.id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.senderId === user?.id ? { ...msg, isRead: true } : msg
          )
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
  }, [socket, activeRoom, user]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newUrls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await chatService.uploadChatImage(file);
        newUrls.push(url);
      }
      setAttachmentUrls((prev) => [...prev, ...newUrls]);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải lên hình ảnh');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachmentUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    const hasText = !!inputText.trim();
    const hasAttachments = attachmentUrls.length > 0;
    if ((!hasText && !hasAttachments) || !activeRoom) return;

    const textToSend = inputText.trim();
    const attachmentsToSend = [...attachmentUrls];

    setInputText('');
    setAttachmentUrls([]);

    try {
      if (socket && isConnected) {
        socket.emit('send_message', {
          roomId: activeRoom.id,
          messageText: textToSend,
          attachments: attachmentsToSend,
        });
      } else {
        const newMsg = await chatService.sendMessage(activeRoom.id, textToSend, attachmentsToSend);
        setMessages((prev) => [...prev, newMsg]);
        fetchRooms(activeRoom.id);
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      toast.error('Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Open modal and fetch potential chat partners (Photographers / Shops)
  const handleOpenNewChat = async () => {
    setIsNewChatOpen(true);
    try {
      setLoadingPartners(true);
      const res = await httpClient.get<any>('/api/photographers');
      setPotentialPartners(res?.data || []);
    } catch (err: any) {
      toast.error('Không thể lấy danh sách đối tác');
    } finally {
      setLoadingPartners(false);
    }
  };

  const startNewChat = async (partnerUserId: string) => {
    setIsNewChatOpen(false);
    try {
      const room = await chatService.getOrCreateRoom(partnerUserId);
      // Select the newly created or fetched room
      setActiveRoom(room);
      fetchRooms(room.id);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tạo phòng chat');
    }
  };

  // Date helpers
  const formatTimeAgo = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'JUST NOW';
    if (diffMins < 60) return `${diffMins}M AGO`;
    if (diffHours < 24) return `${diffHours}H AGO`;

    // Default format Date
    return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' }).toUpperCase();
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const getPartnerRoleText = (roles?: string[]) => {
    if (!roles) return 'Đối tác';
    if (roles.includes('PHOTOGRAPHER')) return 'Photographer';
    if (roles.includes('MERCHANT') || roles.includes('STORE_OWNER')) return 'Shop';
    return 'Đối tác';
  };

  const getPartnerAvatar = (partner: any) => {
    if (partner?.avatarUrl) {
      if (partner.avatarUrl.startsWith('http')) return partner.avatarUrl;
      return `${API_BASE_URL}${partner.avatarUrl}`;
    }
    return '/avatar_hanna.webp';
  };

  return (
    <div style={{ backgroundColor: '#FCF9F2', minHeight: '90vh', padding: '24px 0' }}>
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px',
          height: '750px',
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #e7e5e4',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* LEFT COLUMN: Rooms List */}
        <div
          style={{
            borderRight: '1px solid #e7e5e4',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: '#FAFAF9',
          }}
        >
          <div style={{ padding: '24px 20px 12px', textAlign: 'left' }}>
            <h2
              className="font-header"
              style={{
                fontSize: '24px',
                fontWeight: 750,
                color: '#6b0c22',
                margin: 0,
              }}
            >
              Conversations
            </h2>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#78716c',
                marginTop: '4px',
              }}
            >
              ACTIVE INQUIRIES
            </div>
          </div>

          {/* Rooms stream */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {loadingRooms ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#78716c' }}>Đang tải...</div>
            ) : rooms.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a8a29e', fontSize: '13px' }}>
                Chưa có cuộc hội thoại nào. Nhấn nút bên dưới để tạo mới!
              </div>
            ) : (
              rooms.map((room) => {
                const partner = room.otherParticipant;
                const isSelected = activeRoom?.id === room.id;
                // Check if last message is sent by partner and is unread
                const isUnread =
                  room.lastMessage &&
                  room.lastMessage.senderId !== user?.id &&
                  !room.lastMessage.isRead;

                return (
                  <div
                    key={room.id}
                    onClick={() => setActiveRoom(room)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: isSelected ? '#F5F5F4' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      marginBottom: '4px',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={getPartnerAvatar(partner)}
                      alt={partner?.fullName}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1px solid #e7e5e4',
                      }}
                    />

                    {/* Unread badge dot */}
                    {isUnread && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '12px',
                          left: '48px',
                          width: '10px',
                          height: '10px',
                          backgroundColor: '#22c55e',
                          borderRadius: '50%',
                          border: '2px solid #FAFAF9',
                        }}
                      />
                    )}

                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: isUnread ? 700 : 600,
                            color: '#1c1917',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {partner?.fullName}
                        </span>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: isUnread ? '#6b0c22' : '#a8a29e' }}>
                          {formatTimeAgo(room.lastMessageAt || room.lastMessage?.createdAt)}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '11px',
                          color: '#78716c',
                          marginTop: '2px',
                          fontWeight: 500,
                        }}
                      >
                        {getPartnerRoleText(partner?.roles)}
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: isUnread ? '#1c1917' : '#78716c',
                          fontWeight: isUnread ? 600 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '4px',
                        }}
                      >
                        {room.lastMessage?.messageText || 'Chưa có tin nhắn nào'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom CTA block */}
          <div style={{ padding: '16px', borderTop: '1px solid #e7e5e4' }}>
            <button
              onClick={handleOpenNewChat}
              style={{
                width: '100%',
                backgroundColor: '#6b0c22',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#520818')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#6b0c22')}
            >
              <Plus size={16} />
              <span>CUỘC TRÒ CHUYỆN MỚI</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {activeRoom ? (
            <>
              {/* Header section */}
              <div
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid #e7e5e4',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
                  <img
                    src={getPartnerAvatar(activeRoom.otherParticipant)}
                    alt={activeRoom.otherParticipant?.fullName}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1px solid #e7e5e4',
                    }}
                  />
                  <div>
                    <h3
                      className="font-header"
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#1c1917',
                      }}
                    >
                      {activeRoom.otherParticipant?.fullName} - {getPartnerRoleText(activeRoom.otherParticipant?.roles)}
                    </h3>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#78716c',
                        marginTop: '2px',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          backgroundColor: isConnected ? '#22c55e' : '#a8a29e',
                          borderRadius: '50%',
                        }}
                      />
                      <span>
                        {isConnected ? 'ONLINE • TAILORED SESSIONS' : 'OFFLINE • LEAVE MESSAGES'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions container removed */}
              </div>

              {/* Message Stream */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '24px',
                  backgroundColor: '#FCF9F2',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {loadingMessages ? (
                  <div style={{ margin: 'auto', color: '#78716c' }}>Đang tải tin nhắn...</div>
                ) : messages.length === 0 ? (
                  <div style={{ margin: 'auto', color: '#a8a29e', fontSize: '13px' }}>
                    Hãy là người bắt đầu cuộc trò chuyện!
                  </div>
                ) : (
                  <>
                    {/* Grouping header — hardcoded single day divider for mockup look */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '8px 0',
                      }}
                    >
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e7e5e4' }} />
                      <span
                        style={{
                          padding: '0 16px',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          color: '#78716c',
                        }}
                      >
                        TODAY
                      </span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e7e5e4' }} />
                    </div>

                    {messages.map((msg) => {
                      const isMe = msg.senderId === user?.id;

                      return (
                        <div
                          key={msg._id}
                          style={{
                            display: 'flex',
                            justifyContent: isMe ? 'flex-end' : 'flex-start',
                            alignItems: 'flex-start',
                            gap: '12px',
                          }}
                        >
                          {!isMe && (
                            <img
                              src={getPartnerAvatar(activeRoom.otherParticipant)}
                              alt="Partner"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid #e7e5e4',
                                marginTop: '4px',
                              }}
                            />
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                            <div
                              style={{
                                padding: '12px 16px',
                                borderRadius: '16px',
                                borderBottomRightRadius: isMe ? '4px' : '16px',
                                borderBottomLeftRadius: isMe ? '16px' : '4px',
                                backgroundColor: isMe ? '#6b0c22' : '#F5F5F4',
                                color: isMe ? '#FFFFFF' : '#1c1917',
                                fontSize: '14px',
                                lineHeight: 1.5,
                                textAlign: 'left',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                wordBreak: 'break-word',
                              }}
                            >
                              {msg.messageText}

                              {/* Attachment layout */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: msg.attachments.length === 1 ? '1fr' : '1fr 1fr',
                                    gap: '8px',
                                    marginTop: '8px',
                                  }}
                                >
                                  {msg.attachments.map((imgUrl, i) => (
                                    <img
                                      key={i}
                                      src={imgUrl}
                                      alt="attachment"
                                      style={{
                                        width: '100%',
                                        maxHeight: '180px',
                                        objectFit: 'cover',
                                        borderRadius: '8px',
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Status label: time + read status */}
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                color: '#a8a29e',
                                marginTop: '4px',
                                display: 'block',
                              }}
                            >
                              {formatMessageTime(msg.createdAt)}
                              {isMe && ` • ${msg.isRead ? 'READ' : 'SENT'}`}
                            </span>
                          </div>

                          {isMe && (
                            <img
                              src={getPartnerAvatar(user)}
                              alt="Me"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid #e7e5e4',
                                marginTop: '4px',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                    <div ref={messageEndRef} />
                  </>
                )}
              </div>

              {/* Bottom bar for message input */}
              <div
                style={{
                  padding: '16px 24px',
                  backgroundColor: '#FAFAF9',
                  borderTop: '1px solid #e7e5e4',
                }}
              >
                {/* Image Previews */}
                {(attachmentUrls.length > 0 || isUploading) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                      marginBottom: '12px',
                      padding: '4px',
                    }}
                  >
                    {attachmentUrls.map((url, index) => (
                      <div
                        key={index}
                        style={{
                          position: 'relative',
                          width: '60px',
                          height: '60px',
                          borderRadius: '8px',
                          border: '1px solid #e7e5e4',
                          overflow: 'hidden',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <img
                          src={url}
                          alt="preview"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        <button
                          onClick={() => handleRemoveAttachment(index)}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          title="Xóa ảnh"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    {isUploading && (
                      <div
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '8px',
                          border: '1px dashed #a8a29e',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#F5F5F4',
                          fontSize: '10px',
                          color: '#78716c',
                          fontWeight: 600,
                        }}
                      >
                        Tải lên...
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #e7e5e4',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                  }}
                >
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#78716c',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                    }}
                    title="Đính kèm tài liệu"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#78716c',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                    }}
                    title="Chọn ảnh đính kèm"
                  >
                    <ImageIcon size={18} />
                  </button>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />

                  <input
                    type="text"
                    placeholder="Compose your inquiry..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      fontSize: '14px',
                      color: '#1c1917',
                      padding: '8px 4px',
                    }}
                  />

                  <button
                    onClick={handleSendMessage}
                    disabled={(!inputText.trim() && attachmentUrls.length === 0) || isUploading}
                    style={{
                      backgroundColor: (inputText.trim() || attachmentUrls.length > 0) && !isUploading ? '#6b0c22' : '#a8a29e',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: (inputText.trim() || attachmentUrls.length > 0) && !isUploading ? 'pointer' : 'not-allowed',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#a8a29e',
                    letterSpacing: '0.05em',
                  }}
                >
                  <span>ĐÃ CÓ TRỢ LÝ SOẠN THẢO AI</span>
                  <span>TỐI ĐA 2.000 KÝ TỰ</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#a8a29e' }}>
              <Plus size={48} style={{ color: '#d6d3d1', marginBottom: '16px' }} />
              <h3 className="font-header" style={{ fontSize: '18px', color: '#78716c', margin: 0 }}>
                Hãy chọn một cuộc hội thoại
              </h3>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>
                Chọn một phòng chat ở cột trái hoặc nhấn nút để nhắn tin cho thợ chụp mới.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* NEW CHAT PARTNER DIALOG */}
      {isNewChatOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              border: '1px solid #e7e5e4',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '80vh',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e7e5e4',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 className="font-header text-stone-800 font-bold" style={{ margin: 0, fontSize: '18px' }}>
                Bắt đầu trò chuyện
              </h3>
              <button
                onClick={() => setIsNewChatOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#78716c',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#8c827a',
                  textAlign: 'left',
                  padding: '4px 8px 12px',
                  letterSpacing: '0.05em',
                }}
              >
                DANH SÁCH NHÀ CUNG CẤP & THỢ ẢNH
              </div>

              {loadingPartners ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#78716c' }}>
                  Đang tải danh sách...
                </div>
              ) : potentialPartners.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#a8a29e' }}>
                  Không tìm thấy thợ chụp nào.
                </div>
              ) : (
                potentialPartners.map((partner) => (
                  <div
                    key={partner._id}
                    onClick={() => startNewChat(partner.userId || partner._id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      marginBottom: '4px',
                      textAlign: 'left',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f4')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <img
                      src={partner.portfolio?.[0] || '/avatar_hanna.webp'}
                      alt={partner.businessName}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1px solid #e7e5e4',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1c1917' }}>
                        {partner.businessName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#78716c', marginTop: '2px' }}>
                        {partner.capabilities?.join(' • ') || 'Photographer'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
