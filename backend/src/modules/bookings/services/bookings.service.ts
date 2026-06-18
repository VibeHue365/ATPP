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
import { ProductsService } from '../../products/services/products.service';
import {
  PriceVersion,
  PriceTargetType,
} from '../../products/schemas/price-version.schema';

// ─── DTOs (dùng chung với controller) ────────────────────────────────────────

/** Dùng cho createBooking tổng hợp (nhiều items, hỗ trợ promo) */
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

/** Dùng cho createProductBooking (thuê áo dài theo ngày/giờ) */
export class CreateProductBookingDto {
  productId: string;
  rentalType: 'DAILY' | 'HOURLY';
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  size: string;
  color: string;
  quantity?: number;
}

/** Dùng cho createPhotographyBooking */
export class CreatePhotographyBookingDto {
  packageId: string;
  shootDate: string;
  shootTimeSlot: string;
  shootLocation: string;
  concept: string;
  customRequests?: string;
  referenceImage?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(Product.name)
    private readonly productModel: Model<Product>,
    @InjectModel(PhotographyPackage.name)
    private readonly photoPackageModel: Model<PhotographyPackage>,
    @InjectModel(PriceVersion.name)
    private readonly priceVersionModel: Model<PriceVersion>,
    private readonly promotionsService: PromotionsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly productsService: ProductsService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // 1. createBooking — tổng hợp nhiều items, hỗ trợ promo code
  // ──────────────────────────────────────────────────────────────────────────
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
        depositAmount = Math.round(pkg.price * 0.2);
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
        priceVersionId: new Types.ObjectId(),
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
    const depositTotal = Math.round(grandTotal * 0.2);

    const booking = (await this.bookingModel.create({
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
    })) as BookingDocument;

    for (const detail of itemDetails) {
      await this.bookingItemModel.create({
        ...detail,
        bookingId: booking._id,
      });
    }

    if (promotionId) {
      await this.promotionsService.incrementUsage(promotionId);
    }

