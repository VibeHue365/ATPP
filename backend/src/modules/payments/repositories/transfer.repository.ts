import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SettlementTransfer, SettlementTransferDocument } from '../schemas/settlement-transfer.schema';

@Injectable()
export class TransferRepository {
  constructor(
    @InjectModel(SettlementTransfer.name) private readonly transferModel: Model<SettlementTransfer>,
  ) {}

  async findTransfersByProvider(providerId: Types.ObjectId): Promise<SettlementTransferDocument[]> {
    return this.transferModel
      .find({ providerId })
      .populate('bookingId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async createTransfer(data: Partial<SettlementTransfer>): Promise<SettlementTransferDocument> {
    return this.transferModel.create(data);
  }
}
