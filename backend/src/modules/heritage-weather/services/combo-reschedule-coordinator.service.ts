import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  ProposalChangeType,
  ProposalStatus,
  WeatherProposal,
  WeatherProposalDocument,
} from '../schemas/weather-proposal.schema';
import { Booking, BookingDocument, BookingType } from '../../bookings/schemas/booking.schema';
import { BookingItem, BookingItemDocument, BookingItemType } from '../../bookings/schemas/booking-item.schema';
import {
  BookingSchedule,
  BookingScheduleDocument,
  BookingScheduleType,
} from '../../bookings/schemas/booking-schedule.schema';
import {
  InventoryReservation,
  InventoryReservationDocument,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import { RedisService } from '../../../common/redis/redis.service';

export interface ComboCoordinationResult {
  allDecided: boolean;
  overallStatus: ProposalStatus;
  reason?: string;
  checkoutUrl?: string;
  proposal: WeatherProposalDocument;
}

export interface RentalDateShiftResult {
  newRentalFrom: Date;
  newRentalTo: Date;
  shiftDays: number;
}

@Injectable()
export class ComboRescheduleCoordinatorService {
  private readonly logger = new Logger(ComboRescheduleCoordinatorService.name);

  constructor(
    @InjectModel(WeatherProposal.name)
    private readonly proposalModel: Model<WeatherProposalDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItemDocument>,
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingScheduleDocument>,
    @InjectModel(InventoryReservation.name)
    private readonly inventoryReservationModel: Model<InventoryReservationDocument>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Checks whether a booking is a multi-provider Combo booking.
   */
  isComboBooking(booking: BookingDocument): boolean {
    return (
      booking.bookingType === BookingType.Combo ||
      (booking.providerIds && booking.providerIds.length > 1)
    );
  }

  /**
   * Calculates lockstep date translation for costume rental (Pickup & Return dates)
   * shiftDays = newShootDate - originalShootDate.
   * No additional rental or storage fees charged (BR-COMBO-02).
   */
  calculateRentalDateShift(
    originalShootDate: Date,
    newShootDate: Date,
    originalRentalFrom: Date,
    originalRentalTo: Date,
  ): RentalDateShiftResult {
    const origShootTime = new Date(originalShootDate).setHours(0, 0, 0, 0);
    const newShootTime = new Date(newShootDate).setHours(0, 0, 0, 0);
    const shiftDays = Math.round(
      (newShootTime - origShootTime) / (1000 * 60 * 60 * 24),
    );

    const shiftMs = shiftDays * 24 * 60 * 60 * 1000;
    const newRentalFrom = new Date(new Date(originalRentalFrom).getTime() + shiftMs);
    const newRentalTo = new Date(new Date(originalRentalTo).getTime() + shiftMs);

    return {
      newRentalFrom,
      newRentalTo,
      shiftDays,
    };
  }

  /**
   * Checks costume inventory availability for the shifted rental period
   * across all Product items in this booking.
   */
  async checkCostumeAvailability(
    bookingId: Types.ObjectId | string,
    newRentalFrom: Date,
    newRentalTo: Date,
  ): Promise<{ available: boolean; conflictingItemIds: string[]; reason?: string }> {
    const rentalItems = await this.bookingItemModel.find({
      bookingId: new Types.ObjectId(bookingId.toString()),
      itemType: BookingItemType.Product,
    });

    const conflictingItemIds: string[] = [];

    for (const item of rentalItems) {
      // Find current reservation of this item
      const currentReservation = await this.inventoryReservationModel.findOne({
        bookingItemId: item._id,
        status: {
          $in: [ReservationStatus.TempReserved, ReservationStatus.Confirmed],
        },
      });

      if (!currentReservation) continue;

      // Check if another booking has reserved the same inventory item in the new window
      const conflict = await this.inventoryReservationModel.findOne({
        inventoryItemId: currentReservation.inventoryItemId,
        bookingId: { $ne: new Types.ObjectId(bookingId.toString()) },
        status: {
          $in: [ReservationStatus.TempReserved, ReservationStatus.Confirmed],
        },
        reservedFrom: { $lt: newRentalTo },
        reservedTo: { $gt: newRentalFrom },
      });

      if (conflict) {
        conflictingItemIds.push(item._id.toString());
      }
    }

    if (conflictingItemIds.length > 0) {
      return {
        available: false,
        conflictingItemIds,
        reason:
          'Trang phục cổ phục đã bị khách hàng khác đặt thuê trong khoảng thời gian mới.',
      };
    }

    return {
      available: true,
      conflictingItemIds: [],
    };
  }

  /**
   * Coordinates responses from multiple providers under the All-or-Nothing state machine.
   * If ANY provider rejects -> Entire proposal REJECTED.
   * Only when ALL providers approve -> APPLIED or APPROVED_PENDING_PAYMENT.
   */
  async coordinateComboProposalResponse(
    proposalIdStr: string,
    providerIdStr: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
  ): Promise<ComboCoordinationResult> {
    const proposal = await this.proposalModel.findById(proposalIdStr);
    if (!proposal) {
      throw new NotFoundException('Không tìm thấy đề xuất đổi lịch.');
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException(
        `Đề xuất đang ở trạng thái ${proposal.status}, không thể phản hồi.`,
      );
    }

    // Verify provider authorization
    const isAuthorized = proposal.providerIds.some(
      (pId) => pId.toString() === providerIdStr,
    );
    if (!isAuthorized) {
      throw new ForbiddenException('Bạn không phải đối tác của đơn đặt lịch này.');
    }

    const booking = await this.bookingModel.findById(proposal.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch tương ứng.');
    }

    const now = new Date();

    // 1. ALL-OR-NOTHING: If ANY provider rejects -> Entire proposal is REJECTED!
    if (decision === 'REJECTED') {
      proposal.status = ProposalStatus.REJECTED;
      proposal.providerResponses.set(providerIdStr, {
        decision: 'REJECTED',
        respondedAt: now,
        rejectionReason,
      });

      // Release Redis hold
      if (proposal.temporaryHoldRef) {
        await this.redisService.del(proposal.temporaryHoldRef);
      }

      // Unlock booking
      await this.bookingModel.updateOne(
        { _id: booking._id },
        {
          $set: {
            hasPendingWeatherAction: false,
            activeWeatherProposalId: null,
            disputeDeferredUntil: null,
          },
        },
      );

      await proposal.save();
      this.logger.log(
        `Combo Proposal ${proposal._id} REJECTED under All-or-Nothing rule (Rejected by provider ${providerIdStr}).`,
      );

      return {
        allDecided: true,
        overallStatus: ProposalStatus.REJECTED,
        reason: `Một đối tác đã từ chối: ${rejectionReason || 'Không tiện xếp lịch.'}`,
        proposal,
      };
    }

    // 2. Provider Approved: Record decision
    proposal.providerResponses.set(providerIdStr, {
      decision: 'APPROVED',
      respondedAt: now,
    });

    // Check if ALL providers have approved
    const allApproved = proposal.providerIds.every((pId) => {
      const resp = proposal.providerResponses.get(pId.toString());
      return resp && resp.decision === 'APPROVED';
    });

    if (!allApproved) {
      await proposal.save();
      const remainingCount =
        proposal.providerIds.length - proposal.providerResponses.size;
      this.logger.log(
        `Combo Proposal ${proposal._id}: Provider ${providerIdStr} approved. Waiting for ${remainingCount} remaining provider(s).`,
      );

      return {
        allDecided: false,
        overallStatus: ProposalStatus.PENDING,
        reason: `Đang chờ ${remainingCount} đối tác còn lại phản hồi.`,
        proposal,
      };
    }

    // 3. UNANIMOUS APPROVAL: Check costume availability for shifted dates
    const origShootDate = new Date(proposal.originalSchedule.date);
    const newShootDate = new Date(proposal.proposedSchedule.date);

    // Retrieve rental items
    const rentalItem = await this.bookingItemModel.findOne({
      bookingId: booking._id,
      itemType: BookingItemType.Product,
    });

    if (rentalItem && rentalItem.rentalFrom && rentalItem.rentalTo) {
      const shiftResult = this.calculateRentalDateShift(
        origShootDate,
        newShootDate,
        rentalItem.rentalFrom,
        rentalItem.rentalTo,
      );

      const availability = await this.checkCostumeAvailability(
        booking._id,
        shiftResult.newRentalFrom,
        shiftResult.newRentalTo,
      );

      if (!availability.available) {
        // Costume conflict -> Entire proposal rejected!
        proposal.status = ProposalStatus.REJECTED;
        if (proposal.temporaryHoldRef) {
          await this.redisService.del(proposal.temporaryHoldRef);
        }

        await this.bookingModel.updateOne(
          { _id: booking._id },
          {
            $set: {
              hasPendingWeatherAction: false,
              activeWeatherProposalId: null,
              disputeDeferredUntil: null,
            },
          },
        );

        await proposal.save();
        this.logger.warn(
          `Combo Proposal ${proposal._id} rejected due to costume inventory conflict on shifted dates.`,
        );

        return {
          allDecided: true,
          overallStatus: ProposalStatus.REJECTED,
          reason: availability.reason,
          proposal,
        };
      }
    }

    // 4. All providers approved and inventory is available!
    // Check additionalFeeDue (AD-01)
    if (proposal.additionalFeeDue === 0) {
      await this.applyComboProposalChanges(proposal, booking);
      proposal.status = ProposalStatus.APPLIED;
      proposal.appliedAt = now;

      if (proposal.temporaryHoldRef) {
        await this.redisService.del(proposal.temporaryHoldRef);
      }

      await this.bookingModel.updateOne(
        { _id: booking._id },
        {
          $set: {
            hasPendingWeatherAction: false,
            activeWeatherProposalId: null,
            disputeDeferredUntil: null,
          },
        },
      );

      await proposal.save();
      this.logger.log(
        `Combo Proposal ${proposal._id} UNANIMOUSLY APPROVED & APPLIED (zero additional fee).`,
      );

      return {
        allDecided: true,
        overallStatus: ProposalStatus.APPLIED,
        proposal,
      };
    }

    // Additional fee required (AD-01)
    const oldDateStr = proposal.originalSchedule.date;
    const [sH, sM] = proposal.originalSchedule.timeSlot.split('-')[0].trim().split(':').map(Number);
    const oldStartsAt = new Date(
      `${oldDateStr}T${String(sH || 9).padStart(2, '0')}:${String(sM || 0).padStart(2, '0')}:00+07:00`,
    );

    const fifteenMinsLater = new Date(now.getTime() + 15 * 60 * 1000);
    const paymentExpiresAt = new Date(Math.min(fifteenMinsLater.getTime(), oldStartsAt.getTime()));

    if (paymentExpiresAt.getTime() <= now.getTime()) {
      proposal.status = ProposalStatus.REJECTED;
      if (proposal.temporaryHoldRef) {
        await this.redisService.del(proposal.temporaryHoldRef);
      }
      await this.bookingModel.updateOne(
        { _id: booking._id },
        {
          $set: {
            hasPendingWeatherAction: false,
            activeWeatherProposalId: null,
            disputeDeferredUntil: null,
          },
        },
      );
      await proposal.save();
      throw new BadRequestException(
        'Thời gian trước giờ chụp cũ không còn đủ 15 phút để thanh toán phụ phí.',
      );
    }

    const orderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000));
    const frontendBase = this.configService.get<string>('FRONTEND_URL', 'https://vibe-hue.vn');
    const checkoutUrl = `${frontendBase}/checkout/payment?orderCode=${orderCode}&amount=${proposal.additionalFeeDue}`;

    proposal.status = ProposalStatus.APPROVED_PENDING_PAYMENT;
    proposal.paymentExpiresAt = paymentExpiresAt;
    proposal.additionalPayment = {
      orderCode,
      amount: proposal.additionalFeeDue,
      status: 'PENDING',
      checkoutUrl,
      paymentLinkId: `link_prop_${orderCode}`,
    };

    if (proposal.temporaryHoldRef) {
      const ttlSec = Math.max(60, Math.floor((paymentExpiresAt.getTime() - now.getTime()) / 1000));
      await this.redisService.set(
        proposal.temporaryHoldRef,
        { bookingId: booking._id.toString(), orderCode },
        ttlSec,
      );
    }

    await proposal.save();
    this.logger.log(
      `Combo Proposal ${proposal._id} UNANIMOUSLY APPROVED_PENDING_PAYMENT (orderCode: ${orderCode})`,
    );

    return {
      allDecided: true,
      overallStatus: ProposalStatus.APPROVED_PENDING_PAYMENT,
      checkoutUrl,
      proposal,
    };
  }

  /**
   * Synchronously shifts both photography session and rental period in lockstep.
   */
  async applyComboProposalChanges(
    proposal: WeatherProposalDocument,
    booking: BookingDocument,
  ): Promise<void> {
    const proposed = proposal.proposedSchedule;
    const origShootDate = new Date(proposal.originalSchedule.date);
    const newShootDate = new Date(proposed.date);

    // 1. Shift Photography Package item
    await this.bookingItemModel.updateOne(
      {
        bookingId: booking._id,
        itemType: BookingItemType.PhotographyPackage,
      },
      {
        $set: {
          shootDate: new Date(proposed.date),
          shootTimeSlot: proposed.timeSlot,
          shootLocation: proposed.spotName,
          spotId: proposed.spotId,
        },
      },
    );

    // 2. Shift Photoshoot BookingSchedule
    const [sH, sM] = proposed.timeSlot.split('-')[0].trim().split(':').map(Number);
    const [eH, eM] = proposed.timeSlot.split('-')[1].trim().split(':').map(Number);
    const startsAt = new Date(
      `${proposed.date}T${String(sH || 9).padStart(2, '0')}:${String(sM || 0).padStart(2, '0')}:00+07:00`,
    );
    const endsAt = new Date(
      `${proposed.date}T${String(eH || 11).padStart(2, '0')}:${String(eM || 0).padStart(2, '0')}:00+07:00`,
    );

    await this.bookingScheduleModel.updateOne(
      {
        bookingId: booking._id,
        scheduleType: BookingScheduleType.Photoshoot,
      },
      {
        $set: {
          startsAt,
          endsAt,
          providerLocalDate: proposed.date,
          timeSlot: proposed.timeSlot,
        },
      },
    );

    // 3. Shift all Product (Ao Dai rental) items in lockstep
    const rentalItems = await this.bookingItemModel.find({
      bookingId: booking._id,
      itemType: BookingItemType.Product,
    });

    for (const item of rentalItems) {
      if (item.rentalFrom && item.rentalTo) {
        const shift = this.calculateRentalDateShift(
          origShootDate,
          newShootDate,
          item.rentalFrom,
          item.rentalTo,
        );

        // Update BookingItem rental period
        await this.bookingItemModel.updateOne(
          { _id: item._id },
          {
            $set: {
              rentalFrom: shift.newRentalFrom,
              rentalTo: shift.newRentalTo,
            },
          },
        );

        // Update InventoryReservation dates
        await this.inventoryReservationModel.updateMany(
          {
            bookingItemId: item._id,
            status: {
              $in: [ReservationStatus.TempReserved, ReservationStatus.Confirmed],
            },
          },
          {
            $set: {
              reservedFrom: shift.newRentalFrom,
              reservedTo: shift.newRentalTo,
            },
          },
        );

        // Update BookingSchedule for RentalPeriod, Pickup and Return
        const shiftMs = shift.shiftDays * 24 * 60 * 60 * 1000;
        const rentalSchedules = await this.bookingScheduleModel.find({
          bookingId: booking._id,
          scheduleType: {
            $in: [
              BookingScheduleType.RentalPeriod,
              BookingScheduleType.Pickup,
              BookingScheduleType.Return,
            ],
          },
        });

        for (const s of rentalSchedules) {
          const newStart = s.startsAt ? new Date(s.startsAt.getTime() + shiftMs) : null;
          const newEnd = s.endsAt ? new Date(s.endsAt.getTime() + shiftMs) : null;
          const newLocalDate = s.providerLocalDate
            ? new Date(new Date(s.providerLocalDate).getTime() + shiftMs).toISOString().split('T')[0]
            : null;

          await this.bookingScheduleModel.updateOne(
            { _id: s._id },
            {
              $set: {
                startsAt: newStart,
                endsAt: newEnd,
                providerLocalDate: newLocalDate,
              },
            },
          );
        }
      }
    }

    // 4. Increment weatherRescheduleCount per AD-02:
    // Combo counts as exactly 1 increment when applied successfully
    if (proposal.changeType !== ProposalChangeType.LOCATION_ONLY) {
      await this.bookingModel.updateOne(
        { _id: booking._id },
        {
          $inc: { weatherRescheduleCount: 1 },
        },
      );
    }
  }
}
