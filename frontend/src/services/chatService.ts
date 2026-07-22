import { httpClient } from './httpClient';
import type { ChatRoom, ChatMessage } from '../types/chat.types';

export const chatService = {
  async getRooms(): Promise<ChatRoom[]> {
    return httpClient.get<ChatRoom[]>('/chat/rooms');
  },

  async getMessages(roomId: string, limit: number = 100, skip: number = 0): Promise<ChatMessage[]> {
    return httpClient.get<ChatMessage[]>(`/chat/rooms/${roomId}/messages?limit=${limit}&skip=${skip}`);
  },

  async getOrCreateRoom(otherUserId: string): Promise<ChatRoom> {
    return httpClient.post<ChatRoom>('/chat/rooms', { otherUserId });
  },

  async sendMessage(roomId: string, messageText: string, attachments: string[] = []): Promise<ChatMessage> {
    return httpClient.post<ChatMessage>(`/chat/rooms/${roomId}/messages`, { messageText, attachments });
  },

  async uploadChatImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await httpClient.post<{ url: string }>('/chat/upload', formData);
    return res.url;
  },
};
