import { httpClient } from '../../../services/httpClient';
import type { Booking, Customer, Page, Provider } from '../types';

type RawProvider = Partial<Provider> & {
  capabilities?: unknown;
};

const list = <T>(kind: string, page: number) =>
  httpClient.get<Page<T>>(`/admin/stats/${kind}?page=${page}&limit=10`);

const normalizeCapabilities = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const normalizeProvider = (provider: RawProvider): Provider => ({
  id: provider.id || '',
  businessName: provider.businessName || 'Chưa cập nhật',
  ownerName: provider.ownerName || 'Chưa cập nhật',
  email: provider.email || '',
  phone: provider.phone || '',
  capability: normalizeCapabilities(provider.capability ?? provider.capabilities),
  status: provider.status || 'UNKNOWN',
  rating: typeof provider.rating === 'number' ? provider.rating : 0,
  totalProducts: typeof provider.totalProducts === 'number' ? provider.totalProducts : 0,
  totalEarnings: typeof provider.totalEarnings === 'number' ? provider.totalEarnings : 0,
});

export const adminDirectoryApi = {
  customers: (page: number) => list<Customer>('customers', page),
  async providers(page: number): Promise<Page<Provider>> {
    const response = await list<RawProvider>('providers', page);
    return { ...response, items: response.items.map(normalizeProvider) };
  },
  bookings: (page: number) => list<Booking>('bookings', page),
  banCustomer: (id: string) => httpClient.patch<void>(`/admin/stats/customers/${id}/ban`, {}),
  unbanCustomer: (id: string) => httpClient.patch<void>(`/admin/stats/customers/${id}/unban`, {}),
  suspendProvider: (id: string, reason?: string) =>
    httpClient.patch<void>(`/admin/providers/${id}/suspend`, { reason }),
  unsuspendProvider: (id: string, reason?: string) =>
    httpClient.patch<void>(`/admin/providers/${id}/unsuspend`, { reason }),
};