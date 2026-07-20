/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { BookingStatus } from '../schemas/booking.schema';
import { BookingItemType } from '../schemas/booking-item.schema';
import {
  BookingScheduleType,
  BookingScheduleStatus,
} from '../schemas/booking-schedule.schema';
import {
  InventoryReservation,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { BookingsRepository } from '../repositories/bookings.repository';

@Injectable()
export class BookingRescheduleService {
  constructor(
    private readonly bookingsRepository: BookingsRepository,
    @InjectModel(InventoryReservation.name)
    private readonly inventoryReservationModel: Model<InventoryReservation>,
    private readonly notificationsService: NotificationsService,
  ) {}

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

  private async getBusySchedulesForProduct(
    productId: string,
    session?: ClientSession,
  ): Promise<{
    bookedDates: string[];
    bookedSlots: { date: string; timeSlot: string; bookingItemId?: string }[];
  }> {
    const activeBookings = await this.bookingsRepository.findBookings(
      {
        status: {
          $nin: [
            BookingStatus.Cancelled,
            BookingStatus.Completed,
            BookingStatus.Returned,
            BookingStatus.Refunded,
          ],
        },
      },
      undefined,
      session,
    );
    const activeBookingIds = activeBookings.map((b) => b._id);

    const items = await this.bookingsRepository.findBookingItems(
      {
        bookingId: { $in: activeBookingIds },
        productId: new Types.ObjectId(productId),
      },
      undefined,
      session,
    );

    const bookedDates = new Set<string>();
    const bookedSlots: {
      date: string;
      timeSlot: string;
      bookingItemId?: string;
    }[] = [];

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
          bookedSlots.push({
            date: dateStr,
            timeSlot: item.shootTimeSlot,
            bookingItemId: item._id.toString(),
          });
        }
      }
    });

    return {
      bookedDates: Array.from(bookedDates),
      bookedSlots,
    };
  }

  private async getBusySchedulesForProvider(
    providerId: string,
    session?: ClientSession,
  ): Promise<{
    bookedDates: string[];
    bookedSlots: { date: string; timeSlot: string; bookingItemId?: string }[];
  }> {
    const activeBookings = await this.bookingsRepository.findBookings(
      {
        status: {
          $nin: [
            BookingStatus.Cancelled,
            BookingStatus.Completed,
            BookingStatus.Returned,
            BookingStatus.Refunded,
          ],
        },
      },
      undefined,
      session,
    );
    const activeBookingIds = activeBookings.map((b) => b._id);

    const items = await this.bookingsRepository.findBookingItems(
      {
        bookingId: { $in: activeBookingIds },
        providerId: new Types.ObjectId(providerId),
        itemType: BookingItemType.PhotographyPackage,
      },
      undefined,
      session,
    );

    const bookedDates = new Set<string>();
    const bookedSlots: {
      date: string;
      timeSlot: string;
      bookingItemId?: string;
    }[] = [];

    items.forEach((item) => {
      if (item.shootDate && item.shootTimeSlot) {
        const dateStr = new Date(item.shootDate).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        bookedSlots.push({
          date: dateStr,
          timeSlot: item.shootTimeSlot,
          bookingItemId: item._id.toString(),
        });
      }
    });

    return {
      bookedDates: Array.from(bookedDates),
      bookedSlots,
    };
  }

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
    externalSession?: ClientSession,
  ): Promise<Record<string, any>> {
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
      if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng');

      if (this.getCustomerIdStr(booking) !== userId) {
        throw new BadRequestException(
          'Bạn không có quyền đổi lịch đơn hàng này',
        );
      }

      const allowedStatuses = [
        BookingStatus.Confirmed,
        BookingStatus.DepositPaid,
      ];
      if (!allowedStatuses.includes(booking.status)) {
        throw new BadRequestException(
          `Chỉ có thể đổi lịch khi đơn ở trạng thái Đã xác nhận hoặc Đã cọc. Trạng thái hiện tại: ${booking.status}`,
        );
      }

      const bookingItem = await this.bookingsRepository.findOneBookingItem(
        {
          _id: new Types.ObjectId(dto.itemId),
          bookingId: new Types.ObjectId(bookingId),
        },
        session,
      );
      if (!bookingItem)
        throw new NotFoundException('Không tìm thấy mục đặt lịch');

      const itemType = bookingItem.itemType;
      let currentStart: Date | null = null;
      if (itemType === BookingItemType.Product) {
        currentStart = bookingItem.rentalFrom || null;
      } else {
        currentStart = bookingItem.shootDate || null;
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

      const todayStr = new Date().toISOString().split('T')[0];

      if (itemType === BookingItemType.Product) {
        const isHourly = bookingItem.rentalType === 'HOURLY';

        if (isHourly) {
          const newShootDate = dto.newShootDate || dto.newRentalFrom;
          const newShootTimeSlot = dto.newShootTimeSlot;
          if (!newShootDate || !newShootTimeSlot) {
            throw new BadRequestException('Yêu cầu ngày thuê và khung giờ mới');
          }
          if (newShootDate < todayStr) {
            throw new BadRequestException(
              'Ngày thuê mới không thể nằm trong quá khứ',
            );
          }

          const busySchedules = await this.getBusySchedulesForProduct(
            bookingItem.productId!.toString(),
            session,
          );
          const isSlotConflict = busySchedules.bookedSlots.some(
            (slot) =>
              slot.date === newShootDate &&
              slot.timeSlot &&
              this.isTimeSlotOverlap(slot.timeSlot, newShootTimeSlot) &&
              slot.bookingItemId?.toString() !== dto.itemId,
          );

          if (isSlotConflict) {
            throw new BadRequestException(
              `Sản phẩm đã được đặt thuê vào ngày ${newShootDate} khung giờ ${newShootTimeSlot}. Vui lòng chọn khung giờ khác.`,
            );
          }

          const existingReservation = await this.inventoryReservationModel
            .findOne({
              bookingId: new Types.ObjectId(bookingId),
              bookingItemId: new Types.ObjectId(dto.itemId),
              status: {
                $in: [
                  ReservationStatus.Confirmed,
                  ReservationStatus.TempReserved,
                ],
              },
            })
            .session(session);

          if (existingReservation) {
            const newFrom = new Date(newShootDate);
            newFrom.setHours(0, 0, 0, 0);
            const newTo = new Date(newShootDate);
            newTo.setHours(23, 59, 59, 999);

            const conflict = await this.inventoryReservationModel
              .findOne({
                inventoryItemId: existingReservation.inventoryItemId,
                _id: { $ne: existingReservation._id },
                status: {
                  $in: [
                    ReservationStatus.Confirmed,
                    ReservationStatus.TempReserved,
                  ],
                },
                $or: [
                  {
                    reservedFrom: { $lte: newTo },
                    reservedTo: { $gte: newFrom },
                  },
                ],
              })
              .session(session);

            if (conflict) {
              throw new BadRequestException(
                `Sản phẩm đã hết hàng trong ngày này. Vui lòng chọn ngày khác.`,
              );
            }

            await this.inventoryReservationModel
              .updateOne(
                { _id: existingReservation._id },
                { reservedFrom: newFrom, reservedTo: newTo },
              )
              .session(session);
          }

          await this.bookingsRepository.updateBookingItem(
            dto.itemId,
            {
              rentalFrom: new Date(newShootDate),
              rentalTo: new Date(newShootDate),
              startDate: newShootDate,
              endDate: newShootDate,
              shootDate: new Date(newShootDate),
              shootTimeSlot: newShootTimeSlot,
            },
            session,
          );

          await this.bookingsRepository.updateManySchedules(
            {
              bookingId: new Types.ObjectId(bookingId),
              bookingItemId: new Types.ObjectId(dto.itemId),
            },
            {
              status: BookingScheduleStatus.Scheduled,
              scheduledDate: new Date(newShootDate),
              timeSlot: newShootTimeSlot,
            },
            session,
          );
        } else {
          // DAILY RENTAL
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

          const existingReservation = await this.inventoryReservationModel
            .findOne({
              bookingId: new Types.ObjectId(bookingId),
              bookingItemId: new Types.ObjectId(dto.itemId),
              status: {
                $in: [
                  ReservationStatus.Confirmed,
                  ReservationStatus.TempReserved,
                ],
              },
            })
            .session(session);

          if (existingReservation) {
            const newFrom = new Date(dto.newRentalFrom);
            newFrom.setHours(0, 0, 0, 0);
            const newTo = new Date(dto.newRentalTo);
            newTo.setHours(23, 59, 59, 999);

            const conflict = await this.inventoryReservationModel
              .findOne({
                inventoryItemId: existingReservation.inventoryItemId,
                _id: { $ne: existingReservation._id },
                status: {
                  $in: [
                    ReservationStatus.Confirmed,
                    ReservationStatus.TempReserved,
                  ],
                },
                $or: [
                  {
                    reservedFrom: { $lte: newTo },
                    reservedTo: { $gte: newFrom },
                  },
                ],
              })
              .session(session);

            if (conflict) {
              throw new BadRequestException(
                `Sản phẩm đã được đặt lịch trong khoảng thời gian này. Vui lòng chọn ngày khác.`,
              );
            }

            await this.inventoryReservationModel
              .updateOne(
                { _id: existingReservation._id },
                { reservedFrom: newFrom, reservedTo: newTo },
              )
              .session(session);
          }

          await this.bookingsRepository.updateBookingItem(
            dto.itemId,
            {
              rentalFrom: new Date(dto.newRentalFrom),
              rentalTo: new Date(dto.newRentalTo),
              startDate: dto.newRentalFrom,
              endDate: dto.newRentalTo,
            },
            session,
          );

          await this.bookingsRepository.deleteManySchedules(
            {
              bookingId: new Types.ObjectId(bookingId),
              bookingItemId: new Types.ObjectId(dto.itemId),
            },
            session,
          );

          const start = new Date(dto.newRentalFrom);
          const end = new Date(dto.newRentalTo);
          const current = new Date(start);
          while (current <= end) {
            await this.bookingsRepository.createSchedule(
              {
                bookingId: new Types.ObjectId(bookingId),
                bookingItemId: new Types.ObjectId(dto.itemId),
                scheduleType: BookingScheduleType.RentalPeriod,
                scheduledDate: new Date(current),
                timeSlot: null,
                status: BookingScheduleStatus.Scheduled,
              },
              session,
            );
            current.setDate(current.getDate() + 1);
          }
        }
      } else if (itemType === BookingItemType.PhotographyPackage) {
        if (!dto.newShootDate) {
          throw new BadRequestException('Yêu cầu ngày chụp mới');
        }
        if (dto.newShootDate < todayStr) {
          throw new BadRequestException(
            'Ngày chụp mới không thể nằm trong quá khứ',
          );
        }

        const photographerId = bookingItem.providerId.toString();
        if (photographerId) {
          const busySchedules = await this.getBusySchedulesForProvider(
            photographerId,
            session,
          );
          const isSlotConflict =
            dto.newShootTimeSlot &&
            busySchedules.bookedSlots.some(
              (slot) =>
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

        await this.bookingsRepository.updateBookingItem(
          dto.itemId,
          {
            shootDate: dto.newShootDate,
            ...(dto.newShootTimeSlot
              ? { shootTimeSlot: dto.newShootTimeSlot }
              : {}),
          },
          session,
        );

        await this.bookingsRepository.updateManySchedules(
          {
            bookingId: new Types.ObjectId(bookingId),
            bookingItemId: new Types.ObjectId(dto.itemId),
          },
          {
            scheduledDate: new Date(dto.newShootDate),
            timeSlot: dto.newShootTimeSlot || null,
            status: BookingScheduleStatus.Scheduled,
          },
          session,
        );
      }

      try {
        await this.notificationsService.createNotification(
          this.getCustomerIdStr(booking),
          'Đổi lịch thành công',
          `Đơn hàng ${booking.bookingCode} đã được đổi lịch thành công.`,
          NotificationType.Booking,
          { bookingId: booking._id },
        );
      } catch {
        /* ignore notification error */
      }

      if (isInternalSession) {
        await session.commitTransaction();
      }

      return { message: 'Đổi lịch thành công', bookingId };
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
