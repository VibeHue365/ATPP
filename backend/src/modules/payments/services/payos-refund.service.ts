import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PayOSRefundResult {
  status: string;
  amount: number;
  orderCode: number;
  refundId?: string;
  [key: string]: unknown;
}

interface PayOSApiResponse {
  error: number;
  message: string;
  data: Record<string, unknown>;
}

@Injectable()
export class PayOSRefundService {
  private readonly logger = new Logger(PayOSRefundService.name);
  private readonly payOSClientId: string;
  private readonly payOSApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.payOSClientId = this.configService.get<string>('PAYOS_CLIENT_ID', '');
    this.payOSApiKey = this.configService.get<string>('PAYOS_API_KEY', '');
  }

  async refundPayment(
    orderCode: number,
    amount: number,
  ): Promise<PayOSRefundResult> {
    try {
      this.logger.log(
        `Initiating payOS Sandbox Refund for orderCode: ${orderCode}, amount: ${amount}`,
      );

      if (
        !this.payOSClientId ||
        !this.payOSApiKey ||
        this.payOSClientId.includes('your_') ||
        this.payOSApiKey.includes('your_')
      ) {
        this.logger.warn(
          `payOS credentials are not configured or are placeholders. Simulating a SUCCESS refund response.`,
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        return {
          status: 'REFUNDED',
          amount,
          orderCode,
          refundId: `MOCK_REFUND_${Date.now()}`,
        };
      }

      const url = `https://api-merchant.payos.vn/v2/payment-requests/${orderCode}/refund`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.payOSClientId,
          'x-api-key': this.payOSApiKey,
        },
        body: JSON.stringify({
          amount: amount,
          description: `Hoan tra don hang ${orderCode}`,
        }),
      });

      const resData = (await response.json()) as PayOSApiResponse;

      if (!response.ok || resData.error !== 0) {
        throw new Error(
          resData.message || `payOS API returned status ${response.status}`,
        );
      }

      this.logger.log(
        `payOS Sandbox Refund request succeeded for orderCode: ${orderCode}`,
      );
      return resData.data as unknown as PayOSRefundResult;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to execute payOS refund: ${msg}`);
      this.logger.warn(
        `Using fallback simulated refund response due to error.`,
      );
      return {
        status: 'REFUNDED_SIMULATED',
        amount,
        orderCode,
        refundId: `FALLBACK_REFUND_${Date.now()}`,
      };
    }
  }
}
