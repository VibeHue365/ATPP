import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingType, BookingStatus, PaymentStatus } from '../schemas/booking.schema';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import { ProductsService } from '../../products/services/products.service';
import { PriceVersion, PriceTargetType } from '../../products/schemas/price-version.schema';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';

export class CreateBookingDto {
  productId: string;
  rentalType: 'DAILY' | 'HOURLY';
  startDate: string;   // YYYY-MM-DD — dùng cho cả DAILY (bắt đầu) và HOURLY (ngày thuê)
  endDate?: string;    // YYYY-MM-DD — chỉ dùng cho DAILY (ngày kết thúc)
  startTime?: string;  // HH:mm      — chỉ dùng cho HOURLY
  endTime?: string;    // HH:mm      — chỉ dùng cho HOURLY
  size: string;
  color: string;
  quantity?: number;
}

export class CreatePhotographyBookingDto {
  packageId: string;
  shootDate: string;
  shootTimeSlot: string;
  shootLocation: string;
  concept: string;
  customRequests?: string;
  referenceImage?: string;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name) private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(PriceVersion.name) private readonly priceVersionModel: Model<PriceVersion>,
    @InjectModel(PhotographyPackage.name) private readonly photographyPackageModel: Model<PhotographyPackage>,
    private readonly productsService: ProductsService,
  ) {}

  async createProductBooking(customerId: string, dto: CreateBookingDto): Promise<BookingDocument> {
    const { productId, rentalType, startDate, endDate, startTime, endTime, size, color, quantity = 1 } = dto;

    // 1. Xác nhận sản phẩm tồn tại
    const product = await this.productsService.getProductById(productId);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${productId}`);
    }

    // 2. Parse ngày bắt đầu
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Định dạng ngày bắt đầu không hợp lệ');
    }

    // 3. Tính thời lượng và đơn giá theo hình thức thuê
    let subTotal = 0;
    let unitPrice = product.basePrice;
    let rentalFrom: Date | null = null;
    let rentalTo: Date | null = null;
    let shootDate: Date | null = null;
    let shootTimeSlot: string | null = null;

    if (rentalType === 'HOURLY') {
      // --- Thuê theo giờ ---
      if (!startTime || !endTime) {
        throw new BadRequestException('Yêu cầu giờ bắt đầu và giờ kết thúc khi thuê theo giờ');
      }

      // Kiểm tra sản phẩm có hỗ trợ thuê giờ không
      if (!product.hourlyPrice) {
        throw new BadRequestException('Sản phẩm này không hỗ trợ hình thức thuê theo giờ');
      }

      // Parse khung giờ
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);

      const startDateTime = new Date(start);
      startDateTime.setHours(sh, sm, 0, 0);

      const endDateTime = new Date(start); // thuê theo giờ là trong 1 ngày
      endDateTime.setHours(eh, em, 0, 0);

      const durationMs = endDateTime.getTime() - startDateTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      if (durationHours < 2) {
        throw new BadRequestException('Thời gian thuê tối thiểu là 2 tiếng');
      }

      // Dùng hourlyPrice từ product (không hardcode)
      unitPrice = product.hourlyPrice;
      subTotal = unitPrice * durationHours * quantity;

      shootDate = start;
      shootTimeSlot = `${startTime}-${endTime}`;

    } else {
      // --- Thuê theo ngày ---
      if (!endDate) {
        throw new BadRequestException('Yêu cầu ngày kết thúc khi thuê theo ngày');
      }

      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new BadRequestException('Định dạng ngày kết thúc không hợp lệ');
      }
      if (end < start) {
        throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
      }

      const diffTime = end.getTime() - start.getTime();
      const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // tối thiểu 1 ngày

      unitPrice = product.basePrice;
      subTotal = unitPrice * durationDays * quantity;

      rentalFrom = start;
      rentalTo = end;
    }

    const depositTotal = product.depositAmount * quantity;
    const grandTotal = subTotal + depositTotal;

    // 4. Lấy hoặc tạo PriceVersion để theo dõi lịch sử giá
    let priceVersion = await this.priceVersionModel.findOne({
      targetId: new Types.ObjectId(productId),
      targetType: PriceTargetType.Product,
    }).sort({ effectiveFrom: -1 });

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

    // 5. Tạo mã booking (BK + 5 chữ số ngẫu nhiên)
    const bookingCode = `BK${Math.floor(10000 + Math.random() * 90000)}`;

    // 6. Tạo bản ghi Booking chính
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

    // 7. Tạo BookingItem với đầy đủ thông tin thời gian và lựa chọn
    const bookingItem = new this.bookingItemModel({
      bookingId: savedBooking._id,
      providerId: product.providerId,
      itemType: BookingItemType.Product,
      productId: product._id,
      priceVersionId: priceVersion._id,
      unitPrice,
      depositAmount: product.depositAmount,
      quantity,
      // Thời gian thuê theo ngày
      rentalFrom,
      rentalTo,
      // Thời gian thuê theo giờ
      shootDate,
      shootTimeSlot,
      // Các field rõ ràng — lưu tường minh vào DB
      rentalType,                          // 'DAILY' | 'HOURLY'
      selectedSize: size.toUpperCase(),    // VD: 'M', 'L', 'XL'
      selectedColor: color.toUpperCase(),  // VD: 'RED', 'WHITE'
      customRequests: null,
    });

    await bookingItem.save();

    return savedBooking;
  }

  async createPhotographyBooking(customerId: string, dto: CreatePhotographyBookingDto): Promise<BookingDocument> {
    const { packageId, shootDate, shootTimeSlot, shootLocation, concept, customRequests, referenceImage } = dto;

    const pkg = await this.photographyPackageModel.findById(packageId);
    if (!pkg) {
      throw new NotFoundException(`Không tìm thấy gói chụp ảnh với ID: ${packageId}`);
    }

    const date = new Date(shootDate);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Định dạng ngày chụp không hợp lệ');
    }

    // Kiểm tra trùng lịch chụp của thợ trong ngày và khung giờ đã chọn
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const isSlotBusy = await this.bookingItemModel.findOne({
      providerId: pkg.providerId,
      itemType: BookingItemType.PhotographyPackage,
      shootDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      shootTimeSlot,
    });

    if (isSlotBusy) {
      throw new BadRequestException('Nhiếp ảnh gia này đã có lịch chụp trong khung giờ đã chọn. Vui lòng chọn khung giờ hoặc ngày khác.');
    }

    const unitPrice = pkg.price;
    const subTotal = pkg.price;
    const depositTotal = Math.round(pkg.price * 0.3); // 30% cọc
    const grandTotal = pkg.price;

    let priceVersion = await this.priceVersionModel.findOne({
      targetId: pkg._id,
      targetType: PriceTargetType.PhotographyPackage,
    }).sort({ effectiveFrom: -1 });

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
}
