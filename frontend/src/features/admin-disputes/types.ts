export type DisputeDecision = 'SHOP_RIGHT' | 'CUSTOMER_RIGHT' | 'SPLIT';

export interface Dispute {
  _id: string;
  bookingId?: {
    _id?: string;
    bookingCode?: string;
    customerId?: {
      profile?: {
        fullName?: string;
      };
    };
    pricingSummary?: {
      depositTotal?: number;
    };
    deliveryDriveUrl?: string;
    deliveredPhotos?: string[];
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
  evidencePhotos?: string[];
}

export interface ResolvePayload {
  decision: DisputeDecision;
  notes: string;
  refundAmount?: number;
  compensationAmount?: number;
}
