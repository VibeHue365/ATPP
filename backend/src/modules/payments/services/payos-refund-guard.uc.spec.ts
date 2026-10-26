import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOSRefundService } from './payos-refund.service';

function service(values: Record<string, string>) {
  return new PayOSRefundService({
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService);
}

describe('UC-51 Refund - payOS production safeguards (HuyLDN)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('UT-51 UTCID13 refuses the refund mock flag in production', async () => {
    global.fetch = jest.fn();

    await expect(
      service({
        NODE_ENV: 'production',
        PAYOS_REFUND_MOCK: 'true',
      }).refundPayment(101, 300000),
    ).rejects.toThrow(
      'Không được bật PAYOS_REFUND_MOCK ở môi trường production',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('UT-51 UTCID14 reports missing payOS credentials in production instead of simulating', async () => {
    global.fetch = jest.fn();

    await expect(
      service({ NODE_ENV: 'production' }).refundPayment(102, 300000),
    ).rejects.toThrow(
      new ServiceUnavailableException('Chưa cấu hình payOS credentials.'),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
