/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { PayOSRefundService } from './payos-refund.service';

describe('PayOSRefundService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function service(values: Record<string, string> = {}) {
    return new PayOSRefundService({
      get: jest.fn((key: string, fallback: string) => values[key] ?? fallback),
    } as unknown as ConfigService);
  }

  it('simulates a refund when credentials are missing', async () => {
    const result = await service().refundPayment(123, 500000);
    expect(result).toMatchObject({
      status: 'REFUNDED',
      amount: 500000,
      orderCode: 123,
    });
    expect(result.refundId).toMatch(/^MOCK_REFUND_/);
  });

  it('returns the successful payOS response', async () => {
    const payload = {
      status: 'REFUNDED',
      amount: 200000,
      orderCode: 456,
      refundId: 'refund-1',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest
        .fn()
        .mockResolvedValue({ error: 0, message: 'success', data: payload }),
    });
    await expect(
      service({
        PAYOS_CLIENT_ID: 'client',
        PAYOS_API_KEY: 'api-key',
      }).refundPayment(456, 200000),
    ).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/456/refund'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-client-id': 'client',
          'x-api-key': 'api-key',
        }),
      }),
    );
  });

  it('falls back safely when payOS rejects or the network fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: jest
        .fn()
        .mockResolvedValue({ error: 1, message: 'refund rejected', data: {} }),
    });
    await expect(
      service({
        PAYOS_CLIENT_ID: 'client',
        PAYOS_API_KEY: 'api-key',
      }).refundPayment(789, 100000),
    ).resolves.toMatchObject({
      status: 'REFUNDED_SIMULATED',
      amount: 100000,
      orderCode: 789,
    });
  });
});
