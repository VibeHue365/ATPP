import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CategoryUsageService } from './category-usage.service';

describe('CategoryUsageService', () => {
  function createService() {
    const productModel = { exists: jest.fn() };
    const photographyPackageModel = { exists: jest.fn() };
    const service = new CategoryUsageService(
      productModel as any,
      photographyPackageModel as any,
    );
    return { service, productModel, photographyPackageModel };
  }

  it('rejects deletion when a product uses the category', async () => {
    const { service, productModel, photographyPackageModel } = createService();
    productModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

    await expect(
      service.assertCategoryNotInUse(new Types.ObjectId()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(photographyPackageModel.exists).not.toHaveBeenCalled();
  });

  it('rejects deletion when a photography package uses the category', async () => {
    const { service, productModel, photographyPackageModel } = createService();
    productModel.exists.mockResolvedValue(null);
    photographyPackageModel.exists.mockResolvedValue({
      _id: new Types.ObjectId(),
    });

    await expect(
      service.assertCategoryNotInUse(new Types.ObjectId()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows deletion when neither product nor package uses the category', async () => {
    const { service, productModel, photographyPackageModel } = createService();
    productModel.exists.mockResolvedValue(null);
    photographyPackageModel.exists.mockResolvedValue(null);

    await expect(
      service.assertCategoryNotInUse(new Types.ObjectId()),
    ).resolves.toBeUndefined();
  });
});
