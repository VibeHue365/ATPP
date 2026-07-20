import { Types } from 'mongoose';
import { ProviderOcrOutboxService } from './provider-ocr-outbox.service';
import { OcrOutboxStatus } from '../schemas/provider-verification-ocr-outbox.schema';
import { ProviderDocumentType } from '../schemas/provider-verification.schema';

describe('ProviderOcrOutboxService delivery retry policy', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');
  let verificationModel: { updateOne: jest.Mock };
  let outboxModel: { updateOne: jest.Mock };
  let service: ProviderOcrOutboxService;

  beforeEach(() => {
    verificationModel = { updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }) };
    outboxModel = { updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }) };
    service = new ProviderOcrOutboxService(
      verificationModel as any,
      outboxModel as any,
      {} as any,
      {
        get: (key: string, fallback: string) =>
          key === 'OCR_OUTBOX_MAX_DELIVERY_ATTEMPTS' ? '3' : fallback,
      } as any,
    );
  });

  it('schedules a bounded exponential retry after a delivery failure', async () => {
    await (service as any).recordDeliveryFailure(
      {
        _id: new Types.ObjectId(),
        verificationId: new Types.ObjectId(),
        documentType: ProviderDocumentType.IdentityCardFront,
        versionNo: 1,
        attemptId: 'attempt-1',
        deliveryAttempts: 0,
      },
      now,
    );

    expect(outboxModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $inc: { deliveryAttempts: 1 },
        $set: expect.objectContaining({
          status: OcrOutboxStatus.Failed,
          nextAttemptAt: new Date(now.getTime() + 30_000),
        }),
      }),
    );
    expect(verificationModel.updateOne).not.toHaveBeenCalled();
  });

  it('moves the event to dead letter after the configured limit', async () => {
    await (service as any).recordDeliveryFailure(
      {
        _id: new Types.ObjectId(),
        verificationId: new Types.ObjectId(),
        documentType: ProviderDocumentType.IdentityCardFront,
        versionNo: 1,
        attemptId: 'attempt-3',
        deliveryAttempts: 2,
      },
      now,
    );

    expect(outboxModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: OcrOutboxStatus.DeadLetter,
          deadLetteredAt: now,
          nextAttemptAt: null,
        }),
      }),
    );
    expect(verificationModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          'documents.$[d].versions.$[v].ocr.executionStatus': 'FAILED',
          'documents.$[d].versions.$[v].ocr.warningCodes': [
            'OCR_QUEUE_DELIVERY_FAILED',
          ],
        }),
      }),
      expect.anything(),
    );
  });
});