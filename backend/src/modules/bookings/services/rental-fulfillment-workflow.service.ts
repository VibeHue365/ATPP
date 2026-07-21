import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Booking, BookingStatus, BookingType } from '../schemas/booking.schema';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import { RentalEvidenceUpload } from '../schemas/rental-evidence-upload.schema';
import {
  FulfillmentEvidence,
  RentalActorSnapshot,
  RentalInventoryStatus,
  RentalFulfillmentStatus,
} from '../schemas/rental-fulfillment.types';
import { Provider } from '../../providers/schemas/provider.schema';
import { PaymentsService } from '../../payments/services/payments.service';
import { RentalFulfillmentService } from './rental-fulfillment.service';
import { RentalDepositRefundCoordinatorService } from './rental-deposit-refund-coordinator.service';

interface RentalItemAccess {
  bookingId: Types.ObjectId;
  itemId: Types.ObjectId;
  actor: RentalActorSnapshot;
  fulfillmentStatus: RentalFulfillmentStatus;
  bookingStatus: BookingStatus;
}

@Injectable()
export class RentalFulfillmentWorkflowService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name) private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(RentalEvidenceUpload.name)
    private readonly evidenceUploadModel: Model<RentalEvidenceUpload>,
    private readonly rentalFulfillment: RentalFulfillmentService,
    private readonly rentalDepositRefundCoordinator: RentalDepositRefundCoordinatorService,
    private readonly paymentsService: PaymentsService,
  ) { }

  async markReady(bookingId: string, itemId: string, user: AuthUser, note?: string) {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    this.requireOperationalBooking(access.bookingStatus, 'chuẩn bị áo dài');
    const updated = await this.rentalFulfillment.markReady({ itemId: access.itemId.toString(), actor: access.actor, note });
    await this.syncBookingProgress(access.bookingId, access.actor);
    return updated;
  }

  async markPickedUp(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    input: { fileIds: string[]; note?: string; conditionNote?: string },
  ) {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    this.requireOperationalBooking(access.bookingStatus, 'bàn giao áo dài');
    const evidence = await this.resolveEvidence(access, user, input, 'PICKUP');
    const updated = await this.rentalFulfillment.markPickedUp({
      itemId: access.itemId.toString(),
      actor: access.actor,
      evidence,
      note: input.note,
      conditionNote: input.conditionNote,
    });
    await this.syncBookingProgress(access.bookingId, access.actor);
    return updated;
  }

  async markReturned(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    input: { fileIds: string[]; note?: string; conditionNote?: string },
  ) {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    this.requireOperationalBooking(access.bookingStatus, 'nhận lại áo dài');
    const evidence = await this.resolveEvidence(access, user, input, 'RETURN');
    const updated = await this.rentalFulfillment.markReturned({
      itemId: access.itemId.toString(),
      actor: access.actor,
      evidence,
      note: input.note,
      conditionNote: input.conditionNote,
    });
    await this.syncBookingProgress(access.bookingId, access.actor);
    await this.rentalDepositRefundCoordinator.coordinate(access.bookingId.toString());
    return updated;
  }

  async proposeCharge(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    input: { chargeType: 'lateFee' | 'damageFee' | 'compensationAmount'; amount: number; reason: string; note?: string },
  ) {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    if (access.actor.role !== 'PROVIDER') throw new ForbiddenException('Chỉ shop sở hữu áo dài mới được đề xuất phí.');
    return this.rentalFulfillment.proposeCharge({ itemId: access.itemId.toString(), actor: access.actor, ...input });
  }

  async reviewCharge(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    chargeType: 'lateFee' | 'damageFee' | 'compensationAmount',
    approved: boolean,
    note?: string,
  ) {
    if (!['lateFee', 'damageFee', 'compensationAmount'].includes(chargeType)) {
      throw new BadRequestException('Loại phí không hợp lệ.');
    }
    const access = await this.requireAdmin(bookingId, itemId, user);
    return this.rentalFulfillment.reviewCharge({ itemId: access.itemId.toString(), actor: access.actor, chargeType, approved, note });
  }

  async settleDeposit(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    input: { deductAmount: number; inventoryStatus: RentalInventoryStatus; note?: string },
  ) {
    const access = await this.requireAdmin(bookingId, itemId, user);
    const updated = await this.rentalFulfillment.settleDeposit({ itemId: access.itemId.toString(), actor: access.actor, ...input });
    await this.syncPhysicalInventoryAtSettlement(updated as any);
    await this.rentalDepositRefundCoordinator.coordinate(bookingId);
    return updated;
  }
  async markCompleted(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    inventoryStatus: RentalInventoryStatus,
    note?: string,
  ) {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    const updated = await this.rentalFulfillment.markCompleted(
      { itemId: access.itemId.toString(), actor: access.actor, note },
      inventoryStatus,
    );
    await this.syncBookingProgress(access.bookingId, access.actor);
    await this.rentalDepositRefundCoordinator.coordinate(access.bookingId.toString());
    return updated;
  }

  async authorizeEvidenceUpload(bookingId: string, itemId: string, user: AuthUser): Promise<RentalItemAccess> {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    if (![RentalFulfillmentStatus.ReadyForPickup, RentalFulfillmentStatus.PickedUp].includes(access.fulfillmentStatus)) {
      throw new BadRequestException('Chỉ có thể tải ảnh evidence ở bước giao hoặc nhận lại áo dài.');
    }
    this.requireOperationalBooking(access.bookingStatus, 'tải evidence áo dài');
    return access;
  }

  async registerEvidenceUpload(
    access: RentalItemAccess,
    user: AuthUser,
    file: { fileId: string; bucket: string; storageKey: string; mimeType: string },
  ) {
    await this.evidenceUploadModel.create({
      fileId: file.fileId,
      bookingId: access.bookingId,
      bookingItemId: access.itemId,
      uploadedBy: new Types.ObjectId(user.sub),
      bucket: file.bucket,
      storageKey: file.storageKey,
      mimeType: file.mimeType,
    });
    return { fileId: file.fileId, type: 'IMAGE' as const };
  }

  async getEvidenceForViewing(bookingId: string, itemId: string, fileId: string, user: AuthUser) {
    const access = await this.requireAuthorizedViewer(bookingId, itemId, user);
    const evidence = await this.evidenceUploadModel.findOne({
      fileId,
      bookingId: access.bookingId,
      bookingItemId: access.itemId,
    }).lean().exec();
    if (!evidence) throw new NotFoundException('Không tìm thấy ảnh bằng chứng.');
    return evidence;
  }

  private async resolveEvidence(
    access: RentalItemAccess,
    user: AuthUser,
    input: { fileIds: string[]; note?: string },
    purpose: 'PICKUP' | 'RETURN',
  ): Promise<FulfillmentEvidence> {
    const uniqueFileIds = [...new Set(input.fileIds ?? [])];
    if (!uniqueFileIds.length) throw new BadRequestException('Cần có ít nhất một ảnh bằng chứng.');
    if (uniqueFileIds.length > 5) throw new BadRequestException('Tối đa năm ảnh bằng chứng cho mỗi lần bàn giao.');
    const uploads = await this.evidenceUploadModel.find({
      fileId: { $in: uniqueFileIds },
      bookingId: access.bookingId,
      bookingItemId: access.itemId,
      uploadedBy: new Types.ObjectId(user.sub),
      consumedAt: null,
    }).lean().exec();
    if (uploads.length !== uniqueFileIds.length) {
      throw new ForbiddenException('Một hoặc nhiều ảnh bằng chứng không thuộc quyền sử dụng của bạn cho áo dài này, hoặc đã được dùng ở lần bàn giao khác.');
    }
    const consumedAt = new Date();
    const consumption = await this.evidenceUploadModel.updateMany({
      fileId: { $in: uniqueFileIds },
      bookingId: access.bookingId,
      bookingItemId: access.itemId,
      uploadedBy: new Types.ObjectId(user.sub),
      consumedAt: null,
    }, { $set: { consumedAt, consumedFor: purpose } }).exec();
    if (consumption.modifiedCount !== uniqueFileIds.length) {
      throw new ForbiddenException('Evidence đã được dùng bởi thao tác khác. Vui lòng tải ảnh mới.');
    }
    const uploadedAt = consumedAt;
    return {
      files: uniqueFileIds.map((fileId) => ({
        fileId,
        type: 'IMAGE' as const,
        uploadedAt,
        uploadedBy: access.actor,
      })),
      note: input.note?.trim() || undefined,
    };
  }

  /** The operational snapshot and the physical unit are reconciled only after Admin has settled the deposit. */
  private async syncPhysicalInventoryAtSettlement(item: any): Promise<void> {
    const inventoryItemId = item?.inventoryItemId;
    const finalStatus = item?.rentalFulfillment?.inventoryStatus as RentalInventoryStatus | undefined;
    if (!inventoryItemId || !finalStatus) return;
    const inventoryModel = this.bookingItemModel.db.model('InventoryItem');
    const reservationModel = this.bookingItemModel.db.model('InventoryReservation');
    const finalUpdate: Record<string, unknown> = finalStatus === RentalInventoryStatus.Available
      ? { status: 'AVAILABLE' }
      : finalStatus === RentalInventoryStatus.Lost
        ? { status: 'MAINTENANCE', conditionStatus: 'RETIRED' }
        : finalStatus === RentalInventoryStatus.Damaged
          ? { status: 'MAINTENANCE', conditionStatus: 'MINOR_DAMAGE' }
          : { status: 'MAINTENANCE' };
    await inventoryModel.updateOne({ _id: inventoryItemId }, { $set: finalUpdate }).exec();
    await reservationModel.updateOne(
      { bookingItemId: item._id, status: 'CONFIRMED' },
      { $set: { status: 'COMPLETED' } },
    ).exec();
  }
  /** Booking status is a derived aggregate for rental-only bookings; item history remains the source of truth. */
  private async syncBookingProgress(bookingId: Types.ObjectId, actor: RentalActorSnapshot): Promise<void> {
    const booking = await this.bookingModel.findById(bookingId).lean().exec();
    if (!booking || booking.bookingType !== BookingType.AoDaiRental || [BookingStatus.Cancelled, BookingStatus.Refunded, BookingStatus.Disputed].includes(booking.status)) return;

    const items = await this.bookingItemModel.find({
      bookingId,
      itemType: BookingItemType.Product,
      'rentalFulfillment.status': { $exists: true },
    }).lean().exec();
    if (!items.length) return;

    const statuses = items.map((item) => item.rentalFulfillment?.status);
    let nextStatus: BookingStatus | null = null;
    if (statuses.every((status) => status === RentalFulfillmentStatus.Completed)) {
      nextStatus = BookingStatus.Completed;
    } else if (statuses.every((status) => [RentalFulfillmentStatus.Returned, RentalFulfillmentStatus.Completed].includes(status as RentalFulfillmentStatus))) {
      nextStatus = BookingStatus.Returned;
    } else if (statuses.some((status) => [RentalFulfillmentStatus.PickedUp, RentalFulfillmentStatus.Returned].includes(status as RentalFulfillmentStatus))) {
      nextStatus = BookingStatus.PickedUp;
    } else if (statuses.some((status) => status === RentalFulfillmentStatus.ReadyForPickup)) {
      nextStatus = BookingStatus.PickupPending;
    }
    if (!nextStatus || booking.status === nextStatus) return;

    const changed = await this.bookingModel.findOneAndUpdate(
      { _id: bookingId, status: { $nin: [BookingStatus.Cancelled, BookingStatus.Refunded, BookingStatus.Disputed] } },
      {
        $set: { status: nextStatus },
        $push: { statusTimeline: { status: nextStatus, changedAt: new Date(), note: `Đồng bộ từ lifecycle áo dài (${actor.role}).` } },
      },
      { new: true },
    ).lean().exec();
    if (changed && nextStatus === BookingStatus.Completed) await this.paymentsService.settleBooking(bookingId.toString());
  }

  private requireOperationalBooking(status: BookingStatus, action: string): void {
    const allowed = [BookingStatus.DepositPaid, BookingStatus.Confirmed, BookingStatus.PickupPending, BookingStatus.PickedUp, BookingStatus.ReturnPending, BookingStatus.Returned];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Không thể ${action} khi booking đang ở trạng thái ${status}.`);
    }
  }
  private async requireAdmin(bookingId: string, itemId: string, user: AuthUser): Promise<RentalItemAccess> {
    const access = await this.resolveItemAccess(bookingId, itemId, user);
    if (!this.isAdmin(user)) throw new ForbiddenException('Chỉ quản trị viên mới được duyệt phí và tất toán cọc.');
    return { ...access, actor: this.actor(user, 'ADMIN') };
  }
  private async requireProviderOrAdmin(bookingId: string, itemId: string, user: AuthUser): Promise<RentalItemAccess> {
    const access = await this.resolveItemAccess(bookingId, itemId, user);
    if (this.isAdmin(user)) return { ...access, actor: this.actor(user, 'ADMIN') };
    const provider = await this.providerModel.findOne({
      _id: access.providerId,
      userId: new Types.ObjectId(user.sub),
    }).lean().exec();
    if (!provider) throw new ForbiddenException('Chỉ shop sở hữu áo dài hoặc quản trị viên mới được thao tác bàn giao.');
    return { ...access, actor: this.actor(user, 'PROVIDER') };
  }

  private async requireAuthorizedViewer(bookingId: string, itemId: string, user: AuthUser): Promise<RentalItemAccess> {
    const access = await this.resolveItemAccess(bookingId, itemId, user);
    if (this.isAdmin(user)) return { ...access, actor: this.actor(user, 'ADMIN') };
    if (access.customerId.toString() === user.sub) {
      return { ...access, actor: this.actor(user, 'CUSTOMER') };
    }
    const provider = await this.providerModel.findOne({
      _id: access.providerId,
      userId: new Types.ObjectId(user.sub),
    }).lean().exec();
    if (!provider) throw new ForbiddenException('Bạn không có quyền xem ảnh bằng chứng của áo dài này.');
    return { ...access, actor: this.actor(user, 'PROVIDER') };
  }

  private async resolveItemAccess(bookingId: string, itemId: string, user: AuthUser) {
    if (!Types.ObjectId.isValid(bookingId) || !Types.ObjectId.isValid(itemId) || !Types.ObjectId.isValid(user.sub)) {
      throw new BadRequestException('Booking, áo dài hoặc tài khoản không hợp lệ.');
    }
    const bookingObjectId = new Types.ObjectId(bookingId);
    const itemObjectId = new Types.ObjectId(itemId);
    const [booking, item] = await Promise.all([
      this.bookingModel.findById(bookingObjectId).lean().exec(),
      this.bookingItemModel.findOne({ _id: itemObjectId, bookingId: bookingObjectId, itemType: BookingItemType.Product }).lean().exec(),
    ]);
    if (!booking) throw new NotFoundException('Không tìm thấy booking.');
    if (!item) throw new NotFoundException('Không tìm thấy áo dài thuộc booking này.');
    if (!item.rentalFulfillment) throw new BadRequestException('Áo dài này chưa có dữ liệu bàn giao. Booking cũ cần được chuyển đổi dữ liệu trước khi thao tác.');
    return {
      bookingId: bookingObjectId,
      itemId: itemObjectId,
      customerId: booking.customerId,
      providerId: item.providerId,
      actor: this.actor(user, 'SYSTEM'),
      fulfillmentStatus: item.rentalFulfillment.status as RentalFulfillmentStatus,
      bookingStatus: booking.status as BookingStatus,
    };
  }

  private isAdmin(user: AuthUser) {
    return user.roles?.some((role) => role.toUpperCase() === 'ADMIN');
  }

  private actor(user: AuthUser, role: RentalActorSnapshot['role']): RentalActorSnapshot {
    return { id: user.sub, role };
  }
}