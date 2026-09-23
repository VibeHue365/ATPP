export interface NotificationItem { _id:string; title:string; content:string; type:string; isRead:boolean; readAt?:string|null; metadata?:Record<string,unknown>; createdAt:string; }
