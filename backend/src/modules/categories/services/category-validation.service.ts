import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Category,
  CategoryDocument,
  CategoryStatus,
  ServiceCategoryType,
} from '../schemas/category.schema';

const MAX_CATEGORY_DEPTH = 2;

@Injectable()
export class CategoryValidationService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
  ) {}

  async assertSlugUniqueGlobally(
    slug: string,
    excludeId?: Types.ObjectId,
  ): Promise<void> {
    const query: Record<string, unknown> = {
      slug,
      deletedAt: { $exists: false },
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const duplicate = await this.categoryModel.exists(query);
    if (duplicate) {
      throw new BadRequestException('CATEGORY_SLUG_ALREADY_EXISTS');
    }
  }

  async resolveParent(
    parentId: string | null | undefined,
    type: ServiceCategoryType,
    currentId?: Types.ObjectId,
  ): Promise<Types.ObjectId | null | undefined> {
    if (parentId === undefined) {
      return undefined;
    }

    if (parentId === null) {
      return null;
    }

    const parentObjectId = this.toObjectId(parentId);

    if (currentId && parentObjectId.equals(currentId)) {
      throw new BadRequestException('CATEGORY_PARENT_SELF_REFERENCE');
    }

    const parent = await this.categoryModel.findOne({
      _id: parentObjectId,
      deletedAt: { $exists: false },
    });

    if (!parent) {
      throw new NotFoundException('CATEGORY_PARENT_NOT_FOUND');
    }

    if (parent.type !== type) {
      throw new BadRequestException('CATEGORY_PARENT_TYPE_MISMATCH');
    }

    if (currentId) {
      await this.assertNoParentCycle(parent, currentId);
    }

    this.assertMaxDepth(parent);
    return parentObjectId;
  }

  async assertNoActiveChildren(categoryId: Types.ObjectId): Promise<void> {
    const activeChild = await this.categoryModel.exists({
      parentId: categoryId,
      status: CategoryStatus.Active,
      deletedAt: { $exists: false },
    });

    if (activeChild) {
      throw new BadRequestException('CATEGORY_HAS_ACTIVE_CHILDREN');
    }
  }

  private async assertNoParentCycle(
    parent: CategoryDocument,
    currentId: Types.ObjectId,
  ): Promise<void> {
    let cursor: CategoryDocument | null = parent;

    while (cursor) {
      if (cursor._id.equals(currentId)) {
        throw new BadRequestException('CATEGORY_PARENT_CYCLE');
      }

      if (!cursor.parentId) {
        break;
      }

      cursor = await this.categoryModel.findOne({
        _id: cursor.parentId,
        deletedAt: { $exists: false },
      });
    }
  }

  private assertMaxDepth(parent: CategoryDocument): void {
    if (MAX_CATEGORY_DEPTH === 2 && parent.parentId) {
      throw new BadRequestException('CATEGORY_MAX_DEPTH_EXCEEDED');
    }
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('INVALID_CATEGORY_ID');
    }

    return new Types.ObjectId(value);
  }
}
