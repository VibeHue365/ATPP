import httpClient from './httpClient';
import type { BackendUser, UserAddress, UserPreferences } from '@/types/auth';
export interface ProfileUpdate { fullName?:string; phone?:string; gender?:'MALE'|'FEMALE'|'OTHER'; dateOfBirth?:string; }
export type AddressInput=Omit<UserAddress,'id'>;
export const userApi={
  me:()=>httpClient.get<never,BackendUser>('/users/me'),
  updateProfile:(payload:ProfileUpdate)=>httpClient.patch<never,BackendUser>('/users/me',payload),
  updateAvatar:(formData:FormData)=>httpClient.patch<never,BackendUser>('/users/me/avatar',formData,{headers:{'Content-Type':'multipart/form-data'}}),
  listAddresses:()=>httpClient.get<never,UserAddress[]>('/users/me/addresses'),
  createAddress:(payload:AddressInput)=>httpClient.post<never,UserAddress>('/users/me/addresses',payload),
  updateAddress:(id:string,payload:Partial<AddressInput>)=>httpClient.patch<never,UserAddress>(`/users/me/addresses/${id}`,payload),
  removeAddress:(id:string)=>httpClient.delete(`/users/me/addresses/${id}`),
  setDefaultAddress:(id:string)=>httpClient.post<never,UserAddress>(`/users/me/addresses/${id}/default`,{}),
  toggleFavorite:(targetType:'PRODUCT'|'PROVIDER',targetId:string)=>httpClient.patch<never,BackendUser>('/users/me/favorites',{targetType,targetId}),
  updatePreferences:(preferences:UserPreferences)=>httpClient.patch<never,BackendUser>('/users/me/preferences',{hasCompletedOnboarding:true,preferences}),
};
