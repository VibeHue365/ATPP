export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatar: string;
  status: 'ACTIVE' | 'BANNED';
  date: string;
  bookings: number;
  spent: number;
}

export interface ProviderProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  status: string;
}

export interface ProviderReview {
  id: string;
  customerName: string;
  avatar: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Provider {
  id: string;
  businessName: string;
  ownerName: string;
  avatar?: string;
  email: string;
  phone: string;
  website?: string;
  address?: string;
  capability?: string[];
  status?: string;
  taxCode?: string;
  bankAccount?: string;
  bankName?: string;
  createdAt?: string;
  rating: number;
  totalProducts: number;
  completedBookings?: number;
  totalBookings?: number;
  completionRate?: number;
  totalEarnings: number;
  isVerified?: boolean;
  hasIdCard?: boolean;
  hasBusinessLicense?: boolean;
  hasStudioProof?: boolean;
  products?: ProviderProduct[];
  reviews?: ProviderReview[];
}

export interface Booking {
  id: string;
  bookingId?: string;
  customerName: string;
  providerName: string;
  items: string;
  price: number;
  deposit: number;
  status: string;
  rentalDate: string;
  returnDate: string;
}

export type DirectoryKind = 'customers' | 'providers' | 'bookings';
export type DirectoryItem = Customer | Provider | Booking;
