/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable no-empty */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  ForbiddenException,
  OnApplicationBootstrap,
  InternalServerErrorException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  Booking,
  BookingDocument,
  BookingStatus,
  BookingType,
  PaymentStatus,
} from '../schemas/booking.schema';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import {
  createRentalFulfillment,
  RentalFulfillmentStatus,
  RentalInventoryStatus,
  RentalIssueStatus,
  DepositSettlementStatus,
} from '../schemas/rental-fulfillment.types';
import { Product } from '../../products/schemas/product.schema';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';
import { PromotionsService } from '../../products/services/promotions.service';
import { DiscountType } from '../../products/schemas/promotion.schema';
import { PaymentsService } from '../../payments/services/payments.service';
import { RefundWorkflowService } from '../../payments/services/refund-workflow.service';
import {
  TimeSlotEngineService,
  ShopScheduleConfig,
} from './time-slot-engine.service';
import { ProductBusyCacheService } from './product-busy-cache.service';
import { InventorySlotLeaseService } from './inventory-slot-lease.service';
import {
  ProviderSchedule,
  ScheduleType,
  ScheduleCapability,
} from '../../products/schemas/provider-schedule.schema';
import {
  SlotLeaseStatus,
  SlotLeasePurpose,
} from '../schemas/inventory-slot-lease.schema';
import { RefundType } from '../../payments/schemas/refund-request.schema';
import { SettlementsService } from '../../settlements/services/settlements.service';
import { RentalDepositRefundCoordinatorService } from './rental-deposit-refund-coordinator.service';
import { ProductsService } from '../../products/services/products.service';
import { DiscountCampaignService } from '../../products/services/discount-campaign.service';
import {
  Provider,
  ProviderStatus,
} from '../../providers/schemas/provider.schema';
import {
  PriceVersion,
  PriceTargetType,
} from '../../products/schemas/price-version.schema';
import {
  BookingSchedule,
  BookingScheduleType,
  BookingScheduleStatus,
} from '../schemas/booking-schedule.schema';
import {
  InventoryItem,
  InventoryItemStatus,
} from '../../products/schemas/inventory-item.schema';
import {
  InventoryReservation,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import { ContractPolicyService } from '../../contracts/contract-policy.service';
import { composeLocationAddress } from '../utils/location-address';
import {
  calculateItemizedContractCancellation,
  type ContractCancellationRule,
} from '../utils/itemized-contract-cancellation';
import { BookingCreationService } from './booking-creation.service';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { PolicyResolverService } from '../../system-policies/services/policy-resolver.service';
import { pendingBookingExpiryFilter } from './booking-expiry-filter';
import { freePaymentClaim, newPaymentClaim } from './payment-expiry-claim';
import { buildReservationOverlapFilter } from './reservation-overlap-filter';
import {
  StaffAvailabilityService,
  parseTimeRangeToMinutes,
  toIctDateKey,
} from './staff-availability.service';
import {
  bumpProviderAvailabilityVersion,
  getProviderAvailabilityVersion,
} from './provider-availability-version';

// ─── DTOs (dùng chung với controller) ────────────────────────────────────────

/** Dùng cho createBooking tổng hợp (nhiều items, hỗ trợ promo) */
export class CreateBookingItemDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  photographyPackageId?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(10)
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
  startDate: string; // YYYY-MM-DD — dùng cho cả DAILY (bắt đầu) và HOURLY (ngày thuê)

  @IsString()
  @IsOptional()
  endDate?: string; // YYYY-MM-DD — chỉ dùng cho DAILY (ngày kết thúc)

  @IsString()
  @IsOptional()
  startTime?: string; // HH:mm      — chỉ dùng cho HOURLY

  @IsString()
  @IsOptional()
  endTime?: string; // HH:mm      — chỉ dùng cho HOURLY

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(10)
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
  private readonly productBusyCache = new Map<
    string,
    {
      value: {
        bookedDates: string[];
        bookedSlots: { date: string; timeSlot: string }[];
        variantBookedDates?: Record<string, string[]>;
        workingDays?: number[];
        offDays?: string[];
        hasSchedule?: boolean;
      };
      expiresAt: number;
    }
  >();
  private readonly providerBusyCache = new Map<
    string,
    {
      value: {
        bookedDates: string[];
        bookedSlots: {
          date: string;
          timeSlot: string;
          bookingItemId: string;
        }[];
        totalActiveStaff?: number;
        maxConcurrentSessions?: number | null;
        effectiveCapacity?: number;
        slotAvailability?: any[];
      };
      expiresAt: number;
      version: number;
    }
  >();

  /** Local-demo / dev switch. In dev, allows early pickup by default unless explicitly disabled with ALLOW_EARLY_RENTAL_PICKUP=false */
  private allowEarlyRentalPickup(): boolean {
    if (process.env.ALLOW_EARLY_RENTAL_PICKUP === 'false') {
      return false;
    }
    if (process.env.ALLOW_EARLY_RENTAL_PICKUP === 'true') {
      return true;
    }
    return (
      process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
    );
  }

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
    @Inject(forwardRef(() => RefundWorkflowService))
    private readonly refundWorkflowService: RefundWorkflowService,
    private readonly settlementsService: SettlementsService,
    private readonly productsService: ProductsService,
    private readonly notificationsService: NotificationsService,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
    private readonly campaignService: DiscountCampaignService,
    private readonly policyResolverService: PolicyResolverService,
    @Inject(forwardRef(() => RentalDepositRefundCoordinatorService))
    private readonly rentalDepositRefundCoordinator: RentalDepositRefundCoordinatorService,
    @Optional()
    private readonly contractPolicyService?: ContractPolicyService,
    @Optional()
    private readonly bookingCreationService?: BookingCreationService,
    @Optional()
    private readonly productBusyCacheService?: ProductBusyCacheService,
    @Optional()
    private readonly slotLeaseService?: InventorySlotLeaseService,
    @Optional()
    private readonly timeSlotEngine?: TimeSlotEngineService,
    @Optional()
    @InjectModel(ProviderSchedule.name)
    private readonly providerScheduleModel?: Model<ProviderSchedule>,
    @Optional()
    private readonly staffAvailabilityService?: StaffAvailabilityService,
  ) {}

  private async getProviderScheduleConfig(
    providerId: Types.ObjectId,
    session?: any,
  ): Promise<ShopScheduleConfig | undefined> {
    if (!this.providerScheduleModel) return undefined;
    try {
      const schedules = await this.providerScheduleModel
        .find({
          providerId,
          $or: [
            { capability: null },
            { capability: ScheduleCapability.AodaiRental },
          ],
        })
        .session(session || null)
        .lean()
        .exec();

      if (!schedules || schedules.length === 0) return undefined;

      const recurringSchedules = schedules.filter(
        (s) =>
          s.scheduleType === ScheduleType.Recurring &&
          typeof s.dayOfWeek === 'number',
      );
      let weeklyOffDays: number[] | undefined = undefined;
      if (recurringSchedules.length > 0) {
        const workingDays = new Set(
          recurringSchedules.map((s) => s.dayOfWeek as number),
        );
        weeklyOffDays = [0, 1, 2, 3, 4, 5, 6].filter(
          (d) => !workingDays.has(d),
        );
      }

      const offDays: string[] = [];
      for (const s of schedules) {
        if (
          s.scheduleType === ScheduleType.SpecificDate &&
          Array.isArray(s.offDays)
        ) {
          for (const d of s.offDays) {
            const dateStr = new Date(d).toLocaleDateString('en-CA', {
              timeZone: 'Asia/Ho_Chi_Minh',
            });
            offDays.push(dateStr);
          }
        }
      }

      return {
        weeklyOffDays,
        offDays: offDays.length > 0 ? offDays : undefined,
      };
    } catch {
      return undefined;
    }
  }

  private async determineShopContractStatus(
    providerId: Types.ObjectId,
    session?: any,
  ): Promise<'LEGACY' | 'CONTRACT_ACTIVE' | 'CONTRACT_SUSPENDED'> {
    if (
      this.contractPolicyService &&
      typeof this.contractPolicyService
        .getProviderContractParticipationStatus === 'function'
    ) {
      const res =
        await this.contractPolicyService.getProviderContractParticipationStatus(
          providerId,
          session,
        );
      return res.status;
    }
    if (!this.bookingModel?.db?.collection) return 'LEGACY';
    const records = await this.bookingModel.db
      .collection('provider_contract_acceptances')
      .find({ providerId, scope: 'AO_DAI_RENTAL' }, { session })
      .toArray();
    if (!records || records.length === 0) return 'LEGACY';
    const active = records.find(
      (r: any) =>
        r.status === 'ACTIVE' &&
        (!r.revokedAt || new Date(r.revokedAt) > new Date()) &&
        new Date(r.acceptedAt) <= new Date(),
    );
    if (!active) return 'CONTRACT_SUSPENDED';
    return 'CONTRACT_ACTIVE';
  }

  async onApplicationBootstrap() {
    try {
      const adminDb = this.bookingModel.db.db!.admin();
      const status = await adminDb.command({ replSetGetStatus: 1 });
      if (!status || !status.ok) {
        throw new Error(
          'MongoDB replica set is not running or not configured.',
        );
      }
      console.log('MongoDB Replica Set check passed successfully.');
    } catch (err: any) {
      const isAuthError =
        err.message?.toLowerCase().includes('unauthorized') ||
        err.message?.toLowerCase().includes('not authorized') ||
        err.message?.toLowerCase().includes('requires admin');
      if (isAuthError) {
        console.log(
          'MongoDB Replica Set check bypassed: administrative command replSetGetStatus not authorized (assumed active, e.g., Atlas cluster).',
        );
      } else {
        console.error(
          '==================================================================',
        );
        console.error(
          'FATAL ERROR: TàGo requires MongoDB to run as a Replica Set to',
        );
        console.error('support database transactions for inventory locking.');
        console.error(
          'Please configure your local MongoDB as a single-node Replica Set.',
        );
        console.error(
          'Command to check replica set: mongosh --eval "rs.status().ok"',
        );
        console.error('Error details:', err.message || err);
        console.error(
          '==================================================================',
        );
        process.exit(1);
      }
    }

    // Run cleanup background task every 5 minutes
    setInterval(
      async () => {
        try {
          await this.cleanupExpiredPendingBookings();
        } catch (err) {
          console.error('Error running expired bookings cleanup:', err);
        }
      },
      5 * 60 * 1000,
    );

    // Self-healing: Revert any AoDai rental bookings mistakenly put into COMBO_PHOTOS_APPROVED back to RETURNED
    try {
      await this.bookingModel.updateMany(
        {
          $or: [
            { bookingType: BookingType.AoDaiRental },
            { type: BookingType.AoDaiRental },
          ],
          status: BookingStatus.ComboPhotosApproved,
        },
        {
          $set: { status: BookingStatus.Returned },
          $pull: {
            statusTimeline: { status: BookingStatus.ComboPhotosApproved },
          },
        },
      );
    } catch (e) {
      console.warn(
        'Failed to auto-heal mismatched combo statuses in bootstrap:',
        e,
      );
    }
  }

  async cleanupExpiredPendingBookings(): Promise<void> {
    const holdPolicy = await this.policyResolverService.getBookingHoldPolicy();
    if (!holdPolicy.autoExpireEnabled) return;

    const now = new Date();
    const cutoff = new Date(now.getTime() - holdPolicy.holdMinutes * 60 * 1000);
    const expiryFilter = pendingBookingExpiryFilter(now, cutoff);

    const expiredBookings = await this.bookingModel.find(expiryFilter);

    if (expiredBookings.length === 0) return;

    for (const booking of expiredBookings) {
      if (
        await this.bookingModel.db
          .model('Payment')
          .exists({ bookingId: booking._id, status: 'SUCCESS' })
      )
        continue;
      const isV2 = booking.contractFlowVersion === 2;
      if (isV2) {
        await this.runInTransaction(async (session) => {
          if (
            await this.bookingModel.db
              .model('Payment')
              .exists({ bookingId: booking._id, status: 'SUCCESS' })
              .session(session)
          )
            return;
          const changed = await this.bookingModel.updateOne(
            {
              _id: booking._id,
              contractFlowVersion: 2,
              $and: [expiryFilter, freePaymentClaim(now)],
            },
            {
              $set: {
                status: BookingStatus.Cancelled,
                paymentExpiryClaim: newPaymentClaim(
                  'EXPIRY',
                  now,
                  new Date(now.getTime() + 60_000),
                ),
              },
              $push: {
                statusTimeline: {
                  status: BookingStatus.Cancelled,
                  changedAt: now,
                  note: 'PAYMENT_EXPIRED',
                },
              },
            },
            { session },
          );
          if (changed.modifiedCount !== 1) return;
          await this.bookingScheduleModel.updateMany(
            { bookingId: booking._id },
            { $set: { status: BookingScheduleStatus.Cancelled } },
            { session },
          );
          await this.inventoryReservationModel.updateMany(
            { bookingId: booking._id, status: ReservationStatus.TempReserved },
            { $set: { status: ReservationStatus.Cancelled } },
            { session },
          );
          await this.bookingModel.db
            .model('Payment')
            .updateMany(
              { bookingId: booking._id, status: 'PENDING' },
              { $set: { status: 'FAILED' } },
              { session },
            );
          await this.promotionsService.releaseVoucher(booking._id, session);
        });
        continue;
      }
      const changed = await this.bookingModel.updateOne(
        { _id: booking._id, ...expiryFilter },
        {
          $set: { status: BookingStatus.Cancelled },
          $push: {
            statusTimeline: {
              status: BookingStatus.Cancelled,
              changedAt: now,
              note: `Tự động hủy đơn hàng do quá hạn thanh toán (${holdPolicy.holdMinutes} phút)`,
            },
          },
        },
      );
      if (changed.modifiedCount !== 1) continue;
      await this.bookingScheduleModel.updateMany(
        { bookingId: booking._id },
        { $set: { status: BookingScheduleStatus.Cancelled } },
      );
      await this.inventoryReservationModel.updateMany(
        { bookingId: booking._id, status: ReservationStatus.TempReserved },
        { $set: { status: ReservationStatus.Cancelled } },
      );
      await this.bookingModel.db
        .model('Payment')
        .updateMany(
          { bookingId: booking._id, status: 'PENDING' },
          { $set: { status: 'FAILED' } },
        );
    }
  }

  private async runInTransaction<T>(
    operation: (session: any) => Promise<T>,
  ): Promise<T> {
    const session = await this.bookingModel.db.startSession();
    try {
      let attempts = 0;
      while (attempts < 3) {
        attempts++;
        session.startTransaction();
        try {
          const result = await operation(session);
          await session.commitTransaction();
          return result;
        } catch (error: any) {
          await session.abortTransaction();
          const isTransient =
            error.errorLabels &&
            error.errorLabels.includes('TransientTransactionError');
          if (isTransient && attempts < 3) {
            console.log(
              `TransientTransactionError encountered, retrying attempt ${attempts}...`,
            );
            continue;
          }
          throw error;
        }
      }
      throw new BadRequestException(
        'Transaction failed after 3 attempts due to TransientTransactionError',
      );
    } finally {
      await session.endSession();
    }
  }

  private async findAvailableInventory(
    productId: Types.ObjectId,
    size: string,
    color: string,
    reservedFrom: Date,
    reservedTo: Date,
    quantity: number,
    session?: any,
    isHourly: boolean = false,
  ): Promise<Types.ObjectId[]> {
    // Guard phòng thủ cho quantity: chặn 0/âm/số lẻ/quá lớn ở MỌI đường gọi
    // (kể cả route POST /bookings dùng @Body() any nên bỏ qua DTO validator).
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('Số lượng thuê không hợp lệ.');
    }
    if (quantity > 10) {
      throw new BadRequestException(
        'Chỉ được thuê tối đa 10 chiếc cho mỗi lần đặt.',
      );
    }
    const sizeVal = size.trim().toUpperCase();
    const colorVal = this.normalizeColor(color);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isTodayOrPast = reservedFrom <= today;

    const inventoryItems = await this.inventoryItemModel
      .find({
        productId,
        size: sizeVal,
        color: colorVal,
        status: isTodayOrPast ? 'AVAILABLE' : { $ne: 'MAINTENANCE' },
        conditionStatus: { $nin: ['LOCKED', 'RETIRED'] },
      } as any)
      .session(session);

    if (inventoryItems.length === 0) {
      const disableAutoCreate =
        process.env.DISABLE_AUTO_CREATE_INVENTORY === 'true';
      if (disableAutoCreate) {
        throw new BadRequestException(
          `Sản phẩm này hiện đang hết hàng hoặc không khả dụng trong kho.`,
        );
      }

      const sku =
        `AD-${productId.toString().slice(-6)}-${sizeVal}-${colorVal}-${Math.floor(100 + Math.random() * 900)}`.toUpperCase();
      const newItem = await this.inventoryItemModel.create(
        [
          {
            productId,
            sku,
            size: sizeVal,
            color: colorVal,
            conditionStatus: 'GOOD' as any,
            status: 'AVAILABLE' as any,
          },
        ],
        { session },
      );
      inventoryItems.push(newItem[0]);
    }

    const now = new Date();
    const overlapFilter = buildReservationOverlapFilter(
      reservedFrom,
      reservedTo,
      isHourly,
      now,
    );
    const conflictingReservations = await this.inventoryReservationModel
      .find({
        inventoryItemId: { $in: inventoryItems.map((i) => i._id) },
        ...overlapFilter,
      })
      .session(session);

    const busyInventoryItemIds = new Set(
      conflictingReservations.map((res) => res.inventoryItemId.toString()),
    );

    const availableItems = inventoryItems
      .filter((i) => !busyInventoryItemIds.has(i._id.toString()))
      .sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

    if (availableItems.length < quantity) {
      throw new BadRequestException(
        `Sản phẩm đã được đặt kín lịch trong khoảng thời gian này (Yêu cầu ${quantity}, khả dụng ${availableItems.length}).`,
      );
    }

    const selectedItemIds = availableItems.slice(0, quantity).map((i) => i._id);

    // Acquire write locks on selected inventory items to trigger MongoDB WriteConflict on concurrent transactions
    await this.inventoryItemModel.updateMany(
      { _id: { $in: selectedItemIds } },
      { $inc: { reservationVersion: 1 } },
      { session },
    );

    return selectedItemIds;
  }

  /**
   * Khóa và giữ chỗ tồn kho nguyên tử (Pessimistic document-level locking + Batch reservation insert).
   * 1. Pre-check conflict với $lte/$gte và expiresAt > now để chặn cả TTL lag.
   * 2. Batch insert tất cả reservations trong 1 thao tác với insertMany.
   */
  private async reserveInventoryItemsAtomic(
    itemIds: Types.ObjectId[],
    reservedFrom: Date,
    reservedTo: Date,
    session: any,
    isHourly: boolean = false,
  ): Promise<any[]> {
    if (!itemIds || itemIds.length === 0) return [];

    const now = new Date();
    const overlapFilter = buildReservationOverlapFilter(
      reservedFrom,
      reservedTo,
      isHourly,
      now,
    );
    const conflict = await this.inventoryReservationModel
      .exists({
        inventoryItemId: { $in: itemIds },
        ...overlapFilter,
      })
      .session(session);

    if (conflict) {
      throw new BadRequestException(
        'Sản phẩm vừa bị người khác nhanh tay đặt trước. Vui lòng thử lại!',
      );
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const reservationsToInsert = itemIds.map((itemId) => ({
      inventoryItemId: itemId,
      bookingId: new Types.ObjectId(),
      bookingItemId: new Types.ObjectId(),
      reservedFrom,
      reservedTo,
      status: ReservationStatus.TempReserved,
      expiresAt,
    }));

    return (await this.inventoryReservationModel.insertMany(
      reservationsToInsert,
      { session },
    )) as any[];
  }

  // Getter để map photographyPackageModel sang photoPackageModel cho cả hai bên
  private get photographyPackageModel() {
    return this.photoPackageModel;
  }

  private toPickupReturnLocationSnapshot(provider: Provider): {
    address: string;
    ward?: string | null;
    district?: string | null;
    city?: string | null;
    geo: { type: 'Point'; coordinates: [number, number] } | null;
  } {
    const source =
      provider.rentalSettings?.useBusinessAddressForPickup === false
        ? provider.rentalSettings.pickupLocation
        : provider.address;
    if (!source?.addressLine?.trim()) {
      throw new BadRequestException(
        'The Ao Dai provider must configure a pickup and return location before accepting bookings.',
      );
    }
    const coordinates = source.geo?.coordinates;
    return {
      address: composeLocationAddress(
        source.addressLine,
        source.ward,
        source.district,
        source.city,
      ),
      ward: source.ward ?? null,
      district: source.district ?? null,
      city: source.city ?? null,
      geo:
        coordinates && coordinates.length === 2
          ? { type: 'Point', coordinates: [coordinates[0], coordinates[1]] }
          : null,
    };
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
    if (this.getCustomerIdStr(booking) !== userId) {
      throw new BadRequestException('Bạn không có quyền đổi lịch đơn hàng này');
    }
    if (
      ![BookingStatus.Confirmed, BookingStatus.DepositPaid].includes(
        booking.status,
      )
    ) {
      throw new BadRequestException(
        'Chỉ có thể gửi yêu cầu đổi lịch cho đơn đã xác nhận hoặc đã đặt cọc.',
      );
    }
    if (!Types.ObjectId.isValid(dto.itemId)) {
      throw new BadRequestException('Mục đặt lịch không hợp lệ.');
    }

    const item = await this.bookingItemModel.findOne({
      _id: new Types.ObjectId(dto.itemId),
      bookingId: new Types.ObjectId(bookingId),
    });
    if (!item) throw new NotFoundException('Không tìm thấy mục đặt lịch');
    const existingRequest = (item as any).rescheduleRequest;
    // A request is not an inventory hold.  Once its response window expires,
    // close it here so the customer can submit a fresh request instead of
    // being stuck behind an abandoned PENDING request.
    if (
      existingRequest?.status === 'PENDING' &&
      existingRequest.lockedExpiresAt &&
      new Date(existingRequest.lockedExpiresAt) < new Date()
    ) {
      await this.bookingItemModel.updateOne(
        { _id: item._id, 'rescheduleRequest.status': 'PENDING' },
        {
          $set: {
            'rescheduleRequest.status': 'REJECTED',
            'rescheduleRequest.resolvedAt': new Date(),
            'rescheduleRequest.providerNote':
              'Yêu cầu đổi lịch đã hết hạn phản hồi 12 giờ.',
          },
        },
      );
    } else if (['PENDING', 'PROCESSING'].includes(existingRequest?.status)) {
      throw new BadRequestException(
        'Đơn này đang có một yêu cầu đổi lịch chờ provider phản hồi.',
      );
    }

    const currentStart =
      item.itemType === BookingItemType.Product
        ? item.rentalFrom
        : item.shootDate;
    if (
      currentStart &&
      (currentStart.getTime() - Date.now()) / 3_600_000 < 24
    ) {
      throw new BadRequestException(
        'Chỉ có thể đổi lịch trước giờ bắt đầu ít nhất 24 tiếng.',
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    if (item.itemType === BookingItemType.Product) {
      const isHourly = (item as any).rentalType === 'HOURLY';
      if (isHourly) {
        const targetDate =
          dto.newShootDate ||
          (dto.newRentalFrom
            ? String(dto.newRentalFrom).slice(0, 10)
            : undefined);
        const targetSlot =
          dto.newShootTimeSlot ||
          (dto.newRentalFrom && dto.newRentalTo
            ? `${String(dto.newRentalFrom).slice(11, 16)}-${String(dto.newRentalTo).slice(11, 16)}`
            : undefined);
        if (!targetDate || !targetSlot) {
          throw new BadRequestException(
            'Thuê theo giờ yêu cầu ngày và khung giờ mới.',
          );
        }
        if (targetDate < today) {
          throw new BadRequestException(
            'Ngày thuê mới không thể nằm trong quá khứ.',
          );
        }
      } else {
        if (!dto.newRentalFrom || !dto.newRentalTo) {
          throw new BadRequestException('Yêu cầu ngày nhận và ngày trả mới.');
        }
        if (dto.newRentalFrom < today || dto.newRentalTo < dto.newRentalFrom) {
          throw new BadRequestException('Khoảng ngày thuê mới không hợp lệ.');
        }
      }
    } else if (
      !dto.newShootDate ||
      !dto.newShootTimeSlot ||
      dto.newShootDate < today
    ) {
      throw new BadRequestException(
        'Yêu cầu ngày chụp và khung giờ mới hợp lệ.',
      );
    }

    if (
      item.itemType === BookingItemType.PhotographyPackage &&
      dto.newShootDate &&
      dto.newShootTimeSlot
    ) {
      const photographerId = item.providerId?.toString();
      if (photographerId) {
        const busySchedules =
          await this.getBusySchedulesForProvider(photographerId);
        const isConflict = busySchedules.bookedSlots.some(
          (slot: any) =>
            slot.date === dto.newShootDate &&
            slot.timeSlot &&
            this.isTimeSlotOverlap(slot.timeSlot, dto.newShootTimeSlot!) &&
            slot.bookingItemId !== item._id.toString(),
        );
        if (isConflict) {
          throw new BadRequestException(
            `Khung giờ ${dto.newShootTimeSlot} ngày ${dto.newShootDate} đã có lịch khác hoặc đang được giữ chỗ.`,
          );
        }
      }
    }

    const request = {
      status: 'PENDING',
      requestedBy: new Types.ObjectId(userId),
      requestedAt: new Date(),
      resolvedBy: null,
      resolvedAt: null,
      newRentalFrom: dto.newRentalFrom ? new Date(dto.newRentalFrom) : null,
      newRentalTo: dto.newRentalTo ? new Date(dto.newRentalTo) : null,
      newShootDate: dto.newShootDate ?? null,
      newShootTimeSlot: dto.newShootTimeSlot ?? null,
      // This limits the response window only. Availability is re-checked at approval.
      lockedExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      customerReason: dto.reason?.trim() || null,
      providerNote: null,
    };
    await this.bookingItemModel.updateOne(
      { _id: item._id },
      { $set: { rescheduleRequest: request } },
    );

    const provider = (await this.bookingModel.db
      .model('Provider')
      .findById(item.providerId)
      .select('userId')
      .lean()) as { userId?: Types.ObjectId } | null;
    try {
      if (provider?.userId)
        await this.notificationsService.createNotification(
          provider.userId.toString(),
          'Yêu cầu đổi lịch mới',
          `Khách hàng đã gửi yêu cầu đổi lịch cho đơn ${booking.bookingCode}. Vui lòng duyệt hoặc từ chối.`,
          NotificationType.Booking,
          {
            bookingId: booking._id,
            bookingItemId: item._id,
            action: 'RESCHEDULE_REQUEST',
          },
        );
    } catch {
      // The persisted request remains valid even when notification delivery is unavailable.
    }
    return {
      message: 'Đã gửi yêu cầu đổi lịch. Vui lòng chờ provider xác nhận.',
      status: 'PENDING',
    };
  }

  async resolveRescheduleRequest(
    bookingId: string,
    itemId: string,
    providerUserId: string,
    approved: boolean,
    note?: string,
  ): Promise<Record<string, any>> {
    if (!Types.ObjectId.isValid(itemId))
      throw new BadRequestException('Mục đặt lịch không hợp lệ.');
    const provider = (await this.bookingModel.db
      .model('Provider')
      .findOne({ userId: new Types.ObjectId(providerUserId) })
      .select('_id')
      .lean()) as { _id: Types.ObjectId } | null;
    if (!provider)
      throw new BadRequestException('Không tìm thấy provider hợp lệ.');

    const item = (await this.bookingItemModel
      .findOne({
        _id: new Types.ObjectId(itemId),
        bookingId: new Types.ObjectId(bookingId),
        providerId: provider._id,
      })
      .lean()) as any;
    const request = item?.rescheduleRequest;
    if (!item || !request || request.status !== 'PENDING') {
      throw new NotFoundException(
        'Không tìm thấy yêu cầu đổi lịch đang chờ duyệt.',
      );
    }

    if (
      request.lockedExpiresAt &&
      new Date(request.lockedExpiresAt) < new Date()
    ) {
      await this.bookingItemModel.updateOne(
        { _id: item._id, 'rescheduleRequest.status': 'PENDING' },
        {
          $set: {
            'rescheduleRequest.status': 'REJECTED',
            'rescheduleRequest.resolvedBy': provider._id,
            'rescheduleRequest.resolvedAt': new Date(),
            'rescheduleRequest.providerNote':
              'Yêu cầu dời lịch đã hết thời hạn 12h giữ chỗ.',
          },
        },
      );
      throw new BadRequestException(
        'Yêu cầu dời lịch này đã hết hạn 12h giữ chỗ.',
      );
    }

    const resolvedAt = new Date();
    if (!approved) {
      await this.bookingItemModel.updateOne(
        { _id: item._id, 'rescheduleRequest.status': 'PENDING' },
        {
          $set: {
            'rescheduleRequest.status': 'REJECTED',
            'rescheduleRequest.resolvedBy': provider._id,
            'rescheduleRequest.resolvedAt': resolvedAt,
            'rescheduleRequest.providerNote': note?.trim() || null,
          },
        },
      );
      const booking = (await this.bookingModel
        .findById(bookingId)
        .lean()) as any;
      try {
        if (booking)
          await this.notificationsService.createNotification(
            this.getCustomerIdStr(booking),
            'Yêu cầu đổi lịch bị từ chối',
            `Provider đã từ chối yêu cầu đổi lịch cho đơn ${booking.bookingCode}.${note?.trim() ? ` Lý do: ${note.trim()}` : ''}`,
            NotificationType.Booking,
            {
              bookingId,
              bookingItemId: item._id,
              action: 'RESCHEDULE_REJECTED',
            },
          );
      } catch {
        // A rejection must still be recorded if notification delivery fails.
      }
      return { status: 'REJECTED' };
    }

    const claimed = await this.bookingItemModel.updateOne(
      { _id: item._id, 'rescheduleRequest.status': 'PENDING' },
      { $set: { 'rescheduleRequest.status': 'PROCESSING' } },
    );
    if (!claimed.modifiedCount)
      throw new BadRequestException(
        'Yêu cầu này đã được xử lý bởi thao tác khác.',
      );

    try {
      const booking = (await this.bookingModel
        .findById(bookingId)
        .lean()) as any;
      if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng');
      await this.applyApprovedReschedule(
        bookingId,
        this.getCustomerIdStr(booking),
        {
          itemId,
          newRentalFrom: request.newRentalFrom
            ? new Date(request.newRentalFrom).toISOString().slice(0, 10)
            : undefined,
          newRentalTo: request.newRentalTo
            ? new Date(request.newRentalTo).toISOString().slice(0, 10)
            : undefined,
          newShootDate: request.newShootDate ?? undefined,
          newShootTimeSlot: request.newShootTimeSlot ?? undefined,
          reason: request.customerReason ?? undefined,
        },
      );
      await this.bookingItemModel.updateOne(
        { _id: item._id, 'rescheduleRequest.status': 'PROCESSING' },
        {
          $set: {
            'rescheduleRequest.status': 'APPROVED',
            'rescheduleRequest.resolvedBy': provider._id,
            'rescheduleRequest.resolvedAt': resolvedAt,
            'rescheduleRequest.providerNote': note?.trim() || null,
          },
        },
      );
      return { status: 'APPROVED' };
    } catch (error) {
      await this.bookingItemModel.updateOne(
        { _id: item._id, 'rescheduleRequest.status': 'PROCESSING' },
        { $set: { 'rescheduleRequest.status': 'PENDING' } },
      );
      throw error;
    }
  }

  private async applyApprovedReschedule(
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
    if (this.getCustomerIdStr(booking) !== userId) {
      throw new BadRequestException('Bạn không có quyền đổi lịch đơn hàng này');
    }

    // Only allowed in CONFIRMED or DEPOSIT_PAID status
    const allowedStatuses = [
      BookingStatus.Confirmed,
      BookingStatus.DepositPaid,
    ];
    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Chỉ có thể đổi lịch khi đơn ở trạng thái Đã xác nhận hoặc Đã cọc. Trạng thái hiện tại: ${booking.status}`,
      );
    }

    // Find the booking item to reschedule
    const bookingItem = await this.bookingItemModel.findOne({
      _id: new Types.ObjectId(dto.itemId),
      bookingId: new Types.ObjectId(bookingId),
    });
    if (!bookingItem)
      throw new NotFoundException('Không tìm thấy mục đặt lịch');

    // Must reschedule at least 24h before current start
    const itemType = (bookingItem as any).itemType;
    let currentStart: Date | null = null;
    if (itemType === 'PRODUCT') {
      currentStart = (bookingItem as any).rentalFrom || null;
    } else {
      currentStart = (bookingItem as any).shootDate
        ? new Date((bookingItem as any).shootDate)
        : null;
    }

    if (currentStart) {
      const hoursDiff =
        (currentStart.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursDiff < 24) {
        throw new BadRequestException(
          'Chỉ có thể đổi lịch trước giờ bắt đầu ít nhất 24 tiếng',
        );
      }
    }

    // Validate new dates
    const todayStr = new Date().toISOString().split('T')[0];

    if (itemType === 'PRODUCT') {
      const isHourly = (bookingItem as any).rentalType === 'HOURLY';
      if (isHourly) {
        const newDateStr =
          dto.newShootDate ||
          (dto.newRentalFrom
            ? String(dto.newRentalFrom).slice(0, 10)
            : undefined);
        const newTimeSlot =
          dto.newShootTimeSlot ||
          (dto.newRentalFrom && dto.newRentalTo
            ? `${String(dto.newRentalFrom).slice(11, 16)}-${String(dto.newRentalTo).slice(11, 16)}`
            : undefined);

        if (!newDateStr || !newTimeSlot) {
          throw new BadRequestException(
            'Thuê theo giờ yêu cầu ngày và khung giờ mới (newShootDate/newRentalFrom và newShootTimeSlot)',
          );
        }
        if (newDateStr < todayStr) {
          throw new BadRequestException(
            'Ngày thuê mới không thể nằm trong quá khứ',
          );
        }

        const provider = await this.providerModel
          .findById(bookingItem.providerId)
          .lean();
        const useSlotLeases = !!(
          (bookingItem as any).slotLeaseRequired || provider?.useSlotLeases
        );

        if (useSlotLeases) {
          if (!this.timeSlotEngine) {
            throw new BadRequestException(
              'Hệ thống slot lease chưa sẵn sàng để xử lý đổi lịch.',
            );
          }

          const { startSlotIndex, rentalSlotCount } =
            this.timeSlotEngine.parseAndValidateTimeSlot(newTimeSlot);
          const scheduleConfig = await this.getProviderScheduleConfig(
            bookingItem.providerId,
          );
          const turnaroundSlots =
            provider?.rentalSettings?.turnaroundSlots ?? 1;
          const upfrontBlock = this.timeSlotEngine.calculateUpfrontBlock(
            newDateStr,
            startSlotIndex,
            rentalSlotCount,
            turnaroundSlots,
            scheduleConfig,
          );
          if (!upfrontBlock) {
            throw new BadRequestException(
              'Khung giờ mới không nằm trong giờ hoạt động của cửa hàng hoặc rơi vào ngày nghỉ.',
            );
          }

          let session: ClientSession;
          try {
            if (typeof this.bookingModel.db?.startSession !== 'function') {
              throw new ServiceUnavailableException(
                'Dịch vụ cơ sở dữ liệu không hỗ trợ giao dịch (ClientSession). Không thể đổi lịch an toàn.',
              );
            }
            session = await this.bookingModel.db.startSession();
          } catch (sessionErr: any) {
            if (
              sessionErr instanceof ServiceUnavailableException ||
              sessionErr instanceof ConflictException
            ) {
              throw sessionErr;
            }
            throw new ServiceUnavailableException(
              `Không thể khởi tạo phiên giao dịch: ${sessionErr?.message || sessionErr}`,
            );
          }

          try {
            session.startTransaction();
          } catch (startTxErr: any) {
            await session.endSession();
            throw new ServiceUnavailableException(
              `Không thể bắt đầu giao dịch: ${startTxErr?.message || startTxErr}`,
            );
          }

          try {
            const leaseColl = this.bookingModel.db.collection(
              'inventory_slot_leases',
            );
            const allNewSlots = [
              ...upfrontBlock.rentalSlots.map((s: any) => ({
                dateStr: s.dateStr,
                slotIndex: s.slotIndex,
              })),
              ...upfrontBlock.turnaroundSlots.map((s: any) => ({
                dateStr: s.dateStr,
                slotIndex: s.slotIndex,
              })),
            ];

            // 1. Conflict check against other bookings
            const now = new Date();
            const conflictingLease = await leaseColl.findOne(
              {
                inventoryItemId: (bookingItem as any).inventoryItemId,
                bookingItemId: { $ne: bookingItem._id },
                $or: allNewSlots,
                $and: [
                  {
                    $or: [
                      { status: 'CONFIRMED' },
                      { status: 'TEMP', expiresAt: { $gt: now } },
                    ],
                  },
                ],
              },
              { session },
            );

            if (conflictingLease) {
              throw new ConflictException(
                'Sản phẩm đã có lịch thuê trong khung giờ mới này. Vui lòng chọn khung giờ khác.',
              );
            }

            // 2. Release old leases of this item with RESCHEDULED
            await leaseColl.updateMany(
              {
                bookingItemId: bookingItem._id,
                status: { $in: ['TEMP', 'CONFIRMED'] },
              },
              {
                $set: {
                  status: 'RELEASED',
                  releasedAt: now,
                  releaseReason: 'RESCHEDULED',
                },
              },
              { session },
            );

            // 3. Acquire new leases with CONFIRMED
            const newLeaseDocs = [
              ...upfrontBlock.rentalSlots.map((s: any) => ({
                inventoryItemId: (bookingItem as any).inventoryItemId,
                providerId: bookingItem.providerId,
                bookingId: booking._id,
                bookingItemId: bookingItem._id,
                dateStr: s.dateStr,
                slotIndex: s.slotIndex,
                purpose: 'RENTAL',
                status: 'CONFIRMED',
                expiresAt: null,
                createdAt: now,
                updatedAt: now,
              })),
              ...upfrontBlock.turnaroundSlots.map((s: any) => ({
                inventoryItemId: (bookingItem as any).inventoryItemId,
                providerId: bookingItem.providerId,
                bookingId: booking._id,
                bookingItemId: bookingItem._id,
                dateStr: s.dateStr,
                slotIndex: s.slotIndex,
                purpose: 'TURNAROUND',
                status: 'CONFIRMED',
                expiresAt: null,
                createdAt: now,
                updatedAt: now,
              })),
            ];

            try {
              await leaseColl.insertMany(newLeaseDocs, { session });
            } catch (insertErr: any) {
              if (insertErr.code === 11000) {
                throw new ConflictException(
                  'Khung giờ mới vừa có người khác giữ chỗ.',
                );
              }
              throw insertErr;
            }

            // 4. Update reservation & booking item
            const firstRental = upfrontBlock.rentalSlots[0];
            const lastRental =
              upfrontBlock.rentalSlots[upfrontBlock.rentalSlots.length - 1];
            const startAlloc = this.timeSlotEngine.getSlotAllocation(
              firstRental.dateStr,
              firstRental.slotIndex,
            );
            const endAlloc = this.timeSlotEngine.getSlotAllocation(
              lastRental.dateStr,
              lastRental.slotIndex,
            );

            await this.inventoryReservationModel.updateMany(
              { bookingItemId: bookingItem._id },
              {
                $set: {
                  reservedFrom: startAlloc.start,
                  reservedTo: endAlloc.end,
                },
              },
              { session },
            );

            const fulfillmentUpdate = (bookingItem as any).rentalFulfillment
              ? {
                  'rentalFulfillment.availableFrom': upfrontBlock.availableFrom,
                  'rentalFulfillment.turnaroundSlotsSnapshot':
                    upfrontBlock.turnaroundSlots.length,
                }
              : {
                  rentalFulfillment: {
                    status: 'PENDING',
                    availableFrom: upfrontBlock.availableFrom,
                    turnaroundSlotsSnapshot:
                      upfrontBlock.turnaroundSlots.length,
                    history: [],
                  },
                };

            await this.bookingItemModel.updateOne(
              { _id: bookingItem._id },
              {
                $set: {
                  shootDate: new Date(newDateStr),
                  shootTimeSlot: newTimeSlot,
                  rentalFrom: startAlloc.start,
                  rentalTo: endAlloc.end,
                  startDate: newDateStr,
                  endDate: newDateStr,
                  ...fulfillmentUpdate,
                },
              },
              { session },
            );

            await this.replaceRescheduledSchedules({
              bookingId: booking._id,
              bookingItem,
              scheduleType: BookingScheduleType.RentalPeriod,
              dates: [startAlloc.start],
              timeSlot: newTimeSlot,
              session,
            });

            await session.commitTransaction();
          } catch (err) {
            try {
              await session.abortTransaction();
            } catch (_abortErr) {
              // ignore
            }
            throw err;
          } finally {
            await session.endSession();
          }
        } else {
          // Legacy hourly without slot leases
          const [sh, sm] = newTimeSlot.split('-')[0].split(':').map(Number);
          const [eh, em] = newTimeSlot.split('-')[1].split(':').map(Number);
          const newFrom = new Date(newDateStr);
          newFrom.setHours(sh || 7, sm || 0, 0, 0);
          const newTo = new Date(newDateStr);
          newTo.setHours(eh || 9, em || 0, 0, 0);

          const existingReservation =
            await this.inventoryReservationModel.findOne({
              bookingId: new Types.ObjectId(bookingId),
              bookingItemId: new Types.ObjectId(dto.itemId),
              status: {
                $in: [
                  ReservationStatus.Confirmed,
                  ReservationStatus.TempReserved,
                ],
              },
            });

          if (existingReservation) {
            const overlapFilter = buildReservationOverlapFilter(
              newFrom,
              newTo,
              true,
              new Date(),
            );
            const conflict = await this.inventoryReservationModel.findOne({
              inventoryItemId: (existingReservation as any).inventoryItemId,
              _id: { $ne: (existingReservation as any)._id },
              ...overlapFilter,
            });

            if (conflict) {
              throw new BadRequestException(
                `Sản phẩm đã được đặt lịch trong khoảng thời gian này. Vui lòng chọn ngày khác.`,
              );
            }

            await this.inventoryReservationModel.updateOne(
              { _id: (existingReservation as any)._id },
              { reservedFrom: newFrom, reservedTo: newTo },
            );
          }

          await this.bookingItemModel.updateOne(
            { _id: new Types.ObjectId(dto.itemId) },
            {
              shootDate: new Date(newDateStr),
              shootTimeSlot: newTimeSlot,
              rentalFrom: newFrom,
              rentalTo: newTo,
              startDate: newDateStr,
              endDate: newDateStr,
            },
          );

          await this.replaceRescheduledSchedules({
            bookingId: booking._id,
            bookingItem,
            scheduleType: BookingScheduleType.RentalPeriod,
            dates: [newFrom],
            timeSlot: newTimeSlot,
          });
        }
      } else {
        // Daily rental
        if (!dto.newRentalFrom || !dto.newRentalTo) {
          throw new BadRequestException('Yêu cầu ngày nhận và ngày trả mới');
        }
        if (dto.newRentalFrom < todayStr) {
          throw new BadRequestException(
            'Ngày nhận mới không thể nằm trong quá khứ',
          );
        }
        if (dto.newRentalTo < dto.newRentalFrom) {
          throw new BadRequestException(
            'Ngày trả phải sau hoặc bằng ngày nhận',
          );
        }

        // Check for conflicts on the inventory reservation
        const existingReservation =
          await this.inventoryReservationModel.findOne({
            bookingId: new Types.ObjectId(bookingId),
            bookingItemId: new Types.ObjectId(dto.itemId),
            status: {
              $in: [
                ReservationStatus.Confirmed,
                ReservationStatus.TempReserved,
              ],
            },
          });

        if (existingReservation) {
          // Check if any OTHER reservation conflicts with new dates for same inventory item
          const newFrom = new Date(dto.newRentalFrom);
          newFrom.setHours(0, 0, 0, 0);
          const newTo = new Date(dto.newRentalTo);
          newTo.setHours(23, 59, 59, 999);

          const conflict = await this.inventoryReservationModel.findOne({
            inventoryItemId: (existingReservation as any).inventoryItemId,
            _id: { $ne: (existingReservation as any)._id },
            status: {
              $in: [
                ReservationStatus.Confirmed,
                ReservationStatus.TempReserved,
              ],
            },
            $or: [
              { reservedFrom: { $lte: newTo }, reservedTo: { $gte: newFrom } },
            ],
          });

          if (conflict) {
            throw new BadRequestException(
              `Sản phẩm đã được đặt lịch trong khoảng thời gian này. Vui lòng chọn ngày khác.`,
            );
          }

          // Update the reservation dates
          await this.inventoryReservationModel.updateOne(
            { _id: (existingReservation as any)._id },
            { reservedFrom: newFrom, reservedTo: newTo },
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
        const dailyScheduleDates: Date[] = [];
        const dailyScheduleFrom = new Date(dto.newRentalFrom);
        dailyScheduleFrom.setHours(0, 0, 0, 0);
        const dailyScheduleTo = new Date(dto.newRentalTo);
        dailyScheduleTo.setHours(23, 59, 59, 999);
        for (
          const date = new Date(dailyScheduleFrom);
          date <= dailyScheduleTo;
          date.setDate(date.getDate() + 1)
        ) {
          dailyScheduleDates.push(new Date(date));
        }
        await this.replaceRescheduledSchedules({
          bookingId: booking._id,
          bookingItem,
          scheduleType: BookingScheduleType.RentalPeriod,
          dates: dailyScheduleDates,
          timeSlot: null,
        });
      }
    } else if (itemType === 'PHOTOGRAPHY_PACKAGE') {
      if (!dto.newShootDate) {
        throw new BadRequestException('Yêu cầu ngày chụp mới');
      }
      if (dto.newShootDate < todayStr) {
        throw new BadRequestException(
          'Ngày chụp mới không thể nằm trong quá khứ',
        );
      }

      const photographerId = bookingItem.providerId?.toString();
      let reassignedDecision: {
        assignedStaffId: Types.ObjectId | null;
        assignedStaffSnapshot: any;
      } | null = null;

      if (photographerId && dto.newShootTimeSlot) {
        const parsedRange = parseTimeRangeToMinutes(dto.newShootTimeSlot);
        if (this.staffAvailabilityService && parsedRange) {
          const currentSchedule = await this.bookingScheduleModel
            .findOne({
              bookingId: booking._id,
              bookingItemId: bookingItem._id,
              scheduleType: BookingScheduleType.Photoshoot,
              status: {
                $in: [
                  BookingScheduleStatus.Confirmed,
                  BookingScheduleStatus.Scheduled,
                  BookingScheduleStatus.Held,
                ],
              },
            })
            .select('_id assignedStaffId')
            .lean()
            .exec();
          const evaluation = await this.staffAvailabilityService.evaluateSessions(
            new Types.ObjectId(photographerId),
            [
              {
                clientId: 'reschedule',
                dateKey: dto.newShootDate,
                startMin: parsedRange.startMin,
                endMin: parsedRange.endMin,
              },
            ],
            {
              excludeScheduleId: currentSchedule?._id,
              excludeBookingItemId: bookingItem._id,
              preferStaffIdForReschedule:
                (currentSchedule as any)?.assignedStaffId?.toString?.() ?? null,
            },
          );
          if (!evaluation.valid) {
            throw new BadRequestException(
              evaluation.errors[0]?.message ||
                `Thợ ảnh đã có lịch vào ngày ${dto.newShootDate} khung giờ ${dto.newShootTimeSlot}`,
            );
          }
          const decision = evaluation.assignmentsByClientId.get('reschedule');
          if (decision) {
            reassignedDecision = {
              assignedStaffId: decision.assignedStaffId,
              assignedStaffSnapshot: decision.assignedStaffSnapshot,
            };
          }
        } else {
          const busySchedules =
            await this.getBusySchedulesForProvider(photographerId);
          const isSlotConflict = busySchedules.bookedSlots.some(
            (slot: any) =>
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
      }

      // Update booking item
      await this.bookingItemModel.updateOne(
        { _id: new Types.ObjectId(dto.itemId) },
        {
          shootDate: dto.newShootDate,
          ...(dto.newShootTimeSlot
            ? { shootTimeSlot: dto.newShootTimeSlot }
            : {}),
        },
      );

      await this.replaceRescheduledSchedules({
        bookingId: booking._id,
        bookingItem,
        scheduleType: BookingScheduleType.Photoshoot,
        dates: [new Date(dto.newShootDate)],
        timeSlot: dto.newShootTimeSlot ?? null,
      });

      if (dto.newShootTimeSlot) {
        const parsedRange = parseTimeRangeToMinutes(dto.newShootTimeSlot);
        if (parsedRange) {
          const startHHmm = `${String(Math.floor(parsedRange.startMin / 60)).padStart(2, '0')}:${String(parsedRange.startMin % 60).padStart(2, '0')}`;
          const endHHmm = `${String(Math.floor(parsedRange.endMin / 60)).padStart(2, '0')}:${String(parsedRange.endMin % 60).padStart(2, '0')}`;
          const nextStartsAt = new Date(`${dto.newShootDate}T${startHHmm}:00+07:00`);
          const nextEndsAt = new Date(`${dto.newShootDate}T${endHHmm}:00+07:00`);
          await this.bookingScheduleModel.updateMany(
            {
              bookingId: booking._id,
              bookingItemId: bookingItem._id,
              scheduleType: BookingScheduleType.Photoshoot,
              status: {
                $in: [
                  BookingScheduleStatus.Scheduled,
                  BookingScheduleStatus.Confirmed,
                ],
              },
            },
            {
              $set: {
                startsAt: nextStartsAt,
                endsAt: nextEndsAt,
                providerLocalDate: dto.newShootDate,
                ...(reassignedDecision
                  ? {
                      assignedStaffId: reassignedDecision.assignedStaffId,
                      assignedStaffSnapshot:
                        reassignedDecision.assignedStaffSnapshot,
                    }
                  : {}),
              },
            },
          );
        }
      }
      if (photographerId) {
        bumpProviderAvailabilityVersion(photographerId);
      }
    }

    // Send notification (best effort)
    try {
      await this.notificationsService.createNotification(
        this.getCustomerIdStr(booking),
        'Đổi lịch thành công',
        `Đơn hàng ${booking.bookingCode} đã được đổi lịch thành công.`,
        NotificationType.Booking,
        { bookingId: booking._id },
      );
    } catch (_e) {
      /* ignore notification error */
    }

    if (bookingItem?.productId) {
      this.invalidateProductBusyCache(bookingItem.productId.toString());
    }

    return { message: 'Đổi lịch thành công', bookingId };
  }

  /**
   * Keep an immutable record of the old schedule and create its replacement.
   * Updating old rows to RESCHEDULED without inserting these replacements made
   * approved bookings disappear from provider calendars.
   */
  private async replaceRescheduledSchedules(input: {
    bookingId: Types.ObjectId;
    bookingItem: any;
    scheduleType: BookingScheduleType;
    dates: Date[];
    timeSlot: string | null;
    session?: ClientSession;
  }): Promise<void> {
    const { bookingId, bookingItem, scheduleType, dates, timeSlot, session } =
      input;
    const options = session ? { session } : undefined;
    await this.bookingScheduleModel.updateMany(
      {
        bookingId,
        bookingItemId: bookingItem._id,
        status: BookingScheduleStatus.Scheduled,
      },
      {
        $set: {
          status: BookingScheduleStatus.Rescheduled,
          cancellationReason: 'RESCHEDULED',
        },
      },
      options,
    );

    if (!dates.length) return;
    await this.bookingScheduleModel.create(
      dates.map((scheduledDate) => ({
        bookingId,
        bookingItemId: bookingItem._id,
        providerId: bookingItem.providerId ?? null,
        scheduleType,
        scheduledDate,
        timeSlot,
        status: BookingScheduleStatus.Scheduled,
      })),
      options,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. createBooking — tổng hợp nhiều items, hỗ trợ promo code
  // ──────────────────────────────────────────────────────────────────────────

  private createRentalFulfillmentForDates(
    rentalType: string | undefined,
    rentalFrom?: string | Date | null,
    rentalTo?: string | Date | null,
    shootDate?: string | Date | null,
    shootTimeSlot?: string | null,
  ) {
    const pickupDueAt = rentalFrom
      ? new Date(rentalFrom)
      : shootDate
        ? new Date(shootDate)
        : new Date();
    const returnDueAt = rentalTo
      ? new Date(rentalTo)
      : shootDate
        ? new Date(shootDate)
        : new Date(pickupDueAt);
    if (rentalType === 'DAILY') {
      returnDueAt.setHours(23, 59, 59, 999);
    } else if (shootTimeSlot?.includes('-')) {
      const endTime = shootTimeSlot.split('-')[1]?.trim();
      const [hours, minutes] = (endTime || '').split(':').map(Number);
      if (Number.isFinite(hours) && Number.isFinite(minutes))
        returnDueAt.setHours(hours, minutes, 0, 0);
    }
    return createRentalFulfillment(returnDueAt, pickupDueAt);
  }

  private expandRentalUnits<T extends Record<string, any>>(details: T[]): T[] {
    const expanded: T[] = [];
    for (const detail of details) {
      if (detail.itemType !== BookingItemType.Product) {
        expanded.push(detail);
        continue;
      }
      const quantity = Number(detail.quantity || 1);
      if (quantity <= 1) {
        expanded.push({ ...detail, quantity: 1 });
        continue;
      }
      const reservations = Array.isArray(detail.reservations)
        ? detail.reservations
        : [];
      if (reservations.length !== quantity) {
        throw new BadRequestException(
          'Mỗi đơn vị áo dài phải có một inventory reservation riêng.',
        );
      }
      const totalDiscount = Number(detail.comboDiscountAmount || 0);
      let distributedDiscount = 0;
      reservations.forEach((reservation: any, index: number) => {
        const unitDiscount =
          index === reservations.length - 1
            ? totalDiscount - distributedDiscount
            : Math.round(totalDiscount / quantity);
        distributedDiscount += unitDiscount;
        expanded.push({
          ...detail,
          quantity: 1,
          inventoryItemId: reservation.inventoryItemId,
          reservations: [reservation],
          comboDiscountAmount: unitDiscount,
        });
      });
    }
    return expanded;
  }
  async createBooking(
    userIdStr: string,
    dto: CreateBookingDto,
  ): Promise<BookingDocument> {
    if (this.bookingCreationService) {
      const result = await this.bookingCreationService.createBooking(
        userIdStr,
        dto,
      );
      if (dto.items) {
        dto.items.forEach((it) => {
          if (it.productId)
            this.invalidateProductBusyCache(it.productId.toString());
        });
      }
      return result;
    }
    return this.runInTransaction(async (session) => {
      const customerId = new Types.ObjectId(userIdStr);
      const bookingCode = `B${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;

      let subTotal = 0;
      const itemDetails: Array<
        Partial<BookingItem> & { reservations?: any[] }
      > = [];
      const providerIdsSet = new Set<string>();
      let booking: any = null;

      const todayStr = new Date().toISOString().split('T')[0];
      for (const item of dto.items) {
        if (item.rentalFrom) {
          const itemDateStr = new Date(item.rentalFrom)
            .toISOString()
            .split('T')[0];
          if (itemDateStr < todayStr) {
            throw new BadRequestException(
              'Ngày bắt đầu thuê áo dài không thể nằm trong quá khứ.',
            );
          }
        }
        if (item.shootDate) {
          const itemDateStr = new Date(item.shootDate)
            .toISOString()
            .split('T')[0];
          if (itemDateStr < todayStr) {
            throw new BadRequestException(
              'Ngày đặt lịch chụp ảnh không thể nằm trong quá khứ.',
            );
          }
        }
      }

      for (const item of dto.items) {
        let unitPrice = 0;
        let depositAmount = 0;
        let replacementValue: number | null = null;
        let providerId: Types.ObjectId | null = null;
        let itemType: BookingItemType;
        let inventoryItemId: Types.ObjectId | null = null;
        const itemReservations: any[] = [];
        let reservedFrom: Date | null = null;
        let reservedTo: Date | null = null;

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
          replacementValue = product.replacementValue ?? null;

          const rType = item.rentalType === 'HOURLY' ? 'HOURLY' : 'DAILY';
          if (rType === 'HOURLY') {
            // Chiến dịch giá (giảm/phụ thu) áp theo ngày thuê, có trần tối đa bằng giá ngày.
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
            const hourlyQuote = await this.campaignService.calculateHourlyRental(
              product.basePrice,
              product.hourlyPrice,
              product.providerId,
              item.shootDate ?? new Date(),
              durationHours,
            );
            unitPrice = hourlyQuote.total;
          } else {
            // Không đủ ngày hợp lệ thì tính 1 ngày (giữ hành vi cũ); chiến dịch áp theo từng ngày thuê.
            let rentalFrom = new Date();
            let rentalTo = rentalFrom;
            if (item.rentalFrom && item.rentalTo) {
              const start = new Date(item.rentalFrom);
              const end = new Date(item.rentalTo);
              if (
                !isNaN(start.getTime()) &&
                !isNaN(end.getTime()) &&
                end >= start
              ) {
                rentalFrom = start;
                rentalTo = end;
              }
            }
            const { total } = await this.campaignService.calculateDailyRental(
              product.basePrice,
              product.providerId,
              rentalFrom,
              rentalTo,
            );
            unitPrice = total;
          }

          reservedFrom = null;
          reservedTo = null;

          if (
            item.rentalType === 'HOURLY' &&
            item.shootDate &&
            item.shootTimeSlot
          ) {
            const [startTimeStr, endTimeStr] = item.shootTimeSlot
              .split('-')
              .map((s) => s.trim());
            const [sh, sm] = startTimeStr.split(':').map(Number);
            const [eh, em] = endTimeStr.split(':').map(Number);

            reservedFrom = new Date(item.shootDate);
            reservedFrom.setHours(sh, sm, 0, 0);
            reservedTo = new Date(item.shootDate);
            reservedTo.setHours(eh, em, 0, 0);
          } else if (item.rentalFrom && item.rentalTo) {
            reservedFrom = new Date(item.rentalFrom);
            reservedFrom.setHours(0, 0, 0, 0);
            reservedTo = new Date(item.rentalTo);
            reservedTo.setHours(23, 59, 59, 999);
          }

          if (reservedFrom && reservedTo) {
            const sizeVal = item.selectedSize
              ? item.selectedSize.toUpperCase()
              : 'M';
            const colorVal = this.normalizeColor(item.selectedColor);

            if (product.sizes && product.sizes.length > 0) {
              const isSizeSupported = product.sizes.some(
                (s: string) => s.trim().toUpperCase() === sizeVal,
              );
              if (!isSizeSupported) {
                throw new BadRequestException(
                  `Kích cỡ ${item.selectedSize || 'M'} không khả dụng cho sản phẩm ${product.name}. Các kích cỡ khả dụng: ${product.sizes.join(', ')}`,
                );
              }
            }
            if (product.colors && product.colors.length > 0) {
              const isColorSupported = product.colors.some(
                (c: string) => this.normalizeColor(c) === colorVal,
              );
              if (!isColorSupported) {
                throw new BadRequestException(
                  `Màu sắc ${item.selectedColor || 'WHITE'} không khả dụng cho sản phẩm ${product.name}. Các màu khả dụng: ${product.colors.join(', ')}`,
                );
              }
            }

            const quantity = item.quantity || 1;
            const availableItemIds = await this.findAvailableInventory(
              product._id,
              sizeVal,
              colorVal,
              reservedFrom,
              reservedTo,
              quantity,
              session,
            );

            inventoryItemId = availableItemIds[0];

            const createdReservations = await this.reserveInventoryItemsAtomic(
              availableItemIds,
              reservedFrom,
              reservedTo,
              session,
            );
            itemReservations.push(...createdReservations);
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
          providerInfo = await this.providerModel
            .findById(providerId)
            .session(session);
          if (!providerInfo || providerInfo.status !== 'ACTIVE') {
            throw new BadRequestException(
              'Cửa hàng đối tác hoặc nhiếp ảnh gia hiện không hoạt động hoặc đang bị tạm đình chỉ.',
            );
          }
        }

        const pickupReturnLocationSnapshot =
          itemType === BookingItemType.Product && providerInfo
            ? this.toPickupReturnLocationSnapshot(providerInfo)
            : null;

        const quantity = item.quantity || 1;
        subTotal += unitPrice * quantity;

        const comboDiscountPercent =
          dto.bookingType === BookingType.Combo && providerInfo
            ? providerInfo.comboDiscountPercent !== undefined
              ? providerInfo.comboDiscountPercent
              : 10
            : 0;
        const comboDiscountAmount = Math.round(
          unitPrice * quantity * (comboDiscountPercent / 100),
        );

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
          replacementValue,
          quantity,
          rentalFrom:
            reservedFrom ||
            (item.rentalFrom ? new Date(item.rentalFrom) : null),
          rentalTo:
            reservedTo || (item.rentalTo ? new Date(item.rentalTo) : null),
          shootDate: item.shootDate ? new Date(item.shootDate) : null,
          shootTimeSlot: item.shootTimeSlot || null,
          customRequests: item.customRequests || '',
          referenceImage: item.referenceImage || null,
          selectedSize: item.selectedSize || null,
          selectedColor: item.selectedColor || null,
          pickupReturnLocationSnapshot,
          rentalFulfillment:
            itemType === BookingItemType.Product
              ? this.createRentalFulfillmentForDates(
                  item.rentalType,
                  item.rentalFrom,
                  item.rentalTo,
                  item.shootDate,
                  item.shootTimeSlot,
                )
              : null,
          rentalType: item.rentalType === 'HOURLY' ? 'HOURLY' : 'DAILY',
          comboDiscountPercent,
          comboDiscountAmount,
          reservations: itemReservations,
        });
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
              const dateStr = current.toISOString().split('T')[0];
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
            const dateStr = new Date(detail.shootDate)
              .toISOString()
              .split('T')[0];
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
            const dateStr = new Date(detail.shootDate)
              .toISOString()
              .split('T')[0];
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
      const productDepositTotal = itemDetails
        .filter((i) => i.itemType === BookingItemType.Product)
        .reduce(
          (sum, i) => sum + (i.depositAmount || 0) * (i.quantity || 1),
          0,
        );
      const serviceFee = 0;
      const grandTotal =
        Math.max(subTotal - discountAmount + travelFee, 0) +
        productDepositTotal;

      // Determine contract flow version based on rental providers
      let contractFlowVersion: 2 | null = null;
      const bType = dto.bookingType || BookingType.AoDaiRental;
      const isRentalType =
        bType === BookingType.AoDaiRental || bType === BookingType.Combo;

      const rentalProviderIdsSet = new Set(
        itemDetails
          .filter((i) => i.itemType === BookingItemType.Product && i.providerId)
          .map((i) => i.providerId!.toString()),
      );

      if (isRentalType && rentalProviderIdsSet.size > 0) {
        const statuses = new Set<
          'LEGACY' | 'CONTRACT_ACTIVE' | 'CONTRACT_SUSPENDED'
        >();
        for (const provIdStr of rentalProviderIdsSet) {
          const provStatus = await this.determineShopContractStatus(
            new Types.ObjectId(provIdStr),
            session,
          );
          statuses.add(provStatus);
        }

        if (statuses.has('CONTRACT_SUSPENDED')) {
          throw new BadRequestException(
            'PROVIDER_CONTRACT_SUSPENDED: Shop đang tạm ngưng nhận đơn thuê do cần cập nhật lại quy chế sàn giao dịch điện tử. Vui lòng liên hệ Shop.',
          );
        }

        if (statuses.has('LEGACY') && statuses.has('CONTRACT_ACTIVE')) {
          throw new BadRequestException(
            'MIXED_CONTRACT_FLOW_UNSUPPORTED: Đơn hàng không thể kết hợp giữa Shop truyền thống và Shop áp dụng Hợp đồng điện tử. Quý khách vui lòng đặt hàng riêng cho từng Shop.',
          );
        }

        if (statuses.has('CONTRACT_ACTIVE')) {
          contractFlowVersion = 2;
        } else {
          contractFlowVersion = null;
        }
      }

      const holdExpiresAt =
        contractFlowVersion === 2
          ? new Date(Date.now() + 15 * 60 * 1000)
          : undefined;

      const [savedBookingDoc] = await this.bookingModel.create(
        [
          {
            bookingCode,
            customerId,
            providerIds: Array.from(providerIdsSet).map(
              (id) => new Types.ObjectId(id),
            ),
            bookingType: dto.bookingType || BookingType.AoDaiRental,
            contractFlowVersion,
            status: BookingStatus.PendingPayment,
            ...(holdExpiresAt ? { holdExpiresAt } : {}),
            pricingSummary: {
              subTotal,
              depositTotal: productDepositTotal,
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
        ],
        { session },
      );

      booking = savedBookingDoc;

      if (dto.bookingType === BookingType.Combo) {
        const prodItem = itemDetails.find((i) => i.productId);
        const pkgItem = itemDetails.find((i) => i.photographyPackageId);
        if (prodItem?.productId && pkgItem?.photographyPackageId) {
          try {
            await this.bookingModel.db
              .model('ComboPromotion')
              .updateOne(
                {
                  productId: prodItem.productId,
                  photographyPackageId: pkgItem.photographyPackageId,
                  status: 'ACTIVE',
                },
                { $inc: { usedCount: 1 } },
              )
              .session(session)
              .exec();
          } catch (e) {
            console.warn(
              'Failed to increment ComboPromotion usedCount in createBooking:',
              e,
            );
          }
        }
      }

      const bookingItemDetails = this.expandRentalUnits(itemDetails);
      for (const detail of bookingItemDetails) {
        const [savedItem] = await this.bookingItemModel.create(
          [
            {
              ...detail,
              bookingId: booking._id,
            },
          ],
          { session },
        );

        if (detail.reservations && detail.reservations.length > 0) {
          const resIds = detail.reservations.map((res: any) => res._id);
          await this.inventoryReservationModel
            .updateMany(
              { _id: { $in: resIds } },
              {
                $set: {
                  bookingId: booking._id,
                  bookingItemId: savedItem._id,
                },
              },
            )
            .session(session);
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
              await this.bookingScheduleModel.create(
                [
                  {
                    bookingId: booking._id,
                    bookingItemId: savedItem._id,
                    scheduleType: BookingScheduleType.RentalPeriod,
                    scheduledDate: new Date(current),
                    timeSlot: null,
                    status: BookingScheduleStatus.Scheduled,
                  },
                ],
                { session },
              );
              current.setDate(current.getDate() + 1);
            }
          } else if (detail.rentalType === 'HOURLY' && detail.shootDate) {
            await this.bookingScheduleModel.create(
              [
                {
                  bookingId: booking._id,
                  bookingItemId: savedItem._id,
                  scheduleType: BookingScheduleType.RentalPeriod,
                  scheduledDate: detail.shootDate,
                  timeSlot: detail.shootTimeSlot,
                  status: BookingScheduleStatus.Scheduled,
                },
              ],
              { session },
            );
          }
        } else if (detail.itemType === BookingItemType.PhotographyPackage) {
          if (detail.shootDate) {
            await this.bookingScheduleModel.create(
              [
                {
                  bookingId: booking._id,
                  bookingItemId: savedItem._id,
                  scheduleType: BookingScheduleType.Photoshoot,
                  scheduledDate: detail.shootDate,
                  timeSlot: detail.shootTimeSlot,
                  status: BookingScheduleStatus.Scheduled,
                },
              ],
              { session },
            );
          }
        }
      }

      if (promotionId) {
        await this.promotionsService.incrementUsage(promotionId);
      }

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
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. createProductBooking — thuê áo dài theo ngày hoặc theo giờ
  // ──────────────────────────────────────────────────────────────────────────
  async createProductBooking(
    customerId: string,
    dto: CreateProductBookingDto,
  ): Promise<BookingDocument> {
    if (this.bookingCreationService) {
      return this.bookingCreationService.createProductBooking(customerId, dto);
    }
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

    if (quantity !== 1) {
      throw new BadRequestException(
        'MVP yêu cầu quantity = 1 cho API thuê đơn lẻ. Với nhiều áo dài, hãy tạo nhiều booking item qua checkout.',
      );
    }

    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Mã sản phẩm không hợp lệ');
    }

    const product = await this.productsService.getProductById(productId);
    if (!product) {
      throw new NotFoundException(
        `Không tìm thấy sản phẩm với ID: ${productId}`,
      );
    }

    const provider = await this.providerModel.findById(product.providerId);
    if (!provider || provider.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cửa hàng đối tác hiện không hoạt động hoặc đang bị tạm đình chỉ.',
      );
    }

    const pickupReturnLocationSnapshot =
      this.toPickupReturnLocationSnapshot(provider);

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Định dạng ngày bắt đầu không hợp lệ');
    }

    // Chặn đặt lịch trong quá khứ ở backend
    const todayStr = new Date().toISOString().split('T')[0];
    const startDateStr = start.toISOString().split('T')[0];
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

      // Chiến dịch giá (giảm/phụ thu) áp theo ngày thuê, có trần tối đa bằng giá ngày.
      const hourlyQuote = await this.campaignService.calculateHourlyRental(
        product.basePrice,
        product.hourlyPrice,
        product.providerId,
        start,
        durationHours,
      );

      unitPrice = hourlyQuote.total;
      subTotal = hourlyQuote.total * quantity;
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

      // Chiến dịch giá áp theo từng ngày thuê; unitPrice lưu tổng tiền thuê của 1 bộ cho cả kỳ để khớp Settlement.
      const { total } = await this.campaignService.calculateDailyRental(
        product.basePrice,
        product.providerId,
        start,
        end,
      );
      unitPrice = total;
      subTotal = total * quantity;
      rentalFrom = start;
      rentalTo = end;
    }

    const depositTotal = product.depositAmount * quantity;
    const grandTotal = subTotal + depositTotal;

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
        price: product.basePrice,
        depositAmount: product.depositAmount,
        effectiveFrom: new Date(),
        note: 'Tự động tạo khi booking',
      });
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

    return this.runInTransaction(async (session) => {
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

      const isHourly = rentalType === 'HOURLY';
      const availableItemIds = await this.findAvailableInventory(
        product._id as Types.ObjectId,
        sizeVal,
        colorVal,
        reservedFrom,
        reservedTo,
        quantity,
        session,
        isHourly,
      );

      const availableItemFirst = availableItemIds[0];

      const itemReservations = await this.reserveInventoryItemsAtomic(
        availableItemIds,
        reservedFrom,
        reservedTo,
        session,
        isHourly,
      );

      const provStatus = await this.determineShopContractStatus(
        product.providerId,
        session,
      );
      if (provStatus === 'CONTRACT_SUSPENDED') {
        throw new BadRequestException(
          'PROVIDER_CONTRACT_SUSPENDED: Shop đang tạm ngưng nhận đơn thuê do cần cập nhật lại quy chế sàn giao dịch điện tử. Vui lòng liên hệ Shop.',
        );
      }
      const contractFlowVersion: 2 | null =
        provStatus === 'CONTRACT_ACTIVE' ? 2 : null;
      const holdExpiresAt =
        contractFlowVersion === 2
          ? new Date(Date.now() + 15 * 60 * 1000)
          : undefined;

      const booking = new this.bookingModel({
        bookingCode,
        customerId: new Types.ObjectId(customerId),
        providerIds: [product.providerId],
        bookingType: BookingType.AoDaiRental,
        contractFlowVersion,
        status: BookingStatus.PendingPayment,
        ...(holdExpiresAt ? { holdExpiresAt } : {}),
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

      const savedBooking = await booking.save({ session });

      const bookingItem = new this.bookingItemModel({
        bookingId: savedBooking._id,
        providerId: product.providerId,
        itemType: BookingItemType.Product,
        productId: product._id,
        inventoryItemId: availableItemFirst,
        priceVersionId: priceVersion._id,
        unitPrice,
        depositAmount: product.depositAmount,
        replacementValue: product.replacementValue ?? null,
        quantity,
        rentalFrom: reservedFrom || (rentalFrom ? new Date(rentalFrom) : null),
        rentalTo: reservedTo || (rentalTo ? new Date(rentalTo) : null),
        shootDate,
        shootTimeSlot,
        rentalType,
        selectedSize: size.toUpperCase(),
        selectedColor: color.toUpperCase(),
        pickupReturnLocationSnapshot,
        rentalFulfillment: this.createRentalFulfillmentForDates(
          rentalType,
          rentalFrom,
          rentalTo,
          shootDate,
          shootTimeSlot,
        ),
        customRequests: null,
      });

      const savedBookingItem = await bookingItem.save({ session });

      if (itemReservations && itemReservations.length > 0) {
        const resIds = itemReservations.map((res: any) => res._id);
        await this.inventoryReservationModel
          .updateMany(
            { _id: { $in: resIds } },
            {
              $set: {
                bookingId: savedBooking._id,
                bookingItemId: savedBookingItem._id,
              },
            },
          )
          .session(session);
      }

      if (rentalType === 'DAILY' && rentalFrom && rentalTo) {
        const startDay = new Date(rentalFrom);
        const endDay = new Date(rentalTo);
        const current = new Date(startDay);
        while (current <= endDay) {
          await this.bookingScheduleModel.create(
            [
              {
                bookingId: savedBooking._id,
                bookingItemId: savedBookingItem._id,
                scheduleType: BookingScheduleType.RentalPeriod,
                scheduledDate: new Date(current),
                timeSlot: null,
                status: BookingScheduleStatus.Scheduled,
              },
            ],
            { session },
          );
          current.setDate(current.getDate() + 1);
        }
      } else if (rentalType === 'HOURLY' && shootDate) {
        await this.bookingScheduleModel.create(
          [
            {
              bookingId: savedBooking._id,
              bookingItemId: savedBookingItem._id,
              scheduleType: BookingScheduleType.RentalPeriod,
              scheduledDate: shootDate,
              timeSlot: shootTimeSlot,
              status: BookingScheduleStatus.Scheduled,
            },
          ],
          { session },
        );
      }

      return savedBooking;
    });
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
      throw new BadRequestException(
        'Nhiếp ảnh gia hiện không hoạt động hoặc đang bị tạm đình chỉ.',
      );
    }

    const date = new Date(shootDate);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Định dạng ngày chụp không hợp lệ');
    }

    // Chặn đặt lịch chụp ảnh trong quá khứ ở backend
    const todayStr = new Date().toISOString().split('T')[0];
    const shootDateStr = date.toISOString().split('T')[0];
    if (shootDateStr < todayStr) {
      throw new BadRequestException(
        'Ngày đặt lịch chụp ảnh không thể nằm trong quá khứ.',
      );
    }

    // Kiểm tra trùng lịch chụp (chỉ đếm active bookings)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const activeBookings = await this.bookingModel
      .find({
        providerIds: pkg.providerId,
        status: {
          $nin: [
            BookingStatus.Cancelled,
            BookingStatus.Completed,
            BookingStatus.Returned,
            BookingStatus.Refunded,
          ],
        },
      })
      .select('_id');
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
    const depositTotal = pkg.price; // 100% thanh toán trước cho dịch vụ chụp ảnh
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
        await this.bookingScheduleModel.deleteMany({
          bookingId: savedBooking._id,
        });
      }
      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Các phương thức truy vấn & quản lý trạng thái
  // ──────────────────────────────────────────────────────────────────────────

  async requestPhotographyLocationChange(
    bookingIdValue: string,
    scheduleIdValue: string,
    customerIdValue: string,
    input: {
      address: string;
      latitude: number;
      longitude: number;
      note?: string;
    },
  ) {
    if (
      !Types.ObjectId.isValid(bookingIdValue) ||
      !Types.ObjectId.isValid(scheduleIdValue)
    ) {
      throw new BadRequestException(
        'Booking or photoshoot schedule is invalid.',
      );
    }
    if (
      !input.address?.trim() ||
      !Number.isFinite(input.latitude) ||
      !Number.isFinite(input.longitude)
    ) {
      throw new BadRequestException(
        'A precise replacement shoot location is required.',
      );
    }
    const booking = await this.bookingModel.findById(bookingIdValue).exec();
    if (!booking) throw new NotFoundException('Booking not found.');
    if (booking.customerId.toString() !== customerIdValue) {
      throw new ForbiddenException(
        'Only the booking customer can request a location change.',
      );
    }
    if (booking.status !== BookingStatus.Confirmed) {
      throw new BadRequestException(
        'A location change request is available only after provider confirmation.',
      );
    }
    const schedule = await this.bookingScheduleModel
      .findOne({
        _id: new Types.ObjectId(scheduleIdValue),
        bookingId: booking._id,
        scheduleType: BookingScheduleType.Photoshoot,
        status: BookingScheduleStatus.Confirmed,
      })
      .exec();
    if (!schedule)
      throw new NotFoundException('Confirmed photoshoot schedule not found.');
    if (schedule.locationChangeRequest?.status === 'PENDING') {
      throw new BadRequestException(
        'A location change request is already pending for this photoshoot.',
      );
    }
    schedule.locationChangeRequest = {
      status: 'PENDING',
      requestedBy: new Types.ObjectId(customerIdValue),
      requestedAt: new Date(),
      note: input.note?.trim() || null,
      requestedLocation: {
        address: input.address.trim(),
        geo: { type: 'Point', coordinates: [input.longitude, input.latitude] },
      },
    };
    await schedule.save();
    return schedule.locationChangeRequest;
  }

  async resolvePhotographyLocationChange(
    bookingIdValue: string,
    scheduleIdValue: string,
    providerUserIdValue: string,
    approved: boolean,
    note?: string,
  ) {
    if (
      !Types.ObjectId.isValid(bookingIdValue) ||
      !Types.ObjectId.isValid(scheduleIdValue)
    ) {
      throw new BadRequestException(
        'Booking or photoshoot schedule is invalid.',
      );
    }
    const provider = await this.providerModel
      .findOne({ userId: new Types.ObjectId(providerUserIdValue) })
      .exec();
    if (!provider) throw new ForbiddenException('Provider profile not found.');
    const schedule = await this.bookingScheduleModel
      .findOne({
        _id: new Types.ObjectId(scheduleIdValue),
        bookingId: new Types.ObjectId(bookingIdValue),
        providerId: provider._id,
        scheduleType: BookingScheduleType.Photoshoot,
        status: BookingScheduleStatus.Confirmed,
      })
      .exec();
    const request = schedule?.locationChangeRequest;
    if (!schedule || !request || request.status !== 'PENDING') {
      throw new NotFoundException('Pending location change request not found.');
    }
    request.status = approved ? 'APPROVED' : 'REJECTED';
    request.resolvedAt = new Date();
    request.resolvedBy = provider._id;
    request.note = note?.trim() || request.note || null;
    if (approved) {
      schedule.locationAddress = request.requestedLocation.address;
      schedule.locationSnapshot = request.requestedLocation;
    }
    await schedule.save();
    return request;
  }
  async getMyBookings(userIdStr: string): Promise<Record<string, any>[]> {
    const customerId = new Types.ObjectId(userIdStr);
    const bookings = await this.bookingModel
      .find({ customerId })
      .sort({ createdAt: -1, _id: -1 });

    if (!bookings.length) {
      return [];
    }

    const bookingIds = bookings.map((b) => b._id);

    // 1 query lấy toàn bộ items của các đơn hàng (sort _id để bảo toàn thứ tự ban đầu)
    const allItems = await this.bookingItemModel
      .find({ bookingId: { $in: bookingIds } })
      .populate({
        path: 'productId',
        populate: {
          path: 'providerId',
          select:
            'businessName status address media rating contact comboDiscountPercent',
        },
      })
      .populate('photographyPackageId')
      .populate(
        'providerId',
        'businessName status address media rating contact comboDiscountPercent',
      )
      .sort({ _id: 1 })
      .lean()
      .exec();

    // 1 query lấy toàn bộ schedules bằng model đã inject sẵn
    const allSchedules = await this.bookingScheduleModel
      .find({ bookingId: { $in: bookingIds } })
      .lean()
      .exec();

    // Gom nhóm in-memory O(1)
    const itemsByBooking = new Map<string, any[]>();
    for (const item of allItems) {
      const bId = item.bookingId.toString();
      let list = itemsByBooking.get(bId);
      if (!list) {
        list = [];
        itemsByBooking.set(bId, list);
      }
      list.push(item);
    }

    const schedulesByBooking = new Map<string, any[]>();
    for (const schedule of allSchedules) {
      const bId = (schedule as any).bookingId.toString();
      let list = schedulesByBooking.get(bId);
      if (!list) {
        list = [];
        schedulesByBooking.set(bId, list);
      }
      list.push(schedule);
    }

    // Query active incident reports for these bookings
    let allIncidents: any[] = [];
    try {
      const incidentModel =
        this.bookingModel.db.models['IncidentReport'] ||
        this.bookingModel.db.model('IncidentReport');
      if (incidentModel) {
        allIncidents = await incidentModel
          .find({
            bookingId: { $in: bookingIds },
            status: { $in: ['PENDING_CUSTOMER', 'DISPUTED'] },
          })
          .lean()
          .exec();
      }
    } catch {
      // Ignore if incident model not initialized
    }

    const incidentsByBooking = new Map<string, any>();
    for (const inc of allIncidents) {
      incidentsByBooking.set(inc.bookingId.toString(), inc);
    }

    const results: Record<string, any>[] = [];
    for (const booking of bookings) {
      const bIdStr = booking._id.toString();
      const items = itemsByBooking.get(bIdStr) || [];
      const schedules = schedulesByBooking.get(bIdStr) || [];
      const activeIncident = incidentsByBooking.get(bIdStr) || null;

      const updatedItems = items.map((item) => {
        const prodName = item.productId?.name;
        const pkgName = item.photographyPackageId?.name;
        const resolvedName =
          prodName ||
          pkgName ||
          item.packageSnapshot?.name ||
          item.name ||
          null;

        if (item.itemType === 'PHOTOGRAPHY_PACKAGE') {
          const matchedSchedule = schedules.find(
            (s: any) =>
              s.scheduleType === 'PHOTOSHOOT' &&
              s.status !== 'CANCELLED' &&
              s.status !== 'EXPIRED',
          );
          if (matchedSchedule) {
            let slot = item.shootTimeSlot || matchedSchedule.timeSlot;
            if (!slot && matchedSchedule.startsAt && matchedSchedule.endsAt) {
              const startD = new Date(matchedSchedule.startsAt);
              const endD = new Date(matchedSchedule.endsAt);
              const startH = String(startD.getHours()).padStart(2, '0');
              const startM = String(startD.getMinutes()).padStart(2, '0');
              const endH = String(endD.getHours()).padStart(2, '0');
              const endM = String(endD.getMinutes()).padStart(2, '0');
              slot = `${startH}:${startM} - ${endH}:${endM}`;
            }
            if (slot && !matchedSchedule.timeSlot) {
              matchedSchedule.timeSlot = slot;
            }
            return {
              ...item,
              name: resolvedName,
              shootDate:
                item.shootDate ||
                matchedSchedule.startsAt ||
                matchedSchedule.scheduledDate,
              shootTimeSlot: slot || null,
              shootLocation:
                item.shootLocation || matchedSchedule.locationAddress,
            };
          }
        }
        return {
          ...item,
          name: resolvedName,
        };
      });

      results.push({
        ...booking.toObject(),
        items: updatedItems,
        schedules,
        activeIncident,
        hasIncident: Boolean(activeIncident),
      });
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
      .populate(
        'customerId',
        'profile.fullName profile.avatarUrl auth.phone auth.email',
      )
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    bookings.forEach((b: any) => {
      if (
        (b.bookingType === BookingType.AoDaiRental ||
          b.type === BookingType.AoDaiRental) &&
        b.status === BookingStatus.ComboPhotosApproved
      ) {
        b.status = BookingStatus.Returned;
      }
    });

    const bookingIds = bookings.map((booking) => booking._id);
    const items = bookingIds.length
      ? await this.bookingItemModel
          .find({ bookingId: { $in: bookingIds } })
          .populate('productId')
          .populate('photographyPackageId')
          .populate('inventoryItemId')
          .lean()
          .exec()
      : [];

    const schedules =
      bookingIds.length && typeof this.bookingModel?.db?.model === 'function'
        ? await this.bookingModel.db
            .model('BookingSchedule')
            .find({ bookingId: { $in: bookingIds } })
            .lean()
            .exec()
        : [];

    // Load inventory docs from both direct inventoryItemId and InventoryReservation
    const invMap = new Map<string, any>();
    try {
      const resDocs: any[] =
        bookingIds.length && typeof this.bookingModel?.db?.model === 'function'
          ? ((await this.bookingModel.db
              .model('InventoryReservation')
              .find({
                $or: [
                  { bookingId: { $in: bookingIds } },
                  { bookingItemId: { $in: items.map((i) => i._id) } },
                ],
              })
              .lean()
              .exec()) as any[])
          : [];

      const allInvIds = [
        ...items
          .map((i: any) => i.inventoryItemId?._id || i.inventoryItemId)
          .filter(Boolean),
        ...resDocs
          .map((r: any) => r.inventoryItemId?._id || r.inventoryItemId)
          .filter(Boolean),
      ];
      if (allInvIds.length > 0 && this.inventoryItemModel) {
        const invDocs = await this.inventoryItemModel
          .find({ _id: { $in: allInvIds } })
          .lean()
          .exec();
        for (const doc of invDocs) {
          invMap.set(doc._id.toString(), doc);
        }
      }
      for (const res of resDocs) {
        if (res.bookingItemId && res.inventoryItemId) {
          const invIdStr = (
            res.inventoryItemId._id || res.inventoryItemId
          ).toString();
          const matchedInv = invMap.get(invIdStr);
          if (matchedInv) {
            invMap.set(`item_${res.bookingItemId.toString()}`, matchedInv);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load inventory docs in getProviderBookings:', e);
    }

    const updatedItems = items.map((item) => {
      const prodName = (item.productId as any)?.name;
      const pkgName = (item.photographyPackageId as any)?.name;
      const resolvedName =
        prodName ||
        pkgName ||
        (item as any).packageSnapshot?.name ||
        (item as any).name ||
        null;

      const isMyItem = item.providerId?.toString() === provider._id.toString();

      let invDoc = item.inventoryItemId
        ? typeof item.inventoryItemId === 'object' &&
          (item.inventoryItemId as any).sku
          ? item.inventoryItemId
          : invMap.get(
              (item.inventoryItemId._id || item.inventoryItemId).toString(),
            )
        : null;
      if (!invDoc) {
        invDoc = invMap.get(`item_${item._id.toString()}`) || null;
      }

      const inventoryItem = invDoc
        ? {
            _id: invDoc._id.toString(),
            sku: invDoc.sku,
            size: invDoc.size,
            color: invDoc.color,
            status: invDoc.status,
            conditionStatus: invDoc.conditionStatus,
            operationalAvailableFrom: invDoc.operationalAvailableFrom,
          }
        : null;

      const resolvedSku = invDoc?.sku || (item as any).sku || null;
      const resolvedSize =
        item.selectedSize || invDoc?.size || (item as any).size || null;
      const resolvedColor =
        item.selectedColor || invDoc?.color || (item as any).color || null;

      if (item.itemType === 'PHOTOGRAPHY_PACKAGE') {
        const matchedSchedule = schedules.find(
          (s: any) =>
            s.bookingId.toString() === item.bookingId.toString() &&
            s.scheduleType === 'PHOTOSHOOT' &&
            s.status !== 'CANCELLED' &&
            s.status !== 'EXPIRED',
        ) as any;
        if (matchedSchedule) {
          let slot = item.shootTimeSlot || matchedSchedule.timeSlot;
          if (!slot && matchedSchedule.startsAt && matchedSchedule.endsAt) {
            const startD = new Date(matchedSchedule.startsAt);
            const endD = new Date(matchedSchedule.endsAt);
            const startH = String(startD.getHours()).padStart(2, '0');
            const startM = String(startD.getMinutes()).padStart(2, '0');
            const endH = String(endD.getHours()).padStart(2, '0');
            const endM = String(endD.getMinutes()).padStart(2, '0');
            slot = `${startH}:${startM} - ${endH}:${endM}`;
          }
          if (slot && !matchedSchedule.timeSlot) {
            matchedSchedule.timeSlot = slot;
          }
          return {
            ...item,
            name: resolvedName,
            isMyItem,
            sku: resolvedSku,
            size: resolvedSize,
            color: resolvedColor,
            selectedSize: resolvedSize,
            selectedColor: resolvedColor,
            inventoryItem,
            shootDate:
              item.shootDate ||
              matchedSchedule.startsAt ||
              matchedSchedule.scheduledDate,
            shootTimeSlot: slot || null,
            shootLocation:
              item.shootLocation || matchedSchedule.locationAddress,
          };
        }
      }
      return {
        ...item,
        name: resolvedName,
        isMyItem,
        sku: resolvedSku,
        size: resolvedSize,
        color: resolvedColor,
        selectedSize: resolvedSize,
        selectedColor: resolvedColor,
        inventoryItem,
      };
    });

    const itemsByBooking = new Map<string, typeof updatedItems>();
    for (const item of updatedItems) {
      const key = item.bookingId.toString();
      const grouped = itemsByBooking.get(key) || [];
      grouped.push(item);
      itemsByBooking.set(key, grouped);
    }

    const schedulesByBooking = new Map<string, any[]>();
    for (const schedule of schedules) {
      const bId = (schedule as any).bookingId;
      if (!bId) continue;
      const key = bId.toString();
      const grouped = schedulesByBooking.get(key) || [];
      grouped.push(schedule);
      schedulesByBooking.set(key, grouped);
    }

    let customerReviews: any[] = [];
    try {
      customerReviews = bookingIds.length
        ? await this.bookingModel.db
            .model('CustomerReview')
            .find({ bookingId: { $in: bookingIds }, providerId: provider._id })
            .lean()
            .exec()
        : [];
    } catch {
      customerReviews = [];
    }

    let incidents: any[] = [];
    try {
      incidents = bookingIds.length
        ? await this.bookingModel.db
            .model('IncidentReport')
            .find({ bookingId: { $in: bookingIds } })
            .lean()
            .exec()
        : [];
    } catch {
      incidents = [];
    }

    const reviewsByBooking = new Map<string, any>();
    for (const rev of customerReviews) {
      const bId = rev.bookingId;
      if (!bId) continue;
      reviewsByBooking.set(bId.toString(), rev);
    }

    const incidentByBooking = new Map<string, any>();
    for (const inc of incidents) {
      const bId = inc.bookingId;
      if (!bId) continue;
      incidentByBooking.set(bId.toString(), inc);
    }

    return bookings.map((booking) => ({
      ...booking,
      items: itemsByBooking.get(booking._id.toString()) || [],
      schedules: schedulesByBooking.get(booking._id.toString()) || [],
      customerReview: reviewsByBooking.get(booking._id.toString()) || null,
      incident: incidentByBooking.get(booking._id.toString()) || null,
    }));
  }

  async getBookingById(
    bookingIdStr: string,
    userId?: string,
    roles?: string[],
  ): Promise<Record<string, any>> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    let booking = await this.bookingModel
      .findById(bookingId)
      .populate(
        'customerId',
        'profile.fullName profile.avatarUrl auth.phone auth.email',
      )
      .populate('providerIds');
    if (!booking) throw new NotFoundException('Booking not found');

    if (
      (booking.bookingType === BookingType.AoDaiRental ||
        (booking as any).type === BookingType.AoDaiRental) &&
      booking.status === BookingStatus.ComboPhotosApproved
    ) {
      await this.bookingModel.updateOne(
        { _id: bookingId },
        {
          $set: { status: BookingStatus.Returned },
          $pull: {
            statusTimeline: { status: BookingStatus.ComboPhotosApproved },
          },
        },
      );
      booking.status = BookingStatus.Returned;
    }

    if (
      [BookingStatus.Returned, BookingStatus.Completed].includes(
        booking.status,
      ) &&
      (!booking.rentalDepositRefund?.status ||
        booking.rentalDepositRefund.status === 'PENDING')
    ) {
      await this.rentalDepositRefundCoordinator.coordinate(bookingIdStr);
      booking = (await this.bookingModel
        .findById(bookingId)
        .populate(
          'customerId',
          'profile.fullName profile.avatarUrl auth.phone auth.email',
        ))!;
    }

    if (userId) {
      const isAdmin =
        roles?.some((r) => String(r).toUpperCase() === 'ADMIN') || false;
      // customerId has been populated into a User object, so extract _id safely
      const customerIdRaw =
        (booking.customerId as any)?._id || booking.customerId;
      const isCustomer = customerIdRaw.toString() === userId;

      const userProviders = await this.providerModel.find({
        userId: new Types.ObjectId(userId),
      });
      const userProviderIds = userProviders.map((p) => p._id.toString());
      const isProvider = booking.providerIds.some((p: any) =>
        userProviderIds.includes(((p as any)?._id || p).toString()),
      );

      if (!isAdmin && !isCustomer && !isProvider) {
        throw new ForbiddenException(
          'Bạn không có quyền xem thông tin đơn hàng này.',
        );
      }
    }

    const items = await this.bookingItemModel
      .find({ bookingId })
      .populate({
        path: 'productId',
        populate: { path: 'providerId' },
      })
      .populate('photographyPackageId')
      .populate('providerId')
      .lean()
      .exec();

    const schedules = await this.bookingScheduleModel
      .find({ bookingId, scheduleType: BookingScheduleType.Photoshoot })
      .sort({ startsAt: 1 })
      .lean()
      .exec();

    const invMap = new Map<string, any>();
    try {
      const invIdsFromItems = items
        .map((it: any) => it.inventoryItemId)
        .filter(Boolean);
      const resDocs = await this.inventoryReservationModel
        .find({ bookingId })
        .select({ bookingItemId: 1, inventoryItemId: 1 })
        .lean()
        .exec();
      const allInvIds = [
        ...invIdsFromItems,
        ...resDocs.map((r: any) => r.inventoryItemId).filter(Boolean),
      ];
      if (allInvIds.length > 0) {
        const invDocs = await this.inventoryItemModel
          .find({ _id: { $in: allInvIds } })
          .lean()
          .exec();
        for (const doc of invDocs) {
          invMap.set(doc._id.toString(), doc);
        }
      }
      for (const res of resDocs) {
        if (res.bookingItemId && res.inventoryItemId) {
          const matchedInv = invMap.get(res.inventoryItemId.toString());
          if (matchedInv) {
            invMap.set(`item_${res.bookingItemId.toString()}`, matchedInv);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load inventory docs in getBookingById:', e);
    }

    const updatedItems = items.map((item) => {
      const prodName = (item.productId as any)?.name;
      const pkgName = (item.photographyPackageId as any)?.name;
      const resolvedName =
        prodName ||
        pkgName ||
        (item as any).packageSnapshot?.name ||
        (item as any).name ||
        null;

      let invDoc = item.inventoryItemId
        ? invMap.get(item.inventoryItemId.toString())
        : null;
      if (!invDoc) {
        invDoc = invMap.get(`item_${item._id.toString()}`) || null;
      }
      const inventoryItem = invDoc
        ? {
            _id: invDoc._id.toString(),
            sku: invDoc.sku,
            status: invDoc.status,
            conditionStatus: invDoc.conditionStatus,
            operationalAvailableFrom: invDoc.operationalAvailableFrom,
          }
        : null;

      if (item.itemType === 'PHOTOGRAPHY_PACKAGE') {
        const matchedSchedule = schedules.find(
          (s: any) =>
            s.scheduleType === 'PHOTOSHOOT' &&
            s.status !== 'CANCELLED' &&
            s.status !== 'EXPIRED',
        ) as any;
        if (matchedSchedule) {
          let slot = item.shootTimeSlot || matchedSchedule.timeSlot || null;
          if (!slot && matchedSchedule.startsAt && matchedSchedule.endsAt) {
            const fmt = new Intl.DateTimeFormat('en-GB', {
              timeZone: matchedSchedule.timezone || 'Asia/Ho_Chi_Minh',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            slot = `${fmt.format(new Date(matchedSchedule.startsAt))} - ${fmt.format(new Date(matchedSchedule.endsAt))}`;
          }
          return {
            ...item,
            name: resolvedName,
            inventoryItem,
            shootDate:
              item.shootDate ||
              matchedSchedule.startsAt ||
              matchedSchedule.scheduledDate,
            shootTimeSlot: slot,
            shootLocation:
              item.shootLocation || matchedSchedule.locationAddress,
          };
        }
      }
      return {
        ...item,
        name: resolvedName,
        inventoryItem,
      };
    });

    const rentalItems = updatedItems.filter(
      (it: any) =>
        it.itemType === BookingItemType.Product && it.rentalFulfillment,
    );

    let canCustomerConfirmCompletion = false;
    if (
      booking.status !== BookingStatus.Completed &&
      booking.status !== BookingStatus.Cancelled &&
      booking.status !== BookingStatus.Disputed
    ) {
      if (rentalItems.length > 0) {
        const allReady = rentalItems.every((it: any) => {
          const rf = it.rentalFulfillment;
          if (!rf) return false;
          const isStatusCompleted =
            rf.status === RentalFulfillmentStatus.Completed;
          const isDepositSettled = [
            DepositSettlementStatus.FullyReleased,
            DepositSettlementStatus.PartiallyDeducted,
            DepositSettlementStatus.FullyDeducted,
          ].includes(rf.depositSettlementStatus);
          const isIssueResolved =
            !rf.issueStatus ||
            rf.issueStatus === RentalIssueStatus.None ||
            rf.issueStatus === RentalIssueStatus.Resolved;
          return isStatusCompleted && isDepositSettled && isIssueResolved;
        });

        canCustomerConfirmCompletion =
          allReady &&
          [BookingStatus.Returned, BookingStatus.ComboPhotosApproved].includes(
            booking.status,
          );
      } else {
        canCustomerConfirmCompletion =
          booking.status === BookingStatus.AwaitingReview;
      }
    }

    const bookingObj = booking.toObject();
    const customerUser = booking.customerId as any;

    let customerReview: any = null;
    try {
      customerReview = await this.bookingModel.db
        .model('CustomerReview')
        .findOne({ bookingId: booking._id })
        .lean()
        .exec();
    } catch {
      customerReview = null;
    }

    let incident: any = null;
    try {
      incident = await this.bookingModel.db
        .model('IncidentReport')
        .findOne({ bookingId: booking._id })
        .lean()
        .exec();
    } catch {
      incident = null;
    }

    return {
      ...bookingObj,
      customerName: customerUser?.profile?.fullName || '',
      customerPhone: customerUser?.auth?.phone || '',
      customerEmail: customerUser?.auth?.email || '',
      items: updatedItems,
      schedules,
      customerReview: customerReview || null,
      incident: incident || null,
      canCustomerConfirmCompletion,
    };
  }

  /** Hoàn thành đơn → trigger đối soát chia tiền (PaymentsService.settleBooking) */
  async completeBooking(
    bookingIdStr: string,
    userId?: string,
    roles?: string[],
  ): Promise<BookingDocument> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    if (userId) {
      const isAdmin = roles?.includes('ADMIN') || roles?.includes('admin');
      const isCustomer = this.getCustomerIdStr(booking) === userId;

      if (!isAdmin && !isCustomer) {
        throw new ForbiddenException(
          'Nhà cung cấp không được phép tự ý hoàn tất đơn hàng. Chỉ khách hàng hoặc Admin mới có quyền xác nhận hoàn thành đơn hàng.',
        );
      }
    }

    const rentalLifecycleItems = await this.bookingItemModel
      .find({
        bookingId,
        itemType: BookingItemType.Product,
        'rentalFulfillment.status': { $exists: true },
      })
      .lean()
      .exec();

    if (
      rentalLifecycleItems.length &&
      rentalLifecycleItems.some(
        (item) =>
          item.rentalFulfillment?.status !== RentalFulfillmentStatus.Completed,
      )
    ) {
      throw new ConflictException(
        'Không thể hoàn tất booking áo dài trước khi tất cả physical item đã được trả, chốt cọc và hoàn tất theo lifecycle.',
      );
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
        this.getCustomerIdStr(booking),
        `Đơn hàng hoàn thành`,
        `Đơn hàng ${booking.bookingCode} của bạn đã được đánh dấu hoàn thành. Cảm ơn bạn!`,
        NotificationType.Booking,
        { bookingId: booking._id },
      );
      await this.notificationsService.createNotification(
        this.getCustomerIdStr(booking),
        `Yêu cầu đánh giá dịch vụ`,
        `Đơn hàng ${booking.bookingCode} đã hoàn thành. Hãy chia sẻ trải nghiệm của bạn bằng cách để lại đánh giá nhé!`,
        NotificationType.System,
        { bookingId: booking._id, action: 'REVIEW' },
      );
    } catch (e) {
      console.error('Failed to create completeBooking notifications:', e);
    }

    try {
      const recipientIds = await this.getBookingStakeholderUserIds(booking);
      this.notificationsService.emitBookingUpdate(
        {
          bookingId: booking._id.toString(),
          bookingCode: booking.bookingCode,
          status: BookingStatus.Completed,
          deliveredPhotos: (booking as any).deliveredPhotos ?? [],
        },
        recipientIds,
      );
    } catch (e) {
      console.warn('Failed to emit booking_updated in completeBooking:', e);
    }

    await this.paymentsService.settleBooking(bookingIdStr);

    return booking;
  }

  /**
   * Customer xác nhận hài lòng sau buổi chụp ảnh.
   * Chỉ cho phép khi booking đang ở AWAITING_REVIEW và người gọi là customer của booking.
   * Sử dụng atomic findOneAndUpdate để đảm bảo idempotency (tránh double-complete với cron job).
   */
  async confirmCompleteByCustomer(
    bookingIdStr: string,
    userId: string,
  ): Promise<BookingDocument> {
    const booking = await this.bookingModel.findById(bookingIdStr);
    if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng');

    if (this.getCustomerIdStr(booking) !== userId) {
      throw new ForbiddenException('Bạn không có quyền xác nhận đơn hàng này.');
    }

    if (booking.status === BookingStatus.Completed) {
      return booking;
    }

    const canComplete = [
      BookingStatus.AwaitingReview,
      BookingStatus.Returned,
      BookingStatus.ComboPhotosApproved,
    ].includes(booking.status);

    if (!canComplete) {
      throw new BadRequestException(
        `Chỉ có thể xác nhận hoàn thành khi đơn đang ở trạng thái chờ duyệt (AWAITING_REVIEW), đã trả đồ (RETURNED) hoặc đã duyệt ảnh combo (COMBO_PHOTOS_APPROVED). Trạng thái hiện tại: ${booking.status}`,
      );
    }

    // Check if there are physical rental items in this booking that are not completed yet.
    // This ONLY applies to COMBO bookings currently in AWAITING_REVIEW where photos are being approved
    // while the costume rental is still ongoing (not yet returned or completed).
    const isCombo =
      booking.bookingType === BookingType.Combo ||
      (booking as any).type === BookingType.Combo;

    if (isCombo && booking.status === BookingStatus.AwaitingReview) {
      const rentalLifecycleItems = await this.bookingItemModel
        .find({
          bookingId: booking._id,
          itemType: BookingItemType.Product,
          'rentalFulfillment.status': { $exists: true },
        })
        .lean()
        .exec();

      const hasOngoingRentals =
        rentalLifecycleItems.length > 0 &&
        rentalLifecycleItems.some(
          (item) =>
            item.rentalFulfillment?.status !==
              RentalFulfillmentStatus.Completed &&
            item.rentalFulfillment?.status !== RentalFulfillmentStatus.Returned,
        );

      if (hasOngoingRentals) {
        // For combo bookings where Ao Dai rentals are still ongoing, approving photos marks photosApproved = true and advances status to COMBO_PHOTOS_APPROVED
        (booking as any).photosApproved = true;
        booking.status = BookingStatus.ComboPhotosApproved;
        booking.statusTimeline.push({
          status: BookingStatus.ComboPhotosApproved,
          changedAt: new Date(),
          note: 'Khách hàng đã xác nhận hài lòng về sản phẩm ảnh chụp. Đơn hàng tiếp tục luồng thuê áo dài.',
        });
        await booking.save();

        try {
          const recipientIds = await this.getBookingStakeholderUserIds(booking);
          this.notificationsService.emitBookingUpdate(
            {
              bookingId: booking._id.toString(),
              bookingCode: booking.bookingCode,
              status: BookingStatus.ComboPhotosApproved,
              deliveredPhotos: (booking as any).deliveredPhotos ?? [],
            },
            recipientIds,
          );
        } catch (e) {
          console.warn(
            'Failed to emit booking_updated in confirmCompleteByCustomer:',
            e,
          );
        }

        return booking;
      }
    }

    // Check if there are rental items that have not met completion criteria yet
    const rentalLifecycleItems = await this.bookingItemModel
      .find({
        bookingId: booking._id,
        itemType: BookingItemType.Product,
        'rentalFulfillment.status': { $exists: true },
      })
      .lean()
      .exec();

    if (rentalLifecycleItems.length > 0) {
      const allReady = rentalLifecycleItems.every((item: any) => {
        const rf = item.rentalFulfillment;
        if (!rf) return false;
        const isStatusCompleted =
          rf.status === RentalFulfillmentStatus.Completed;
        const isDepositSettled = [
          DepositSettlementStatus.FullyReleased,
          DepositSettlementStatus.PartiallyDeducted,
          DepositSettlementStatus.FullyDeducted,
        ].includes(rf.depositSettlementStatus);
        const isIssueResolved =
          !rf.issueStatus ||
          rf.issueStatus === RentalIssueStatus.None ||
          rf.issueStatus === RentalIssueStatus.Resolved;
        return isStatusCompleted && isDepositSettled && isIssueResolved;
      });

      if (!allReady) {
        throw new ConflictException(
          'Shop/Admin đang kiểm tra trang phục và tất toán cọc',
        );
      }
    }

    // Run full completion flow (settlement + deposit refund + notifications)
    return this.completeBooking(bookingIdStr, userId, ['CUSTOMER']);
  }

  /** Provider cập nhật trạng thái đơn hàng (CONFIRMED, PICKUP_PENDING, PICKED_UP, v.v.) */
  async updateBookingStatus(
    bookingIdStr: string,
    newStatus: string,
    note?: string,
    userId?: string,
    roles?: string[],
    handoverPhotos?: string[],
    deliveredPhotos?: string[],
    deliveryDriveUrl?: string,
    evidencePhotos?: string[],
    isInternalSync = false,
    assignedStaffId?: string,
  ): Promise<BookingDocument> {
    const booking = await this.bookingModel.findById(bookingIdStr);
    if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng');

    if (!isInternalSync) {
      const isRentalOrHasRentalItems =
        booking.bookingType === BookingType.AoDaiRental ||
        (booking as any).type === BookingType.AoDaiRental ||
        (await this.bookingItemModel.exists({
          bookingId: booking._id,
          itemType: BookingItemType.Product,
          'rentalFulfillment.status': { $exists: true },
        }));

      if (isRentalOrHasRentalItems) {
        const restrictedRentalStatuses = [
          BookingStatus.PickupPending,
          BookingStatus.PickedUp,
          BookingStatus.ReturnPending,
          BookingStatus.Returned,
          BookingStatus.Completed,
        ];
        if (restrictedRentalStatuses.includes(newStatus as BookingStatus)) {
          throw new BadRequestException(
            `Đơn hàng thuê áo dài có quy trình bàn giao từng sản phẩm (Rental Fulfillment), không thể cập nhật trực tiếp trạng thái "${newStatus}" qua API chung.`,
          );
        }
      }
    }

    if (userId) {
      const isAdmin = roles?.includes('ADMIN') || roles?.includes('admin');
      const isCustomer = this.getCustomerIdStr(booking) === userId;

      const userProviders = await this.providerModel.find({
        userId: new Types.ObjectId(userId),
      });
      const userProviderIds = userProviders.map((p) => p._id.toString());
      const isProvider = booking.providerIds.some((id) =>
        userProviderIds.includes(id.toString()),
      );

      if (
        newStatus === BookingStatus.Disputed ||
        newStatus === BookingStatus.ReturnPending
      ) {
        if (!isAdmin && !isProvider && !isCustomer) {
          throw new ForbiddenException(
            'Bạn không có quyền cập nhật trạng thái này cho đơn hàng.',
          );
        }
      } else if (!isAdmin && !isProvider) {
        throw new ForbiddenException(
          'Chỉ nhà cung cấp hoặc Admin mới có quyền cập nhật trạng thái đơn hàng này.',
        );
      }

      // Provider và Admin đều được phép cập nhật sang PICKED_UP khi bàn giao đồ tại cửa hàng
    }

    // Nếu chuyển sang COMPLETED → chỉ Khách hàng hoặc Admin mới được phép
    if (newStatus === BookingStatus.Completed) {
      const isAdmin = roles?.includes('ADMIN') || roles?.includes('admin');
      const isCustomer = userId && this.getCustomerIdStr(booking) === userId;
      if (!isAdmin && !isCustomer) {
        throw new ForbiddenException(
          'Nhà cung cấp không được phép tự ý hoàn tất đơn hàng. Chỉ khách hàng xác nhận hoặc hệ thống tự động nghiệm thu sau 24h mới có quyền hoàn tất đơn này.',
        );
      }
      return this.completeBooking(bookingIdStr, userId, roles);
    }

    // Nếu chuyển sang CANCELLED → dùng cancelBooking để trigger refund
    if (newStatus === BookingStatus.Cancelled) {
      return this.cancelBooking(
        bookingIdStr,
        userId || 'provider',
        roles || [],
        note || 'Provider hủy đơn',
      );
    }

    if (newStatus === 'SESSION_START' || newStatus === 'SESSION_COMPLETE') {
      newStatus = BookingStatus.InProgress;
    }

    const currentStatus = booking.status;
    const nextStatus = newStatus as BookingStatus;

    if (currentStatus === nextStatus) return booking;

    // Không cho phép thay đổi khi đơn hàng đã ở trạng thái cuối cùng
    const finalStatuses = [
      BookingStatus.Completed,
      BookingStatus.Cancelled,
      BookingStatus.Refunded,
    ];
    if (finalStatuses.includes(currentStatus)) {
      throw new BadRequestException(
        `Không thể thay đổi trạng thái đơn hàng khi đã ở trạng thái cuối: ${currentStatus}`,
      );
    }

    // Định nghĩa các chuyển đổi trạng thái hợp lệ
    const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.Draft]: [
        BookingStatus.PendingPayment,
        BookingStatus.Cancelled,
      ],
      [BookingStatus.PendingPayment]: [
        BookingStatus.Confirmed,
        BookingStatus.DepositPaid,
        BookingStatus.Cancelled,
      ],
      [BookingStatus.DepositPaid]: [
        BookingStatus.Confirmed,
        BookingStatus.PickupPending,
        BookingStatus.InProgress,
        BookingStatus.AwaitingReview,
        BookingStatus.Cancelled,
        BookingStatus.Disputed,
      ],
      [BookingStatus.Confirmed]: [
        BookingStatus.PickupPending,
        BookingStatus.InProgress,
        BookingStatus.AwaitingReview,
        BookingStatus.Cancelled,
        BookingStatus.Disputed,
      ],
      [BookingStatus.PickupPending]: [
        BookingStatus.PickedUp,
        BookingStatus.Cancelled,
        BookingStatus.InProgress,
        BookingStatus.AwaitingReview,
        BookingStatus.Disputed,
      ],
      [BookingStatus.PickedUp]: [
        BookingStatus.ReturnPending,
        BookingStatus.Overdue,
        BookingStatus.LostItem,
        BookingStatus.Disputed,
        BookingStatus.Returned,
        BookingStatus.InProgress,
        BookingStatus.AwaitingReview,
      ],
      [BookingStatus.ReturnPending]: [
        BookingStatus.Returned,
        BookingStatus.Overdue,
        BookingStatus.LostItem,
        BookingStatus.InProgress,
        BookingStatus.AwaitingReview,
        BookingStatus.Disputed,
      ],
      [BookingStatus.Overdue]: [
        BookingStatus.Returned,
        BookingStatus.LostItem,
        BookingStatus.Disputed,
        BookingStatus.Completed,
      ],
      [BookingStatus.LostItem]: [
        BookingStatus.Returned,
        BookingStatus.Completed,
        BookingStatus.Disputed,
      ],
      [BookingStatus.Returned]: [
        BookingStatus.Completed,
        BookingStatus.InProgress,
        BookingStatus.AwaitingReview,
        BookingStatus.Disputed,
      ],
      [BookingStatus.InProgress]: [
        BookingStatus.AwaitingReview,
        BookingStatus.Cancelled,
        BookingStatus.Returned,
        BookingStatus.ReturnPending,
        BookingStatus.Disputed,
      ],
      [BookingStatus.AwaitingReview]: [
        BookingStatus.Completed,
        BookingStatus.ComboPhotosApproved,
        BookingStatus.Disputed,
        BookingStatus.Returned,
        BookingStatus.ReturnPending,
        BookingStatus.InProgress,
        BookingStatus.PickedUp,
      ],
      [BookingStatus.ComboPhotosApproved]: [
        BookingStatus.PickupPending,
        BookingStatus.PickedUp,
        BookingStatus.ReturnPending,
        BookingStatus.Returned,
        BookingStatus.Completed,
        BookingStatus.Disputed,
        BookingStatus.Cancelled,
      ],
      [BookingStatus.Disputed]: [
        BookingStatus.Completed,
        BookingStatus.Refunded,
        BookingStatus.PartiallyRefunded,
      ],
      [BookingStatus.Completed]: [],
      [BookingStatus.Cancelled]: [],
      [BookingStatus.Refunded]: [],
      [BookingStatus.PartiallyRefunded]: [BookingStatus.Completed],
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Không được phép chuyển trạng thái đơn hàng từ ${currentStatus} sang ${nextStatus}`,
      );
    }

    const isAdmin = roles?.includes('ADMIN') || roles?.includes('admin');
    if (
      currentStatus === BookingStatus.AwaitingReview &&
      (nextStatus === BookingStatus.Completed ||
        nextStatus === BookingStatus.ComboPhotosApproved) &&
      !isAdmin
    ) {
      throw new BadRequestException(
        'Đơn hàng đang chờ khách hàng duyệt nhận ảnh. Chỉ khách hàng hoặc hệ thống tự động nghiệm thu sau 48h mới có quyền hoàn tất đơn này.',
      );
    }

    let staffAssignedDuringConfirm = false;
    let preAssignedPhotoSchedules: any[] = [];
    if (
      nextStatus === BookingStatus.Confirmed &&
      this.staffAvailabilityService
    ) {
      const activePhotoSchedules = await this.bookingScheduleModel
        .find({
          bookingId: booking._id,
          scheduleType: BookingScheduleType.Photoshoot,
          status: {
            $in: [
              BookingScheduleStatus.Confirmed,
              BookingScheduleStatus.Held,
              BookingScheduleStatus.Scheduled,
            ],
          },
        })
        .select('_id providerId assignedStaffId assignedStaffSnapshot')
        .lean()
        .exec();

      if (activePhotoSchedules.length > 0) {
        if (assignedStaffId) {
          await this.staffAvailabilityService.assignStaffToBooking(
            bookingIdStr,
            assignedStaffId,
            userId || 'provider',
            roles,
            'Chủ Studio phân công thợ khi chấp nhận lịch chụp',
          );
          staffAssignedDuringConfirm = true;
          const refreshedBooking = await this.bookingModel
            .findById(booking._id)
            .select('statusTimeline')
            .lean()
            .exec();
          if (refreshedBooking?.statusTimeline) {
            booking.statusTimeline = refreshedBooking.statusTimeline as any;
          }
        } else if (currentStatus === BookingStatus.DepositPaid) {
          const unassignedSchedules = activePhotoSchedules.filter(
            (sch: any) => !sch.assignedStaffId,
          );
          if (unassignedSchedules.length > 0) {
            for (const sch of unassignedSchedules) {
              const provId =
                (sch as any).providerId || booking.providerIds?.[0] || null;
              if (!provId) continue;
              const ctx =
                await this.staffAvailabilityService.loadProviderCapacityContext(
                  new Types.ObjectId(provId.toString()),
                );
              if (ctx.activeStaffCount > 0) {
                throw new BadRequestException(
                  'Vui lòng chọn thợ chụp phụ trách đang rảnh trước khi chấp nhận lịch chụp.',
                );
              }
            }
          } else {
            preAssignedPhotoSchedules = activePhotoSchedules;
          }
        }
      }
    }

    if (nextStatus === BookingStatus.InProgress) {
      booking.status = nextStatus;
    }

    booking.status = nextStatus;
    if (nextStatus === BookingStatus.AwaitingReview) {
      booking.awaitingReviewSince = new Date();
      if (deliveredPhotos && deliveredPhotos.length > 0) {
        (booking as any).deliveredPhotos = deliveredPhotos;
      }
      if (deliveryDriveUrl) {
        (booking as any).deliveryDriveUrl = deliveryDriveUrl;
      }
    }
    if (nextStatus === BookingStatus.Disputed) {
      const isNoShowDispute =
        note &&
        (note.includes('vắng mặt') ||
          note.includes('không đến') ||
          note.includes('Thợ chụp'));

      if (isNoShowDispute) {
        let shootStartTime: Date | null = null;
        try {
          const scheduleModel = this.bookingModel.db.model('BookingSchedule');
          const schedule: any = await scheduleModel
            .findOne({
              bookingId: booking._id,
              scheduleType: 'PHOTOSHOOT',
              status: { $ne: 'CANCELLED' },
            })
            .lean()
            .exec();

          if (schedule?.startsAt) {
            shootStartTime = new Date(schedule.startsAt);
          } else if (schedule?.scheduledDate) {
            shootStartTime = new Date(schedule.scheduledDate);
            if (schedule.timeSlot) {
              const startHour = parseInt(
                schedule.timeSlot.split('-')[0] || '0',
                10,
              );
              if (!isNaN(startHour))
                shootStartTime.setHours(startHour, 0, 0, 0);
            }
          } else {
            const photoItem = (booking as any).items?.find(
              (i: any) => i?.shootDate || i?.itemType === 'PHOTOGRAPHY_PACKAGE',
            );
            if (photoItem?.shootDate) {
              shootStartTime = new Date(photoItem.shootDate);
              if (photoItem.shootTimeSlot) {
                const startHour = parseInt(
                  photoItem.shootTimeSlot.split('-')[0] || '0',
                  10,
                );
                if (!isNaN(startHour))
                  shootStartTime.setHours(startHour, 0, 0, 0);
              }
            }
          }
        } catch (sErr) {
          console.warn('Lỗi kiểm tra thời gian chụp:', sErr);
        }

        if (shootStartTime) {
          const now = new Date();
          const minAllowedTime = new Date(
            shootStartTime.getTime() + 15 * 60 * 1000,
          );
          if (now < minAllowedTime) {
            throw new BadRequestException(
              'Bạn chỉ có thể báo cáo thợ chụp ảnh vắng mặt sau giờ hẹn ít nhất 15 phút.',
            );
          }
        }
      }

      if (evidencePhotos && evidencePhotos.length > 0) {
        (booking as any).evidencePhotos = evidencePhotos;
        (booking as any).disputeEvidencePhotos = evidencePhotos;
      }

      // Tự động đóng băng khoản tiền quyết toán (Hold settlement)
      try {
        await this.settlementsService.holdSettlementsForBooking(
          booking._id.toString(),
          note || 'Khách hàng gửi khiếu nại tranh chấp',
        );
      } catch (hErr) {
        console.warn('Lỗi đóng băng quyết toán khi có khiếu nại:', hErr);
      }

      try {
        const disputeModel = this.bookingModel.db.model('Dispute');
        const existing = await disputeModel.findOne({ bookingId: booking._id });
        if (existing) {
          if (evidencePhotos && evidencePhotos.length > 0) {
            existing.evidencePhotos = evidencePhotos;
            await existing.save();
          }
        } else {
          const item = await this.bookingItemModel.findOne({
            bookingId: booking._id,
          });
          const providerId = booking.providerIds?.[0] || null;
          await disputeModel.create({
            bookingId: booking._id,
            bookingItemId: item?._id || new Types.ObjectId(),
            openedBy: new Types.ObjectId(
              userId || booking.customerId.toString(),
            ),
            againstProviderId: providerId,
            reason:
              note || 'Khách hàng gửi khiếu nại chất lượng dịch vụ/sản phẩm',
            evidencePhotos:
              evidencePhotos && evidencePhotos.length > 0
                ? evidencePhotos
                : (booking as any).deliveredPhotos ||
                  booking.handoverPhotos ||
                  [],
            status: 'OPEN',
          });
        }
      } catch (e) {
        console.warn('Lỗi tự động khởi tạo Dispute document:', e);
      }

      // Gửi thông báo đến tài khoản Provider về khiếu nại
      try {
        const providerUserId = booking.providerIds?.[0];
        if (providerUserId) {
          const providerDoc: any = await this.bookingModel.db
            .model('Provider')
            .findById(providerUserId)
            .lean()
            .exec();
          const targetUserId = providerDoc?.userId || providerUserId;
          await this.notificationsService.createNotification(
            targetUserId.toString(),
            'Thông báo khiếu nại đơn hàng',
            `Khách hàng vừa gửi khiếu nại cho đơn hàng #${booking.bookingCode || booking._id.toString().slice(-6)}. Lý do: ${note || 'Khiếu nại dịch vụ'}. Vui lòng kiểm tra và phản hồi.`,
            NotificationType.Booking,
            { bookingId: booking._id },
          );
        }
      } catch (nErr) {
        console.error('Lỗi gửi thông báo khiếu nại cho Provider:', nErr);
      }
    }
    if (nextStatus === BookingStatus.PickupPending) {
      const items = await this.bookingItemModel.find({
        bookingId: booking._id,
      });
      const startDates: Date[] = [];
      if ((booking as any).rentalFrom)
        startDates.push(new Date((booking as any).rentalFrom));
      for (const it of items) {
        if (it.rentalFrom) startDates.push(new Date(it.rentalFrom));
        if (it.shootDate) {
          const d = new Date(it.shootDate);
          if (it.shootTimeSlot) {
            const startH = parseInt(it.shootTimeSlot.split('-')[0] || '0', 10);
            d.setHours(startH, 0, 0, 0);
          }
          startDates.push(d);
        }
      }
      const validStarts = startDates.filter((d) => !isNaN(d.getTime()));
      if (validStarts.length > 0) {
        const earliestStart = new Date(
          Math.min(...validStarts.map((d) => d.getTime())),
        );
        if (
          !this.allowEarlyRentalPickup() &&
          earliestStart.getTime() - Date.now() > 24 * 60 * 60 * 1000
        ) {
          throw new BadRequestException(
            'Chưa đến thời điểm nhận đồ. Chỉ có thể chuẩn bị bàn giao trong vòng 24 giờ trước thời gian bắt đầu thuê.',
          );
        }
      }
      booking.handoverInitiatedAt = new Date();
      if (handoverPhotos && handoverPhotos.length > 0) {
        booking.handoverPhotos = handoverPhotos;
      }
    }
    if (nextStatus === BookingStatus.PickedUp) {
      if (currentStatus !== BookingStatus.PickupPending) {
        throw new BadRequestException(
          'Chỉ có thể chuyển sang Đang thuê khi đơn hàng đang ở trạng thái Chờ nhận đồ (PICKUP_PENDING).',
        );
      }
      const items = await this.bookingItemModel.find({
        bookingId: booking._id,
      });
      const startDates: Date[] = [];
      if ((booking as any).rentalFrom)
        startDates.push(new Date((booking as any).rentalFrom));
      for (const it of items) {
        if (it.rentalFrom) startDates.push(new Date(it.rentalFrom));
        if (it.shootDate) {
          const d = new Date(it.shootDate);
          if (it.shootTimeSlot) {
            const startH = parseInt(it.shootTimeSlot.split('-')[0] || '0', 10);
            d.setHours(startH, 0, 0, 0);
          }
          startDates.push(d);
        }
      }
      const validStarts = startDates.filter((d) => !isNaN(d.getTime()));
      if (validStarts.length > 0) {
        const earliestStart = new Date(
          Math.min(...validStarts.map((d) => d.getTime())),
        );
        if (
          !this.allowEarlyRentalPickup() &&
          Date.now() < earliestStart.getTime() - 60 * 60 * 1000
        ) {
          throw new BadRequestException(
            'Chưa đến khung giờ nhận đồ theo lịch hẹn. Chỉ có thể bàn giao khi đến giờ nhận áo.',
          );
        }
      }
    }
    if (nextStatus === BookingStatus.Returned) {
      if (
        currentStatus !== BookingStatus.PickedUp &&
        currentStatus !== BookingStatus.ReturnPending &&
        currentStatus !== BookingStatus.ComboPhotosApproved
      ) {
        throw new BadRequestException(
          'Chỉ có thể xác nhận đã trả áo khi đơn hàng đang ở trạng thái Đang thuê (PICKED_UP), Chờ kiểm tra đồ (RETURN_PENDING) hoặc Đã duyệt ảnh (COMBO_PHOTOS_APPROVED).',
        );
      }
      booking.returnedAt = new Date();
    }
    booking.statusTimeline.push({
      status: newStatus as BookingStatus,
      changedAt: new Date(),
      note: note || `Cập nhật trạng thái bởi ${userId || 'hệ thống'}`,
    });

    const isMultiCollectionTransition =
      nextStatus === BookingStatus.PickedUp ||
      nextStatus === BookingStatus.Returned;
    let session: ClientSession | null = null;
    if (
      isMultiCollectionTransition &&
      typeof this.bookingModel.db?.startSession === 'function'
    ) {
      try {
        session = await this.bookingModel.db.startSession();
        session.startTransaction();
      } catch {
        session = null;
      }
    }

    try {
      await booking.save(session ? { session } : undefined);

      let nextFulfillmentStatus: string | null = null;
      if (nextStatus === BookingStatus.PickupPending)
        nextFulfillmentStatus = RentalFulfillmentStatus.ReadyForPickup;
      else if (nextStatus === BookingStatus.PickedUp)
        nextFulfillmentStatus = RentalFulfillmentStatus.PickedUp;
      else if (nextStatus === BookingStatus.Returned)
        nextFulfillmentStatus = RentalFulfillmentStatus.Returned;
      else if (nextStatus === BookingStatus.Completed)
        nextFulfillmentStatus = RentalFulfillmentStatus.Completed;

      const extraFulfillmentSet: Record<string, any> = {};
      if (nextFulfillmentStatus) {
        extraFulfillmentSet['rentalFulfillment.status'] = nextFulfillmentStatus;
      }
      if (nextStatus === BookingStatus.PickedUp) {
        extraFulfillmentSet['rentalFulfillment.inventoryStatus'] =
          RentalInventoryStatus.RentedOut;
        extraFulfillmentSet['rentalFulfillment.pickedUpAt'] = new Date();
      } else if (nextStatus === BookingStatus.ReturnPending) {
        extraFulfillmentSet['rentalFulfillment.inventoryStatus'] =
          RentalInventoryStatus.ReturnedPendingInspection;
        if (evidencePhotos && evidencePhotos.length > 0) {
          const returnEvData = {
            files: evidencePhotos,
            returnedAt: new Date(),
            note: note || null,
          };
          extraFulfillmentSet['rentalFulfillment.customerReturnEvidence'] =
            returnEvData;
          (booking as any).customerReturnEvidence = returnEvData;
        }
      } else if (nextStatus === BookingStatus.Returned) {
        extraFulfillmentSet['rentalFulfillment.inventoryStatus'] =
          RentalInventoryStatus.ReturnedPendingInspection;
        extraFulfillmentSet['rentalFulfillment.returnedAt'] = new Date();
      }
      if (Object.keys(extraFulfillmentSet).length > 0) {
        await this.bookingItemModel.updateMany(
          {
            bookingId: booking._id,
            $or: [
              { itemType: BookingItemType.Product },
              { productId: { $exists: true, $ne: null } },
              { 'rentalFulfillment.status': { $exists: true } },
            ],
          },
          { $set: extraFulfillmentSet },
          session ? { session } : undefined,
        );
      }

      if (nextStatus === BookingStatus.PickedUp) {
        const items = await this.bookingItemModel.find(
          { bookingId: booking._id },
          null,
          session ? { session } : undefined,
        );
        const reservations = this.inventoryReservationModel
          ? await this.inventoryReservationModel.find(
              { bookingId: booking._id },
              null,
              session ? { session } : undefined,
            )
          : [];
        const invItemIds = [
          ...new Set(
            [
              ...items.map((it) => it.inventoryItemId?.toString()),
              ...reservations.map((r) => r.inventoryItemId?.toString()),
            ].filter(Boolean),
          ),
        ];
        if (invItemIds.length > 0) {
          await this.inventoryItemModel.updateMany(
            { _id: { $in: invItemIds.map((id) => new Types.ObjectId(id)) } },
            { $set: { status: InventoryItemStatus.Rented } },
            session ? { session } : undefined,
          );
        }
      }

      if (
        nextStatus === BookingStatus.Confirmed ||
        nextStatus === BookingStatus.DepositPaid
      ) {
        await this.inventoryReservationModel.updateMany(
          { bookingId: booking._id },
          {
            $set: { status: ReservationStatus.Confirmed },
            $unset: { expiresAt: 1 },
          },
          session ? { session } : undefined,
        );
      } else if (nextStatus === BookingStatus.Returned) {
        const items = await this.bookingItemModel
          .find({ bookingId: booking._id, itemType: BookingItemType.Product })
          .select('_id providerId rentalTo rentalFulfillment slotLeaseRequired')
          .lean()
          .exec();

        const reservations = await this.inventoryReservationModel
          .find({ bookingId: booking._id })
          .select({ inventoryItemId: 1, bookingItemId: 1 })
          .lean()
          .exec();

        const inventoryModel = this.bookingItemModel.db.model('InventoryItem');
        const actualReturnedAt = new Date();

        for (const item of items) {
          const contractualRentalTo =
            (item as any).rentalTo || actualReturnedAt;
          const turnaroundSlotsCount = Number(
            (item as any).rentalFulfillment?.turnaroundSlotsSnapshot ?? 1,
          );
          const scheduleConfig = (item as any).providerId
            ? await this.getProviderScheduleConfig((item as any).providerId)
            : undefined;
          const availableFrom = this.timeSlotEngine
            ? this.timeSlotEngine.calculateReturnAvailableFrom(
                contractualRentalTo,
                actualReturnedAt,
                turnaroundSlotsCount,
                scheduleConfig,
              )
            : actualReturnedAt;

          const matchingRes = reservations.filter(
            (r: any) =>
              r.bookingItemId &&
              r.bookingItemId.toString() === item._id.toString(),
          );
          const itemInventoryIds = matchingRes
            .map((r: any) => r.inventoryItemId)
            .filter(Boolean);

          if (itemInventoryIds.length > 0) {
            await inventoryModel
              .updateMany(
                {
                  _id: { $in: itemInventoryIds },
                  status: { $ne: 'MAINTENANCE' },
                  conditionStatus: {
                    $nin: ['LOCKED', 'RETIRED', 'MINOR_DAMAGE'],
                  },
                },
                {
                  $set: {
                    status: 'CLEANING',
                    operationalAvailableFrom: availableFrom,
                    activeTurnaroundBookingItemId: item._id,
                  },
                },
                session ? { session } : undefined,
              )
              .exec();
          }

          if (this.slotLeaseService && (item as any).slotLeaseRequired) {
            await this.slotLeaseService.reconcileTurnaroundLeases(
              item._id,
              availableFrom,
            );
          }
        }
      }

      if (session) {
        await session.commitTransaction();
      }
    } catch (txErr) {
      if (session) {
        await session.abortTransaction();
      }
      throw txErr;
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    const bookingStatusLabels: Record<string, string> = {
      DRAFT: 'Bản nháp',
      PENDING_PAYMENT: 'Chờ thanh toán',
      DEPOSIT_PAID: 'Đã đặt cọc · Chờ duyệt',
      CONFIRMED: 'Đã xác nhận',
      PICKUP_PENDING: 'Chờ bàn giao / nhận áo',
      PICKED_UP: 'Đang thuê',
      RETURN_PENDING: 'Chờ nhận trả đồ',
      RETURNED: 'Đã trả đồ · Chờ hoàn cọc',
      IN_PROGRESS: 'Đang thực hiện buổi chụp',
      AWAITING_REVIEW: 'Đã giao ảnh · Chờ duyệt',
      COMBO_PHOTOS_APPROVED: 'Đã duyệt ảnh · Chờ trả đồ',
      COMPLETED: 'Hoàn tất',
      CANCELLED: 'Đã hủy',
      DISPUTED: 'Đang tranh chấp',
      PARTIALLY_REFUNDED: 'Hoàn tiền một phần',
      REFUNDED: 'Đã hoàn tiền',
    };

    try {
      const readableStatus =
        bookingStatusLabels[String(newStatus).toUpperCase()] ?? newStatus;
      await this.notificationsService.createNotification(
        this.getCustomerIdStr(booking),
        `Cập nhật trạng thái đơn hàng`,
        `Đơn hàng ${booking.bookingCode} của bạn đã chuyển sang trạng thái: ${readableStatus}`,
        NotificationType.Booking,
        { bookingId: booking._id },
      );
    } catch (e) {
      console.error('Failed to create updateBookingStatus notification:', e);
    }

    // Emit real-time update to customer + provider so both sides refresh without page reload
    try {
      const recipientIds = await this.getBookingStakeholderUserIds(booking);
      this.notificationsService.emitBookingUpdate(
        {
          bookingId: booking._id.toString(),
          bookingCode: booking.bookingCode,
          status: nextStatus,
          deliveredPhotos: (booking as any).deliveredPhotos ?? [],
          handoverPhotos: booking.handoverPhotos ?? [],
          deliveryDriveUrl: (booking as any).deliveryDriveUrl ?? null,
        },
        recipientIds,
      );
    } catch (e) {
      console.warn('Failed to emit booking_updated WebSocket event:', e);
    }

    // Auto trigger settlement if completed / returned
    const isComboPhotoDelivered =
      Boolean((booking as any).photosApproved) ||
      Boolean((booking as any).deliveredPhotos?.length > 0) ||
      Boolean((booking as any).deliveryDriveUrl) ||
      booking.statusTimeline?.some(
        (t) =>
          t.status === BookingStatus.ComboPhotosApproved ||
          t.status === BookingStatus.Completed,
      );

    const isReturnedRentalCompletion =
      nextStatus === BookingStatus.Returned &&
      (booking.bookingType === BookingType.AoDaiRental ||
        (booking.bookingType === BookingType.Combo && isComboPhotoDelivered));
    if (nextStatus === BookingStatus.Completed || isReturnedRentalCompletion) {
      try {
        await this.paymentsService.settleBooking(bookingIdStr);
      } catch (settleErr) {
        console.warn('Auto settlement trigger warning:', settleErr);
      }
    }

    if (
      currentStatus === BookingStatus.DepositPaid &&
      nextStatus === BookingStatus.Confirmed &&
      !staffAssignedDuringConfirm &&
      preAssignedPhotoSchedules.length > 0
    ) {
      try {
        const notifiedStaffUsers = new Set<string>();
        for (const sch of preAssignedPhotoSchedules) {
          const linkedUserId = (sch as any)?.assignedStaffSnapshot?.linkedUserId;
          if (linkedUserId && !notifiedStaffUsers.has(String(linkedUserId))) {
            notifiedStaffUsers.add(String(linkedUserId));
            await this.notificationsService.createNotification(
              String(linkedUserId),
              'Lịch chụp đã được Chủ Studio xác nhận',
              `Đơn ${booking.bookingCode} đã được Chủ Studio duyệt. Bạn đã có thể Check-in bắt đầu chụp khi đến giờ hẹn.`,
              NotificationType.Booking,
              { bookingId: booking._id, scheduleId: (sch as any)._id },
            );
          }
        }
      } catch (e) {
        console.error('Failed to notify pre-assigned staff on CONFIRMED:', e);
      }
    }

    for (const pid of booking.providerIds ?? []) {
      bumpProviderAvailabilityVersion(pid.toString());
    }

    return booking;
  }

  async getAvailableStaffForBooking(
    bookingIdStr: string,
    actorUserId: string,
    actorRoles?: string[],
  ) {
    if (!this.staffAvailabilityService) {
      throw new NotFoundException('Dịch vụ kiểm tra thợ chụp chưa được bật.');
    }
    return this.staffAvailabilityService.getAvailableStaffForBooking(
      bookingIdStr,
      actorUserId,
      actorRoles,
    );
  }

  async getAvailableStaffForSchedule(
    bookingIdStr: string,
    scheduleIdStr: string,
    actorUserId: string,
    actorRoles?: string[],
  ) {
    if (!this.staffAvailabilityService) {
      throw new NotFoundException('Dịch vụ kiểm tra thợ chụp chưa được bật.');
    }
    return this.staffAvailabilityService.getAvailableStaffForSchedule(
      bookingIdStr,
      scheduleIdStr,
      actorUserId,
      actorRoles,
    );
  }

  async assignStaffToSchedule(
    bookingIdStr: string,
    scheduleIdStr: string,
    staffIdStr: string,
    actorUserId: string,
    actorRoles?: string[],
    reason?: string,
  ) {
    if (!this.staffAvailabilityService) {
      throw new NotFoundException('Dịch vụ điều phối thợ chụp chưa được bật.');
    }
    return this.staffAvailabilityService.assignStaffToSchedule(
      bookingIdStr,
      scheduleIdStr,
      staffIdStr,
      actorUserId,
      actorRoles,
      reason,
    );
  }

  private async getContractCancellationRulesByProvider(
    bookingId: Types.ObjectId,
  ): Promise<Map<string, ContractCancellationRule[]>> {
    const result = new Map<string, ContractCancellationRule[]>();
    const contracts = await this.bookingModel.db
      .collection('digital_contracts')
      .find({ bookingId, flowVersion: 2 })
      .toArray();
    for (const contract of contracts) {
      if (!contract.currentVersionId || !contract.providerId) continue;
      const version = await this.bookingModel.db
        .collection('contract_versions')
        .findOne({ _id: contract.currentVersionId, contractId: contract._id });
      const rules = version?.snapshot?.policies?.providerCancellationPolicy
        ?.refundRules;
      if (!Array.isArray(rules) || rules.length === 0) continue;
      result.set(
        contract.providerId.toString(),
        rules.map((rule: any) => ({
          daysBeforeRental: Number(rule.daysBeforeRental),
          refundPercentage: Number(rule.refundPercentage),
        })),
      );
    }
    return result;
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
    const isCustomer = this.getCustomerIdStr(booking) === userId;

    // Tìm các provider ứng với userId này để so sánh Provider ID thật sự
    const userProviders = userId
      ? await this.providerModel.find({ userId: new Types.ObjectId(userId) })
      : [];
    const userProviderIds = userProviders.map((p) => p._id.toString());
    const isProvider = booking.providerIds.some((id) =>
      userProviderIds.includes(id.toString()),
    );

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
      BookingStatus.Disputed,
    ];
    if (nonCancellableStatuses.includes(booking.status)) {
      throw new BadRequestException(
        'Không thể hủy đơn đặt lịch đang thực hiện hoặc đã hoàn thành',
      );
    }

    // PR 3 Financial Guard: Chặn hủy thông thường khi đang có yêu cầu thời tiết chờ xử lý
    if (booking.hasPendingWeatherAction) {
      throw new BadRequestException(
        'Đơn hàng đang có yêu cầu đổi lịch hoặc hủy vì thời tiết đang chờ xử lý. Không thể thực hiện hủy đơn thông thường.',
      );
    }

    try {
      const activeWeatherCancel = await this.bookingModel.db
        .model('WeatherCancellationRequest')
        .findOne({
          bookingId: booking._id,
          status: 'PENDING_ADMIN_REVIEW',
        })
        .lean();
      if (activeWeatherCancel) {
        throw new BadRequestException(
          'Đơn hàng đang có yêu cầu hủy vì thời tiết chờ Admin xử lý. Không thể thực hiện hủy đơn thông thường.',
        );
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
    }

    const now = new Date();
    const cancellationPolicy =
      await this.policyResolverService.getCancellationPolicy();
    let isFreeCancel = true;
    let refundAmount = 0;
    let penaltyReason = '';
    let diffInHours: number | undefined;
    let itemizedContractCancellation: ReturnType<
      typeof calculateItemizedContractCancellation
    > | null = null;

    if (
      isCustomer &&
      booking.status !== BookingStatus.PendingPayment &&
      booking.contractFlowVersion === 2 &&
      booking.bookingType === BookingType.AoDaiRental
    ) {
      const items = await this.bookingItemModel.find({
        bookingId: booking._id,
        itemType: BookingItemType.Product,
      });
      const rulesByProvider =
        await this.getContractCancellationRulesByProvider(booking._id);
      const everyItemHasPolicy =
        items.length > 0 &&
        items.every((item) =>
          Boolean(item.rentalFrom) &&
          rulesByProvider.has(item.providerId.toString()),
        );
      if (everyItemHasPolicy) {
        itemizedContractCancellation = calculateItemizedContractCancellation({
          now,
          rulesByProvider,
          items: items.map((item) => ({
            id: item._id.toString(),
            providerId: item.providerId.toString(),
            rentalFrom: item.rentalFrom!,
            unitPrice: item.unitPrice,
            depositAmount: item.depositAmount,
            quantity: item.quantity,
            discountAmount:
              (item.comboDiscountAmount || 0) +
              (item.shopVoucherDiscountAmount || 0) +
              (item.platformVoucherDiscountAmount || 0),
          })),
        });
        isFreeCancel = itemizedContractCancellation.penaltyAmount === 0;
        const affectedItems = itemizedContractCancellation.breakdown.filter(
          (row) => row.refundPercentage < 100,
        ).length;
        penaltyReason = affectedItems
          ? `Chính sách hủy được tính riêng theo lịch thuê của từng sản phẩm; ${affectedItems}/${items.length} sản phẩm không còn trong mốc hoàn 100% tiền thuê.`
          : '';
      }
    }

    if (
      isCustomer &&
      booking.status !== BookingStatus.PendingPayment &&
      !itemizedContractCancellation
    ) {
      // Tìm booking items để lấy start date sớm nhất
      const items = await this.bookingItemModel.find({
        bookingId: booking._id,
      });
      let earliestStartTime: Date | null = null;

      for (const item of items) {
        let itemStart: Date | null = null;
        if (
          item.rentalType === 'HOURLY' ||
          item.itemType === BookingItemType.PhotographyPackage
        ) {
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
        diffInHours = diffInMs / (1000 * 60 * 60);

        if (diffInHours >= cancellationPolicy.freeCancelBeforeHours) {
          isFreeCancel = true;
        } else {
          // Kiểm tra xem đơn hàng có được tạo trong vòng 72 giờ trước giờ bắt đầu hay không (last-minute booking)
          const createdAtDate = new Date((booking as any).createdAt || now);
          const startMinusCreatedHours =
            (earliestStartTime.getTime() - createdAtDate.getTime()) /
            (1000 * 60 * 60);
          if (
            startMinusCreatedHours < cancellationPolicy.freeCancelBeforeHours
          ) {
            const minsSinceCreation =
              (now.getTime() - createdAtDate.getTime()) / (1000 * 60);
            if (diffInHours >= cancellationPolicy.urgentBookingBeforeHours) {
              // Hạn ân hạn là 60 phút
              if (
                minsSinceCreation <= cancellationPolicy.gracePeriodMinutesNormal
              ) {
                isFreeCancel = true;
              } else {
                isFreeCancel = false;
                penaltyReason = `Đã quá thời gian ân hạn ${cancellationPolicy.gracePeriodMinutesNormal} phút đối với đơn hàng đặt sát giờ (Đặt lúc ${createdAtDate.toLocaleTimeString('vi-VN')}).`;
              }
            } else {
              // Siêu gấp: Hạn ân hạn là 5 phút
              if (
                minsSinceCreation <= cancellationPolicy.gracePeriodMinutesUrgent
              ) {
                isFreeCancel = true;
              } else {
                isFreeCancel = false;
                penaltyReason = `Đã quá thời gian ân hạn ${cancellationPolicy.gracePeriodMinutesUrgent} phút đối với đơn hàng đặt siêu gấp (Đặt lúc ${createdAtDate.toLocaleTimeString('vi-VN')}).`;
              }
            }
          } else {
            // Hủy trễ bình thường
            isFreeCancel = false;
            penaltyReason = `Hủy đơn trễ (dưới ${cancellationPolicy.freeCancelBeforeHours} giờ trước giờ hẹn).`;
          }
        }
      }
    }

    if (isProvider) {
      isFreeCancel = true;
      const violationPolicy =
        await this.policyResolverService.getProviderViolationPolicy();
      const violationPoint = violationPolicy.lateCancelViolationPoint;
      await this.bookingModel.db
        .model('Provider')
        .findOneAndUpdate({ userId: new Types.ObjectId(userId) }, [
          {
            $set: {
              violationCount: {
                $add: [{ $ifNull: ['$violationCount', 0] }, violationPoint],
              },
              status: violationPolicy.autoSuspendEnabled
                ? {
                    $cond: [
                      {
                        $gte: [
                          {
                            $add: [
                              { $ifNull: ['$violationCount', 0] },
                              violationPoint,
                            ],
                          },
                          violationPolicy.maxWarningsBeforeSuspend,
                        ],
                      },
                      ProviderStatus.Suspended,
                      '$status',
                    ],
                  }
                : '$status',
            },
          },
        ]);
    }

    let penaltyAmount = 0;
    const wasPendingPayment = booking.status === BookingStatus.PendingPayment;
    const isNoShow = reason.includes('[KHÁCH VẮNG MẶT - NO SHOW]');
    const depositAmt =
      (booking as any).depositAmount ||
      booking.pricingSummary?.depositTotal ||
      0;
    const grandTotal = booking.pricingSummary?.grandTotal || 0;

    if (wasPendingPayment) {
      refundAmount = 0;
      penaltyAmount = 0;
      isFreeCancel = true;
    } else if (itemizedContractCancellation) {
      refundAmount = Math.min(
        grandTotal,
        itemizedContractCancellation.refundAmount,
      );
      penaltyAmount = Math.max(0, grandTotal - refundAmount);
      isFreeCancel = penaltyAmount === 0;
    } else if (isFreeCancel && !isNoShow) {
      refundAmount = grandTotal;
    } else if (isNoShow || (diffInHours !== undefined && diffInHours < 12)) {
      // < 12h or No-Show: 0% deposit refund (100% deposit compensation to provider), refund remaining balance
      penaltyAmount = Math.min(
        depositAmt > 0 ? depositAmt : grandTotal * 0.3,
        grandTotal,
      );
      refundAmount = Math.max(0, grandTotal - penaltyAmount);
    } else if (
      diffInHours !== undefined &&
      diffInHours >= 12 &&
      diffInHours < 24
    ) {
      // 12h - 24h: 50% deposit refund, 50% deposit compensation to provider
      penaltyAmount = Math.round(
        (depositAmt > 0 ? depositAmt : grandTotal * 0.3) * 0.5,
      );
      refundAmount = Math.max(0, grandTotal - penaltyAmount);
    } else {
      // Fallback late cancel penalty
      const items = await this.bookingItemModel.find({
        bookingId: booking._id,
      });
      for (const item of items) {
        if (item.itemType === 'PRODUCT') {
          penaltyAmount +=
            Math.round(
              item.unitPrice * cancellationPolicy.productLateCancelPenaltyRate,
            ) * item.quantity;
        } else {
          penaltyAmount +=
            Math.round(
              item.unitPrice *
                cancellationPolicy.photographyLateCancelPenaltyRate,
            ) * item.quantity;
        }
      }
      penaltyAmount = Math.min(
        penaltyAmount,
        booking.pricingSummary?.subTotal || grandTotal,
      );
      refundAmount = Math.max(0, grandTotal - penaltyAmount);

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
            providerPenalty +=
              Math.round(
                item.unitPrice *
                  cancellationPolicy.productLateCancelPenaltyRate,
              ) * item.quantity;
          } else {
            providerPenalty +=
              Math.round(
                item.unitPrice *
                  cancellationPolicy.photographyLateCancelPenaltyRate,
              ) * item.quantity;
          }
        }

        if (providerPenalty > 0) {
          if (booking.hasPendingWeatherAction) {
            console.warn(
              `Blocked executeAutoTransfer penalty for booking ${booking.bookingCode} due to active weather action.`,
            );
          } else {
            const provider = await this.bookingModel.db
              .model('Provider')
              .findById(new Types.ObjectId(pIdStr));
            if (provider) {
              let bankName = 'VietinBank';
              let accountNumber = '1029384756';
              let accountHolder = 'PROVIDER STUDIO';

              if (
                provider.paymentAccounts &&
                provider.paymentAccounts.length > 0
              ) {
                const activeAccount =
                  provider.paymentAccounts.find((a: any) => a.isDefault) ||
                  provider.paymentAccounts[0];
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
      }

      // Khách nhận lại phần tiền cọc giữ đồ và phần dư tiền dịch vụ (nếu có)
      refundAmount = Math.max(
        (booking.pricingSummary?.grandTotal || 0) - penaltyAmount,
        0,
      );
    }

    booking.status = BookingStatus.Cancelled;
    booking.cancellation = {
      cancelledBy: new Types.ObjectId(userId || undefined),
      reason:
        reason ||
        (isProvider ? 'Nhà cung cấp chủ động hủy lịch' : 'Khách hàng hủy đơn'),
      cancelledAt: now,
      refundAmount,
    };

    booking.statusTimeline.push({
      status: BookingStatus.Cancelled,
      changedAt: now,
      note: wasPendingPayment
        ? 'Đơn hàng đã được hủy trước khi thanh toán.'
        : isFreeCancel
          ? `Đơn hàng đã được hủy thành công. Hoàn tiền 100% (${refundAmount.toLocaleString('vi-VN')}đ).`
          : itemizedContractCancellation
            ? `Đơn hàng đã bị hủy. Khấu trừ ${penaltyAmount.toLocaleString('vi-VN')}đ theo chính sách hủy và lịch thuê riêng của từng sản phẩm; hoàn lại ${refundAmount.toLocaleString('vi-VN')}đ. ${penaltyReason}`
            : `Đơn hàng đã bị hủy. Khách bị phạt mất cọc dịch vụ (${penaltyAmount.toLocaleString('vi-VN')}đ). Hoàn cọc giữ đồ & số dư (${refundAmount.toLocaleString('vi-VN')}đ). Lý do phạt: ${penaltyReason}`,
      changedBy: userId ? new Types.ObjectId(userId) : null,
    });

    const savedBooking = await booking.save();

    try {
      await this.notificationsService.createNotification(
        this.getCustomerIdStr(booking),
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
      { status: BookingScheduleStatus.Cancelled },
    );

    // Giải phóng các Reservation trong kho để tránh khóa lịch vĩnh viễn
    await this.inventoryReservationModel.updateMany(
      { bookingId: booking._id },
      { $set: { status: ReservationStatus.Cancelled } },
    );

    // Giải phóng slot leases liên quan
    if (this.slotLeaseService) {
      await this.slotLeaseService.releaseBookingLeases(
        booking._id,
        'CANCELLED',
      );
    } else {
      try {
        const leaseColl = this.bookingModel?.db?.collection(
          'inventory_slot_leases',
        );
        if (leaseColl) {
          await leaseColl.updateMany(
            {
              bookingId: booking._id,
              status: { $in: ['TEMP', 'CONFIRMED'] },
            },
            {
              $set: {
                status: 'RELEASED',
                releasedAt: now,
                releaseReason: 'CANCELLED',
              },
            },
          );
        }
      } catch (_) {}
    }

    // Invalidate product busy cache cho các sản phẩm trong đơn
    try {
      const bItems = await this.bookingItemModel
        .find({ bookingId: booking._id })
        .select('productId')
        .lean();
      bItems.forEach((it) => {
        if (it.productId) {
          this.invalidateProductBusyCache(it.productId.toString());
        }
      });
    } catch (_) {}

    // Kích hoạt hoàn tiền cọc / hoàn tiền dịch vụ cho khách hàng
    if (refundAmount > 0) {
      try {
        await this.refundWorkflowService.createFromCancellation({
          bookingId: booking._id.toString(),
          requestedBy: this.getCustomerIdStr(booking),
          amount: refundAmount,
          reason,
          type: RefundType.Cancellation,
          sourceEventId: `refund:cancellation:${booking._id}`,
          isFreeCancel,
        });
      } catch (err) {
        console.error('Refund workflow failed during cancelBooking:', err);
      }
    }

    // Hủy các đối soát (settlements) liên quan nếu có
    try {
      await this.paymentsService.cancelSettlementsForBooking(
        booking._id.toString(),
      );
    } catch (err) {
      console.error(
        'PaymentsService.cancelSettlementsForBooking failed during cancelBooking:',
        err,
      );
    }

    // Trả về định dạng phù hợp cho cả 2 luồng gọi
    return Array.isArray(rolesOrCancelledByUserId)
      ? {
          success: true,
          booking: savedBooking,
          isFreeCancel,
          refundAmount,
          penaltyReason,
        }
      : savedBooking;
  }

  private async getBookingHoldExpiresAt(): Promise<Date> {
    const policy = await this.policyResolverService.getBookingHoldPolicy();
    return new Date(Date.now() + policy.holdMinutes * 60 * 1000);
  }

  async getCustomerBookings(customerId: string): Promise<any[]> {
    const bookings = await this.bookingModel
      .find({ customerId: new Types.ObjectId(customerId) })
      .sort({ createdAt: -1 })
      .exec();

    if (!bookings.length) return [];

    const bookingIds = bookings.map((b) => b._id);

    const [allItems, allSchedules] = await Promise.all([
      this.bookingItemModel
        .find({ bookingId: { $in: bookingIds } })
        .populate({
          path: 'productId',
          populate: { path: 'providerId' },
        })
        .populate('photographyPackageId')
        .populate('providerId')
        .lean()
        .exec(),
      this.bookingModel.db
        .model('BookingSchedule')
        .find({ bookingId: { $in: bookingIds } })
        .lean()
        .exec(),
    ]);

    const itemsByBookingMap = new Map<string, any[]>();
    for (const item of allItems) {
      const key = item.bookingId.toString();
      if (!itemsByBookingMap.has(key)) itemsByBookingMap.set(key, []);
      itemsByBookingMap.get(key)!.push(item);
    }

    const schedulesByBookingMap = new Map<string, any[]>();
    for (const sched of allSchedules) {
      const key = (sched as any).bookingId?.toString();
      if (!key) continue;
      if (!schedulesByBookingMap.has(key)) schedulesByBookingMap.set(key, []);
      schedulesByBookingMap.get(key)!.push(sched);
    }

    return bookings.map((booking) => {
      const bId = booking._id.toString();
      const items = itemsByBookingMap.get(bId) || [];
      const schedules = schedulesByBookingMap.get(bId) || [];

      const updatedItems = items.map((item) => {
        const prodName = item.productId?.name;
        const pkgName = item.photographyPackageId?.name;
        const resolvedName =
          prodName ||
          pkgName ||
          item.packageSnapshot?.name ||
          item.name ||
          null;

        if (item.itemType === 'PHOTOGRAPHY_PACKAGE') {
          const matchedSchedule = schedules.find(
            (s: any) =>
              s.scheduleType === 'PHOTOSHOOT' &&
              s.status !== 'CANCELLED' &&
              s.status !== 'EXPIRED',
          );
          if (matchedSchedule) {
            let slot = item.shootTimeSlot || matchedSchedule.timeSlot;
            if (!slot && matchedSchedule.startsAt && matchedSchedule.endsAt) {
              const startD = new Date(matchedSchedule.startsAt);
              const endD = new Date(matchedSchedule.endsAt);
              const startH = String(startD.getHours()).padStart(2, '0');
              const startM = String(startD.getMinutes()).padStart(2, '0');
              const endH = String(endD.getHours()).padStart(2, '0');
              const endM = String(endD.getMinutes()).padStart(2, '0');
              slot = `${startH}:${startM} - ${endH}:${endM}`;
            }
            return {
              ...item,
              name: resolvedName,
              shootDate:
                item.shootDate ||
                matchedSchedule.startsAt ||
                matchedSchedule.scheduledDate,
              shootTimeSlot: slot || null,
              shootLocation:
                item.shootLocation || matchedSchedule.locationAddress,
            };
          }
        }
        return {
          ...item,
          name: resolvedName,
        };
      });

      return {
        ...booking.toObject(),
        items: updatedItems,
        schedules,
      };
    });
  }

  invalidateProductBusyCache(productId?: string): void {
    if (this.productBusyCacheService) {
      this.productBusyCacheService.invalidate(productId);
    }
    if (productId) {
      try {
        this.productBusyCache.delete(new Types.ObjectId(productId).toString());
      } catch {
        this.productBusyCache.delete(productId.toString());
      }
    } else {
      this.productBusyCache.clear();
    }
  }

  async getBusySchedulesForProduct(productId: string): Promise<{
    bookedDates: string[];
    bookedSlots: { date: string; timeSlot: string }[];
    variantBookedDates?: Record<string, string[]>;
    /** Variant keys with no inventory currently eligible for rental. */
    variantUnavailableDates?: Record<string, string[]>;
    variantBookedSlots?: Record<
      string,
      Array<{
        date: string;
        timeSlot: string;
        purpose?: 'RENTAL' | 'TURNAROUND';
      }>
    >;
    workingDays?: number[];
    offDays?: string[];
    hasSchedule?: boolean;
  }> {
    const idStr =
      typeof productId === 'string'
        ? productId
        : (productId as any)?.toString?.();
    if (
      !idStr ||
      !Types.ObjectId.isValid(idStr) ||
      !/^[0-9a-fA-F]{24}$/.test(idStr)
    ) {
      throw new BadRequestException('ID sản phẩm không hợp lệ');
    }

    const cacheKey = new Types.ObjectId(idStr).toString();
    const cached = this.productBusyCacheService
      ? this.productBusyCacheService.get(cacheKey)
      : this.productBusyCache.get(cacheKey)?.value;
    if (cached) return cached;

    const inventoryItems = await this.inventoryItemModel
      .find({
        productId: new Types.ObjectId(idStr),
        conditionStatus: { $nin: ['LOCKED', 'RETIRED'] },
        // Only operational inventory can satisfy a new rental. Previously
        // RENTED/MAINTENANCE rows were counted as stock, so the calendar could
        // leave dates selectable and checkout rejected them later.
        $or: [
          { status: 'AVAILABLE' },
          { status: 'CLEANING', operationalAvailableFrom: { $ne: null } },
        ],
      } as any)
      .select('_id size color status operationalAvailableFrom')
      .lean()
      .exec();

    // Keep locked/maintenance variants in the response so the product calendar
    // can disable them instead of allowing a selection that checkout will reject.
    const allVariantItems = await this.inventoryItemModel
      .find({
        productId: new Types.ObjectId(idStr),
        conditionStatus: { $ne: 'RETIRED' },
      } as any)
      .select('_id size color conditionStatus status')
      .lean()
      .exec();

    if (inventoryItems.length === 0) {
      const variantUnavailableDates: Record<string, string[]> = {};
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 365);
      for (const item of allVariantItems) {
        const key = `${item.size.toUpperCase()}_${this.normalizeColor(item.color)}`;
        if (!variantUnavailableDates[key]) variantUnavailableDates[key] = [];
      }
      const value = {
        bookedDates: [],
        bookedSlots: [],
        variantBookedDates: {},
        variantUnavailableDates,
        variantBookedSlots: {},
      };
      if (this.productBusyCacheService) {
        this.productBusyCacheService.set(cacheKey, value);
      } else {
        this.productBusyCache.set(cacheKey, {
          value,
          expiresAt: Date.now() + 10_000,
        });
      }
      return value;
    }

    const stockMap = new Map<string, number>();
    const sizeColors = new Set<string>();
    const itemToVariantKey = new Map<string, string>();
    const allVariantKeys = new Set<string>();
    allVariantItems.forEach((item: any) => {
      allVariantKeys.add(
        `${item.size.toUpperCase()}_${this.normalizeColor(item.color)}`,
      );
    });

    inventoryItems.forEach((item) => {
      const key = `${item.size.toUpperCase()}_${this.normalizeColor(item.color)}`;
      sizeColors.add(key);
      stockMap.set(key, (stockMap.get(key) || 0) + 1);
      itemToVariantKey.set(item._id.toString(), key);
    });

    const itemIds = inventoryItems.map((i) => i._id);
    const now = new Date();

    // Query active reservations (CONFIRMED or unexpired TEMP_RESERVED)
    const reservations = await this.inventoryReservationModel
      .find({
        inventoryItemId: { $in: itemIds },
        $or: [
          { status: ReservationStatus.Confirmed },
          {
            status: ReservationStatus.TempReserved,
            expiresAt: { $gt: now },
          },
        ],
      })
      .select('inventoryItemId reservedFrom reservedTo status expiresAt')
      .lean()
      .exec();

    // Filter to strictly confirmed or active unexpired temp reservations (guards against TTL lag)
    const activeReservations = reservations.filter((res) => {
      if (res.status === ReservationStatus.Confirmed) return true;
      if (res.status === ReservationStatus.TempReserved) {
        return res.expiresAt && new Date(res.expiresAt) > now;
      }
      return false;
    });

    // Query active slot leases (both RENTAL and TURNAROUND leases)
    // Fail-closed: database query errors must propagate and fail closed (do NOT catch and return empty array).
    let slotLeases: any[] = [];
    const leaseColl = this.bookingModel?.db?.collection(
      'inventory_slot_leases',
    );
    if (leaseColl) {
      slotLeases = await leaseColl
        .find({
          inventoryItemId: { $in: itemIds },
          $or: [
            { status: 'CONFIRMED' },
            { status: 'TEMP', expiresAt: { $gt: now } },
          ],
        })
        .project({ inventoryItemId: 1, dateStr: 1, slotIndex: 1, purpose: 1 })
        .toArray();
    }

    const SLOT_INDEX_TO_TIME_SLOT: Record<number, string> = {
      1: '07:00-09:00',
      2: '09:00-11:00',
      3: '11:00-13:00',
      4: '13:00-15:00',
      5: '15:00-17:00',
      6: '17:00-19:00',
      7: '19:00-21:00',
    };

    let turnaroundSlotsCount = 1;
    let providerScheduleConfig: any = undefined;
    let workingDays: number[] = [];
    const offDays: string[] = [];
    let hasSchedule = false;

    try {
      const product = await this.productModel
        .findById(productId)
        .select('providerId');
      if (product && product.providerId) {
        const provColl = this.bookingModel?.db?.collection('providers');
        if (provColl) {
          const prov = await provColl.findOne(
            { _id: new Types.ObjectId(product.providerId.toString()) },
            { projection: { 'rentalSettings.turnaroundSlots': 1 } },
          );
          if (prov?.rentalSettings?.turnaroundSlots !== undefined) {
            turnaroundSlotsCount = Number(prov.rentalSettings.turnaroundSlots);
          }
        }
        const schedColl =
          this.bookingModel?.db?.collection('provider_schedules');
        if (schedColl) {
          const scheds = await schedColl
            .find({
              providerId: new Types.ObjectId(product.providerId.toString()),
              $or: [{ capability: null }, { capability: 'AODAI_RENTAL' }],
            })
            .toArray();

          if (scheds && scheds.length > 0) {
            hasSchedule = true;
            const recurringSchedules = scheds.filter(
              (s: any) =>
                s.scheduleType === 'RECURRING' &&
                typeof s.dayOfWeek === 'number',
            );
            let weeklyOffDays: number[] | undefined = undefined;
            if (recurringSchedules.length > 0) {
              const workingSet = new Set(
                recurringSchedules.map((s: any) => s.dayOfWeek as number),
              );
              workingDays = Array.from(workingSet);
              weeklyOffDays = [0, 1, 2, 3, 4, 5, 6].filter(
                (d) => !workingSet.has(d),
              );
            }

            for (const s of scheds) {
              if (
                s.scheduleType === 'SPECIFIC_DATE' &&
                Array.isArray(s.offDays)
              ) {
                for (const d of s.offDays) {
                  const dateStr = new Date(d).toLocaleDateString('en-CA', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                  });
                  offDays.push(dateStr);
                }
              }
            }

            providerScheduleConfig = {
              weeklyOffDays,
              offDays: offDays.length > 0 ? offDays : undefined,
            };
          }
        }
      }
    } catch (_) {}

    const dailyBookings = new Map<string, Map<string, Set<string>>>();
    // A slot lease also blocks a daily rental for that date (checkout applies
    // this rule), so keep lease dates in the same per-variant calendar model.
    const dailyLeaseBookings = new Map<string, Map<string, Set<string>>>();
    // variantKey -> slotKey (dateStr_timeSlot) -> Map<itemIdStr, 'RENTAL' | 'TURNAROUND' | undefined>
    const variantHourly = new Map<
      string,
      Map<string, Map<string, 'RENTAL' | 'TURNAROUND' | undefined>>
    >();

    const trackHourly = (
      variantKey: string,
      dateStr: string,
      timeSlot: string,
      itemIdStr: string,
      purpose?: 'RENTAL' | 'TURNAROUND',
    ) => {
      if (!variantHourly.has(variantKey)) {
        variantHourly.set(variantKey, new Map());
      }
      const slotKey = `${dateStr}_${timeSlot}`;
      const vMap = variantHourly.get(variantKey)!;
      if (!vMap.has(slotKey)) {
        vMap.set(slotKey, new Map());
      }
      const itemMap = vMap.get(slotKey)!;
      const existing = itemMap.get(itemIdStr);
      if (!existing || existing === 'TURNAROUND') {
        itemMap.set(itemIdStr, purpose);
      }
    };

    // 1. Process slot leases (includes both RENTAL and TURNAROUND leases)
    slotLeases.forEach((lease: any) => {
      const itemIdStr = lease.inventoryItemId?.toString();
      const variantKey = itemToVariantKey.get(itemIdStr);
      if (!variantKey) return;
      if (lease.dateStr) {
        if (!dailyLeaseBookings.has(lease.dateStr))
          dailyLeaseBookings.set(lease.dateStr, new Map());
        const byVariant = dailyLeaseBookings.get(lease.dateStr)!;
        if (!byVariant.has(variantKey)) byVariant.set(variantKey, new Set());
        byVariant.get(variantKey)!.add(itemIdStr);
      }
      const timeSlot = SLOT_INDEX_TO_TIME_SLOT[lease.slotIndex];
      if (timeSlot && lease.dateStr) {
        trackHourly(
          variantKey,
          lease.dateStr,
          timeSlot,
          itemIdStr,
          lease.purpose,
        );
      }
    });

    // 2. Process active reservations (legacy / fallback)
    activeReservations.forEach((res) => {
      const itemIdStr = res.inventoryItemId.toString();
      const variantKey = itemToVariantKey.get(itemIdStr);
      if (!variantKey) return;

      const start = new Date(res.reservedFrom);
      const end = new Date(res.reservedTo);

      const diffMs = end.getTime() - start.getTime();
      const isHourly =
        diffMs < 24 * 60 * 60 * 1000 && diffMs % (24 * 60 * 60 * 1000) !== 0;

      if (!isHourly) {
        const current = new Date(start);
        while (current <= end) {
          const dateStr = current.toLocaleDateString('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
          });
          if (!dailyBookings.has(dateStr)) {
            dailyBookings.set(dateStr, new Map<string, Set<string>>());
          }
          const m = dailyBookings.get(dateStr)!;
          if (!m.has(variantKey)) {
            m.set(variantKey, new Set<string>());
          }
          m.get(variantKey)!.add(itemIdStr);
          current.setDate(current.getDate() + 1);
        }
      } else {
        const dateStr = start.toLocaleDateString('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const startH = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(start);
        const endH = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(end);
        const timeSlot = `${startH}-${endH}`;

        let parsedSuccessfully = false;
        if (turnaroundSlotsCount >= 0) {
          try {
            const timeEngine = new TimeSlotEngineService();
            const { startSlotIndex, rentalSlotCount } =
              timeEngine.parseAndValidateTimeSlot(timeSlot);
            const upfront = timeEngine.calculateUpfrontBlock(
              dateStr,
              startSlotIndex,
              rentalSlotCount,
              turnaroundSlotsCount,
              providerScheduleConfig,
            );
            for (const rSlot of upfront.rentalSlots) {
              const rSlotStr = SLOT_INDEX_TO_TIME_SLOT[rSlot.slotIndex];
              if (rSlotStr && rSlot.dateStr) {
                trackHourly(
                  variantKey,
                  rSlot.dateStr,
                  rSlotStr,
                  itemIdStr,
                  'RENTAL',
                );
              }
            }
            for (const tSlot of upfront.turnaroundSlots) {
              const tSlotStr = SLOT_INDEX_TO_TIME_SLOT[tSlot.slotIndex];
              if (tSlotStr && tSlot.dateStr) {
                trackHourly(
                  variantKey,
                  tSlot.dateStr,
                  tSlotStr,
                  itemIdStr,
                  'TURNAROUND',
                );
              }
            }
            parsedSuccessfully = true;
          } catch (_) {}
        }

        if (!parsedSuccessfully) {
          trackHourly(variantKey, dateStr, timeSlot, itemIdStr, 'RENTAL');
        }
      }
    });

    dailyLeaseBookings.forEach((byVariant, dateStr) => {
      if (!dailyBookings.has(dateStr)) dailyBookings.set(dateStr, new Map());
      const target = dailyBookings.get(dateStr)!;
      byVariant.forEach((itemIds, variantKey) => {
        if (!target.has(variantKey)) target.set(variantKey, new Set());
        const existing = target.get(variantKey)!;
        itemIds.forEach((itemId) => existing.add(itemId));
      });
    });

    const bookedDates: string[] = [];
    const variantBookedDates: Record<string, string[]> = {};
    const variantUnavailableDates: Record<string, string[]> = {};

    // A variant with no eligible inventory is unavailable for every future day.
    // This covers locked/maintenance items and keeps the calendar consistent
    // with the checkout availability query.
    const unavailableHorizon: string[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 365; i++) {
      unavailableHorizon.push(
        cursor.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
      );
      cursor.setDate(cursor.getDate() + 1);
    }
    allVariantKeys.forEach((key) => {
      if (!stockMap.has(key) || (stockMap.get(key) || 0) <= 0) {
        variantUnavailableDates[key] = unavailableHorizon;
      }
    });

    dailyBookings.forEach((m, dateStr) => {
      let allKeysBooked = true;
      for (const key of sizeColors) {
        const bookedCount = m.get(key)?.size || 0;
        const totalStock = stockMap.get(key) || 0;
        if (bookedCount >= totalStock && totalStock > 0) {
          if (!variantBookedDates[key]) variantBookedDates[key] = [];
          variantBookedDates[key].push(dateStr);
        } else {
          allKeysBooked = false;
        }
      }
      if (allKeysBooked) {
        bookedDates.push(dateStr);
      }
    });

    const bookedSlots: { date: string; timeSlot: string }[] = [];
    const variantBookedSlots: Record<
      string,
      Array<{
        date: string;
        timeSlot: string;
        purpose?: 'RENTAL' | 'TURNAROUND';
      }>
    > = {};
    for (const key of sizeColors) {
      variantBookedSlots[key] = [];
    }
    const allHourlySlotKeys = new Set<string>();

    variantHourly.forEach((slotsMap, variantKey) => {
      const totalStock = stockMap.get(variantKey) || 0;
      slotsMap.forEach((itemMap, slotKey) => {
        allHourlySlotKeys.add(slotKey);
        if (itemMap.size >= totalStock && totalStock > 0) {
          const idx = slotKey.indexOf('_');
          const date = slotKey.substring(0, idx);
          const timeSlot = slotKey.substring(idx + 1);

          let purpose: 'RENTAL' | 'TURNAROUND' | undefined = undefined;
          const purposes = Array.from(itemMap.values());
          if (purposes.every((p) => p === 'TURNAROUND')) {
            purpose = 'TURNAROUND';
          } else if (purposes.some((p) => p === 'RENTAL')) {
            purpose = 'RENTAL';
          }

          variantBookedSlots[variantKey].push({
            date,
            timeSlot,
            ...(purpose ? { purpose } : {}),
          });
        }
      });
    });

    allHourlySlotKeys.forEach((slotKey) => {
      let allKeysBooked = true;
      for (const key of sizeColors) {
        const vMap = variantHourly.get(key);
        const itemMap = vMap?.get(slotKey);
        const bookedCount = itemMap?.size || 0;
        const totalStock = stockMap.get(key) || 0;
        if (bookedCount < totalStock) {
          allKeysBooked = false;
          break;
        }
      }
      if (allKeysBooked) {
        const idx = slotKey.indexOf('_');
        const date = slotKey.substring(0, idx);
        const timeSlot = slotKey.substring(idx + 1);
        bookedSlots.push({ date, timeSlot });
      }
    });

    const value = {
      bookedDates,
      bookedSlots,
      variantBookedDates,
      variantUnavailableDates,
      variantBookedSlots,
      workingDays: hasSchedule ? workingDays : undefined,
      offDays: hasSchedule ? offDays : undefined,
      hasSchedule,
    };
    if (this.productBusyCacheService) {
      this.productBusyCacheService.set(cacheKey, value);
    } else {
      this.productBusyCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + 10_000,
      });
    }
    return value;
  }

  async getBusySchedulesForProvider(
    providerId: string,
    staffId?: string,
  ): Promise<{
    bookedDates: string[];
    bookedSlots: { date: string; timeSlot: string; bookingItemId: string }[];
    totalActiveStaff?: number;
    maxConcurrentSessions?: number | null;
    maxDailySessions?: number | null;
    effectiveCapacity?: number;
    slotAvailability?: any[];
    dailyAvailability?: Array<{
      date: string;
      used: number;
      limit: number;
      remaining: number;
    }>;
  }> {
    const idStr =
      typeof providerId === 'string'
        ? providerId
        : (providerId as any)?.toString?.();
    if (
      !idStr ||
      !Types.ObjectId.isValid(idStr) ||
      !/^[0-9a-fA-F]{24}$/.test(idStr)
    ) {
      throw new BadRequestException('ID nhà cung cấp không hợp lệ');
    }

    const providerObjId = new Types.ObjectId(idStr);
    const cacheKey = `${providerObjId.toString()}:${staffId || 'ALL'}`;
    const currentVersion = getProviderAvailabilityVersion(
      providerObjId.toString(),
    );
    const cached = this.providerBusyCache.get(cacheKey);
    if (
      cached &&
      cached.expiresAt > Date.now() &&
      cached.version === currentVersion
    ) {
      return cached.value;
    }

    if (this.staffAvailabilityService) {
      const value =
        await this.staffAvailabilityService.computeBusyScheduleSummary(
          providerObjId,
          staffId,
        );
      this.providerBusyCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + 10_000,
        version: currentVersion,
      });
      return value;
    }

    const bookedDates = new Set<string>();
    const bookedSlots: {
      date: string;
      timeSlot: string;
      bookingItemId: string;
    }[] = [];
    const now = new Date();

    // Start both data sources immediately. They are independent queries and
    // must not wait on each other over the remote MongoDB connection.
    const v2SchedulesPromise = this.bookingScheduleModel
      .find({
        providerId: providerObjId || providerId,
        scheduleType: BookingScheduleType.Photoshoot,
        $or: [
          { status: BookingScheduleStatus.Confirmed },
          { status: BookingScheduleStatus.Scheduled },
          { status: BookingScheduleStatus.Held, holdExpiresAt: { $gt: now } },
        ],
      })
      .select('providerLocalDate startsAt endsAt bookingItemId bookingId')
      .lean()
      .exec();

    const legacyItemsPromise = this.bookingItemModel
      .find(providerObjId ? { providerId: providerObjId } : { providerId })
      .select('bookingId shootDate shootTimeSlot rescheduleRequest')
      .lean()
      .exec();

    // 1. Query BookingSchedule (v2 schedules)
    try {
      const v2Schedules = await v2SchedulesPromise;

      for (const schedule of v2Schedules) {
        let dateKey = (schedule as any).providerLocalDate;
        let slotStr = '';

        if (schedule.startsAt && schedule.endsAt) {
          const startD = new Date(schedule.startsAt);
          const endD = new Date(schedule.endsAt);
          if (!dateKey) {
            dateKey = startD.toLocaleDateString('en-CA', {
              timeZone: 'Asia/Ho_Chi_Minh',
            });
          }
          const startH = String(startD.getHours()).padStart(2, '0');
          const startM = String(startD.getMinutes()).padStart(2, '0');
          const endH = String(endD.getHours()).padStart(2, '0');
          const endM = String(endD.getMinutes()).padStart(2, '0');
          slotStr = `${startH}:${startM}-${endH}:${endM}`;
        }

        if (dateKey && slotStr) {
          bookedSlots.push({
            date: dateKey,
            timeSlot: slotStr,
            bookingItemId: (
              schedule.bookingItemId ||
              schedule.bookingId ||
              schedule._id
            ).toString(),
          });
          bookedDates.add(dateKey);
        }
      }
    } catch (e) {
      console.warn('Unable to query v2 BookingSchedules for provider:', e);
    }

    // 2. Query BookingItems (legacy / active bookings)
    try {
      // Query this provider's booking items first. The previous version
      // loaded every active booking in the system and only then filtered by
      // provider, which was especially expensive with a remote MongoDB.
      const items = await legacyItemsPromise;

      if (items.length) {
        const bookingIds = [
          ...new Set(items.map((item) => item.bookingId.toString())),
        ]
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id));
        const activeBookings = await this.bookingModel
          .find({
            _id: { $in: bookingIds },
            status: {
              $nin: [
                BookingStatus.Cancelled,
                BookingStatus.Completed,
                BookingStatus.Returned,
                BookingStatus.Refunded,
              ],
            },
          })
          .select('_id')
          .lean()
          .exec();
        const activeBookingIds = new Set(
          activeBookings.map((booking) => booking._id.toString()),
        );

        items
          .filter((item) => activeBookingIds.has(item.bookingId.toString()))
          .forEach((item) => {
            let dateStr = '';
            if (item.shootDate) {
              const rawDate: any = item.shootDate;
              if (typeof rawDate === 'string') {
                dateStr = rawDate.slice(0, 10);
              } else {
                dateStr = new Date(rawDate).toLocaleDateString('en-CA', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                });
              }
            }

            if (dateStr && item.shootTimeSlot) {
              bookedSlots.push({
                date: dateStr,
                timeSlot: item.shootTimeSlot,
                bookingItemId: item._id.toString(),
              });
              bookedDates.add(dateStr);
            }
            const req = (item as any).rescheduleRequest;
            if (
              req &&
              ['PENDING', 'PROCESSING'].includes(req.status) &&
              req.newShootDate &&
              req.newShootTimeSlot &&
              (!req.lockedExpiresAt ||
                new Date(req.lockedExpiresAt) > new Date())
            ) {
              const reqDateStr =
                typeof req.newShootDate === 'string'
                  ? req.newShootDate.slice(0, 10)
                  : req.newShootDate;
              bookedSlots.push({
                date: reqDateStr,
                timeSlot: req.newShootTimeSlot,
                bookingItemId: item._id.toString(),
              });
              bookedDates.add(reqDateStr);
            }
          });
      }
    } catch (e) {
      console.warn('Unable to query BookingItems for provider:', e);
    }

    const value = {
      bookedDates: Array.from(bookedDates),
      bookedSlots,
    };
    this.providerBusyCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + 10_000,
      version: currentVersion,
    });
    return value;
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

  async getProductStockCount(
    productId: string,
    size: string,
    color: string,
  ): Promise<{ stock: number }> {
    const sizeVal = size.trim().toUpperCase();
    const colorVal = this.normalizeColor(color);

    const count = await this.inventoryItemModel.countDocuments({
      productId: new Types.ObjectId(productId),
      size: sizeVal,
      color: colorVal,
      status: 'AVAILABLE',
      conditionStatus: {
        $nin: ['LOCKED', 'RETIRED'],
      },
    } as any);

    return { stock: count };
  }

  async getProductStockCounts(
    requests: Array<{
      key?: string;
      productId?: string;
      size?: string;
      color?: string;
    }>,
  ): Promise<Array<{ key: string; stock: number }>> {
    const normalized = requests
      .filter(
        (item) =>
          Types.ObjectId.isValid(item.productId ?? '') &&
          Boolean(item.size?.trim()) &&
          Boolean(item.color?.trim()),
      )
      .map((item) => ({
        requestKey: item.key,
        productId: new Types.ObjectId(item.productId as string),
        size: item.size!.trim().toUpperCase(),
        color: this.normalizeColor(item.color),
      }));

    if (!normalized.length) return [];

    const uniqueRequests = Array.from(
      new Map(
        normalized.map((item) => [
          `${item.productId.toString()}:${item.size}:${item.color}`,
          item,
        ]),
      ).values(),
    );
    const counts = await this.inventoryItemModel
      .aggregate([
        {
          $match: {
            $or: uniqueRequests.map((item) => ({
              productId: item.productId,
              size: item.size,
              color: item.color,
            })),
            status: 'AVAILABLE',
            conditionStatus: { $nin: ['LOCKED', 'RETIRED'] },
          },
        },
        {
          $group: {
            _id: { productId: '$productId', size: '$size', color: '$color' },
            stock: { $sum: 1 },
          },
        },
      ])
      .exec();
    const stockByKey = new Map(
      counts.map((row: any) => [
        `${row._id.productId.toString()}:${row._id.size}:${row._id.color}`,
        Number(row.stock) || 0,
      ]),
    );

    return normalized.map((item) => {
      const key = `${item.productId.toString()}:${item.size}:${item.color}`;
      return { key: item.requestKey ?? key, stock: stockByKey.get(key) ?? 0 };
    });
  }

  async getProductStockSummary(productId: string): Promise<any[]> {
    const items = await this.inventoryItemModel.find({
      productId: new Types.ObjectId(productId),
      status: 'AVAILABLE',
      conditionStatus: {
        $nin: ['LOCKED', 'RETIRED'],
      },
    } as any);

    const summary: Record<string, number> = {};
    items.forEach((item) => {
      const sizeKey = (item.size || '').trim().toUpperCase();
      const colorKey = (item.color || '').trim().toUpperCase();
      const key = `${sizeKey}_${colorKey}`;
      summary[key] = (summary[key] || 0) + 1;
    });

    return Object.entries(summary).map(([key, count]) => {
      const [size, color] = key.split('_');
      return { size, color, stock: count };
    });
  }

  private async notifyRentalPriceMilestones(
    items: Array<{ productId?: Types.ObjectId | { _id?: Types.ObjectId } | null }>,
  ): Promise<void> {
    try {
      const productIds = items
        .map((item) => (item.productId as any)?._id ?? item.productId)
        .filter((id): id is Types.ObjectId => Boolean(id))
        .map((id) => new Types.ObjectId(id));
      const entries =
        await this.productsService.getRentalPriceSuggestionEntries(productIds);

      for (const entry of entries) {
        const suggestion = entry.suggestion;
        if (
          !entry.providerId ||
          !suggestion.eligible ||
          suggestion.reminderNumber === null ||
          suggestion.suggestedPrice === null
        ) {
          continue;
        }
        const provider = await this.providerModel
          .findById(entry.providerId)
          .select('userId')
          .lean();
        if (!provider?.userId) continue;

        const dedupeKey = `rental-price-review:${entry.productId}:${suggestion.rentalCount}`;
        await this.notificationsService.createNotificationOnce(
          provider.userId.toString(),
          dedupeKey,
          'Đề xuất xem lại giá thuê áo dài',
          `${entry.name} đã đạt trung bình ${suggestion.rentalCount} lượt thuê/áo. Theo tình trạng hiện tại, hệ thống đề xuất giảm ${suggestion.discountPercent}% còn ${suggestion.suggestedPrice.toLocaleString('vi-VN')}đ/ngày. Bạn có thể áp dụng hoặc tự điều chỉnh giá.`,
          NotificationType.System,
          {
            action: 'REVIEW_RENTAL_PRICE',
            targetView: 'collections',
            targetTab: 'products',
            productId: entry.productId,
            rentalCount: suggestion.rentalCount,
            reminderNumber: suggestion.reminderNumber,
          },
        );
      }
    } catch (error) {
      console.warn('Failed to create rental price milestone notification:', error);
    }
  }

  async customerConfirmPickup(
    bookingId: string,
    customerId: string,
    evidencePhotos?: string[],
  ): Promise<any> {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }
    if (this.getCustomerIdStr(booking) !== customerId) {
      throw new ForbiddenException('Bạn không có quyền xác nhận đơn này');
    }

    // Idempotency check: if already PickedUp, return success without duplicate timeline
    if (booking.status === BookingStatus.PickedUp) {
      return { success: true, booking, idempotent: true };
    }

    if (booking.status !== BookingStatus.PickupPending) {
      throw new BadRequestException('Đơn hàng không ở trạng thái chờ nhận đồ');
    }

    // Server validation: verify current time has reached valid pickup window (within 60m before start or after)
    const items = await this.bookingItemModel.find({ bookingId: booking._id });
    const startDates: Date[] = [];
    if ((booking as any).rentalFrom)
      startDates.push(new Date((booking as any).rentalFrom));
    for (const it of items) {
      const rFrom =
        it.rentalFrom ||
        (it as any).rentalFulfillment?.rentalFrom ||
        (it as any).bookingDate;
      if (rFrom) startDates.push(new Date(rFrom));
      if (it.shootDate) {
        const d = new Date(it.shootDate);
        if (it.shootTimeSlot) {
          const startH = parseInt(it.shootTimeSlot.split('-')[0] || '0', 10);
          d.setHours(startH, 0, 0, 0);
        }
        startDates.push(d);
      }
    }
    const validStarts = startDates.filter((d) => !isNaN(d.getTime()));
    if (validStarts.length > 0) {
      const earliestStart = new Date(
        Math.min(...validStarts.map((d) => d.getTime())),
      );
      if (
        !this.allowEarlyRentalPickup() &&
        Date.now() < earliestStart.getTime() - 60 * 60 * 1000
      ) {
        throw new BadRequestException(
          'Chưa đến khung giờ nhận đồ theo lịch hẹn. Bạn chỉ có thể xác nhận khi đến giờ nhận áo.',
        );
      }
    }

    const rentalItems = items.filter(
      (item) =>
        item.itemType === BookingItemType.Product && !!item.rentalFulfillment,
    );
    const itemsMissingHandoverEvidence = rentalItems.filter(
      (item) =>
        item.rentalFulfillment?.status !==
          RentalFulfillmentStatus.ReadyForPickup ||
        !item.rentalFulfillment?.pickupEvidence?.files?.length,
    );
    if (itemsMissingHandoverEvidence.length > 0) {
      throw new BadRequestException(
        'Shop chưa gửi đầy đủ ảnh bàn giao cho từng trang phục. Bạn chưa thể xác nhận nhận áo.',
      );
    }

    let session: ClientSession | null = null;
    if (typeof this.bookingModel.db?.startSession === 'function') {
      try {
        session = await this.bookingModel.db.startSession();
        session.startTransaction();
      } catch {
        session = null;
      }
    }

    try {
      if (evidencePhotos && evidencePhotos.length) {
        booking.handoverPhotos = [
          ...(booking.handoverPhotos || []),
          ...evidencePhotos,
        ];
      }

      booking.status = BookingStatus.PickedUp;
      booking.statusTimeline.push({
        status: BookingStatus.PickedUp,
        changedAt: new Date(),
        note: 'Khách hàng gửi ảnh hiện trạng và xác nhận nhận áo thành công.',
      });

      await booking.save(session ? { session } : undefined);

      await this.bookingItemModel.updateMany(
        {
          bookingId: booking._id,
          itemType: BookingItemType.Product,
        },
        {
          $set: {
            'rentalFulfillment.status': RentalFulfillmentStatus.PickedUp,
            'rentalFulfillment.inventoryStatus':
              RentalInventoryStatus.RentedOut,
            'rentalFulfillment.pickedUpAt': new Date(),
          },
        },
        session ? { session } : undefined,
      );

      const reservations = this.inventoryReservationModel
        ? await this.inventoryReservationModel.find(
            { bookingId: booking._id },
            null,
            session ? { session } : undefined,
          )
        : [];
      const invItemIds = [
        ...new Set(
          [
            ...items.map((it) => it.inventoryItemId?.toString()),
            ...reservations.map((r) => r.inventoryItemId?.toString()),
          ].filter(Boolean),
        ),
      ];
      if (invItemIds.length > 0) {
        await this.inventoryItemModel.updateMany(
          { _id: { $in: invItemIds.map((id) => new Types.ObjectId(id)) } },
          { $set: { status: InventoryItemStatus.Rented } },
          session ? { session } : undefined,
        );
      }

      if (session) {
        await session.commitTransaction();
      }
    } catch (txErr) {
      if (session) {
        await session.abortTransaction();
      }
      throw txErr;
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    await this.notifyRentalPriceMilestones(rentalItems);

    try {
      const recipientIds = await this.getBookingStakeholderUserIds(booking);
      this.notificationsService.emitBookingUpdate(
        {
          bookingId: booking._id.toString(),
          bookingCode: booking.bookingCode,
          status: BookingStatus.PickedUp,
          deliveredPhotos: (booking as any).deliveredPhotos ?? [],
        },
        recipientIds,
      );
    } catch (e) {
      console.warn(
        'Failed to emit booking_updated in customerConfirmPickup:',
        e,
      );
    }

    return { success: true, booking };
  }

  async customerReportDamage(
    bookingId: string,
    customerId: string,
    description: string,
    evidencePhotos: string[],
  ): Promise<any> {
    if (!evidencePhotos || evidencePhotos.length === 0) {
      throw new BadRequestException(
        'Báo cáo lỗi bắt buộc phải có ít nhất 1 hình ảnh làm bằng chứng.',
      );
    }
    if (!description || !description.trim()) {
      throw new BadRequestException(
        'Báo cáo lỗi bắt buộc phải có mô tả chi tiết.',
      );
    }

    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }
    if (this.getCustomerIdStr(booking) !== customerId) {
      throw new ForbiddenException(
        'Bạn không có quyền báo cáo lỗi cho đơn này',
      );
    }
    if (booking.status === BookingStatus.PickedUp) {
      throw new BadRequestException('Đơn hàng đã được nhận trước đó');
    }
    if (booking.status !== BookingStatus.PickupPending) {
      throw new BadRequestException('Đơn hàng không ở trạng thái chờ nhận đồ');
    }

    if (booking.handoverInitiatedAt) {
      const diffMs =
        Date.now() - new Date(booking.handoverInitiatedAt).getTime();
      if (diffMs > 30 * 60 * 1000) {
        throw new BadRequestException(
          'Đã quá thời gian 30 phút báo cáo lỗi tại quầy',
        );
      }
    }

    const items = await this.bookingItemModel.find({ bookingId: booking._id });
    const startDates: Date[] = [];
    if ((booking as any).rentalFrom)
      startDates.push(new Date((booking as any).rentalFrom));
    for (const it of items) {
      const rFrom =
        it.rentalFrom ||
        (it as any).rentalFulfillment?.rentalFrom ||
        (it as any).bookingDate;
      if (rFrom) startDates.push(new Date(rFrom));
      if (it.shootDate) {
        const d = new Date(it.shootDate);
        if (it.shootTimeSlot) {
          const startH = parseInt(it.shootTimeSlot.split('-')[0] || '0', 10);
          d.setHours(startH, 0, 0, 0);
        }
        startDates.push(d);
      }
    }
    const validStarts = startDates.filter((d) => !isNaN(d.getTime()));
    if (validStarts.length > 0) {
      const earliestStart = new Date(
        Math.min(...validStarts.map((d) => d.getTime())),
      );
      if (
        !this.allowEarlyRentalPickup() &&
        Date.now() < earliestStart.getTime() - 60 * 60 * 1000
      ) {
        throw new BadRequestException(
          'Chưa đến khung giờ nhận đồ theo lịch hẹn. Bạn chỉ có thể xác nhận khi đến giờ nhận áo.',
        );
      }
    }

    let session: ClientSession | null = null;
    if (typeof this.bookingModel.db?.startSession === 'function') {
      try {
        session = await this.bookingModel.db.startSession();
        session.startTransaction();
      } catch {
        session = null;
      }
    }

    try {
      booking.status = BookingStatus.PickedUp;
      booking.pickupDamageReport = {
        reportedAt: new Date(),
        description: description.trim(),
        evidencePhotos,
      };

      booking.statusTimeline.push({
        status: BookingStatus.PickedUp,
        changedAt: new Date(),
        note: `Khách hàng nhận đồ và báo cáo lỗi: ${description.trim()}`,
      });

      await booking.save(session ? { session } : undefined);

      await this.bookingItemModel.updateMany(
        {
          bookingId: booking._id,
          itemType: BookingItemType.Product,
        },
        {
          $set: {
            'rentalFulfillment.status': RentalFulfillmentStatus.PickedUp,
            'rentalFulfillment.inventoryStatus':
              RentalInventoryStatus.RentedOut,
            'rentalFulfillment.pickedUpAt': new Date(),
          },
        },
        session ? { session } : undefined,
      );

      const reservations = this.inventoryReservationModel
        ? await this.inventoryReservationModel.find(
            { bookingId: booking._id },
            null,
            session ? { session } : undefined,
          )
        : [];
      const invItemIds = [
        ...new Set(
          [
            ...items.map((it) => it.inventoryItemId?.toString()),
            ...reservations.map((r) => r.inventoryItemId?.toString()),
          ].filter(Boolean),
        ),
      ];
      if (invItemIds.length > 0) {
        await this.inventoryItemModel.updateMany(
          { _id: { $in: invItemIds.map((id) => new Types.ObjectId(id)) } },
          { $set: { status: InventoryItemStatus.Rented } },
          session ? { session } : undefined,
        );
      }

      if (session) {
        await session.commitTransaction();
      }
    } catch (txErr) {
      if (session) {
        await session.abortTransaction();
      }
      throw txErr;
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    await this.notifyRentalPriceMilestones(
      items.filter((item) => item.itemType === BookingItemType.Product),
    );

    // Notify provider of damage report
    try {
      for (const pId of booking.providerIds) {
        const provider = await this.providerModel.findById(pId);
        if (provider && provider.userId) {
          await this.notificationsService.createNotification(
            provider.userId.toString(),
            'Khách hàng báo lỗi trang phục',
            `Khách hàng đã báo cáo lỗi nhẹ khi nhận trang phục cho đơn hàng ${booking.bookingCode}. Vui lòng đối soát.`,
            NotificationType.Booking,
            { bookingId: booking._id },
          );
        }
      }
    } catch (e) {
      console.error('Failed to notify provider of damage report:', e);
    }

    try {
      const recipientIds = await this.getBookingStakeholderUserIds(booking);
      this.notificationsService.emitBookingUpdate(
        {
          bookingId: booking._id.toString(),
          bookingCode: booking.bookingCode,
          status: BookingStatus.PickedUp,
          deliveredPhotos: (booking as any).deliveredPhotos ?? [],
        },
        recipientIds,
      );
    } catch (e) {
      console.warn(
        'Failed to emit booking_updated in customerReportDamage:',
        e,
      );
    }

    return { success: true, booking };
  }

  async customerRejectHandover(
    bookingId: string,
    customerId: string,
    reason: string,
    evidencePhotos: string[],
  ): Promise<any> {
    if (!evidencePhotos || evidencePhotos.length === 0) {
      throw new BadRequestException(
        'Từ chối nhận đồ bắt buộc phải có ít nhất 1 hình ảnh làm bằng chứng.',
      );
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException(
        'Từ chối nhận đồ bắt buộc phải có lý do chi tiết.',
      );
    }

    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch');
    }
    if (this.getCustomerIdStr(booking) !== customerId) {
      throw new ForbiddenException('Bạn không có quyền từ chối đơn này');
    }
    if (booking.status !== BookingStatus.PickupPending) {
      throw new BadRequestException('Đơn hàng không ở trạng thái chờ nhận đồ');
    }

    if (booking.handoverInitiatedAt) {
      const diffMs =
        Date.now() - new Date(booking.handoverInitiatedAt).getTime();
      if (diffMs > 30 * 60 * 1000) {
        throw new BadRequestException(
          'Đã quá thời gian 30 phút từ chối nhận đồ',
        );
      }
    }

    let session: ClientSession | null = null;
    if (typeof this.bookingModel.db?.startSession === 'function') {
      try {
        session = await this.bookingModel.db.startSession();
        session.startTransaction();
      } catch {
        session = null;
      }
    }

    try {
      const items = await this.bookingItemModel.find(
        { bookingId: booking._id },
        null,
        session ? { session } : undefined,
      );

      const reservations = this.inventoryReservationModel
        ? await this.inventoryReservationModel.find(
            { bookingId: booking._id },
            null,
            session ? { session } : undefined,
          )
        : [];

      // Lock inventory theo CẢ:
      // a) item.inventoryItemId
      // b) InventoryReservation.inventoryItemId của booking/item
      // Dedupe inventory ids.
      const invItemIds = [
        ...new Set(
          [
            ...items.map((it) => it.inventoryItemId?.toString()),
            ...reservations.map((r) => r.inventoryItemId?.toString()),
          ].filter(Boolean),
        ),
      ];

      const maintenanceUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const notes = `LOCKED_UNTIL_${maintenanceUntil.toISOString()}: Khách từ chối nhận do lỗi nặng: ${reason.trim()}`;

      if (invItemIds.length > 0) {
        await this.inventoryItemModel.updateMany(
          { _id: { $in: invItemIds.map((id) => new Types.ObjectId(id)) } },
          {
            $set: {
              conditionStatus: 'LOCKED',
              notes,
            },
          },
          session ? { session } : undefined,
        );
      }

      await this.bookingItemModel.updateMany(
        {
          bookingId: booking._id,
          itemType: BookingItemType.Product,
        },
        {
          $set: {
            'rentalFulfillment.status': RentalFulfillmentStatus.Cancelled,
            'rentalFulfillment.inventoryStatus':
              RentalInventoryStatus.Maintenance,
            'rentalFulfillment.issueStatus': RentalIssueStatus.Reported,
          },
        },
        session ? { session } : undefined,
      );

      // 2. Chuyển trạng thái đơn hàng sang DISPUTED (Tranh chấp)
      booking.status = BookingStatus.Disputed;
      booking.statusTimeline.push({
        status: BookingStatus.Disputed,
        changedAt: new Date(),
        note: `Khách hàng từ chối nhận đồ do lỗi nặng tại quầy: ${reason.trim()}`,
      });
      await booking.save(session ? { session } : undefined);

      // 3. Đóng băng các khoản quyết toán (Hold settlements)
      await this.settlementsService.holdSettlementsForBooking(
        booking._id.toString(),
        `Booking is under dispute (Customer reject handover)`,
        customerId,
        session || undefined,
      );

      // 4. Tạo Dispute Record cho Admin xử lý
      const disputeModel = this.bookingModel.db.model('Dispute');
      const firstItem =
        items.find((it) => it.itemType === BookingItemType.Product) || items[0];
      await disputeModel.findOneAndUpdate(
        { bookingId: booking._id },
        {
          $setOnInsert: {
            bookingId: booking._id,
            bookingItemId: firstItem?._id,
            openedBy: new Types.ObjectId(customerId),
            againstProviderId: booking.providerIds[0],
            reason: `Khách hàng từ chối nhận đồ do lỗi nặng tại quầy: ${reason}`,
            evidencePhotos: evidencePhotos,
            status: 'OPEN',
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          session: session || undefined,
        },
      );

      if (session) {
        await session.commitTransaction();
      }

      // 5. Gửi thông báo cho Shop đối tác
      for (const pId of booking.providerIds) {
        const provider = await this.providerModel.findById(pId);
        if (provider && provider.userId) {
          await this.notificationsService.createNotification(
            provider.userId.toString(),
            'Khách từ chối nhận đồ',
            `Khách hàng đã từ chối nhận trang phục cho đơn hàng ${booking.bookingCode} do lỗi nặng tại quầy: ${reason}. Đơn hàng đã được chuyển sang trạng thái tranh chấp cho Admin xử lý.`,
            NotificationType.Booking,
            { bookingId: booking._id },
          );
        }
      }

      return { success: true, booking };
    } catch (err: any) {
      if (session) {
        await session.abortTransaction();
      }
      console.error('Failed to process customer reject handover dispute:', err);
      if (
        err instanceof BadRequestException ||
        err instanceof ForbiddenException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new InternalServerErrorException(
        err.message || 'Lỗi xảy ra khi xử lý khiếu nại từ chối nhận đồ',
      );
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  async customerReturn(
    bookingIdStr: string,
    userId: string,
    roles?: string[],
    note?: string,
    evidencePhotos?: string[],
    bookingItemId?: string,
  ): Promise<BookingDocument> {
    const booking = await this.bookingModel.findById(bookingIdStr);
    if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng');

    const isAdmin = roles?.includes('ADMIN') || roles?.includes('admin');
    const isCustomer = userId && this.getCustomerIdStr(booking) === userId;

    if (!isAdmin && !isCustomer) {
      throw new ForbiddenException(
        'Chỉ khách hàng của đơn hoặc Admin mới có quyền xác nhận trả áo.',
      );
    }

    if (
      booking.status !== BookingStatus.PickedUp &&
      booking.status !== BookingStatus.InProgress &&
      booking.status !== BookingStatus.ReturnPending &&
      booking.status !== BookingStatus.ComboPhotosApproved &&
      booking.status !== BookingStatus.Overdue
    ) {
      throw new BadRequestException(
        `Không thể yêu cầu trả áo khi đơn hàng đang ở trạng thái ${booking.status}. Đơn hàng phải đang ở trạng thái Đang thuê (PICKED_UP) hoặc Đã duyệt ảnh (COMBO_PHOTOS_APPROVED).`,
      );
    }

    if (
      !evidencePhotos ||
      !Array.isArray(evidencePhotos) ||
      evidencePhotos.filter(Boolean).length === 0
    ) {
      throw new BadRequestException(
        'Bắt buộc tải lên ít nhất một ảnh bằng chứng tình trạng áo khi trả.',
      );
    }

    // 1. Tìm các rental items của booking
    const items = await this.bookingItemModel
      .find({
        bookingId: booking._id,
        $or: [
          { itemType: BookingItemType.Product },
          { productId: { $exists: true, $ne: null } },
          { 'rentalFulfillment.status': { $exists: true } },
        ],
      })
      .exec();

    if (!items.length) {
      throw new NotFoundException(
        'Không tìm thấy sản phẩm áo dài thuê trong đơn hàng này.',
      );
    }

    const targetItems: any[] = [];
    if (bookingItemId) {
      const found =
        items.find((i) => i._id.toString() === bookingItemId) || null;
      if (!found) {
        throw new NotFoundException(
          `Không tìm thấy sản phẩm ${bookingItemId} trong đơn hàng.`,
        );
      }
      targetItems.push(found);
    } else {
      const pickedUpItems = items.filter(
        (i) => i.rentalFulfillment?.status === RentalFulfillmentStatus.PickedUp,
      );
      if (pickedUpItems.length > 0) {
        targetItems.push(...pickedUpItems);
      } else {
        const returnRequestedItems = items.filter(
          (i) =>
            i.rentalFulfillment?.status ===
            RentalFulfillmentStatus.CustomerReturnRequested,
        );
        if (returnRequestedItems.length > 0) {
          throw new ConflictException(
            'Trang phục trong đơn đã được gửi yêu cầu trả trước đó, đang chờ Shop nhận lại.',
          );
        }
        throw new BadRequestException(
          'Không có trang phục nào đang ở trạng thái Đang thuê (PICKED_UP) để trả.',
        );
      }
    }

    const returnEvData = {
      files: evidencePhotos,
      returnedAt: new Date(),
      note: note?.trim() || null,
    };

    // 2. Cập nhật các items hợp lệ
    for (const tItem of targetItems) {
      const currentItemStatus = tItem.rentalFulfillment?.status;
      if (currentItemStatus !== RentalFulfillmentStatus.PickedUp) {
        continue;
      }

      await this.bookingItemModel.updateOne(
        { _id: tItem._id },
        {
          $set: {
            'rentalFulfillment.status':
              RentalFulfillmentStatus.CustomerReturnRequested,
            'rentalFulfillment.customerReturnEvidence': returnEvData,
            'rentalFulfillment.inventoryStatus':
              RentalInventoryStatus.ReturnedPendingInspection,
          },
          $push: {
            'rentalFulfillment.history': {
              action: 'CUSTOMER_RETURN_REQUESTED',
              fromStatus: RentalFulfillmentStatus.PickedUp,
              toStatus: RentalFulfillmentStatus.CustomerReturnRequested,
              actor: { id: userId, role: isAdmin ? 'ADMIN' : 'CUSTOMER' },
              occurredAt: new Date(),
              note:
                note?.trim() ||
                'Khách hàng gửi yêu cầu trả áo kèm ảnh đối soát',
            },
          },
        },
      );
    }

    // 3. Cập nhật booking status sang RETURN_PENDING nếu chưa ở RETURN_PENDING
    (booking as any).customerReturnEvidence = returnEvData;
    if (booking.status !== BookingStatus.ReturnPending) {
      booking.status = BookingStatus.ReturnPending;
      booking.statusTimeline.push({
        status: BookingStatus.ReturnPending,
        changedAt: new Date(),
        changedBy: new Types.ObjectId(userId),
        note:
          note?.trim() || 'Khách hàng xác nhận đã mang áo đến trả tại cửa hàng',
      });
    }
    await booking.save();

    // 5. Emit socket update
    const recipientUserIds = await this.getBookingStakeholderUserIds(booking);
    this.notificationsService?.emitBookingUpdate(
      {
        bookingId: booking._id.toString(),
        bookingCode: booking.bookingCode,
        status: booking.status,
      },
      recipientUserIds,
    );

    return booking;
  }

  private getCustomerIdStr(booking: any): string {
    if (!booking?.customerId) return '';
    return (booking.customerId._id || booking.customerId).toString();
  }

  async getBookingStakeholderUserIds(booking: any): Promise<string[]> {
    const userIds: string[] = [];
    const customerIdStr = this.getCustomerIdStr(booking);
    if (customerIdStr) userIds.push(customerIdStr);

    const providerDocIds = new Set<string>();
    if (Array.isArray(booking?.providerIds)) {
      booking.providerIds.forEach((pid: any) =>
        providerDocIds.add((pid?._id || pid).toString()),
      );
    }
    if (Array.isArray(booking?.items)) {
      booking.items.forEach((it: any) => {
        if (it?.providerId)
          providerDocIds.add((it.providerId?._id || it.providerId).toString());
      });
    }

    if (providerDocIds.size > 0) {
      try {
        const providers = await this.providerModel
          .find({
            _id: {
              $in: Array.from(providerDocIds).map(
                (id) => new Types.ObjectId(id),
              ),
            },
          })
          .select({ userId: 1 })
          .lean()
          .exec();
        providers.forEach((p) => {
          if (p.userId) userIds.push(p.userId.toString());
        });
      } catch (err) {
        console.warn('Failed to resolve provider user IDs for booking:', err);
      }
    }

    return [...new Set(userIds.filter(Boolean))];
  }
}
