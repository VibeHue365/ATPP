import { httpClient } from '../../../services/httpClient';
export interface ProductAvailabilityResult { available: boolean; availableQuantity: number; requestedQuantity: number; message?: string; reason?: string; }
export const checkProductAvailability = (productId: string, size: string, color: string, rentalFrom: string, rentalTo: string, quantity: number, rentalType = 'DAILY', startTime?: string, endTime?: string) => {
  const query = new URLSearchParams({ size, color, rentalFrom, rentalTo, quantity: String(quantity), rentalType });
  if (startTime) query.set('startTime', startTime); if (endTime) query.set('endTime', endTime);
  return httpClient.get<ProductAvailabilityResult>(`/products/${productId}/availability?${query}`);
};
