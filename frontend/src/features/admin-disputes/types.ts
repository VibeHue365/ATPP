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
      grandTotal?: number;
    };
    bookingType?: string;
    createdAt?: string;
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
    fullName?: string;
    profile?: {
      fullName?: string;
    };
  };
  openedBy?: {
    fullName?: string;
    profile?: {
      fullName?: string;
    };
  };
  requestedAmount: number;
  description: string;
  evidencePhotos?: string[];
  actionType?: string;
  status?: string;
  createdAt?: string;
}

export interface ResolvePayload {
  decision: DisputeDecision;
  notes: string;
  refundAmount?: number;
  compensationAmount?: number;
}
