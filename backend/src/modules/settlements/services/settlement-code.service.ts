import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SETTLEMENT_ERROR_CODES } from '../constants/settlement-error-codes';
import { Settlement } from '../schemas/settlement.schema';

@Injectable()
export class SettlementCodeService {
  constructor(
    @InjectModel(Settlement.name)
    private readonly settlementModel: Model<Settlement>,
  ) {}

  async generateSettlementCode(): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const now = new Date();
      const datePart = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('');
      const randomPart = String(Math.floor(Math.random() * 1_000_000)).padStart(
        6,
        '0',
      );
      const code = `STL-${datePart}-${randomPart}`;
      const exists = await this.settlementModel.exists({ settlementCode: code });

      if (!exists) {
        return code;
      }
    }

    throw new Error(SETTLEMENT_ERROR_CODES.CodeGenerationFailed);
  }
}
