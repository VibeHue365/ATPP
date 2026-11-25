import { Model } from 'mongoose';
import { BookingItem } from '../bookings/schemas/booking-item.schema';
import { listOverdueRentals } from '../bookings/services/rental-overdue-query';

export interface AdminOverdueRentalNotification {
  id: string;
  bookingId: string;
  bookingCode: string;
  productName: string;
  rentalTo: Date;
  daysOverdue: number;
}

export async function findAdminOverdueRentals(
  bookingItemModel: Model<BookingItem>,
  now = new Date(),
  limit = 50,
): Promise<AdminOverdueRentalNotification[]> {
  const rows = await listOverdueRentals(bookingItemModel, { now, limit });

  return rows.map((row: any) => ({
    id: row._id.toString(),
    bookingId: row.bookingId.toString(),
    bookingCode: row.bookingCode,
    productName: row.productName,
    rentalTo: row.rentalTo,
    daysOverdue: row.daysOverdue,
  }));
}
