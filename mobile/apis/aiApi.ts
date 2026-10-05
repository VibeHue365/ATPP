import httpClient from '@/apis/httpClient';
import type { AiChatResponse, AiImageMessage } from '@/types/ai';

export const aiApi = {
  chat: (message: string) =>
    httpClient.post<never, AiChatResponse>('/ai/chat', { message }),
  chatWithImage: (payload: AiImageMessage) =>
    httpClient.post<never, AiChatResponse>('/ai/chat/with-image', payload),
};
