export type DisputeDecision = 'SHOP_RIGHT' | 'CUSTOMER_RIGHT' | 'SPLIT';

export interface Dispute {
  _id: string;
  bookingId?: {
    _id?: string;
    bookingCode?: string;
    customerId?: {
      _id?: string;
      fullName?: string;
      email?: string;
      phone?: string;
      phoneNumber?: string;
      profile?: {
        fullName?: string;
        phone?: string;
        phoneNumber?: string;
      };
    };
    providerIds?: Array<{
      _id?: string;
      businessName?: string;
      fullName?: string;
      phone?: string;
      profile?: {
        fullName?: string;
      };
    }>;
    pricingSummary?: {
      depositTotal?: number;
      grandTotal?: number;
      subTotal?: number;
    };
    bookingType?: string;
    rentalStartDate?: string;
    rentalEndDate?: string;
    rentalPeriod?: any;
    status?: string;
    createdAt?: string;
    deliveryDriveUrl?: string;
    deliveredPhotos?: string[];
    handoverPhotos?: string[];
  };
  bookingItemId?: {
    _id?: string;
    name?: string;
    size?: string;
    color?: string;
    quantity?: number;
    depositAmount?: number;
    rentalPrice?: number;
    rentalFulfillment?: {
      status?: string;
      pickupEvidence?: { files?: Array<{ fileId?: string }> } | null;
      returnEvidence?: { files?: Array<{ fileId?: string }> } | null;
      customerReturnEvidence?: { files?: string[] } | null;
      history?: Array<{
        action: string;
        occurredAt: string;
        note?: string;
        metadata?: any;
      }>;
    };
  };
  productId?: {
    name?: string;
    code?: string;
    images?: string[];
  };
  reportedBy?: {
    _id?: string;
    businessName?: string;
    fullName?: string;
    phone?: string;
    profile?: {
      fullName?: string;
    };
  };
  openedBy?: {
    _id?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    profile?: {
      fullName?: string;
    };
  };
  requestedAmount: number;
  description: string;
  evidencePhotos?: string[];
  /** Evidence supplied by the customer when disputing an incident. */
  customerEvidencePhotos?: string[];
  customerReason?: string;
  actionType?: string;
  status?: string;
  adminNotes?: string;
  resolvedAt?: string;
  adminDecision?: any;
  createdAt?: string;
  isDirectDispute?: boolean;
}

export interface ResolvePayload {
  decision: DisputeDecision;
  notes: string;
  refundAmount?: number;
  compensationAmount?: number;
}
