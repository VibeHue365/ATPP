export type ChatRoomCategory =
  | 'STAFF_TO_OWNER'
  | 'STAFF_TO_CUSTOMER'
  | 'OWNER_TO_STAFF'
  | 'CUSTOMER_TO_STAFF'
  | 'CUSTOMER_TO_PROVIDER'
  | 'SUPPORT'
  | 'GENERAL';

export type ChatParticipantRole = 'CUSTOMER' | 'PROVIDER' | 'STAFF' | 'ADMIN';

export interface ChatBookingContext {
  bookingId: string;
  bookingCode: string;
  bookingType: string;
  status: string;
  serviceLabel: string;
  shootDate: string | null;
  timeSlot: string | null;
  locationAddress: string | null;
}

export interface ChatPartner {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  roles?: string[];
  defaultRole?: string;
  participantRole?: ChatParticipantRole;
  roleBadge?: string;
  studioName?: string | null;
  staffSpecialty?: string | null;
}

export interface ChatRoom {
  id: string;
  otherParticipant: ChatPartner | null;
  lastMessage: {
    id: string;
    messageText: string;
    senderId: string;
    isRead: boolean;
    createdAt: string;
  } | null;
  lastMessageAt: string | null;
  unreadCount?: number;
  roomCategory?: ChatRoomCategory;
  isPinned?: boolean;
  bookingContext?: ChatBookingContext | null;
}

export interface ChatMessage {
  _id: string;
  roomId: string;
  senderId: string;
  messageText: string;
  attachments: string[];
  isRead: boolean;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
}
