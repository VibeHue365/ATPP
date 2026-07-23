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
  Provider,
  ProviderStatus,
} from '../../providers/schemas/provider.schema';
import {
  PriceVersion,
  PriceTargetType,
} from '../../products/schemas/price-version.schema';
import {
  BookingScheduleType,
  BookingScheduleStatus,
} from '../schemas/booking-schedule.schema';
import {
  InventoryItem,
  ConditionStatus,
  InventoryItemStatus,
} from '../../products/schemas/inventory-item.schema';
import {
  InventoryReservation,
  InventoryReservationDocument,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { CreateProductBookingDto } from '../dto/create-product-booking.dto';
import { CreatePhotographyBookingDto } from '../dto/create-photography-booking.dto';
import { BookingsRepository } from '../repositories/bookings.repository';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const toBusinessDateKey = (value: Date | string = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

@Injectable()
export class BookingCreationService {
  constructor(
    private readonly bookingsRepository: BookingsRepository,
    @InjectModel(Product.name)
    private readonly productModel: Model<Product>,
    @InjectModel(PhotographyPackage.name)
    private readonly photoPackageModel: Model<PhotographyPackage>,
    @InjectModel(PriceVersion.name)
    private readonly priceVersionModel: Model<PriceVersion>,
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
  ) {}

  private normalizeColor(colorStr?: string | null): string {
    if (!colorStr) return 'WHITE';
    const norm = colorStr.trim().toUpperCase();
    if (norm === 'ĐỎ' || norm === 'RED') return 'RED';
    if (norm === 'TRẮNG' || norm === 'WHITE') return 'WHITE';
    if (norm === 'VÀNG' || norm === 'GOLD') return 'GOLD';
    if (norm === 'ĐEN' || norm === 'BLACK') return 'BLACK';
    return norm;
  }

  private parseTimeSlot(slot: string): { start: number; end: number } {
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
    } catch {
      return false;
    }
  }

  private async getBusySchedulesForProduct(productId: string): Promise<{
    bookedDates: string[];
    bookedSlots: { date: string; timeSlot: string }[];
  }> {
    const activeBookings = await this.bookingsRepository.findBookings({
      status: {
        $nin: [
          BookingStatus.Cancelled,
          BookingStatus.Completed,
          BookingStatus.Returned,
          BookingStatus.Refunded,
        ],
      },
    });
    const activeBookingIds = activeBookings.map((b) => b._id);

    const items = await this.bookingsRepository.findBookingItems({
      bookingId: { $in: activeBookingIds },
      productId: new Types.ObjectId(productId),
    });

    const bookedDates = new Set<string>();
    const bookedSlots: { date: string; timeSlot: string }[] = [];

    items.forEach((item) => {
      if (item.rentalType === 'DAILY') {
        if (item.rentalFrom && item.rentalTo) {
          const start = new Date(item.rentalFrom);
          const end = new Date(item.rentalTo);
          const current = new Date(start);
          while (current <= end) {
            const dateStr = current.toLocaleDateString('en-CA', {
              timeZone: 'Asia/Ho_Chi_Minh',
            });
            bookedDates.add(dateStr);
            current.setDate(current.getDate() + 1);
          }
        }
      } else if (item.rentalType === 'HOURLY') {
        if (item.shootDate && item.shootTimeSlot) {
          const dateStr = new Date(item.shootDate).toLocaleDateString('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
          });
          bookedSlots.push({ date: dateStr, timeSlot: item.shootTimeSlot });
        }
      }
    });

    return {
      bookedDates: Array.from(bookedDates),
      bookedSlots,
    };
  }

  private async getBusySchedulesForProvider(providerId: string): Promise<{
    bookedDates: string[];
    bookedSlots: { date: string; timeSlot: string }[];
  }> {
    const activeBookings = await this.bookingsRepository.findBookings({
      status: {
        $nin: [
          BookingStatus.Cancelled,
          BookingStatus.Completed,
          BookingStatus.Returned,
          BookingStatus.Refunded,
        ],
      },
    });
    const activeBookingIds = activeBookings.map((b) => b._id);

    const items = await this.bookingsRepository.findBookingItems({
      bookingId: { $in: activeBookingIds },
      providerId: new Types.ObjectId(providerId),
      itemType: BookingItemType.PhotographyPackage,
    });

    const bookedDates = new Set<string>();
    const bookedSlots: { date: string; timeSlot: string }[] = [];

    items.forEach((item) => {
      if (item.shootDate && item.shootTimeSlot) {
        const dateStr = new Date(item.shootDate).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        bookedSlots.push({ date: dateStr, timeSlot: item.shootTimeSlot });
      }
    });

    return {
      bookedDates: Array.from(bookedDates),
      bookedSlots,
    };
  }

  async createBooking(
    userIdStr: string,
    dto: CreateBookingDto,
  ): Promise<BookingDocument> {
    const session = await this.bookingsRepository.startSession();
    session.startTransaction();

    const customerId = new Types.ObjectId(userIdStr);
    const bookingCode = `B${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;

    let subTotal = 0;
    const itemDetails: Array<Partial<BookingItem>> = [];
    const providerIdsSet = new Set<string>();
    const reservationsCreated: InventoryReservationDocument[] = [];
    let booking: BookingDocument | null = null;
    let promotionId: Types.ObjectId | null = null;

    const todayStr = toBusinessDateKey();
    for (const item of dto.items) {
      if (item.rentalFrom) {
        const itemDateStr = toBusinessDateKey(item.rentalFrom);
        if (itemDateStr < todayStr) {
          throw new BadRequestException(
            'Ngày bắt đầu thuê áo dài không thể nằm trong quá khứ.',
          );
        }
      }
      if (item.shootDate) {
        const itemDateStr = toBusinessDateKey(item.shootDate);
        if (itemDateStr < todayStr) {
          throw new BadRequestException(
            'Ngày đặt lịch chụp ảnh không thể nằm trong quá khứ.',
          );
        }
      }
    }

    try {
      for (const item of dto.items) {
        let unitPrice = 0;
        let depositAmount = 0;
        let providerId: Types.ObjectId | null = null;
        let itemType: BookingItemType;

        if (item.productId) {
          const product = await this.productModel
            .findById(item.productId)
            .session(session);
          if (!product) {
            throw new NotFoundException(`Product not found: ${item.productId}`);
          }
          providerId = product.providerId;
          itemType = BookingItemType.Product;
          depositAmount = product.depositAmount;

          let providerInfo = null;
          if (providerId) {
            providerIdsSet.add(providerId.toString());
            providerInfo = await this.providerModel
              .findById(providerId)
              .session(session);
            if (
              !providerInfo ||
              providerInfo.status !== ProviderStatus.Active
            ) {
              throw new BadRequestException(
                'Cửa hàng đối tác hoặc nhiếp ảnh gia hiện không hoạt động hoặc đang bị tạm đình chỉ.',
              );
            }
          }

          const rType = item.rentalType === 'HOURLY' ? 'HOURLY' : 'DAILY';
          if (rType === 'HOURLY') {
            const hourlyRate =
              product.hourlyPrice ||
              Math.round(product.basePrice * 0.3) ||
              80000;
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
                durationHours = Math.max(
                  (eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60),
                  2,
                );
              }
            }
            unitPrice = hourlyRate * durationHours;
          } else {
            let durationDays = 1;
            if (item.rentalFrom && item.rentalTo) {
              const start = new Date(item.rentalFrom);
              const end = new Date(item.rentalTo);
              if (
                !isNaN(start.getTime()) &&
                !isNaN(end.getTime()) &&
                end >= start
              ) {
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

            const sizeVal = item.selectedSize
              ? item.selectedSize.toUpperCase()
              : 'M';
            const colorVal = this.normalizeColor(item.selectedColor);

            if (product.sizes && product.sizes.length > 0) {
              const isSizeSupported = product.sizes.some(
                (s) => s.trim().toUpperCase() === sizeVal,
              );
              if (!isSizeSupported) {
                throw new BadRequestException(
                  `Kích cỡ ${item.selectedSize || 'M'} không khả dụng cho sản phẩm ${product.name}. Các kích cỡ khả dụng: ${product.sizes.join(', ')}`,
                );
              }
            }
            if (product.colors && product.colors.length > 0) {
              const isColorSupported = product.colors.some(
                (c) => this.normalizeColor(c) === colorVal,
              );
              if (!isColorSupported) {
                throw new BadRequestException(
                  `Màu sắc ${item.selectedColor || 'WHITE'} không khả dụng cho sản phẩm ${product.name}. Các màu khả dụng: ${product.colors.join(', ')}`,
                );
              }
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isTodayOrPast = reservedFrom <= today;

            const inventoryItems = await this.inventoryItemModel
              .find({
                productId: new Types.ObjectId(item.productId),
                size: sizeVal,
                color: colorVal,
                status: isTodayOrPast
                  ? InventoryItemStatus.Available
                  : { $ne: InventoryItemStatus.Maintenance },
                conditionStatus: {
                  $nin: [ConditionStatus.Locked, ConditionStatus.Retired],
                },
              })
              .session(session);

            const qty = item.quantity || 1;
            if (inventoryItems.length < qty) {
              if (process.env.NODE_ENV !== 'production' && qty <= 10) {
                const needed = qty - inventoryItems.length;
                for (let k = 0; k < needed; k++) {
                  const sku =
                    `AD-${item.productId.toString().slice(-6)}-${sizeVal}-${colorVal}-${Math.floor(100 + Math.random() * 900)}`.toUpperCase();
                  const newItem = new this.inventoryItemModel({
                    productId: new Types.ObjectId(item.productId),
                    sku,
                    size: sizeVal,
                    color: colorVal,
                    conditionStatus: ConditionStatus.Good,
                    status: InventoryItemStatus.Available,
                  });
                  await newItem.save({ session });
                  inventoryItems.push(newItem);
                }
              } else {
                throw new BadRequestException(
                  `Sản phẩm ${product.name} chỉ còn ${inventoryItems.length} chiếc khả dụng.`,
                );
              }
            }

            const conflictingReservations = await this.inventoryReservationModel
              .find({
                inventoryItemId: { $in: inventoryItems.map((i) => i._id) },
                status: {
                  $in: [
                    ReservationStatus.TempReserved,
                    ReservationStatus.Confirmed,
                  ],
                },
                reservedFrom: { $lte: reservedTo },
                reservedTo: { $gte: reservedFrom },
              })
              .session(session);

            const busyInventoryItemIds = new Set(
              conflictingReservations.map((res) =>
                res.inventoryItemId.toString(),
              ),
            );

            const availableItems = inventoryItems.filter(
              (i) => !busyInventoryItemIds.has(i._id.toString()),
            );

            if (availableItems.length < qty) {
              throw new BadRequestException(
                `Sản phẩm ${product.name} đã được đặt kín lịch hoặc không đủ số lượng trong khoảng thời gian này. (Yêu cầu: ${qty}, Sẵn sàng: ${availableItems.length})`,
              );
            }

            const selectedItems = availableItems.slice(0, qty);
            const itemReservations: InventoryReservationDocument[] = [];

            for (const availableItem of selectedItems) {
              const itemReservation = new this.inventoryReservationModel({
                inventoryItemId: availableItem._id,
                bookingId: new Types.ObjectId(),
                bookingItemId: new Types.ObjectId(),
                reservedFrom,
                reservedTo,
                status: ReservationStatus.TempReserved,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000),
              });
              await itemReservation.save({ session });

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
                .session(session)
                .sort({ _id: 1 });

              if (allOverlapping.length > 1) {
                const winner = allOverlapping[0];
                if (winner._id.toString() !== itemReservation._id.toString()) {
                  for (const res of itemReservations) {
                    await this.inventoryReservationModel
                      .deleteOne({ _id: res._id })
                      .session(session);
                  }
                  for (const res of reservationsCreated) {
                    await this.inventoryReservationModel
                      .deleteOne({ _id: res._id })
                      .session(session);
                  }
                  await this.inventoryReservationModel
                    .deleteOne({ _id: itemReservation._id })
                    .session(session);
                  throw new BadRequestException(
                    `Sản phẩm ${product.name} vừa bị người khác nhanh tay đặt trước. Vui lòng thử lại!`,
                  );
                }
              }
              itemReservations.push(itemReservation);
              reservationsCreated.push(itemReservation);
            }

            const comboDiscountPercent =
              dto.bookingType === BookingType.Combo && providerInfo
                ? providerInfo.comboDiscountPercent !== undefined
                  ? providerInfo.comboDiscountPercent
                  : 10
                : 0;

            for (const availableItem of selectedItems) {
              subTotal += unitPrice;
              const comboDiscountAmount = Math.round(
                unitPrice * (comboDiscountPercent / 100),
              );

              itemDetails.push({
                providerId,
                itemType,
                productId: new Types.ObjectId(item.productId),
                inventoryItemId: availableItem._id,
                photographyPackageId: null,
                priceVersionId: new Types.ObjectId(),
                unitPrice,
                depositAmount,
                quantity: 1,
                rentalFrom: item.rentalFrom ? new Date(item.rentalFrom) : null,
                rentalTo: item.rentalTo ? new Date(item.rentalTo) : null,
                shootDate: item.shootDate ? new Date(item.shootDate) : null,
                shootTimeSlot: item.shootTimeSlot || null,
                customRequests: item.customRequests || '',
                referenceImage: item.referenceImage || null,
                selectedSize: sizeVal,
                selectedColor: colorVal,
                rentalType: item.rentalType === 'HOURLY' ? 'HOURLY' : 'DAILY',
                comboDiscountPercent,
                comboDiscountAmount,
              });
            }
          }
        } else if (item.photographyPackageId) {
          const pkg = await this.photoPackageModel
            .findById(item.photographyPackageId)
            .session(session);
          if (!pkg) {
            throw new NotFoundException(
              `Photography package not found: ${item.photographyPackageId}`,
            );
          }
          providerId = pkg.providerId;
          itemType = BookingItemType.PhotographyPackage;
          unitPrice = pkg.price;
          depositAmount = pkg.price; // 100% thanh toán trước cho gói chụp

          let providerInfo = null;
          if (providerId) {
            providerIdsSet.add(providerId.toString());
            providerInfo = await this.providerModel
              .findById(providerId)
              .session(session);
            if (
              !providerInfo ||
              providerInfo.status !== ProviderStatus.Active
            ) {
              throw new BadRequestException(
                'Cửa hàng đối tác hoặc nhiếp ảnh gia hiện không hoạt động hoặc đang bị tạm đình chỉ.',
              );
            }
          }

          const qty = item.quantity || 1;
          subTotal += unitPrice * qty;

          const comboDiscountPercent =
            dto.bookingType === BookingType.Combo && providerInfo
              ? providerInfo.comboDiscountPercent !== undefined
                ? providerInfo.comboDiscountPercent
                : 10
              : 0;
          const comboDiscountAmount = Math.round(
            unitPrice * qty * (comboDiscountPercent / 100),
          );

          itemDetails.push({
            providerId,
            itemType,
            productId: null,
            inventoryItemId: null,
            photographyPackageId: new Types.ObjectId(item.photographyPackageId),
            priceVersionId: new Types.ObjectId(),
            unitPrice,
            depositAmount,
            quantity: qty,
            rentalFrom: null,
            rentalTo: null,
            shootDate: item.shootDate ? new Date(item.shootDate) : null,
            shootTimeSlot: item.shootTimeSlot || null,
            customRequests: item.customRequests || '',
            referenceImage: item.referenceImage || null,
            selectedSize: null,
            selectedColor: null,
            rentalType: 'DAILY',
            comboDiscountPercent,
            comboDiscountAmount,
          });
        } else {
          throw new BadRequestException(
            'Each item must contain either productId or photographyPackageId',
          );
        }
      }

      for (const detail of itemDetails) {
        if (detail.itemType === BookingItemType.Product && detail.productId) {
          if (
            detail.rentalType === 'DAILY' &&
            detail.rentalFrom &&
            detail.rentalTo
          ) {
            const busySchedules = await this.getBusySchedulesForProduct(
              detail.productId.toString(),
            );
            const busyDatesSet = new Set(busySchedules.bookedDates);
            const start = new Date(detail.rentalFrom);
            const end = new Date(detail.rentalTo);
            const current = new Date(start);
            while (current <= end) {
              const dateStr = toBusinessDateKey(current);
              if (busyDatesSet.has(dateStr)) {
                throw new BadRequestException(
                  `Sản phẩm đã được đặt lịch thuê vào ngày ${dateStr}. Vui lòng chọn thời gian khác.`,
                );
              }
              current.setDate(current.getDate() + 1);
            }
          } else if (detail.rentalType === 'HOURLY' && detail.shootDate) {
            const busySchedules = await this.getBusySchedulesForProduct(
              detail.productId.toString(),
            );
            const dateStr = toBusinessDateKey(detail.shootDate);
            const isSlotConflict =
              detail.shootTimeSlot != null &&
              busySchedules.bookedSlots.some(
                (slot) =>
                  slot.date === dateStr &&
                  slot.timeSlot &&
                  this.isTimeSlotOverlap(slot.timeSlot, detail.shootTimeSlot!),
              );
            if (isSlotConflict) {
              throw new BadRequestException(
                `Sản phẩm đã được đặt thuê vào ngày ${dateStr} khung giờ ${detail.shootTimeSlot}. Vui lòng chọn khung giờ khác.`,
              );
            }
          }
        } else if (
          detail.itemType === BookingItemType.PhotographyPackage &&
          detail.photographyPackageId
        ) {
          if (detail.shootDate && detail.providerId) {
            const busySchedules = await this.getBusySchedulesForProvider(
              detail.providerId.toString(),
            );
            const dateStr = toBusinessDateKey(detail.shootDate);
            const isSlotConflict =
              detail.shootTimeSlot != null &&
              busySchedules.bookedSlots.some(
                (slot) =>
                  slot.date === dateStr &&
                  slot.timeSlot &&
                  this.isTimeSlotOverlap(slot.timeSlot, detail.shootTimeSlot!),
              );
            if (isSlotConflict) {
              throw new BadRequestException(
                `Nhiếp ảnh gia đã có lịch chụp vào ngày ${dateStr} khung giờ ${detail.shootTimeSlot}. Vui lòng chọn khung giờ khác.`,
              );
            }
          }
        }
      }



      const travelFee = dto.travelFee || 0;
      const comboDiscountTotal = itemDetails.reduce(
        (sum, item) => sum + (item.comboDiscountAmount || 0),
        0,
      );
      let voucherDiscountTotal = 0;

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
      const productDepositTotal = itemDetails
        .filter((i) => i.itemType === BookingItemType.Product)
        .reduce((sum, i) => sum + (i.depositAmount || 0) * (i.quantity || 1), 0);
      const grandTotal =
        Math.max(subTotal - discountAmount + travelFee, 0) + productDepositTotal;

      booking = await this.bookingsRepository.createBooking(
        {
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
        },
        session,
      );

      for (const detail of itemDetails) {
        const savedItem = await this.bookingsRepository.createBookingItem(
          {
            ...detail,
            bookingId: booking._id,
          },
          session,
        );

        if (detail.inventoryItemId) {
          const matchedRes = reservationsCreated.find(
            (r) =>
              r.inventoryItemId.toString() ===
              detail.inventoryItemId!.toString(),
          );
          if (matchedRes) {
            matchedRes.bookingId = booking._id;
            matchedRes.bookingItemId = savedItem._id;
            await matchedRes.save({ session });
          }
        }

        if (detail.itemType === BookingItemType.Product) {
          if (
            detail.rentalType === 'DAILY' &&
            detail.rentalFrom &&
            detail.rentalTo
          ) {
            const start = new Date(detail.rentalFrom);
            const end = new Date(detail.rentalTo);
            const current = new Date(start);
            while (current <= end) {
              await this.bookingsRepository.createSchedule(
                {
                  bookingId: booking._id,
                  bookingItemId: savedItem._id,
                  scheduleType: BookingScheduleType.RentalPeriod,
                  scheduledDate: new Date(current),
                  timeSlot: null,
                  status: BookingScheduleStatus.Scheduled,
                },
                session,
              );
              current.setDate(current.getDate() + 1);
            }
          } else if (detail.rentalType === 'HOURLY' && detail.shootDate) {
            await this.bookingsRepository.createSchedule(
              {
                bookingId: booking._id,
                bookingItemId: savedItem._id,
                scheduleType: BookingScheduleType.RentalPeriod,
                scheduledDate: detail.shootDate,
                timeSlot: detail.shootTimeSlot,
                status: BookingScheduleStatus.Scheduled,
              },
              session,
            );
          }
        } else if (detail.itemType === BookingItemType.PhotographyPackage) {
          if (detail.shootDate) {
            await this.bookingsRepository.createSchedule(
              {
                bookingId: booking._id,
                bookingItemId: savedItem._id,
                scheduleType: BookingScheduleType.Photoshoot,
                scheduledDate: detail.shootDate,
                timeSlot: detail.shootTimeSlot,
                status: BookingScheduleStatus.Scheduled,
              },
              session,
            );
          }
        }
      }

      if (promotionId) {
        await this.promotionsService.incrementUsage(promotionId);
      }

      await session.commitTransaction();

      try {
        await this.notificationsService.createNotification(
          customerId.toString(),
          `Đơn đang chờ thanh toán`,
          `Đơn đặt lịch ${bookingCode} đã được giữ tạm thời. Vui lòng hoàn tất thanh toán để xác nhận lịch.`,
          NotificationType.Booking,
          { bookingId: booking._id },
        );
      } catch (e) {
        console.error('Failed to create createBooking notification:', e);
      }

      return booking;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async createProductBooking(
    customerId: string,
    dto: CreateProductBookingDto,
  ): Promise<BookingDocument> {
    const session = await this.bookingsRepository.startSession();
    session.startTransaction();

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

    try {
      const product = await this.productsService.getProductById(productId);
      if (!product) {
        throw new NotFoundException(
          `Không tìm thấy sản phẩm với ID: ${productId}`,
        );
      }

      const provider = await this.providerModel
        .findById(product.providerId)
        .session(session);
      if (!provider || provider.status !== ProviderStatus.Active) {
        throw new BadRequestException(
          'Cửa hàng đối tác hiện không hoạt động hoặc đang bị tạm đình chỉ.',
        );
      }

      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new BadRequestException('Định dạng ngày bắt đầu không hợp lệ');
      }

      const todayStr = toBusinessDateKey();
      const startDateStr = toBusinessDateKey(start);
      if (startDateStr < todayStr) {
        throw new BadRequestException(
          'Ngày bắt đầu đặt lịch thuê không thể nằm trong quá khứ.',
        );
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
        const hourlyRate =
          product.hourlyPrice || Math.round(product.basePrice * 0.3) || 80000;

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
          Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
          1;

        unitPrice = product.basePrice;
        subTotal = unitPrice * durationDays * quantity;
        rentalFrom = start;
        rentalTo = end;
      }

      if (rentalType === 'DAILY' && rentalFrom && rentalTo) {
        const busySchedules = await this.getBusySchedulesForProduct(productId);
        const busyDatesSet = new Set(busySchedules.bookedDates);
        const start = new Date(rentalFrom);
        const end = new Date(rentalTo);
        const current = new Date(start);
        while (current <= end) {
          const dateStr = toBusinessDateKey(current);
          if (busyDatesSet.has(dateStr)) {
            throw new BadRequestException(
              `Sản phẩm đã được đặt lịch thuê vào ngày ${dateStr}. Vui lòng chọn thời gian khác.`,
            );
          }
          current.setDate(current.getDate() + 1);
        }
      } else if (rentalType === 'HOURLY' && shootDate) {
        const busySchedules = await this.getBusySchedulesForProduct(productId);
        const dateStr = toBusinessDateKey(shootDate);
        const isSlotConflict =
          shootTimeSlot != null &&
          busySchedules.bookedSlots.some(
            (slot) =>
              slot.date === dateStr &&
              slot.timeSlot &&
              this.isTimeSlotOverlap(slot.timeSlot, shootTimeSlot),
          );
        if (isSlotConflict) {
          throw new BadRequestException(
            `Sản phẩm đã được đặt thuê vào ngày ${dateStr} khung giờ ${shootTimeSlot}. Vui lòng chọn khung giờ khác.`,
          );
        }
      }

      const depositTotal = product.depositAmount * quantity;
      const grandTotal = subTotal + depositTotal;

      let priceVersion = await this.priceVersionModel
        .findOne({
          targetId: new Types.ObjectId(productId),
          targetType: PriceTargetType.Product,
        })
        .session(session)
        .sort({ effectiveFrom: -1 });

      if (!priceVersion) {
        priceVersion = new this.priceVersionModel({
          targetType: PriceTargetType.Product,
          targetId: new Types.ObjectId(productId),
          price: unitPrice,
          depositAmount: product.depositAmount,
          effectiveFrom: new Date(),
          note: 'Tự động tạo khi booking',
        });
        await priceVersion.save({ session });
      }

      const bookingCode = `BK${Math.floor(10000 + Math.random() * 90000)}`;
      const reservedFrom = rentalFrom
        ? new Date(rentalFrom)
        : new Date(startDateTime!);
      const reservedTo = rentalTo ? new Date(rentalTo) : new Date(endDateTime!);
      if (rentalType === 'DAILY') {
        reservedFrom.setHours(0, 0, 0, 0);
        reservedTo.setHours(23, 59, 59, 999);
      }

      const sizeVal = size.toUpperCase();
      const colorVal = this.normalizeColor(color);

      if (product.sizes && product.sizes.length > 0) {
        const isSizeSupported = product.sizes.some(
          (s: string) => s.trim().toUpperCase() === sizeVal,
        );
        if (!isSizeSupported) {
          throw new BadRequestException(
            `Kích cỡ ${size} không khả dụng cho sản phẩm này. Các kích cỡ khả dụng: ${product.sizes.join(', ')}`,
          );
        }
      }
      if (product.colors && product.colors.length > 0) {
        const isColorSupported = product.colors.some(
          (c: string) => this.normalizeColor(c) === colorVal,
        );
        if (!isColorSupported) {
          throw new BadRequestException(
            `Màu sắc ${color} không khả dụng cho sản phẩm này. Các màu khả dụng: ${product.colors.join(', ')}`,
          );
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isTodayOrPast = reservedFrom <= today;

      const inventoryItems = await this.inventoryItemModel
        .find({
          productId: product._id,
          size: sizeVal,
          color: colorVal,
          status: isTodayOrPast
            ? InventoryItemStatus.Available
            : { $ne: InventoryItemStatus.Maintenance },
          conditionStatus: {
            $nin: [ConditionStatus.Locked, ConditionStatus.Retired],
          },
        })
        .session(session);

      if (inventoryItems.length < quantity) {
        if (process.env.NODE_ENV !== 'production' && quantity <= 10) {
          const needed = quantity - inventoryItems.length;
          for (let k = 0; k < needed; k++) {
            const sku =
              `AD-${product._id.toString().slice(-6)}-${sizeVal}-${colorVal}-${Math.floor(100 + Math.random() * 900)}`.toUpperCase();
            const newItem = new this.inventoryItemModel({
              productId: product._id,
              sku,
              size: sizeVal,
              color: colorVal,
              conditionStatus: ConditionStatus.Good,
              status: InventoryItemStatus.Available,
            });
            await newItem.save({ session });
            inventoryItems.push(newItem);
          }
        } else {
          throw new BadRequestException(
            `Sản phẩm ${product.name} chỉ còn ${inventoryItems.length} chiếc khả dụng.`,
          );
        }
      }

      const conflictingReservations = await this.inventoryReservationModel
        .find({
          inventoryItemId: { $in: inventoryItems.map((item) => item._id) },
          status: {
            $in: [ReservationStatus.TempReserved, ReservationStatus.Confirmed],
          },
          reservedFrom: { $lte: reservedTo },
          reservedTo: { $gte: reservedFrom },
        })
        .session(session);

      const busyInventoryItemIds = new Set(
        conflictingReservations.map((res) => res.inventoryItemId.toString()),
      );

      const availableItems = inventoryItems.filter(
        (item) => !busyInventoryItemIds.has(item._id.toString()),
      );

      if (availableItems.length < quantity) {
        throw new BadRequestException(
          `Sản phẩm đã được đặt kín lịch hoặc không đủ số lượng trong khoảng thời gian này. (Yêu cầu: ${quantity}, Sẵn sàng: ${availableItems.length})`,
        );
      }

      const selectedItems = availableItems.slice(0, quantity);
      const reservations: InventoryReservationDocument[] = [];

      for (const availableItem of selectedItems) {
        const reservation = new this.inventoryReservationModel({
          inventoryItemId: availableItem._id,
          bookingId: new Types.ObjectId(),
          bookingItemId: new Types.ObjectId(),
          reservedFrom,
          reservedTo,
          status: ReservationStatus.TempReserved,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        });
        await reservation.save({ session });

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
          .session(session)
          .sort({ _id: 1 });

        if (allOverlapping.length > 1) {
          const winner = allOverlapping[0];
          if (winner._id.toString() !== reservation._id.toString()) {
            for (const res of reservations) {
              await this.inventoryReservationModel
                .deleteOne({ _id: res._id })
                .session(session);
            }
            await this.inventoryReservationModel
              .deleteOne({ _id: reservation._id })
              .session(session);
            throw new BadRequestException(
              'Sản phẩm vừa bị người khác nhanh tay đặt trước. Vui lòng thử lại!',
            );
          }
        }
        reservations.push(reservation);
      }

      const savedBooking = await this.bookingsRepository.createBooking(
        {
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
        },
        session,
      );

      for (let i = 0; i < quantity; i++) {
        const availableItem = selectedItems[i];
        const reservation = reservations[i];

        const savedBookingItem =
          await this.bookingsRepository.createBookingItem(
            {
              bookingId: savedBooking._id,
              providerId: product.providerId,
              itemType: BookingItemType.Product,
              productId: product._id,
              inventoryItemId: availableItem._id,
              priceVersionId: priceVersion._id,
              unitPrice,
              depositAmount: product.depositAmount,
              quantity: 1,
              rentalFrom,
              rentalTo,
              shootDate,
              shootTimeSlot,
              rentalType,
              selectedSize: size.toUpperCase(),
              selectedColor: color.toUpperCase(),
              customRequests: null,
            },
            session,
          );

        reservation.bookingId = savedBooking._id;
        reservation.bookingItemId = savedBookingItem._id;
        await reservation.save({ session });

        if (rentalType === 'DAILY' && rentalFrom && rentalTo) {
          const startDay = new Date(rentalFrom);
          const endDay = new Date(rentalTo);
          const current = new Date(startDay);
          while (current <= endDay) {
            await this.bookingsRepository.createSchedule(
              {
                bookingId: savedBooking._id,
                bookingItemId: savedBookingItem._id,
                scheduleType: BookingScheduleType.RentalPeriod,
                scheduledDate: new Date(current),
                timeSlot: null,
                status: BookingScheduleStatus.Scheduled,
              },
              session,
            );
            current.setDate(current.getDate() + 1);
          }
        } else if (rentalType === 'HOURLY' && shootDate) {
          await this.bookingsRepository.createSchedule(
            {
              bookingId: savedBooking._id,
              bookingItemId: savedBookingItem._id,
              scheduleType: BookingScheduleType.RentalPeriod,
              scheduledDate: shootDate,
              timeSlot: shootTimeSlot,
              status: BookingScheduleStatus.Scheduled,
            },
            session,
          );
        }
      }

      await session.commitTransaction();
      return savedBooking;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async createPhotographyBooking(
    customerId: string,
    dto: CreatePhotographyBookingDto,
  ): Promise<BookingDocument> {
    const session = await this.bookingsRepository.startSession();
    session.startTransaction();

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

    try {
      const pkg = await this.photoPackageModel
        .findById(packageId)
        .session(session);
      if (!pkg) {
        throw new NotFoundException(
          `Không tìm thấy gói chụp ảnh với ID: ${packageId}`,
        );
      }

      const provider = await this.providerModel
        .findById(pkg.providerId)
        .session(session);
      if (!provider || provider.status !== ProviderStatus.Active) {
        throw new BadRequestException(
          'Nhiếp ảnh gia hiện không hoạt động hoặc đang bị tạm đình chỉ.',
        );
      }

      const date = new Date(shootDate);
      if (isNaN(date.getTime())) {
        throw new BadRequestException('Định dạng ngày chụp không hợp lệ');
      }

      const todayStr = toBusinessDateKey();
      const shootDateStr = toBusinessDateKey(date);
      if (shootDateStr < todayStr) {
        throw new BadRequestException(
          'Ngày đặt lịch chụp ảnh không thể nằm trong quá khứ.',
        );
      }

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const activeBookings = await this.bookingsRepository.findBookings(
        {
          providerIds: pkg.providerId,
          status: {
            $nin: [
              BookingStatus.Cancelled,
              BookingStatus.Completed,
              BookingStatus.Returned,
              BookingStatus.Refunded,
            ],
          },
        },
        { createdAt: -1 },
        session,
      );
      const activeBookingIds = activeBookings.map((b) => b._id);

      const isSlotBusy = await this.bookingsRepository.findOneBookingItem(
        {
          bookingId: { $in: activeBookingIds },
          providerId: pkg.providerId,
          itemType: BookingItemType.PhotographyPackage,
          shootDate: { $gte: startOfDay, $lte: endOfDay },
          shootTimeSlot,
        },
        session,
      );

      if (isSlotBusy) {
        throw new BadRequestException(
          'Nhiếp ảnh gia này đã có lịch chụp trong khung giờ đã chọn. Vui lòng chọn khung giờ hoặc ngày khác.',
        );
      }

      const unitPrice = pkg.price;
      const subTotal = pkg.price;
      const depositTotal = pkg.price; // 100% thanh toán trước cho dịch vụ chụp ảnh
      const grandTotal = pkg.price;

      let priceVersion = await this.priceVersionModel
        .findOne({
          targetId: pkg._id,
          targetType: PriceTargetType.PhotographyPackage,
        })
        .session(session)
        .sort({ effectiveFrom: -1 });

      if (!priceVersion) {
        priceVersion = new this.priceVersionModel({
          targetType: PriceTargetType.PhotographyPackage,
          targetId: pkg._id,
          price: unitPrice,
          depositAmount: depositTotal,
          effectiveFrom: new Date(),
          note: 'Tự động tạo khi booking gói chụp',
        });
        await priceVersion.save({ session });
      }

      const bookingCode = `BK${Math.floor(10000 + Math.random() * 90000)}`;

      const savedBooking = await this.bookingsRepository.createBooking(
        {
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
        },
        session,
      );

      const savedBookingItem = await this.bookingsRepository.createBookingItem(
        {
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
        },
        session,
      );

      const activeBookingIdsWithNew = [...activeBookingIds, savedBooking._id];
      const allOverlapping = await this.bookingsRepository.findBookingItems(
        {
          bookingId: { $in: activeBookingIdsWithNew },
          providerId: pkg.providerId,
          itemType: BookingItemType.PhotographyPackage,
          shootDate: { $gte: startOfDay, $lte: endOfDay },
          shootTimeSlot,
        },
        undefined, // no populate configs
        session,
      );
      allOverlapping.sort((a, b) =>
        a._id.toString() < b._id.toString() ? -1 : 1,
      );

      if (allOverlapping.length > 1) {
        const winner = allOverlapping[0];
        if (winner._id.toString() !== savedBookingItem._id.toString()) {
          throw new BadRequestException(
            'Nhiếp ảnh gia vừa nhận lịch chụp từ một khách hàng khác. Vui lòng chọn khung giờ hoặc ngày khác.',
          );
        }
      }

      await this.bookingsRepository.createSchedule(
        {
          bookingId: savedBooking._id,
          bookingItemId: savedBookingItem._id,
          scheduleType: BookingScheduleType.Photoshoot,
          scheduledDate: date,
          timeSlot: shootTimeSlot,
          status: BookingScheduleStatus.Scheduled,
        },
        session,
      );

      await session.commitTransaction();
      return savedBooking;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
