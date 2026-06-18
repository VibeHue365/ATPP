import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingType, BookingStatus, PaymentStatus } from '../schemas/booking.schema';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import { BookingSchedule, BookingScheduleType, BookingScheduleStatus } from '../schemas/booking-schedule.schema';
import { ProductsService } from '../../products/services/products.service';
import { PriceVersion, PriceTargetType } from '../../products/schemas/price-version.schema';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';

import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber } from 'class-validator';

export class CreateBookingDto {
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

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name) private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(BookingSchedule.name) private readonly bookingScheduleModel: Model<BookingSchedule>,
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
    // 1. Find active bookings (not cancelled)
    const activeBookings = await this.bookingModel.find({
      status: { $ne: BookingStatus.Cancelled }
    }).select('_id');
    const activeBookingIds = activeBookings.map(b => b._id);

    // 2. Find booking items for this product
    const items = await this.bookingItemModel.find({
      bookingId: { $in: activeBookingIds },
      productId: new Types.ObjectId(productId)
    });
    const bookingItemIds = items.map(item => item._id);

    // 3. Find schedules
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
    // 1. Find active bookings (not cancelled)
    const activeBookings = await this.bookingModel.find({
      status: { $ne: BookingStatus.Cancelled }
    }).select('_id');
    const activeBookingIds = activeBookings.map(b => b._id);

    // 2. Find booking items for this provider
    const items = await this.bookingItemModel.find({
      bookingId: { $in: activeBookingIds },
      providerId: new Types.ObjectId(providerId),
      itemType: BookingItemType.PhotographyPackage
    });
    const bookingItemIds = items.map(item => item._id);

    // 3. Find schedules
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

  async cancelBooking(bookingId: string, userId: string, roles: string[], reason?: string): Promise<any> {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }

    // Check authorization: customer, provider or admin
    const isCustomer = booking.customerId.toString() === userId;
    const isProvider = booking.providerIds.map(id => id.toString()).includes(userId);
    const isAdmin = roles.includes('ADMIN') || roles.includes('admin');

    if (!isCustomer && !isProvider && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền hủy đơn đặt lịch này');
    }

    if (booking.status === BookingStatus.Cancelled) {
      throw new BadRequestException('Đơn đặt lịch đã được hủy trước đó');
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
      // Find booking items to get the earliest start date
      const items = await this.bookingItemModel.find({ bookingId: booking._id });
      let earliestStartTime: Date | null = null;

      for (const item of items) {
        let itemStart: Date | null = null;
        if (item.rentalType === 'HOURLY' || item.itemType === 'PHOTOGRAPHY_PACKAGE') {
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
          // Check if this booking was created within 24 hours of start time (last-minute booking)
          const createdAtDate = new Date((booking as any).createdAt);
          const startMinusCreatedHours = (earliestStartTime.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60);
          if (startMinusCreatedHours < 24) {
            const minsSinceCreation = (now.getTime() - createdAtDate.getTime()) / (1000 * 60);
            if (diffInHours >= 2) {
              // Grace period is 60 minutes
              if (minsSinceCreation <= 60) {
                isFreeCancel = true;
              } else {
                isFreeCancel = false;
                penaltyReason = `Đã quá thời gian ân hạn 60 phút đối với đơn hàng đặt sát giờ (Đặt lúc ${createdAtDate.toLocaleTimeString('vi-VN')}).`;
              }
            } else {
              // Super last-minute: Grace period is 5 minutes
              if (minsSinceCreation <= 5) {
                isFreeCancel = true;
              } else {
                isFreeCancel = false;
                penaltyReason = `Đã quá thời gian ân hạn 5 phút đối với đơn hàng đặt siêu gấp (Đặt lúc ${createdAtDate.toLocaleTimeString('vi-VN')}).`;
              }
            }
          } else {
            // Normal booking cancelled late
            isFreeCancel = false;
            penaltyReason = 'Hủy đơn trễ (dưới 24 giờ trước giờ hẹn).';
          }
        }
      }
    }

    if (isProvider) {
      isFreeCancel = true;
      // We can also flag provider penalty here if needed (e.g. decrease provider rating score or log)
    }

    if (isFreeCancel) {
      refundAmount = booking.pricingSummary?.depositTotal || 0;
    } else {
      refundAmount = 0;
    }

    booking.status = BookingStatus.Cancelled;
    booking.cancellation = {
      cancelledBy: new Types.ObjectId(userId),
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
    });

    const savedBooking = await booking.save();

    // Set schedule entries to Cancelled
    await this.bookingScheduleModel.updateMany(
      { bookingId: booking._id },
      { status: BookingScheduleStatus.Cancelled }
    );

    return {
      success: true,
      booking: savedBooking,
      isFreeCancel,
      refundAmount,
      penaltyReason,
    };
  }
}
