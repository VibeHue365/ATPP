import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  ForbiddenException,
  OnApplicationBootstrap,
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
import { Provider } from '../../providers/schemas/provider.schema';
import {
  PriceVersion,
  PriceTargetType,
} from '../../products/schemas/price-version.schema';
import {
  BookingSchedule,
  BookingScheduleType,
  BookingScheduleStatus,
} from '../schemas/booking-schedule.schema';
import { InventoryItem } from '../../products/schemas/inventory-item.schema';
import {
  InventoryReservation,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsArray, Min } from 'class-validator';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { SYSTEM_POLICIES } from '../../../common/config/system-policies.config';

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

  @IsString()
  @IsOptional()
  referenceImage?: string;

  @IsString()
  @IsOptional()
  selectedSize?: string;

  @IsString()
  @IsOptional()
  selectedColor?: string;

  @IsString()
  @IsOptional()
  rentalType?: string;
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

  @IsNumber()
  @IsOptional()
  serviceFee?: number;
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
export class BookingsService implements OnApplicationBootstrap {
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
    @InjectModel(InventoryItem.name)
    private readonly inventoryItemModel: Model<InventoryItem>,
    @InjectModel(InventoryReservation.name)
    private readonly inventoryReservationModel: Model<InventoryReservation>,
    private readonly promotionsService: PromotionsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly productsService: ProductsService,
    private readonly notificationsService: NotificationsService,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
  ) { }

  onApplicationBootstrap() {
    // Run cleanup background task every 5 minutes
    setInterval(async () => {
      try {
        await this.cleanupExpiredPendingBookings();
      } catch (err) {
        console.error('Error running expired bookings cleanup:', err);
      }
    }, 5 * 60 * 1000);
  }

  async cleanupExpiredPendingBookings(): Promise<void> {
    const cutoff = new Date(Date.now() - SYSTEM_POLICIES.BOOKING_HOLD_TIMEOUT_MS);

    const expiredBookings = await this.bookingModel.find({
      status: BookingStatus.PendingPayment,
      createdAt: { $lt: cutoff },
    });

    if (expiredBookings.length === 0) return;

    const bookingIds = expiredBookings.map((b) => b._id);

    await this.bookingModel.updateMany(
      { _id: { $in: bookingIds } },
      {
        $set: { status: BookingStatus.Cancelled },
        $push: {
          statusTimeline: {
            status: BookingStatus.Cancelled,
            changedAt: new Date(),
            note: 'Tự động hủy đơn hàng do quá hạn thanh toán (30 phút)',
          },
        },
      },
    );

    await this.bookingScheduleModel.updateMany(
      { bookingId: { $in: bookingIds } },
      { $set: { status: BookingScheduleStatus.Cancelled } },
    );

    await this.inventoryReservationModel.updateMany(
      { bookingId: { $in: bookingIds } },
      { $set: { status: ReservationStatus.Cancelled } },
    );
  }

  // Getter để map photographyPackageModel sang photoPackageModel cho cả hai bên
  private get photographyPackageModel() {
    return this.photoPackageModel;
  }

  private normalizeColor(colorStr?: string | null): string {
    if (!colorStr) return 'WHITE';
    const norm = colorStr.trim().toUpperCase();
    if (norm === 'ĐỎ' || norm === 'RED') return 'RED';
    if (norm === 'TRẮNG' || norm === 'WHITE') return 'WHITE';
    if (norm === 'VÀNG' || norm === 'GOLD') return 'GOLD';
    if (norm === 'ĐEN' || norm === 'BLACK') return 'BLACK';
    return norm;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UC-E06: rescheduleBooking — đổi lịch booking (áo dài hoặc chụp ảnh)
  // Rules:
  //   1. Booking phải ở trạng thái CONFIRMED hoặc DEPOSIT_PAID
  //   2. Chỉ được đổi trước giờ bắt đầu ít nhất 24 tiếng
  //   3. Khung lịch mới phải trống (không trùng reservation khác)
  // ──────────────────────────────────────────────────────────────────────────
  async rescheduleBooking(
    bookingId: string,
    userId: string,
    dto: {
      itemId: string;
      newRentalFrom?: string;
      newRentalTo?: string;
      newShootDate?: string;
      newShootTimeSlot?: string;
      reason?: string;
    },
  ): Promise<Record<string, any>> {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng');

    // Only customer who owns the booking can reschedule
    if (booking.customerId.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền đổi lịch đơn hàng này');
    }

    // Only allowed in CONFIRMED or DEPOSIT_PAID status
    const allowedStatuses = [BookingStatus.Confirmed, BookingStatus.DepositPaid];
    if (!allowedStatuses.includes(booking.status as BookingStatus)) {
      throw new BadRequestException(
        `Chỉ có thể đổi lịch khi đơn ở trạng thái Đã xác nhận hoặc Đã cọc. Trạng thái hiện tại: ${booking.status}`,
      );
    }

    // Find the booking item to reschedule
    const bookingItem = await this.bookingItemModel.findOne({
      _id: new Types.ObjectId(dto.itemId),
      bookingId: new Types.ObjectId(bookingId),
    });
    if (!bookingItem) throw new NotFoundException('Không tìm thấy mục đặt lịch');

    // Must reschedule at least 24h before current start
    const itemType = (bookingItem as any).itemType;
    let currentStart: Date | null = null;
    if (itemType === 'PRODUCT') {
      currentStart = (bookingItem as any).rentalFrom || null;
    } else {
      currentStart = (bookingItem as any).shootDate ? new Date((bookingItem as any).shootDate) : null;
    }

    if (currentStart) {
      const hoursDiff = (currentStart.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursDiff < 24) {
        throw new BadRequestException(
          'Chỉ có thể đổi lịch trước giờ bắt đầu ít nhất 24 tiếng',
        );
      }
    }

    // Validate new dates
    const todayStr = new Date().toISOString().split('T')[0];

    if (itemType === 'PRODUCT') {
      if (!dto.newRentalFrom || !dto.newRentalTo) {
        throw new BadRequestException('Yêu cầu ngày nhận và ngày trả mới');
      }
      if (dto.newRentalFrom < todayStr) {
        throw new BadRequestException('Ngày nhận mới không thể nằm trong quá khứ');
      }
      if (dto.newRentalTo < dto.newRentalFrom) {
        throw new BadRequestException('Ngày trả phải sau hoặc bằng ngày nhận');
      }

      // Check for conflicts on the inventory reservation
      const existingReservation = await this.inventoryReservationModel.findOne({
        bookingId: new Types.ObjectId(bookingId),
        bookingItemId: new Types.ObjectId(dto.itemId),
        status: { $in: [ReservationStatus.Confirmed, ReservationStatus.TempReserved] },
      } as any);

      if (existingReservation) {
        // Check if any OTHER reservation conflicts with new dates for same inventory item
        const newFrom = new Date(dto.newRentalFrom);
        newFrom.setHours(0, 0, 0, 0);
        const newTo = new Date(dto.newRentalTo);
        newTo.setHours(23, 59, 59, 999);

        const conflict = await this.inventoryReservationModel.findOne({
          inventoryItemId: (existingReservation as any).inventoryItemId,
          _id: { $ne: (existingReservation as any)._id },
          status: { $in: [ReservationStatus.Confirmed, ReservationStatus.TempReserved] },
          $or: [
            { reservedFrom: { $lte: newTo }, reservedTo: { $gte: newFrom } },
          ],
        } as any);

        if (conflict) {
          throw new BadRequestException(
            `Sản phẩm đã được đặt lịch trong khoảng thời gian này. Vui lòng chọn ngày khác.`,
          );
        }

        // Update the reservation dates
        await this.inventoryReservationModel.updateOne(
          { _id: (existingReservation as any)._id } as any,
          { reservedFrom: newFrom, reservedTo: newTo } as any,
        );
      }

      // Update booking item dates
      await this.bookingItemModel.updateOne(
        { _id: new Types.ObjectId(dto.itemId) },
        {
          rentalFrom: new Date(dto.newRentalFrom),
          rentalTo: new Date(dto.newRentalTo),
          startDate: dto.newRentalFrom,
          endDate: dto.newRentalTo,
        },
      );

      // Update or create booking schedule
      await this.bookingScheduleModel.updateMany(
        {
          bookingId: new Types.ObjectId(bookingId),
          bookingItemId: new Types.ObjectId(dto.itemId),
          status: BookingScheduleStatus.Scheduled,
        } as any,
        { status: BookingScheduleStatus.Rescheduled } as any,
      );

    } else if (itemType === 'PHOTOGRAPHY_PACKAGE') {
      if (!dto.newShootDate) {
        throw new BadRequestException('Yêu cầu ngày chụp mới');
      }
      if (dto.newShootDate < todayStr) {
        throw new BadRequestException('Ngày chụp mới không thể nằm trong quá khứ');
      }

      // Check photographer availability using existing busy schedules logic
      const photographerId = (bookingItem as any).photographerId?.toString();
      if (photographerId) {
        const busySchedules = await this.getBusySchedulesForProvider(photographerId);
        const isSlotConflict = dto.newShootTimeSlot &&
          busySchedules.bookedSlots.some((slot: any) =>
            slot.date === dto.newShootDate &&
            slot.timeSlot &&
            this.isTimeSlotOverlap(slot.timeSlot, dto.newShootTimeSlot!) &&
            slot.bookingItemId !== dto.itemId,
          );

        if (isSlotConflict) {
          throw new BadRequestException(
            `Thợ ảnh đã có lịch vào ngày ${dto.newShootDate} khung giờ ${dto.newShootTimeSlot}`,
          );
        }
      }

      // Update booking item
      await this.bookingItemModel.updateOne(
        { _id: new Types.ObjectId(dto.itemId) },
        {
          shootDate: dto.newShootDate,
          ...(dto.newShootTimeSlot ? { shootTimeSlot: dto.newShootTimeSlot } : {}),
        },
      );

      await this.bookingScheduleModel.updateMany(
        {
          bookingId: new Types.ObjectId(bookingId),
          bookingItemId: new Types.ObjectId(dto.itemId),
          status: BookingScheduleStatus.Scheduled,
        } as any,
        { status: BookingScheduleStatus.Rescheduled } as any,
      );
    }

    // Send notification (best effort)
    try {
      await this.notificationsService.createNotification(
        booking.customerId.toString(),
        'Đổi lịch thành công',
        `Đơn hàng ${booking.bookingCode} đã được đổi lịch thành công.`,
        NotificationType.Booking,
        { bookingId: booking._id },
      );
    } catch (_e) { /* ignore notification error */ }

    return { message: 'Đổi lịch thành công', bookingId };
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

    // Khởi tạo subTotal bằng 50.000đ phí dịch vụ Heritage nếu có item
    let subTotal = dto.items.length > 0 ? 50000 : 0;
    const itemDetails: Array<Partial<BookingItem>> = [];
    const providerIdsSet = new Set<string>();
    const reservationsCreated: any[] = [];
    let booking: any = null;

    // Chặn đặt lịch trong quá khứ ở backend
    const todayStr = new Date().toISOString().split('T')[0];
    for (const item of dto.items) {
      if (item.rentalFrom) {
        const itemDateStr = new Date(item.rentalFrom).toISOString().split('T')[0];
        if (itemDateStr < todayStr) {
          throw new BadRequestException('Ngày bắt đầu thuê áo dài không thể nằm trong quá khứ.');
        }
      }
      if (item.shootDate) {
        const itemDateStr = new Date(item.shootDate).toISOString().split('T')[0];
        if (itemDateStr < todayStr) {
          throw new BadRequestException('Ngày đặt lịch chụp ảnh không thể nằm trong quá khứ.');
        }
      }
    }

    try {
      for (const item of dto.items) {
        let unitPrice = 0;
        let depositAmount = 0;
        let providerId: Types.ObjectId | null = null;
        let itemType: BookingItemType;
        let inventoryItemId: Types.ObjectId | null = null;

        if (item.productId) {
          const product = await this.productModel.findById(item.productId);
          if (!product) {
            throw new NotFoundException(`Product not found: ${item.productId}`);
          }
          providerId = product.providerId;
          itemType = BookingItemType.Product;
          depositAmount = product.depositAmount;

          const rType = item.rentalType === 'HOURLY' ? 'HOURLY' : 'DAILY';
          if (rType === 'HOURLY') {
            const hourlyRate = product.hourlyPrice || Math.round(product.basePrice * 0.3) || 80000;
            let durationHours = 2;
            if (item.shootTimeSlot) {
              const parts = item.shootTimeSlot.split('-');
              const startSlot = parts[0]?.trim();
              const endSlot = parts[1]?.trim();
              if (startSlot && endSlot) {
                const [sh, sm] = startSlot.split(':').map(Number);
                const [eh, em] = endSlot.split(':').map(Number);
                const sDate = new Date();
                sDate.setHours(sh, sm, 0, 0);
                const eDate = new Date();
                eDate.setHours(eh, em, 0, 0);
                durationHours = Math.max((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60), 2);
              }
            }
            unitPrice = hourlyRate * durationHours;
          } else {
            let durationDays = 1;
            if (item.rentalFrom && item.rentalTo) {
              const start = new Date(item.rentalFrom);
              const end = new Date(item.rentalTo);
              if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                const diffTime = Math.abs(end.getTime() - start.getTime());
                durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
              }
            }
            unitPrice = product.basePrice * durationDays;
          }

          if (item.rentalFrom && item.rentalTo) {
            const reservedFrom = new Date(item.rentalFrom);
            reservedFrom.setHours(0, 0, 0, 0);
            const reservedTo = new Date(item.rentalTo);
            reservedTo.setHours(23, 59, 59, 999);

            const sizeVal = item.selectedSize ? item.selectedSize.toUpperCase() : 'M';
            const colorVal = this.normalizeColor(item.selectedColor);

            // Validate that product supports the requested size and color
            if (product.sizes && product.sizes.length > 0) {
              const isSizeSupported = product.sizes.some(s => s.trim().toUpperCase() === sizeVal);
              if (!isSizeSupported) {
                throw new BadRequestException(`Kích cỡ ${item.selectedSize || 'M'} không khả dụng cho sản phẩm ${product.name}. Các kích cỡ khả dụng: ${product.sizes.join(', ')}`);
              }
            }
            if (product.colors && product.colors.length > 0) {
              const isColorSupported = product.colors.some(c => this.normalizeColor(c) === colorVal);
              if (!isColorSupported) {
                throw new BadRequestException(`Màu sắc ${item.selectedColor || 'WHITE'} không khả dụng cho sản phẩm ${product.name}. Các màu khả dụng: ${product.colors.join(', ')}`);
              }
            }

            let inventoryItems = await this.inventoryItemModel.find({
              productId: new Types.ObjectId(item.productId),
              size: sizeVal,
              color: colorVal,
              status: 'AVAILABLE',
              conditionStatus: { $nin: ['LOCKED', 'RETIRED'] },
            } as any);

            if (inventoryItems.length === 0) {
              // Tự động tạo sản phẩm trong kho nếu chưa có sẵn để tránh lỗi "Không sẵn sàng trong kho"
              const sku = `AD-${item.productId.toString().slice(-6)}-${sizeVal}-${colorVal}-${Math.floor(100 + Math.random() * 900)}`.toUpperCase();
              const newItem = await this.inventoryItemModel.create({
                productId: new Types.ObjectId(item.productId),
                sku,
                size: sizeVal,
                color: colorVal,
                conditionStatus: 'GOOD' as any,
                status: 'AVAILABLE' as any,
              });
              inventoryItems = [newItem];
            }

            const conflictingReservations = await this.inventoryReservationModel.find({
              inventoryItemId: { $in: inventoryItems.map((i) => i._id) },
              status: {
                $in: [
                  ReservationStatus.TempReserved,
                  ReservationStatus.Confirmed,
                ],
              },
              reservedFrom: { $lte: reservedTo },
              reservedTo: { $gte: reservedFrom },
            });

            const busyInventoryItemIds = new Set(
              conflictingReservations.map((res) => res.inventoryItemId.toString()),
            );

            const availableItem = inventoryItems.find(
              (i) => !busyInventoryItemIds.has(i._id.toString()),
            );

            if (!availableItem) {
              throw new BadRequestException(
                `Sản phẩm đã được đặt kín lịch trong khoảng thời gian này`,
              );
            }

            // Post-Insert Conflict Check
            const itemReservation = await this.inventoryReservationModel.create({
              inventoryItemId: availableItem._id,
              bookingId: new Types.ObjectId(),
              bookingItemId: new Types.ObjectId(),
              reservedFrom,
              reservedTo,
              status: ReservationStatus.TempReserved,
              expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            });

            const allOverlapping = await this.inventoryReservationModel
              .find({
                inventoryItemId: availableItem._id,
                status: {
                  $in: [
                    ReservationStatus.TempReserved,
                    ReservationStatus.Confirmed,
                  ],
                },
                reservedFrom: { $lte: reservedTo },
                reservedTo: { $gte: reservedFrom },
              })
              .sort({ _id: 1 });

            if (allOverlapping.length > 1) {
              const winner = allOverlapping[0];
              if (winner._id.toString() !== itemReservation._id.toString()) {
                await this.inventoryReservationModel.deleteOne({
                  _id: itemReservation._id,
                });
                throw new BadRequestException(
                  `Sản phẩm vừa bị người khác nhanh tay đặt trước. Vui lòng thử lại!`,
                );
              }
            }

            inventoryItemId = availableItem._id as Types.ObjectId;
            reservationsCreated.push(itemReservation);
          }
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
          depositAmount = 0;
          providerId = pkg.providerId;
          itemType = BookingItemType.PhotographyPackage;
        } else {
          throw new BadRequestException(
            'Each item must contain either productId or photographyPackageId',
          );
        }

        let providerInfo = null;
        if (providerId) {
          providerIdsSet.add(providerId.toString());
          providerInfo = await this.providerModel.findById(providerId);
          if (!providerInfo || providerInfo.status !== 'ACTIVE') {
            throw new BadRequestException(
              'Cửa hàng đối tác hoặc nhiếp ảnh gia hiện không hoạt động hoặc đang bị tạm đình chỉ.',
            );
          }
        }

        const quantity = item.quantity || 1;
        subTotal += unitPrice * quantity;

        const comboDiscountPercent = (dto.bookingType === BookingType.Combo && providerInfo)
          ? (providerInfo.comboDiscountPercent !== undefined ? providerInfo.comboDiscountPercent : 10)
          : 0;
        const comboDiscountAmount = Math.round(unitPrice * quantity * (comboDiscountPercent / 100));

        itemDetails.push({
          providerId,
          itemType,
          productId: item.productId ? new Types.ObjectId(item.productId) : null,
          inventoryItemId,
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
          referenceImage: item.referenceImage || null,
          selectedSize: item.selectedSize || null,
          selectedColor: item.selectedColor || null,
          rentalType: (item.rentalType === 'HOURLY' ? 'HOURLY' : 'DAILY') as 'DAILY' | 'HOURLY',
          comboDiscountPercent,
          comboDiscountAmount,
        });
      }

      // Validate busy schedules for each item before booking to prevent double bookings
      for (const detail of itemDetails) {
        if (detail.itemType === BookingItemType.Product && detail.productId) {
          if (detail.rentalType === 'DAILY' && detail.rentalFrom && detail.rentalTo) {
            const busySchedules = await this.getBusySchedulesForProduct(detail.productId.toString());
            const busyDatesSet = new Set(busySchedules.bookedDates);
            const start = new Date(detail.rentalFrom);
            const end = new Date(detail.rentalTo);
            const current = new Date(start);
            while (current <= end) {
              const dateStr = current.toISOString().split('T')[0];
              if (busyDatesSet.has(dateStr)) {
                throw new BadRequestException(`Sản phẩm đã được đặt lịch thuê vào ngày ${dateStr}. Vui lòng chọn thời gian khác.`);
              }
              current.setDate(current.getDate() + 1);
            }
          } else if (detail.rentalType === 'HOURLY' && detail.shootDate) {
            const busySchedules = await this.getBusySchedulesForProduct(detail.productId.toString());
            const dateStr = new Date(detail.shootDate).toISOString().split('T')[0];
            const isSlotConflict = detail.shootTimeSlot != null && busySchedules.bookedSlots.some(slot =>
              slot.date === dateStr && slot.timeSlot && this.isTimeSlotOverlap(slot.timeSlot, detail.shootTimeSlot!)
            );
            if (isSlotConflict) {
              throw new BadRequestException(`Sản phẩm đã được đặt thuê vào ngày ${dateStr} khung giờ ${detail.shootTimeSlot}. Vui lòng chọn khung giờ khác.`);
            }
          }
        } else if (detail.itemType === BookingItemType.PhotographyPackage && detail.photographyPackageId) {
          if (detail.shootDate && detail.providerId) {
            const busySchedules = await this.getBusySchedulesForProvider(detail.providerId.toString());
            const dateStr = new Date(detail.shootDate).toISOString().split('T')[0];
            const isSlotConflict = detail.shootTimeSlot != null && busySchedules.bookedSlots.some(slot =>
              slot.date === dateStr && slot.timeSlot && this.isTimeSlotOverlap(slot.timeSlot, detail.shootTimeSlot!)
            );
            if (isSlotConflict) {
              throw new BadRequestException(`Nhiếp ảnh gia đã có lịch chụp vào ngày ${dateStr} khung giờ ${detail.shootTimeSlot}. Vui lòng chọn khung giờ khác.`);
            }
          }
        }
      }

      // Kiểm tra chéo (Cross-validation) điều kiện Combo ở Backend
      if (dto.bookingType === BookingType.Combo) {
        const prodItem = itemDetails.find(item => item.itemType === BookingItemType.Product);
        const photoItem = itemDetails.find(item => item.itemType === BookingItemType.PhotographyPackage);

        if (!prodItem || !photoItem) {
          throw new BadRequestException('Đơn hàng Combo bắt buộc phải có cả sản phẩm áo dài và gói chụp ảnh.');
        }

        const prodProvider = await this.providerModel.findById(prodItem.providerId);
        const photoProvider = await this.providerModel.findById(photoItem.providerId);
        if (prodProvider && photoProvider) {
          const prodCity = prodProvider.address?.city || 'Thừa Thiên Huế';
          const photoCity = photoProvider.address?.city || 'Thừa Thiên Huế';
          
          const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^(thanh pho|tp\.?|tinh)\s+/i, '').replace(/\s+/g, ' ').trim();
          if (!normalize(prodCity).includes(normalize(photoCity)) && !normalize(photoCity).includes(normalize(prodCity))) {
            throw new BadRequestException(`Không thể đặt Combo lệch khu vực địa lý: Áo dài tại ${prodCity} nhưng thợ ảnh tại ${photoCity}.`);
          }
        }

        const rentalFrom = prodItem.rentalFrom;
        const rentalTo = prodItem.rentalTo;
        const shootDate = photoItem.shootDate;

        if (rentalFrom && rentalTo && shootDate) {
          const start = new Date(rentalFrom);
          start.setHours(0,0,0,0);
          const end = new Date(rentalTo);
          end.setHours(23,59,59,999);
          const shoot = new Date(shootDate);

          if (shoot < start || shoot > end) {
            throw new BadRequestException('Ngày chụp ảnh phải nằm trong khoảng thời gian thuê Áo dài.');
          }

          if (prodItem.rentalType === 'HOURLY' && prodItem.shootTimeSlot && photoItem.shootTimeSlot) {
            const [prodStartStr, prodEndStr] = prodItem.shootTimeSlot.split('-').map(s => s.trim());
            const [photoStartStr, photoEndStr] = photoItem.shootTimeSlot.split('-').map(s => s.trim());
            
            if (prodStartStr && prodEndStr && photoStartStr && photoEndStr) {
              if (photoStartStr < prodStartStr || photoEndStr > prodEndStr) {
                throw new BadRequestException(`Khung giờ chụp (${photoItem.shootTimeSlot}) phải nằm trong khung giờ thuê Áo dài (${prodItem.shootTimeSlot}).`);
              }
            }
          }
        }
      }

      const travelFee = dto.travelFee || 0;
      const comboDiscountTotal = itemDetails.reduce((sum, item) => sum + (item.comboDiscountAmount || 0), 0);
      let voucherDiscountTotal = 0;
      let promotionId: Types.ObjectId | null = null;

      const subTotalAfterCombo = Math.max(subTotal - comboDiscountTotal, 0);

      if (dto.promoCode) {
        try {
          const promotion = await this.promotionsService.validatePromotion(
            dto.promoCode,
            subTotalAfterCombo,
            Array.from(providerIdsSet),
          );
          promotionId = promotion._id;

          if (promotion.discountType === DiscountType.Percentage) {
            voucherDiscountTotal = Math.round(
              (subTotalAfterCombo * promotion.discountValue) / 100,
            );
            if (
              promotion.maxDiscountAmount &&
              voucherDiscountTotal > promotion.maxDiscountAmount
            ) {
              voucherDiscountTotal = promotion.maxDiscountAmount;
            }
          } else {
            voucherDiscountTotal = promotion.discountValue;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new BadRequestException(`Failed to apply coupon: ${msg}`);
        }
      }

      const discountAmount = comboDiscountTotal + voucherDiscountTotal;

      let depositTotal = 0;
      for (const item of itemDetails) {
        depositTotal += (item.depositAmount || 0) * (item.quantity || 1);
      }
      const serviceFee = 0;
      const grandTotal = Math.max(subTotal - discountAmount + travelFee, 0) + depositTotal;

      booking = (await this.bookingModel.create({
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
          comboDiscountTotal,
          voucherDiscountTotal,
          travelFee,
          overtimeFee: 0,
          lateFee: 0,
          damageFee: 0,
          serviceFee,
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
        const savedItem = await this.bookingItemModel.create({
          ...detail,
          bookingId: booking._id,
        });

        // Update corresponding reservation
        if (detail.inventoryItemId) {
          const matchedRes = reservationsCreated.find(
            (r) =>
              r.inventoryItemId.toString() === detail.inventoryItemId!.toString(),
          );
          if (matchedRes) {
            matchedRes.bookingId = booking._id;
            matchedRes.bookingItemId = savedItem._id;
            await matchedRes.save();
          }
        }

        // Create BookingSchedule entries for each multi-item booking
        if (detail.itemType === BookingItemType.Product) {
          if (detail.rentalType === 'DAILY' && detail.rentalFrom && detail.rentalTo) {
            const start = new Date(detail.rentalFrom);
            const end = new Date(detail.rentalTo);
            const current = new Date(start);
            while (current <= end) {
              await this.bookingScheduleModel.create({
                bookingId: booking._id,
                bookingItemId: savedItem._id,
                scheduleType: BookingScheduleType.RentalPeriod,
                scheduledDate: new Date(current),
                timeSlot: null,
                status: BookingScheduleStatus.Scheduled,
              });
              current.setDate(current.getDate() + 1);
            }
          } else if (detail.rentalType === 'HOURLY' && detail.shootDate) {
            await this.bookingScheduleModel.create({
              bookingId: booking._id,
              bookingItemId: savedItem._id,
              scheduleType: BookingScheduleType.RentalPeriod,
              scheduledDate: detail.shootDate,
              timeSlot: detail.shootTimeSlot,
              status: BookingScheduleStatus.Scheduled,
            });
          }
        } else if (detail.itemType === BookingItemType.PhotographyPackage) {
          if (detail.shootDate) {
            await this.bookingScheduleModel.create({
              bookingId: booking._id,
              bookingItemId: savedItem._id,
              scheduleType: BookingScheduleType.Photoshoot,
              scheduledDate: detail.shootDate,
              timeSlot: detail.shootTimeSlot,
              status: BookingScheduleStatus.Scheduled,
            });
          }
        }
      }

      if (promotionId) {
        await this.promotionsService.incrementUsage(promotionId);
      }

      try {
        await this.notificationsService.createNotification(
          customerId.toString(),
          `Đặt lịch thành công`,
          `Đơn đặt lịch ${bookingCode} đã được khởi tạo thành công và đang chờ thanh toán cọc.`,
          NotificationType.Booking,
          { bookingId: booking._id },
        );
      } catch (e) {
        console.error('Failed to create createBooking notification:', e);
      }

      return booking;
    } catch (err) {
      // Rollback
      for (const res of reservationsCreated) {
        await this.inventoryReservationModel.deleteOne({ _id: res._id });
      }
      if (booking && booking._id) {
        await this.bookingModel.deleteOne({ _id: booking._id });
        await this.bookingItemModel.deleteMany({ bookingId: booking._id });
      }
      throw err;
    }
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

    const provider = await this.providerModel.findById(product.providerId);
    if (!provider || provider.status !== 'ACTIVE') {
      throw new BadRequestException('Cửa hàng đối tác hiện không hoạt động hoặc đang bị tạm đình chỉ.');
    }

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Định dạng ngày bắt đầu không hợp lệ');
    }

    // Chặn đặt lịch trong quá khứ ở backend
    const todayStr = new Date().toISOString().split('T')[0];
    const startDateStr = start.toISOString().split('T')[0];
    if (startDateStr < todayStr) {
      throw new BadRequestException('Ngày bắt đầu đặt lịch thuê không thể nằm trong quá khứ.');
    }

    let subTotal = 0;
    let unitPrice = product.basePrice;
    let rentalFrom: Date | null = null;
    let rentalTo: Date | null = null;
    let shootDate: Date | null = null;
    let shootTimeSlot: string | null = null;
    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;

    if (rentalType === 'HOURLY') {
      if (!startTime || !endTime) {
        throw new BadRequestException(
          'Yêu cầu giờ bắt đầu và giờ kết thúc khi thuê theo giờ',
        );
      }
      const hourlyRate = product.hourlyPrice || Math.round(product.basePrice * 0.3) || 80000;

      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);

      startDateTime = new Date(start);
      startDateTime.setHours(sh, sm, 0, 0);
      endDateTime = new Date(start);
      endDateTime.setHours(eh, em, 0, 0);

      const durationHours =
        (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);

      if (durationHours < 2) {
        throw new BadRequestException('Thời gian thuê tối thiểu là 2 tiếng');
      }

      unitPrice = hourlyRate;
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
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      unitPrice = product.basePrice;
      subTotal = unitPrice * durationDays * quantity;
      rentalFrom = start;
      rentalTo = end;
    }

    // Validate busy schedules before creating booking to prevent double bookings
    if (rentalType === 'DAILY' && rentalFrom && rentalTo) {
      const busySchedules = await this.getBusySchedulesForProduct(productId);
      const busyDatesSet = new Set(busySchedules.bookedDates);
      const start = new Date(rentalFrom);
      const end = new Date(rentalTo);
      const current = new Date(start);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        if (busyDatesSet.has(dateStr)) {
          throw new BadRequestException(`Sản phẩm đã được đặt lịch thuê vào ngày ${dateStr}. Vui lòng chọn thời gian khác.`);
        }
        current.setDate(current.getDate() + 1);
      }
    } else if (rentalType === 'HOURLY' && shootDate) {
      const busySchedules = await this.getBusySchedulesForProduct(productId);
      const dateStr = new Date(shootDate).toISOString().split('T')[0];
      const isSlotConflict = shootTimeSlot != null && busySchedules.bookedSlots.some(slot =>
        slot.date === dateStr && slot.timeSlot && this.isTimeSlotOverlap(slot.timeSlot, shootTimeSlot!)
      );
      if (isSlotConflict) {
        throw new BadRequestException(`Sản phẩm đã được đặt thuê vào ngày ${dateStr} khung giờ ${shootTimeSlot}. Vui lòng chọn khung giờ khác.`);
      }
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
    const reservedFrom = rentalFrom ? new Date(rentalFrom) : new Date(startDateTime!);
    const reservedTo = rentalTo ? new Date(rentalTo) : new Date(endDateTime!);
    if (rentalType === 'DAILY') {
      reservedFrom.setHours(0, 0, 0, 0);
      reservedTo.setHours(23, 59, 59, 999);
    }

    let reservation: any = null;
    let savedBooking: any = null;
    let savedBookingItem: any = null;

    try {
      const sizeVal = size.toUpperCase();
      const colorVal = this.normalizeColor(color);

      // Validate that product supports the requested size and color
      if (product.sizes && product.sizes.length > 0) {
        const isSizeSupported = product.sizes.some(s => s.trim().toUpperCase() === sizeVal);
        if (!isSizeSupported) {
          throw new BadRequestException(`Kích cỡ ${size} không khả dụng cho sản phẩm này. Các kích cỡ khả dụng: ${product.sizes.join(', ')}`);
        }
      }
      if (product.colors && product.colors.length > 0) {
        const isColorSupported = product.colors.some(c => this.normalizeColor(c) === colorVal);
        if (!isColorSupported) {
          throw new BadRequestException(`Màu sắc ${color} không khả dụng cho sản phẩm này. Các màu khả dụng: ${product.colors.join(', ')}`);
        }
      }

      let inventoryItems = await this.inventoryItemModel.find({
        productId: product._id,
        size: sizeVal,
        color: colorVal,
        status: 'AVAILABLE',
        conditionStatus: { $nin: ['LOCKED', 'RETIRED'] },
      } as any);

      if (inventoryItems.length === 0) {
        // Tự động tạo sản phẩm trong kho nếu chưa có sẵn để tránh lỗi "Không sẵn sàng trong kho"
        const sku = `AD-${product._id.toString().slice(-6)}-${sizeVal}-${colorVal}-${Math.floor(100 + Math.random() * 900)}`.toUpperCase();
        const newItem = await this.inventoryItemModel.create({
          productId: product._id,
          sku,
          size: sizeVal,
          color: colorVal,
          conditionStatus: 'GOOD' as any,
          status: 'AVAILABLE' as any,
        });
        inventoryItems = [newItem];
      }

      const conflictingReservations = await this.inventoryReservationModel.find({
        inventoryItemId: { $in: inventoryItems.map((item) => item._id) },
        status: {
          $in: [
            ReservationStatus.TempReserved,
            ReservationStatus.Confirmed,
          ],
        },
        reservedFrom: { $lte: reservedTo },
        reservedTo: { $gte: reservedFrom },
      });

      const busyInventoryItemIds = new Set(
        conflictingReservations.map((res) => res.inventoryItemId.toString()),
      );

      const availableItem = inventoryItems.find(
        (item) => !busyInventoryItemIds.has(item._id.toString()),
      );

      if (!availableItem) {
        throw new BadRequestException(
          'Sản phẩm đã được đặt kín lịch trong khoảng thời gian này',
        );
      }

      // Post-Insert Conflict Check
      reservation = await this.inventoryReservationModel.create({
        inventoryItemId: availableItem._id,
        bookingId: new Types.ObjectId(),
        bookingItemId: new Types.ObjectId(),
        reservedFrom,
        reservedTo,
        status: ReservationStatus.TempReserved,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      const allOverlapping = await this.inventoryReservationModel
        .find({
          inventoryItemId: availableItem._id,
          status: {
            $in: [
              ReservationStatus.TempReserved,
              ReservationStatus.Confirmed,
            ],
          },
          reservedFrom: { $lte: reservedTo },
          reservedTo: { $gte: reservedFrom },
        })
        .sort({ _id: 1 });

      if (allOverlapping.length > 1) {
        const winner = allOverlapping[0];
        if (winner._id.toString() !== reservation._id.toString()) {
          await this.inventoryReservationModel.deleteOne({ _id: reservation._id });
          throw new BadRequestException(
            'Sản phẩm vừa bị người khác nhanh tay đặt trước. Vui lòng thử lại!',
          );
        }
      }

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

      savedBooking = await booking.save();

      const bookingItem = new this.bookingItemModel({
        bookingId: savedBooking._id,
        providerId: product.providerId,
        itemType: BookingItemType.Product,
        productId: product._id,
        inventoryItemId: availableItem._id,
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

      savedBookingItem = await bookingItem.save();

      // Update reservation with actual ids
      reservation.bookingId = savedBooking._id;
      reservation.bookingItemId = savedBookingItem._id;
      await reservation.save();

      // Create BookingSchedule entries
      if (rentalType === 'DAILY' && rentalFrom && rentalTo) {
        const startDay = new Date(rentalFrom);
        const endDay = new Date(rentalTo);
        const current = new Date(startDay);
        while (current <= endDay) {
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
    } catch (error) {
      // Rollback
      if (reservation && reservation._id) {
        await this.inventoryReservationModel.deleteOne({ _id: reservation._id });
      }
      if (savedBookingItem && savedBookingItem._id) {
        await this.bookingItemModel.deleteOne({ _id: savedBookingItem._id });
      }
      if (savedBooking && savedBooking._id) {
        await this.bookingModel.deleteOne({ _id: savedBooking._id });
        await this.bookingScheduleModel.deleteMany({ bookingId: savedBooking._id });
      }
      throw error;
    }
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

    const provider = await this.providerModel.findById(pkg.providerId);
    if (!provider || provider.status !== 'ACTIVE') {
      throw new BadRequestException('Nhiếp ảnh gia hiện không hoạt động hoặc đang bị tạm đình chỉ.');
    }

    const date = new Date(shootDate);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Định dạng ngày chụp không hợp lệ');
    }

    // Chặn đặt lịch chụp ảnh trong quá khứ ở backend
    const todayStr = new Date().toISOString().split('T')[0];
    const shootDateStr = date.toISOString().split('T')[0];
    if (shootDateStr < todayStr) {
      throw new BadRequestException('Ngày đặt lịch chụp ảnh không thể nằm trong quá khứ.');
    }

    // Kiểm tra trùng lịch chụp (chỉ đếm active bookings)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const activeBookings = await this.bookingModel.find({
      providerIds: pkg.providerId,
      status: { 
        $nin: [
          BookingStatus.Cancelled, 
          BookingStatus.Completed, 
          BookingStatus.Returned,
          BookingStatus.Refunded
        ] 
      },
    }).select('_id');
    const activeBookingIds = activeBookings.map((b) => b._id);

    const isSlotBusy = await this.bookingItemModel.findOne({
      bookingId: { $in: activeBookingIds },
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
    const depositTotal = Math.round(pkg.price * 0.3);
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

    let savedBooking: any = null;
    let savedBookingItem: any = null;

    try {
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

      savedBooking = await booking.save();

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

      savedBookingItem = await bookingItem.save();

      // Post-Insert Conflict Check for Photographer Concurrency
      const activeBookingIdsWithNew = [...activeBookingIds, savedBooking._id];
      const allOverlapping = await this.bookingItemModel
        .find({
          bookingId: { $in: activeBookingIdsWithNew },
          providerId: pkg.providerId,
          itemType: BookingItemType.PhotographyPackage,
          shootDate: { $gte: startOfDay, $lte: endOfDay },
          shootTimeSlot,
        })
        .sort({ _id: 1 });

      if (allOverlapping.length > 1) {
        const winner = allOverlapping[0];
        if (winner._id.toString() !== savedBookingItem._id.toString()) {
          await this.bookingItemModel.deleteOne({ _id: savedBookingItem._id });
          await this.bookingModel.deleteOne({ _id: savedBooking._id });
          throw new BadRequestException(
            'Nhiếp ảnh gia vừa nhận lịch chụp từ một khách hàng khác. Vui lòng chọn khung giờ hoặc ngày khác.',
          );
        }
      }

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
    } catch (err) {
      if (savedBookingItem && savedBookingItem._id) {
        await this.bookingItemModel.deleteOne({ _id: savedBookingItem._id });
      }
      if (savedBooking && savedBooking._id) {
        await this.bookingModel.deleteOne({ _id: savedBooking._id });
        await this.bookingScheduleModel.deleteMany({ bookingId: savedBooking._id });
      }
      throw err;
    }
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
      })
        .populate('productId')
        .populate('photographyPackageId');
      results.push({ ...booking.toObject(), items });
    }
    return results;
  }

  async getBookingById(bookingIdStr: string, userId?: string, roles?: string[]): Promise<Record<string, any>> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId)
      .populate('customerId');
    if (!booking) throw new NotFoundException('Booking not found');

    if (userId) {
      const isAdmin = roles?.includes('ADMIN') || roles?.includes('admin');
      // customerId has been populated into a User object, so extract _id safely
      const customerIdRaw = (booking.customerId as any)?._id || booking.customerId;
      const isCustomer = customerIdRaw.toString() === userId;
      
      const userProviders = await this.providerModel.find({ userId: new Types.ObjectId(userId) });
      const userProviderIds = userProviders.map(p => p._id.toString());
      const isProvider = booking.providerIds.some(id => userProviderIds.includes(id.toString()));

      if (!isAdmin && !isCustomer && !isProvider) {
        throw new ForbiddenException('Bạn không có quyền xem thông tin đơn hàng này.');
      }
    }

    const items = await this.bookingItemModel.find({ bookingId })
      .populate('productId')
      .populate('photographyPackageId');

    const bookingObj = booking.toObject();
    const customerUser = booking.customerId as any;

    return {
      ...bookingObj,
      customerName: customerUser?.profile?.fullName || '',
      customerPhone: customerUser?.auth?.phone || '',
      customerEmail: customerUser?.auth?.email || '',
      items
    };
  }

  /** Hoàn thành đơn → trigger đối soát chia tiền (PaymentsService.settleBooking) */
  async completeBooking(bookingIdStr: string, userId?: string, roles?: string[]): Promise<BookingDocument> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    if (userId) {
      const isAdmin = roles?.includes('ADMIN') || roles?.includes('admin');
      const isCustomer = booking.customerId.toString() === userId;
      
      let isProvider = false;
      if (roles?.includes('PROVIDER')) {
        const provider = await this.providerModel.findOne({ userId: new Types.ObjectId(userId) });
        if (provider) {
          isProvider = booking.providerIds.some(
            (pid) => pid.toString() === provider._id.toString()
          );
        }
      }

      if (!isAdmin && !isCustomer && !isProvider) {
        throw new ForbiddenException('Chỉ khách hàng, Nhà cung cấp của đơn hàng hoặc Admin mới có quyền xác nhận hoàn thành đơn hàng.');
      }
    }

    if (booking.status === BookingStatus.Completed) return booking;

    booking.status = BookingStatus.Completed;
    booking.statusTimeline.push({
      status: BookingStatus.Completed,
      changedAt: new Date(),
      note: 'Đơn hàng hoàn thành. Tiến hành đối soát trực tiếp.',
    });

    await booking.save();

    try {
      await this.notificationsService.createNotification(
        booking.customerId.toString(),
        `Đơn hàng hoàn thành`,
        `Đơn hàng ${booking.bookingCode} của bạn đã được đánh dấu hoàn thành. Cảm ơn bạn!`,
        NotificationType.Booking,
        { bookingId: booking._id },
      );
      await this.notificationsService.createNotification(
        booking.customerId.toString(),
        `Yêu cầu đánh giá dịch vụ`,
        `Đơn hàng ${booking.bookingCode} đã hoàn thành. Hãy chia sẻ trải nghiệm của bạn bằng cách để lại đánh giá nhé!`,
        NotificationType.System,
        { bookingId: booking._id, action: 'REVIEW' },
      );
    } catch (e) {
      console.error('Failed to create completeBooking notifications:', e);
    }

    await this.paymentsService.settleBooking(bookingIdStr);

    return booking;
  }

  /** Provider cập nhật trạng thái đơn hàng (CONFIRMED, PICKUP_PENDING, PICKED_UP, v.v.) */
  async updateBookingStatus(
    bookingIdStr: string,
    newStatus: string,
    note?: string,
    userId?: string,
    roles?: string[],
  ): Promise<BookingDocument> {
    const booking = await this.bookingModel.findById(bookingIdStr);
    if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng');

    if (userId) {
      const isAdmin = roles?.includes('ADMIN') || roles?.includes('admin');
      
      const userProviders = await this.providerModel.find({ userId: new Types.ObjectId(userId) });
      const userProviderIds = userProviders.map(p => p._id.toString());
      const isProvider = booking.providerIds.some(id => userProviderIds.includes(id.toString()));

      if (!isAdmin && !isProvider) {
        throw new ForbiddenException('Chỉ nhà cung cấp hoặc Admin mới có quyền cập nhật trạng thái đơn hàng này.');
      }
    }

    // Nếu chuyển sang COMPLETED → dùng completeBooking để trigger settlement
    if (newStatus === BookingStatus.Completed) {
      return this.completeBooking(bookingIdStr, userId, roles);
    }

    // Nếu chuyển sang CANCELLED → dùng cancelBooking để trigger refund
    if (newStatus === BookingStatus.Cancelled) {
      return this.cancelBooking(bookingIdStr, userId || 'provider', roles || [], note || 'Provider hủy đơn');
    }

    const currentStatus = booking.status;
    const nextStatus = newStatus as BookingStatus;

    if (currentStatus === nextStatus) return booking;

    // Không cho phép thay đổi khi đơn hàng đã ở trạng thái cuối cùng
    const finalStatuses = [BookingStatus.Completed, BookingStatus.Cancelled, BookingStatus.Refunded];
    if (finalStatuses.includes(currentStatus)) {
      throw new BadRequestException(`Không thể thay đổi trạng thái đơn hàng khi đã ở trạng thái cuối: ${currentStatus}`);
    }

    // Định nghĩa các chuyển đổi trạng thái hợp lệ
    const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.Draft]: [BookingStatus.PendingPayment, BookingStatus.Cancelled],
      [BookingStatus.PendingPayment]: [BookingStatus.Confirmed, BookingStatus.DepositPaid, BookingStatus.Cancelled],
      [BookingStatus.DepositPaid]: [BookingStatus.Confirmed, BookingStatus.PickupPending, BookingStatus.Cancelled],
      [BookingStatus.Confirmed]: [BookingStatus.PickupPending, BookingStatus.Cancelled],
      [BookingStatus.PickupPending]: [BookingStatus.PickedUp, BookingStatus.Cancelled],
      [BookingStatus.PickedUp]: [BookingStatus.ReturnPending, BookingStatus.Disputed],
      [BookingStatus.ReturnPending]: [BookingStatus.Returned, BookingStatus.Disputed],
      [BookingStatus.Returned]: [BookingStatus.Completed, BookingStatus.Disputed],
      [BookingStatus.Disputed]: [BookingStatus.Completed, BookingStatus.Refunded, BookingStatus.PartiallyRefunded],
      [BookingStatus.Completed]: [],
      [BookingStatus.Cancelled]: [],
      [BookingStatus.Refunded]: [],
      [BookingStatus.PartiallyRefunded]: [BookingStatus.Completed],
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Không được phép chuyển trạng thái đơn hàng từ ${currentStatus} sang ${nextStatus}`);
    }

    booking.status = nextStatus;
    booking.statusTimeline.push({
      status: newStatus as BookingStatus,
      changedAt: new Date(),
      note: note || `Cập nhật trạng thái bởi nhà cung cấp`,
    });

    await booking.save();

    try {
      await this.notificationsService.createNotification(
        booking.customerId.toString(),
        `Cập nhật trạng thái đơn hàng`,
        `Đơn hàng ${booking.bookingCode} của bạn đã chuyển sang trạng thái: ${newStatus}`,
        NotificationType.Booking,
        { bookingId: booking._id },
      );
    } catch (e) {
      console.error('Failed to create updateBookingStatus notification:', e);
    }

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
    
    // Tìm các provider ứng với userId này để so sánh Provider ID thật sự
    const userProviders = userId ? await this.providerModel.find({ userId: new Types.ObjectId(userId) }) : [];
    const userProviderIds = userProviders.map(p => p._id.toString());
    const isProvider = booking.providerIds.some(id => userProviderIds.includes(id.toString()));
    
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

        if (diffInHours >= SYSTEM_POLICIES.FREE_CANCEL_LIMIT_HOURS) {
          isFreeCancel = true;
        } else {
          // Kiểm tra xem đơn hàng có được tạo trong vòng 72 giờ trước giờ bắt đầu hay không (last-minute booking)
          const createdAtDate = new Date((booking as any).createdAt || now);
          const startMinusCreatedHours = (earliestStartTime.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60);
          if (startMinusCreatedHours < SYSTEM_POLICIES.FREE_CANCEL_LIMIT_HOURS) {
            const minsSinceCreation = (now.getTime() - createdAtDate.getTime()) / (1000 * 60);
            if (diffInHours >= 2) {
              // Hạn ân hạn là 60 phút
              if (minsSinceCreation <= SYSTEM_POLICIES.LAST_MIN_GRACE_MINUTES) {
                isFreeCancel = true;
              } else {
                isFreeCancel = false;
                penaltyReason = `Đã quá thời gian ân hạn ${SYSTEM_POLICIES.LAST_MIN_GRACE_MINUTES} phút đối với đơn hàng đặt sát giờ (Đặt lúc ${createdAtDate.toLocaleTimeString('vi-VN')}).`;
              }
            } else {
              // Siêu gấp: Hạn ân hạn là 5 phút
              if (minsSinceCreation <= SYSTEM_POLICIES.URGENT_GRACE_MINUTES) {
                isFreeCancel = true;
              } else {
                isFreeCancel = false;
                penaltyReason = `Đã quá thời gian ân hạn ${SYSTEM_POLICIES.URGENT_GRACE_MINUTES} phút đối với đơn hàng đặt siêu gấp (Đặt lúc ${createdAtDate.toLocaleTimeString('vi-VN')}).`;
              }
            }
          } else {
            // Hủy trễ bình thường
            isFreeCancel = false;
            penaltyReason = `Hủy đơn trễ (dưới ${SYSTEM_POLICIES.FREE_CANCEL_LIMIT_HOURS} giờ trước giờ hẹn).`;
          }
        }
      }
    }

    if (isProvider) {
      isFreeCancel = true;
      // Provider tự hủy -> tăng violationCount của Provider đó
      await this.bookingModel.db
        .model('Provider')
        .findOneAndUpdate(
          { userId: new Types.ObjectId(userId) },
          { $inc: { violationCount: 1 } }
        );
    }

    let penaltyAmount = 0;
    if (isFreeCancel) {
      refundAmount = booking.pricingSummary?.grandTotal || 0;
    } else {
      // Khách hủy trễ -> phạt cọc dịch vụ, hoàn cọc giữ đồ
      const items = await this.bookingItemModel.find({ bookingId: booking._id });
      for (const item of items) {
        if (item.itemType === 'PRODUCT') {
          penaltyAmount += Math.round(item.unitPrice * SYSTEM_POLICIES.PRODUCT_CANCEL_PENALTY_RATE) * item.quantity;
        } else {
          penaltyAmount += Math.round(item.unitPrice * SYSTEM_POLICIES.PHOTOGRAPHY_CANCEL_PENALTY_RATE) * item.quantity;
        }
      }

      // Không cho phép tiền phạt vượt quá subTotal
      penaltyAmount = Math.min(penaltyAmount, booking.pricingSummary.subTotal);

      // Chuyển khoản trực tiếp số tiền phạt này cho các Provider tương ứng
      const providerItems = new Map<string, any[]>();
      for (const item of items) {
        const pId = item.providerId.toString();
        if (!providerItems.has(pId)) providerItems.set(pId, []);
        providerItems.get(pId)!.push(item);
      }

      for (const [pIdStr, pItems] of providerItems.entries()) {
        let providerPenalty = 0;
        for (const item of pItems) {
          if (item.itemType === 'PRODUCT') {
            providerPenalty += Math.round(item.unitPrice * SYSTEM_POLICIES.PRODUCT_CANCEL_PENALTY_RATE) * item.quantity;
          } else {
            providerPenalty += Math.round(item.unitPrice * SYSTEM_POLICIES.PHOTOGRAPHY_CANCEL_PENALTY_RATE) * item.quantity;
          }
        }

        if (providerPenalty > 0) {
          const provider = await this.bookingModel.db
            .model('Provider')
            .findById(new Types.ObjectId(pIdStr));
          if (provider) {
            let bankName = 'VietinBank';
            let accountNumber = '1029384756';
            let accountHolder = 'PROVIDER STUDIO';

            if (provider.paymentAccounts && provider.paymentAccounts.length > 0) {
              const activeAccount = provider.paymentAccounts.find((a: any) => a.isDefault) || provider.paymentAccounts[0];
              bankName = activeAccount.bankName || bankName;
              accountNumber = activeAccount.accountNumberMasked
                ? activeAccount.accountNumberMasked.replace(/\*/g, '8')
                : accountNumber;
              accountHolder = activeAccount.accountHolder || accountHolder;
            }

            const transferRef = `CANCEL_PENALTY_${booking.bookingCode}`;
            await this.paymentsService.executeAutoTransfer(
              bankName,
              accountNumber,
              accountHolder,
              providerPenalty,
              transferRef,
            );
          }
        }
      }

      // Khách nhận lại phần tiền cọc giữ đồ và phần dư tiền dịch vụ (nếu có)
      refundAmount = Math.max((booking.pricingSummary?.grandTotal || 0) - penaltyAmount, 0);
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
        ? `Đơn hàng đã được hủy thành công. Hoàn tiền 100% (${refundAmount.toLocaleString('vi-VN')}đ).`
        : `Đơn hàng đã bị hủy. Khách bị phạt mất cọc dịch vụ (${penaltyAmount.toLocaleString('vi-VN')}đ). Hoàn cọc giữ đồ & số dư (${refundAmount.toLocaleString('vi-VN')}đ). Lý do phạt: ${penaltyReason}`,
      changedBy: userId ? new Types.ObjectId(userId) : null,
    });

    const savedBooking = await booking.save();

    try {
      await this.notificationsService.createNotification(
        booking.customerId.toString(),
        `Đơn hàng đã hủy`,
        `Đơn hàng ${booking.bookingCode} của bạn đã bị hủy. Lý do: ${reason}`,
        NotificationType.Booking,
        { bookingId: booking._id },
      );
    } catch (e) {
      console.error('Failed to create cancelBooking notification:', e);
    }

    // Hủy các BookingSchedule liên quan
    await this.bookingScheduleModel.updateMany(
      { bookingId: booking._id },
      { status: BookingScheduleStatus.Cancelled }
    );

    // Giải phóng các Reservation trong kho để tránh khóa lịch vĩnh viễn
    await this.inventoryReservationModel.updateMany(
      { bookingId: booking._id },
      { $set: { status: ReservationStatus.Cancelled } }
    );

    // Kích hoạt hoàn tiền cọc / hoàn tiền dịch vụ cho khách hàng
    if (refundAmount > 0) {
      try {
        await this.paymentsService.refundDeposit(booking._id.toString(), refundAmount);
      } catch (err) {
        console.error('PaymentsService.refundDeposit failed during cancelBooking:', err);
      }
    }

    // Hủy các đối soát (settlements) liên quan nếu có
    try {
      await this.paymentsService.cancelSettlementsForBooking(booking._id.toString());
    } catch (err) {
      console.error('PaymentsService.cancelSettlementsForBooking failed during cancelBooking:', err);
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
      status: { 
        $nin: [
          BookingStatus.Cancelled, 
          BookingStatus.Completed, 
          BookingStatus.Returned,
          BookingStatus.Refunded
        ] 
      }
    }).select('_id');
    const activeBookingIds = activeBookings.map(b => b._id);

    const items = await this.bookingItemModel.find({
      bookingId: { $in: activeBookingIds },
      productId: new Types.ObjectId(productId)
    });

    const bookedDates = new Set<string>();
    const bookedSlots: { date: string, timeSlot: string }[] = [];

    items.forEach(item => {
      if (item.rentalType === 'DAILY') {
        if (item.rentalFrom && item.rentalTo) {
          const start = new Date(item.rentalFrom);
          const end = new Date(item.rentalTo);
          const current = new Date(start);
          while (current <= end) {
            const dateStr = current.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
            bookedDates.add(dateStr);
            current.setDate(current.getDate() + 1);
          }
        }
      } else if (item.rentalType === 'HOURLY') {
        if (item.shootDate && item.shootTimeSlot) {
          const dateStr = new Date(item.shootDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          bookedSlots.push({ date: dateStr, timeSlot: item.shootTimeSlot });
        }
      }
    });

    return {
      bookedDates: Array.from(bookedDates),
      bookedSlots
    };
  }

  async getBusySchedulesForProvider(providerId: string): Promise<{ bookedDates: string[], bookedSlots: { date: string, timeSlot: string }[] }> {
    const activeBookings = await this.bookingModel.find({
      status: { 
        $nin: [
          BookingStatus.Cancelled, 
          BookingStatus.Completed, 
          BookingStatus.Returned,
          BookingStatus.Refunded
        ] 
      }
    }).select('_id');
    const activeBookingIds = activeBookings.map(b => b._id);

    const items = await this.bookingItemModel.find({
      bookingId: { $in: activeBookingIds },
      providerId: new Types.ObjectId(providerId),
      itemType: BookingItemType.PhotographyPackage
    });

    const bookedDates = new Set<string>();
    const bookedSlots: { date: string, timeSlot: string }[] = [];

    items.forEach(item => {
      if (item.shootDate && item.shootTimeSlot) {
        const dateStr = new Date(item.shootDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        bookedSlots.push({ date: dateStr, timeSlot: item.shootTimeSlot });
      }
    });

    return {
      bookedDates: Array.from(bookedDates),
      bookedSlots
    };
  }

  private parseTimeSlot(slot: string): { start: number; end: number } {
    // Format: "07:00-15:00" — find the "-" separator after "HH:MM"
    const dashIdx = slot.indexOf('-');
    const startHour = parseInt(slot.substring(0, dashIdx).split(':')[0]);
    const endHour = parseInt(slot.substring(dashIdx + 1).split(':')[0]);
    return { start: startHour, end: endHour };
  }

  private isTimeSlotOverlap(slot1: string, slot2: string): boolean {
    try {
      const t1 = this.parseTimeSlot(slot1);
      const t2 = this.parseTimeSlot(slot2);
      return t1.start < t2.end && t2.start < t1.end;
    } catch (_) {
      return false;
    }
  }
}
