import { Test, TestingModule } from '@nestjs/testing';
import { AdminWeatherCancellationsController } from './admin-weather-cancellations.controller';
import { WeatherCancellationsService } from '../services/weather-cancellations.service';
import { CancellationReviewStatus } from '../schemas/weather-cancellation.schema';

describe('AdminWeatherCancellationsController', () => {
  let controller: AdminWeatherCancellationsController;

  const mockService = {
    listCancellationRequests: jest.fn(),
    getCancellationRequestById: jest.fn(),
    adminReviewCancellation: jest.fn(),
  };

  const mockAdminUser: any = {
    sub: 'admin-999',
    roles: ['ADMIN'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminWeatherCancellationsController],
      providers: [
        { provide: WeatherCancellationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<AdminWeatherCancellationsController>(
      AdminWeatherCancellationsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call listCancellationRequests', async () => {
    mockService.listCancellationRequests.mockResolvedValueOnce({
      items: [{ _id: 'req-1' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await controller.listCancellations({ page: 1, limit: 20 });

    expect(mockService.listCancellationRequests).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(res.items).toHaveLength(1);
  });

  it('should call getCancellationDetails', async () => {
    mockService.getCancellationRequestById.mockResolvedValueOnce({ _id: 'req-1' });

    const res = await controller.getCancellationDetails('req-1');

    expect(mockService.getCancellationRequestById).toHaveBeenCalledWith('req-1');
    expect(res).toEqual({ _id: 'req-1' });
  });

  it('should call reviewCancellation', async () => {
    mockService.adminReviewCancellation.mockResolvedValueOnce({
      _id: 'req-1',
      status: CancellationReviewStatus.APPROVED_FULL_REFUND,
    });

    const dto = {
      decision: CancellationReviewStatus.APPROVED_FULL_REFUND,
      notes: 'Hợp lệ',
    };

    const res = await controller.reviewCancellation('req-1', mockAdminUser, dto);

    expect(mockService.adminReviewCancellation).toHaveBeenCalledWith(
      'req-1',
      'admin-999',
      dto,
    );
    expect(res.status).toBe(CancellationReviewStatus.APPROVED_FULL_REFUND);
  });
});
