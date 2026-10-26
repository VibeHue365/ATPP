import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { BookingStatus } from '../../bookings/schemas/booking.schema';
import {
  CreateReviewDto,
  RateCustomerDto,
  ReplyReviewDto,
  ReportReviewDto,
} from '../controllers/reviews.controller';
import { ReviewsService } from './reviews.service';

type Row = Record<string, any>;

const customerId = new Types.ObjectId();
const providerId = new Types.ObjectId();
const providerUserId = new Types.ObjectId().toString();

async function dtoErrors(cls: new () => object, payload: Row) {
  return (await validate(plainToInstance(cls, payload)))
    .map((error) => error.property)
    .sort();
}

function createService(
  options: {
    existingReview?: Row | null;
    booking?: Row | null;
    bookingItem?: Row | null;
    provider?: Row | null;
    reviews?: Row[];
    review?: Row | null;
    customerReviews?: Row[];
    existingCustomerReview?: Row | null;
  } = {},
) {
  const reviewModel = {
    findOne: jest.fn().mockResolvedValue(options.existingReview ?? null),
    findById: jest.fn().mockResolvedValue(options.review ?? null),
    find: jest.fn().mockResolvedValue(options.reviews ?? []),
    create: jest.fn(async (data: Row) => ({
      _id: new Types.ObjectId(),
      ...data,
    })),
  };
  const customerReviewModel = {
    find: jest.fn().mockResolvedValue(options.customerReviews ?? []),
    findOne: jest
      .fn()
      .mockResolvedValue(options.existingCustomerReview ?? null),
    create: jest.fn(async (data: Row) => data),
  };
  const bookingModel = {
    findById: jest
      .fn()
      .mockResolvedValue(
        options.booking === undefined
          ? {
              _id: new Types.ObjectId(),
              customerId,
              status: BookingStatus.Completed,
              providerIds: [providerId],
            }
          : options.booking,
      ),
    updateOne: jest.fn().mockResolvedValue(undefined),
  };
  const bookingItemModel = {
    findById: jest.fn().mockResolvedValue(options.bookingItem ?? null),
    findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
  };
  const providerModel = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        options.provider === undefined ? { _id: providerId } : options.provider,
      ),
    updateOne: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ReviewsService(
    reviewModel as any,
    customerReviewModel as any,
    bookingModel as any,
    bookingItemModel as any,
    {} as any,
    {} as any,
    providerModel as any,
    {} as any,
  );
  const providerRating = jest
    .spyOn(service as any, 'updateProviderRating')
    .mockResolvedValue(undefined);
  const productRating = jest
    .spyOn(service as any, 'updateProductRating')
    .mockResolvedValue(undefined);
  jest
    .spyOn(service as any, 'updatePhotoPackageRating')
    .mockResolvedValue(undefined);
  return {
    service,
    reviewModel,
    customerReviewModel,
    bookingModel,
    bookingItemModel,
    providerModel,
    providerRating,
    productRating,
  };
}

const reviewInput = () => ({
  bookingId: new Types.ObjectId().toString(),
  bookingItemId: new Types.ObjectId().toString(),
  rating: 5,
  comment: 'Áo đẹp',
});

afterEach(() => jest.restoreAllMocks());

