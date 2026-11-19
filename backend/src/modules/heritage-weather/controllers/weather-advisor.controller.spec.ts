import { Test, TestingModule } from '@nestjs/testing';
import { WeatherAdvisorController } from './weather-advisor.controller';
import { OpenMeteoClientService } from '../services/open-meteo-client.service';
import { HeritageScoringService } from '../services/heritage-scoring.service';
import { AstronomicalCalculatorService } from '../services/astronomical-calculator.service';
import { HeritageSpotsService } from '../services/heritage-spots.service';
import { HeritageSpotSpaceType } from '../schemas/heritage-spot.schema';

describe('WeatherAdvisorController', () => {
  let controller: WeatherAdvisorController;

  const mockOpenMeteoService = {
    getHourlyMetrics: jest.fn(),
  };

  const mockScoringService = {
    calculateHourlyScore: jest.fn(),
    isHourRedAlert: jest.fn(),
    calculateDailyScore: jest.fn(),
    assessTimeSlot: jest.fn(),
  };

  const mockAstronomicalService = {
    calculateSunPhases: jest.fn(),
    isGoldenHour: jest.fn(),
    isBlueHour: jest.fn(),
  };

  const mockHeritageSpotsService = {
    findById: jest.fn(),
    findBySlug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeatherAdvisorController],
      providers: [
        { provide: OpenMeteoClientService, useValue: mockOpenMeteoService },
        { provide: HeritageScoringService, useValue: mockScoringService },
        {
          provide: AstronomicalCalculatorService,
          useValue: mockAstronomicalService,
        },
        { provide: HeritageSpotsService, useValue: mockHeritageSpotsService },
      ],
    }).compile();

    controller = module.get<WeatherAdvisorController>(WeatherAdvisorController);
  });

  describe('getForecast', () => {
    it('should return daily summaries and hourly metrics with shoot scores', async () => {
      mockOpenMeteoService.getHourlyMetrics.mockResolvedValueOnce([
        {
          hourTimestamp: new Date('2026-11-12T08:00:00+07:00'),
          precipitationMm: 0,
          precipitationProbability: 10,
          weatherCode: 0,
          apparentTemperature: 28,
          temperature2m: 26,
          uvIndex: 3,
          windSpeedKmH: 10,
          past2hPrecipitationMm: 0,
        },
      ]);

      mockScoringService.calculateHourlyScore.mockReturnValue(9.5);
      mockScoringService.isHourRedAlert.mockReturnValue(false);
      mockScoringService.calculateDailyScore.mockReturnValue(9.5);
      mockAstronomicalService.calculateSunPhases.mockReturnValue({
        sunrise: new Date(),
        sunset: new Date(),
      });
      mockAstronomicalService.isGoldenHour.mockReturnValue(false);
      mockAstronomicalService.isBlueHour.mockReturnValue(false);

      const result = await controller.getForecast({
        lat: 16.4637,
        lng: 107.5909,
        spaceType: HeritageSpotSpaceType.OUTDOOR,
      });

      expect(result.provider).toBe('Open-Meteo');
      expect(result.dailySummaries).toHaveLength(1);
      expect(result.dailySummaries[0].dailyScore).toBe(9.5);
      expect(result.dailySummaries[0].hasRedAlert).toBe(false);
    });
  });

  describe('assessSpotSlot', () => {
    it('should assess slot for a spot found by ID', async () => {
      const mockSpot = {
        _id: 'spot-123',
        name: 'Đại Nội Huế',
        slug: 'dai-noi-hue',
        address: 'Thành phố Huế',
        spaceType: HeritageSpotSpaceType.OUTDOOR,
        baseTravelFee: 0,
        location: { type: 'Point', coordinates: [107.5796, 16.4695] },
      };

      mockHeritageSpotsService.findById.mockResolvedValueOnce(mockSpot);
      mockOpenMeteoService.getHourlyMetrics.mockResolvedValueOnce([]);
      mockScoringService.assessTimeSlot.mockReturnValueOnce({
        date: '2026-11-12',
        timeSlot: '14:00-16:00',
        spaceType: HeritageSpotSpaceType.OUTDOOR,
        slotScore: 9.0,
        isRedAlert: false,
        confidence: 'HIGH',
        advisoryTitle: 'Tuyệt vời',
        recommendation: 'Thời tiết đẹp',
        hourlyBreakdown: [],
        canRescheduleFree: false,
      });

      const result = await controller.assessSpotSlot('spot-123', {
        date: '2026-11-12',
        timeSlot: '14:00-16:00',
      });

      expect(mockHeritageSpotsService.findById).toHaveBeenCalledWith(
        'spot-123',
      );
      expect(result.spot.name).toBe('Đại Nội Huế');
      expect(result.assessment.slotScore).toBe(9.0);
    });

    it('should assess slot for a spot found by slug', async () => {
      const mockSpot = {
        _id: 'spot-456',
        name: 'Lăng Khải Định',
        slug: 'lang-khai-dinh',
        address: 'Thủy Bằng, Huế',
        spaceType: HeritageSpotSpaceType.SEMI_INDOOR,
        baseTravelFee: 50000,
        location: { type: 'Point', coordinates: [107.5905, 16.3989] },
      };

      mockHeritageSpotsService.findBySlug.mockResolvedValueOnce(mockSpot);
      mockOpenMeteoService.getHourlyMetrics.mockResolvedValueOnce([]);
      mockScoringService.assessTimeSlot.mockReturnValueOnce({
        date: '2026-11-13',
        timeSlot: '09:00-11:00',
        spaceType: HeritageSpotSpaceType.SEMI_INDOOR,
        slotScore: 8.5,
        isRedAlert: false,
        confidence: 'HIGH',
        advisoryTitle: 'Khá tốt',
        recommendation: 'Thời tiết mát mẻ',
        hourlyBreakdown: [],
        canRescheduleFree: false,
      });

      const result = await controller.assessSpotSlotBySlug('lang-khai-dinh', {
        date: '2026-11-13',
        timeSlot: '09:00-11:00',
      });

      expect(mockHeritageSpotsService.findBySlug).toHaveBeenCalledWith(
        'lang-khai-dinh',
      );
      expect(result.spot.name).toBe('Lăng Khải Định');
      expect(result.assessment.slotScore).toBe(8.5);
    });
  });
});
