import { Test, TestingModule } from '@nestjs/testing';
import { WeatherCancellationsController } from './weather-cancellations.controller';
import { WeatherCancellationsService } from '../services/weather-cancellations.service';

describe('WeatherCancellationsController', () => {
  let controller: WeatherCancellationsController;

  const mockService = {
    submitCancellationRequest: jest.fn(),
    getBookingCancellationRequest: jest.fn(),
    getCancellationRequestById: jest.fn(),
  };

  const mockUser: any = {
    sub: 'user-123',
    roles: ['CUSTOMER'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeatherCancellationsController],
      providers: [
        { provide: WeatherCancellationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<WeatherCancellationsController>(
      WeatherCancellationsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call submitCancellationRequest', async () => {
    mockService.submitCancellationRequest.mockResolvedValueOnce({ _id: 'req-1' });

    const dto = {
      reason: 'Lũ lụt ngập đường di chuyển',
      evidencePhotos: ['https://example.com/flood.jpg'],
    };

    const res = await controller.submitCancellation('bk-100', mockUser, dto);

    expect(mockService.submitCancellationRequest).toHaveBeenCalledWith(
      'bk-100',
      'user-123',
      dto,
    );
    expect(res).toEqual({ _id: 'req-1' });
  });

  it('should call getBookingCancellationRequest', async () => {
    mockService.getBookingCancellationRequest.mockResolvedValueOnce({ _id: 'req-1' });

    const res = await controller.getBookingCancellation('bk-100', mockUser);

    expect(mockService.getBookingCancellationRequest).toHaveBeenCalledWith(
      'bk-100',
      'user-123',
    );
    expect(res).toEqual({ _id: 'req-1' });
  });

  it('should call getCancellationRequestById', async () => {
    mockService.getCancellationRequestById.mockResolvedValueOnce({ _id: 'req-1' });

    const res = await controller.getCancellationById('req-1');

    expect(mockService.getCancellationRequestById).toHaveBeenCalledWith('req-1');
    expect(res).toEqual({ _id: 'req-1' });
  });
});
