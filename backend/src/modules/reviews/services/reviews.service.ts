import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, CustomerReview } from '../schemas/review.schema';
import { Booking } from '../../bookings/schemas/booking.schema';
import { BookingItem } from '../../bookings/schemas/booking-item.schema';
import { Product } from '../../products/schemas/product.schema';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';
import { Provider } from '../../providers/schemas/provider.schema';

export interface CreateReviewInput {
  bookingId: string;
  bookingItemId: string;
  rating: number;
  comment?: string;
  images?: string[];
  productId?: string;
  photographyPackageId?: string;
}

export interface RateCustomerInput {
  bookingId: string;
  rating: number;
  comment?: string;
}

export interface ReviewStatsResult {
  averageRating: number;
  totalReviews: number;
  starsBreakdown: { 5: number; 4: number; 3: number; 2: number; 1: number };
  reviews: Review[];
}

export interface TrustScoreResult {
  customerId: Types.ObjectId;
  averageRating: number;
  totalReviews: number;
  reviews: CustomerReview[];
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(CustomerReview.name)
    private readonly customerReviewModel: Model<CustomerReview>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name) private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(PhotographyPackage.name)
    private readonly photoPackageModel: Model<PhotographyPackage>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
  ) {}

  async createReview(
    customerIdStr: string,
    dto: CreateReviewInput,
  ): Promise<Review> {
    const customerId = new Types.ObjectId(customerIdStr);
    const bookingId = new Types.ObjectId(dto.bookingId);
    const bookingItemId = new Types.ObjectId(dto.bookingItemId);

    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Determine the provider
    const providerId = booking.providerIds[0];
    if (!providerId) {
      throw new BadRequestException('Booking has no provider associated');
    }

    const review = await this.reviewModel.create({
      bookingId,
      bookingItemId,
      customerId,
      providerId,
      rating: dto.rating,
      comment: dto.comment || '',
      images: dto.images || [],
    });

    // Recalculate ratings
    await this.updateProviderRating(providerId);
    if (dto.productId) {
      await this.updateProductRating(new Types.ObjectId(dto.productId));
    } else if (dto.photographyPackageId) {
      await this.updatePhotoPackageRating(
        new Types.ObjectId(dto.photographyPackageId),
      );
    }

    return review;
  }

  async replyToReview(
    userIdStr: string,
    reviewIdStr: string,
    reply: string,
  ): Promise<Review> {
    const userId = new Types.ObjectId(userIdStr);
    const reviewId = new Types.ObjectId(reviewIdStr);

    const provider = await this.providerModel.findOne({ userId });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const review = await this.reviewModel.findOne({
      _id: reviewId,
      providerId: provider._id,
    });
    if (!review) {
      throw new NotFoundException('Review not found or unauthorized');
    }

    review.reply = reply;
    review.repliedAt = new Date();
    await review.save();

    return review;
  }

  async reportReview(reviewIdStr: string, reason: string): Promise<Review> {
    const reviewId = new Types.ObjectId(reviewIdStr);
    const review = await this.reviewModel.findById(reviewId);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.isReported = true;
    review.reportReason = reason;
    review.reportedAt = new Date();
    await review.save();

    return review;
  }

  async getReviewStats(userIdStr: string): Promise<ReviewStatsResult> {
    const userId = new Types.ObjectId(userIdStr);
    const provider = await this.providerModel.findOne({ userId });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const reviews = await this.reviewModel.find({ providerId: provider._id });
    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? Math.round(
            (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews) * 10,
          ) / 10
        : 0;

    const starsBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const star = Math.floor(r.rating) as 5 | 4 | 3 | 2 | 1;
      if (starsBreakdown[star] !== undefined) {
        starsBreakdown[star]++;
      }
    });

    return {
      averageRating,
      totalReviews,
      starsBreakdown,
      reviews,
    };
  }

  async getReviewsForProvider(providerIdStr: string): Promise<Review[]> {
    return this.reviewModel
      .find({ providerId: new Types.ObjectId(providerIdStr) })
      .populate('customerId')
      .sort({ createdAt: -1 });
  }

  async getReviewsForItem(itemIdStr: string): Promise<Review[]> {
    const itemId = new Types.ObjectId(itemIdStr);
    
    // Find all BookingItem IDs referencing this productId or photographyPackageId
    const bookingItems = await this.bookingItemModel.find({
      $or: [
        { productId: itemId },
        { photographyPackageId: itemId }
      ]
    }).select('_id');
    
    const bookingItemIds = bookingItems.map(item => item._id);
    
    if (bookingItemIds.length === 0) {
      return [];
    }
    
    return this.reviewModel
      .find({ bookingItemId: { $in: bookingItemIds } })
      .populate('customerId')
      .sort({ createdAt: -1 });
  }

  // TWO WAY REVIEW
  async rateCustomer(
    userIdStr: string,
    dto: RateCustomerInput,
  ): Promise<CustomerReview> {
    const userId = new Types.ObjectId(userIdStr);
    const provider = await this.providerModel.findOne({ userId });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const bookingId = new Types.ObjectId(dto.bookingId);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.customerReviewModel.create({
      bookingId,
      customerId: booking.customerId,
      providerId: provider._id,
      rating: dto.rating,
      comment: dto.comment || '',
    });
  }

  async getCustomerTrustScore(
    customerIdStr: string,
  ): Promise<TrustScoreResult> {
    const customerId = new Types.ObjectId(customerIdStr);
    const reviews = await this.customerReviewModel.find({ customerId });
    const total = reviews.length;
    const average =
      total > 0
        ? Math.round(
            (reviews.reduce((acc, r) => acc + r.rating, 0) / total) * 10,
          ) / 10
        : 5.0; // Default trust rating score

    return {
      customerId,
      averageRating: average,
      totalReviews: total,
      reviews,
    };
  }

  private async updateProviderRating(
    providerId: Types.ObjectId,
  ): Promise<void> {
    const reviews = await this.reviewModel.find({ providerId });
    const total = reviews.length;
    const average =
      total > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / total : 0;

    await this.providerModel.updateOne(
      { _id: providerId },
      {
        $set: {
          'rating.averageRating': Math.round(average * 10) / 10,
          'rating.totalReviews': total,
        },
      },
    );
  }

  private async updateProductRating(productId: Types.ObjectId): Promise<void> {
    const bookingItems = await this.bookingItemModel.find({ productId }).select('_id');
    const bookingItemIds = bookingItems.map(item => item._id);
    if (bookingItemIds.length === 0) {
      await this.productModel.updateOne(
        { _id: productId },
        {
          $set: {
            'rating.averageRating': 0,
            'rating.totalReviews': 0,
          },
        },
      );
      return;
    }

    const reviews = await this.reviewModel.find({ bookingItemId: { $in: bookingItemIds } });
    const total = reviews.length;
    const average =
      total > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / total : 0;

    await this.productModel.updateOne(
      { _id: productId },
      {
        $set: {
          'rating.averageRating': Math.round(average * 10) / 10,
          'rating.totalReviews': total,
        },
      },
    );
  }

  private async updatePhotoPackageRating(
    packageId: Types.ObjectId,
  ): Promise<void> {
    const bookingItems = await this.bookingItemModel.find({ photographyPackageId: packageId }).select('_id');
    const bookingItemIds = bookingItems.map(item => item._id);
    if (bookingItemIds.length === 0) {
      await this.photoPackageModel.updateOne(
        { _id: packageId },
        {
          $set: {
            'rating.averageRating': 0,
            'rating.totalReviews': 0,
          },
        },
      );
      return;
    }

    const reviews = await this.reviewModel.find({ bookingItemId: { $in: bookingItemIds } });
    const total = reviews.length;
    const average =
      total > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / total : 0;

    await this.photoPackageModel.updateOne(
      { _id: packageId },
      {
        $set: {
          'rating.averageRating': Math.round(average * 10) / 10,
          'rating.totalReviews': total,
        },
      },
    );
  }
}
