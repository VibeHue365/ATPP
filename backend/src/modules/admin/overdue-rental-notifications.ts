import { Model } from 'mongoose';
import { BookingItem } from '../bookings/schemas/booking-item.schema';

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
  const rows = await bookingItemModel.aggregate([
    { $match: { itemType: 'PRODUCT', rentalTo: { $ne: null, $lt: now } } },
    { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'booking' } },
    { $unwind: '$booking' },
    { $match: { 'booking.status': { $in: ['PICKED_UP', 'RETURN_PENDING'] } } },
    { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $sort: { rentalTo: 1 } },
    { $limit: Math.min(100, Math.max(1, limit)) },
    { $project: {
      _id: 1,
      bookingId: '$booking._id',
      bookingCode: '$booking.bookingCode',
      productName: { $ifNull: ['$product.name', 'Áo dài'] },
      rentalTo: 1,
      daysOverdue: { $max: [1, { $ceil: { $divide: [{ $subtract: [now, '$rentalTo'] }, 86_400_000] } }] },
    } },
  ]).exec();

  return rows.map((row: any) => ({
    id: row._id.toString(),
    bookingId: row.bookingId.toString(),
    bookingCode: row.bookingCode,
    productName: row.productName,
    rentalTo: row.rentalTo,
    daysOverdue: row.daysOverdue,
  }));
}
