import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { RefundOutboxSweeperService } from './refund-outbox-sweeper.service';
import {
  OutboxStatus,
  RefundOutboxTask,
} from '../schemas/refund-outbox.schema';
import {
  PayOSRefundRejectedError,
  PayOSRefundService,
} from '../../payments/services/payos-refund.service';
import { Payment } from '../../payments/schemas/payment.schema';
import { RefundRequest, RefundStatus } from '../../payments/schemas/refund-request.schema';
import { Booking } from '../../bookings/schemas/booking.schema';

describe('RefundOutboxSweeperService', () => {
  let service: RefundOutboxSweeperService;

  const mockOutboxModel = {
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockPaymentModel = {
    findOne: jest.fn(),
  };

  const mockRefundRequestModel = {
    updateOne: jest.fn(),
  };

  const mockBookingModel = {
    updateOne: jest.fn(),
  };

  const mockPayOSRefundService = {
    refundPayment: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test'),
  };

  const createMockTask = (overrides?: any) => ({
    _id: new Types.ObjectId(),
    sourceEventId: 'refund:test:1',
    bookingId: new Types.ObjectId(),
    amount: 300000,
    reason: 'Test refund',
    status: OutboxStatus.PENDING,
    retryCount: 0,
    lastAttemptAt: null,
    lastError: null,
    refundRequestId: new Types.ObjectId(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundOutboxSweeperService,
        {
          provide: getModelToken(RefundOutboxTask.name),
          useValue: mockOutboxModel,
        },
        {
          provide: getModelToken(Payment.name),
          useValue: mockPaymentModel,
        },
        {
          provide: getModelToken(RefundRequest.name),
          useValue: mockRefundRequestModel,
        },
        {
          provide: getModelToken(Booking.name),
          useValue: mockBookingModel,
        },
        {
          provide: PayOSRefundService,
          useValue: mockPayOSRefundService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RefundOutboxSweeperService>(RefundOutboxSweeperService);
  });

  describe('processSingleTask', () => {
    it('should successfully refund via PayOS and mark task COMPLETED', async () => {
      const task = createMockTask();
      mockOutboxModel.findOneAndUpdate.mockResolvedValueOnce(task);

      mockPaymentModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce({
            payos: { orderCode: 123456 },
          }),
        }),
      });

      mockPayOSRefundService.refundPayment.mockResolvedValueOnce({
        status: 'COMPLETED',
        amount: 300000,
        orderCode: 123456,
      });

      const handled = await service.processSingleTask(task as any);

      expect(handled).toBe(true);
      expect(mockPayOSRefundService.refundPayment).toHaveBeenCalledWith(123456, 300000);
      expect(mockOutboxModel.updateOne).toHaveBeenCalledWith(
        { _id: task._id },
        expect.objectContaining({
          $set: expect.objectContaining({ status: OutboxStatus.COMPLETED }),
        }),
      );
      expect(mockRefundRequestModel.updateOne).toHaveBeenCalledWith(
        { _id: task.refundRequestId },
        expect.objectContaining({
          $set: expect.objectContaining({ status: RefundStatus.Completed }),
        }),
      );
    });

    it('should mark task FAILED when PayOS throws PayOSRefundRejectedError', async () => {
      const task = createMockTask();
      mockOutboxModel.findOneAndUpdate.mockResolvedValueOnce(task);

      mockPaymentModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce({
            payos: { orderCode: 123456 },
          }),
        }),
      });

      mockPayOSRefundService.refundPayment.mockRejectedValueOnce(
        new PayOSRefundRejectedError('Số dư chi hộ không đủ'),
      );

      const handled = await service.processSingleTask(task as any);

      expect(handled).toBe(false);
      expect(mockOutboxModel.updateOne).toHaveBeenCalledWith(
        { _id: task._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: OutboxStatus.FAILED,
            lastError: 'Số dư chi hộ không đủ',
          }),
        }),
      );
    });

    it('should increment retryCount and remain PENDING on transient error when retries < 3', async () => {
      const task = createMockTask({ retryCount: 1 });
      mockOutboxModel.findOneAndUpdate.mockResolvedValueOnce(task);

      mockPaymentModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce({
            payos: { orderCode: 123456 },
          }),
        }),
      });

      mockPayOSRefundService.refundPayment.mockRejectedValueOnce(
        new Error('Network timeout'),
      );

      const handled = await service.processSingleTask(task as any);

      expect(handled).toBe(false);
      expect(mockOutboxModel.updateOne).toHaveBeenCalledWith(
        { _id: task._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: OutboxStatus.PENDING,
            retryCount: 2,
            lastError: 'Network timeout',
          }),
        }),
      );
    });

    it('should transition to NEEDS_MANUAL_REVIEW when retries reach 3 to prevent double refund', async () => {
      const task = createMockTask({ retryCount: 2 });
      mockOutboxModel.findOneAndUpdate.mockResolvedValueOnce(task);

      mockPaymentModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce({
            payos: { orderCode: 123456 },
          }),
        }),
      });

      mockPayOSRefundService.refundPayment.mockRejectedValueOnce(
        new Error('Network error 504 Gateway Timeout'),
      );

      const handled = await service.processSingleTask(task as any);

      expect(handled).toBe(false);
      expect(mockOutboxModel.updateOne).toHaveBeenCalledWith(
        { _id: task._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: OutboxStatus.NEEDS_MANUAL_REVIEW,
            retryCount: 3,
            lastError: 'Network error 504 Gateway Timeout',
          }),
        }),
      );
    });
  });

  describe('sweepPendingRefunds', () => {
    it('should query pending and stale processing tasks and process them', async () => {
      const task1 = createMockTask();
      const task2 = createMockTask();

      mockOutboxModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockReturnValueOnce({
            exec: jest.fn().mockResolvedValueOnce([task1, task2]),
          }),
        }),
      });

      jest.spyOn(service, 'processSingleTask').mockResolvedValue(true);

      const count = await service.sweepPendingRefunds();

      expect(count).toBe(2);
      expect(service.processSingleTask).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no tasks are pending', async () => {
      mockOutboxModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockReturnValueOnce({
            exec: jest.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      const count = await service.sweepPendingRefunds();
      expect(count).toBe(0);
    });

    it('should skip sweep if previous sweep is still running', async () => {
      (service as any).isRunning = true;
      const count = await service.sweepPendingRefunds();
      expect(count).toBe(0);
      expect(mockOutboxModel.find).not.toHaveBeenCalled();
    });

    it('should return false if atomic lock cannot be acquired', async () => {
      const task = createMockTask();
      mockOutboxModel.findOneAndUpdate.mockResolvedValueOnce(null);

      const handled = await service.processSingleTask(task as any);
      expect(handled).toBe(false);
    });

    it('should fail with error when in production and no payment record exists', async () => {
      const task = createMockTask();
      mockOutboxModel.findOneAndUpdate.mockResolvedValueOnce(task);
      mockConfigService.get.mockReturnValueOnce('production');

      mockPaymentModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce(null),
        }),
      });

      const handled = await service.processSingleTask(task as any);
      expect(handled).toBe(false);
      expect(mockOutboxModel.updateOne).toHaveBeenCalledWith(
        { _id: task._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: OutboxStatus.PENDING,
            retryCount: 1,
            lastError: expect.stringContaining('No successful PayOS payment record found'),
          }),
        }),
      );
    });
  });
});
