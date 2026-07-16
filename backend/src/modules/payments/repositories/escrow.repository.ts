import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingEscrow, BookingEscrowDocument, EscrowStatus } from '../schemas/booking-escrow.schema';

@Injectable()
export class EscrowRepository {
  constructor(
    @InjectModel(BookingEscrow.name) private readonly escrowModel: Model<BookingEscrow>,
  ) {}

  async createOrUpdateEscrow(
    bookingId: Types.ObjectId,
    totalAmountCollected: number,
    damageDepositAmount: number,
  ): Promise<BookingEscrowDocument> {
    return this.escrowModel.findOneAndUpdate(
      { bookingId },
      {
        $set: {
          totalAmountCollected,
          damageDepositAmount,
          status: EscrowStatus.Held,
        },
      },
      { upsert: true, new: true },
    );
  }

  async findByBookingId(bookingId: Types.ObjectId): Promise<BookingEscrowDocument | null> {
    return this.escrowModel.findOne({ bookingId });
  }

  async updateEscrowStatus(bookingId: Types.ObjectId, status: EscrowStatus): Promise<void> {
    await this.escrowModel.updateOne({ bookingId }, { $set: { status } });
  }

  async trySettleEscrow(bookingId: Types.ObjectId): Promise<BookingEscrowDocument | null> {
    return this.escrowModel.findOneAndUpdate(
      { bookingId, status: EscrowStatus.Held },
      { $set: { status: EscrowStatus.Settled } },
      { new: false },
    );
  }
}
