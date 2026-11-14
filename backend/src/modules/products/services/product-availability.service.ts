import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductsRepository } from '../repositories/products.repository';
import { InventoryItem } from '../schemas/inventory-item.schema';
import { InventoryReservation, ReservationStatus } from '../schemas/inventory-reservation.schema';
import { ProviderSchedule, ScheduleType, ScheduleCapability } from '../schemas/provider-schedule.schema';
import { Provider } from '../../providers/schemas/provider.schema';
import {
  InventorySlotLease,
  SlotLeaseStatus,
} from '../../bookings/schemas/inventory-slot-lease.schema';
import { TimeSlotEngineService } from '../../bookings/services/time-slot-engine.service';

@Injectable()
export class ProductAvailabilityService {
  constructor(
    private readonly products: ProductsRepository,
    @InjectModel(InventoryItem.name) private readonly inventory: Model<InventoryItem>,
    @InjectModel(InventoryReservation.name) private readonly reservations: Model<InventoryReservation>,
    @InjectModel(ProviderSchedule.name) private readonly providerSchedule: Model<ProviderSchedule>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(InventorySlotLease.name) private readonly leaseModel: Model<InventorySlotLease>,
    private readonly timeEngine: TimeSlotEngineService,
  ) {}

  async check(
    productIdValue: string,
    sizeValue: string,
    color: string,
    fromValue: string,
    toValue: string,
    quantityValue?: number,
    rentalType = 'DAILY',
    startTime?: string,
    endTime?: string,
  ) {
    if (!Types.ObjectId.isValid(productIdValue) || !sizeValue || !color) {
      throw new BadRequestException('Invalid availability query');
    }

    const parseDateLocal = (str: string) => {
      const parts = str.split('T')[0].split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
      return new Date(str);
    };

    const from = parseDateLocal(fromValue);
    const to = parseDateLocal(toValue);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      throw new BadRequestException('Invalid rental period');
    }

    if (rentalType === 'HOURLY') {
      if (!startTime || !endTime) {
        throw new BadRequestException('Start and end time are required');
      }
      this.timeEngine.parseAndValidateTimeSlot(`${startTime}-${endTime}`);
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      from.setHours(sh, sm, 0, 0);
      to.setTime(from.getTime());
      to.setHours(eh, em, 0, 0);
      if (to <= from) throw new BadRequestException('Invalid hourly rental period');
    } else {
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
    }

    const productId = new Types.ObjectId(productIdValue);
    const product = await this.products.findPublicById(productId);
    if (!product) throw new NotFoundException('Product not found');

    // 1. Kiểm tra Lịch làm việc của Provider (ProviderSchedule)
    const providerId = (product.providerId as any)?._id || product.providerId;
    if (providerId) {
      const schedules = await this.providerSchedule
        .find({
          providerId: new Types.ObjectId(providerId.toString()),
          $or: [{ capability: null }, { capability: ScheduleCapability.AodaiRental }],
        })
        .lean()
        .exec();

      if (!schedules || schedules.length === 0) {
        return {
          available: false,
          availableQuantity: 0,
          requestedQuantity: Math.max(1, Math.floor(quantityValue || 1)),
          reason: 'NO_SCHEDULE',
          message: 'Nhà cung cấp chưa thiết lập lịch làm việc. Vui lòng quay lại sau.',
        };
      }

      // Check for off days
      const specificSchedules = schedules.filter((s) => s.scheduleType === ScheduleType.SpecificDate);
      const isOffDay = specificSchedules.some((s) =>
        s.offDays?.some((d) => {
          const offStr = new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          const fromStr = from.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          const toStr = to.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          return offStr === fromStr || offStr === toStr;
        }),
      );

      if (isOffDay) {
        return {
          available: false,
          availableQuantity: 0,
          requestedQuantity: Math.max(1, Math.floor(quantityValue || 1)),
          reason: 'OFF_DAY',
          message: 'Cửa hàng nghỉ làm việc vào ngày đã chọn.',
        };
      }

      // Check recurring working days
      const recurringSchedules = schedules.filter((s) => s.scheduleType === ScheduleType.Recurring);
      if (recurringSchedules.length > 0) {
        const workingDays = new Set(recurringSchedules.map((s) => s.dayOfWeek));
        const fromDay = from.getDay();
        const toDay = to.getDay();
        if (!workingDays.has(fromDay) || !workingDays.has(toDay)) {
          return {
            available: false,
            availableQuantity: 0,
            requestedQuantity: Math.max(1, Math.floor(quantityValue || 1)),
            reason: 'NON_WORKING_DAY',
            message: 'Cửa hàng không mở cửa vào ngày tuần đã chọn.',
          };
        }
      }
    }

