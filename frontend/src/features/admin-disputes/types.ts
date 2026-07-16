export type DisputeDecision = 'SHOP_RIGHT' | 'CUSTOMER_RIGHT' | 'SPLIT';

export interface Dispute {
  _id: string;
  bookingId?: {
    _id?: string;
    bookingCode?: string;
    pricingSummary?: {
      depositTotal?: number;
    };
  };
  bookingItemId?: {
    name?: string;
  };
  productId?: {
    name?: string;
  };
  reportedBy?: {
    businessName?: string;
    profile?: {
      fullName?: string;
    };
  };
  requestedAmount: number;
  description: string;
}

export interface ResolvePayload {
  decision: DisputeDecision;
  notes: string;
  refundAmount?: number;
  compensationAmount?: number;
}