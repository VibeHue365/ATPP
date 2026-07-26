import { ConflictException, Injectable, BadRequestException } from '@nestjs/common';
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
  constructor(@InjectModel(BookingItem.name) private readonly bookingItemModel: Model<BookingItem>) {}

  async markReady(input: TransitionInput) {
    return this.transition({ ...input, expectedStatus: RentalFulfillmentStatus.Pending, nextStatus: RentalFulfillmentStatus.ReadyForPickup, action: 'MARKED_READY', set: { 'rentalFulfillment.readyAt': new Date() }, extraFilter: { 'rentalFulfillment.inventoryStatus': RentalInventoryStatus.Reserved } });
  }

  async markPickedUp(input: TransitionInput) {
    this.assertEvidence(input.evidence, 'Bàn giao áo dài yêu cầu ít nhất một ảnh tình trạng.');
    return this.transition({ ...input, expectedStatus: RentalFulfillmentStatus.ReadyForPickup, nextStatus: RentalFulfillmentStatus.PickedUp, action: 'MARKED_PICKED_UP', set: { 'rentalFulfillment.pickedUpAt': new Date(), 'rentalFulfillment.pickupEvidence': input.evidence, 'rentalFulfillment.pickupConditionNote': input.conditionNote?.trim() || null, 'rentalFulfillment.inventoryStatus': RentalInventoryStatus.RentedOut } });
  }

  async markReturned(input: TransitionInput) {
    this.assertEvidence(input.evidence, 'Nhận lại áo dài yêu cầu ít nhất một ảnh tình trạng.');
    const itemId = this.objectId(input.itemId);
    const current = await this.bookingItemModel.findOne({ _id: itemId, itemType: BookingItemType.Product }).lean().exec();
    const depositAmt = current?.depositAmount || 0;
    const hasProposedCharges = Object.values(current?.rentalFulfillment?.charges || {}).some((c: any) => c?.status === 'PROPOSED');

    const depositSettlementStatus = hasProposedCharges
      ? DepositSettlementStatus.PendingSettlement
      : DepositSettlementStatus.FullyReleased;
    const depositDeductedAmount = 0;
    const depositRefundAmount = hasProposedCharges ? 0 : depositAmt;

    return this.transition({
      ...input,
      expectedStatus: RentalFulfillmentStatus.PickedUp,
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

  async proposeCharge(input: TransitionInput & { chargeType: ChargeType; amount: number; reason: string }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new BadRequestException('Số tiền đề xuất phải lớn hơn 0.');
    if (!input.reason?.trim()) throw new BadRequestException('Cần nêu lý do đề xuất phí.');
    const itemId = this.objectId(input.itemId);
    const now = new Date();
    const charge = { amount: Math.round(input.amount), status: 'PROPOSED', reason: input.reason.trim(), proposedBy: input.actor, proposedAt: now };
    const updated = await this.bookingItemModel.findOneAndUpdate({
      _id: itemId, itemType: BookingItemType.Product, 'rentalFulfillment.status': RentalFulfillmentStatus.Returned,
      'rentalFulfillment.depositSettlementStatus': { $in: [DepositSettlementStatus.PendingSettlement, DepositSettlementStatus.FullyReleased] },
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
    return this.transition({ ...input, expectedStatus: RentalFulfillmentStatus.Returned, nextStatus: RentalFulfillmentStatus.Completed, action: 'MARKED_COMPLETED', set: { 'rentalFulfillment.completedAt': new Date(), 'rentalFulfillment.inventoryStatus': finalStatus }, extraFilter: { 'rentalFulfillment.issueStatus': { $in: [RentalIssueStatus.None, RentalIssueStatus.Resolved] }, 'rentalFulfillment.depositSettlementStatus': { $in: [DepositSettlementStatus.FullyReleased, DepositSettlementStatus.PartiallyDeducted, DepositSettlementStatus.FullyDeducted] } } });
  }

  private async transition(input: TransitionInput & { expectedStatus: RentalFulfillmentStatus; nextStatus: RentalFulfillmentStatus; action: RentalFulfillmentAction; set: Record<string, unknown>; extraFilter?: Record<string, unknown> }) {
    const itemId = this.objectId(input.itemId);
    const updated = await this.bookingItemModel.findOneAndUpdate({ _id: itemId, itemType: BookingItemType.Product, 'rentalFulfillment.status': input.expectedStatus, ...input.extraFilter }, { $set: { ...input.set, 'rentalFulfillment.status': input.nextStatus }, $push: { 'rentalFulfillment.history': this.history(input.action, input.actor, input.note) } }, { new: true }).lean().exec();
    if (!updated) throw new ConflictException('Trạng thái bàn giao đã thay đổi hoặc thao tác hiện không hợp lệ.');
    return updated;
  }

  private history(action: RentalFulfillmentAction, actor: RentalActorSnapshot, note?: string, metadata?: Record<string, unknown>) { return { action, actor, occurredAt: new Date(), note: note?.trim() || null, metadata }; }
  private objectId(value: string) { if (!Types.ObjectId.isValid(value)) throw new BadRequestException('Booking item không hợp lệ.'); return new Types.ObjectId(value); }
  private assertEvidence(evidence: FulfillmentEvidence | undefined, message: string) { if (!evidence?.files?.some((file) => file.type === 'IMAGE' && !!file.fileId)) throw new BadRequestException(message); }
}