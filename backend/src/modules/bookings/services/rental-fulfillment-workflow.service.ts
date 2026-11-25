import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
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
  RentalIssueStatus,
} from '../schemas/rental-fulfillment.types';
import { Provider } from '../../providers/schemas/provider.schema';
import {
  ProviderSchedule,
  ScheduleType,
  ScheduleCapability,
} from '../../products/schemas/provider-schedule.schema';
import { PaymentsService } from '../../payments/services/payments.service';
import { RentalFulfillmentService } from './rental-fulfillment.service';
import { RentalDepositRefundCoordinatorService } from './rental-deposit-refund-coordinator.service';
import { InventorySlotLeaseService } from './inventory-slot-lease.service';
import {
  ShopScheduleConfig,
  TimeSlotEngineService,
} from './time-slot-engine.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  assertRentalEvidenceUploadWindow,
  RENTAL_EVIDENCE_RETENTION_MS,
  RENTAL_EVIDENCE_UNATTACHED_TTL_MS,
} from './rental-evidence-policy';

interface RentalItemAccess {
  bookingId: Types.ObjectId;
  itemId: Types.ObjectId;
  actor: RentalActorSnapshot;
  fulfillmentStatus: RentalFulfillmentStatus;
  bookingStatus: BookingStatus;
  uploadPurpose?: 'PICKUP' | 'RETURN';
  pickupDueAt?: Date | null;
  returnDueAt?: Date | null;
}

