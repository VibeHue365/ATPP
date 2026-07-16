import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  CategoryStatus,
  ServiceCategoryType,
} from '../schemas/category.schema';
import { CategoryValidationService } from './category-validation.service';

describe('CategoryValidationService', () => {
  function createService() {
    const categoryModel = {
      exists: jest.fn(),
      findOne: jest.fn(),
    };
    const service = new CategoryValidationService(categoryModel as any);
    return { service, categoryModel };
  }

  it('rejects a duplicate global slug', async () => {
    const { service, categoryModel } = createService();
    categoryModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

    await expect(
      service.assertSlugUniqueGlobally('ao-dai-cuoi'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing parent', async () => {
    const { service, categoryModel } = createService();
    categoryModel.findOne.mockResolvedValue(null);

    await expect(
      service.resolveParent(
        new Types.ObjectId().toString(),
        ServiceCategoryType.AodaiCategory,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a parent from another category type', async () => {
    const { service, categoryModel } = createService();
    categoryModel.findOne.mockResolvedValue({
      _id: new Types.ObjectId(),
      type: ServiceCategoryType.Concept,
      parentId: null,
    });

    await expect(
      service.resolveParent(
        new Types.ObjectId().toString(),
        ServiceCategoryType.AodaiCategory,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a hierarchy deeper than two levels', async () => {
    const { service, categoryModel } = createService();
    categoryModel.findOne.mockResolvedValue({
      _id: new Types.ObjectId(),
      type: ServiceCategoryType.AodaiCategory,
      parentId: new Types.ObjectId(),
    });

    await expect(
      service.resolveParent(
        new Types.ObjectId().toString(),
        ServiceCategoryType.AodaiCategory,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a parent cycle', async () => {
    const { service, categoryModel } = createService();
    const currentId = new Types.ObjectId();
    const parentId = new Types.ObjectId();
    categoryModel.findOne
      .mockResolvedValueOnce({
        _id: parentId,
        type: ServiceCategoryType.AodaiCategory,
        parentId: currentId,
      })
      .mockResolvedValueOnce({
        _id: currentId,
        type: ServiceCategoryType.AodaiCategory,
        parentId: null,
      });

    await expect(
      service.resolveParent(
        parentId.toString(),
        ServiceCategoryType.AodaiCategory,
        currentId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects activation when the parent is not active', async () => {
    const { service, categoryModel } = createService();
    categoryModel.exists.mockResolvedValue(null);

    await expect(
      service.assertParentActiveForActivation(new Types.ObjectId()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(categoryModel.exists).toHaveBeenCalledWith(
      expect.objectContaining({ status: CategoryStatus.Active }),
    );
  });
});
