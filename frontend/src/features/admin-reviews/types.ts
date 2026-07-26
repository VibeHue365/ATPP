export type ReportAction = 'DELETE' | 'DISMISS';

export interface ReportedReview {
  _id: string;
  rating?: number;
  comment?: string;
  images?: string[];
  reportReason?: string;
  reportedAt?: string;
  bookingId?: {
    _id?: string;
    bookingCode?: string;
  };
  providerId?: {
    _id?: string;
    businessName?: string;
  };
  customerId?: {
    profile?: {
      fullName?: string;
    };
  };
}