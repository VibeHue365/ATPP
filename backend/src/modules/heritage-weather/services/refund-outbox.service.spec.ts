import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RefundOutboxService } from './refund-outbox.service';
import {
  OutboxStatus,
  RefundOutboxTask,
} from '../schemas/refund-outbox.schema';

describe('RefundOutboxService', () => {
  let service: RefundOutboxService;

  const mockTaskDoc = {
    _id: new Types.ObjectId(),
    sourceEventId: 'refund:weather_cancel:123',
    bookingId: new Types.ObjectId(),
    amount: 500000,
    reason: 'Hoàn tiền do hủy lịch bão',
    status: OutboxStatus.PENDING,
    retryCount: 0,
    lastAttemptAt: null,
    lastError: null,
  };

  const mockOutboxModel = {
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundOutboxService,
        {
          provide: getModelToken(RefundOutboxTask.name),
          useValue: mockOutboxModel,
        },
      ],
    }).compile();

    service = module.get<RefundOutboxService>(RefundOutboxService);
  });

  describe('enqueueRefund', () => {
    it('should idempotently upsert a refund task into outbox', async () => {
      mockOutboxModel.findOneAndUpdate.mockResolvedValueOnce(mockTaskDoc);

      const result = await service.enqueueRefund({
        bookingId: mockTaskDoc.bookingId.toString(),
        amount: 500000,
        reason: 'Hoàn tiền do hủy lịch bão',
        sourceEventId: 'refund:weather_cancel:123',
      });

      expect(mockOutboxModel.findOneAndUpdate).toHaveBeenCalledWith(
        { sourceEventId: 'refund:weather_cancel:123' },
        expect.objectContaining({
          $setOnInsert: expect.objectContaining({
            amount: 500000,
            status: OutboxStatus.PENDING,
          }),
        }),
        { upsert: true, new: true },
      );
      expect(result).toEqual(mockTaskDoc);
    });

    it('should gracefully handle duplicate key error (11000) and return existing record', async () => {
      const duplicateError: any = new Error('E11000 duplicate key');
      duplicateError.code = 11000;
      mockOutboxModel.findOneAndUpdate.mockRejectedValueOnce(duplicateError);
      mockOutboxModel.findOne.mockResolvedValueOnce(mockTaskDoc);

      const result = await service.enqueueRefund({
        bookingId: mockTaskDoc.bookingId.toString(),
        amount: 500000,
        reason: 'Hoàn tiền do hủy lịch bão',
        sourceEventId: 'refund:weather_cancel:123',
      });

      expect(mockOutboxModel.findOne).toHaveBeenCalledWith({
        sourceEventId: 'refund:weather_cancel:123',
      });
      expect(result).toEqual(mockTaskDoc);
    });
  });

  describe('getTask & getTaskById', () => {
    it('should find task by sourceEventId', async () => {
      mockOutboxModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockTaskDoc),
      });

      const result = await service.getTask('refund:weather_cancel:123');
      expect(result).toEqual(mockTaskDoc);
    });

    it('should find task by ID', async () => {
      const id = new Types.ObjectId().toString();
      mockOutboxModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockTaskDoc),
      });

      const result = await service.getTaskById(id);
      expect(result).toEqual(mockTaskDoc);
    });

    it('should return null for invalid ObjectId in getTaskById', async () => {
      const result = await service.getTaskById('invalid-id');
      expect(result).toBeNull();
    });
  });

  describe('listTasksByBooking & listTasksByStatus', () => {
    it('should list tasks for a specific booking', async () => {
      const bId = new Types.ObjectId();
      mockOutboxModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce([mockTaskDoc]),
        }),
      });

      const result = await service.listTasksByBooking(bId.toString());
      expect(result).toEqual([mockTaskDoc]);

      // Test with ObjectId instance
      mockOutboxModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce([mockTaskDoc]),
        }),
      });
      const resultObj = await service.listTasksByBooking(bId);
      expect(resultObj).toEqual([mockTaskDoc]);
    });

    it('should list tasks filtered by status', async () => {
      mockOutboxModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockReturnValueOnce({
            exec: jest.fn().mockResolvedValueOnce([mockTaskDoc]),
          }),
        }),
      });

      const result = await service.listTasksByStatus(OutboxStatus.PENDING, 10);
      expect(result).toEqual([mockTaskDoc]);
    });
  });
});
