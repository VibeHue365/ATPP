import httpClient from '@/apis/httpClient';
import type { ReviewPayload,ReviewRecord } from '@/types/review';
export const reviewApi={create:(payload:ReviewPayload)=>httpClient.post<never,ReviewRecord>('/reviews',payload)};
