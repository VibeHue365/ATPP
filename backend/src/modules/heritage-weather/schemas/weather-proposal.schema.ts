import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WeatherProposalDocument = HydratedDocument<WeatherProposal>;

export enum ProposalChangeType {
  LOCATION_ONLY = 'LOCATION_ONLY',       // Chỉ đổi điểm (Không tăng weatherRescheduleCount per AD-02)
  SLOT_ONLY = 'SLOT_ONLY',               // Đổi khung giờ cùng ngày (Tăng count khi APPLIED)
  DATE_AND_SLOT = 'DATE_AND_SLOT',       // Đổi ngày và khung giờ (Tăng count khi APPLIED)
}

export enum ProposalStatus {
  PENDING = 'PENDING',                                   // Đang chờ thợ/shop phản hồi
  APPROVED_PENDING_PAYMENT = 'APPROVED_PENDING_PAYMENT', // Thợ đồng ý, đang chờ khách trả phụ phí (AD-01)
  APPLIED = 'APPLIED',                                   // Đã cập nhật thành công vào lịch chính thức
  REJECTED = 'REJECTED',                                 // Thợ/Shop từ chối hoặc quá giờ chụp cũ
  EXPIRED = 'EXPIRED',                                   // Hết hạn phản hồi TTL
  EXPIRED_PAYMENT_CAPTURED = 'EXPIRED_PAYMENT_CAPTURED', // Khách trả trễ sau TTL -> Kích hoạt hoàn tiền
  CANCELLED = 'CANCELLED',                               // Khách hủy đề xuất
}

@Schema({ collection: 'weather_proposals', timestamps: true })
export class WeatherProposal {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Provider', required: true, default: [] })
  providerIds: Types.ObjectId[];

  @Prop({
    type: String,
    enum: Object.values(ProposalChangeType),
    required: true,
    index: true,
  })
  changeType: ProposalChangeType;

  @Prop({
    type: {
      spotId: { type: Types.ObjectId, ref: 'HeritageSpot', default: null },
      spotName: { type: String, default: null },
      date: { type: String, required: true },      // "YYYY-MM-DD"
      timeSlot: { type: String, required: true },  // "08:00 - 10:00"
      travelFee: { type: Number, default: 0 },
    },
    required: true,
  })
  originalSchedule: {
    spotId?: Types.ObjectId | null;
    spotName?: string | null;
    date: string;
    timeSlot: string;
    travelFee: number;
  };

  @Prop({
    type: {
      spotId: { type: Types.ObjectId, ref: 'HeritageSpot', default: null },
      spotName: { type: String, default: null },
      date: { type: String, required: true },      // "YYYY-MM-DD"
      timeSlot: { type: String, required: true },  // "08:00 - 10:00"
      travelFee: { type: Number, default: 0 },
    },
    required: true,
  })
  proposedSchedule: {
    spotId?: Types.ObjectId | null;
    spotName?: string | null;
    date: string;
    timeSlot: string;
    travelFee: number;
  };

  // Tính toán phụ phí di chuyển theo AD-01
  @Prop({ type: Number, required: true })
  rawFeeDelta: number; // proposedTravelFee - originalTravelFee

  @Prop({ type: Number, required: true, default: 0 })
  additionalFeeDue: number; // max(rawFeeDelta, 0) per AD-01

  @Prop({
    type: String,
    enum: Object.values(ProposalStatus),
    default: ProposalStatus.PENDING,
    index: true,
  })
  status: ProposalStatus;

  // Thời hạn phản hồi đề xuất (Proposal TTL: min(now + TTL, oldStartsAt))
  @Prop({ type: Date, required: true, index: true })
  proposalExpiresAt: Date;

  // Thời hạn thanh toán phụ phí (Payment TTL: min(now + 15m, oldStartsAt))
  @Prop({ type: Date, default: null, index: true })
  paymentExpiresAt?: Date | null;

  @Prop({
    type: {
      orderCode: { type: Number, default: null },
      paymentLinkId: { type: String, default: null },
      checkoutUrl: { type: String, default: null },
      qrCode: { type: String, default: null },
      amount: { type: Number, default: 0 },
      status: { type: String, default: 'PENDING' },
      paidAt: { type: Date, default: null },
    },
    default: null,
  })
  additionalPayment?: {
    orderCode?: number | null;
    paymentLinkId?: string | null;
    checkoutUrl?: string | null;
    qrCode?: string | null;
    amount?: number;
    status?: string;
    paidAt?: Date | null;
  } | null;

  // Phản hồi từ từng đối tác (Hỗ trợ All-or-Nothing cho đơn Combo)
  @Prop({
    type: Map,
    of: {
      decision: { type: String, enum: ['APPROVED', 'REJECTED'] },
      respondedAt: { type: Date, default: Date.now },
      rejectionReason: { type: String, default: null },
    },
    default: {},
  })
  providerResponses: Map<string, { decision: string; respondedAt: Date; rejectionReason?: string }>;

  @Prop({ type: String, default: null })
  temporaryHoldRef?: string | null;

  @Prop({ type: Date, default: null })
  appliedAt?: Date | null;
}

export const WeatherProposalSchema = SchemaFactory.createForClass(WeatherProposal);

WeatherProposalSchema.index({ bookingId: 1, status: 1 });
WeatherProposalSchema.index({ customerId: 1, createdAt: -1 });
