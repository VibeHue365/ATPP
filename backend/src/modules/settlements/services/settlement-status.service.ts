import { BadRequestException, Injectable } from '@nestjs/common';
import { SettlementStatus } from '../constants/settlement-status.enum';
import { SETTLEMENT_ERROR_CODES } from '../constants/settlement-error-codes';

@Injectable()
export class SettlementStatusService {
  assertCanHold(status: SettlementStatus): void {
    if (status !== SettlementStatus.ReadyToSettle) {
      throw new BadRequestException(
        SETTLEMENT_ERROR_CODES.StatusTransitionInvalid,
      );
    }
  }

  assertCanRelease(status: SettlementStatus): void {
    if (status !== SettlementStatus.OnHold) {
      throw new BadRequestException(
        SETTLEMENT_ERROR_CODES.StatusTransitionInvalid,
      );
    }
  }

  assertCanMarkSettled(status: SettlementStatus, payableAmount: number): void {
    if (status !== SettlementStatus.ReadyToSettle || payableAmount <= 0) {
      throw new BadRequestException(
        SETTLEMENT_ERROR_CODES.StatusTransitionInvalid,
      );
    }
  }
}
