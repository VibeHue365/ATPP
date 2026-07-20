import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
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
        const isCustomer = booking.customerId.toString() === userId;
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
      ];
      if (
        !allowedFrom.includes(currentStatus) &&
        roles?.includes('ADMIN') === false
      ) {
        throw new BadRequestException(
          `Không thể hoàn thành đơn đặt lịch từ trạng thái hiện tại: ${currentStatus}. Đơn hàng cần được trả áo (RETURNED) hoặc giải quyết tranh chấp (DISPUTED).`,
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
          booking.customerId.toString(),
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

      const isCustomer = booking.customerId.toString() === userId;
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

      let penaltyAmount = 0;
      if (isFreeCancel) {
        refundAmount = booking.pricingSummary?.grandTotal || 0;
      } else {
        const items = await this.bookingsRepository.findBookingItems(
          { bookingId: booking._id },
          undefined,
          session,
        );
        for (const item of items) {
          if (item.itemType === BookingItemType.Product) {
            penaltyAmount +=
              Math.round(
                item.unitPrice * SYSTEM_POLICIES.PRODUCT_CANCEL_PENALTY_RATE,
              ) * item.quantity;
          } else {
            penaltyAmount +=
              Math.round(
                item.unitPrice *
                  SYSTEM_POLICIES.PHOTOGRAPHY_CANCEL_PENALTY_RATE,
              ) * item.quantity;
          }
        }

        penaltyAmount = Math.min(
          penaltyAmount,
          booking.pricingSummary.subTotal,
        );

        const providerItems = new Map<string, BookingItemDocument[]>();
        for (const item of items) {
          const pId = item.providerId.toString();
          if (!providerItems.has(pId)) providerItems.set(pId, []);
          providerItems.get(pId)!.push(item);
        }

        for (const [pIdStr, pItems] of providerItems.entries()) {
          let providerPenalty = 0;
          for (const item of pItems) {
            if (item.itemType === BookingItemType.Product) {
              providerPenalty +=
                Math.round(
                  item.unitPrice * SYSTEM_POLICIES.PRODUCT_CANCEL_PENALTY_RATE,
                ) * item.quantity;
            } else {
              providerPenalty +=
                Math.round(
                  item.unitPrice *
                    SYSTEM_POLICIES.PHOTOGRAPHY_CANCEL_PENALTY_RATE,
                ) * item.quantity;
            }
          }

          if (providerPenalty > 0) {
            const provider = await this.providerModel
              .findById(new Types.ObjectId(pIdStr))
              .session(session);
            if (provider) {
              let bankName = 'VietinBank';
              let accountNumber = '1029384756';
              let accountHolder = 'PROVIDER STUDIO';

              if (
                provider.paymentAccounts &&
                provider.paymentAccounts.length > 0
              ) {
                const activeAccount =
                  provider.paymentAccounts.find((a) => a.isDefault) ||
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

        refundAmount = Math.max(
          (booking.pricingSummary?.grandTotal || 0) - penaltyAmount,
          0,
        );
      }

      if (booking.status === BookingStatus.PendingPayment) {
        refundAmount = 0;
      }

      booking.status = BookingStatus.Cancelled;
      booking.cancellation = {
        cancelledBy: new Types.ObjectId(userId || undefined),
        reason:
          reason ||
          (isProvider
            ? 'Nhà cung cấp chủ động hủy lịch'
            : 'Khách hàng hủy đơn'),
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

      const savedBooking = await booking.save({ session });

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

      if (refundAmount > 0) {
        await this.paymentsService.refundDeposit(
          booking._id.toString(),
          refundAmount,
        );
      }

      await this.paymentsService.cancelSettlementsForBooking(
        booking._id.toString(),
      );

      if (isInternalSession) {
        await session.commitTransaction();
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
        ],
        [BookingStatus.Confirmed]: [
          // Ao Dai rental path
          BookingStatus.PickupPending,
          // Photography path
          BookingStatus.InProgress,
          BookingStatus.Cancelled,
        ],
        [BookingStatus.PickupPending]: [
          BookingStatus.PickedUp,
          BookingStatus.Cancelled,
          BookingStatus.InProgress,
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
        ],
        // Photography only: customer confirms or 48h auto-complete
        [BookingStatus.AwaitingReview]: [
          BookingStatus.Completed,
          BookingStatus.Disputed,
          BookingStatus.Returned,
          BookingStatus.ReturnPending,
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
            booking.customerId.toString(),
            'Buổi chụp đã hoàn thành – Vui lòng xác nhận',
            `Thợ ảnh đã hoàn thành buổi chụp cho đơn ${booking.bookingCode}. Vui lòng xác nhận trong vòng 48 giờ. Nếu không phản hồi, đơn sẽ tự động hoàn thành.`,
            NotificationType.Booking,
            { bookingId: booking._id },
          );
        } catch (e) {
          console.error('Failed to send AWAITING_REVIEW notification:', e);
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
}
