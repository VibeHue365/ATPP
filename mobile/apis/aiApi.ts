import httpClient from '@/apis/httpClient';
import type { AiChatResponse, AiImageMessage, VisualSearchResult } from '@/types/ai';

export const aiApi = {
  chat: (message: string) =>
    httpClient.post<never, AiChatResponse>('/ai/chat', { message }),
  chatWithImage: (payload: AiImageMessage) =>
    httpClient.post<never, AiChatResponse>('/ai/chat/with-image', payload),
  /** VIB-93: open to guests; the backend rate-limits by user or IP. */
  visualSearch: (imageBase64: string, mimeType: string) =>
    httpClient.post<never, VisualSearchResult>('/ai/visual-search/match', {
      image_base64: imageBase64,
      mime_type: mimeType,
    }),
};
