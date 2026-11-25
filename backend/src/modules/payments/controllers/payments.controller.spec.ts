import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';

describe('PaymentsController PayOS webhook', () => {
  const body = {
    code: '00',
    desc: 'success',
    data: { orderCode: 123456, status: 'PAID' },
    signature: 'simulator-signature',
  };

  function createController(
    claimState: 'claimed' | 'processed' | 'processing' = 'claimed',
  ) {
    const paymentsService = {
      confirmPayment: jest.fn().mockResolvedValue({}),
      failPayment: jest.fn().mockResolvedValue({}),
    };
    const configService = { get: jest.fn().mockReturnValue('') };
    const paymentsRepository = {
      findByOrderCode: jest.fn().mockResolvedValue({ paymentCode: 'PAY123' }),
    };
    const webhookEventRepository = {
      claimVerifiedEvent: jest
        .fn()
        .mockResolvedValue({ state: claimState, event: {} }),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      markError: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new PaymentsController(
      paymentsService as any,
      configService as any,
      paymentsRepository as any,
      webhookEventRepository as any,
    );
    return {
      controller,
      paymentsService,
      paymentsRepository,
      webhookEventRepository,
    };
  }

  it('processes a claimed PAID event exactly once', async () => {
    const fixture = createController('claimed');

    await expect(
      fixture.controller.handlePayOSWebhook(body as any),
    ).resolves.toEqual({ status: 'success' });

    expect(
      fixture.webhookEventRepository.claimVerifiedEvent,
    ).toHaveBeenCalledWith('payos_123456_PAID', body.data, body.signature);
    expect(fixture.paymentsService.confirmPayment).toHaveBeenCalledWith(
      'PAY123',
    );
    expect(fixture.webhookEventRepository.markProcessed).toHaveBeenCalledWith(
      'payos_123456_PAID',
    );
  });

  it('does not apply payment again for an already processed or in-progress event', async () => {
    const processed = createController('processed');
    const processing = createController('processing');

    await expect(
      processed.controller.handlePayOSWebhook(body as any),
    ).resolves.toEqual({
      status: 'success',
      note: 'already_processed',
    });
    await expect(
      processing.controller.handlePayOSWebhook(body as any),
    ).resolves.toEqual({
      status: 'success',
      note: 'already_processing',
    });

    expect(processed.paymentsService.confirmPayment).not.toHaveBeenCalled();
    expect(processing.paymentsService.confirmPayment).not.toHaveBeenCalled();
  });

  it('records a processing failure so a later webhook delivery can retry', async () => {
    const fixture = createController('claimed');
    fixture.paymentsRepository.findByOrderCode.mockResolvedValue(null);

    await expect(
      fixture.controller.handlePayOSWebhook(body as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.webhookEventRepository.markError).toHaveBeenCalledWith(
      'payos_123456_PAID',
      expect.stringContaining('Không tìm thấy giao dịch PayOS'),
    );
  });

  it.each(['FAILED', 'EXPIRED'])(
    'releases a booking for %s payment',
    async (status) => {
      const fixture = createController('claimed');
      await fixture.controller.handlePayOSWebhook({
        ...body,
        data: { orderCode: 123456, status },
      });
      expect(fixture.paymentsService.failPayment).toHaveBeenCalledWith(
        'PAY123',
        expect.any(String),
      );
      expect(fixture.paymentsService.confirmPayment).not.toHaveBeenCalled();
    },
  );

  it('rejects a paid webhook with a mismatched amount', async () => {
    const fixture = createController('claimed');
    fixture.paymentsRepository.findByOrderCode.mockResolvedValue({
      paymentCode: 'PAY123',
      amount: 500000,
    });
    await expect(
      fixture.controller.handlePayOSWebhook({
        ...body,
        data: { ...body.data, amount: 1000 },
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fixture.paymentsService.confirmPayment).not.toHaveBeenCalled();
  });

  describe('V2 webhook handling', () => {
    it('rejects V2 webhook when PAYOS_CHECKSUM_KEY is missing or contains placeholder', async () => {
      const fixture = createController('claimed');
      fixture.paymentsRepository.findByOrderCode.mockResolvedValue({
        paymentCode: 'PAY-V2',
        contractBinding: { flowVersion: 2, currency: 'VND' },
      });

      await expect(
        fixture.controller.handlePayOSWebhook(body as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects V2 webhook when currency or amount mismatches', async () => {
      const fixture = createController('claimed');
      (fixture as any).controller.configService = {
        get: jest.fn().mockReturnValue('valid-checksum-key'),
      };
      fixture.paymentsRepository.findByOrderCode.mockResolvedValue({
        paymentCode: 'PAY-V2',
        amount: 500000,
        payos: { orderCode: 123456 },
        contractBinding: { flowVersion: 2, currency: 'VND' },
      });

      // Mismatched currency
      await expect(
        fixture.controller.handlePayOSWebhook({
          ...body,
          data: {
            orderCode: 123456,
            status: 'PAID',
            amount: 500000,
            currency: 'USD',
          },
          signature: 'valid-sig',
        } as any),
      ).rejects.toThrow(BadRequestException);

      // Mismatched amount
      await expect(
        fixture.controller.handlePayOSWebhook({
          ...body,
          data: {
            orderCode: 123456,
            status: 'PAID',
            amount: 499999,
            currency: 'VND',
          },
          signature: 'valid-sig',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls confirmPayment with evidence { source: "WEBHOOK", orderCode } and stores minimal audit data for V2', async () => {
      const fixture = createController('claimed');
      (fixture as any).controller.configService = {
        get: jest.fn().mockReturnValue('valid-checksum-key'),
      };
      // Mock verifyPayOSSignature to return true
      (fixture.controller as any).verifyPayOSSignature = jest
        .fn()
        .mockReturnValue(true);

      fixture.paymentsRepository.findByOrderCode.mockResolvedValue({
        paymentCode: 'PAY-V2',
        amount: 500000,
        payos: { orderCode: 123456 },
        contractBinding: { flowVersion: 2, currency: 'VND' },
      });

      const res = await fixture.controller.handlePayOSWebhook({
        ...body,
        data: {
          orderCode: 123456,
          status: 'PAID',
          amount: 500000,
          currency: 'VND',
        },
        signature: 'valid-sig',
      });

      expect(res).toEqual({ status: 'success' });
      expect(fixture.paymentsService.confirmPayment).toHaveBeenCalledWith(
        'PAY-V2',
        {
          source: 'WEBHOOK',
          orderCode: 123456,
        },
      );
      expect(
        fixture.webhookEventRepository.claimVerifiedEvent,
      ).toHaveBeenCalledWith(
        'payos_123456_PAID',
        { orderCode: 123456, status: 'PAID', amount: 500000, currency: 'VND' },
        null, // signature redacted for V2 minimal audit
      );
    });
  });

  describe('Simulator environment guard', () => {
    it('allows simulator when NODE_ENV is unset/undefined (defaults to development)', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      const fixture = createController();
      (fixture.controller as any).configService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'NODE_ENV') return undefined;
          if (key === 'ENABLE_PAYMENT_SIMULATOR') return undefined;
          return '';
        }),
      };
      expect(() =>
        (fixture.controller as any).ensureSimulatorEnabled(),
      ).not.toThrow();
      process.env.NODE_ENV = originalEnv;
    });

    it('blocks simulator when NODE_ENV is production and simulator not explicitly enabled', () => {
      const fixture = createController();
      (fixture.controller as any).configService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'NODE_ENV') return 'production';
          if (key === 'ENABLE_PAYMENT_SIMULATOR') return 'false';
          return '';
        }),
      };
      expect(() =>
        (fixture.controller as any).ensureSimulatorEnabled(),
      ).toThrow(NotFoundException);
    });

    it('allows simulator in production when ENABLE_PAYMENT_SIMULATOR is true', () => {
      const fixture = createController();
      (fixture.controller as any).configService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'NODE_ENV') return 'production';
          if (key === 'ENABLE_PAYMENT_SIMULATOR') return 'true';
          return '';
        }),
      };
      expect(() =>
        (fixture.controller as any).ensureSimulatorEnabled(),
      ).not.toThrow();
    });
  });
});
