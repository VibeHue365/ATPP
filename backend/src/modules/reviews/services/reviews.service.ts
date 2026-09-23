/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, CustomerReview } from '../schemas/review.schema';
import { Booking, BookingStatus } from '../../bookings/schemas/booking.schema';
import { BookingItem } from '../../bookings/schemas/booking-item.schema';
import { Product } from '../../products/schemas/product.schema';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';
import { Provider } from '../../providers/schemas/provider.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';

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
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(PhotographyPackage.name)
    private readonly photoPackageModel: Model<PhotographyPackage>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createReview(
    customerIdStr: string,
    dto: CreateReviewInput,
  ): Promise<Review> {
    const customerId = new Types.ObjectId(customerIdStr);
    const bookingId = new Types.ObjectId(dto.bookingId);
    const bookingItemId = new Types.ObjectId(dto.bookingItemId);

    const existingReview = await this.reviewModel.findOne({ bookingItemId });
    if (existingReview) {
      throw new BadRequestException(
        'Quý khách đã gửi đánh giá cho sản phẩm này của đơn hàng rồi.',
      );
    }

    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify booking belongs to this customer
    const bookingCustomerId =
      (booking.customerId as any)?._id || booking.customerId;
    if (bookingCustomerId.toString() !== customerIdStr) {
      throw new BadRequestException(
        'Bạn không có quyền đánh giá đơn hàng này.',
      );
    }

    // Only allow review when booking is COMPLETED
    if (booking.status !== BookingStatus.Completed) {
      throw new BadRequestException(
        'Chỉ có thể đánh giá sau khi đơn hàng được hoàn thành. Đơn hàng hiện tại chưa ở trạng thái Hoàn thành.',
      );
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

    await this.bookingItemModel.findByIdAndUpdate(bookingItemId, {
      isReviewed: true,
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
    const bookingItems = await this.bookingItemModel
      .find({
        $or: [{ productId: itemId }, { photographyPackageId: itemId }],
      })
      .select('_id');

    const bookingItemIds = bookingItems.map((item) => item._id);

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

    // Kiểm tra đã đánh giá khách hàng cho đơn hàng này chưa (chỉ cho phép 1 lần)
    const existingReview = await this.customerReviewModel.findOne({
      bookingId,
      providerId: provider._id,
    });
    if (existingReview) {
      throw new BadRequestException(
        'Đã gửi đánh giá cho khách hàng của đơn hàng này rồi.',
      );
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
    const bookingItems = await this.bookingItemModel
      .find({ productId })
      .select('_id');
    const bookingItemIds = bookingItems.map((item) => item._id);
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

    const reviews = await this.reviewModel.find({
      bookingItemId: { $in: bookingItemIds },
    });
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

  /**
   * Kiểm tra nhanh: user hiện tại có thể review sản phẩm này không?
   * Trả về: { canReview, hasCompletedBooking, alreadyReviewed, bookingId, bookingItemId }
   */
  async getMyReviewStatus(
    customerIdStr: string,
    productId: string,
  ): Promise<Record<string, any>> {
    const customerId = new Types.ObjectId(customerIdStr);
    const prodId = new Types.ObjectId(productId);

    // Tìm tất cả booking COMPLETED của customer
    const completedBookings = await this.bookingModel
      .find({
        customerId,
        status: BookingStatus.Completed,
      })
      .select('_id providerIds');

    if (completedBookings.length === 0) {
      return {
        canReview: false,
        hasCompletedBooking: false,
        alreadyReviewed: false,
      };
    }

    const completedBookingIds = completedBookings.map((b) => b._id);

    // Tìm booking items chứa sản phẩm này trong các đơn COMPLETED
    const matchingItems = await this.bookingItemModel
      .find({
        bookingId: { $in: completedBookingIds },
        productId: prodId,
      })
      .select('_id bookingId isReviewed');

    if (matchingItems.length === 0) {
      return {
        canReview: false,
        hasCompletedBooking: false,
        alreadyReviewed: false,
      };
    }

    // Tìm item chưa được review
    const unreviewedItem = matchingItems.find((item) => !item.isReviewed);

    if (!unreviewedItem) {
      return {
        canReview: false,
        hasCompletedBooking: true,
        alreadyReviewed: true,
      };
    }

    return {
      canReview: true,
      hasCompletedBooking: true,
      alreadyReviewed: false,
      bookingId: unreviewedItem.bookingId.toString(),
      bookingItemId: unreviewedItem._id.toString(),
    };
  }

  private async updatePhotoPackageRating(
    packageId: Types.ObjectId,
  ): Promise<void> {
    const bookingItems = await this.bookingItemModel
      .find({ photographyPackageId: packageId })
      .select('_id');
    const bookingItemIds = bookingItems.map((item) => item._id);
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

    const reviews = await this.reviewModel.find({
      bookingItemId: { $in: bookingItemIds },
    });
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

  async getReportedReviewsForAdmin(): Promise<any> {
    const reviews = await this.reviewModel
      .find({ isReported: true })
      .populate('customerId', 'profile.fullName auth.email profile.avatarUrl')
      .populate('providerId', 'businessName partnerCode profile.avatarUrl')
      .populate('bookingId', 'bookingCode createdAt customerId')
      .populate('bookingItemId', 'name coverImage')
      .sort({ reportedAt: -1, createdAt: -1 })
      .exec();

    const total = reviews.length;
    const pending = reviews.filter((r) => !r.reportStatus || r.reportStatus === 'PENDING').length;
    const underReview = reviews.filter((r) => r.reportStatus === 'UNDER_REVIEW').length;
    const resolved = reviews.filter((r) => r.reportStatus === 'RESOLVED' || r.reportStatus === 'DISMISSED').length;
    const hidden = reviews.filter((r) => r.isHidden === true).length;

    return {
      metrics: {
        total,
        pending,
        underReview,
        resolved,
        hidden,
      },
      reviews,
    };
  }

  async handleReportedReview(
    reviewIdStr: string,
    action: 'DELETE' | 'DISMISS' | 'HIDE' | 'UNDER_REVIEW' | 'CONFIRM',
    reason?: string,
  ): Promise<{ success: boolean; review: Review }> {
    const reviewId = new Types.ObjectId(reviewIdStr);
    const review = await this.reviewModel
      .findById(reviewId)
      .populate('customerId')
      .populate('providerId')
      .populate('bookingId');

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    const customer = review.customerId as any;
    const provider = review.providerId as any;
    const booking = review.bookingId as any;

    const bookingCode =
      booking?.bookingCode ||
      booking?._id?.toString()?.slice(-6)?.toUpperCase() ||
      'N/A';

    let providerUserIdStr = '';
    if (provider) {
      providerUserIdStr = provider.userId?.toString();
    }

    if (!review.historyTimeline) {
      review.historyTimeline = [];
    }

    const effectiveReason = reason?.trim() || 'Xử lý bởi quản trị viên hệ thống';

    if (action === 'DELETE' || action === 'HIDE' || action === 'CONFIRM') {
      review.isHidden = true;
      review.reportStatus = 'RESOLVED';
      review.historyTimeline.push({
        timestamp: new Date(),
        title: action === 'CONFIRM' ? 'Admin xác nhận vi phạm' : 'Admin đã ẩn/gỡ đánh giá',
        description: effectiveReason,
      });
      await review.save();

      // Recalculate average ratings
      await this.updateProviderRating(review.providerId);

      // Send Notifications
      if (customer && customer._id) {
        await this.notificationsService.createNotification(
          customer._id.toString(),
          'Đánh giá của bạn đã bị ẩn do vi phạm tiêu chuẩn',
          `Đơn thuê #${bookingCode}: Đánh giá của bạn đã bị ẩn bởi quản trị viên hệ thống. Lý do: ${effectiveReason}`,
          NotificationType.System,
          { reviewId: reviewIdStr, bookingId: review.bookingId?.toString() },
        );
      }

      if (providerUserIdStr) {
        await this.notificationsService.createNotification(
          providerUserIdStr,
          'Báo cáo vi phạm đánh giá đã được xử lý',
          `Đơn thuê #${bookingCode}: Báo cáo của bạn về đánh giá vi phạm đã được Admin chấp nhận. Đánh giá đã bị ẩn. Lý do: ${effectiveReason}`,
          NotificationType.System,
          { bookingId: review.bookingId?.toString() },
        );
      }
    } else if (action === 'DISMISS') {
      review.reportStatus = 'RESOLVED';
      review.isHidden = false;
      review.historyTimeline.push({
        timestamp: new Date(),
        title: 'Admin bỏ qua báo cáo',
        description: effectiveReason || 'Báo cáo không vi phạm tiêu chuẩn, giữ nguyên đánh giá.',
      });
      await review.save();

      if (providerUserIdStr) {
        await this.notificationsService.createNotification(
          providerUserIdStr,
          'Kết quả kiểm duyệt báo cáo đánh giá',
          `Đơn thuê #${bookingCode}: Báo cáo của bạn đã được kiểm duyệt. Đánh giá được xác nhận hợp lệ và tiếp tục hiển thị. Lý do: ${effectiveReason}`,
          NotificationType.System,
          { reviewId: reviewIdStr, bookingId: review.bookingId?.toString() },
        );
      }
    } else if (action === 'UNDER_REVIEW') {
      review.reportStatus = 'UNDER_REVIEW';
      review.historyTimeline.push({
        timestamp: new Date(),
        title: 'Admin chuyển sang trạng thái đang xem xét',
        description: effectiveReason || 'Đang tiến hành đối soát và xác minh nội dung báo cáo.',
      });
      await review.save();
    }

    return { success: true, review };
  }
}