    return booking;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. createProductBooking — thuê áo dài theo ngày hoặc theo giờ
  // ──────────────────────────────────────────────────────────────────────────
  async createProductBooking(
    customerId: string,
    dto: CreateProductBookingDto,
  ): Promise<BookingDocument> {
    const {
      productId,
      rentalType,
      startDate,
      endDate,
      startTime,
      endTime,
      size,
      color,
      quantity = 1,
    } = dto;

    const product = await this.productsService.getProductById(productId);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${productId}`);
    }

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Định dạng ngày bắt đầu không hợp lệ');
    }

    let subTotal = 0;
    let unitPrice = product.basePrice;
    let rentalFrom: Date | null = null;
    let rentalTo: Date | null = null;
    let shootDate: Date | null = null;
    let shootTimeSlot: string | null = null;

    if (rentalType === 'HOURLY') {
      if (!startTime || !endTime) {
        throw new BadRequestException(
          'Yêu cầu giờ bắt đầu và giờ kết thúc khi thuê theo giờ',
        );
      }
      if (!product.hourlyPrice) {
        throw new BadRequestException(
          'Sản phẩm này không hỗ trợ hình thức thuê theo giờ',
        );
      }

      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);

      const startDateTime = new Date(start);
      startDateTime.setHours(sh, sm, 0, 0);
      const endDateTime = new Date(start);
      endDateTime.setHours(eh, em, 0, 0);

      const durationHours =
        (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);

      if (durationHours < 2) {
        throw new BadRequestException('Thời gian thuê tối thiểu là 2 tiếng');
      }

      unitPrice = product.hourlyPrice;
      subTotal = unitPrice * durationHours * quantity;
      shootDate = start;
      shootTimeSlot = `${startTime}-${endTime}`;
    } else {
      if (!endDate) {
        throw new BadRequestException(
          'Yêu cầu ngày kết thúc khi thuê theo ngày',
        );
      }
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new BadRequestException('Định dạng ngày kết thúc không hợp lệ');
      }
      if (end < start) {
        throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
      }

      const durationDays =
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) ||
        1;

      unitPrice = product.basePrice;
      subTotal = unitPrice * durationDays * quantity;
      rentalFrom = start;
      rentalTo = end;
    }

    const depositTotal = product.depositAmount * quantity;
    const grandTotal = subTotal + depositTotal;

    // Lấy hoặc tạo PriceVersion để theo dõi lịch sử giá
    let priceVersion = await this.priceVersionModel
      .findOne({
        targetId: new Types.ObjectId(productId),
        targetType: PriceTargetType.Product,
      })
      .sort({ effectiveFrom: -1 });

    if (!priceVersion) {
      priceVersion = await this.priceVersionModel.create({
        targetType: PriceTargetType.Product,
        targetId: new Types.ObjectId(productId),
        price: unitPrice,
        depositAmount: product.depositAmount,
        effectiveFrom: new Date(),
        note: 'Tự động tạo khi booking',
      });
    }

    const bookingCode = `BK${Math.floor(10000 + Math.random() * 90000)}`;

    const booking = new this.bookingModel({
      bookingCode,
      customerId: new Types.ObjectId(customerId),
      providerIds: [product.providerId],
      bookingType: BookingType.AoDaiRental,
      status: BookingStatus.PendingPayment,
      pricingSummary: {
        subTotal,
        depositTotal,
        discountAmount: 0,
        travelFee: 0,
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
          note: `Booking tạo bởi khách hàng — hình thức: ${rentalType === 'HOURLY' ? 'Thuê theo giờ' : 'Thuê theo ngày'}`,
        },
      ],
    });

    const savedBooking = await booking.save();

    const bookingItem = new this.bookingItemModel({
      bookingId: savedBooking._id,
      providerId: product.providerId,
      itemType: BookingItemType.Product,
      productId: product._id,
      priceVersionId: priceVersion._id,
      unitPrice,
      depositAmount: product.depositAmount,
      quantity,
      rentalFrom,
      rentalTo,
      shootDate,
      shootTimeSlot,
      rentalType,
      selectedSize: size.toUpperCase(),
      selectedColor: color.toUpperCase(),
      customRequests: null,
    });

    await bookingItem.save();

    return savedBooking;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. createPhotographyBooking — đặt lịch gói chụp ảnh
  // ──────────────────────────────────────────────────────────────────────────
  async createPhotographyBooking(
    customerId: string,
    dto: CreatePhotographyBookingDto,
  ): Promise<BookingDocument> {
    const {
      packageId,
      shootDate,
      shootTimeSlot,
      shootLocation,
      concept,
      customRequests,
      referenceImage,
    } = dto;

    const pkg = await this.photoPackageModel.findById(packageId);
    if (!pkg) {
      throw new NotFoundException(
        `Không tìm thấy gói chụp ảnh với ID: ${packageId}`,
      );
    }

    const date = new Date(shootDate);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Định dạng ngày chụp không hợp lệ');
    }

    // Kiểm tra trùng lịch chụp
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const isSlotBusy = await this.bookingItemModel.findOne({
      providerId: pkg.providerId,
      itemType: BookingItemType.PhotographyPackage,
      shootDate: { $gte: startOfDay, $lte: endOfDay },
      shootTimeSlot,
    });

    if (isSlotBusy) {
      throw new BadRequestException(
        'Nhiếp ảnh gia này đã có lịch chụp trong khung giờ đã chọn. Vui lòng chọn khung giờ hoặc ngày khác.',
      );
    }

    const unitPrice = pkg.price;
    const subTotal = pkg.price;
    const depositTotal = Math.round(pkg.price * 0.3); // 30% cọc
    const grandTotal = pkg.price;

    let priceVersion = await this.priceVersionModel
      .findOne({
        targetId: pkg._id,
        targetType: PriceTargetType.PhotographyPackage,
      })
      .sort({ effectiveFrom: -1 });

    if (!priceVersion) {
      priceVersion = await this.priceVersionModel.create({
        targetType: PriceTargetType.PhotographyPackage,
        targetId: pkg._id,
        price: unitPrice,
        depositAmount: depositTotal,
        effectiveFrom: new Date(),
        note: 'Tự động tạo khi booking gói chụp',
      });
    }

    const bookingCode = `BK${Math.floor(10000 + Math.random() * 90000)}`;

    const booking = new this.bookingModel({
      bookingCode,
      customerId: new Types.ObjectId(customerId),
      providerIds: [pkg.providerId],
      bookingType: BookingType.Photography,
      status: BookingStatus.PendingPayment,
      pricingSummary: {
        subTotal,
        depositTotal,
        discountAmount: 0,
        travelFee: 0,
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
          note: `Booking gói chụp tạo bởi khách hàng — Concept: ${concept}, Địa điểm: ${shootLocation}`,
        },
      ],
    });

    const savedBooking = await booking.save();

    const bookingItem = new this.bookingItemModel({
      bookingId: savedBooking._id,
      providerId: pkg.providerId,
      itemType: BookingItemType.PhotographyPackage,
      photographyPackageId: pkg._id,
      priceVersionId: priceVersion._id,
      unitPrice,
      depositAmount: depositTotal,
      quantity: 1,
      shootDate: date,
      shootTimeSlot,
      shootLocation,
      shootConcept: concept,
      referenceImage: referenceImage || null,
      rentalType: 'DAILY',
      customRequests: customRequests || null,
    });

    await bookingItem.save();

    return savedBooking;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Các phương thức truy vấn & quản lý trạng thái
  // ──────────────────────────────────────────────────────────────────────────

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
      results.push({ ...booking.toObject(), items });
    }
    return results;
  }

  async getProviderBookings(
    userIdStr: string,
  ): Promise<Record<string, unknown>[]> {
    interface ProviderDoc {
      _id: Types.ObjectId;
    }
    const providerDoc = await this.bookingModel.db
      .model('Provider')
      .findOne({ userId: new Types.ObjectId(userIdStr) })
      .lean()
      .exec();
    const provider = providerDoc as ProviderDoc | null;
    if (!provider) return [];

    const bookings = await this.bookingModel
      .find({ providerIds: provider._id })
      .sort({ createdAt: -1 });

    const results: Record<string, unknown>[] = [];
    for (const booking of bookings) {
      const items = await this.bookingItemModel.find({
        bookingId: booking._id,
        providerId: provider._id,
      });
      results.push({ ...booking.toObject(), items });
    }
    return results;
  }

  async getBookingById(bookingIdStr: string): Promise<Record<string, any>> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    const items = await this.bookingItemModel.find({ bookingId });
    return { ...booking.toObject(), items };
  }

  /** Hoàn thành đơn → trigger đối soát chia tiền (PaymentsService.settleBooking) */
  async completeBooking(bookingIdStr: string): Promise<BookingDocument> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status === BookingStatus.Completed) return booking;

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

  /** Hủy đơn → trigger hoàn tiền cọc (PaymentsService.refundDeposit) */
  async cancelBooking(
    bookingIdStr: string,
    reason: string,
    cancelledByUserIdStr?: string,
  ): Promise<BookingDocument> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status === BookingStatus.Cancelled) return booking;

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
