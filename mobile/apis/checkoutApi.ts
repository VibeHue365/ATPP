import httpClient from '@/apis/httpClient';
import type { CartItem } from '@/types/cart';
import type { BookingResponse, PaymentLinkResponse, PaymentPurpose, PaymentStatusResponse, PhotographyHoldResponse } from '@/types/checkout';

export const checkoutApi = {
  createRentalBooking: (items: CartItem[], promoCode?: string) => httpClient.post<never, BookingResponse>('/bookings', {
    bookingType: 'AODAI_RENTAL',
    items: items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      rentalFrom: item.rentalFrom,
      rentalTo: item.rentalTo,
      selectedSize: item.size,
      selectedColor: item.color,
      rentalType: item.rentalType ?? 'DAILY',
      ...(item.rentalType === 'HOURLY' ? { shootDate: item.rentalFrom, shootTimeSlot: `${item.startTime}-${item.endTime}` } : {}),
    })),
    travelFee: 0,
    serviceFee: 0,
    promoCode: promoCode || undefined,
  }),
  createPhotographyHold: (photo: CartItem, rentals: CartItem[]) => {
    const [startTime, endTime] = (photo.shootTimeSlot ?? '').split('-').map(value => value.trim());
    const payload = {
      packageId: photo.photographyPackageId,
      sessions: [{
        clientId: photo.id,
        startsAt: `${photo.shootDate}T${startTime}:00+07:00`,
        endsAt: `${photo.shootDate}T${endTime}:00+07:00`,
        locationAddress: photo.shootLocation,
        locationLatitude: photo.shootLocationLatitude,
        locationLongitude: photo.shootLocationLongitude,
      }],
      concept: photo.shootConcept || undefined,
      customRequests: photo.customRequests || undefined,
      ...(rentals.length ? { aodaiItems: rentals.map(item => ({ productId:item.productId, selectedSize:item.size, selectedColor:item.color, rentalFrom:item.rentalFrom, rentalTo:item.rentalTo, quantity:item.quantity })) } : {}),
    };
    const endpoint = rentals.length ? '/api/bookings/combo/photography-hold' : '/api/bookings/photography/hold';
    return httpClient.post<never, PhotographyHoldResponse>(endpoint, payload, { headers: { 'Idempotency-Key': `mobile-hold-${Date.now()}-${Math.random().toString(36).slice(2)}` } });
  },
  createPaymentLink: (bookingId: string, purpose: PaymentPurpose) => httpClient.post<never, PaymentLinkResponse>('/payments/create-link', { bookingId, purpose }),
  status: (code: string) => httpClient.get<never, PaymentStatusResponse>(`/payments/${encodeURIComponent(code)}/status`),
  pending: () => httpClient.get<never, Array<{ paymentCode:string; bookingId:string; checkoutUrl?:string|null }>>('/payments/pending-checkouts'),
};
