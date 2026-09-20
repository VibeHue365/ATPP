import httpClient from './httpClient'; import type { NotificationItem } from '@/types/notification';
export const notificationApi={list:()=>httpClient.get<never,NotificationItem[]>('/notifications'),markRead:(id:string)=>httpClient.patch(`/notifications/${id}/read`),markAllRead:()=>httpClient.post('/notifications/read-all')};
