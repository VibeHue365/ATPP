import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class PayOSRefundRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayOSRefundRejectedError';
  }
}

export interface PayOSRefundResult {
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
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isMock =
      this.configService.get<string>('PAYOS_REFUND_MOCK') === 'true' ||
      ((!this.payOSClientId || this.payOSClientId.includes('your_')) && nodeEnv !== 'production');

    if (isMock) {
      if (nodeEnv === 'production') {
        throw new Error('Không được bật PAYOS_REFUND_MOCK ở môi trường production');
      }
      this.logger.warn(
        `PAYOS_REFUND_MOCK is enabled in ${nodeEnv}. Returning mock refund response.`,
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      return {
        status: 'REFUNDED_MOCK',
        amount,
        orderCode,
        refundId: `MOCK_REFUND_${Date.now()}`,
      };
    }

    if (
      !this.payOSClientId ||
      !this.payOSApiKey ||
      this.payOSClientId.includes('your_') ||
      this.payOSApiKey.includes('your_')
    ) {
      throw new ServiceUnavailableException('Chưa cấu hình payOS credentials.');
    }

    this.logger.log(
      `Initiating payOS Refund for orderCode: ${orderCode}, amount: ${amount}`,
    );

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
      throw new PayOSRefundRejectedError(
        resData.message || `payOS API returned status ${response.status}`,
      );
    }

    this.logger.log(
      `payOS Refund request succeeded for orderCode: ${orderCode}`,
    );
    return resData.data as unknown as PayOSRefundResult;
  }
}
