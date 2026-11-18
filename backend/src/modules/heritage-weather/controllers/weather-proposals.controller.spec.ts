import { Test, TestingModule } from '@nestjs/testing';
import { WeatherProposalsController } from './weather-proposals.controller';
import { WeatherProposalsService } from '../services/weather-proposals.service';
import { ProposalChangeType } from '../schemas/weather-proposal.schema';

describe('WeatherProposalsController', () => {
  let controller: WeatherProposalsController;

  const mockService = {
    createProposal: jest.fn(),
    listProposalsByBooking: jest.fn(),
    getProposal: jest.fn(),
    respondProposal: jest.fn(),
    cancelProposal: jest.fn(),
    captureProposalPayment: jest.fn(),
  };

  const mockUser: any = {
    sub: 'user-123',
    roles: ['CUSTOMER'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeatherProposalsController],
      providers: [
        { provide: WeatherProposalsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<WeatherProposalsController>(
      WeatherProposalsController,
    );
  });

  it('should call createProposal', async () => {
    mockService.createProposal.mockResolvedValueOnce({ _id: 'prop-1' });

    const result = await controller.createProposal('bk-1', mockUser, {
      changeType: ProposalChangeType.LOCATION_ONLY,
      proposedSpotId: 'spot-1',
    });

    expect(mockService.createProposal).toHaveBeenCalledWith(
      'bk-1',
      'user-123',
      expect.objectContaining({ changeType: ProposalChangeType.LOCATION_ONLY }),
    );
    expect(result).toEqual({ _id: 'prop-1' });
  });

  it('should call listProposalsForBooking', async () => {
    mockService.listProposalsByBooking.mockResolvedValueOnce([{ _id: 'prop-1' }]);

    const result = await controller.listProposalsForBooking('bk-1');
    expect(mockService.listProposalsByBooking).toHaveBeenCalledWith('bk-1');
    expect(result).toHaveLength(1);
  });

  it('should call getProposal', async () => {
    mockService.getProposal.mockResolvedValueOnce({ _id: 'prop-1' });

    const result = await controller.getProposal('prop-1');
    expect(mockService.getProposal).toHaveBeenCalledWith('prop-1');
    expect(result).toEqual({ _id: 'prop-1' });
  });

  it('should call respondProposal', async () => {
    mockService.respondProposal.mockResolvedValueOnce({ _id: 'prop-1', status: 'APPLIED' });

    const result = await controller.respondProposal('prop-1', mockUser, {
      decision: 'APPROVED',
    });

    expect(mockService.respondProposal).toHaveBeenCalledWith(
      'prop-1',
      'user-123',
      { decision: 'APPROVED' },
    );
    expect(result.status).toBe('APPLIED');
  });

  it('should call cancelProposal', async () => {
    mockService.cancelProposal.mockResolvedValueOnce({ _id: 'prop-1', status: 'CANCELLED' });

    const result = await controller.cancelProposal('prop-1', mockUser);
    expect(mockService.cancelProposal).toHaveBeenCalledWith('prop-1', 'user-123');
    expect(result.status).toBe('CANCELLED');
  });

  it('should call capturePayment', async () => {
    mockService.captureProposalPayment.mockResolvedValueOnce({ success: true });

    const result = await controller.capturePayment({
      orderCode: 123456,
      amount: 50000,
    });

    expect(mockService.captureProposalPayment).toHaveBeenCalledWith(123456, 50000);
    expect(result.success).toBe(true);
  });
});
