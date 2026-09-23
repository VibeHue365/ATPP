import { httpClient } from '../../../services/httpClient';
import type { Booking, Customer, Page, Provider } from '../types';

type RawProvider = Partial<Provider> & {
  capabilities?: unknown;
};

const list = <T>(kind: string, page: number, limit = 10) =>
  httpClient.get<Page<T>>(`/admin/stats/${kind}?page=${page}&limit=${limit}`);

const normalizeCapabilities = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const normalizeProvider = (provider: RawProvider): Provider => ({
  id: provider.id || '',
  businessName: provider.businessName || 'Chưa cập nhật',
  ownerName: provider.ownerName || 'Chưa cập nhật',
  avatar: (provider as any).avatar || '',
  email: provider.email || '',
  phone: provider.phone || '',
  website: provider.website || '',
  address: provider.address || '',
  capability: normalizeCapabilities(provider.capability ?? provider.capabilities),
  status: provider.status || 'ACTIVE',
  taxCode: provider.taxCode || '',
  bankAccount: provider.bankAccount || '',
  bankName: provider.bankName || '',
  createdAt: provider.createdAt || '',
  rating: typeof provider.rating === 'number' ? provider.rating : 0,
  totalProducts: typeof provider.totalProducts === 'number' ? provider.totalProducts : 0,
  completedBookings: typeof provider.completedBookings === 'number' ? provider.completedBookings : 0,
  totalBookings: typeof provider.totalBookings === 'number' ? provider.totalBookings : 0,
  completionRate: typeof provider.completionRate === 'number' ? provider.completionRate : 0,
  totalEarnings: typeof provider.totalEarnings === 'number' ? provider.totalEarnings : 0,
  isVerified: Boolean(provider.isVerified),
  hasIdCard: Boolean(provider.hasIdCard),
  hasBusinessLicense: Boolean(provider.hasBusinessLicense),
  hasStudioProof: Boolean(provider.hasStudioProof),
  products: Array.isArray(provider.products) ? provider.products : [],
  reviews: Array.isArray(provider.reviews) ? provider.reviews : [],
});

export const adminDirectoryApi = {
  customers: (page = 1, limit = 50) => list<Customer>('customers', page, limit),
  async providers(page = 1, limit = 50): Promise<Page<Provider>> {
    const response = await list<RawProvider>('providers', page, limit);
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