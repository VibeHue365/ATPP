import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import {
  SmartTagAssignment,
} from '../../smart-tagging/schemas/smart-tag-assignment.schema';
import {
  SmartTagAssignmentStatus,
  SmartTagEntityType,
} from '../../smart-tagging/constants/smart-tag.constants';
import { ProductsRepository } from '../repositories/products.repository';
import { ProductCustomTagStatus } from '../schemas/product.schema';
import {
  matchesPreferredSize,
  normalizePreferences,
  scoreProduct,
} from './personalized-product-ranking';

@Injectable()
export class PersonalizedProductRecommendationService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(SmartTagAssignment.name)
    private readonly assignmentModel: Model<SmartTagAssignment>,
    private readonly productsRepository: ProductsRepository,
  ) {}

  async recommendForUser(
    userId: string,
    requestedPage = 1,
    requestedLimit = 12,
    filters: {
      maxPrice?: number;
      colors?: string[];
      sizes?: string[];
      categoryId?: string;
      providerLocation?: string;
      productTypes?: string[];
    } = {},
  ) {
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundException('User not found');
    const user = await this.userModel
      .findById(userId)
      .select({ preferences: 1 })
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found');

    const preferences = normalizePreferences(user.preferences);
    const candidates = await this.productsRepository.findAllActive({
      ...filters,
      limit: 200,
    });
    const productIds = candidates.map((product) => product._id);
    const productsById = new Map(
      candidates.map((product) => [product._id.toString(), product]),
    );
    const assignments = await this.assignmentModel
      .find({
        entityType: SmartTagEntityType.Product,
        entityId: { $in: productIds },
        status: SmartTagAssignmentStatus.Active,
      })
      .select({ entityId: 1, entityRevision: 1, tagCode: 1 })
      .lean()
      .exec();

    const tagsByProduct = new Map<string, string[]>();
    for (const assignment of assignments) {
      const key = assignment.entityId.toString();
      const product = productsById.get(key);
      if (!product || assignment.entityRevision !== product.taggingRevision) continue;
      tagsByProduct.set(key, [...(tagsByProduct.get(key) ?? []), assignment.tagCode]);
    }

    const ranked = candidates
      .filter((product) => matchesPreferredSize(preferences.preferredSize, product.sizes))
      .map((product: any) => {
        const plain = typeof product.toObject === 'function' ? product.toObject() : { ...product };
        const approvedCustomTags = (plain.customTags ?? []).filter(
          (tag: any) => tag.status === ProductCustomTagStatus.Approved,
        );
        const mappedTagCodes = approvedCustomTags
          .map((tag: any) => tag.mappedTagCode)
          .filter(Boolean);
        const recommendation = scoreProduct(preferences, {
          tagCodes: [
            ...(tagsByProduct.get(product._id.toString()) ?? []),
            ...mappedTagCodes,
          ],
          colors: product.colors ?? [],
          materials: product.materials ?? [],
          sizes: product.sizes ?? [],
          basePrice: product.basePrice,
          rating: product.rating,
        });
        return {
          ...plain,
          customTags: approvedCustomTags.map((tag: any) => ({
            label: tag.label,
            normalizedLabel: tag.normalizedLabel,
            mappedTagCode: tag.mappedTagCode ?? null,
          })),
          recommendation,
          discountedPrice: plain.discountedPrice ?? plain.basePrice,
        };
      })
      .sort(
        (first, second) =>
          second.recommendation.score - first.recommendation.score ||
          Number(second.rating?.averageRating ?? 0) - Number(first.rating?.averageRating ?? 0),
      );

    const limit = Math.min(24, Math.max(1, requestedLimit || 12));
    const page = Math.max(1, requestedPage || 1);
    const start = (page - 1) * limit;
    return {
      data: ranked.slice(start, start + limit),
      meta: {
        page,
        totalCandidates: candidates.length,
        eligibleCandidates: ranked.length,
        limit,
        total: ranked.length,
        totalPages: Math.max(1, Math.ceil(ranked.length / limit)),
        personalized: true,
      },
    };
  }
}
