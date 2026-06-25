import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class MockBankingService {
  private readonly logger = new Logger(MockBankingService.name);

  async executeAutoTransfer(
    bankCode: string,
    accountNumber: string,
    accountHolder: string,
    amount: number,
    reference: string,
  ): Promise<{ success: boolean; bankTxnId?: string; error?: string }> {
    try {
      this.logger.log(
        `Executing simulated bank payout: ${amount} VND to STK ${accountNumber} (${bankCode}) for ref ${reference}`,
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      if (accountNumber.startsWith('9999')) {
        return {
          success: false,
          error: 'Tài khoản đích bị khóa hoặc không tồn tại.',
        };
      }

      const mockBankTransactionId = `FT${Date.now()}${crypto
        .randomBytes(3)
        .toString('hex')
        .substring(0, 4)
        .toUpperCase()}`;

      this.logger.log(
        `Simulated transfer succeeded. Bank Transaction ID: ${mockBankTransactionId}`,
      );

      return {
        success: true,
        bankTxnId: mockBankTransactionId,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : 'Unknown bank transfer error',
      };
    }
  }
}