    const size = sizeValue.trim().toUpperCase();
    const normalizedColor = color.trim().toUpperCase();
    const requestedQuantity = Math.max(1, Math.floor(quantityValue || 1));

    // Candidate items query:
    // 1. Condition must not be LOCKED or RETIRED
    // 2. Status: AVAILABLE is always a candidate.
    // 3. Status: CLEANING is a candidate ONLY IF operationalAvailableFrom <= from (turnaround will finish before requested start)
    // 4. MAINTENANCE, LOCKED, RETIRED are strictly excluded.
    const items = await this.inventory
      .find({
        productId,
        size,
        color: normalizedColor,
        conditionStatus: { $nin: ['LOCKED', 'RETIRED'] },
        $or: [
          { status: 'AVAILABLE' },
          {
            status: 'CLEANING',
            operationalAvailableFrom: { $ne: null, $lte: from },
          },
        ],
      } as any)
      .exec();

    if (!items.length) {
      return {
        available: false,
        availableQuantity: 0,
        requestedQuantity,
        message: 'Không có trang phục sẵn sàng cho lịch thuê đã chọn.',
      };
    }

    // Check provider's useSlotLeases feature flag
    const providerDoc = providerId
      ? await this.providerModel.findById(providerId).select({ useSlotLeases: 1 }).lean().exec()
      : null;
    const useSlotLeases = !!providerDoc?.useSlotLeases;

    let bookedIds = new Set<string>();

    if (useSlotLeases && rentalType === 'HOURLY' && startTime && endTime) {
      const { startSlotIndex, rentalSlotCount } = this.timeEngine.parseAndValidateTimeSlot(
        `${startTime}-${endTime}`,
      );
      const slotIndices = Array.from(
        { length: rentalSlotCount },
        (_, idx) => startSlotIndex + idx,
      );
      const dateStr = this.timeEngine.getVnParts(from).dateStr;
      const now = new Date();

      const busyLeases = await this.leaseModel
        .find({
          inventoryItemId: { $in: items.map((i) => i._id) },
          dateStr,
          slotIndex: { $in: slotIndices },
          $or: [
            { status: SlotLeaseStatus.Confirmed },
            { status: SlotLeaseStatus.Temp, expiresAt: { $gt: now } },
          ],
        })
        .select({ inventoryItemId: 1 })
        .lean()
        .exec();

      bookedIds = new Set(busyLeases.map((l) => l.inventoryItemId.toString()));
    } else {
      const booked = await this.reservations
        .find({
          inventoryItemId: { $in: items.map((item) => item._id) },
          status: { $in: [ReservationStatus.TempReserved, ReservationStatus.Confirmed] },
          reservedFrom: { $lte: to },
          reservedTo: { $gte: from },
        })
        .select({ inventoryItemId: 1 })
        .lean()
        .exec();

      bookedIds = new Set(booked.map((item) => item.inventoryItemId.toString()));
    }

    const availableQuantity = items.filter((item) => !bookedIds.has(item._id.toString())).length;

    return {
      available: availableQuantity >= requestedQuantity,
      availableQuantity,
      requestedQuantity,
      message: availableQuantity >= requestedQuantity ? undefined : 'Không đủ số lượng cho lịch thuê đã chọn.',
    };
  }
}
