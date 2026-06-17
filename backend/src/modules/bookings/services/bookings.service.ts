import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Booking,
  BookingDocument,
  BookingStatus,
  BookingType,
  PaymentStatus,
} from '../schemas/booking.schema';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import { Product } from '../../products/schemas/product.schema';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';
import { PromotionsService } from '../../products/services/promotions.service';
import { DiscountType } from '../../products/schemas/promotion.schema';
import { PaymentsService } from '../../payments/services/payments.service';

export interface CreateBookingItemDto {
  productId?: string;
  photographyPackageId?: string;
  quantity?: number;
  rentalFrom?: string;
  rentalTo?: string;
  shootDate?: string;
  shootTimeSlot?: string;
  customRequests?: string;
}

export interface CreateBookingDto {
  items: CreateBookingItemDto[];
  travelFee?: number;
  promoCode?: string;
  bookingType?: BookingType;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(PhotographyPackage.name)
    private readonly photoPackageModel: Model<PhotographyPackage>,
    private readonly promotionsService: PromotionsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  async createBooking(
    userIdStr: string,
    dto: CreateBookingDto,
  ): Promise<BookingDocument> {
    const customerId = new Types.ObjectId(userIdStr);
    const bookingCode = `B${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;

    let subTotal = 0;
    const itemDetails: Array<Partial<BookingItem>> = [];
    const providerIdsSet = new Set<string>();

    for (const item of dto.items) {
      let unitPrice = 0;
      let depositAmount = 0;
      let providerId: Types.ObjectId | null = null;
      let itemType: BookingItemType;

      if (item.productId) {
        const product = await this.productModel.findById(item.productId);
        if (!product) {
          throw new NotFoundException(`Product not found: ${item.productId}`);
        }
        unitPrice = product.basePrice;
        depositAmount = product.depositAmount;
        providerId = product.providerId;
        itemType = BookingItemType.Product;
      } else if (item.photographyPackageId) {
        const pkg = await this.photoPackageModel.findById(
          item.photographyPackageId,
        );
        if (!pkg) {
          throw new NotFoundException(
            `Photography package not found: ${item.photographyPackageId}`,
          );
        }
        unitPrice = pkg.price;
        depositAmount = Math.round(pkg.price * 0.2); // Default 20% deposit
        providerId = pkg.providerId;
        itemType = BookingItemType.PhotographyPackage;
      } else {
        throw new BadRequestException(
          'Each item must contain either productId or photographyPackageId',
        );
      }

      if (providerId) {
        providerIdsSet.add(providerId.toString());
      }

      const quantity = item.quantity || 1;
      subTotal += unitPrice * quantity;

      itemDetails.push({
        providerId,
        itemType,
        productId: item.productId ? new Types.ObjectId(item.productId) : null,
        photographyPackageId: item.photographyPackageId
          ? new Types.ObjectId(item.photographyPackageId)
          : null,
        priceVersionId: new Types.ObjectId(), // Snapshot placeholder
        unitPrice,
        depositAmount,
        quantity,
        rentalFrom: item.rentalFrom ? new Date(item.rentalFrom) : null,
        rentalTo: item.rentalTo ? new Date(item.rentalTo) : null,
        shootDate: item.shootDate ? new Date(item.shootDate) : null,
        shootTimeSlot: item.shootTimeSlot || null,
        customRequests: item.customRequests || '',
      });
    }

    const travelFee = dto.travelFee || 0;
    let discountAmount = 0;
    let promotionId: Types.ObjectId | null = null;

    if (dto.promoCode) {
      try {
        const promotion = await this.promotionsService.validatePromotion(
          dto.promoCode,
          subTotal,
          Array.from(providerIdsSet),
        );
        promotionId = promotion._id;

        if (promotion.discountType === DiscountType.Percentage) {
          discountAmount = Math.round(
            (subTotal * promotion.discountValue) / 100,
          );
          if (
            promotion.maxDiscountAmount &&
            discountAmount > promotion.maxDiscountAmount
          ) {
            discountAmount = promotion.maxDiscountAmount;
          }
        } else {
          discountAmount = promotion.discountValue;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new BadRequestException(`Failed to apply coupon: ${msg}`);
      }
    }

    const grandTotal = Math.max(subTotal - discountAmount + travelFee, 0);
    // Calculated deposit requirement (e.g. 20% prepay booking minimum)
    const depositTotal = Math.round(grandTotal * 0.2);

    const booking = await this.bookingModel.create({
      bookingCode,
      customerId,
      providerIds: Array.from(providerIdsSet).map(
        (id) => new Types.ObjectId(id),
      ),
      bookingType: dto.bookingType || BookingType.AoDaiRental,
      status: BookingStatus.PendingPayment,
      pricingSummary: {
        subTotal,
        depositTotal,
        discountAmount,
        travelFee,
        overtimeFee: 0,
        lateFee: 0,
        damageFee: 0,
        grandTotal,
      },
      paymentSummary: {
        totalPaid: 0,
        totalRefunded: 0,
        paymentStatus: PaymentStatus.Unpaid,
      },
      statusTimeline: [
        {
          status: BookingStatus.PendingPayment,
          changedAt: new Date(),
          note: 'Đơn hàng được khởi tạo',
        },
      ],
    });

    for (const detail of itemDetails) {
      await this.bookingItemModel.create({
        ...detail,
        bookingId: booking._id,
      });
    }

    // Auto-increment voucher count if validated
    if (promotionId) {
      await this.promotionsService.incrementUsage(promotionId);
    }

    return booking;
  }

  async getMyBookings(userIdStr: string): Promise<Record<string, any>[]> {
    const customerId = new Types.ObjectId(userIdStr);
    const bookings = await this.bookingModel
      .find({ customerId })
      .sort({ createdAt: -1 });

    const results: Record<string, any>[] = [];
    for (const booking of bookings) {
      const items = await this.bookingItemModel.find({
        bookingId: booking._id,
      });
      results.push({
        ...booking.toObject(),
        items,
      });
    }
    return results;
  }

  async getProviderBookings(
    userIdStr: string,
  ): Promise<Record<string, unknown>[]> {
    // Lookup provider first
    interface ProviderDoc {
      _id: Types.ObjectId;
    }
    const providerDoc = await this.bookingModel.db
      .model('Provider')
      .findOne({ userId: new Types.ObjectId(userIdStr) })
      .lean()
      .exec();
    const provider = providerDoc as ProviderDoc | null;
    if (!provider) {
      return [];
    }

    const bookings = await this.bookingModel
      .find({ providerIds: provider._id })
      .sort({ createdAt: -1 });
    const results: Record<string, unknown>[] = [];
    for (const booking of bookings) {
      const items = await this.bookingItemModel.find({
        bookingId: booking._id,
        providerId: provider._id,
      });
      results.push({
        ...booking.toObject(),
        items,
      });
    }
    return results;
  }

  async getBookingById(bookingIdStr: string): Promise<Record<string, any>> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    const items = await this.bookingItemModel.find({ bookingId });
    return {
      ...booking.toObject(),
      items,
    };
  }

  async completeBooking(bookingIdStr: string): Promise<BookingDocument> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.Completed) {
      return booking;
    }

    booking.status = BookingStatus.Completed;
    booking.statusTimeline.push({
      status: BookingStatus.Completed,
      changedAt: new Date(),
      note: 'Đơn hàng hoàn thành. Tiến hành đối soát trực tiếp.',
    });

    await booking.save();

    await this.paymentsService.settleBooking(bookingIdStr);

    return booking;
  }

  async cancelBooking(
    bookingIdStr: string,
    reason: string,
    cancelledByUserIdStr?: string,
  ): Promise<BookingDocument> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.Cancelled) {
      return booking;
    }

    booking.status = BookingStatus.Cancelled;
    booking.statusTimeline.push({
      status: BookingStatus.Cancelled,
      changedAt: new Date(),
      note: `Hủy đơn hàng. Lý do: ${reason}`,
      changedBy: cancelledByUserIdStr
        ? new Types.ObjectId(cancelledByUserIdStr)
        : null,
    });

    await booking.save();

    await this.paymentsService.refundDeposit(bookingIdStr);

    return booking;
  }
}
