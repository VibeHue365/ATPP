import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Booking,
  BookingDocument,
  BookingStatus,
  BookingType,
} from '../schemas/booking.schema';
import {
  BookingItem,
  BookingItemDocument,
  BookingItemType,
} from '../schemas/booking-item.schema';
import {
  DepositSettlementStatus,
  RentalFulfillmentStatus,
  RentalInventoryStatus,
} from '../schemas/rental-fulfillment.types';
import { Product, ProductStatus } from '../../products/schemas/product.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { PaymentsService } from '../../payments/services/payments.service';
import { RentalDepositRefundCoordinatorService } from './rental-deposit-refund-coordinator.service';
import { SettlementsService } from '../../settlements/services/settlements.service';

@Injectable()
export class RentalOverdueDominoService {
  private readonly logger = new Logger(RentalOverdueDominoService.name);

  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItemDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<Product>,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @Optional()
    private readonly rentalDepositRefundCoordinator?: RentalDepositRefundCoordinatorService,
    @Optional()
    private readonly settlementsService?: SettlementsService,
  ) {}

  /**
   * 1. Quét và cập nhật trạng thái đơn quá hạn (Khách A).
   * Chạy định kỳ bởi cronjob scheduler.
   */
  async scanAndProcessOverdueBookings(targetBookingId?: string): Promise<number> {
    const now = new Date();
    // Tìm các đơn thuê đang ở PICKED_UP hoặc RETURN_PENDING hoặc OVERDUE
    const query: any = {
      status: {
        $in: [
          BookingStatus.PickedUp,
          BookingStatus.ReturnPending,
          BookingStatus.Overdue,
        ],
      },
      bookingType: {
        $in: [BookingType.AoDaiRental, BookingType.Combo],
      },
    };
    if (targetBookingId && Types.ObjectId.isValid(targetBookingId)) {
      query._id = new Types.ObjectId(targetBookingId);
    }
    const activeRentals = await this.bookingModel.find(query).exec();

    let processedCount = 0;
    if (activeRentals.length === 0) return 0;

    const bookingIds = activeRentals.map((b) => b._id);
    const allItems = await this.bookingItemModel
      .find({ bookingId: { $in: bookingIds } })
      .lean()
      .exec();
    const itemsByBooking = new Map<string, any[]>();
    for (const it of allItems) {
      const bid = it.bookingId?.toString();
      if (!bid) continue;
      const arr = itemsByBooking.get(bid) || [];
      arr.push(it);
      itemsByBooking.set(bid, arr);
    }

    for (const booking of activeRentals) {
      try {
        const bookingItems = itemsByBooking.get(booking._id.toString()) || [];
        const endDateTime = this.resolveBookingEndDateTime(booking, bookingItems);
        if (!endDateTime || now <= endDateTime) continue;

        // Đã quá hạn!
        const diffMs = now.getTime() - endDateTime.getTime();
        const minutesOverdue = Math.max(1, Math.floor(diffMs / (60 * 1000)));

        // Mức trần: tối đa 50% tiền cọc của đơn
        const itemsDeposit = bookingItems.reduce(
          (sum, it) => sum + (Number(it?.depositAmount) || 0),
          0,
        );
        const depositAmount =
          (booking as any).depositTotal ||
          booking.pricingSummary?.depositTotal ||
          itemsDeposit ||
          100000;

        // Biểu phí lũy tiến theo %: +10% tiền cọc / 30 phút (tối đa 50% cọc)
        const intervals = Math.ceil(minutesOverdue / 30);
        const perIntervalFee = Math.max(1000, Math.round(depositAmount * 0.1));
        const rawLateFee = intervals * perIntervalFee;
        const maxLateFeeCap = Math.floor(depositAmount * 0.5);
        const calculatedLateFee = Math.min(rawLateFee, maxLateFeeCap);

        const rawTracking = (booking as any).overdueTracking;
        const currentTracking =
          rawTracking && typeof rawTracking.toObject === 'function'
            ? rawTracking.toObject()
            : rawTracking || {};
        const rawNotif = currentTracking.notificationsSent;
        const notificationsSent = {
          ...(rawNotif && typeof rawNotif.toObject === 'function'
            ? rawNotif.toObject()
            : rawNotif || {}),
        };

        const hasCustomerReturned =
          booking.status === BookingStatus.ReturnPending ||
          Boolean((booking as any).customerReturnEvidence?.submittedAt);
        let isFirstOverdue = false;
        if (
          !hasCustomerReturned &&
          booking.status !== BookingStatus.Overdue &&
          booking.status !== BookingStatus.LostItem
        ) {
          booking.status = BookingStatus.Overdue;
          isFirstOverdue = true;
          (booking as any).statusTimeline = (booking as any).statusTimeline || [];
          (booking as any).statusTimeline.push({
            status: BookingStatus.Overdue,
            changedAt: now,
            note: `Đơn quá hạn trả trang phục (+10% tiền cọc / 30 phút = +${perIntervalFee.toLocaleString('vi-VN')}đ/30p, áp trần 50% cọc: ${maxLateFeeCap.toLocaleString('vi-VN')}đ).`,
          });
        }

        // Cập nhật phí vào pricingSummary
        if (booking.pricingSummary) {
          booking.pricingSummary.lateFee = calculatedLateFee;
        }

        // Cập nhật subdocument overdueTracking
        const overdueTracking = {
          ...currentTracking,
          isOverdue: true,
          overdueSince: currentTracking.overdueSince || endDateTime,
          minutesOverdue,
          calculatedLateFee,
          maxLateFeeCap,
          notificationsSent,
        };

        // Gửi thông báo mốc 15 phút
        if (minutesOverdue >= 15 && !notificationsSent.fifteenMin) {
          notificationsSent.fifteenMin = true;
          await this.sendNotificationSafe(
            booking.customerId.toString(),
            'Nhắc nhở: Đơn thuê áo dài đã quá giờ trả',
            `Đơn hàng #${booking.bookingCode} đã trễ 15 phút. Phí quá hạn đang tính (+10% tiền cọc / 30 phút). Vui lòng mang áo đến quầy để hoàn tất thủ tục trả đồ.`,
            booking._id,
          );
        }

        // Gửi thông báo mốc 1 giờ
        if (minutesOverdue >= 60 && !notificationsSent.oneHour) {
          notificationsSent.oneHour = true;
          await this.sendNotificationSafe(
            booking.customerId.toString(),
            'Cảnh báo: Đơn thuê áo dài trễ hạn 1 giờ',
            `Đơn hàng #${booking.bookingCode} đã trễ 1 giờ. Tiền phạt hiện tại: ${calculatedLateFee.toLocaleString('vi-VN')}đ. Phí phạt sẽ trừ trực tiếp vào tiền cọc.`,
            booking._id,
          );
        }

        // Mốc T+2h: Khóa quyền tạo đơn mới (ACCOUNT_RESTRICTED)
        if (minutesOverdue >= 120 && !overdueTracking.accountRestrictedAt) {
          overdueTracking.accountRestrictedAt = now;
          await this.restrictUserAccount(
            booking.customerId.toString(),
            `Tài khoản tạm khóa quyền tạo đơn mới do đơn hàng #${booking.bookingCode} trễ hạn trả quá 2 giờ.`,
          );
          await this.sendNotificationSafe(
            booking.customerId.toString(),
            'Tài khoản bị tạm khóa quyền đặt đơn mới',
            `Do đơn hàng #${booking.bookingCode} đã quá hạn trả áo dài hơn 2 giờ, hệ thống tạm khóa quyền đặt đơn mới của bạn trên sàn TàGo theo quy chế vận hành.`,
            booking._id,
          );
        }

        // Gửi thông báo mốc 6 giờ
        if (minutesOverdue >= 360 && !notificationsSent.sixHour) {
          notificationsSent.sixHour = true;
          await this.sendNotificationSafe(
            booking.customerId.toString(),
            'Khẩn cấp: Đơn thuê trễ hạn 6 giờ',
            `Đơn hàng #${booking.bookingCode} đã trễ 6 giờ. Shop và Sàn TàGo đang chờ bạn mang trang phục đến quầy để đối soát cọc.`,
            booking._id,
          );
        }

        // Mốc T+24h: Đề xuất LOST_ITEM
        if (minutesOverdue >= 1440 && !overdueTracking.lostItemProposedAt) {
          overdueTracking.lostItemProposedAt = now;
          notificationsSent.twentyFourHour = true;

          // Báo cho Shop và Admin
          for (const provId of booking.providerIds || []) {
            await this.sendNotificationSafe(
              provId.toString(),
              'Đề xuất xác nhận mất đồ (LOST_ITEM)',
              `Đơn hàng #${booking.bookingCode} đã quá hạn 24 giờ. Hệ thống đã bật đề xuất xác nhận MẤT ĐỒ trên Dashboard sau khi liên hệ khách thất bại.`,
              booking._id,
            );
          }
        }

        (booking as any).overdueTracking = overdueTracking;
        await booking.save();

        // Kích hoạt kiểm tra Domino Recovery cho Khách B (chạy ngay từ khi phát hiện trễ)
        if (isFirstOverdue || minutesOverdue <= 120) {
          await this.checkAndTriggerDominoRecovery(booking);
        }

        processedCount++;
      } catch (err) {
        this.logger.error(`Lỗi xử lý quá hạn đơn ${booking.bookingCode}:`, err);
      }
    }

    return processedCount;
  }

  /**
   * 2. Thuật toán Domino Recovery: Cứu đơn Khách B khi Khách A trễ đồ.
   */
  async checkAndTriggerDominoRecovery(
    overdueBooking: BookingDocument,
  ): Promise<void> {
    try {
      const items = await this.bookingItemModel
        .find({
          bookingId: overdueBooking._id,
          productId: { $ne: null },
        })
        .lean()
        .exec();

      for (const item of items) {
        const productId = item.productId;
        if (!productId) continue;

        const product = await this.productModel.findById(productId).lean().exec();
        if (!product) continue;

        // Tìm đơn của Khách B thuê cùng chiếc áo này có nguy cơ va chạm lịch trong vòng 36h tới
        const now = new Date();
        const nextWindow = new Date(now.getTime() + 36 * 60 * 60 * 1000);

        const conflictingBookings = await this.bookingModel
          .find({
            _id: { $ne: overdueBooking._id },
            status: {
              $in: [
                BookingStatus.Confirmed,
                BookingStatus.DepositPaid,
                BookingStatus.PickupPending,
              ],
            },
            startDate: { $lte: nextWindow },
            endDate: { $gte: now },
            'dominoRecovery.status': { $nin: ['SWAPPED', 'ACCEPTED_ALTERNATIVE', 'REFUNDED'] },
          })
          .exec();

        for (const bBooking of conflictingBookings) {
          // Kiểm tra xem đơn Khách B có chứa cùng productId này không
          const bHasProduct = ((bBooking as any).items || []).some(
            (bIt: any) =>
              bIt.productId?.toString() === productId.toString() ||
              bIt._id?.toString() === productId.toString(),
          );
          if (!bHasProduct) continue;

          this.logger.log(
            `Phát hiện va chạm lịch Domino: Đơn #${overdueBooking.bookingCode} (A) trễ làm ảnh hưởng đơn #${bBooking.bookingCode} (B).`,
          );

          // Nhánh 1: Kiểm tra xem Shop có chiếc áo cùng mẫu/size/màu khả dụng khác không (Quantity > 1)
          const inventoryItemModel = this.bookingModel.db.model('InventoryItem');
          let availableSameVariant: any = null;
          try {
            availableSameVariant = await inventoryItemModel
              .findOne({
                productId: new Types.ObjectId(productId.toString()),
                size: (item as any).size || (product as any).size,
                status: RentalInventoryStatus.Available,
              })
              .lean()
              .exec();
          } catch {
            availableSameVariant = null;
          }

          if (availableSameVariant) {
            // [CÓ]: Auto-Swap sang chiếc có sẵn kịp giờ
            (bBooking as any).dominoRecovery = {
              hasConflict: true,
              sourceOverdueBookingId: overdueBooking._id,
              sourceOverdueBookingCode: overdueBooking.bookingCode,
              actionType: 'AUTO_SWAP',
              status: 'SWAPPED',
              swappedInventoryItemId: availableSameVariant._id,
              resolvedAt: now,
            };
            (bBooking as any).statusTimeline = (bBooking as any).statusTimeline || [];
            (bBooking as any).statusTimeline.push({
              status: bBooking.status,
              changedAt: now,
              note: `Hệ thống tự động kích hoạt Domino Recovery: Đổi sang chiếc áo cùng mẫu & size mới tinh để đảm bảo lịch hẹn của bạn.`,
            });
            await bBooking.save();

            // Gửi thông báo an tâm cho Khách B
            await this.sendNotificationSafe(
              bBooking.customerId.toString(),
              'Đơn hàng được chuẩn bị sẵn sàng',
              `Hệ thống TàGo đã tự động điều phối một trang phục cùng mẫu & size mới tinh cho đơn hàng #${bBooking.bookingCode} để đảm bảo lịch hẹn của bạn luôn chuẩn xác.`,
              bBooking._id,
            );
          } else {
            // [KHÔNG] (Áo độc bản hoặc hết chiếc cùng loại):
            // 1. Cảnh báo khẩn cấp tới chủ tiệm
            for (const provId of bBooking.providerIds || []) {
              await this.sendNotificationSafe(
                provId.toString(),
                'Cảnh báo va chạm lịch (Domino Recovery)',
                `Đơn hàng #${bBooking.bookingCode} có nguy cơ trễ nhận áo do đơn #${overdueBooking.bookingCode} chưa trả. Hệ thống đã mở đề xuất đổi mẫu tương đương cho Khách B.`,
                bBooking._id,
              );
            }

            // 2. Tìm Top 3 mẫu tương đương đang trống lịch cùng khoảng giá
            const basePrice = (product as any).rentalPrice || (product as any).price || 300000;
            const minPrice = Math.floor(basePrice * 0.7);
            const maxPrice = Math.ceil(basePrice * 1.3);

            const top3Alternatives = await this.productModel
              .find({
                _id: { $ne: product._id },
                providerId: product.providerId,
                status: ProductStatus.Active,
                $or: [
                  { rentalPrice: { $gte: minPrice, $lte: maxPrice } },
                  { price: { $gte: minPrice, $lte: maxPrice } },
                ],
              })
              .limit(3)
              .select('_id name rentalPrice images category')
              .lean()
              .exec();

            const top3Ids = top3Alternatives.map((a) => a._id);
            const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 60 phút

            (bBooking as any).dominoRecovery = {
              hasConflict: true,
              sourceOverdueBookingId: overdueBooking._id,
              sourceOverdueBookingCode: overdueBooking.bookingCode,
              actionType: 'ALTERNATIVE_SELECTION',
              status: 'OFFERED',
              alternativeProductIds: top3Ids,
              offeredAt: now,
              expiresAt,
            };
            await bBooking.save();

            // 3. Gửi thông báo cho Khách B kèm lựa chọn đổi mẫu hoặc nhận hoàn tiền 100%
            await this.sendNotificationSafe(
              bBooking.customerId.toString(),
              'Hỗ trợ đổi trang phục hoặc hoàn tiền 100%',
              `Trang phục bạn đặt trong đơn #${bBooking.bookingCode} đang được hỗ trợ phương án dự phòng. Bạn có thể chọn 1 trong 3 mẫu tương đương hoặc chọn nhận hoàn tiền 100% (cọc + phí).`,
              bBooking._id,
            );
          }
        }
      }
    } catch (dominoErr) {
      this.logger.error('Lỗi khi kích hoạt Domino Recovery:', dominoErr);
    }
  }

  /**
   * 3. Xử lý tự động hoàn tiền Khách B sau 60 phút nếu không có phản hồi.
   */
  async processDominoAutoRefunds(): Promise<number> {
    const now = new Date();
    const expiredOffers = await this.bookingModel
      .find({
        'dominoRecovery.status': 'OFFERED',
        'dominoRecovery.expiresAt': { $lte: now },
        status: {
          $in: [
            BookingStatus.Confirmed,
            BookingStatus.DepositPaid,
            BookingStatus.PickupPending,
          ],
        },
      })
      .exec();

    let refundedCount = 0;
    for (const bBooking of expiredOffers) {
      try {
        await this.executeFullRefundForDomino(
          bBooking,
          'Hệ thống tự động hủy đơn và hoàn tiền 100% (cọc + phí thuê) cho Khách B do Shop không kịp bàn giao trang phục sau 60 phút.',
        );
        refundedCount++;
      } catch (err) {
        this.logger.error(`Lỗi tự hoàn tiền Domino cho đơn ${bBooking.bookingCode}:`, err);
      }
    }
    return refundedCount;
  }

  /**
   * 4. Shop / Admin bấm "Xác nhận mất đồ (LOST_ITEM)" sau khi liên hệ thất bại >= 3 lần.
   */
  async confirmLostItem(
    bookingId: string,
    user: AuthUser,
    input: { reason?: string; contactAttempts?: number },
  ): Promise<any> {
    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng.');

    const isProvider = (booking.providerIds || []).some(
      (p) => p.toString() === user.sub,
    );
    const isAdmin =
      (user.roles || []).includes('ADMIN') ||
      (user.roles || []).includes('admin');

    if (!isProvider && !isAdmin) {
      throw new ForbiddenException(
        'Chỉ Nhà cung cấp sở hữu đơn hoặc Admin mới có quyền xác nhận mất đồ.',
      );
    }

    const contactAttempts = input.contactAttempts || 3;
    if (contactAttempts < 3) {
      throw new BadRequestException(
        'Quy chế sàn TàGo yêu cầu liên hệ khách hàng tối thiểu 3 lần bất thành trước khi xác nhận mất đồ.',
      );
    }
    if (booking.status === BookingStatus.LostItem) {
      throw new BadRequestException('Đơn hàng này đã được xác nhận mất đồ trước đó.');
    }

    const now = new Date();
    booking.status = BookingStatus.LostItem;

    const overdueTracking = (booking as any).overdueTracking || {};
    overdueTracking.lostItemConfirmedAt = now;
    overdueTracking.lostItemConfirmedBy = user.sub;
    overdueTracking.contactAttemptsCount = contactAttempts;
    overdueTracking.notes = input.reason || 'Khách hàng không trả đồ và không liên lạc được.';

    // 1. Tịch thu toàn bộ tiền cọc chuyển vào ví Shop
    const bookingItems = await this.bookingItemModel
      .find({ bookingId: booking._id })
      .lean()
      .exec();
    const itemsDeposit = bookingItems.reduce(
      (sum, it) => sum + (Number(it?.depositAmount) || 0),
      0,
    );
    const depositAmount =
      (booking as any).depositTotal ||
      booking.pricingSummary?.depositTotal ||
      itemsDeposit ||
      0;

    if (depositAmount > 0 && !overdueTracking.walletCreditedAt) {
      await this.creditProviderWallet(booking, depositAmount);
      await this.settleEscrowForOverdue(booking._id, 'DISPUTED_RESOLVED');
      overdueTracking.walletCreditedAt = now;
      overdueTracking.walletCreditedAmount = depositAmount;
      overdueTracking.depositRefundedAmount = 0;
    }

    (booking as any).overdueTracking = overdueTracking;

    (booking as any).statusTimeline = (booking as any).statusTimeline || [];
    (booking as any).statusTimeline.push({
      status: BookingStatus.LostItem,
      changedAt: now,
      note: `Xác nhận mất trang phục (LOST_ITEM). Tịch thu toàn bộ ${depositAmount.toLocaleString('vi-VN')}đ tiền cọc chuyển vào ví Shop.`,
    });

    // 2. Cập nhật trạng thái áo dài: Ẩn/tạm khóa khỏi kho thuê
    try {
      const inventoryItemModel = this.bookingModel.db.model('InventoryItem');
      await inventoryItemModel.updateMany(
        { bookingId: booking._id },
        { $set: { status: RentalInventoryStatus.Lost } },
      );
    } catch (e) {
      this.logger.warn('Cập nhật trạng thái kho sang LOST cảnh báo:', e);
    }

    // 3. Chế tài: Khóa vĩnh viễn tài khoản Khách A (Blacklist)
    await this.blacklistUserAccount(
      booking.customerId.toString(),
      `Khóa tài khoản vĩnh viễn do chiếm đoạt trang phục tại đơn hàng #${booking.bookingCode}.`,
    );

    await booking.save();

    // 4. Gửi thông báo đến Khách A và Shop
    await this.sendNotificationSafe(
      booking.customerId.toString(),
      'Tài khoản bị cấm vĩnh viễn do chiếm đoạt trang phục',
      `Đơn hàng #${booking.bookingCode} đã bị chuyển sang trạng thái LOST_ITEM. Toàn bộ tiền cọc đã bị tịch thu. Hồ sơ hợp đồng điện tử và CCCD của bạn đã được chuyển cho cơ quan chức năng theo Điều 175 BLHS.`,
      booking._id,
    );

    return {
      success: true,
      bookingId: booking._id,
      status: BookingStatus.LostItem,
      message: 'Đã xác nhận mất đồ và tịch thu tiền cọc chuyển cho Shop.',
    };
  }

  /**
   * 5. Nhánh hoàn tác (Rollback): Khách A xuất hiện trả đồ trước khi có phán quyết cuối.
   */
  async settleIfFullyReturned(bookingId: string): Promise<boolean> {
    const booking = await this.bookingModel
      .findById(bookingId)
      .select({ status: 1, overdueTracking: 1 })
      .lean()
      .exec();
    if (
      !booking ||
      (booking.status !== BookingStatus.Overdue &&
        !(booking as any).overdueTracking?.isOverdue)
    ) {
      return false;
    }

    const items = await this.bookingItemModel
      .find({
        bookingId: booking._id,
        itemType: BookingItemType.Product,
      })
      .select({ 'rentalFulfillment.status': 1 })
      .lean()
      .exec();
    if (!items.length) return false;

    const allReturned = items.every((item: any) =>
      [
        RentalFulfillmentStatus.Returned,
        RentalFulfillmentStatus.Completed,
      ].includes(item.rentalFulfillment?.status),
    );
    if (!allReturned) return false;

    await this.reverseOverdueOnReturn(bookingId);
    return true;
  }

  async reverseOverdueOnReturn(bookingId: string): Promise<any> {
    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng.');

    const tracking = (booking as any).overdueTracking || {};
    if (booking.status !== BookingStatus.Overdue && !tracking.isOverdue) {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái quá hạn để thực hiện hoàn tác.',
      );
    }

    const now = new Date();
    const bookingItems = await this.bookingItemModel
      .find({ bookingId: booking._id })
      .lean()
      .exec();
    const itemsDeposit = bookingItems.reduce(
      (sum, it) => sum + (Number(it?.depositAmount) || 0),
      0,
    );
    const depositTotal =
      (booking as any).depositTotal ||
      booking.pricingSummary?.depositTotal ||
      itemsDeposit ||
      0;
    const calculatedLateFee = Math.min(
      tracking.calculatedLateFee || 0,
      depositTotal,
    );
    const remainingDepositRefund = Math.max(0, depositTotal - calculatedLateFee);

    // 1. Cập nhật rentalFulfillment trên BookingItem TRƯỚC để RentalDepositRefundCoordinator đọc đúng số tiền hoàn cọc dư
    const settlementStatus =
      calculatedLateFee > 0
        ? remainingDepositRefund > 0
          ? DepositSettlementStatus.PartiallyDeducted
          : DepositSettlementStatus.FullyDeducted
        : DepositSettlementStatus.FullyReleased;

    const productItems = bookingItems.filter(
      (it: any) =>
        it.itemType === BookingItemType.Product ||
        (!it.itemType && booking.bookingType !== BookingType.Photography),
    );
    const targetItems = productItems.length > 0 ? productItems : bookingItems;

    for (let idx = 0; idx < targetItems.length; idx++) {
      const it = targetItems[idx];
      await this.bookingItemModel.updateOne(
        { _id: it._id },
        {
          $set: {
            'rentalFulfillment.status': RentalFulfillmentStatus.Completed,
            'rentalFulfillment.inventoryStatus': RentalInventoryStatus.Cleaning,
            'rentalFulfillment.returnedAt': now,
            'rentalFulfillment.completedAt': now,
            'rentalFulfillment.depositSettlementStatus':
              idx === 0 ? settlementStatus : DepositSettlementStatus.FullyReleased,
            'rentalFulfillment.depositRefundAmount':
              idx === 0 ? remainingDepositRefund : 0,
            'rentalFulfillment.depositDeductedAmount':
              idx === 0 ? calculatedLateFee : 0,
          },
        },
      );
    }

    // 2. Cập nhật trạng thái Booking sang COMPLETED & lưu đối soát
    if (calculatedLateFee > 0 && !tracking.walletCreditedAt) {
      await this.creditProviderWallet(booking, calculatedLateFee);
      tracking.walletCreditedAt = now;
      tracking.walletCreditedAmount = calculatedLateFee;
    }

    booking.status = BookingStatus.Completed;
    tracking.isOverdue = false;
    tracking.reversedAt = now;
    tracking.calculatedLateFee = calculatedLateFee;
    tracking.depositRefundedAmount = remainingDepositRefund;
    (booking as any).overdueTracking = tracking;
    if (booking.pricingSummary) {
      booking.pricingSummary.lateFee = calculatedLateFee;
    }

    const wasRestrictedByOverdue =
      Boolean(tracking.accountRestrictedAt) ||
      Number(tracking.minutesOverdue || 0) >= 120;
    let restrictedUntilDate: Date | null = null;

    if (wasRestrictedByOverdue) {
      restrictedUntilDate = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      await this.applyPostReturnRestriction(
        booking.customerId.toString(),
        booking.bookingCode,
        restrictedUntilDate,
      );
    }

    const restrictedUntilLabel = restrictedUntilDate
      ? restrictedUntilDate.toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : null;

    (booking as any).statusTimeline = (booking as any).statusTimeline || [];
    (booking as any).statusTimeline.push({
      status: BookingStatus.Completed,
      changedAt: now,
      note: wasRestrictedByOverdue
        ? `Khách đã trả áo & hoàn tất đơn. Đối soát quá hạn: Trừ phí trễ ${calculatedLateFee.toLocaleString('vi-VN')}đ (đã cộng ví Shop), hoàn lại cọc dư ${remainingDepositRefund.toLocaleString('vi-VN')}đ cho khách. Tiếp tục áp dụng phạt tạm khóa đặt đơn mới 3 ngày (đến ${restrictedUntilLabel}).`
        : `Khách đã trả áo & hoàn tất đơn. Đối soát quá hạn: Trừ phí trễ ${calculatedLateFee.toLocaleString('vi-VN')}đ (đã cộng ví Shop), hoàn lại cọc dư ${remainingDepositRefund.toLocaleString('vi-VN')}đ cho khách.`,
    });

    // Khôi phục áo vào trạng thái giặt ủi
    try {
      const inventoryItemModel = this.bookingModel.db.model('InventoryItem');
      await inventoryItemModel.updateMany(
        { bookingId: booking._id },
        { $set: { status: RentalInventoryStatus.Cleaning } },
      );
    } catch {
      // ignore
    }

    await booking.save();

    // 3. Tạo & thực thi hoàn cọc đúng số tiền dư (remainingDepositRefund) qua Coordinator chính thức
    let refundResult: any = null;
    if (this.rentalDepositRefundCoordinator) {
      try {
        refundResult =
          await this.rentalDepositRefundCoordinator.coordinate(bookingId);
      } catch (coordErr) {
        this.logger.warn(
          `RentalDepositRefundCoordinator cảnh báo cho đơn ${booking.bookingCode}:`,
          coordErr,
        );
      }
    } else if (remainingDepositRefund > 0) {
      try {
        refundResult = await this.paymentsService.refundDeposit(
          bookingId,
          remainingDepositRefund,
        );
      } catch (refundErr) {
        this.logger.warn(
          `Hoàn cọc dư qua PaymentsService cho đơn ${booking.bookingCode} cảnh báo:`,
          refundErr,
        );
      }
    } else {
      await this.settleEscrowForOverdue(booking._id, 'DISPUTED_RESOLVED');
    }

    // 4. Tạo & cộng tiền bồi thường quá hạn vào Settlement (Lịch sử quyết toán của Shop)
    if (this.settlementsService) {
      try {
        await this.settlementsService.createSettlementsForBooking(bookingId);
        if (calculatedLateFee > 0 && booking.providerIds?.length) {
          await this.settlementsService.applyCompensationForBooking(
            bookingId,
            booking.providerIds[0],
            calculatedLateFee,
            `Phí phạt quá hạn trả áo dài (+${calculatedLateFee.toLocaleString('vi-VN')}đ)`,
          );
        }
      } catch (stlErr) {
        this.logger.warn(
          `Cập nhật Settlement quá hạn đơn #${booking.bookingCode} cảnh báo:`,
          stlErr,
        );
      }
    }

    await this.sendNotificationSafe(
      booking.customerId.toString(),
      wasRestrictedByOverdue
        ? 'Đã hoàn tất trả áo (Tài khoản tạm khóa 3 ngày)'
        : 'Đã hoàn tất trả áo và đối soát cọc',
      wasRestrictedByOverdue
        ? `Đơn hàng #${booking.bookingCode} đã được nhận lại. Phí trễ ${calculatedLateFee.toLocaleString('vi-VN')}đ được trừ vào cọc, tiền cọc dư ${remainingDepositRefund.toLocaleString('vi-VN')}đ đã được hoàn lại. Do trễ hạn quá 2 giờ, tài khoản vẫn bị tạm khóa quyền đặt đơn mới trong 3 ngày (đến ${restrictedUntilLabel}).`
        : `Đơn hàng #${booking.bookingCode} đã được nhận lại. Phí trễ ${calculatedLateFee.toLocaleString('vi-VN')}đ được trừ vào cọc, tiền cọc dư ${remainingDepositRefund.toLocaleString('vi-VN')}đ đã được hoàn lại.`,
      booking._id,
    );

    return {
      success: true,
      bookingId: booking._id,
      status: BookingStatus.Completed,
      depositTotal,
      lateFeeDeducted: calculatedLateFee,
      depositRefunded: remainingDepositRefund,
      providerCredited: calculatedLateFee,
      refundResult,
    };
  }

  /**
   * 6. Khách B chọn phương án Domino: Đổi mẫu hoặc Hủy hoàn tiền 100%.
   */
  async resolveDominoCustomerChoice(
    bookingId: string,
    user: AuthUser,
    input: { action: 'SELECT_ALTERNATIVE' | 'REFUND_100%'; alternativeProductId?: string },
  ): Promise<any> {
    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng.');

    if (booking.customerId.toString() !== user.sub) {
      throw new ForbiddenException('Chỉ khách hàng đặt đơn mới có quyền chọn phương án này.');
    }

    const now = new Date();
    const domino = (booking as any).dominoRecovery || {};

    if (input.action === 'SELECT_ALTERNATIVE') {
      if (!input.alternativeProductId) {
        throw new BadRequestException('Vui lòng chọn 1 mẫu trang phục thay thế.');
      }
      const altProduct = await this.productModel
        .findById(input.alternativeProductId)
        .lean()
        .exec();
      if (!altProduct) {
        throw new NotFoundException('Mẫu thay thế không tồn tại.');
      }

      domino.status = 'ACCEPTED_ALTERNATIVE';
      domino.selectedAlternativeId = new Types.ObjectId(input.alternativeProductId);
      domino.resolvedAt = now;
      (booking as any).dominoRecovery = domino;

      // Cập nhật tên hoặc thông tin item trong đơn
      if (Array.isArray((booking as any).items) && (booking as any).items[0]) {
        ((booking as any).items[0] as any).productId = new Types.ObjectId(input.alternativeProductId);
        ((booking as any).items[0] as any).name = (altProduct as any).name;
      }

      (booking as any).statusTimeline = (booking as any).statusTimeline || [];
      (booking as any).statusTimeline.push({
        status: booking.status,
        changedAt: now,
        note: `Khách B đã đồng ý đổi sang mẫu thay thế tương đương "${(altProduct as any).name}" qua Domino Recovery.`,
      });
      await booking.save();

      // Báo cho Shop
      for (const provId of booking.providerIds || []) {
        await this.sendNotificationSafe(
          provId.toString(),
          'Khách đã chọn mẫu thay thế (Domino)',
          `Khách hàng đơn #${booking.bookingCode} đã đồng ý đổi sang mẫu "${(altProduct as any).name}". Vui lòng chuẩn bị trang phục này theo lịch hẹn.`,
          booking._id,
        );
      }

      return {
        success: true,
        message: 'Đã đổi sang mẫu trang phục mới thành công!',
        productName: (altProduct as any).name,
      };
    } else {
      // input.action === 'REFUND_100%'
      await this.executeFullRefundForDomino(
        booking,
        'Khách B chủ động chọn hủy đơn và nhận hoàn tiền 100% cọc + phí thuê do trang phục ca trước bị trễ.',
      );
      return {
        success: true,
        message: 'Đã hủy đơn và hoàn trả 100% tiền cọc và phí thuê về tài khoản của bạn.',
      };
    }
  }

  /**
   * 7. Giả lập đơn trễ hạn phục vụ Demo/Test (chỉ hoạt động ngoài production).
   */
  async simulateOverdueForDemo(
    bookingId: string,
    user: AuthUser,
    hoursOverdue = 1,
  ): Promise<any> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Chức năng giả lập chỉ khả dụng ở môi trường thử nghiệm.',
      );
    }
    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng.');

    const isAdmin =
      (user.roles || []).includes('ADMIN') ||
      (user.roles || []).includes('admin');
    const providerModel = this.bookingModel.db.model('Provider');
    const provider = await providerModel
      .findOne({
        _id: { $in: booking.providerIds || [] },
        userId: new Types.ObjectId(user.sub),
      })
      .lean()
      .exec();
    const isDirectProviderId = (booking.providerIds || []).some(
      (p) => p.toString() === user.sub,
    );

    if (!isAdmin && !provider && !isDirectProviderId) {
      throw new ForbiddenException(
        'Chỉ Nhà cung cấp sở hữu đơn hoặc Admin mới có quyền chạy giả lập quá hạn.',
      );
    }

    if (
      [
        BookingStatus.Completed,
        BookingStatus.Cancelled,
        BookingStatus.LostItem,
      ].includes(booking.status)
    ) {
      throw new BadRequestException(
        'Không thể giả lập quá hạn cho đơn đã hoàn tất, đã hủy hoặc đã xác nhận mất đồ.',
      );
    }

    const safeHours = Math.max(0.5, Math.min(72, Number(hoursOverdue) || 1));
    const simulatedEndDate = new Date(Date.now() - safeHours * 60 * 60 * 1000);

    // Cập nhật rentalTo trên các BookingItem của đơn này (vì lịch thuê lưu trên BookingItem)
    await this.bookingItemModel.updateMany(
      { bookingId: booking._id },
      { $set: { rentalTo: simulatedEndDate } },
    );

    if (
      booking.status !== BookingStatus.Overdue &&
      booking.status !== BookingStatus.ReturnPending
    ) {
      booking.status = BookingStatus.PickedUp;
    }
    // Reset các mốc cảnh báo nếu giả lập lại mốc thời gian khác
    const rawTracking = (booking as any).overdueTracking;
    const currentTracking =
      rawTracking && typeof rawTracking.toObject === 'function'
        ? rawTracking.toObject()
        : rawTracking || {};
    (booking as any).overdueTracking = {
      ...currentTracking,
      overdueSince: simulatedEndDate,
      accountRestrictedAt: safeHours >= 2 ? currentTracking.accountRestrictedAt : null,
      lostItemProposedAt: safeHours >= 24 ? currentTracking.lostItemProposedAt : null,
    };
    await booking.save();

    await this.scanAndProcessOverdueBookings(bookingId);
    const fresh = await this.bookingModel.findById(bookingId).lean().exec();

    return {
      success: true,
      bookingId: booking._id,
      status: fresh?.status,
      overdueTracking: (fresh as any)?.overdueTracking || null,
      message: `Đã giả lập trễ ${safeHours} giờ và kích hoạt quét phạt quá hạn.`,
    };
  }

  private async creditProviderWallet(
    booking: any,
    amount: number,
  ): Promise<void> {
    if (!amount || amount <= 0 || !booking?.providerIds?.length) return;
    try {
      const providerModel = this.bookingModel.db.model('Provider');
      await providerModel.updateOne(
        { _id: booking.providerIds[0] },
        {
          $inc: {
            'wallet.availableBalance': amount,
            'wallet.totalEarned': amount,
          },
          $set: { 'wallet.lastUpdatedAt': new Date() },
        },
      );
      this.logger.log(
        `Đã cộng ví Provider ${booking.providerIds[0]}: +${amount}đ từ đối soát quá hạn/mất đồ đơn #${booking.bookingCode}.`,
      );
    } catch (err) {
      this.logger.warn(
        `Lỗi cộng ví Provider cho đơn #${booking.bookingCode}:`,
        err,
      );
    }
  }

  private async settleEscrowForOverdue(
    bookingId: Types.ObjectId,
    targetStatus: string,
  ): Promise<void> {
    try {
      const escrowModel = this.bookingModel.db.model('BookingEscrow');
      await escrowModel.updateOne(
        { bookingId, status: 'HELD' },
        { $set: { status: targetStatus } },
      );
    } catch (err) {
      this.logger.warn('Cập nhật trạng thái Escrow cảnh báo:', err);
    }
  }

  // ===== CÁC HÀM TIỆN ÍCH HỖ TRỢ =====

  private resolveBookingEndDateTime(booking: any, items: any[] = []): Date | null {
    const rentalItem = items.find((it) => it?.rentalTo || it?.endDate) || booking.items?.[0];
    if (rentalItem?.rentalTo) {
      const d = new Date(rentalItem.rentalTo);
      if (!isNaN(d.getTime())) return d;
    }
    if (booking.endDate) {
      const d = new Date(booking.endDate);
      if (!isNaN(d.getTime())) {
        // Nếu chỉ có ngày yyyy-mm-dd mà không có giờ, đặt mặc định 21:00 (giờ đóng cửa tiệm)
        if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
          d.setHours(21, 0, 0, 0);
        }
        return d;
      }
    }
    return null;
  }

  private async executeFullRefundForDomino(
    bBooking: BookingDocument,
    reason: string,
  ): Promise<void> {
    try {
      await this.paymentsService.refundDeposit(bBooking._id.toString());
    } catch (refundErr) {
      this.logger.warn(
        `Hoàn tiền Domino cho đơn #${bBooking.bookingCode} cảnh báo:`,
        refundErr,
      );
    }

    const now = new Date();
    bBooking.status = BookingStatus.Cancelled;
    (bBooking as any).dominoRecovery = {
      ...(bBooking as any).dominoRecovery,
      status: 'REFUNDED',
      actionType: 'FULL_REFUND',
      resolvedAt: now,
    };
    (bBooking as any).statusTimeline = (bBooking as any).statusTimeline || [];
    (bBooking as any).statusTimeline.push({
      status: BookingStatus.Cancelled,
      changedAt: now,
      note: reason,
    });
    await bBooking.save();

    // Thông báo cho Khách B
    await this.sendNotificationSafe(
      bBooking.customerId.toString(),
      'Đã hoàn tiền 100% đơn hàng',
      `Đơn hàng #${bBooking.bookingCode} đã được hủy và hoàn tiền 100% toàn bộ tiền cọc và phí thuê. Sàn TàGo xin lỗi bạn vì sự bất tiện này.`,
      bBooking._id,
    );

    // Thông báo cho Shop
    for (const provId of bBooking.providerIds || []) {
      await this.sendNotificationSafe(
        provId.toString(),
        'Đơn hàng Khách B đã được hủy & hoàn tiền 100%',
        `Đơn hàng #${bBooking.bookingCode} đã tự động hủy và hoàn tiền 100% do sự cố quá hạn của ca trước.`,
        bBooking._id,
      );
    }
  }

  private async restrictUserAccount(userId: string, reason: string): Promise<void> {
    try {
      const userModel = this.bookingModel.db.model('User');
      await userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $set: {
            isRestricted: true,
            restrictedReason: reason,
            restrictedAt: new Date(),
          },
        },
      );
    } catch (err) {
      this.logger.warn(`Lỗi khóa hạn chế tài khoản ${userId}:`, err);
    }
  }

  private async applyPostReturnRestriction(
    userId: string,
    bookingCode: string,
    restrictedUntil: Date,
  ): Promise<void> {
    try {
      const userModel = this.bookingModel.db.model('User');
      const untilLabel = restrictedUntil.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      await userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $set: {
            isRestricted: true,
            restrictedReason: `Tài khoản bị tạm khóa quyền tạo đơn mới trong 3 ngày (đến ${untilLabel}) do trả đơn #${bookingCode} trễ hạn quá 2 giờ.`,
            restrictedAt: new Date(),
            restrictedUntil,
          },
        },
      );
    } catch (err) {
      this.logger.warn(`Lỗi áp dụng hạn chế 3 ngày sau trả đồ cho ${userId}:`, err);
    }
  }

  private async unrestrictUserAccount(userId: string): Promise<void> {
    try {
      const userModel = this.bookingModel.db.model('User');
      await userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $set: {
            isRestricted: false,
            restrictedReason: null,
            restrictedAt: null,
            restrictedUntil: null,
          },
        },
      );
    } catch (err) {
      this.logger.warn(`Lỗi mở khóa tài khoản ${userId}:`, err);
    }
  }

  private async blacklistUserAccount(userId: string, reason: string): Promise<void> {
    try {
      const userModel = this.bookingModel.db.model('User');
      await userModel.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $set: {
            accountStatus: 'BANNED',
            isRestricted: true,
            restrictedReason: reason,
            restrictedAt: new Date(),
          },
        },
      );
    } catch (err) {
      this.logger.warn(`Lỗi đưa tài khoản ${userId} vào Blacklist:`, err);
    }
  }

  private async sendNotificationSafe(
    userId: string,
    title: string,
    message: string,
    bookingId: any,
  ): Promise<void> {
    try {
      await this.notificationsService.createNotification(
        userId,
        title,
        message,
        NotificationType.Booking,
        { bookingId: bookingId.toString() },
      );
    } catch (e) {
      this.logger.warn(`Không thể gửi notification đến ${userId}:`, e);
    }
  }
}
