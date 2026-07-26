import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import { createRentalFulfillment } from '../schemas/rental-fulfillment.types';

@Controller(['admin/rental-migration', 'api/admin/rental-migration'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminRentalMigrationController {
  constructor(@InjectModel(BookingItem.name) private readonly bookingItemModel: Model<BookingItem>) {}

  @Get('report')
  async report() {
    const [totalLegacy, migrated, needsReview, legacyReadOnly] = await Promise.all([
      this.bookingItemModel.countDocuments({ itemType: BookingItemType.Product, $or: [{ rentalFulfillment: null }, { rentalFulfillment: { $exists: false } }] } as any),
      this.bookingItemModel.countDocuments({ 'rentalMigration.status': 'MIGRATED' }),
      this.bookingItemModel.countDocuments({ 'rentalMigration.status': 'NEEDS_ADMIN_REVIEW' }),
      this.bookingItemModel.countDocuments({ 'rentalMigration.status': 'LEGACY_READ_ONLY' }),
    ]);
    return { totalLegacy, migrated, needsReview, legacyReadOnly };
  }

  @Get('review')
  async review(@Query('page') pageValue?: string, @Query('limit') limitValue?: string) {
    const page = Math.max(Number(pageValue) || 1, 1);
    const limit = Math.min(Math.max(Number(limitValue) || 20, 1), 100);
    const filter: any = { 'rentalMigration.status': 'NEEDS_ADMIN_REVIEW' };
    const [total, items] = await Promise.all([
      this.bookingItemModel.countDocuments(filter),
      this.bookingItemModel.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).populate('bookingId', 'bookingCode status').populate('productId', 'name').lean().exec(),
    ]);
    return { total, page, limit, items };
  }

  @Post('review/:itemId/resolve-pickup-return-location')
  async resolvePickupReturnLocation(
    @Param('itemId') itemId: string,
    @CurrentUser() admin: AuthUser,
    @Body() body: { address: string; latitude: number; longitude: number },
  ) {
    if (!Types.ObjectId.isValid(itemId)) throw new BadRequestException('Booking item không hợp lệ.');
    const address = body?.address?.trim();
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    if (!address || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new BadRequestException('Cần nhập địa chỉ và tọa độ nhận/trả hợp lệ.');
    }
    const objectId = new Types.ObjectId(itemId);
    const item = await this.bookingItemModel.findOne({
      _id: objectId,
      itemType: BookingItemType.Product,
      quantity: 1,
      rentalFulfillment: null,
      'rentalMigration.status': 'NEEDS_ADMIN_REVIEW',
      'rentalMigration.reasons': 'MISSING_PICKUP_RETURN_SNAPSHOT',
    }).lean().exec();
    if (!item?.rentalTo || Number.isNaN(new Date(item.rentalTo).getTime())) {
      throw new BadRequestException('Item không còn đủ điều kiện để hoàn tất migration tự động.');
    }
    const reservation: any = await this.bookingItemModel.db.model('InventoryReservation').findOne({
      bookingItemId: objectId,
      status: { $in: ['TEMP_RESERVED', 'CONFIRMED'] },
    }).lean().exec();
    if (!reservation?.inventoryItemId) throw new BadRequestException('Không tìm thấy physical inventory reservation hợp lệ cho item này.');
    const fulfillment = createRentalFulfillment(new Date(item.rentalTo), item.rentalFrom ? new Date(item.rentalFrom) : null);
    fulfillment.history = [{
      action: 'MIGRATED_FROM_LEGACY',
      actor: { id: admin.sub, role: 'ADMIN' },
      occurredAt: new Date(),
      note: 'Admin bổ sung snapshot điểm nhận/trả cho booking legacy.',
    }];
    const updated = await this.bookingItemModel.findOneAndUpdate(
      { _id: objectId, rentalFulfillment: null, 'rentalMigration.status': 'NEEDS_ADMIN_REVIEW', 'rentalMigration.reasons': 'MISSING_PICKUP_RETURN_SNAPSHOT' },
      { $set: {
        inventoryItemId: reservation.inventoryItemId,
        pickupReturnLocationSnapshot: { address, geo: { type: 'Point', coordinates: [longitude, latitude] } },
        rentalFulfillment: fulfillment,
        rentalMigration: { version: 1, status: 'MIGRATED', reasons: [], migratedAt: new Date() },
      } },
      { new: true },
    ).lean().exec();
    if (!updated) throw new BadRequestException('Item đã được xử lý bởi thao tác khác. Vui lòng tải lại.');
    return updated;
  }

  @Post('review/:itemId/keep-legacy-read-only')
  async keepLegacyReadOnly(@Param('itemId') itemId: string, @CurrentUser() admin: AuthUser) {
    if (!Types.ObjectId.isValid(itemId)) throw new BadRequestException('Booking item không hợp lệ.');
    const updated = await this.bookingItemModel.findOneAndUpdate(
      { _id: new Types.ObjectId(itemId), 'rentalMigration.status': 'NEEDS_ADMIN_REVIEW' },
      { $set: { rentalMigration: { version: 1, status: 'LEGACY_READ_ONLY', reasons: ['ADMIN_CONFIRMED_LEGACY_READ_ONLY'], migratedAt: new Date() } } },
      { new: true },
    ).lean().exec();
    if (!updated) throw new BadRequestException('Item đã được xử lý bởi thao tác khác. Vui lòng tải lại.');
    return updated;
  }
}