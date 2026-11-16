import { ConflictException, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import {
  DepositSettlementStatus,
  FulfillmentEvidence,
  RentalActorSnapshot,
  RentalFulfillmentAction,
  RentalFulfillmentStatus,
  RentalInventoryStatus,
  RentalIssueStatus,
} from '../schemas/rental-fulfillment.types';

type ChargeType = 'lateFee' | 'damageFee' | 'compensationAmount';
interface TransitionInput { itemId: string; actor: RentalActorSnapshot; note?: string; evidence?: FulfillmentEvidence; conditionNote?: string; }

@Injectable()
export class RentalFulfillmentService {
  constructor(@InjectModel(BookingItem.name) private readonly bookingItemModel: Model<BookingItem>) { }

  async markReady(input: TransitionInput) {
    return this.transition({ ...input, expectedStatus: RentalFulfillmentStatus.Pending, nextStatus: RentalFulfillmentStatus.ReadyForPickup, action: 'MARKED_READY', set: { 'rentalFulfillment.readyAt': new Date() }, extraFilter: { 'rentalFulfillment.inventoryStatus': RentalInventoryStatus.Reserved } });
  }

  async markPickedUp(input: TransitionInput) {
    this.assertEvidence(input.evidence, 'Bàn giao áo dài yêu cầu ít nhất một ảnh tình trạng.');
    return this.transition({ ...input, expectedStatus: RentalFulfillmentStatus.ReadyForPickup, nextStatus: RentalFulfillmentStatus.PickedUp, action: 'MARKED_PICKED_UP', set: { 'rentalFulfillment.pickedUpAt': new Date(), 'rentalFulfillment.pickupEvidence': input.evidence, 'rentalFulfillment.pickupConditionNote': input.conditionNote?.trim() || null, 'rentalFulfillment.inventoryStatus': RentalInventoryStatus.RentedOut } });
  }

  /**
   * Shop only records the handover condition.  Physical possession is not
   * confirmed until the customer has reviewed that evidence and confirms
   * receipt through customerConfirmPickup.
   */
  async submitPickupEvidence(input: TransitionInput) {
    this.assertEvidence(input.evidence, 'Bàn giao áo dài yêu cầu ít nhất một ảnh tình trạng.');
    const itemId = this.objectId(input.itemId);
    const updated = await this.bookingItemModel.findOneAndUpdate(
      {
        _id: itemId,
        itemType: BookingItemType.Product,
        'rentalFulfillment.status': RentalFulfillmentStatus.ReadyForPickup,
        'rentalFulfillment.pickupEvidence.files.0': { $exists: false },
      },
      {
        $set: {
          'rentalFulfillment.pickupEvidence': input.evidence,
          'rentalFulfillment.pickupConditionNote': input.conditionNote?.trim() || null,
        },
        $push: {
          'rentalFulfillment.history': this.history(
            'PICKUP_EVIDENCE_SUBMITTED',
            input.actor,
            input.note || 'Shop đã gửi ảnh bàn giao, chờ khách xác nhận nhận áo.',
          ),
        },
      },
      { new: true },
    ).lean().exec();
    if (!updated) {
      throw new ConflictException('Ảnh bàn giao đã được gửi hoặc trạng thái áo không còn chờ khách nhận.');
    }
    return updated;
  }

  async requestCustomerReturn(input: TransitionInput) {
    this.assertEvidence(input.evidence, 'Bắt buộc tải lên ít nhất một ảnh tình trạng áo khi trả.');
    const itemId = this.objectId(input.itemId);
    const current = await this.bookingItemModel.findOne({ _id: itemId, itemType: BookingItemType.Product }).lean().exec();
    if (!current?.rentalFulfillment) {
      throw new NotFoundException('Không tìm thấy thông tin sản phẩm thuê.');
    }
    const currentStatus = current.rentalFulfillment.status;
    if (currentStatus === RentalFulfillmentStatus.CustomerReturnRequested) {
      throw new ConflictException('Áo dài này đã được gửi yêu cầu trả trước đó, đang chờ Shop xác nhận.');
    }
    if (currentStatus !== RentalFulfillmentStatus.PickedUp) {
      throw new ConflictException(`Không thể gửi yêu cầu trả áo khi trạng thái là ${currentStatus}. Áo dài phải đang ở trạng thái Đang thuê (PICKED_UP).`);
    }
    const issueStatus = current.rentalFulfillment.issueStatus;
    if (issueStatus && issueStatus !== RentalIssueStatus.None && issueStatus !== RentalIssueStatus.Resolved) {
      throw new ConflictException('Không thể gửi yêu cầu trả áo khi đang có sự cố hoặc tranh chấp.');
    }

    const customerReturnEvidence = {
      files: input.evidence?.files?.map((f) => f.fileId) || [],
      returnedAt: new Date(),
      note: input.note || input.conditionNote || null,
    };

    return this.transition({
      ...input,
      expectedStatus: RentalFulfillmentStatus.PickedUp,
      nextStatus: RentalFulfillmentStatus.CustomerReturnRequested,
      action: 'CUSTOMER_RETURN_REQUESTED' as any,
      set: {
        'rentalFulfillment.customerReturnEvidence': customerReturnEvidence,
        'rentalFulfillment.inventoryStatus': RentalInventoryStatus.ReturnedPendingInspection,
      },
    });
  }

  async markReturned(input: TransitionInput) {
    const itemId = this.objectId(input.itemId);
    const current = await this.bookingItemModel.findOne({ _id: itemId, itemType: BookingItemType.Product }).lean().exec();
    if (!current?.rentalFulfillment) {
      throw new NotFoundException('Không tìm thấy sản phẩm thuê.');
    }
    const currentStatus = current.rentalFulfillment.status;
    if (currentStatus === RentalFulfillmentStatus.PickedUp) {
      throw new ConflictException('Khách hàng chưa gửi yêu cầu trả áo. Shop chỉ được xác nhận nhận lại sau khi khách đã gửi yêu cầu trả đồ kèm ảnh.');
    }
    if (
      currentStatus !== RentalFulfillmentStatus.CustomerReturnRequested &&
      currentStatus !== RentalFulfillmentStatus.Returned
    ) {
      throw new ConflictException(`Áo dài chưa ở bước nhận lại để xác nhận kiểm tra (trạng thái: ${currentStatus}).`);
    }

    const depositSettlementStatus = DepositSettlementStatus.PendingSettlement;
    const depositDeductedAmount = 0;
    const depositRefundAmount = 0;

    return this.transition({
      ...input,
      expectedStatus: [RentalFulfillmentStatus.CustomerReturnRequested, RentalFulfillmentStatus.Returned],
      nextStatus: RentalFulfillmentStatus.Returned,
      action: 'MARKED_RETURNED',
      set: {
        'rentalFulfillment.returnedAt': new Date(),
        'rentalFulfillment.returnEvidence': input.evidence,
        'rentalFulfillment.returnConditionNote': input.conditionNote?.trim() || null,
        'rentalFulfillment.inventoryStatus': RentalInventoryStatus.ReturnedPendingInspection,
        'rentalFulfillment.depositSettlementStatus': depositSettlementStatus,
        'rentalFulfillment.depositDeductedAmount': depositDeductedAmount,
        'rentalFulfillment.depositRefundAmount': depositRefundAmount,
      },
    });
  }

  async confirmNoIncident(input: TransitionInput) {
    const itemId = this.objectId(input.itemId);
    const current = await this.bookingItemModel.findOne({ _id: itemId, itemType: BookingItemType.Product }).lean().exec();
    if (!current?.rentalFulfillment || ![RentalFulfillmentStatus.Returned, RentalFulfillmentStatus.Completed].includes(current.rentalFulfillment.status)) {
      throw new ConflictException('Áo dài chưa ở bước nhận lại để xác nhận kiểm tra.');
    }
    if (
      current.rentalFulfillment.status === RentalFulfillmentStatus.Completed ||
      current.rentalFulfillment.depositSettlementStatus === DepositSettlementStatus.FullyReleased
    ) {
      return current;
    }
    const depositAmt = (current.depositAmount || 0) * (current.quantity || 1);
    const updated = await this.bookingItemModel.findOneAndUpdate(
      {
        _id: itemId,
        itemType: BookingItemType.Product,
        'rentalFulfillment.status': { $in: [RentalFulfillmentStatus.Returned, RentalFulfillmentStatus.Completed] },
        'rentalFulfillment.issueStatus': { $in: [RentalIssueStatus.None, null] },
      },
      {
        $set: {
          'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.FullyReleased,
          'rentalFulfillment.depositDeductedAmount': 0,
          'rentalFulfillment.depositRefundAmount': depositAmt,
          'rentalFulfillment.issueStatus': RentalIssueStatus.None,
          'rentalFulfillment.inventoryStatus': RentalInventoryStatus.Cleaning,
        },
        $push: {
          'rentalFulfillment.history': this.history('DEPOSIT_SETTLED' as any, input.actor, input.note || 'Xác nhận đồ nguyên vẹn - không có sự cố', {
            depositRefundAmount: depositAmt,
            depositSettlementStatus: DepositSettlementStatus.FullyReleased,
          }),
        },
      },
      { new: true },
    ).lean().exec();
    if (!updated) {
      throw new ConflictException('Không thể xác nhận: đơn đã có sự cố hoặc trạng thái không hợp lệ.');
    }
    return updated;
  }

  async proposeCharge(input: TransitionInput & { chargeType: ChargeType; amount: number; reason: string }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new BadRequestException('Số tiền đề xuất phải lớn hơn 0.');
    if (!input.reason?.trim()) throw new BadRequestException('Cần nêu lý do đề xuất phí.');
    const itemId = this.objectId(input.itemId);
    const now = new Date();
    const charge = { amount: Math.round(input.amount), status: 'PROPOSED', reason: input.reason.trim(), proposedBy: input.actor, proposedAt: now };
    const updated = await this.bookingItemModel.findOneAndUpdate({
      _id: itemId, itemType: BookingItemType.Product, 'rentalFulfillment.status': RentalFulfillmentStatus.Returned,
      'rentalFulfillment.depositSettlementStatus': { $in: [DepositSettlementStatus.PendingSettlement, DepositSettlementStatus.FullyReleased, DepositSettlementStatus.Held, null] },
      [`rentalFulfillment.charges.${input.chargeType}`]: { $exists: false },
      depositAmount: { $gte: charge.amount },
    }, {
      $set: {
        [`rentalFulfillment.charges.${input.chargeType}`]: charge,
        'rentalFulfillment.issueStatus': RentalIssueStatus.Reported,
        'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.PendingSettlement,
        'rentalFulfillment.depositDeductedAmount': 0,
        'rentalFulfillment.depositRefundAmount': 0,
      },
      $push: { 'rentalFulfillment.history': this.history('CHARGE_PROPOSED', input.actor, input.note, { chargeType: input.chargeType, amount: charge.amount }) },
    }, { new: true }).lean().exec();
    if (!updated) throw new ConflictException('Không thể đề xuất phí: item chưa được nhận lại, số tiền vượt cọc hoặc loại phí đã được đề xuất.');
    return updated;
  }

  async reviewCharge(input: TransitionInput & { chargeType: ChargeType; approved: boolean }) {
    const itemId = this.objectId(input.itemId);
    const now = new Date();
    const status = input.approved ? 'APPROVED' : 'REJECTED';
    const updated = await this.bookingItemModel.findOneAndUpdate({
      _id: itemId, itemType: BookingItemType.Product, 'rentalFulfillment.status': RentalFulfillmentStatus.Returned,
      [`rentalFulfillment.charges.${input.chargeType}.status`]: 'PROPOSED',
    }, {
      $set: {
        [`rentalFulfillment.charges.${input.chargeType}.status`]: status,
        [`rentalFulfillment.charges.${input.chargeType}.approvedBy`]: input.actor,
        [`rentalFulfillment.charges.${input.chargeType}.approvedAt`]: now,
        'rentalFulfillment.issueStatus': input.approved ? RentalIssueStatus.UnderReview : RentalIssueStatus.Resolved,
      },
      $push: { 'rentalFulfillment.history': this.history(input.approved ? 'CHARGE_APPROVED' : 'CHARGE_REJECTED', input.actor, input.note, { chargeType: input.chargeType }) },
    }, { new: true }).lean().exec();
    if (!updated) throw new ConflictException('Đề xuất phí không còn chờ duyệt hoặc item không hợp lệ.');
    return updated;
  }

  async settleDeposit(input: TransitionInput & { deductAmount: number; inventoryStatus: RentalInventoryStatus }) {
    const itemId = this.objectId(input.itemId);
    if (!Number.isFinite(input.deductAmount) || input.deductAmount < 0) throw new BadRequestException('Số tiền khấu trừ không hợp lệ.');
    const finalStatuses = [RentalInventoryStatus.Available, RentalInventoryStatus.Maintenance, RentalInventoryStatus.Damaged, RentalInventoryStatus.Lost];
    if (!finalStatuses.includes(input.inventoryStatus)) throw new BadRequestException('Trạng thái tồn kho cuối không hợp lệ.');
    const current = await this.bookingItemModel.findOne({ _id: itemId, itemType: BookingItemType.Product }).lean().exec();
    if (!current?.rentalFulfillment || current.rentalFulfillment.status !== RentalFulfillmentStatus.Returned) throw new ConflictException('Áo dài chưa ở bước nhận lại để tất toán cọc.');
    const charges = Object.values(current.rentalFulfillment.charges || {}).filter(Boolean) as Array<{ amount: number; status: string }>;
    if (charges.some((charge) => charge.status === 'PROPOSED')) throw new ConflictException('Cần duyệt hoặc từ chối toàn bộ đề xuất phí trước khi tất toán cọc.');
    const approvedTotal = charges.filter((charge) => charge.status === 'APPROVED').reduce((sum, charge) => sum + charge.amount, 0);
    const deductAmount = Math.round(input.deductAmount);
    if (deductAmount > (current.depositAmount || 0) || deductAmount > approvedTotal) throw new BadRequestException('Khoản khấu trừ không được vượt quá cọc hoặc tổng phí đã được Admin duyệt.');
    const settlementStatus = deductAmount === 0 ? DepositSettlementStatus.FullyReleased : deductAmount === current.depositAmount ? DepositSettlementStatus.FullyDeducted : DepositSettlementStatus.PartiallyDeducted;
    const updated = await this.bookingItemModel.findOneAndUpdate({
      _id: itemId, itemType: BookingItemType.Product, 'rentalFulfillment.status': RentalFulfillmentStatus.Returned,
      'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.PendingSettlement,
    }, {
      $set: { 'rentalFulfillment.depositSettlementStatus': settlementStatus, 'rentalFulfillment.depositDeductedAmount': deductAmount, 'rentalFulfillment.depositRefundAmount': Math.max((current.depositAmount || 0) - deductAmount, 0), 'rentalFulfillment.inventoryStatus': input.inventoryStatus, 'rentalFulfillment.issueStatus': RentalIssueStatus.Resolved },
      $push: { 'rentalFulfillment.history': this.history('DEPOSIT_SETTLED', input.actor, input.note, { deductAmount, refundAmount: Math.max((current.depositAmount || 0) - deductAmount, 0), approvedTotal, inventoryStatus: input.inventoryStatus }) },
    }, { new: true }).lean().exec();
    if (!updated) throw new ConflictException('Dữ liệu cọc đã thay đổi, vui lòng tải lại trước khi tất toán.');
    return updated;
  }

  async markCompleted(input: TransitionInput, inventoryStatus?: RentalInventoryStatus) {
    const allowedInventoryStatuses = [RentalInventoryStatus.Available, RentalInventoryStatus.Maintenance, RentalInventoryStatus.Damaged, RentalInventoryStatus.Lost];
    let finalStatus = inventoryStatus;
    if (!finalStatus || !allowedInventoryStatuses.includes(finalStatus)) {
      finalStatus = RentalInventoryStatus.Available;
    }
    return this.transition({ ...input, expectedStatus: RentalFulfillmentStatus.Returned, nextStatus: RentalFulfillmentStatus.Completed, action: 'MARKED_COMPLETED', set: { 'rentalFulfillment.completedAt': new Date(), 'rentalFulfillment.inventoryStatus': finalStatus }, extraFilter: { 'rentalFulfillment.issueStatus': { $in: [RentalIssueStatus.None, RentalIssueStatus.Resolved, null] }, 'rentalFulfillment.depositSettlementStatus': { $in: [DepositSettlementStatus.FullyReleased, DepositSettlementStatus.PartiallyDeducted, DepositSettlementStatus.FullyDeducted, DepositSettlementStatus.Held, null] } } });
  }

  private async transition(input: TransitionInput & { expectedStatus: RentalFulfillmentStatus | RentalFulfillmentStatus[]; nextStatus: RentalFulfillmentStatus; action: RentalFulfillmentAction; set: Record<string, unknown>; extraFilter?: Record<string, unknown> }) {
    const itemId = this.objectId(input.itemId);
    const statusFilter = Array.isArray(input.expectedStatus) ? { $in: input.expectedStatus } : input.expectedStatus;
    const updated = await this.bookingItemModel.findOneAndUpdate({ _id: itemId, itemType: BookingItemType.Product, 'rentalFulfillment.status': statusFilter, ...input.extraFilter }, { $set: { ...input.set, 'rentalFulfillment.status': input.nextStatus }, $push: { 'rentalFulfillment.history': this.history(input.action, input.actor, input.note) } }, { new: true }).lean().exec();
    if (!updated) throw new ConflictException('Trạng thái bàn giao đã thay đổi hoặc thao tác hiện không hợp lệ.');
    return updated;
  }

  private history(action: RentalFulfillmentAction, actor: RentalActorSnapshot, note?: string, metadata?: Record<string, unknown>) { return { action, actor, occurredAt: new Date(), note: note?.trim() || null, metadata }; }
  private objectId(value: string) { if (!Types.ObjectId.isValid(value)) throw new BadRequestException('Booking item không hợp lệ.'); return new Types.ObjectId(value); }
  private assertEvidence(evidence: FulfillmentEvidence | undefined, message: string) { if (!evidence?.files?.some((file) => file.type === 'IMAGE' && !!file.fileId)) throw new BadRequestException(message); }
}
