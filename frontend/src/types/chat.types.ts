export interface ChatPartner {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  roles?: string[];
  defaultRole?: string;
}

export interface ChatRoomMessageSummary {
  id: string;
  messageText: string;
  senderId: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  otherParticipant: ChatPartner | null;
  lastMessage: ChatRoomMessageSummary | null;
  lastMessageAt: string | null;
  unreadCount?: number; // Optional local counter
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
