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

export interface Provider {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  capability?: string[];
  status?: string;
  rating: number;
  totalProducts: number;
  totalEarnings: number;
}

export interface Booking {
  id: string;
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