describe('UC-53 Review Service (HoangLVM)', () => {
  it('UT-53 UTCID02 rejects a second review for the same booking item', async () => {
    const { service, reviewModel } = createService({
      existingReview: { _id: new Types.ObjectId() },
    });

    await expect(
      service.createReview(customerId.toString(), reviewInput()),
    ).rejects.toThrow(
      new BadRequestException(
        'Quý khách đã gửi đánh giá cho sản phẩm này của đơn hàng rồi.',
      ),
    );
    expect(reviewModel.create).not.toHaveBeenCalled();
  });

  it('UT-53 UTCID03 returns not found for a missing booking', async () => {
    const { service } = createService({ booking: null });

    await expect(
      service.createReview(customerId.toString(), reviewInput()),
    ).rejects.toThrow(new NotFoundException('Booking not found'));
  });

  it('UT-53 UTCID04 rejects reviewing a booking of another customer', async () => {
    const { service } = createService({
      booking: {
        customerId: new Types.ObjectId(),
        status: BookingStatus.Completed,
        providerIds: [providerId],
      },
    });

    await expect(
      service.createReview(customerId.toString(), reviewInput()),
    ).rejects.toThrow(
      new BadRequestException('Bạn không có quyền đánh giá đơn hàng này.'),
    );
  });

  it('UT-53 UTCID05 rejects reviewing a booking that is not completed or returned', async () => {
    const { service } = createService({
      booking: {
        customerId,
        status: BookingStatus.Confirmed,
        providerIds: [providerId],
      },
    });

    await expect(
      service.createReview(customerId.toString(), reviewInput()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('UT-53 UTCID06 accepts a returned booking, marks the item reviewed and refreshes the provider rating', async () => {
    const { service, reviewModel, bookingItemModel, providerRating } =
      createService({
        booking: {
          customerId,
          status: BookingStatus.Returned,
          providerIds: [providerId],
        },
      });
    const input = reviewInput();

    await service.createReview(customerId.toString(), input);

    expect(reviewModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId,
        rating: 5,
        comment: 'Áo đẹp',
        images: [],
      }),
    );
    expect(bookingItemModel.findByIdAndUpdate).toHaveBeenCalledWith(
      new Types.ObjectId(input.bookingItemId),
      { isReviewed: true },
    );
    expect(providerRating).toHaveBeenCalledWith(providerId);
  });

  it('UT-53 UTCID07 resolves the provider from the booking item when the booking has none', async () => {
    const itemProvider = new Types.ObjectId();
    const { service, reviewModel } = createService({
      booking: { customerId, status: BookingStatus.Completed, providerIds: [] },
      bookingItem: { providerId: itemProvider },
    });

    await service.createReview(customerId.toString(), reviewInput());

    expect(reviewModel.create.mock.calls[0][0].providerId).toBe(itemProvider);
  });

  it('UT-53 UTCID08 rejects a booking without any provider', async () => {
    const { service } = createService({
      booking: { customerId, status: BookingStatus.Completed, providerIds: [] },
      bookingItem: {},
    });

    await expect(
      service.createReview(customerId.toString(), reviewInput()),
    ).rejects.toThrow(
      new BadRequestException('Booking has no provider associated'),
    );
  });

  it('UT-53 UTCID09 refreshes the rating of the reviewed Ao Dai product', async () => {
    const productId = new Types.ObjectId();
    const { service, productRating } = createService({
      bookingItem: { productId },
    });

    await service.createReview(customerId.toString(), reviewInput());

    expect(productRating).toHaveBeenCalledWith(productId);
  });

  it('UT-53 UTCID10 accepts ratings from 1 to 5 only', async () => {
    const base = { bookingId: 'b1', bookingItemId: 'i1' };
    await expect(
      dtoErrors(CreateReviewDto, { ...base, rating: 1 }),
    ).resolves.toEqual([]);
    await expect(
      dtoErrors(CreateReviewDto, { ...base, rating: 5 }),
    ).resolves.toEqual([]);
    await expect(
      dtoErrors(CreateReviewDto, { ...base, rating: 0 }),
    ).resolves.toEqual(['rating']);
    await expect(
      dtoErrors(CreateReviewDto, { ...base, rating: 6 }),
    ).resolves.toEqual(['rating']);
  });
});

describe('UC-54 Reply Review (HoangLVM)', () => {
  it('UT-54 UTCID02 saves the provider reply with its timestamp', async () => {
    const review = { save: jest.fn().mockResolvedValue(undefined) } as Row;
    const { service, reviewModel } = createService({ existingReview: review });
    const reviewId = new Types.ObjectId();

    await service.replyToReview(
      providerUserId,
      reviewId.toString(),
      'Cảm ơn quý khách',
    );

    expect(reviewModel.findOne).toHaveBeenCalledWith({
      _id: reviewId,
      providerId,
    });
    expect(review).toMatchObject({
      reply: 'Cảm ơn quý khách',
      repliedAt: expect.any(Date),
    });
    expect(review.save).toHaveBeenCalled();
  });

  it('UT-54 UTCID03 rejects a reply from a user without a provider profile', async () => {
    const { service } = createService({ provider: null });

    await expect(
      service.replyToReview(
        providerUserId,
        new Types.ObjectId().toString(),
        'x',
      ),
    ).rejects.toThrow(new NotFoundException('Provider profile not found'));
  });

  it('UT-54 UTCID04 does not allow replying to a review of another provider', async () => {
    const { service } = createService({ existingReview: null });

    await expect(
      service.replyToReview(
        providerUserId,
        new Types.ObjectId().toString(),
        'x',
      ),
    ).rejects.toThrow(
      new NotFoundException('Review not found or unauthorized'),
    );
  });

  it('UT-54 UTCID05 requires a non-empty reply', async () => {
    await expect(dtoErrors(ReplyReviewDto, { reply: '' })).resolves.toEqual([
      'reply',
    ]);
    await expect(
      dtoErrors(ReplyReviewDto, { reply: 'Cảm ơn' }),
    ).resolves.toEqual([]);
  });

  it('UT-54 UTCID06 rejects a malformed review id', async () => {
    const { service, reviewModel } = createService();

    await expect(
      service.replyToReview(providerUserId, 'review-1', 'x'),
    ).rejects.toThrow();
    expect(reviewModel.findOne).not.toHaveBeenCalled();
  });
});

describe('UC-55 Report Review (HoangLVM)', () => {
  it('UT-55 UTCID02 flags the review with the reason and report time', async () => {
    const review = { save: jest.fn().mockResolvedValue(undefined) } as Row;
    const { service } = createService({ review });

    await service.reportReview(
      new Types.ObjectId().toString(),
      'Ngôn từ xúc phạm',
    );

    expect(review).toMatchObject({
      isReported: true,
      reportReason: 'Ngôn từ xúc phạm',
      reportedAt: expect.any(Date),
    });
    expect(review.save).toHaveBeenCalled();
  });

  it('UT-55 UTCID03 returns not found for a missing review', async () => {
    const { service } = createService({ review: null });

    await expect(
      service.reportReview(new Types.ObjectId().toString(), 'Spam'),
    ).rejects.toThrow(new NotFoundException('Review not found'));
  });

  it('UT-55 UTCID04 requires a non-empty report reason', async () => {
    await expect(dtoErrors(ReportReviewDto, { reason: '' })).resolves.toEqual([
      'reason',
    ]);
    await expect(
      dtoErrors(ReportReviewDto, { reason: 'Spam' }),
    ).resolves.toEqual([]);
  });

  it('UT-55 UTCID05 rejects a malformed review id', async () => {
    const { service, reviewModel } = createService();

    await expect(service.reportReview('review-1', 'Spam')).rejects.toThrow();
    expect(reviewModel.findById).not.toHaveBeenCalled();
  });
});

describe('UC-56 Track Review (HoangLVM)', () => {
  it('UT-56 UTCID02 calculates the rounded average and the star breakdown', async () => {
    const { service } = createService({
      reviews: [{ rating: 5 }, { rating: 4 }, { rating: 4 }],
    });

    const stats = await service.getReviewStats(providerUserId);

    expect(stats).toMatchObject({
      averageRating: 4.3,
      totalReviews: 3,
      starsBreakdown: { 5: 1, 4: 2, 3: 0, 2: 0, 1: 0 },
    });
  });

  it('UT-56 UTCID03 returns zero statistics when the provider has no review', async () => {
    const { service } = createService({ reviews: [] });

    await expect(service.getReviewStats(providerUserId)).resolves.toMatchObject(
      {
        averageRating: 0,
        totalReviews: 0,
        starsBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      },
    );
  });

  it('UT-56 UTCID04 counts a fractional rating in the lower star bucket', async () => {
    const { service } = createService({
      reviews: [{ rating: 4.5 }, { rating: 1 }],
    });

    const stats = await service.getReviewStats(providerUserId);

    expect(stats.starsBreakdown).toEqual({ 5: 0, 4: 1, 3: 0, 2: 0, 1: 1 });
    expect(stats.averageRating).toBe(2.8);
  });

  it('UT-56 UTCID05 returns not found for a user without a provider profile', async () => {
    const { service } = createService({ provider: null });

    await expect(service.getReviewStats(providerUserId)).rejects.toThrow(
      new NotFoundException('Provider profile not found'),
    );
  });
});

describe('UC-10 View Customer Profile (HoangLVM)', () => {
  it('UT-10 UTCID02 gives a default trust score of 5.0 to a customer without reviews', async () => {
    const { service } = createService({ customerReviews: [] });

    await expect(
      service.getCustomerTrustScore(customerId.toString()),
    ).resolves.toMatchObject({
      averageRating: 5,
      totalReviews: 0,
    });
  });

  it('UT-10 UTCID03 rounds the customer trust average to one decimal', async () => {
    const { service } = createService({
      customerReviews: [{ rating: 4 }, { rating: 5 }, { rating: 4 }],
    });

    await expect(
      service.getCustomerTrustScore(customerId.toString()),
    ).resolves.toMatchObject({
      averageRating: 4.3,
      totalReviews: 3,
    });
  });

  it('UT-10 UTCID04 lets the provider rate the customer of a booking', async () => {
    const booking = { _id: new Types.ObjectId(), customerId };
    const { service, customerReviewModel } = createService({ booking });

    await service.rateCustomer(providerUserId, {
      bookingId: booking._id.toString(),
      rating: 4,
      comment: 'Đúng hẹn',
    });

    expect(customerReviewModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId,
        providerId,
        rating: 4,
        comment: 'Đúng hẹn',
      }),
    );
  });

  it('UT-10 UTCID05 allows only one customer rating per booking', async () => {
    const { service, customerReviewModel } = createService({
      existingCustomerReview: { _id: new Types.ObjectId() },
    });

    await expect(
      service.rateCustomer(providerUserId, {
        bookingId: new Types.ObjectId().toString(),
        rating: 4,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Đã gửi đánh giá cho khách hàng của đơn hàng này rồi.',
      ),
    );
    expect(customerReviewModel.create).not.toHaveBeenCalled();
  });

  it('UT-10 UTCID06 rejects customer rating from a user without a provider profile', async () => {
    const { service } = createService({ provider: null });

    await expect(
      service.rateCustomer(providerUserId, {
        bookingId: new Types.ObjectId().toString(),
        rating: 4,
      }),
    ).rejects.toThrow(new NotFoundException('Provider profile not found'));
  });

  it('UT-10 UTCID07 accepts customer ratings from 1 to 5 only', async () => {
    await expect(
      dtoErrors(RateCustomerDto, { bookingId: 'b1', rating: 1 }),
    ).resolves.toEqual([]);
    await expect(
      dtoErrors(RateCustomerDto, { bookingId: 'b1', rating: 6 }),
    ).resolves.toEqual(['rating']);
    await expect(
      dtoErrors(RateCustomerDto, { bookingId: 'b1', rating: 0 }),
    ).resolves.toEqual(['rating']);
  });

  it('UT-10 UTCID08 rejects a malformed customer id', async () => {
    const { service, customerReviewModel } = createService();

    await expect(service.getCustomerTrustScore('customer-1')).rejects.toThrow();
    expect(customerReviewModel.find).not.toHaveBeenCalled();
  });
});
