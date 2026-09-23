import httpClient from '@/apis/httpClient';
import type { Booking, CancelBookingResponse, ProviderAvailability, ProviderBusyDates, RescheduleResponse } from '@/types/booking';

export interface ReschedulePayload { itemId:string; newRentalFrom?:string; newRentalTo?:string; newShootDate?:string; newShootTimeSlot?:string; reason?:string; }
export interface BookingIncident { _id:string; bookingId:string; bookingItemId:string; productId:string; description:string; actionType:'CLEANING'|'MAINTENANCE'; evidencePhotos:string[]; requestedAmount:number; status:'PENDING_CUSTOMER'|'ACCEPTED'|'DISPUTED'|'RESOLVED'; adminNotes?:string|null; createdAt?:string; }

export const bookingApi={
  list:()=>httpClient.get<never,Booking[]>('/api/bookings'),
  detail:(id:string)=>httpClient.get<never,Booking>(`/api/bookings/${id}`),
  cancel:(id:string,reason:string)=>httpClient.post<never,CancelBookingResponse>(`/api/bookings/${id}/cancel`,{reason}),
  reschedule:(id:string,payload:ReschedulePayload)=>httpClient.patch<never,RescheduleResponse>(`/api/bookings/${id}/reschedule`,payload),
  providerAvailability:(providerId:string,date:string)=>httpClient.get<never,ProviderAvailability>(`/api/photographers/${providerId}/availability?date=${encodeURIComponent(date)}`),
  providerBusyDates:(providerId:string)=>httpClient.get<never,ProviderBusyDates>(`/api/bookings/busy-dates/provider/${providerId}`),
  requestLocationChange:(bookingId:string,scheduleId:string,payload:{address:string;latitude:number;longitude:number;note?:string})=>httpClient.post(`/api/bookings/${bookingId}/photoshoot-schedules/${scheduleId}/location-change-requests`,payload),
  confirmPickup:(id:string)=>httpClient.post<never,Booking>(`/bookings/${id}/customer-confirm-pickup`,{}),
  confirmComplete:(id:string)=>httpClient.post<never,Booking>(`/bookings/${id}/confirm-complete`,{}),
  uploadEvidence:(formData:FormData)=>httpClient.post<never,{url:string}>('/bookings/upload-reference',formData,{headers:{'Content-Type':'multipart/form-data'}}),
  reportRentalDamage:(id:string,description:string,evidencePhotos:string[])=>httpClient.post(`/bookings/${id}/customer-report-damage`,{description,evidencePhotos}),
  rejectRentalHandover:(id:string,reason:string,evidencePhotos:string[])=>httpClient.post(`/bookings/${id}/customer-reject-handover`,{reason,evidencePhotos}),
  incident:(bookingId:string)=>httpClient.get<never,BookingIncident>(`/api/disputes/incidents/booking/${bookingId}`),
  agreeIncident:(incidentId:string)=>httpClient.post(`/api/disputes/incidents/${incidentId}/agree`,{}),
  disagreeIncident:(incidentId:string)=>httpClient.post(`/api/disputes/incidents/${incidentId}/disagree`,{}),
};