@Injectable()
export class RentalFulfillmentWorkflowService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(RentalEvidenceUpload.name)
    private readonly evidenceUploadModel: Model<RentalEvidenceUpload>,
    private readonly rentalFulfillment: RentalFulfillmentService,
    private readonly rentalDepositRefundCoordinator: RentalDepositRefundCoordinatorService,
    private readonly paymentsService: PaymentsService,
    @Optional()
    private readonly slotLeaseService?: InventorySlotLeaseService,
    @Optional()
    private readonly timeEngineService?: TimeSlotEngineService,
    @Optional()
    @InjectModel(ProviderSchedule.name)
    private readonly providerScheduleModel?: Model<ProviderSchedule>,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  private async getProviderScheduleConfig(
    providerId: Types.ObjectId,
  ): Promise<ShopScheduleConfig | undefined> {
    if (!this.providerScheduleModel) return undefined;
    try {
      const schedules = await this.providerScheduleModel
        .find({
          providerId,
          $or: [
            { capability: null },
            { capability: ScheduleCapability.AodaiRental },
          ],
        })
        .lean()
        .exec();

      if (!schedules || schedules.length === 0) return undefined;

      const recurringSchedules = schedules.filter(
        (s) =>
          s.scheduleType === ScheduleType.Recurring &&
          typeof s.dayOfWeek === 'number',
      );
      let weeklyOffDays: number[] | undefined = undefined;
      if (recurringSchedules.length > 0) {
        const workingDays = new Set(
          recurringSchedules.map((s) => s.dayOfWeek as number),
        );
        weeklyOffDays = [0, 1, 2, 3, 4, 5, 6].filter(
          (d) => !workingDays.has(d),
        );
      }

      const offDays: string[] = [];
      for (const s of schedules) {
        if (
          s.scheduleType === ScheduleType.SpecificDate &&
          Array.isArray(s.offDays)
        ) {
          for (const d of s.offDays) {
            const dateStr = new Date(d).toLocaleDateString('en-CA', {
              timeZone: 'Asia/Ho_Chi_Minh',
            });
            offDays.push(dateStr);
          }
        }
      }

      return {
        weeklyOffDays,
        offDays: offDays.length > 0 ? offDays : undefined,
      };
    } catch {
      return undefined;
    }
  }

  async markReady(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    note?: string,
  ) {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    this.requireOperationalBooking(access.bookingStatus, 'chuẩn bị áo dài');
    const updated = await this.rentalFulfillment.markReady({
      itemId: access.itemId.toString(),
      actor: access.actor,
      note,
    });
    // Note: Do NOT release turnaround leases in markReady (which is only READY_FOR_PICKUP before customer pickup)
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
    const currentItem = await this.bookingItemModel
      .findById(access.itemId)
      .select({
        'rentalFulfillment.status': 1,
        'rentalFulfillment.pickupEvidence': 1,
      })
      .lean()
      .exec();
    if (currentItem?.rentalFulfillment?.pickupEvidence?.files?.length) {
      throw new ConflictException(
        'Shop đã gửi ảnh bàn giao cho áo dài này. Vui lòng chờ khách xác nhận nhận áo.',
      );
    }
    const evidence = await this.resolveEvidence(access, user, input, 'PICKUP');
    // Uploading the provider's evidence is not a customer pickup.  Keep the
    // item READY_FOR_PICKUP until the customer has reviewed these private
    // photos and explicitly confirms receipt.
    const updated = await this.rentalFulfillment.submitPickupEvidence({
      itemId: access.itemId.toString(),
      actor: access.actor,
      evidence,
      note: input.note,
      conditionNote: input.conditionNote,
    });
    await this.emitBookingRefresh(access.bookingId);
    return updated;
  }

  async markReturned(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    input: { fileIds?: string[]; note?: string; conditionNote?: string },
  ) {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    this.requireOperationalBooking(access.bookingStatus, 'nhận lại áo dài');
    // Customer-return evidence already exists. Shop evidence is required only
    // if the shop later submits an incident/compensation request.
    const evidence = await this.resolveEvidence(
      access,
      user,
      input,
      'RETURN',
      true,
    );
    const updated = await this.rentalFulfillment.markReturned({
      itemId: access.itemId.toString(),
      actor: access.actor,
      evidence,
      note: input.note,
      conditionNote: input.conditionNote,
    });

    // markReturned chỉ chuyển hiện vật sang trạng thái chờ kiểm tra (ReturnedPendingInspection).
    // Tuyệt đối KHÔNG tự chuyển sang CLEANING và KHÔNG gọi refund coordinator trước khi shop kiểm tra.
    await this.syncBookingProgress(access.bookingId, access.actor);
    return updated;
  }

  async confirmNoIncident(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    note?: string,
  ) {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    this.requireOperationalBooking(
      access.bookingStatus,
      'xác nhận không có sự cố',
    );
    const updated = await this.rentalFulfillment.confirmNoIncident({
      itemId: access.itemId.toString(),
      actor: access.actor,
      note,
    });

    // Sau khi xác nhận không có sự cố, chuyển hiện vật sang CLEANING và gán operationalAvailableFrom
    const item = await this.bookingItemModel
      .findById(access.itemId)
      .lean()
      .exec();
    const actualReturnedAt = new Date();
    const contractualRentalTo = (item as any)?.rentalTo || actualReturnedAt;
    const turnaroundSlotsCount = Number(
      (item as any)?.rentalFulfillment?.turnaroundSlotsSnapshot ?? 1,
    );
    const scheduleConfig = (item as any)?.providerId
      ? await this.getProviderScheduleConfig((item as any).providerId)
      : undefined;
    const availableFrom = this.timeEngineService
      ? this.timeEngineService.calculateReturnAvailableFrom(
          contractualRentalTo,
          actualReturnedAt,
          turnaroundSlotsCount,
          scheduleConfig,
        )
      : actualReturnedAt;

    const inventoryModel = this.bookingItemModel.db.model('InventoryItem');
    const reservationModel = this.bookingItemModel.db.model(
      'InventoryReservation',
    );
    const reservations = await reservationModel
      .find({ bookingItemId: access.itemId })
      .select({ inventoryItemId: 1 })
      .lean()
      .exec();
    const inventoryItemIds = (reservations as any[])
      .map((r) => r.inventoryItemId)
      .filter(Boolean);
    if (inventoryItemIds.length === 0 && (item as any)?.inventoryItemId) {
      inventoryItemIds.push((item as any).inventoryItemId);
    }
    for (const invId of inventoryItemIds) {
      await inventoryModel
        .updateOne(
          {
            _id: invId,
            status: { $ne: 'MAINTENANCE' },
            conditionStatus: { $nin: ['LOCKED', 'RETIRED', 'MINOR_DAMAGE'] },
          },
          {
            $set: {
              status: 'CLEANING',
              operationalAvailableFrom: availableFrom,
              activeTurnaroundBookingItemId: access.itemId,
            },
          },
        )
        .exec();
    }
    if (this.slotLeaseService && (item as any)?.slotLeaseRequired) {
      await this.slotLeaseService.reconcileTurnaroundLeases(
        access.itemId,
        availableFrom,
      );
    }

    await this.rentalDepositRefundCoordinator.coordinate(
      access.bookingId.toString(),
    );
    await this.syncBookingProgress(access.bookingId, access.actor);
    return updated;
  }

  async requestCustomerReturn(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    input: { fileIds?: string[]; evidencePhotos?: string[]; note?: string },
  ) {
    const access = await this.requireCustomerOrAdmin(bookingId, itemId, user);
    this.requireOperationalBooking(access.bookingStatus, 'yêu cầu trả áo dài');
    const evidence = await this.resolveEvidence(access, user, input, 'RETURN');
    const updated = await this.rentalFulfillment.requestCustomerReturn({
      itemId: access.itemId.toString(),
      actor: access.actor,
      evidence,
      note: input.note,
    });
    await this.syncBookingProgress(access.bookingId, access.actor);
    return updated;
  }

  async markCleaningCompleted(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    note?: string,
  ) {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    if (
      ![
        RentalFulfillmentStatus.Returned,
        RentalFulfillmentStatus.Completed,
      ].includes(access.fulfillmentStatus)
    ) {
      throw new ConflictException(
        'Chỉ có thể xác nhận hoàn tất giặt ủi sau khi đã nhận lại đồ (Returned).',
      );
    }

    const item = await this.bookingItemModel
      .findById(access.itemId)
      .lean()
      .exec();
    const issueStatus = (item as any)?.rentalFulfillment?.issueStatus;
    if (
      issueStatus &&
      issueStatus !== RentalIssueStatus.None &&
      issueStatus !== RentalIssueStatus.Resolved
    ) {
      throw new ConflictException(
        'Không thể hoàn tất giặt ủi khi sự cố chưa được giải quyết.',
      );
    }

    const inventoryModel = this.bookingItemModel.db.model('InventoryItem');
    const reservationModel = this.bookingItemModel.db.model(
      'InventoryReservation',
    );
    const reservations = await reservationModel
      .find({ bookingItemId: access.itemId })
      .select({ inventoryItemId: 1 })
      .lean()
      .exec();
    const inventoryItemIds = (reservations as any[])
      .map((r) => r.inventoryItemId)
      .filter(Boolean);
    if (inventoryItemIds.length === 0 && (item as any)?.inventoryItemId) {
      inventoryItemIds.push((item as any).inventoryItemId);
    }

    if (inventoryItemIds.length === 0) {
      throw new ConflictException(
        'Không tìm thấy hiện vật kho tương ứng với đơn thuê này.',
      );
    }

    const items = await inventoryModel
      .find({ _id: { $in: inventoryItemIds } })
      .lean()
      .exec();
    const hasBlockedStatus = items.some(
      (it: any) =>
        it.status === 'MAINTENANCE' ||
        ['RETIRED', 'LOCKED', 'MINOR_DAMAGE'].includes(it.conditionStatus),
    );
    if (hasBlockedStatus) {
      throw new ConflictException(
        'Hiện vật đang ở trạng thái bảo trì, hư hại hoặc thanh lý, không thể mở kho hoặc hoàn tất giặt ủi.',
      );
    }

    const updateResult = await inventoryModel
      .updateMany(
        {
          _id: { $in: inventoryItemIds },
          status: 'CLEANING',
          conditionStatus: { $nin: ['RETIRED', 'LOCKED', 'MINOR_DAMAGE'] },
        },
        {
          $set: {
            status: 'AVAILABLE',
            operationalAvailableFrom: null,
            activeTurnaroundBookingItemId: null,
          },
        },
      )
      .exec();

    if (updateResult.modifiedCount === 0) {
      throw new ConflictException(
        'Hiện vật không ở trạng thái đang giặt ủi (CLEANING), hoặc thao tác hoàn tất giặt ủi đã được xác nhận trước đó.',
      );
    }

    if (this.slotLeaseService) {
      await this.slotLeaseService.reconcileTurnaroundLeases(
        access.itemId,
        new Date(),
      );
    }
    await this.bookingItemModel
      .updateOne(
        { _id: access.itemId },
        {
          $set: {
            'rentalFulfillment.status': RentalFulfillmentStatus.Completed,
            'rentalFulfillment.completedAt': new Date(),
            'rentalFulfillment.inventoryStatus':
              RentalInventoryStatus.Available,
          },
          $push: {
            'rentalFulfillment.history': {
              action: 'CLEANING_COMPLETED',
              actor: access.actor,
              occurredAt: new Date(),
              note:
                note?.trim() ||
                'Giặt ủi hoàn tất sớm, trang phục sẵn sàng phục vụ',
            },
          },
        },
      )
      .exec();
    await this.syncBookingProgress(access.bookingId, access.actor);
    return {
      message: 'Xác nhận hoàn tất giặt ủi thành công',
      itemId: access.itemId.toString(),
    };
  }

  async proposeCharge(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    input: {
      chargeType: 'lateFee' | 'damageFee' | 'compensationAmount';
      amount: number;
      reason: string;
      note?: string;
    },
  ) {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    if (access.actor.role !== 'PROVIDER')
      throw new ForbiddenException(
        'Chỉ shop sở hữu áo dài mới được đề xuất phí.',
      );
    return this.rentalFulfillment.proposeCharge({
      itemId: access.itemId.toString(),
      actor: access.actor,
      ...input,
    });
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
    return this.rentalFulfillment.reviewCharge({
      itemId: access.itemId.toString(),
      actor: access.actor,
      chargeType,
      approved,
      note,
    });
  }

  async settleDeposit(
    bookingId: string,
    itemId: string,
    user: AuthUser,
    input: {
      deductAmount: number;
      inventoryStatus: RentalInventoryStatus;
      note?: string;
    },
  ) {
    const access = await this.requireAdmin(bookingId, itemId, user);
    const updated = await this.rentalFulfillment.settleDeposit({
      itemId: access.itemId.toString(),
      actor: access.actor,
      ...input,
    });
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
    if (
      this.slotLeaseService &&
      inventoryStatus === RentalInventoryStatus.Available
    ) {
      await this.slotLeaseService.reconcileTurnaroundLeases(
        access.itemId,
        new Date(),
      );
    }
    await this.syncBookingProgress(access.bookingId, access.actor);
    await this.rentalDepositRefundCoordinator.coordinate(
      access.bookingId.toString(),
    );
    return updated;
  }

  async authorizeEvidenceUpload(
    bookingId: string,
    itemId: string,
    user: AuthUser,
  ): Promise<RentalItemAccess> {
    const access = await this.requireProviderOrAdmin(bookingId, itemId, user);
    if (
      ![
        RentalFulfillmentStatus.ReadyForPickup,
        RentalFulfillmentStatus.PickedUp,
      ].includes(access.fulfillmentStatus)
    ) {
      throw new BadRequestException(
        'Chỉ có thể tải ảnh evidence ở bước giao hoặc nhận lại áo dài.',
      );
    }
    this.requireOperationalBooking(access.bookingStatus, 'tải evidence áo dài');
    const uploadPurpose = access.fulfillmentStatus === RentalFulfillmentStatus.ReadyForPickup ? 'PICKUP' : 'RETURN';
    assertRentalEvidenceUploadWindow({
      purpose: uploadPurpose,
      dueAt: uploadPurpose === 'PICKUP' ? access.pickupDueAt : access.returnDueAt,
      isAdmin: access.actor.role === 'ADMIN',
    });
    return { ...access, uploadPurpose };
  }

  async registerEvidenceUpload(
    access: RentalItemAccess,
    user: AuthUser,
    file: {
      fileId: string;
      bucket: string;
      storageKey: string;
      mimeType: string;
    },
  ) {
    await this.evidenceUploadModel.create({
      fileId: file.fileId,
      bookingId: access.bookingId,
      bookingItemId: access.itemId,
      uploadedBy: new Types.ObjectId(user.sub),
      bucket: file.bucket,
      storageKey: file.storageKey,
      mimeType: file.mimeType,
      expiresAt: new Date(Date.now() + RENTAL_EVIDENCE_UNATTACHED_TTL_MS),
    });
    return { fileId: file.fileId, type: 'IMAGE' as const };
  }

  async getEvidenceForViewing(
    bookingId: string,
    itemId: string,
    fileId: string,
    user: AuthUser,
  ) {
    const access = await this.requireAuthorizedViewer(bookingId, itemId, user);
    const evidence = await this.evidenceUploadModel
      .findOne({
        fileId,
        bookingId: access.bookingId,
        bookingItemId: access.itemId,
      })
      .lean()
      .exec();
    if (!evidence)
      throw new NotFoundException('Không tìm thấy ảnh bằng chứng.');
    return evidence;
  }

  /** Return non-sensitive evidence metadata so provider/customer UIs can
   * reconcile a handover after the booking list was refreshed. */
  async getEvidenceSummary(bookingId: string, itemId: string, user: AuthUser) {
    const access = await this.requireAuthorizedViewer(bookingId, itemId, user);
    const uploads = await this.evidenceUploadModel
      .find({
        bookingId: access.bookingId,
        bookingItemId: access.itemId,
        consumedFor: { $in: ['PICKUP', 'RETURN'] },
      })
      .select('fileId mimeType createdAt consumedFor')
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return {
      pickup: uploads
        .filter((upload: any) => upload.consumedFor === 'PICKUP')
        .map((upload: any) => ({
          fileId: upload.fileId,
          type: 'IMAGE',
          uploadedAt: upload.createdAt,
        })),
      return: uploads
        .filter((upload: any) => upload.consumedFor === 'RETURN')
        .map((upload: any) => ({
          fileId: upload.fileId,
          type: 'IMAGE',
          uploadedAt: upload.createdAt,
        })),
    };
  }

  private async resolveEvidence(
    access: RentalItemAccess,
    user: AuthUser,
    input: { fileIds?: string[]; note?: string },
    purpose: 'PICKUP' | 'RETURN',
    allowEmpty = false,
  ): Promise<FulfillmentEvidence> {
    const uniqueFileIds = [...new Set(input.fileIds ?? [])];
    if (!uniqueFileIds.length) {
      if (allowEmpty)
        return { files: [], note: input.note?.trim() || undefined };
      throw new BadRequestException('Cần có ít nhất một ảnh bằng chứng.');
    }
    if (uniqueFileIds.length > 5)
      throw new BadRequestException(
        'Tối đa năm ảnh bằng chứng cho mỗi lần bàn giao.',
      );
    const uploads = await this.evidenceUploadModel
      .find({
        fileId: { $in: uniqueFileIds },
        bookingId: access.bookingId,
        bookingItemId: access.itemId,
        uploadedBy: new Types.ObjectId(user.sub),
        consumedAt: null,
      })
      .lean()
      .exec();
    if (uploads.length !== uniqueFileIds.length) {
      throw new ForbiddenException(
        'Một hoặc nhiều ảnh bằng chứng không thuộc quyền sử dụng của bạn cho áo dài này, hoặc đã được dùng ở lần bàn giao khác.',
      );
    }
    const consumedAt = new Date();
    const consumption = await this.evidenceUploadModel.updateMany({
      fileId: { $in: uniqueFileIds },
      bookingId: access.bookingId,
      bookingItemId: access.itemId,
      uploadedBy: new Types.ObjectId(user.sub),
      consumedAt: null,
    }, { $set: {
      consumedAt,
      consumedFor: purpose,
      expiresAt: new Date(consumedAt.getTime() + RENTAL_EVIDENCE_RETENTION_MS),
    } }).exec();
    if (consumption.modifiedCount !== uniqueFileIds.length) {
      throw new ForbiddenException(
        'Evidence đã được dùng bởi thao tác khác. Vui lòng tải ảnh mới.',
      );
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
    const finalStatus = item?.rentalFulfillment?.inventoryStatus as
      | RentalInventoryStatus
      | undefined;
    if (!inventoryItemId || !finalStatus) return;
    const inventoryModel = this.bookingItemModel.db.model('InventoryItem');
    const reservationModel = this.bookingItemModel.db.model(
      'InventoryReservation',
    );
    const finalUpdate: Record<string, unknown> =
      finalStatus === RentalInventoryStatus.Available
        ? { status: 'CLEANING' }
        : finalStatus === RentalInventoryStatus.Lost
          ? { status: 'MAINTENANCE', conditionStatus: 'RETIRED' }
          : finalStatus === RentalInventoryStatus.Damaged
            ? { status: 'MAINTENANCE', conditionStatus: 'MINOR_DAMAGE' }
            : { status: 'MAINTENANCE' };
    await inventoryModel
      .updateOne({ _id: inventoryItemId }, { $set: finalUpdate })
      .exec();
    await reservationModel
      .updateOne(
        { bookingItemId: item._id, status: 'CONFIRMED' },
        { $set: { status: 'COMPLETED' } },
      )
      .exec();
  }
  /** Booking status is a derived aggregate for rental-only and combo bookings; item history remains the source of truth. */
  private async syncBookingProgress(
    bookingId: Types.ObjectId,
    actor: RentalActorSnapshot,
  ): Promise<void> {
    const booking = await this.bookingModel.findById(bookingId).lean().exec();
    if (
      !booking ||
      (booking.bookingType !== BookingType.AoDaiRental &&
        booking.bookingType !== BookingType.Combo) ||
      [
        BookingStatus.Cancelled,
        BookingStatus.Refunded,
        BookingStatus.Disputed,
      ].includes(booking.status)
    )
      return;

    const items = await this.bookingItemModel
      .find({
        bookingId,
        itemType: BookingItemType.Product,
        'rentalFulfillment.status': { $exists: true },
      })
      .lean()
      .exec();
    if (!items.length) return;

    const statuses = items.map((item) => item.rentalFulfillment?.status);
    let nextStatus: BookingStatus | null = null;
    if (
      statuses.every((status) => status === RentalFulfillmentStatus.Completed)
    ) {
      if (booking.bookingType === BookingType.Combo) {
        const isComboPhotoDelivered =
          Boolean((booking as any).photosApproved) ||
          Boolean((booking as any).deliveredPhotos?.length > 0) ||
          Boolean((booking as any).deliveryDriveUrl) ||
          booking.statusTimeline?.some(
            (t) =>
              t.status === BookingStatus.ComboPhotosApproved ||
              t.status === BookingStatus.Completed,
          );
        nextStatus = isComboPhotoDelivered
          ? BookingStatus.Completed
          : BookingStatus.Returned;
      } else {
        nextStatus = BookingStatus.Completed;
      }
    } else if (
      statuses.every((status) =>
        [
          RentalFulfillmentStatus.Returned,
          RentalFulfillmentStatus.Completed,
        ].includes(status as RentalFulfillmentStatus),
      )
    ) {
      if (booking.bookingType === BookingType.Combo) {
        const isComboPhotoDelivered =
          Boolean((booking as any).photosApproved) ||
          Boolean((booking as any).deliveredPhotos?.length > 0) ||
          Boolean((booking as any).deliveryDriveUrl) ||
          booking.statusTimeline?.some(
            (t) =>
              t.status === BookingStatus.ComboPhotosApproved ||
              t.status === BookingStatus.Completed,
          );
        const isDepositSettled = items.every((it) =>
          ['FULLY_RELEASED', 'PARTIALLY_DEDUCTED', 'FULLY_DEDUCTED'].includes(
            (it as any).rentalFulfillment?.depositSettlementStatus,
          ),
        );
        nextStatus =
          isComboPhotoDelivered && isDepositSettled
            ? BookingStatus.Completed
            : BookingStatus.Returned;
      } else {
        nextStatus = BookingStatus.Returned;
      }
    } else if (
      statuses.some(
        (status) => status === RentalFulfillmentStatus.CustomerReturnRequested,
      )
    ) {
      nextStatus = BookingStatus.ReturnPending;
    } else if (
      statuses.some((status) =>
        [
          RentalFulfillmentStatus.PickedUp,
          RentalFulfillmentStatus.Returned,
        ].includes(status as RentalFulfillmentStatus),
      )
    ) {
      nextStatus = BookingStatus.PickedUp;
    } else if (
      statuses.some(
        (status) => status === RentalFulfillmentStatus.ReadyForPickup,
      )
    ) {
      nextStatus = BookingStatus.PickupPending;
    }
    if (!nextStatus || booking.status === nextStatus) return;

    // Guard: Do not downgrade booking status for Combo if photography has already progressed
    if (booking.bookingType === BookingType.Combo) {
      const advancedStatuses = [
        BookingStatus.InProgress,
        BookingStatus.AwaitingReview,
        BookingStatus.ComboPhotosApproved,
        BookingStatus.Completed,
      ];
      if (
        advancedStatuses.includes(booking.status) &&
        (nextStatus === BookingStatus.PickupPending ||
          nextStatus === BookingStatus.PickedUp)
      ) {
        return;
      }
    }

    const changed = await this.bookingModel
      .findOneAndUpdate(
        {
          _id: bookingId,
          status: {
            $nin: [
              BookingStatus.Cancelled,
              BookingStatus.Refunded,
              BookingStatus.Disputed,
            ],
          },
        },
        {
          $set: { status: nextStatus },
          $push: {
            statusTimeline: {
              status: nextStatus,
              changedAt: new Date(),
              note: `Đồng bộ từ lifecycle áo dài (${actor.role}).`,
            },
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (changed && nextStatus === BookingStatus.Completed) {
      try {
        await this.paymentsService.settleBooking(bookingId.toString());
      } catch (err: any) {
        console.warn(
          `Failed to auto-settle booking ${bookingId} upon completion:`,
          err?.message || err,
        );
      }
    }

    const recipientUserIds: string[] = [];
    if (booking.customerId) {
      recipientUserIds.push(booking.customerId.toString());
    }
    const providerDocIds = (booking.providerIds || []).map((id: any) =>
      (id?._id || id).toString(),
    );
    if (providerDocIds.length > 0) {
      try {
        const providers = await this.providerModel
          .find({ _id: { $in: providerDocIds } })
          .select({ userId: 1 })
          .lean()
          .exec();
        providers.forEach((p) => {
          if (p.userId) recipientUserIds.push(p.userId.toString());
        });
      } catch (err) {
        console.warn(
          'Failed to resolve provider user IDs in syncBookingProgress:',
          err,
        );
      }
    }

    this.notificationsService?.emitBookingUpdate(
      {
        bookingId: bookingId.toString(),
        bookingCode: booking.bookingCode,
        status: nextStatus || booking.status,
      },
      recipientUserIds,
    );
  }

  private async emitBookingRefresh(bookingId: Types.ObjectId): Promise<void> {
    if (!this.notificationsService) return;
    try {
      const booking = await this.bookingModel
        .findById(bookingId)
        .select({ bookingCode: 1, status: 1, customerId: 1, providerIds: 1 })
        .lean()
        .exec();
      if (!booking) return;

      const recipientUserIds = booking.customerId ? [booking.customerId.toString()] : [];
      const providerIds = (booking.providerIds || []).map((id: any) => (id?._id || id).toString());
      if (providerIds.length > 0) {
        const providers = await this.providerModel
          .find({ _id: { $in: providerIds } })
          .select({ userId: 1 })
          .lean()
          .exec();
        providers.forEach((provider) => {
          if (provider.userId) recipientUserIds.push(provider.userId.toString());
        });
      }

      this.notificationsService.emitBookingUpdate({
        bookingId: bookingId.toString(),
        bookingCode: booking.bookingCode,
        status: booking.status,
      }, recipientUserIds);
    } catch (error) {
      console.warn(`Failed to emit booking refresh after pickup evidence ${bookingId}:`, error);
    }
  }

  private requireOperationalBooking(status: BookingStatus, action: string): void {
    const allowed = [
      BookingStatus.DepositPaid,
      BookingStatus.Confirmed,
      BookingStatus.PickupPending,
      BookingStatus.PickedUp,
      BookingStatus.ReturnPending,
      BookingStatus.Returned,
      BookingStatus.ComboPhotosApproved,
    ];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Không thể ${action} khi booking đang ở trạng thái ${status}.`,
      );
    }
  }
  private async requireAdmin(
    bookingId: string,
    itemId: string,
    user: AuthUser,
  ): Promise<RentalItemAccess> {
    const access = await this.resolveItemAccess(bookingId, itemId, user);
    if (!this.isAdmin(user))
      throw new ForbiddenException(
        'Chỉ quản trị viên mới được duyệt phí và tất toán cọc.',
      );
    return { ...access, actor: this.actor(user, 'ADMIN') };
  }

  private async requireCustomerOrAdmin(
    bookingId: string,
    itemId: string,
    user: AuthUser,
  ): Promise<RentalItemAccess> {
    const access = await this.resolveItemAccess(bookingId, itemId, user);
    if (this.isAdmin(user))
      return { ...access, actor: this.actor(user, 'ADMIN') };
    if (access.customerId.toString() !== user.sub) {
      throw new ForbiddenException(
        'Chỉ khách hàng của đơn hàng hoặc quản trị viên mới được gửi yêu cầu trả áo.',
      );
    }
    return { ...access, actor: this.actor(user, 'CUSTOMER') };
  }

  private async requireProviderOrAdmin(
    bookingId: string,
    itemId: string,
    user: AuthUser,
  ): Promise<RentalItemAccess> {
    const access = await this.resolveItemAccess(bookingId, itemId, user);
    if (this.isAdmin(user))
      return { ...access, actor: this.actor(user, 'ADMIN') };
    const provider = await this.providerModel
      .findOne({
        _id: access.providerId,
        userId: new Types.ObjectId(user.sub),
      })
      .lean()
      .exec();
    if (!provider)
      throw new ForbiddenException(
        'Chỉ shop sở hữu áo dài hoặc quản trị viên mới được thao tác bàn giao.',
      );
    return { ...access, actor: this.actor(user, 'PROVIDER') };
  }

  private async requireAuthorizedViewer(
    bookingId: string,
    itemId: string,
    user: AuthUser,
  ): Promise<RentalItemAccess> {
    const access = await this.resolveItemAccess(bookingId, itemId, user);
    if (this.isAdmin(user))
      return { ...access, actor: this.actor(user, 'ADMIN') };
    if (access.customerId.toString() === user.sub) {
      return { ...access, actor: this.actor(user, 'CUSTOMER') };
    }
    const provider = await this.providerModel
      .findOne({
        _id: access.providerId,
        userId: new Types.ObjectId(user.sub),
      })
      .lean()
      .exec();
    if (!provider)
      throw new ForbiddenException(
        'Bạn không có quyền xem ảnh bằng chứng của áo dài này.',
      );
    return { ...access, actor: this.actor(user, 'PROVIDER') };
  }

  private async resolveItemAccess(
    bookingId: string,
    itemId: string,
    user: AuthUser,
  ) {
    if (
      !Types.ObjectId.isValid(bookingId) ||
      !Types.ObjectId.isValid(itemId) ||
      !Types.ObjectId.isValid(user.sub)
    ) {
      throw new BadRequestException(
        'Booking, áo dài hoặc tài khoản không hợp lệ.',
      );
    }
    const bookingObjectId = new Types.ObjectId(bookingId);
    const itemObjectId = new Types.ObjectId(itemId);
    const [booking, item] = await Promise.all([
      this.bookingModel.findById(bookingObjectId).lean().exec(),
      this.bookingItemModel
        .findOne({
          _id: itemObjectId,
          bookingId: bookingObjectId,
          itemType: BookingItemType.Product,
        })
        .lean()
        .exec(),
    ]);
    if (!booking) throw new NotFoundException('Không tìm thấy booking.');
    if (!item)
      throw new NotFoundException('Không tìm thấy áo dài thuộc booking này.');
    if (!item.rentalFulfillment)
      throw new BadRequestException(
        'Áo dài này chưa có dữ liệu bàn giao. Booking cũ cần được chuyển đổi dữ liệu trước khi thao tác.',
      );
    return {
      bookingId: bookingObjectId,
      itemId: itemObjectId,
      customerId: booking.customerId,
      providerId: item.providerId,
      actor: this.actor(user, 'SYSTEM'),
      fulfillmentStatus: item.rentalFulfillment.status as RentalFulfillmentStatus,
      bookingStatus: booking.status as BookingStatus,
      pickupDueAt: item.rentalFulfillment.pickupDueAt ?? item.rentalFrom ?? null,
      returnDueAt: item.rentalFulfillment.returnDueAt ?? item.rentalTo ?? null,
    };
  }

  private isAdmin(user: AuthUser) {
    return user.roles?.some((role) => role.toUpperCase() === 'ADMIN');
  }

  private actor(
    user: AuthUser,
    role: RentalActorSnapshot['role'],
  ): RentalActorSnapshot {
    return { id: user.sub, role };
  }

  async resolveBookingAccess(bookingId: string, user: AuthUser) {
    if (!Types.ObjectId.isValid(bookingId) || !Types.ObjectId.isValid(user.sub)) {
      throw new BadRequestException('Mã đơn hoặc tài khoản không hợp lệ.');
    }
    const booking = await this.bookingModel
      .findById(new Types.ObjectId(bookingId))
      .lean()
      .exec();
    if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng.');

    if (this.isAdmin(user)) {
      return { booking, role: 'ADMIN' };
    }
    if (booking.customerId?.toString() === user.sub) {
      return { booking, role: 'CUSTOMER' };
    }
    const provider = await this.providerModel
      .findOne({
        _id: { $in: booking.providerIds },
        userId: new Types.ObjectId(user.sub),
      })
      .lean()
      .exec();
    if (provider) {
      return { booking, role: 'PROVIDER', providerId: provider._id };
    }
    throw new ForbiddenException(
      'Bạn không có quyền truy cập thông tin danh tính của đơn hàng này.',
    );
  }

  async saveCustomerIdentityCard(
    bookingId: string,
    user: AuthUser,
    data: {
      frontStorageKey?: string;
      backStorageKey?: string;
      idNumber?: string;
      fullName?: string;
      notes?: string;
    },
  ) {
    const { booking, role } = await this.resolveBookingAccess(bookingId, user);
    const existingCard =
      (booking as any).customerIdentityCard &&
      typeof (booking as any).customerIdentityCard === 'object'
        ? (booking as any).customerIdentityCard
        : {};

    const nextCard: Record<string, any> = {
      ...existingCard,
      capturedAt: new Date(),
      capturedBy: role,
    };
    if (data.frontStorageKey) nextCard.frontImage = data.frontStorageKey;
    if (data.backStorageKey) nextCard.backImage = data.backStorageKey;
    if (data.idNumber !== undefined)
      nextCard.idNumber = data.idNumber?.trim() || null;
    if (data.fullName !== undefined)
      nextCard.fullName = data.fullName?.trim() || null;
    if (data.notes !== undefined) nextCard.notes = data.notes?.trim() || null;

    await this.bookingModel.updateOne(
      { _id: booking._id },
      { $set: { customerIdentityCard: nextCard } },
    );
    return {
      success: true,
      message: 'Đã lưu thông tin CCCD khách hàng an toàn.',
    };
  }

  async getCustomerIdentityCard(bookingId: string, user: AuthUser) {
    const { booking } = await this.resolveBookingAccess(bookingId, user);
    const card = (booking as any).customerIdentityCard;
    if (!card || (!card.frontImage && !card.backImage)) {
      return {
        hasIdentityCard: false,
        idNumberMasked: null,
        fullName: null,
        capturedAt: null,
        capturedBy: null,
        hasFrontImage: false,
        hasBackImage: false,
      };
    }
    const rawId = card.idNumber || '';
    const idNumberMasked =
      rawId.length >= 8
        ? `${rawId.slice(0, 3)}******${rawId.slice(-3)}`
        : rawId
          ? '******'
          : null;

    return {
      hasIdentityCard: true,
      hasFrontImage: Boolean(card.frontImage),
      hasBackImage: Boolean(card.backImage),
      idNumberMasked,
      idNumber: rawId || null,
      fullName: card.fullName || null,
      capturedAt: card.capturedAt || null,
      capturedBy: card.capturedBy || null,
      notes: card.notes || null,
      frontUrl: card.frontImage
        ? `/api/bookings/${bookingId}/customer-identity/image/front`
        : null,
      backUrl: card.backImage
        ? `/api/bookings/${bookingId}/customer-identity/image/back`
        : null,
    };
  }

  async getCustomerIdentityImage(
    bookingId: string,
    side: 'front' | 'back',
    user: AuthUser,
  ) {
    const { booking } = await this.resolveBookingAccess(bookingId, user);
    const card = (booking as any).customerIdentityCard;
    const storageKey = side === 'front' ? card?.frontImage : card?.backImage;
    if (!storageKey) {
      throw new NotFoundException(
        `Không tìm thấy ảnh mặt ${side === 'front' ? 'trước' : 'sau'} CCCD.`,
      );
    }
    return {
      bucket: 'rental-fulfillment-private',
      storageKey,
    };
  }
}
