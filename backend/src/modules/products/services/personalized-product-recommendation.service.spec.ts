/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  SmartTagAssignmentStatus,
  SmartTagEntityType,
} from '../../smart-tagging/constants/smart-tag.constants';
import { ProductCustomTagStatus } from '../schemas/product.schema';
import { PersonalizedProductRecommendationService } from './personalized-product-recommendation.service';

describe('PersonalizedProductRecommendationService', () => {
  const userId = new Types.ObjectId();

  function query<T>(result: T) {
    return {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(result),
    };
  }

  function create() {
    const userModel = { findById: jest.fn() };
    const assignmentModel = { find: jest.fn() };
    const productsRepository = { findAllActive: jest.fn() };
    return {
      service: new PersonalizedProductRecommendationService(
        userModel as never,
        assignmentModel as never,
        productsRepository as never,
      ),
      userModel,
      assignmentModel,
      productsRepository,
    };
  }

  it('rejects an invalid or missing user', async () => {
    const first = create();
    await expect(
      first.service.recommendForUser('invalid'),
    ).rejects.toBeInstanceOf(NotFoundException);

    const second = create();
    second.userModel.findById.mockReturnValue(query(null));
    await expect(
      second.service.recommendForUser(userId.toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters by preferred size, ignores stale tags and ranks matching products first', async () => {
    const { service, userModel, assignmentModel, productsRepository } =
      create();
    userModel.findById.mockReturnValue(
      query({
        preferences: {
          preferredAoDaiStyles: ['TRADITIONAL'],
          favoriteColors: ['RED_GOLD'],
          sizeInfo: { preferredSize: 'M' },
        },
      }),
    );
    const matchingId = new Types.ObjectId();
    const otherId = new Types.ObjectId();
    const wrongSizeId = new Types.ObjectId();
    productsRepository.findAllActive.mockResolvedValue([
      {
        _id: otherId,
        taggingRevision: 1,
        sizes: ['M'],
        colors: ['BLUE'],
        materials: [],
        basePrice: 500000,
        rating: { averageRating: 5 },
        customTags: [],
      },
      {
        _id: matchingId,
        taggingRevision: 2,
        sizes: ['M', 'L'],
        colors: ['RED'],
        materials: [],
        basePrice: 500000,
        rating: { averageRating: 4 },
        customTags: [
          {
            label: 'Cổ điển',
            normalizedLabel: 'co dien',
            mappedTagCode: 'TRUYEN_THONG',
            status: ProductCustomTagStatus.Approved,
          },
          { label: 'Pending', status: ProductCustomTagStatus.Pending },
        ],
      },
      {
        _id: wrongSizeId,
        taggingRevision: 1,
        sizes: ['S'],
        colors: ['RED'],
        materials: [],
        basePrice: 200000,
        customTags: [],
      },
    ]);
    assignmentModel.find.mockReturnValue(
      query([
        {
          entityId: matchingId,
          entityRevision: 2,
          tagCode: 'TRUYEN_THONG',
        },
        {
          entityId: otherId,
          entityRevision: 0,
          tagCode: 'TRUYEN_THONG',
        },
      ]),
    );

    const result = await service.recommendForUser(userId.toString(), 1, 12, {
      maxPrice: 700000,
    });
    expect(result.data.map((product) => product._id)).toEqual([
      matchingId,
      otherId,
    ]);
    expect(result.data[0].customTags).toEqual([
      expect.objectContaining({ mappedTagCode: 'TRUYEN_THONG' }),
    ]);
    expect(result.meta).toMatchObject({
      totalCandidates: 3,
      eligibleCandidates: 2,
    });
    expect(productsRepository.findAllActive).toHaveBeenCalledWith({
      maxPrice: 700000,
      limit: 200,
    });
    expect(assignmentModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: SmartTagEntityType.Product,
        status: SmartTagAssignmentStatus.Active,
      }),
    );
  });

  it('clamps page size and returns stable empty pagination metadata', async () => {
    const { service, userModel, assignmentModel, productsRepository } =
      create();
    userModel.findById.mockReturnValue(query({ preferences: {} }));
    productsRepository.findAllActive.mockResolvedValue([]);
    assignmentModel.find.mockReturnValue(query([]));
    const result = await service.recommendForUser(userId.toString(), -4, 100);
    expect(result).toEqual({
      data: [],
      meta: {
        page: 1,
        totalCandidates: 0,
        eligibleCandidates: 0,
        limit: 24,
        total: 0,
        totalPages: 1,
        personalized: true,
      },
    });
  });
});
