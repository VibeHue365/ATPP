import { Injectable } from '@nestjs/common';

@Injectable()
export class SettlementTransferMapper {
  toProviderResponse(t: any): Record<string, any> {
    const bookingObj = t.bookingId as any;
    return {
      id: t.transactionReference || t._id?.toString(),
      bookingId: bookingObj?._id || '',
      bookingCode: bookingObj?.bookingCode || '',
      amount: t.amountSent || 0,
      bank: t.destinationBankAccount?.bankName || '',
      account: t.destinationBankAccount?.accountNumber || '',
      accountHolder: t.destinationBankAccount?.accountHolder || '',
      status: t.status || 'PENDING',
      date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('vi-VN') : '',
      errorMessage: t.errorMessage || null,
    };
  }

  toProviderResponseList(transfers: any[]): Record<string, any>[] {
    return transfers.map((t) => this.toProviderResponse(t));
  }
}
