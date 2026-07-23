import { Types } from 'mongoose';
import { ProductAvailabilityService } from './product-availability.service';

describe('ProductAvailabilityService', () => {
  const productId = new Types.ObjectId();
  const inventoryItems = [{ _id: new Types.ObjectId() }, { _id: new Types.ObjectId() }];
  const products = { findPublicById: jest.fn().mockResolvedValue({ _id: productId }) };
  const inventory = { find: jest.fn().mockResolvedValue(inventoryItems) };
  const reservations = { find: jest.fn().mockResolvedValue([]) };
  const service = new ProductAvailabilityService(products as any, inventory as any, reservations as any);

  it('returns available quantity when no reservation overlaps', async () => {
    const result = await service.check(productId.toString(), 'M', 'RED', '2026-08-01', '2026-08-02', 2);
    expect(result).toEqual({ available: true, availableQuantity: 2, requestedQuantity: 2 });
  });

  it('returns unavailable when a reservation consumes stock', async () => {
    reservations.find.mockResolvedValueOnce([{ inventoryItemId: inventoryItems[0]._id }]);
    const result = await service.check(productId.toString(), 'M', 'RED', '2026-08-01', '2026-08-02', 2);
    expect(result.available).toBe(false);
  });

  it('rejects an invalid hourly range', async () => {
    await expect(service.check(productId.toString(), 'M', 'RED', '2026-08-01', '2026-08-01', 1, 'HOURLY', '12:00', '10:00')).rejects.toThrow('Invalid hourly rental period');
  });
});
