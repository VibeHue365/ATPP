export type PaymentPurpose = 'FULL_PAYMENT' | 'DEPOSIT_PAYMENT';

export interface BookingResponse {
  _id: string;
  bookingCode?: string;
}

export interface PhotographyHoldResponse {
  bookingId: string;
  bookingCode?: string;
  expiresAt?: string;
}

export interface PaymentLinkResponse {
  paymentCode: string;
  payos?: {
    checkoutUrl?: string | null;
    qrCode?: string | null;
  };
}

export interface PaymentStatusResponse {
  paymentCode: string;
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  bookingId: string;
  bookingStatus: string;
  bookingPaymentStatus?: string;
  confirmed: boolean;
  checkoutUrl?: string | null;
}

export interface PendingCheckout {
  paymentCode: string;
  bookingId: string;
  cartItemIds: string[];
  checkoutUrl?: string | null;
  createdAt: string;
}
