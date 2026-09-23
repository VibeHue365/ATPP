export interface Order {
  _id: string;
  id?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAvatar?: string;
  customerInitials: string;
  customerType?: string;
  productName: string;
  serviceName?: string;
  orderDate: string;
  updatedDate?: string;
  total: string;
  status: string;
  totalAmount?: number;
  createdAt?: string;
  rawOrderDate?: string;
  photosApproved?: boolean;
  customerId?: any;
  items?: any[];
  schedules?: Array<{ status?: string;[key: string]: any }>;
  depositTotal?: number;
  startDate?: string;
  endDate?: string;
  rawStatus?: string;
  bookingType?: 'AODAI_RENTAL' | 'PHOTOGRAPHY' | 'COMBO' | string;
  pickupLocation?: string;
  customerNotes?: string;
  pricingSummary?: any;
  paymentSummary?: any;
  pickupDamageReport?: {
    reportedAt: string;
    description: string;
    evidencePhotos: string[];
  } | null;
}

export interface Product {
  _id: string;
  name: string;
  categoryId: {
    _id: string;
    name: string;
  } | string;
  description?: string;
  images: string[];
  colorImages?: { color: string; images: string[] }[];
  videos?: string[];
  basePrice: number;
  depositAmount: number;
  sizes: string[];
  colors: string[];
  materials: string[];
  style?: string;
  occasions?: string[];
  styleCategoryIds?: Array<string | { _id?: string; id?: string }>;
  eventCategoryIds?: Array<string | { _id?: string; id?: string }>;
  customTags?: Array<{
    label: string;
    normalizedLabel: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    mappedTagCode?: string | null;
  }>;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  taggingDecisionVersion?: number;
}

export interface PortfolioItem {
  _id: string;
  title: string;
  description?: string | null;
  images: string[];
  moderationStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
  moderationReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type CancellationRefundRule = {
  noticeDays: number;
  refundPercent: number;
};

export type VariantRow = { size: string; color: string; material: string; quantity: number; condition: string };
