import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  ForbiddenException,
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
import {
  BookingSchedule,
  BookingScheduleType,
  BookingScheduleStatus,
} from '../schemas/booking-schedule.schema';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsArray, Min } from 'class-validator';

// ─── DTOs (dùng chung với controller) ────────────────────────────────────────

/** Dùng cho createBooking tổng hợp (nhiều items, hỗ trợ promo) */
export class CreateBookingItemDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  photographyPackageId?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  quantity?: number;

  @IsString()
  @IsOptional()
  rentalFrom?: string;

  @IsString()
  @IsOptional()
  rentalTo?: string;

  @IsString()
  @IsOptional()
  shootDate?: string;

  @IsString()
  @IsOptional()
  shootTimeSlot?: string;

  @IsString()
  @IsOptional()
  customRequests?: string;
}

export class CreateBookingDto {
  @IsEnum(BookingType)
  bookingType: BookingType;

  @IsArray()
  @IsNotEmpty()
  items: CreateBookingItemDto[];

  @IsString()
  @IsOptional()
  promoCode?: string;

  @IsNumber()
  @IsOptional()
  travelFee?: number;
}

/** Dùng cho createProductBooking (thuê áo dài theo ngày/giờ) */
export class CreateProductBookingDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['DAILY', 'HOURLY'])
  rentalType: 'DAILY' | 'HOURLY';

  @IsString()
  @IsNotEmpty()
  startDate: string;   // YYYY-MM-DD — dùng cho cả DAILY (bắt đầu) và HOURLY (ngày thuê)

  @IsString()
  @IsOptional()
  endDate?: string;    // YYYY-MM-DD — chỉ dùng cho DAILY (ngày kết thúc)

  @IsString()
  @IsOptional()
  startTime?: string;  // HH:mm      — chỉ dùng cho HOURLY

  @IsString()
  @IsOptional()
  endTime?: string;    // HH:mm      — chỉ dùng cho HOURLY

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;
}

/** Dùng cho createPhotographyBooking */
export class CreatePhotographyBookingDto {
  @IsString()
  @IsNotEmpty()
  packageId: string;

  @IsString()
  @IsNotEmpty()
  shootDate: string;

  @IsString()
  @IsNotEmpty()
  shootTimeSlot: string;

  @IsString()
  @IsNotEmpty()
  shootLocation: string;

  @IsString()
  @IsNotEmpty()
  concept: string;

  @IsString()
  @IsOptional()
  customRequests?: string;

