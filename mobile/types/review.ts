export interface ReviewPayload { bookingId:string; bookingItemId:string; rating:number; comment?:string; productId?:string; photographyPackageId?:string; images?:string[]; }
export interface ReviewRecord extends ReviewPayload { _id:string; reply?:string|null; repliedAt?:string|null; createdAt?:string; }
export interface ProductReview { _id:string; rating:number; comment?:string; content?:string; createdAt:string; userId?:ReviewUser; customerId?:ReviewUser; providerReply?:string|{content?:string}|null; reply?:string|null; images?:string[]; }
interface ReviewUser { fullName?:string; avatarUrl?:string; profile?:{fullName?:string;avatarUrl?:string}; }
