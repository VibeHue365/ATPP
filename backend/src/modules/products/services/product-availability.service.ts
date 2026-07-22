import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductsRepository } from '../repositories/products.repository';
import { InventoryItem } from '../schemas/inventory-item.schema';
import { InventoryReservation, ReservationStatus } from '../schemas/inventory-reservation.schema';
import { ProviderSchedule, ScheduleType, ScheduleCapability } from '../schemas/provider-schedule.schema';

@Injectable()
export class ProductAvailabilityService {
  constructor(
    private readonly products: ProductsRepository,
    @InjectModel(InventoryItem.name) private readonly inventory: Model<InventoryItem>,
    @InjectModel(InventoryReservation.name) private readonly reservations: Model<InventoryReservation>,
    @InjectModel(ProviderSchedule.name) private readonly providerSchedule: Model<ProviderSchedule>,
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
    const items = await this.inventory.find({
      productId,
      size,
      color: normalizedColor,
      status: 'AVAILABLE',
      conditionStatus: { $nin: ['LOCKED', 'RETIRED'] },
    } as any);

    const booked = items.length
      ? await this.reservations.find({
          inventoryItemId: { $in: items.map((item) => item._id) },
          status: { $in: [ReservationStatus.TempReserved, ReservationStatus.Confirmed] },
          reservedFrom: { $lte: to },
          reservedTo: { $gte: from },
        })
      : [];

    const bookedIds = new Set(booked.map((item) => item.inventoryItemId.toString()));
    const availableQuantity = items.filter((item) => !bookedIds.has(item._id.toString())).length;

    return {
      available: availableQuantity >= requestedQuantity,
      availableQuantity,
      requestedQuantity,
      message: availableQuantity >= requestedQuantity ? undefined : 'Không đủ số lượng cho lịch thuê đã chọn.',
    };
  }
}