  @IsString()
  @IsOptional()
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
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingSchedule>,
    private readonly promotionsService: PromotionsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly productsService: ProductsService,
  ) {}

  // Getter để map photographyPackageModel sang photoPackageModel cho cả hai bên
  private get photographyPackageModel() {
    return this.photoPackageModel;
  }

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

    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Mã sản phẩm không hợp lệ');
    }

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

    const savedBookingItem = await bookingItem.save();

    // Create BookingSchedule entries
    if (rentalType === 'DAILY' && rentalFrom && rentalTo) {
      const start = new Date(rentalFrom);
      const end = new Date(rentalTo);
      const current = new Date(start);
      while (current <= end) {
        await this.bookingScheduleModel.create({
          bookingId: savedBooking._id,
          bookingItemId: savedBookingItem._id,
          scheduleType: BookingScheduleType.RentalPeriod,
          scheduledDate: new Date(current),
          timeSlot: null,
          status: BookingScheduleStatus.Scheduled,
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (rentalType === 'HOURLY' && shootDate) {
      await this.bookingScheduleModel.create({
        bookingId: savedBooking._id,
        bookingItemId: savedBookingItem._id,
        scheduleType: BookingScheduleType.RentalPeriod,
        scheduledDate: shootDate,
        timeSlot: shootTimeSlot,
        status: BookingScheduleStatus.Scheduled,
      });
    }

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

    if (!Types.ObjectId.isValid(packageId)) {
      throw new BadRequestException('Mã gói chụp không hợp lệ');
    }

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

    const savedBookingItem = await bookingItem.save();

    // Create BookingSchedule entry for the photoshoot
    await this.bookingScheduleModel.create({
      bookingId: savedBooking._id,
      bookingItemId: savedBookingItem._id,
      scheduleType: BookingScheduleType.Photoshoot,
      scheduledDate: date,
      timeSlot: shootTimeSlot,
      status: BookingScheduleStatus.Scheduled,
    });

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
    bookingId: string,
    userIdOrReason: string,
    rolesOrCancelledByUserId?: string | string[],
    maybeReason?: string,
  ): Promise<any> {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }

    let userId: string;
    let roles: string[] = [];
    let reason: string;

    if (Array.isArray(rolesOrCancelledByUserId)) {
      userId = userIdOrReason;
      roles = rolesOrCancelledByUserId;
      reason = maybeReason || 'Khách hàng/Nhà cung cấp hủy đơn';
    } else {
      reason = userIdOrReason;
      userId = rolesOrCancelledByUserId || '';
      roles = [];
    }

    // Check authorization: customer, provider or admin
    const isCustomer = booking.customerId.toString() === userId;
    const isProvider = booking.providerIds.map(id => id.toString()).includes(userId);
    const isAdmin = roles.includes('ADMIN') || roles.includes('admin');

    // Nếu không truyền userId (trường hợp HEAD cũ hoặc admin tự kích hoạt), cho phép đi tiếp
    if (userId && !isCustomer && !isProvider && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền hủy đơn đặt lịch này');
    }

    if (booking.status === BookingStatus.Cancelled) {
      return booking;
    }

    const nonCancellableStatuses = [
      BookingStatus.PickedUp,
      BookingStatus.Returned,
      BookingStatus.Completed,
      BookingStatus.Disputed
    ];
    if (nonCancellableStatuses.includes(booking.status)) {
      throw new BadRequestException('Không thể hủy đơn đặt lịch đang thực hiện hoặc đã hoàn thành');
    }

    const now = new Date();
    let isFreeCancel = true;
    let refundAmount = 0;
    let penaltyReason = '';

    if (isCustomer && booking.status !== BookingStatus.PendingPayment) {
      // Tìm booking items để lấy start date sớm nhất
      const items = await this.bookingItemModel.find({ bookingId: booking._id });
      let earliestStartTime: Date | null = null;

      for (const item of items) {
        let itemStart: Date | null = null;
        if (item.rentalType === 'HOURLY' || item.itemType === BookingItemType.PhotographyPackage) {
          if (item.shootDate) {
            const d = new Date(item.shootDate);
            let hour = 7;
            let min = 0;
            if (item.shootTimeSlot) {
              const timePart = item.shootTimeSlot.split('-')[0].trim();
              const [h, m] = timePart.split(':').map(Number);
              if (!isNaN(h)) {
                hour = h;
                min = m || 0;
              }
            }
            d.setHours(hour, min, 0, 0);
            itemStart = d;
          }
        } else {
          // DAILY
          if (item.rentalFrom) {
            const d = new Date(item.rentalFrom);
            d.setHours(0, 0, 0, 0);
            itemStart = d;
          }
        }

        if (itemStart) {
          if (!earliestStartTime || itemStart < earliestStartTime) {
            earliestStartTime = itemStart;
          }
        }
      }

      if (earliestStartTime) {
        const diffInMs = earliestStartTime.getTime() - now.getTime();
        const diffInHours = diffInMs / (1000 * 60 * 60);

        if (diffInHours >= 24) {
          isFreeCancel = true;
        } else {
          // Kiểm tra xem đơn hàng có được tạo trong vòng 24 giờ trước giờ bắt đầu hay không (last-minute booking)
          const createdAtDate = new Date((booking as any).createdAt || now);
          const startMinusCreatedHours = (earliestStartTime.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60);
          if (startMinusCreatedHours < 24) {
            const minsSinceCreation = (now.getTime() - createdAtDate.getTime()) / (1000 * 60);
            if (diffInHours >= 2) {
              // Hạn ân hạn là 60 phút
              if (minsSinceCreation <= 60) {
                isFreeCancel = true;
              } else {
                isFreeCancel = false;
                penaltyReason = `Đã quá thời gian ân hạn 60 phút đối với đơn hàng đặt sát giờ (Đặt lúc ${createdAtDate.toLocaleTimeString('vi-VN')}).`;
              }
            } else {
              // Siêu gấp: Hạn ân hạn là 5 phút
              if (minsSinceCreation <= 5) {
                isFreeCancel = true;
              } else {
                isFreeCancel = false;
                penaltyReason = `Đã quá thời gian ân hạn 5 phút đối với đơn hàng đặt siêu gấp (Đặt lúc ${createdAtDate.toLocaleTimeString('vi-VN')}).`;
              }
            }
          } else {
            // Hủy trễ bình thường
            isFreeCancel = false;
            penaltyReason = 'Hủy đơn trễ (dưới 24 giờ trước giờ hẹn).';
          }
        }
      }
    }

    if (isProvider) {
      isFreeCancel = true;
    }

    if (isFreeCancel) {
      refundAmount = booking.pricingSummary?.depositTotal || 0;
    } else {
      refundAmount = 0;
    }

    booking.status = BookingStatus.Cancelled;
    booking.cancellation = {
      cancelledBy: new Types.ObjectId(userId || undefined),
      reason: reason || (isProvider ? 'Nhà cung cấp chủ động hủy lịch' : 'Khách hàng hủy đơn'),
      cancelledAt: now,
      refundAmount,
    };

    booking.statusTimeline.push({
      status: BookingStatus.Cancelled,
      changedAt: now,
      note: isFreeCancel 
        ? `Đơn hàng đã được hủy thành công. Hoàn cọc 100% (${refundAmount.toLocaleString('vi-VN')}đ).` 
        : `Đơn hàng đã bị hủy kèm mức phạt mất cọc do: ${penaltyReason}`,
      changedBy: userId ? new Types.ObjectId(userId) : null,
    });

    const savedBooking = await booking.save();

    // Hủy các BookingSchedule liên quan
    await this.bookingScheduleModel.updateMany(
      { bookingId: booking._id },
      { status: BookingScheduleStatus.Cancelled }
    );

    // Kích hoạt hoàn tiền cọc nếu được phép và có số tiền cọc
    if (isFreeCancel && refundAmount > 0) {
      try {
        await this.paymentsService.refundDeposit(booking._id.toString());
      } catch (err) {
        console.error('PaymentsService.refundDeposit failed during cancelBooking:', err);
      }
    }

    // Trả về định dạng phù hợp cho cả 2 luồng gọi
    return Array.isArray(rolesOrCancelledByUserId) ? {
      success: true,
      booking: savedBooking,
      isFreeCancel,
      refundAmount,
      penaltyReason,
    } : savedBooking;
  }

  async getCustomerBookings(customerId: string): Promise<any[]> {
    const bookings = await this.bookingModel.find({ customerId: new Types.ObjectId(customerId) }).sort({ createdAt: -1 });
    
    const populatedBookings = [];
    for (const booking of bookings) {
      const items = await this.bookingItemModel.find({ bookingId: booking._id })
        .populate({
          path: 'productId',
          populate: { path: 'providerId' }
        })
        .populate('photographyPackageId')
        .populate('providerId');
      
      populatedBookings.push({
        ...booking.toObject(),
        items: items.map(item => item.toObject()),
      });
    }
    
    return populatedBookings;
  }

  async getBusySchedulesForProduct(productId: string): Promise<{ bookedDates: string[], bookedSlots: { date: string, timeSlot: string }[] }> {
    const activeBookings = await this.bookingModel.find({
      status: { $ne: BookingStatus.Cancelled }
    }).select('_id');
    const activeBookingIds = activeBookings.map(b => b._id);

    const items = await this.bookingItemModel.find({
      bookingId: { $in: activeBookingIds },
      productId: new Types.ObjectId(productId)
    });
    const bookingItemIds = items.map(item => item._id);

    const schedules = await this.bookingScheduleModel.find({
      bookingItemId: { $in: bookingItemIds },
      status: { $ne: BookingScheduleStatus.Cancelled }
    });

    const bookedDates = new Set<string>();
    const bookedSlots: { date: string, timeSlot: string }[] = [];

    schedules.forEach(sched => {
      const dateStr = sched.scheduledDate.toISOString().split('T')[0];
      if (sched.timeSlot) {
        bookedSlots.push({ date: dateStr, timeSlot: sched.timeSlot });
      } else {
        bookedDates.add(dateStr);
      }
    });

    return {
      bookedDates: Array.from(bookedDates),
      bookedSlots
    };
  }

  async getBusySchedulesForProvider(providerId: string): Promise<{ bookedDates: string[], bookedSlots: { date: string, timeSlot: string }[] }> {
    const activeBookings = await this.bookingModel.find({
      status: { $ne: BookingStatus.Cancelled }
    }).select('_id');
    const activeBookingIds = activeBookings.map(b => b._id);

    const items = await this.bookingItemModel.find({
      bookingId: { $in: activeBookingIds },
      providerId: new Types.ObjectId(providerId),
      itemType: BookingItemType.PhotographyPackage
    });
    const bookingItemIds = items.map(item => item._id);

    const schedules = await this.bookingScheduleModel.find({
      bookingItemId: { $in: bookingItemIds },
      status: { $ne: BookingScheduleStatus.Cancelled }
    });

    const bookedDates = new Set<string>();
    const bookedSlots: { date: string, timeSlot: string }[] = [];

    schedules.forEach(sched => {
      const dateStr = sched.scheduledDate.toISOString().split('T')[0];
      if (sched.timeSlot) {
        bookedSlots.push({ date: dateStr, timeSlot: sched.timeSlot });
      } else {
        bookedDates.add(dateStr);
      }
    });

    return {
      bookedDates: Array.from(bookedDates),
      bookedSlots
    };
  }
}
