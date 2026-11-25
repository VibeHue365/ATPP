import { Model, Types } from 'mongoose';
import { BookingItem } from '../schemas/booking-item.schema';

export interface RentalOverdueQueryOptions {
  now?: Date;
  providerId?: Types.ObjectId;
  limit?: number;
}

export type RentalOverdueSort = 'MOST_OVERDUE' | 'NEAREST_OVERDUE';

export function buildRentalOverduePipeline(options: RentalOverdueQueryOptions = {}) {
  const now = options.now ?? new Date();
  const itemMatch: Record<string, unknown> = {
    itemType: 'PRODUCT',
    rentalTo: { $ne: null, $lt: now },
  };
  if (options.providerId) itemMatch.providerId = options.providerId;
  return [
    { $match: itemMatch },
    { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'booking' } },
    { $unwind: '$booking' },
    { $match: { 'booking.status': { $in: ['PICKED_UP', 'RETURN_PENDING'] } } },
  ];
}

export async function countOverdueRentals(
  bookingItemModel: Model<BookingItem>,
  options: RentalOverdueQueryOptions = {},
): Promise<number> {
  const rows = await bookingItemModel.aggregate([
    ...buildRentalOverduePipeline(options),
    { $count: 'total' },
  ]).exec();
  return rows[0]?.total ?? 0;
}

export async function listOverdueRentals(
  bookingItemModel: Model<BookingItem>,
  options: RentalOverdueQueryOptions = {},
) {
  const now = options.now ?? new Date();
  return bookingItemModel.aggregate([
    ...buildRentalOverduePipeline({ ...options, now }),
    { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $sort: { rentalTo: 1 } },
    { $limit: Math.min(100, Math.max(1, options.limit ?? 50)) },
    { $project: {
      _id: 1,
      bookingId: '$booking._id',
      bookingCode: '$booking.bookingCode',
      productName: { $ifNull: ['$product.name', 'Áo dài'] },
      rentalTo: 1,
      daysOverdue: { $max: [1, { $ceil: { $divide: [{ $subtract: [now, '$rentalTo'] }, 86_400_000] } }] },
    } },
  ]).exec();
}

export async function listOverdueRentalBookingIds(
  bookingItemModel: Model<BookingItem>,
  sort: RentalOverdueSort,
  options: Omit<RentalOverdueQueryOptions, 'limit'> = {},
): Promise<Array<{ bookingId: Types.ObjectId; returnDueAt: Date }>> {
  const direction = sort === 'NEAREST_OVERDUE' ? -1 : 1;
  return bookingItemModel.aggregate([
    ...buildRentalOverduePipeline(options),
    { $group: { _id: '$booking._id', returnDueAt: { $min: '$rentalTo' } } },
    { $sort: { returnDueAt: direction, _id: 1 } },
    { $project: { _id: 0, bookingId: '$_id', returnDueAt: 1 } },
  ]).exec();
}
