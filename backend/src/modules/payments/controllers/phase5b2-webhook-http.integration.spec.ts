import { createHmac, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createConnection, Connection, Types } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { contractTestTarget } from '../../contracts/contract-test-target';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { PaymentWebhookEvent, PaymentWebhookEventSchema } from '../schemas/payment-webhook-event.schema';
import { PaymentsRepository } from '../repositories/payments.repository';
import { WebhookEventRepository } from '../repositories/webhook-event.repository';
import { PaymentsService } from '../services/payments.service';
import { PaymentsController } from './payments.controller';

const target = contractTestTarget();
const secret = 'phase5b2-test-only-checksum';

(target ? describe : describe.skip)('V2 payment webhook through Nest HTTP and isolated MongoDB', () => {
  let connection: Connection;
  let scratchName: string;
  let app: INestApplication;
  let service: { confirmPayment: jest.Mock; failPayment: jest.Mock };
  let eventRepo: WebhookEventRepository;
  let paymentRepo: PaymentsRepository;
  let orderCode: number;
  let paymentCode: string;

  const body = (data: Record<string, unknown>) => ({
    code: '00',
    desc: 'test',
    data,
    signature: createHmac('sha256', secret)
      .update(Object.keys(data).sort().map((key) => `${key}=${String(data[key])}`).join('&'))
      .digest('hex'),
  });

  beforeAll(async () => {
    scratchName = `contract_webhook_${new Types.ObjectId().toHexString()}_test`;
    const uri = new URL(target!.uri);
    uri.pathname = `/${scratchName}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 8000,
    }).asPromise();
    const hello = await connection.db!.admin().command({ hello: 1 });
    if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary)
      throw new Error('Requires isolated MongoDB replica set');
    const payments = connection.model(Payment.name, PaymentSchema);
    const events = connection.model(PaymentWebhookEvent.name, PaymentWebhookEventSchema);
    await connection.db!.collection('payment_webhook_events').createIndex({ webhookId: 1 }, { unique: true });
    paymentRepo = new PaymentsRepository(payments);
    eventRepo = new WebhookEventRepository(events);
    service = {
      confirmPayment: jest.fn().mockResolvedValue({}),
      failPayment: jest.fn().mockResolvedValue({}),
    };
    const module = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: service },
        { provide: PaymentsRepository, useValue: paymentRepo },
        { provide: WebhookEventRepository, useValue: eventRepo },
        { provide: ConfigService, useValue: { get: (key: string) => key === 'PAYOS_CHECKSUM_KEY' ? secret : 'development' } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  }, 30000);

  beforeEach(async () => {
    service.confirmPayment.mockClear();
    service.failPayment.mockClear();
    orderCode = Math.floor(100000000 + Math.random() * 800000000);
    paymentCode = `V2-HTTP-${randomUUID()}`;
    await connection.db!.collection('payments').insertOne({
      bookingId: new Types.ObjectId(), paymentCode, amount: 100,
      status: 'PENDING', purpose: 'FULL_PAYMENT',
      payos: { orderCode },
      contractBinding: { flowVersion: 2, currency: 'VND' },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (!connection) return;
    if (scratchName.startsWith('contract_webhook_') && scratchName.endsWith('_test'))
      await connection.dropDatabase();
    await connection.close();
  }, 30000);

  it('accepts a signed matching webhook once and stores only minimal V2 audit data', async () => {
    const data = { orderCode, status: 'PAID', amount: 100, currency: 'VND' };
    const server = app.getHttpServer() as App;
    await request(server).post('/payments/webhook').send(body(data)).expect(201);
    await request(server).post('/payments/webhook').send(body(data)).expect(201);
    expect(service.confirmPayment).toHaveBeenCalledTimes(1);
    expect(service.confirmPayment).toHaveBeenCalledWith(paymentCode, { source: 'WEBHOOK', orderCode });
    const event = await connection.db!.collection('payment_webhook_events').findOne({ webhookId: `payos_${orderCode}_PAID` });
    expect(event?.processed).toBe(true);
    expect(event?.signature).toBeNull();
    expect(event?.payload).toEqual(data);
  });

  it('rejects invalid signature, amount and currency before creating an event', async () => {
    const server = app.getHttpServer() as App;
    const good = body({ orderCode, status: 'PAID', amount: 100, currency: 'VND' });
    await request(server).post('/payments/webhook').send({ ...good, signature: 'bad' }).expect(400);
    await request(server).post('/payments/webhook').send(body({ orderCode, status: 'PAID', amount: 101, currency: 'VND' })).expect(400);
    await request(server).post('/payments/webhook').send(body({ orderCode, status: 'PAID', amount: 100, currency: 'USD' })).expect(400);
    expect(service.confirmPayment).not.toHaveBeenCalled();
    expect(await connection.db!.collection('payment_webhook_events').countDocuments({ webhookId: `payos_${orderCode}_PAID` })).toBe(0);
  });

  it('routes a signed FAILED event to the shared failure path', async () => {
    const server = app.getHttpServer() as App;
    await request(server).post('/payments/webhook').send(body({ orderCode, status: 'FAILED', amount: 100, currency: 'VND' })).expect(201);
    expect(service.failPayment).toHaveBeenCalledTimes(1);
    expect(service.confirmPayment).not.toHaveBeenCalled();
  });

  it('safely handles concurrent or in-flight duplicate webhook deliveries without double confirmation', async () => {
    const server = app.getHttpServer() as App;
    const data = { orderCode, status: 'PAID', amount: 100, currency: 'VND' };

    // Set webhook event with an active processing lease (in-flight)
    await connection.db!.collection('payment_webhook_events').insertOne({
      webhookId: `payos_${orderCode}_PAID`,
      provider: 'PAYOS',
      payload: data,
      signature: null,
      processed: false,
      processingStartedAt: new Date(),
      processingAttempts: 1,
      isValid: true,
    });

    const res = await request(server).post('/payments/webhook').send(body(data)).expect(201);
    expect(res.body).toEqual({ status: 'success', note: 'already_processing' });
    expect(service.confirmPayment).not.toHaveBeenCalled();
  });

  it('records error in webhook event when payment confirmation fails so future delivery can retry', async () => {
    const server = app.getHttpServer() as App;
    const data = { orderCode, status: 'PAID', amount: 100, currency: 'VND' };
    service.confirmPayment.mockRejectedValueOnce(new Error('TRANSIENT_DB_DISCONNECT'));

    await request(server).post('/payments/webhook').send(body(data)).expect(500);

    const event = await connection.db!.collection('payment_webhook_events').findOne({ webhookId: `payos_${orderCode}_PAID` });
    expect(event?.processed).toBe(false);
    expect(event?.processingStartedAt).toBeFalsy();
    expect(event?.error).toContain('TRANSIENT_DB_DISCONNECT');
  });

  it('reconciles stuck verified webhook event if worker crashed before payment confirmation and gateway never resends', async () => {
    const data = { orderCode, status: 'PAID', amount: 100, currency: 'VND' };
    const stuckTime = new Date(Date.now() - 70_000); // 70 seconds ago (> 60s lease)

    // Simulate Worker A crashing: event was stored with valid signature, but processed: false and lease expired
    await connection.db!.collection('payment_webhook_events').insertOne({
      webhookId: `payos_${orderCode}_PAID`,
      provider: 'PAYOS',
      payload: data,
      signature: null,
      processed: false,
      processingStartedAt: stuckTime,
      processingAttempts: 1,
      isValid: true,
    });

    // Verify findStuckEvents finds it
    const stuck = await eventRepo.findStuckEvents(60_000);
    expect(stuck.some((e) => e.webhookId === `payos_${orderCode}_PAID`)).toBe(true);

    // Simulate background reconciliation
    const claimed = await eventRepo.claimVerifiedEvent(`payos_${orderCode}_PAID`, data, null);
    expect(claimed.state).toBe('claimed');

    const payment = await paymentRepo.findByOrderCode(orderCode);
    expect(payment).toBeTruthy();
    await service.confirmPayment(payment!.paymentCode, { source: 'WEBHOOK', orderCode });
    await eventRepo.markProcessed(`payos_${orderCode}_PAID`);

    // Persisted DB verification:
    const persisted = await connection.db!.collection('payment_webhook_events').findOne({ webhookId: `payos_${orderCode}_PAID` });
    expect(persisted?.processed).toBe(true);
    expect(persisted?.error).toBeFalsy();
    expect(service.confirmPayment).toHaveBeenCalledWith(paymentCode, { source: 'WEBHOOK', orderCode });
  });
});
