import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  Booking,
  BookingStatus,
  BookingType,
  PaymentStatus as BookingPaymentStatus,
} from '../schemas/booking.schema';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import { createRentalFulfillment } from '../schemas/rental-fulfillment.types';
import {
  BookingSchedule,
  BookingScheduleStatus,
  BookingScheduleType,
} from '../schemas/booking-schedule.schema';
import { ProviderScheduleLock } from '../schemas/provider-schedule-lock.schema';
import { CreatePhotographyHoldDto } from '../dto/create-photography-hold.dto';
import {
  PackageStatus,
  PhotographyPackage,
} from '../../products/schemas/photography-package.schema';
import { Product, ProductStatus } from '../../products/schemas/product.schema';
import { ComboPromotionStatus } from '../../products/schemas/combo-promotion.schema';
import { Provider } from '../../providers/schemas/provider.schema';
import {
  ConditionStatus,
  InventoryItem,
  InventoryItemStatus,
} from '../../products/schemas/inventory-item.schema';
import {
  InventoryReservation,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import {
  PriceTargetType,
  PriceVersion,
} from '../../products/schemas/price-version.schema';
import {
  calculatePhotographyQuote,
  PhotographyPricingPolicyError,
} from '../../photographers/services/photography-quote.pricing';
import { PhotographyQuoteService } from '../../photographers/services/photography-quote.service';
import {
  ComboAoDaiHoldItemDto,
  CreatePhotographyComboHoldDto,
} from '../dto/create-photography-combo-hold.dto';

const HOLD_DURATION_MS = 10 * 60 * 1000;
const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const MAX_TRANSACTION_RETRIES = 3;

type HoldSession = {
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  providerLocalDate: string;
  durationMinutes: number;
  locationAddress?: string;
  locationLatitude?: number;
  locationLongitude?: number;
};

type LockKey = { providerId: Types.ObjectId; providerLocalDate: string };

type PhotographyPackageWithId = PhotographyPackage & { _id: Types.ObjectId };

type ComboAoDaiReservation = {
  product: Product & { _id: Types.ObjectId };
  inventoryItemIds: Types.ObjectId[];
  rentalFrom: Date;
  rentalTo: Date;
  quantity: number;
  unitPrice: number;
  depositAmount: number;
  selectedSize: string;
  selectedColor: string;
  pickupReturnLocationSnapshot: {
    address: string;
    ward?: string | null;
    district?: string | null;
    city?: string | null;
    geo: { type: 'Point'; coordinates: [number, number] } | null;
  };
};

@Injectable()
export class PhotographyHoldService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingSchedule>,
    @InjectModel(ProviderScheduleLock.name)
    private readonly scheduleLockModel: Model<ProviderScheduleLock>,
    @InjectModel(PhotographyPackage.name)
    private readonly packageModel: Model<PhotographyPackage>,
    @InjectModel(PriceVersion.name)
    private readonly priceVersionModel: Model<PriceVersion>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryItemModel: Model<InventoryItem>,
    @InjectModel(InventoryReservation.name)
    private readonly inventoryReservationModel: Model<InventoryReservation>,
    @Inject(forwardRef(() => PhotographyQuoteService))
    private readonly quoteService: PhotographyQuoteService,
  ) { }

  async createHold(
    customerIdValue: string,
    dto: CreatePhotographyHoldDto,
    idempotencyKey: string,
  ) {
    if (!Types.ObjectId.isValid(customerIdValue)) {
      throw new BadRequestException(
        'TÃ i khoáº£n Ä‘áº·t lá»‹ch khÃ´ng há»£p lá»‡.',
      );
    }
    if (!Types.ObjectId.isValid(dto.packageId)) {
      throw new BadRequestException('GÃ³i chá»¥p khÃ´ng há»£p lá»‡.');
    }
    if (idempotencyKey.length > 160) {
      throw new BadRequestException('Idempotency-Key tá»‘i Ä‘a 160 kÃ½ tá»±.');
    }

    const customerId = new Types.ObjectId(customerIdValue);
    const existing = await this.bookingModel
      .findOne({ customerId, holdIdempotencyKey: idempotencyKey })
      .exec();
    if (existing) return this.toHoldResponse(existing);

    const packagePreview = await this.packageModel.findOne({
      _id: new Types.ObjectId(dto.packageId),
      status: PackageStatus.Active,
    });
    if (!packagePreview) {
      throw new NotFoundException(
        'KhÃ´ng tÃ¬m tháº¥y gÃ³i chá»¥p Ä‘ang hoáº¡t Ä‘á»™ng.',
      );
    }

    // The preflight checks working hours, blocked days and existing legacy data.
    // The transaction below repeats the security-critical overlap check after lock.
    const preflight = await this.quoteService.quote(
      packagePreview.providerId.toString(),
      dto,
    );
    if (!preflight.valid) {
      throw new BadRequestException({
        message: 'Má»™t hoáº·c nhiá»u buá»•i chá»¥p khÃ´ng thá»ƒ giá»¯ lá»‹ch.',
        errors: preflight.errors,
      });
    }

    const sessions = this.toHoldSessions(dto);
    return this.withTransactionRetry((session) =>
      this.createHoldInTransaction(
        customerId,
        dto,
        idempotencyKey,
        sessions,
        session,
      ),
    );
  }

  /**
   * Creates one atomic hold for the photoshoot and every selected Ao Dai item.
   * No reservation is persisted unless every resource can be held.
   */
  async createComboHold(
    customerIdValue: string,
    dto: CreatePhotographyComboHoldDto,
    idempotencyKey: string,
  ) {
    if (!Types.ObjectId.isValid(customerIdValue)) {
      throw new BadRequestException(
        'TÃ i khoáº£n Ä‘áº·t lá»‹ch khÃ´ng há»£p lá»‡.',
      );
    }
    if (!Types.ObjectId.isValid(dto.packageId)) {
      throw new BadRequestException('GÃ³i chá»¥p khÃ´ng há»£p lá»‡.');
    }
    if (idempotencyKey.length > 160) {
      throw new BadRequestException('Idempotency-Key tá»‘i Ä‘a 160 kÃ½ tá»±.');
    }

    const customerId = new Types.ObjectId(customerIdValue);
    const existing = await this.bookingModel
      .findOne({ customerId, holdIdempotencyKey: idempotencyKey })
      .exec();
    if (existing) return this.toComboHoldResponse(existing);

    const packagePreview = await this.packageModel.findOne({
      _id: new Types.ObjectId(dto.packageId),
      status: PackageStatus.Active,
    });
    if (!packagePreview) {
      throw new NotFoundException(
        'KhÃ´ng tÃ¬m tháº¥y gÃ³i chá»¥p Ä‘ang hoáº¡t Ä‘á»™ng.',
      );
    }

    const preflight = await this.quoteService.quote(
      packagePreview.providerId.toString(),
      dto,
    );
    if (!preflight.valid) {
      throw new BadRequestException({
        message: 'Má»™t hoáº·c nhiá»u buá»•i chá»¥p khÃ´ng thá»ƒ giá»¯ lá»‹ch.',
        errors: preflight.errors,
      });
    }

    const sessions = this.toHoldSessions(dto);
    return this.withTransactionRetry((session) =>
      this.createComboHoldInTransaction(
        customerId,
        dto,
        idempotencyKey,
        sessions,
        session,
      ),
    );
  }

  private async createComboHoldInTransaction(
    customerId: Types.ObjectId,
    dto: CreatePhotographyComboHoldDto,
    idempotencyKey: string,
    sessions: HoldSession[],
    session: ClientSession,
  ) {
    const existing = await this.bookingModel
      .findOne({ customerId, holdIdempotencyKey: idempotencyKey })
      .session(session)
      .exec();
    if (existing) return this.toComboHoldResponse(existing, session);

    const photographyPackage = await this.packageModel
      .findOne({
        _id: new Types.ObjectId(dto.packageId),
        status: PackageStatus.Active,
      })
      .session(session)
      .exec();
    if (!photographyPackage) {
      throw new NotFoundException('GÃ³i chá»¥p khÃ´ng cÃ²n hoáº¡t Ä‘á»™ng.');
    }

    await this.assertProviderServiceRadius(
      photographyPackage.providerId,
      sessions,
      session,
    );

    await this.acquireLocks(
      sessions.map((item) => ({
        providerId: photographyPackage.providerId,
        providerLocalDate: item.providerLocalDate,
      })),
      session,
    );
    await this.assertNoActiveOverlap(
      photographyPackage.providerId,
      sessions,
      session,
    );

    const quote = this.calculateQuote(photographyPackage, sessions);
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);
    const aodaiReservations: ComboAoDaiReservation[] = [];
    for (const item of dto.aodaiItems) {
      aodaiReservations.push(
        await this.reserveComboAoDaiItem(
          item,
          sessions,
          holdExpiresAt,
          session,
        ),
      );
    }

    const comboPromotionModel = this.bookingModel.db.model('ComboPromotion');
    const firstProductRes = aodaiReservations[0];
    const comboPromo = dto.comboPromotionId
      ? await comboPromotionModel.findById(dto.comboPromotionId).session(session).exec()
      : firstProductRes?.product?._id
        ? await comboPromotionModel.findOne({
          providerId: photographyPackage.providerId,
          productId: firstProductRes.product._id,
          photographyPackageId: photographyPackage._id,
          status: ComboPromotionStatus.Active,
        }).session(session).exec()
        : null;

    if (!comboPromo) {
      throw new BadRequestException('Không tìm thấy Combo Photo hợp lệ cho gói và áo dài đã chọn.');
    }
    const now = new Date();
    if (comboPromo.status !== ComboPromotionStatus.Active
      || (comboPromo.validFrom && comboPromo.validFrom > now)
      || (comboPromo.validTo && comboPromo.validTo < now)) {
      throw new BadRequestException('Combo Photo đã hết hạn hoặc chưa được kích hoạt.');
    }
    if (comboPromo.usedCount >= comboPromo.maxUsage) {
      throw new BadRequestException('Combo này đã hết lượt sử dụng.');
    }
    if (comboPromo.providerId.toString() !== photographyPackage.providerId.toString()) {
      throw new BadRequestException('Combo Photo không thuộc cùng provider với gói chụp.');
    }
    if (comboPromo.photographyPackageId.toString() !== photographyPackage._id.toString()) {
      throw new BadRequestException('Combo không áp dụng cho gói chụp đã chọn.');
    }
    const totalAoDaiQuantity = aodaiReservations.reduce((sum, item) => sum + item.quantity, 0);
    for (const reservation of aodaiReservations) {
      if (reservation.product._id.toString() !== comboPromo.productId.toString()) {
        throw new BadRequestException('Combo không áp dụng cho áo dài đã chọn.');
      }
      if (reservation.product.providerId.toString() !== comboPromo.providerId.toString()) {
        throw new BadRequestException('Áo dài và Combo không thuộc cùng provider.');
      }
    }
    if (totalAoDaiQuantity !== comboPromo.aoDaiQuantity) {
      throw new BadRequestException(`Combo yêu cầu ${comboPromo.aoDaiQuantity} bộ áo dài.`);
    }

    // The promotion record is the pricing authority. Never trust a discount
    // percentage supplied by the browser and never fall back to an arbitrary
    // discount when no valid promotion exists.
    const discountPct = comboPromo.discountPercent;

    const photoDeposit = quote.totalAmount; // 100% thanh toán trước cho thợ chụp
    const photoDiscount = Math.round(quote.totalAmount * (discountPct / 100));
    const productRentalTotal = aodaiReservations.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const productDepositTotal = aodaiReservations.reduce(
      (sum, item) => sum + item.depositAmount * item.quantity,
      0,
    );
    const productDiscountTotal = aodaiReservations.reduce(
      (sum, item) => sum + Math.round(item.unitPrice * item.quantity * (discountPct / 100)),
      0,
    );
    const comboDiscountTotal = photoDiscount + productDiscountTotal;
    const subTotal = quote.totalAmount + productRentalTotal;
    const grandTotal = subTotal - comboDiscountTotal + productDepositTotal;
    const providerIds = [
      photographyPackage.providerId,
      ...aodaiReservations.map((item) => item.product.providerId),
    ].filter(
      (id, index, ids) =>
        ids.findIndex((candidate) => candidate.toString() === id.toString()) ===
        index,
    );

    const booking = new this.bookingModel({
      bookingCode: this.createBookingCode(),
      customerId,
      providerIds,
      bookingType: BookingType.Combo,
      status: BookingStatus.PendingPayment,
      holdIdempotencyKey: idempotencyKey,
      holdExpiresAt,
      comboPromotionId: comboPromo ? comboPromo._id : undefined,
      pricingSummary: {
        subTotal,
        depositTotal: productDepositTotal,
        discountAmount: comboDiscountTotal,
        comboDiscountTotal,
        voucherDiscountTotal: 0,
        travelFee: 0,
        overtimeFee: quote.overtimeAmount,
        lateFee: 0,
        damageFee: 0,
        grandTotal,
      },
      paymentSummary: {
        totalPaid: 0,
        totalRefunded: 0,
        paymentStatus: BookingPaymentStatus.Unpaid,
      },
      statusTimeline: [
        {
          status: BookingStatus.PendingPayment,
          changedAt: new Date(),
          note: 'Đã giữ lịch chụp và áo dài, chờ thanh toán.',
        },
      ],
    });
    await booking.save({ session });

    const photographyPriceVersion = await this.findOrCreatePriceVersion(
      photographyPackage,
      quote.totalAmount,
      session,
    );
    const firstSession = sessions[0];
    const photographyItem = new this.bookingItemModel({
      bookingId: booking._id,
      providerId: photographyPackage.providerId,
      itemType: BookingItemType.PhotographyPackage,
      photographyPackageId: photographyPackage._id,
      priceVersionId: photographyPriceVersion._id,
      unitPrice: quote.totalAmount,
      depositAmount: photoDeposit,
      quantity: 1,
      shootDate: null,
      shootTimeSlot: null,
      shootLocation: firstSession.locationAddress ?? null,
      shootLocationSnapshot: this.toLocationSnapshot(firstSession),
      shootConcept: dto.concept ?? null,
      referenceImage: dto.referenceImage ?? null,
      rentalType: 'DAILY',
      customRequests: dto.customRequests ?? null,
      packageSnapshot: {
        name: photographyPackage.name,
        basePrice: photographyPackage.price,
        pricingUnit: photographyPackage.pricingUnit ?? 'PER_SESSION',
        includedDurationMinutes:
          photographyPackage.includedDurationMinutes ??
          Math.round(photographyPackage.durationHours * 60),
        includedSessionCount: photographyPackage.includedSessionCount,
        includedDayCount: photographyPackage.includedDayCount,
        overtimeFeePerHour: photographyPackage.overtimeFeePerHour ?? 0,
        overtimeIncrementMinutes:
          photographyPackage.overtimeIncrementMinutes ?? 30,
        maxOvertimeMinutes: photographyPackage.maxOvertimeMinutes ?? 240,
      },
      priceBreakdown: quote.breakdown,
      scheduleSchemaVersion: 2,
      comboDiscountPercent: discountPct,
      comboDiscountAmount: photoDiscount,
    });
    await photographyItem.save({ session });

    await this.bookingScheduleModel.insertMany(
      sessions.map((item) => ({
        bookingId: booking._id,
        bookingItemId: photographyItem._id,
        providerId: photographyPackage.providerId,
        scheduleType: BookingScheduleType.Photoshoot,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        providerLocalDate: item.providerLocalDate,
        holdExpiresAt,
        locationAddress: item.locationAddress ?? null,
        locationSnapshot: this.toLocationSnapshot(item),
        includedDurationMinutes:
          photographyPackage.includedDurationMinutes ??
          Math.round(photographyPackage.durationHours * 60),
        overtimeMinutes: quote.overtimeMinutesByClientId[item.clientId] ?? 0,
        scheduleSchemaVersion: 2,
        status: BookingScheduleStatus.Held,
      })),
      { session },
    );

    for (const reservation of aodaiReservations) {
      if (reservation.inventoryItemIds.length !== reservation.quantity) {
        throw new ConflictException(
          'Số đơn vị tồn kho được giữ không khớp số lượng áo dài yêu cầu.',
        );
      }
      const productPriceVersion = await this.findOrCreateProductPriceVersion(
        reservation.product,
        session,
      );
      const totalDiscount = Math.round(
        reservation.unitPrice * reservation.quantity * (discountPct / 100),
      );
      let distributedDiscount = 0;
      for (const [
        index,
        inventoryItemId,
      ] of reservation.inventoryItemIds.entries()) {
        const itemDiscount =
          index === reservation.inventoryItemIds.length - 1
            ? totalDiscount - distributedDiscount
            : Math.round(totalDiscount / reservation.quantity);
        distributedDiscount += itemDiscount;
        const bookingItem = new this.bookingItemModel({
          bookingId: booking._id,
          providerId: reservation.product.providerId,
          itemType: BookingItemType.Product,
          productId: reservation.product._id,
          inventoryItemId,
          priceVersionId: productPriceVersion._id,
          unitPrice: reservation.unitPrice,
          depositAmount: reservation.depositAmount,
          quantity: 1,
          rentalFrom: reservation.rentalFrom,
          rentalTo: reservation.rentalTo,
          rentalType: 'DAILY',
          selectedSize: reservation.selectedSize,
          selectedColor: reservation.selectedColor,
          pickupReturnLocationSnapshot:
            reservation.pickupReturnLocationSnapshot,
          rentalFulfillment: createRentalFulfillment(
            reservation.rentalTo,
            reservation.rentalFrom,
          ),
          customRequests: null,
          priceBreakdown: [],
          comboDiscountPercent: discountPct,
          comboDiscountAmount: itemDiscount,
        });
        await bookingItem.save({ session });
        await this.inventoryReservationModel.create(
          [
            {
              inventoryItemId,
              bookingId: booking._id,
              bookingItemId: bookingItem._id,
              reservedFrom: reservation.rentalFrom,
              reservedTo: reservation.rentalTo,
              status: ReservationStatus.TempReserved,
              expiresAt: holdExpiresAt,
            },
          ],
          { session },
        );
      }
    }

    // Reserve a promotion usage atomically. Do not swallow a failed update:
    // otherwise the discounted booking would commit without consuming quota.
    const promotionReservation = await comboPromotionModel.updateOne(
      {
        _id: comboPromo._id,
        status: ComboPromotionStatus.Active,
        usedCount: { $lt: comboPromo.maxUsage },
      },
      { $inc: { usedCount: 1 } },
    ).session(session).exec();
    if (promotionReservation.modifiedCount !== 1) {
      throw new BadRequestException('Combo này đã hết lượt sử dụng.');
    }

    return this.toComboHoldResponse(booking, session);
  }

  private async reserveComboAoDaiItem(
    dto: ComboAoDaiHoldItemDto,
    sessions: HoldSession[],
    holdExpiresAt: Date,
    session: ClientSession,
  ): Promise<ComboAoDaiReservation> {
    if (!Types.ObjectId.isValid(dto.productId)) {
      throw new BadRequestException('Sáº£n pháº©m Ã¡o dÃ i khÃ´ng há»£p lá»‡.');
    }

    const product = await this.productModel
      .findOne({
        _id: new Types.ObjectId(dto.productId),
        status: ProductStatus.Active,
      })
      .session(session)
      .exec();
    if (!product) {
      throw new NotFoundException(
        'KhÃ´ng tÃ¬m tháº¥y Ã¡o dÃ i Ä‘ang hoáº¡t Ä‘á»™ng.',
      );
    }

    const provider = await this.providerModel
      .findById(product.providerId)
      .select('address rentalSettings')
      .session(session)
      .lean()
      .exec();
    const pickupReturnLocationSnapshot =
      this.toPickupReturnLocationSnapshot(provider);

    const selectedSize = dto.selectedSize.trim().toUpperCase();
    const selectedColor = this.normalizeInventoryColor(dto.selectedColor);
    if (
      product.sizes.length &&
      !product.sizes.some((size) => size.trim().toUpperCase() === selectedSize)
    ) {
      throw new BadRequestException(
        'KÃ­ch cá»¡ Ã¡o dÃ i Ä‘Ã£ chá»n khÃ´ng kháº£ dá»¥ng.',
      );
    }
    if (
      product.colors.length &&
      !product.colors.some(
        (color) => this.normalizeInventoryColor(color) === selectedColor,
      )
    ) {
      throw new BadRequestException(
        'MÃ u sáº¯c Ã¡o dÃ i Ä‘Ã£ chá»n khÃ´ng kháº£ dá»¥ng.',
      );
    }

    const { rentalFrom, rentalTo } = this.toRentalRange(
      dto.rentalFrom,
      dto.rentalTo,
    );
    if (rentalTo.getTime() < rentalFrom.getTime()) {
      throw new BadRequestException(
        'NgÃ y tráº£ Ã¡o dÃ i pháº£i sau hoáº·c báº±ng ngÃ y nháº­n.',
      );
    }
    const rentalDurationDays =
      Math.floor((rentalTo.getTime() - rentalFrom.getTime()) / 86_400_000) + 1;
    if (rentalDurationDays > 30) {
      throw new BadRequestException(
        'Thá»i gian thuÃª Ã¡o dÃ i tá»‘i Ä‘a lÃ  30 ngÃ y.',
      );
    }

    const rentalFromKey = this.toBusinessDateKey(rentalFrom);
    const rentalToKey = this.toBusinessDateKey(rentalTo);
    if (
      sessions.some(
        (item) =>
          item.providerLocalDate < rentalFromKey ||
          item.providerLocalDate > rentalToKey,
      )
    ) {
      throw new BadRequestException(
        'Má»i ngÃ y chá»¥p pháº£i náº±m trong khoáº£ng thá»i gian thuÃª Ã¡o dÃ i.',
      );
    }

    const quantity = dto.quantity ?? 1;
    const inventoryItems = await this.inventoryItemModel
      .find({
        productId: product._id,
        size: selectedSize,
        color: selectedColor,
        status: InventoryItemStatus.Available,
        conditionStatus: {
          $nin: [ConditionStatus.Locked, ConditionStatus.Retired],
        },
      })
      .sort({ _id: 1 })
      .session(session)
      .exec();
    if (!inventoryItems.length) {
      throw new ConflictException(
        'KhÃ´ng cÃ²n Ã¡o dÃ i phÃ¹ há»£p vá»›i kÃ­ch cá»¡ vÃ  mÃ u sáº¯c Ä‘Ã£ chá»n.',
      );
    }

    const activeReservations = await this.inventoryReservationModel
      .find({
        inventoryItemId: { $in: inventoryItems.map((item) => item._id) },
        $or: [
          { status: ReservationStatus.Confirmed },
          {
            status: ReservationStatus.TempReserved,
            expiresAt: { $gt: new Date() },
          },
        ],
        reservedFrom: { $lte: rentalTo },
        reservedTo: { $gte: rentalFrom },
      })
      .session(session)
      .exec();
    const busyIds = new Set(
      activeReservations.map((item) => item.inventoryItemId.toString()),
    );
    const selectedInventory = inventoryItems
      .filter((item) => !busyIds.has(item._id.toString()))
      .slice(0, quantity);
    if (selectedInventory.length < quantity) {
      throw new ConflictException(
        'Ão dÃ i Ä‘Ã£ háº¿t trong khoáº£ng thá»i gian thuÃª Ä‘Ã£ chá»n.',
      );
    }

    // This write is the transaction conflict boundary for one physical Ao Dai.
    // A competing request selecting the same item retries the whole transaction.
    for (const item of selectedInventory) {
      await this.inventoryItemModel
        .updateOne({ _id: item._id }, { $set: { updatedAt: new Date() } })
        .session(session)
        .exec();
    }

    const selectedIds = selectedInventory.map((item) => item._id);
    const conflictAfterLock = await this.inventoryReservationModel
      .exists({
        inventoryItemId: { $in: selectedIds },
        $or: [
          { status: ReservationStatus.Confirmed },
          {
            status: ReservationStatus.TempReserved,
            expiresAt: { $gt: new Date() },
          },
        ],
        reservedFrom: { $lte: rentalTo },
        reservedTo: { $gte: rentalFrom },
      })
      .session(session);
    if (conflictAfterLock) {
      throw new ConflictException(
        'Ão dÃ i vá»«a Ä‘Æ°á»£c khÃ¡ch khÃ¡c giá»¯. Vui lÃ²ng chá»n sáº£n pháº©m hoáº·c thá»i gian khÃ¡c.',
      );
    }

    return {
      product: product as Product & { _id: Types.ObjectId },
      inventoryItemIds: selectedIds,
      rentalFrom,
      rentalTo,
      quantity,
      unitPrice: product.basePrice * rentalDurationDays,
      depositAmount: product.depositAmount,
      selectedSize,
      selectedColor,
      pickupReturnLocationSnapshot,
    };
  }
  async confirmForBooking(
    bookingIdValue: Types.ObjectId | string,
    externalSession?: ClientSession,
  ): Promise<{
    hasPhotographyHold: boolean;
    confirmed: boolean;
    paymentReviewRequired: boolean;
  }> {
    const bookingId = this.toObjectId(
      bookingIdValue,
      'ÄÆ¡n Ä‘áº·t lá»‹ch khÃ´ng há»£p lá»‡.',
    );
    const confirm = async (session: ClientSession) => {
      const initialSchedules = await this.bookingScheduleModel
        .find({
          bookingId,
          scheduleType: BookingScheduleType.Photoshoot,
          status: {
            $in: [
              BookingScheduleStatus.Held,
              BookingScheduleStatus.Confirmed,
              BookingScheduleStatus.Expired,
            ],
          },
        })
        .session(session)
        .exec();

      if (!initialSchedules.length) {
        return {
          hasPhotographyHold: false,
          confirmed: true,
          paymentReviewRequired: false,
        };
      }

      const lockKeys = this.getLockKeys(initialSchedules);
      await this.acquireLocks(lockKeys, session);

      // Re-read after acquiring the deterministic provider/day locks. An expiry
      // job or another confirmation may have changed a schedule since the first
      // read, so the transition below must only operate on this fresh view.
      const schedules = await this.bookingScheduleModel
        .find({
          bookingId,
          scheduleType: BookingScheduleType.Photoshoot,
          status: {
            $in: [
              BookingScheduleStatus.Held,
              BookingScheduleStatus.Confirmed,
              BookingScheduleStatus.Expired,
            ],
          },
        })
        .session(session)
        .exec();

      if (!schedules.length) {
        await this.bookingModel.updateOne(
          { _id: bookingId },
          {
            $set: {
              holdExpiresAt: null,
              paymentReviewRequired: true,
              paymentReviewReason:
                'Lá»‹ch giá»¯ chá»— khÃ´ng cÃ²n hiá»‡u lá»±c khi thanh toÃ¡n Ä‘Æ°á»£c ghi nháº­n.',
            },
          },
          { session },
        );
        return {
          hasPhotographyHold: true,
          confirmed: false,
          paymentReviewRequired: true,
        };
      }

      const heldSchedules = schedules.filter(
        (schedule) => schedule.status === BookingScheduleStatus.Held,
      );
      const expiredSchedules = schedules.filter(
        (schedule) => schedule.status === BookingScheduleStatus.Expired,
      );
      const inventoryReservations = await this.inventoryReservationModel
        .find({
          bookingId,
          status: {
            $in: [ReservationStatus.TempReserved, ReservationStatus.Expired],
          },
        })
        .session(session)
        .exec();
      const heldInventoryReservations = inventoryReservations.filter(
        (reservation) => reservation.status === ReservationStatus.TempReserved,
      );
      const expiredInventoryReservations = inventoryReservations.filter(
        (reservation) => reservation.status === ReservationStatus.Expired,
      );
      const now = new Date();
      const hasExpiredHold = heldSchedules.some(
        (schedule) =>
          !schedule.holdExpiresAt ||
          schedule.holdExpiresAt.getTime() <= now.getTime(),
      );
      const hasExpiredInventoryHold = heldInventoryReservations.some(
        (reservation) =>
          !reservation.expiresAt ||
          reservation.expiresAt.getTime() <= now.getTime(),
      );
      if (
        expiredSchedules.length ||
        hasExpiredHold ||
        expiredInventoryReservations.length ||
        hasExpiredInventoryHold
      ) {
        if (heldSchedules.length) {
          await this.bookingScheduleModel.updateMany(
            {
              _id: { $in: heldSchedules.map((schedule) => schedule._id) },
              status: BookingScheduleStatus.Held,
            },
            {
              $set: { status: BookingScheduleStatus.Expired },
            },
            { session },
          );
        }
        if (heldInventoryReservations.length) {
          await this.inventoryReservationModel.updateMany(
            {
              _id: {
                $in: heldInventoryReservations.map(
                  (reservation) => reservation._id,
                ),
              },
              status: ReservationStatus.TempReserved,
            },
            {
              $set: { status: ReservationStatus.Expired },
              $unset: { expiresAt: 1 },
            },
            { session },
          );
        }
        await this.bookingModel.updateOne(
          { _id: bookingId },
          {
            $set: {
              holdExpiresAt: null,
              paymentReviewRequired: true,
              paymentReviewReason:
                'Thanh toÃ¡n Ä‘Æ°á»£c ghi nháº­n sau khi thá»i háº¡n giá»¯ lá»‹ch Ä‘Ã£ káº¿t thÃºc.',
            },
          },
          { session },
        );
        return {
          hasPhotographyHold: true,
          confirmed: false,
          paymentReviewRequired: true,
        };
      }

      if (heldInventoryReservations.length) {
        const inventoryTransition =
          await this.inventoryReservationModel.updateMany(
            {
              _id: {
                $in: heldInventoryReservations.map(
                  (reservation) => reservation._id,
                ),
              },
              status: ReservationStatus.TempReserved,
              expiresAt: { $gt: now },
            },
            {
              $set: { status: ReservationStatus.Confirmed },
              $unset: { expiresAt: 1 },
            },
            { session },
          );
        if (
          inventoryTransition.modifiedCount !== heldInventoryReservations.length
        ) {
          await this.bookingModel.updateOne(
            { _id: bookingId },
            {
              $set: {
                holdExpiresAt: null,
                paymentReviewRequired: true,
                paymentReviewReason:
                  'KhÃ´ng thá»ƒ xÃ¡c nháº­n toÃ n bá»™ Ã¡o dÃ i Ä‘ang giá»¯ khi thanh toÃ¡n Ä‘Æ°á»£c ghi nháº­n.',
              },
            },
            { session },
          );
          return {
            hasPhotographyHold: true,
            confirmed: false,
            paymentReviewRequired: true,
          };
        }
      }

      if (heldSchedules.length) {
        const transition = await this.bookingScheduleModel.updateMany(
          {
            _id: { $in: heldSchedules.map((schedule) => schedule._id) },
            status: BookingScheduleStatus.Held,
            holdExpiresAt: { $gt: now },
          },
          {
            $set: { status: BookingScheduleStatus.Confirmed },
            $unset: { holdExpiresAt: 1 },
          },
          { session },
        );
        // The status/expiry predicates make the state transition atomic. If it
        // did not update every held schedule, payment must go to review rather
        // than confirming a partly expired reservation.
        if (transition.modifiedCount !== heldSchedules.length) {
          if (heldInventoryReservations.length) {
            await this.inventoryReservationModel.updateMany(
              {
                _id: {
                  $in: heldInventoryReservations.map(
                    (reservation) => reservation._id,
                  ),
                },
                status: ReservationStatus.Confirmed,
              },
              {
                $set: { status: ReservationStatus.Expired },
                $unset: { expiresAt: 1 },
              },
              { session },
            );
          }
          await this.bookingModel.updateOne(
            { _id: bookingId },
            {
              $set: {
                holdExpiresAt: null,
                paymentReviewRequired: true,
                paymentReviewReason:
                  'KhÃ´ng thá»ƒ xÃ¡c nháº­n toÃ n bá»™ lá»‹ch giá»¯ chá»— khi thanh toÃ¡n Ä‘Æ°á»£c ghi nháº­n.',
              },
            },
            { session },
          );
          return {
            hasPhotographyHold: true,
            confirmed: false,
            paymentReviewRequired: true,
          };
        }
      }
      await this.bookingModel.updateOne(
        { _id: bookingId },
        {
          $set: {
            holdExpiresAt: null,
            paymentReviewRequired: false,
            paymentReviewReason: null,
          },
        },
        { session },
      );
      return {
        hasPhotographyHold: true,
        confirmed: true,
        paymentReviewRequired: false,
      };
    };
    return externalSession
      ? confirm(externalSession)
      : this.withTransactionRetry(confirm);
  }

  async expireExpiredHolds(): Promise<number> {
    const now = new Date();
    const expiredSchedules = await this.bookingScheduleModel
      .find({
        scheduleType: BookingScheduleType.Photoshoot,
        status: BookingScheduleStatus.Held,
        holdExpiresAt: { $lte: now },
      })
      .select('_id bookingId')
      .lean()
      .exec();
    if (!expiredSchedules.length) return 0;

    const scheduleIds = expiredSchedules.map((schedule) => schedule._id);
    const bookingIds = [
      ...new Set(
        expiredSchedules.map((schedule) => schedule.bookingId.toString()),
      ),
    ].map((id) => new Types.ObjectId(id));
    const result = await this.bookingScheduleModel.updateMany(
      {
        _id: { $in: scheduleIds },
        status: BookingScheduleStatus.Held,
        holdExpiresAt: { $lte: now },
      },
      { $set: { status: BookingScheduleStatus.Expired } },
    );
    // Atomically claim the pending booking before releasing its Combo quota.
    // The generic pending-booking cleanup also cancels expired bookings; the
    // successful status transition below is the single ownership marker.
    const cancelledBookingIds: Types.ObjectId[] = [];
    for (const bookingId of bookingIds) {
      const cancelled = await this.bookingModel.findOneAndUpdate(
        {
          _id: bookingId,
          status: BookingStatus.PendingPayment,
          holdExpiresAt: { $lte: now },
        },
        {
          $set: {
            status: BookingStatus.Cancelled,
            holdExpiresAt: null,
          },
          $push: {
            statusTimeline: {
              status: BookingStatus.Cancelled,
              changedAt: now,
              note: 'Tự động hủy đơn do hết thời hạn giữ lịch chụp.',
            },
          },
        },
        { new: false },
      ).exec();
      if (cancelled) cancelledBookingIds.push(bookingId);
    }

    if (!cancelledBookingIds.length) return result.modifiedCount;

    await this.inventoryReservationModel.updateMany(
      {
        bookingId: { $in: cancelledBookingIds },
        status: ReservationStatus.TempReserved,
        expiresAt: { $lte: now },
      },
      {
        $set: { status: ReservationStatus.Cancelled },
        $unset: { expiresAt: 1 },
      },
    );

    // Decrement usedCount on ComboPromotion for expired holds
    try {
      const bookingsWithCombo = await this.bookingModel
        .find({
          _id: { $in: cancelledBookingIds },
          comboPromotionId: { $ne: null },
        })
        .select('_id comboPromotionId')
        .lean()
        .exec();

      for (const b of bookingsWithCombo) {
        if (b.comboPromotionId) {
          await this.bookingModel.db.model('ComboPromotion').updateOne(
            { _id: b.comboPromotionId, usedCount: { $gt: 0 } },
            { $inc: { usedCount: -1 } }
          ).exec();
        }
      }
    } catch (e) {
      console.warn('Failed to decrement ComboPromotion usedCount on hold expiry:', e);
    }

    return result.modifiedCount;
  }

  private async createHoldInTransaction(
    customerId: Types.ObjectId,
    dto: CreatePhotographyHoldDto,
    idempotencyKey: string,
    sessions: HoldSession[],
    session: ClientSession,
  ) {
    const existing = await this.bookingModel
      .findOne({ customerId, holdIdempotencyKey: idempotencyKey })
      .session(session)
      .exec();
    if (existing) return this.toHoldResponse(existing, session);

    const photographyPackage = await this.packageModel
      .findOne({
        _id: new Types.ObjectId(dto.packageId),
        status: PackageStatus.Active,
      })
      .session(session)
      .exec();
    if (!photographyPackage) {
      throw new NotFoundException('GÃ³i chá»¥p khÃ´ng cÃ²n hoáº¡t Ä‘á»™ng.');
    }

    await this.assertProviderServiceRadius(
      photographyPackage.providerId,
      sessions,
      session,
    );

    const lockKeys = sessions.map((item) => ({
      providerId: photographyPackage.providerId,
      providerLocalDate: item.providerLocalDate,
    }));
    await this.acquireLocks(lockKeys, session);
    await this.assertNoActiveOverlap(
      photographyPackage.providerId,
      sessions,
      session,
    );

    const quote = this.calculateQuote(photographyPackage, sessions);
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);
    const priceVersion = await this.findOrCreatePriceVersion(
      photographyPackage,
      quote.totalAmount,
      session,
    );
    const depositTotal = quote.totalAmount; // 100% thanh toán trước cho thợ chụp
    const booking = new this.bookingModel({
      bookingCode: this.createBookingCode(),
      customerId,
      providerIds: [photographyPackage.providerId],
      bookingType: BookingType.Photography,
      status: BookingStatus.PendingPayment,
      holdIdempotencyKey: idempotencyKey,
      holdExpiresAt,
      pricingSummary: {
        subTotal: quote.baseAmount + quote.surchargeAmount,
        depositTotal,
        discountAmount: 0,
        travelFee: 0,
        overtimeFee: quote.overtimeAmount,
        lateFee: 0,
        damageFee: 0,
        grandTotal: quote.totalAmount,
      },
      paymentSummary: {
        totalPaid: 0,
        totalRefunded: 0,
        paymentStatus: BookingPaymentStatus.Unpaid,
      },
      statusTimeline: [
        {
          status: BookingStatus.PendingPayment,
          changedAt: new Date(),
          note: 'ÄÃ£ giá»¯ lá»‹ch chá»¥p, chá» thanh toÃ¡n.',
        },
      ],
    });
    await booking.save({ session });

    const firstSession = sessions[0];
    const bookingItem = new this.bookingItemModel({
      bookingId: booking._id,
      providerId: photographyPackage.providerId,
      itemType: BookingItemType.PhotographyPackage,
      photographyPackageId: photographyPackage._id,
      priceVersionId: priceVersion._id,
      unitPrice: quote.totalAmount,
      depositAmount: depositTotal,
      quantity: 1,
      // New multi-session bookings use BookingSchedule as their only schedule
      // source; keeping these null avoids legacy availability blocking expired holds.
      shootDate: null,
      shootTimeSlot: null,
      shootLocation: firstSession.locationAddress ?? null,
      shootLocationSnapshot: this.toLocationSnapshot(firstSession),
      shootConcept: dto.concept ?? null,
      referenceImage: dto.referenceImage ?? null,
      rentalType: 'DAILY',
      customRequests: dto.customRequests ?? null,
      packageSnapshot: {
        name: photographyPackage.name,
        basePrice: photographyPackage.price,
        pricingUnit: photographyPackage.pricingUnit ?? 'PER_SESSION',
        includedDurationMinutes:
          photographyPackage.includedDurationMinutes ??
          Math.round(photographyPackage.durationHours * 60),
        includedSessionCount: photographyPackage.includedSessionCount,
        includedDayCount: photographyPackage.includedDayCount,
        overtimeFeePerHour: photographyPackage.overtimeFeePerHour ?? 0,
        overtimeIncrementMinutes:
          photographyPackage.overtimeIncrementMinutes ?? 30,
        maxOvertimeMinutes: photographyPackage.maxOvertimeMinutes ?? 240,
      },
      priceBreakdown: quote.breakdown,
      scheduleSchemaVersion: 2,
    });
    await bookingItem.save({ session });

    await this.bookingScheduleModel.insertMany(
      sessions.map((item) => ({
        bookingId: booking._id,
        bookingItemId: bookingItem._id,
        providerId: photographyPackage.providerId,
        scheduleType: BookingScheduleType.Photoshoot,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        providerLocalDate: item.providerLocalDate,
        holdExpiresAt,
        locationAddress: item.locationAddress ?? null,
        locationSnapshot: this.toLocationSnapshot(item),
        includedDurationMinutes:
          photographyPackage.includedDurationMinutes ??
          Math.round(photographyPackage.durationHours * 60),
        overtimeMinutes: quote.overtimeMinutesByClientId[item.clientId] ?? 0,
        scheduleSchemaVersion: 2,
        status: BookingScheduleStatus.Held,
      })),
      { session },
    );

    return this.toHoldResponse(booking, session);
  }

  private calculateQuote(
    photographyPackage: PhotographyPackageWithId,
    sessions: HoldSession[],
  ) {
    try {
      return calculatePhotographyQuote(
        {
          name: photographyPackage.name,
          price: photographyPackage.price,
          pricingUnit: photographyPackage.pricingUnit,
          includedDurationMinutes:
            photographyPackage.includedDurationMinutes ??
            Math.round(photographyPackage.durationHours * 60),
          includedSessionCount: photographyPackage.includedSessionCount,
          includedDayCount: photographyPackage.includedDayCount,
          additionalSessionFee: photographyPackage.additionalSessionFee,
          overtimeFeePerHour: photographyPackage.overtimeFeePerHour,
          overtimeIncrementMinutes: photographyPackage.overtimeIncrementMinutes,
          maxOvertimeMinutes: photographyPackage.maxOvertimeMinutes,
        },
        sessions,
      );
    } catch (error) {
      if (error instanceof PhotographyPricingPolicyError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async assertNoActiveOverlap(
    providerId: Types.ObjectId,
    requested: HoldSession[],
    session: ClientSession,
  ): Promise<void> {
    const now = new Date();
    const dateKeys = [
      ...new Set(requested.map((item) => item.providerLocalDate)),
    ];
    const schedules = await this.bookingScheduleModel
      .find({
        providerId,
        providerLocalDate: { $in: dateKeys },
        scheduleType: BookingScheduleType.Photoshoot,
        $or: [
          { status: BookingScheduleStatus.Confirmed },
          { status: BookingScheduleStatus.Held, holdExpiresAt: { $gt: now } },
        ],
      })
      .session(session)
      .select('startsAt endsAt providerLocalDate')
      .lean()
      .exec();

    for (const request of requested) {
      const overlaps = schedules.some(
        (schedule) =>
          schedule.providerLocalDate === request.providerLocalDate &&
          schedule.startsAt &&
          schedule.endsAt &&
          new Date(schedule.startsAt) < request.endsAt &&
          new Date(schedule.endsAt) > request.startsAt,
      );
      if (overlaps) {
        throw new ConflictException(
          'Khung giá» chá»¥p vá»«a Ä‘Æ°á»£c khÃ¡ch khÃ¡c giá»¯ hoáº·c xÃ¡c nháº­n. Vui lÃ²ng chá»n giá» khÃ¡c.',
        );
      }
    }
  }

  private async acquireLocks(
    input: LockKey[],
    session: ClientSession,
  ): Promise<void> {
    const keys = this.getLockKeys(input).sort((left, right) => {
      const providerOrder = left.providerId
        .toString()
        .localeCompare(right.providerId.toString());
      return (
        providerOrder ||
        left.providerLocalDate.localeCompare(right.providerLocalDate)
      );
    });
    for (const key of keys) {
      await this.scheduleLockModel
        .findOneAndUpdate(
          key,
          {
            $setOnInsert: key,
            $inc: { version: 1 },
          },
          { upsert: true, new: true, session },
        )
        .exec();
    }
  }

  private getLockKeys(
    input: Array<{
      providerId?: Types.ObjectId | null;
      providerLocalDate?: string | null;
    }>,
  ): LockKey[] {
    const map = new Map<string, LockKey>();
    for (const item of input) {
      if (!item.providerId || !item.providerLocalDate) continue;
      const key = `${item.providerId.toString()}:${item.providerLocalDate}`;
      map.set(key, {
        providerId: new Types.ObjectId(item.providerId),
        providerLocalDate: item.providerLocalDate,
      });
    }
    return [...map.values()];
  }

  private async findOrCreateProductPriceVersion(
    product: Product & { _id: Types.ObjectId },
    session: ClientSession,
  ) {
    const latest = await this.priceVersionModel
      .findOne({
        targetId: product._id,
        targetType: PriceTargetType.Product,
      })
      .sort({ effectiveFrom: -1 })
      .session(session)
      .exec();

    if (
      latest &&
      latest.price === product.basePrice &&
      latest.depositAmount === product.depositAmount
    ) {
      return latest;
    }

    const priceVersion = new this.priceVersionModel({
      targetType: PriceTargetType.Product,
      targetId: product._id,
      price: product.basePrice,
      depositAmount: product.depositAmount,
      effectiveFrom: new Date(),
      note: 'Tá»± Ä‘á»™ng táº¡o khi giá»¯ combo Ã¡o dÃ i vÃ  gÃ³i chá»¥p',
    });
    await priceVersion.save({ session });
    return priceVersion;
  }
  private async findOrCreatePriceVersion(
    photographyPackage: PhotographyPackageWithId,
    price: number,
    session: ClientSession,
  ) {
    let priceVersion = await this.priceVersionModel
      .findOne({
        targetId: photographyPackage._id,
        targetType: PriceTargetType.PhotographyPackage,
      })
      .sort({ effectiveFrom: -1 })
      .session(session)
      .exec();
    if (!priceVersion) {
      priceVersion = new this.priceVersionModel({
        targetType: PriceTargetType.PhotographyPackage,
        targetId: photographyPackage._id,
        price,
        depositAmount: price, // 100% thanh toán trước cho thợ chụp
        effectiveFrom: new Date(),
        note: 'Tá»± Ä‘á»™ng táº¡o khi giá»¯ lá»‹ch gÃ³i chá»¥p',
      });
      await priceVersion.save({ session });
    }
    return priceVersion;
  }

  private async toHoldResponse(
    booking: Booking & { _id: Types.ObjectId },
    session?: ClientSession,
  ) {
    const scheduleQuery = this.bookingScheduleModel
      .find({
        bookingId: booking._id,
        scheduleType: BookingScheduleType.Photoshoot,
      })
      .sort({ startsAt: 1 });
    if (session) scheduleQuery.session(session);
    const schedules = await scheduleQuery.lean().exec();
    return {
      bookingId: booking._id.toString(),
      bookingCode: booking.bookingCode,
      status: schedules.some(
        (schedule) => schedule.status === BookingScheduleStatus.Held,
      )
        ? BookingScheduleStatus.Held
        : schedules.every(
          (schedule) => schedule.status === BookingScheduleStatus.Confirmed,
        )
          ? BookingScheduleStatus.Confirmed
          : BookingScheduleStatus.Expired,
      holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
      paymentRequiredAmount: booking.pricingSummary.depositTotal,
      schedules: schedules.map((schedule) => ({
        id: schedule._id.toString(),
        startsAt: schedule.startsAt?.toISOString() ?? null,
        endsAt: schedule.endsAt?.toISOString() ?? null,
        status: schedule.status,
      })),
    };
  }

  private async toComboHoldResponse(
    booking: Booking & { _id: Types.ObjectId },
    session?: ClientSession,
  ) {
    const response = await this.toHoldResponse(booking, session);
    const reservationQuery = this.inventoryReservationModel
      .find({ bookingId: booking._id })
      .sort({ reservedFrom: 1, inventoryItemId: 1 });
    if (session) reservationQuery.session(session);
    const aodaiReservations = await reservationQuery.lean().exec();

    return {
      ...response,
      bookingType: BookingType.Combo,
      aodaiReservations: aodaiReservations.map((reservation) => ({
        inventoryItemId: reservation.inventoryItemId.toString(),
        bookingItemId: reservation.bookingItemId.toString(),
        reservedFrom: reservation.reservedFrom.toISOString(),
        reservedTo: reservation.reservedTo.toISOString(),
        status: reservation.status,
        holdExpiresAt: reservation.expiresAt?.toISOString() ?? null,
      })),
    };
  }
  private toHoldSessions(dto: CreatePhotographyHoldDto): HoldSession[] {
    return dto.sessions.map((item) => {
      const startsAt = new Date(item.startsAt);
      const endsAt = new Date(item.endsAt);
      return {
        clientId: item.clientId,
        startsAt,
        endsAt,
        providerLocalDate: this.toBusinessDateKey(startsAt),
        durationMinutes: Math.round(
          (endsAt.getTime() - startsAt.getTime()) / 60000,
        ),
        locationAddress: item.locationAddress,
        locationLatitude: item.locationLatitude,
        locationLongitude: item.locationLongitude,
      };
    });
  }

  private async assertProviderServiceRadius(
    providerId: Types.ObjectId,
    sessions: HoldSession[],
    session: ClientSession,
  ): Promise<void> {
    const provider = await this.providerModel
      .findById(providerId)
      .select('address.geo photographySettings.serviceRadiusKm')
      .session(session)
      .lean()
      .exec();
    if (!provider) {
      throw new NotFoundException('Photography provider was not found.');
    }

    const radiusKm = provider.photographySettings?.serviceRadiusKm;
    const coordinates = provider.address?.geo?.coordinates;
    if (
      radiusKm === null ||
      radiusKm === undefined ||
      !coordinates ||
      coordinates.length !== 2
    ) {
      throw new BadRequestException(
        'The photography provider must configure a service radius and base location before accepting bookings.',
      );
    }

    const [providerLongitude, providerLatitude] = coordinates;
    for (const item of sessions) {
      if (
        !Number.isFinite(item.locationLatitude) ||
        !Number.isFinite(item.locationLongitude)
      ) {
        throw new BadRequestException(
          'A precise shoot location is required before creating a photography hold.',
        );
      }
      const distanceKm = this.distanceKm(
        providerLatitude,
        providerLongitude,
        item.locationLatitude as number,
        item.locationLongitude as number,
      );
      if (distanceKm > radiusKm) {
        throw new BadRequestException(
          "The shoot location is outside this photographer's service radius.",
        );
      }
    }
  }

  private toLocationSnapshot(item: HoldSession): {
    address: string | null;
    geo: { type: 'Point'; coordinates: [number, number] } | null;
  } {
    const hasCoordinates =
      Number.isFinite(item.locationLatitude) &&
      Number.isFinite(item.locationLongitude);
    return {
      address: item.locationAddress?.trim() || null,
      geo: hasCoordinates
        ? {
          type: 'Point',
          coordinates: [
            item.locationLongitude as number,
            item.locationLatitude as number,
          ],
        }
        : null,
    };
  }

  private toPickupReturnLocationSnapshot(provider: Provider | null): {
    address: string;
    ward?: string | null;
    district?: string | null;
    city?: string | null;
    geo: { type: 'Point'; coordinates: [number, number] } | null;
  } {
    if (!provider) {
      throw new NotFoundException('Ao Dai provider was not found.');
    }
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
      address: source.addressLine.trim(),
      ward: source.ward ?? null,
      district: source.district ?? null,
      city: source.city ?? null,
      geo:
        coordinates && coordinates.length === 2
          ? { type: 'Point', coordinates: [coordinates[0], coordinates[1]] }
          : null,
    };
  }

  private distanceKm(
    latitudeA: number,
    longitudeA: number,
    latitudeB: number,
    longitudeB: number,
  ): number {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const latitudeDelta = toRadians(latitudeB - latitudeA);
    const longitudeDelta = toRadians(longitudeB - longitudeA);
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  }
  private toRentalRange(
    rentalFromValue: string,
    rentalToValue: string,
  ): { rentalFrom: Date; rentalTo: Date } {
    const toDateKey = (value: string, fieldLabel: string) => {
      const key = value.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        throw new BadRequestException(fieldLabel + ' khÃ´ng há»£p lá»‡.');
      }
      return key;
    };
    const fromKey = toDateKey(rentalFromValue, 'NgÃ y nháº­n Ã¡o dÃ i');
    const toKey = toDateKey(rentalToValue, 'NgÃ y tráº£ Ã¡o dÃ i');
    return {
      rentalFrom: new Date(fromKey + 'T00:00:00.000+07:00'),
      rentalTo: new Date(toKey + 'T23:59:59.999+07:00'),
    };
  }

  private normalizeInventoryColor(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (normalized === 'Äá»Ž' || normalized === 'RED') return 'RED';
    if (normalized === 'TRáº®NG' || normalized === 'WHITE') return 'WHITE';
    if (normalized === 'VÃ€NG' || normalized === 'GOLD') return 'GOLD';
    if (normalized === 'ÄEN' || normalized === 'BLACK') return 'BLACK';
    return normalized;
  }
  private toBusinessDateKey(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private createBookingCode(): string {
    return `BK${Date.now().toString().slice(-8)}${Math.floor(
      10 + Math.random() * 90,
    )}`;
  }

  private toObjectId(
    value: Types.ObjectId | string,
    message: string,
  ): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException(message);
    return new Types.ObjectId(value);
  }

  private async withTransactionRetry<T>(
    callback: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt += 1) {
      const session = await this.bookingModel.db.startSession();
      try {
        let result!: T;
        await session.withTransaction(async () => {
          result = await callback(session);
        });
        return result;
      } catch (error) {
        lastError = error;
        const retryable =
          (typeof (error as { hasErrorLabel?: unknown })?.hasErrorLabel ===
            'function' &&
            (
              error as { hasErrorLabel: (label: string) => boolean }
            ).hasErrorLabel('TransientTransactionError')) ||
          (error as { code?: number })?.code === 11000;
        if (!retryable || attempt === MAX_TRANSACTION_RETRIES - 1) throw error;
      } finally {
        await session.endSession();
      }
    }
    throw lastError;
  }
}
