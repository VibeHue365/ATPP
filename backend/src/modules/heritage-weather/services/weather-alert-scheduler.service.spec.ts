import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { WeatherAlertSchedulerService } from './weather-alert-scheduler.service';
import {
  BookingSchedule,
  BookingScheduleStatus,
  BookingScheduleType,
} from '../../bookings/schemas/booking-schedule.schema';
import { Booking, BookingStatus } from '../../bookings/schemas/booking.schema';
import { Notification } from '../../notifications/schemas/notification.schema';
import { OpenMeteoClientService } from './open-meteo-client.service';
import { HeritageScoringService } from './heritage-scoring.service';
import { WeatherNotificationService } from './weather-notification.service';

describe('WeatherAlertSchedulerService', () => {
  let service: WeatherAlertSchedulerService;

  const mockScheduleModel = {
    find: jest.fn(),
  };

  const mockBookingModel = {
    findById: jest.fn(),
  };

  const mockNotificationModel = {
    findOne: jest.fn(),
  };

  const mockOpenMeteoService = {
    getHourlyMetrics: jest.fn(),
  };

  const mockScoringService = {
    assessTimeSlot: jest.fn(),
  };

  const mockWeatherNotificationService = {
    sendWeatherRedAlert: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('true'),
  };

  const bookingId = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const scheduleId = new Types.ObjectId();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherAlertSchedulerService,
        {
          provide: getModelToken(BookingSchedule.name),
          useValue: mockScheduleModel,
        },
        {
          provide: getModelToken(Booking.name),
          useValue: mockBookingModel,
        },
        {
          provide: getModelToken(Notification.name),
          useValue: mockNotificationModel,
        },
        {
          provide: OpenMeteoClientService,
          useValue: mockOpenMeteoService,
        },
        {
          provide: HeritageScoringService,
          useValue: mockScoringService,
        },
        {
          provide: WeatherNotificationService,
          useValue: mockWeatherNotificationService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<WeatherAlertSchedulerService>(
      WeatherAlertSchedulerService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scanWeatherAlerts', () => {
    it('should skip scan when feature flag is disabled', async () => {
      mockConfigService.get.mockReturnValueOnce('false');

      const res = await service.scanWeatherAlerts();
      expect(res).toEqual({ t24Count: 0, t3Count: 0 });
      expect(mockScheduleModel.find).not.toHaveBeenCalled();
    });

    it('should scan both T-24h and T-3h windows when enabled', async () => {
      mockConfigService.get.mockReturnValueOnce('true');
      const mockQuery = {
        exec: jest.fn().mockResolvedValue([]),
      };
      mockScheduleModel.find.mockReturnValue(mockQuery);

      const res = await service.scanWeatherAlerts();
      expect(res).toEqual({ t24Count: 0, t3Count: 0 });
      expect(mockScheduleModel.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('processMilestoneWindow', () => {
    const windowStart = new Date(Date.now() + 23 * 60 * 60 * 1000);
    const windowEnd = new Date(Date.now() + 25 * 60 * 60 * 1000);

    it('should skip if booking has pending weather action', async () => {
      const mockSchedule = {
        _id: scheduleId,
        bookingId,
        scheduleType: BookingScheduleType.Photoshoot,
        status: BookingScheduleStatus.Confirmed,
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      mockScheduleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockSchedule]),
      });
      mockBookingModel.findById.mockResolvedValue({
        _id: bookingId,
        status: BookingStatus.Confirmed,
        hasPendingWeatherAction: true,
      });

      const count = await service.processMilestoneWindow(windowStart, windowEnd, 'T-24h');
      expect(count).toBe(0);
      expect(mockWeatherNotificationService.sendWeatherRedAlert).not.toHaveBeenCalled();
    });

    it('should skip if alert was already sent (deduplication)', async () => {
      const mockSchedule = {
        _id: scheduleId,
        bookingId,
        scheduleType: BookingScheduleType.Photoshoot,
        status: BookingScheduleStatus.Confirmed,
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      mockScheduleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockSchedule]),
      });
      mockBookingModel.findById.mockResolvedValue({
        _id: bookingId,
        customerId,
        status: BookingStatus.Confirmed,
        hasPendingWeatherAction: false,
      });
      mockNotificationModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() }); // already sent

      const count = await service.processMilestoneWindow(windowStart, windowEnd, 'T-24h');
      expect(count).toBe(0);
      expect(mockOpenMeteoService.getHourlyMetrics).not.toHaveBeenCalled();
    });

    it('should trigger sendWeatherRedAlert when RED_ALERT is detected', async () => {
      const mockSchedule = {
        _id: scheduleId,
        bookingId,
        scheduleType: BookingScheduleType.Photoshoot,
        status: BookingScheduleStatus.Confirmed,
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timeSlot: '09:00 - 11:00',
        locationAddress: 'Đại Nội Huế',
        locationSnapshot: {
          geo: { coordinates: [107.57, 16.47] },
        },
      };
      const mockBooking = {
        _id: bookingId,
        customerId,
        bookingCode: 'BK-CRON-1',
        status: BookingStatus.Confirmed,
        hasPendingWeatherAction: false,
      };

      mockScheduleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockSchedule]),
      });
      mockBookingModel.findById.mockResolvedValue(mockBooking);
      mockNotificationModel.findOne.mockResolvedValue(null);
      mockOpenMeteoService.getHourlyMetrics.mockResolvedValue([]);
      mockScoringService.assessTimeSlot.mockReturnValue({
        isRedAlert: true,
        recommendation: 'Mưa dông nguy hiểm',
      });

      const count = await service.processMilestoneWindow(windowStart, windowEnd, 'T-24h');
      expect(count).toBe(1);
      expect(mockWeatherNotificationService.sendWeatherRedAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          booking: mockBooking,
          milestone: 'T-24h',
          reason: 'Mưa dông nguy hiểm',
          spotName: 'Đại Nội Huế',
        }),
      );
    });
  });
});
