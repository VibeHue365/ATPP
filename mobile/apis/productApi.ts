import httpClient from '@/apis/httpClient';
import type { Product, ProductFilters, ProductPage } from '@/types/product';
import type { ProductReview } from '@/types/review';

export interface AvailabilityResult { available:boolean; availableQuantity:number; requestedQuantity:number; message?:string; reason?:string; }
export interface AvailabilityParams { size:string; color:string; rentalFrom:string; rentalTo:string; quantity:number; rentalType:'DAILY'|'HOURLY'; startTime?:string; endTime?:string; }

function queryOf(filters: ProductFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  return params.toString();
}

export const productApi = {
  list: (filters: ProductFilters = {}) => httpClient.get<never, ProductPage>(`/products?${queryOf(filters)}`),
  featured: (limit = 8) => httpClient.get<never, Product[]>(`/products/featured?limit=${limit}`),
  detail: (id: string) => httpClient.get<never, Product>(`/products/${id}`),
  reviews: (id:string) => httpClient.get<never,ProductReview[]>(`/reviews/item/${id}`),
  availability: (id:string,input:AvailabilityParams) => {
    const params=new URLSearchParams(); Object.entries(input).forEach(([key,value])=>{if(value!==undefined)params.set(key,String(value))});
    return httpClient.get<never,AvailabilityResult>(`/products/${id}/availability?${params}`);
  },
};
