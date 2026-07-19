import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductsRepository } from '../repositories/products.repository';
import { InventoryItem } from '../schemas/inventory-item.schema';
import { InventoryReservation, ReservationStatus } from '../schemas/inventory-reservation.schema';
@Injectable()
export class ProductAvailabilityService {
  constructor(private readonly products: ProductsRepository, @InjectModel(InventoryItem.name) private readonly inventory: Model<InventoryItem>, @InjectModel(InventoryReservation.name) private readonly reservations: Model<InventoryReservation>) {}
  async check(productIdValue: string, sizeValue: string, color: string, fromValue: string, toValue: string, quantityValue?: number, rentalType = 'DAILY', startTime?: string, endTime?: string) {
    if (!Types.ObjectId.isValid(productIdValue) || !sizeValue || !color) throw new BadRequestException('Invalid availability query');
    const from = new Date(fromValue); const to = new Date(toValue);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) throw new BadRequestException('Invalid rental period');
    if (rentalType === 'HOURLY') { if (!startTime || !endTime) throw new BadRequestException('Start and end time are required'); const [sh, sm] = startTime.split(':').map(Number); const [eh, em] = endTime.split(':').map(Number); from.setHours(sh, sm, 0, 0); to.setTime(from.getTime()); to.setHours(eh, em, 0, 0); if (to <= from) throw new BadRequestException('Invalid hourly rental period'); } else { from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999); }
    const productId = new Types.ObjectId(productIdValue);
    if (!await this.products.findPublicById(productId)) throw new NotFoundException('Product not found');
    const size = sizeValue.trim().toUpperCase(); const normalizedColor = color.trim().toUpperCase(); const requestedQuantity = Math.max(1, Math.floor(quantityValue || 1));
    const items = await this.inventory.find({ productId, size, color: normalizedColor, conditionStatus: { $nin: ['LOCKED', 'RETIRED'] } } as any);
    const booked = items.length ? await this.reservations.find({ inventoryItemId: { $in: items.map((item) => item._id) }, status: { $in: [ReservationStatus.TempReserved, ReservationStatus.Confirmed] }, reservedFrom: { $lte: to }, reservedTo: { $gte: from } }) : [];
    const bookedIds = new Set(booked.map((item) => item.inventoryItemId.toString()));
    const availableQuantity = items.filter((item) => !bookedIds.has(item._id.toString())).length;
    return { available: availableQuantity >= requestedQuantity, availableQuantity, requestedQuantity };
  }
}
