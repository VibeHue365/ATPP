import httpClient from '@/apis/httpClient';
import type { ChatMessage, ChatRoom } from '@/types/chat';
export const chatApi={rooms:()=>httpClient.get<never,ChatRoom[]>('/chat/rooms'),messages:(roomId:string,limit=100,skip=0)=>httpClient.get<never,ChatMessage[]>(`/chat/rooms/${roomId}/messages?limit=${limit}&skip=${skip}`),createRoom:(otherUserId:string)=>httpClient.post<never,ChatRoom>('/chat/rooms',{otherUserId}),send:(roomId:string,messageText:string,attachments:string[]=[])=>httpClient.post<never,ChatMessage>(`/chat/rooms/${roomId}/messages`,{messageText,attachments})};
