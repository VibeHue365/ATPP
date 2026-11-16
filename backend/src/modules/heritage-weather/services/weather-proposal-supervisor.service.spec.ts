import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { WeatherProposalSupervisorService } from './weather-proposal-supervisor.service';
import {
  ProposalStatus,
  WeatherProposal,
} from '../schemas/weather-proposal.schema';
import { Booking } from '../../bookings/schemas/booking.schema';
import { RedisService } from '../../../common/redis/redis.service';

describe('WeatherProposalSupervisorService', () => {
  let service: WeatherProposalSupervisorService;

  const mockProposalModel: any = {
    find: jest.fn(),
  };

  const mockBookingModel: any = {
    updateOne: jest.fn(),
  };

  const mockRedisService: any = {
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherProposalSupervisorService,
        { provide: getModelToken(WeatherProposal.name), useValue: mockProposalModel },
        { provide: getModelToken(Booking.name), useValue: mockBookingModel },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<WeatherProposalSupervisorService>(
      WeatherProposalSupervisorService,
    );
  });

  describe('sweepExpiredProposals', () => {
    it('should expire pending proposals whose TTL has passed and release Redis hold', async () => {
      const expiredProposal = {
        _id: new Types.ObjectId(),
        bookingId: new Types.ObjectId(),
        status: ProposalStatus.PENDING,
        temporaryHoldRef: 'hold:photographer:123',
        save: jest.fn().mockResolvedValue(true),
      };

      // First call returns expired pending, second call returns empty payments
      mockProposalModel.find
        .mockResolvedValueOnce([expiredProposal])
        .mockResolvedValueOnce([]);

      const count = await service.sweepExpiredProposals();

      expect(count).toBe(1);
      expect(expiredProposal.status).toBe(ProposalStatus.EXPIRED);
      expect(mockRedisService.del).toHaveBeenCalledWith('hold:photographer:123');
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: expiredProposal.bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({ hasPendingWeatherAction: false }),
        }),
      );
    });

    it('should expire approved proposals whose payment TTL has passed', async () => {
      const expiredPaymentProposal = {
        _id: new Types.ObjectId(),
        bookingId: new Types.ObjectId(),
        status: ProposalStatus.APPROVED_PENDING_PAYMENT,
        temporaryHoldRef: 'hold:photographer:456',
        save: jest.fn().mockResolvedValue(true),
      };

      mockProposalModel.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([expiredPaymentProposal]);

      const count = await service.sweepExpiredProposals();

      expect(count).toBe(1);
      expect(expiredPaymentProposal.status).toBe(ProposalStatus.EXPIRED);
      expect(mockRedisService.del).toHaveBeenCalledWith('hold:photographer:456');
    });

    it('should return 0 when no proposals are expired', async () => {
      mockProposalModel.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const count = await service.sweepExpiredProposals();
      expect(count).toBe(0);
    });
  });
});
