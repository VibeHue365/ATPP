import { Types } from 'mongoose';
import { ProductsRepository } from './products.repository';
import { ProductModerationStatus } from '../schemas/product.schema';

describe('atomic size-chart publication precondition', () => {
  it('compares chart version and product sizes at write time and does not fall back to photography', async () => {
    const query = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    };
    const products = { findOneAndUpdate: jest.fn().mockReturnValue(query) };
    const packages = { findOneAndUpdate: jest.fn() };
    const repository = new ProductsRepository(
      products as any,
      {} as any,
      packages as any,
    );
    const id = new Types.ObjectId();
    const update = {
      $set: { moderationStatus: ProductModerationStatus.Approved },
    };
    expect(
      await repository.moderate(
        id,
        update,
        ProductModerationStatus.PendingReview,
        { version: 3, sizes: ['M'] },
      ),
    ).toBeNull();
    expect(products.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: id,
        moderationStatus: ProductModerationStatus.PendingReview,
        sizeChartVersion: 3,
        sizes: ['M'],
      },
      update,
      { new: true },
    );
    expect(packages.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
