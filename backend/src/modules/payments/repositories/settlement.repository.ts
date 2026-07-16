import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingSettlement, BookingSettlementDocument, SettlementStatus } from '../schemas/booking-settlement.schema';

@Injectable()
export class SettlementRepository {
  constructor(
    @InjectModel(BookingSettlement.name) private readonly settlementModel: Model<BookingSettlement>,
  ) {}

  async findSettlement(bookingId: Types.ObjectId, providerId: Types.ObjectId): Promise<BookingSettlementDocument | null> {
    return this.settlementModel.findOne({ bookingId, providerId });
  }

  async createSettlement(data: Partial<BookingSettlement>): Promise<BookingSettlementDocument> {
    return this.settlementModel.create(data);
  }

  async cancelSettlementsForBooking(bookingId: Types.ObjectId): Promise<void> {
    await this.settlementModel.updateMany(
      { bookingId },
      { $set: { settlementStatus: SettlementStatus.Cancelled } },
    );
  }
}
