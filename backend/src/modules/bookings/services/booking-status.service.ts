/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { BookingDocument, BookingStatus } from '../schemas/booking.schema';
import {
  BookingItemType,
  BookingItemDocument,
} from '../schemas/booking-item.schema';
import { Provider } from '../../providers/schemas/provider.schema';
import { BookingScheduleStatus } from '../schemas/booking-schedule.schema';
import {
  InventoryReservation,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { PaymentsService } from '../../payments/services/payments.service';
import { PaymentDocument } from '../../payments/schemas/payment.schema';
import { PromotionsService } from '../../products/services/promotions.service';
import { SettlementCalculationService } from '../../settlements/services/settlement-calculation.service';
const SYSTEM_POLICIES = {
  BOOKING_HOLD_TIMEOUT_MS: 15 * 60 * 1000,
  FREE_CANCEL_LIMIT_HOURS: 24,
  LAST_MIN_GRACE_MINUTES: 30,
  URGENT_GRACE_MINUTES: 15,
  PRODUCT_CANCEL_PENALTY_RATE: 0.2,
  PHOTOGRAPHY_CANCEL_PENALTY_RATE: 0.2,
};
import { BookingsRepository } from '../repositories/bookings.repository';

@Injectable()
export class BookingStatusService {
  constructor(
    private readonly bookingsRepository: BookingsRepository,
    @InjectModel(InventoryReservation.name)
    private readonly inventoryReservationModel: Model<InventoryReservation>,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly promotionsService: PromotionsService,
    private readonly settlementCalc: SettlementCalculationService,
  ) {}

  async cleanupExpiredPendingBookings(
    externalSession?: ClientSession,
  ): Promise<void> {
    const session =
      externalSession || (await this.bookingsRepository.startSession());
    const isInternalSession = !externalSession;

    if (isInternalSession) {
      session.startTransaction();
    }

    try {
      const cutoff = new Date(
        Date.now() - SYSTEM_POLICIES.BOOKING_HOLD_TIMEOUT_MS,
      );

      const expiredBookings = await this.bookingsRepository.findBookings(
        {
          status: BookingStatus.PendingPayment,
          createdAt: { $lt: cutoff },
        },
        undefined,
        session,
      );

      if (expiredBookings.length > 0) {
        const bookingIds = expiredBookings.map((b) => b._id);

        await this.bookingsRepository.updateManyBookings(
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
          session,
        );

        await this.bookingsRepository.updateManySchedules(
          { bookingId: { $in: bookingIds } },
          { $set: { status: BookingScheduleStatus.Cancelled } },
          session,
        );

        await this.inventoryReservationModel
          .updateMany(
            { bookingId: { $in: bookingIds } },
            { $set: { status: ReservationStatus.Cancelled } },
          )
          .session(session);

        for (const bId of bookingIds) {
          await this.promotionsService.releaseVoucher(bId, session);
        }
      }

      if (isInternalSession) {
        await session.commitTransaction();
      }
    } catch (error) {
      if (isInternalSession) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (isInternalSession) {
        await session.endSession();
      }
    }
  }

  async completeBooking(
    bookingIdStr: string,
    userId?: string,
    roles?: string[],
    externalSession?: ClientSession,
  ): Promise<BookingDocument> {
    const session =
      externalSession || (await this.bookingsRepository.startSession());
    const isInternalSession = !externalSession;

    if (isInternalSession) {
      session.startTransaction();
    }

    try {
      const booking = await this.bookingsRepository.findBookingById(
        bookingIdStr,
        session,
      );
      if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng');

      // Authorization check (Customer is allowed to complete their own booking)
      if (userId) {
        const isAdmin = roles?.includes('ADMIN') || roles?.includes('admin');
        const isCustomer = this.getCustomerIdStr(booking) === userId;
        const userProviders = await this.providerModel
          .find({ userId: new Types.ObjectId(userId) })
          .session(session);
        const userProviderIds = userProviders.map((p) => p._id.toString());
        const isProvider = booking.providerIds.some((id) =>
          userProviderIds.includes(id.toString()),
        );

        if (!isAdmin && !isCustomer && !isProvider) {
          throw new ForbiddenException(
            'Bạn không có quyền đánh dấu hoàn thành đơn hàng này.',
          );
        }
      }

      const currentStatus = booking.status;
      if (currentStatus === BookingStatus.Completed) {
        if (isInternalSession) {
          await session.commitTransaction();
        }
        return booking;
      }

      const allowedFrom = [
        BookingStatus.Returned,
        BookingStatus.Disputed,
        BookingStatus.PartiallyRefunded,
        BookingStatus.ComboPhotosApproved,
        BookingStatus.AwaitingReview,
        BookingStatus.PickedUp,
      ];
      if (
        !allowedFrom.includes(currentStatus) &&
        roles?.includes('ADMIN') === false
      ) {
        throw new BadRequestException(
          `Không thể hoàn thành đơn đặt lịch từ trạng thái hiện tại: ${currentStatus}.`,
        );
      }

      booking.status = BookingStatus.Completed;
      booking.statusTimeline.push({
        status: BookingStatus.Completed,
        changedAt: new Date(),
        note: `Đơn hàng hoàn thành ${userId ? 'bởi người dùng' : ''}`,
      });

      await booking.save({ session });

      await this.inventoryReservationModel
        .updateMany(
          { bookingId: booking._id },
          { $set: { status: ReservationStatus.Completed } },
        )
        .session(session);

      try {
        await this.notificationsService.createNotification(
          this.getCustomerIdStr(booking),
          `Đơn hàng hoàn thành`,
          `Đơn hàng ${booking.bookingCode} của bạn đã được đánh dấu hoàn thành. Cảm ơn bạn!`,
          NotificationType.Booking,
          { bookingId: booking._id },
        );
      } catch (e) {
        console.error('Failed to create completeBooking notification:', e);
      }

      await this.paymentsService.settleBooking(bookingIdStr);

      if (isInternalSession) {
        await session.commitTransaction();
      }
      return booking;
    } catch (error) {
      if (isInternalSession) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (isInternalSession) {
        await session.endSession();
      }
    }
  }

  async cancelBooking(
    bookingId: string,
    userIdOrReason: string,
    rolesOrCancelledByUserId?: string | string[],
    maybeReason?: string,
    externalSession?: ClientSession,
  ): Promise<
    | BookingDocument
    | {
        success: boolean;
        booking: BookingDocument;
        isFreeCancel: boolean;
        refundAmount: number;
        penaltyReason: string;
      }
  > {
    const session =
      externalSession || (await this.bookingsRepository.startSession());
    const isInternalSession = !externalSession;

    if (isInternalSession) {
      session.startTransaction();
    }

    try {
      const booking = await this.bookingsRepository.findBookingById(
        bookingId,
        session,
      );
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

      const isCustomer = this.getCustomerIdStr(booking) === userId;
      const userProviders = userId
        ? await this.providerModel
            .find({ userId: new Types.ObjectId(userId) })
            .session(session)
        : [];
      const userProviderIds = userProviders.map((p) => p._id.toString());
      const isProvider = booking.providerIds.some((id) =>
        userProviderIds.includes(id.toString()),
      );
      const isAdmin = roles.includes('ADMIN') || roles.includes('admin');

      if (userId && !isCustomer && !isProvider && !isAdmin) {
        throw new ForbiddenException('Bạn không có quyền hủy đơn đặt lịch này');
      }

      if (booking.status === BookingStatus.Cancelled) {
        if (isInternalSession) {
          await session.commitTransaction();
        }
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

      const now = new Date();
      let isFreeCancel = true;
      let refundAmount = 0;
      let penaltyReason = '';

      if (isCustomer && booking.status !== BookingStatus.PendingPayment) {
        const items = await this.bookingsRepository.findBookingItems(
          { bookingId: booking._id },
          undefined,
          session,
        );
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
            const createdAtDate = new Date(
              (booking as BookingDocument & { createdAt: Date }).createdAt ||
                now,
            );
            const startMinusCreatedHours =
              (earliestStartTime.getTime() - createdAtDate.getTime()) /
              (1000 * 60 * 60);
            if (
              startMinusCreatedHours < SYSTEM_POLICIES.FREE_CANCEL_LIMIT_HOURS
            ) {
              const minsSinceCreation =
                (now.getTime() - createdAtDate.getTime()) / (1000 * 60);
              if (diffInHours >= 2) {
                if (
                  minsSinceCreation <= SYSTEM_POLICIES.LAST_MIN_GRACE_MINUTES
                ) {
                  isFreeCancel = true;
                } else {
                  isFreeCancel = false;
                  penaltyReason = `Đã quá thời gian ân hạn ${SYSTEM_POLICIES.LAST_MIN_GRACE_MINUTES} phút đối với đơn hàng đặt sát giờ (Đặt lúc ${createdAtDate.toLocaleTimeString('vi-VN')}).`;
                }
              } else {
                if (minsSinceCreation <= SYSTEM_POLICIES.URGENT_GRACE_MINUTES) {
                  isFreeCancel = true;
                } else {
                  isFreeCancel = false;
                  penaltyReason = `Đã quá thời gian ân hạn ${SYSTEM_POLICIES.URGENT_GRACE_MINUTES} phút đối với đơn hàng đặt siêu gấp (Đặt lúc ${createdAtDate.toLocaleTimeString('vi-VN')}).`;
                }
              }
            } else {
              isFreeCancel = false;
              penaltyReason = `Hủy đơn trễ (dưới ${SYSTEM_POLICIES.FREE_CANCEL_LIMIT_HOURS} giờ trước giờ hẹn).`;
            }
          }
        }
      }

      if (isProvider) {
        isFreeCancel = true;
        await this.providerModel.findOneAndUpdate(
          { userId: new Types.ObjectId(userId) },
          { $inc: { violationCount: 1 } },
          { session },
        );
      }

      if (booking.status === BookingStatus.PickupPending) {
        isFreeCancel = true;
      }

      // 1. Lấy số tiền khách thực tế đã thanh toán và có thể hoàn (không lấy grandTotal!)
      const refundable =
        booking.status === BookingStatus.PendingPayment
          ? 0
          : await this.paymentsService.getRefundableAmount(
              booking._id,
              session,
            );

      let penaltyAmount = 0;
      refundAmount = 0;

      if (booking.status === BookingStatus.PendingPayment) {
        refundAmount = 0;
        penaltyAmount = 0;
      } else if (isFreeCancel) {
        refundAmount = refundable;
        penaltyAmount = 0;
      } else {
        const items = await this.bookingsRepository.findBookingItems(
          { bookingId: booking._id },
          undefined,
          session,
        );

        for (const item of items) {
          const itemNet = this.settlementCalc.getCustomerPaidServiceAmount(
            item as any,
          );
          const rate =
            item.itemType === BookingItemType.Product
              ? SYSTEM_POLICIES.PRODUCT_CANCEL_PENALTY_RATE
              : SYSTEM_POLICIES.PHOTOGRAPHY_CANCEL_PENALTY_RATE;
          penaltyAmount += Math.round(itemNet * rate);
        }

        // Lấy cọc giữ đồ áo dài (nếu có) để bảo vệ, không phạt vào cọc giữ đồ áo dài
        const rentalItems = items.filter(
          (i) => i.itemType === BookingItemType.Product,
        );
        const rentalDepositTotal = rentalItems.reduce(
          (sum, i) => sum + (i.depositAmount || 0),
          0,
        );

        // Chặn trần phạt tuyệt đối: Không phạt vào cọc giữ đồ và không vượt quá số tiền khách đã thanh toán
        const maxPenaltyAllowed = Math.max(0, refundable - rentalDepositTotal);
        penaltyAmount = Math.min(penaltyAmount, maxPenaltyAllowed);

        refundAmount = Math.max(0, refundable - penaltyAmount);
      }

      // 2. Chuyển trạng thái có điều kiện (Conditional Update) chống Race condition
      const cancelledByObjId =
        userId && Types.ObjectId.isValid(userId)
          ? new Types.ObjectId(userId)
          : null;
      const cancelReason =
        reason ||
        (isProvider
          ? 'Nhà cung cấp chủ động hủy lịch'
          : 'Khách hàng hủy đơn');
      const timelineNote = isFreeCancel
        ? `Đơn hàng đã được hủy thành công. Hoàn tiền 100% (${refundAmount.toLocaleString('vi-VN')}đ).`
        : `Đơn hàng đã bị hủy. Khách bị phạt tiền dịch vụ (${penaltyAmount.toLocaleString('vi-VN')}đ). Hoàn cọc giữ đồ & số dư (${refundAmount.toLocaleString('vi-VN')}đ). Lý do phạt: ${penaltyReason}`;

      const savedBooking = await this.bookingsRepository.model.findOneAndUpdate(
        { _id: booking._id, status: booking.status },
        {
          $set: {
            status: BookingStatus.Cancelled,
            cancellation: {
              cancelledBy: cancelledByObjId,
              reason: cancelReason,
              cancelledAt: now,
              refundAmount,
            },
          },
          $push: {
            statusTimeline: {
              status: BookingStatus.Cancelled,
              changedAt: now,
              note: timelineNote,
              changedBy: cancelledByObjId,
            },
          },
        },
        { new: true, session },
      );

      if (!savedBooking) {
        throw new ConflictException(
          'Trạng thái đơn hàng đã bị thay đổi bởi một tiến trình khác. Vui lòng làm mới trang.',
        );
      }

      // 3. Thông báo cho khách hàng
      try {
        const customerId = this.getCustomerIdStr(booking);
        await this.notificationsService.createNotification(
          customerId,
          `Đơn hàng đã hủy`,
          `Đơn hàng ${booking.bookingCode} của bạn đã bị hủy.${isFreeCancel ? ` Hoàn lại 100% tiền (${refundAmount.toLocaleString('vi-VN')}đ).` : ` Hoàn lại ${refundAmount.toLocaleString('vi-VN')}đ sau khi trừ phí phạt.`} Lý do: ${cancelReason}`,
          NotificationType.Booking,
          { bookingId: booking._id, refundAmount },
        );

        if (booking.providerIds && booking.providerIds.length > 0) {
          const query = this.providerModel.find({ _id: { $in: booking.providerIds } });
          const providers = (typeof (query as any)?.select === 'function' ? await (query as any).select('userId').lean() : await query) || [];

          for (const prov of providers as any[]) {
            if (prov?.userId) {
              await this.notificationsService.createNotification(
                prov.userId.toString(),
                'Đơn hàng đã hủy',
                `Đơn hàng ${booking.bookingCode} đã bị hủy (${isCustomer ? 'Bởi khách hàng' : isProvider ? 'Bởi nhà cung cấp' : 'Bởi hệ thống'}). Lý do: ${cancelReason}`,
                NotificationType.Booking,
                { bookingId: booking._id },
              );
            }
          }
        }
      } catch (e) {
        console.error('Failed to create cancelBooking notification:', e);
      }

      // 4. Cập nhật lịch và giải phóng kho
      await this.bookingsRepository.updateManySchedules(
        { bookingId: booking._id },
        { status: BookingScheduleStatus.Cancelled },
        session,
      );

      await this.inventoryReservationModel
        .updateMany(
          { bookingId: booking._id },
          { $set: { status: ReservationStatus.Cancelled } },
        )
        .session(session);

      // 5. Nhả voucher có điều kiện (Diff 2): chỉ nhả nếu hủy miễn phí (fullRefund)
      await this.promotionsService.releaseVoucher(
        booking._id,
        { fullRefund: isFreeCancel },
        session,
      );

      // 6. Hủy tất cả các Payment Pending thu tiền của booking này
      await this.paymentsService.cancelPendingPaymentsForBooking(
        booking._id,
        session,
      );

      // 7. Tạo Ý định hoàn tiền (Refund Intent) trong transaction nếu có tiền hoàn
      let createdRefundIntents: PaymentDocument[] = [];
      if (refundAmount > 0) {
        createdRefundIntents = await this.paymentsService.createRefundIntents(
          booking._id,
          refundAmount,
          'BOOKING_CANCEL',
          session,
        );
      }

      // 8. Đóng Escrow có điều kiện
      const escrowModel = this.providerModel.db.model('BookingEscrow');
      const escrow = await escrowModel
        .findOne({ bookingId: booking._id })
        .session(session);
      if (escrow && escrow.status === 'HELD') {
        escrow.status =
          refundAmount > 0 ? 'REFUNDED' : 'CANCELLED';
        await escrow.save({ session });
      }

      await this.paymentsService.cancelSettlementsForBooking(
        booking._id.toString(),
      );

      // 9. Commit Transaction (nếu là Internal Session)
      if (isInternalSession) {
        await session.commitTransaction();
      }

      // 10. SAU KHI COMMIT: Kích hoạt thực thi hoàn tiền Async (ngoài transaction)
      if (createdRefundIntents.length > 0) {
        for (const intent of createdRefundIntents) {
          this.paymentsService
            .executeRefundIntent(intent.paymentCode)
            .catch((err) => {
              console.error(
                `Lỗi kích hoạt hoàn tiền async cho ${intent.paymentCode}:`,
                err,
              );
            });
        }
      }

      return Array.isArray(rolesOrCancelledByUserId)
        ? {
            success: true,
            booking: savedBooking,
            isFreeCancel,
            refundAmount,
            penaltyReason,
          }
        : savedBooking;
    } catch (error) {
      if (isInternalSession) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (isInternalSession) {
        await session.endSession();
      }
    }
  }

  async updateBookingStatus(
    bookingIdStr: string,
    newStatus: BookingStatus,
    note?: string,
    userId?: string,
    roles?: string[],
    externalSession?: ClientSession,
  ): Promise<BookingDocument> {
    const session =
      externalSession || (await this.bookingsRepository.startSession());
    const isInternalSession = !externalSession;

    if (isInternalSession) {
      session.startTransaction();
    }

    try {
      const booking = await this.bookingsRepository.findBookingById(
        bookingIdStr,
        session,
      );
      if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng');

      if (userId) {
        const isAdmin = roles?.includes('ADMIN') || roles?.includes('admin');
        const userProviders = await this.providerModel
          .find({ userId: new Types.ObjectId(userId) })
          .session(session);
        const userProviderIds = userProviders.map((p) => p._id.toString());
        const isProvider = booking.providerIds.some((id) =>
          userProviderIds.includes(id.toString()),
        );

        if (!isAdmin && !isProvider) {
          throw new ForbiddenException(
            'Chỉ nhà cung cấp hoặc Admin mới có quyền cập nhật trạng thái đơn hàng này.',
          );
        }
      }

      if (newStatus === BookingStatus.Completed) {
        const result = await this.completeBooking(
          bookingIdStr,
          userId,
          roles,
          session,
        );
        if (isInternalSession) {
          await session.commitTransaction();
        }
        return result;
      }

      if (newStatus === BookingStatus.Cancelled) {
        const result = await this.cancelBooking(
          bookingIdStr,
          userId || 'provider',
          roles || [],
          note || 'Provider hủy đơn',
          session,
        );
        if (isInternalSession) {
          await session.commitTransaction();
        }
        return 'booking' in result ? result.booking : result;
      }

      const currentStatus = booking.status;
      const nextStatus = newStatus as BookingStatus;

      if (currentStatus === nextStatus) {
        if (isInternalSession) {
          await session.commitTransaction();
        }
        return booking;
      }

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
          BookingStatus.Cancelled,
          BookingStatus.Disputed,
        ],
        [BookingStatus.Confirmed]: [
          // Ao Dai rental path
          BookingStatus.PickupPending,
          // Photography path
          BookingStatus.InProgress,
          BookingStatus.Cancelled,
          BookingStatus.Disputed,
        ],
        [BookingStatus.PickupPending]: [
          BookingStatus.PickedUp,
          BookingStatus.Cancelled,
          BookingStatus.InProgress,
          BookingStatus.Disputed,
        ],
        [BookingStatus.PickedUp]: [
          BookingStatus.Returned,
          BookingStatus.ReturnPending,
          BookingStatus.Disputed,
          BookingStatus.InProgress,
        ],
        [BookingStatus.ReturnPending]: [
          BookingStatus.Returned,
          BookingStatus.Disputed,
        ],
        [BookingStatus.Returned]: [
          BookingStatus.Completed,
          BookingStatus.Disputed,
        ],
        // Photography only
        [BookingStatus.InProgress]: [
          BookingStatus.AwaitingReview,
          BookingStatus.Cancelled,
          BookingStatus.Returned,
          BookingStatus.ReturnPending,
          BookingStatus.Disputed,
        ],
        // Photography only: customer confirms or 48h auto-complete
        [BookingStatus.AwaitingReview]: [
          BookingStatus.Completed,
          BookingStatus.ComboPhotosApproved,
          BookingStatus.Disputed,
          BookingStatus.Returned,
          BookingStatus.ReturnPending,
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

      booking.status = nextStatus;
      booking.statusTimeline.push({
        status: newStatus,
        changedAt: new Date(),
        note: note || `Cập nhật trạng thái bởi nhà cung cấp`,
      });

      // Side effect: set awaitingReviewSince timestamp for 48h auto-complete window
      if (nextStatus === BookingStatus.AwaitingReview) {
        booking.awaitingReviewSince = new Date();
        try {
          await this.notificationsService.createNotification(
            this.getCustomerIdStr(booking),
            'Buổi chụp đã hoàn thành – Vui lòng xác nhận',
            `Thợ ảnh đã hoàn thành buổi chụp cho đơn ${booking.bookingCode}. Vui lòng xác nhận trong vòng 48 giờ. Nếu không phản hồi, đơn sẽ tự động hoàn thành.`,
            NotificationType.Booking,
            { bookingId: booking._id },
          );
        } catch (e) {
          console.error('Failed to send AWAITING_REVIEW notification:', e);
        }
      }

      // Side effect: set handoverInitiatedAt for 30m auto-confirm window
      if (nextStatus === BookingStatus.PickupPending) {
        booking.handoverInitiatedAt = new Date();
        try {
          await this.notificationsService.createNotification(
            this.getCustomerIdStr(booking),
            'Đơn hàng bắt đầu bàn giao',
            `Đơn hàng ${booking.bookingCode} của bạn đang được bàn giao tại quầy. Vui lòng kiểm tra và xác nhận nhận đồ trong vòng 30 phút.`,
            NotificationType.Booking,
            { bookingId: booking._id },
          );
        } catch (e) {
          console.error('Failed to send PICKUP_PENDING notification:', e);
        }
      }

      await booking.save({ session });

      if (
        nextStatus === BookingStatus.Returned ||
        nextStatus === BookingStatus.Completed ||
        nextStatus === BookingStatus.Refunded
      ) {
        await this.inventoryReservationModel
          .updateMany(
            { bookingId: booking._id },
            { $set: { status: ReservationStatus.Completed } },
          )
          .session(session);
      }

      const getStatusLabel = (s: BookingStatus): string => {
        switch (s) {
          case BookingStatus.Confirmed:
            return 'Đã xác nhận';
          case BookingStatus.DepositPaid:
            return 'Đã đặt cọc';
          case BookingStatus.PickupPending:
            return 'Đang bàn giao nhận áo';
          case BookingStatus.PickedUp:
            return 'Đang thuê';
          case BookingStatus.InProgress:
            return 'Đang thực hiện';
          case BookingStatus.ReturnPending:
            return 'Đang bàn giao trả áo';
          case BookingStatus.Returned:
            return 'Đã trả áo';
          case BookingStatus.AwaitingReview:
            return 'Chờ xác nhận hoàn tất';
          case BookingStatus.ComboPhotosApproved:
            return 'Đã duyệt ảnh';
          case BookingStatus.Completed:
            return 'Hoàn thành';
          case BookingStatus.Cancelled:
            return 'Đã hủy';
          case BookingStatus.Disputed:
            return 'Tranh chấp';
          default:
            return s;
        }
      };

      try {
        const customerId = this.getCustomerIdStr(booking);
        const statusLabel = getStatusLabel(nextStatus);

        let customerMsg = `Đơn hàng ${booking.bookingCode} của bạn đã chuyển sang trạng thái: ${statusLabel}.`;
        if (nextStatus === BookingStatus.Confirmed) {
          customerMsg = `Nhà cung cấp đã tiếp nhận và xác nhận đơn hàng ${booking.bookingCode}. Vui lòng theo dõi lịch hẹn!`;
        } else if (nextStatus === BookingStatus.Returned) {
          customerMsg = `Đơn hàng ${booking.bookingCode} đã hoàn tất trả đồ. Tiền cọc giữ đồ sẽ được hoàn lại vào tài khoản của bạn.`;
        }

        await this.notificationsService.createNotification(
          customerId,
          `Cập nhật đơn hàng: ${statusLabel}`,
          customerMsg,
          NotificationType.Booking,
          { bookingId: booking._id, newStatus: nextStatus },
        );

        if (booking.providerIds && booking.providerIds.length > 0) {
          const query = this.providerModel.find({ _id: { $in: booking.providerIds } });
          const providers = (typeof (query as any)?.select === 'function' ? await (query as any).select('userId').lean() : await query) || [];

          for (const prov of providers as any[]) {
            if (prov?.userId) {
              await this.notificationsService.createNotification(
                prov.userId.toString(),
                `Cập nhật đơn hàng: ${statusLabel}`,
                `Đơn hàng ${booking.bookingCode} đã chuyển sang trạng thái: ${statusLabel}.`,
                NotificationType.Booking,
                { bookingId: booking._id, newStatus: nextStatus },
              );
            }
          }
        }
      } catch (e) {
        console.error('Failed to create updateBookingStatus notification:', e);
      }

      if (isInternalSession) {
        await session.commitTransaction();
      }

      return booking;
    } catch (error) {
      if (isInternalSession) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (isInternalSession) {
        await session.endSession();
      }
    }
  }

  private getCustomerIdStr(booking: any): string {
    if (!booking?.customerId) return '';
    return (booking.customerId._id || booking.customerId).toString();
  }
}
