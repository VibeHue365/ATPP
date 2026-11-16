import { Test, TestingModule } from '@nestjs/testing';
import { HeritageScoringService } from './heritage-scoring.service';
import { AstronomicalCalculatorService } from './astronomical-calculator.service';
import { HeritageSpotSpaceType } from '../schemas/heritage-spot.schema';
import { HourlyWeatherMetric } from './open-meteo-client.service';

describe('HeritageScoringService', () => {
  let service: HeritageScoringService;
  let astroService: AstronomicalCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HeritageScoringService, AstronomicalCalculatorService],
    }).compile();

    service = module.get<HeritageScoringService>(HeritageScoringService);
    astroService = module.get<AstronomicalCalculatorService>(
      AstronomicalCalculatorService,
    );
  });

  const createBaseMetric = (
    overrides?: Partial<HourlyWeatherMetric>,
  ): HourlyWeatherMetric => ({
    hourTimestamp: new Date('2026-11-12T14:00:00+07:00'),
    precipitationMm: 0,
    precipitationProbability: 0,
    weatherCode: 0,
    apparentTemperature: 28,
    temperature2m: 26,
    uvIndex: 4,
    windSpeedKmH: 10,
    past2hPrecipitationMm: 0,
    ...overrides,
  });

  describe('calculateHourlyScore & PO Invariants', () => {
    it('TC-SCO-01: should return strictly 10.0 for INDOOR_STUDIO even in extreme typhoon conditions (Issue 06)', () => {
      const extremeWeather = createBaseMetric({
        precipitationMm: 15.0,
        precipitationProbability: 95,
        weatherCode: 95, // Thunderstorm
        windSpeedKmH: 50,
        apparentTemperature: 38,
        uvIndex: 11,
        past2hPrecipitationMm: 25.0,
      });

      const score = service.calculateHourlyScore(
        extremeWeather,
        HeritageSpotSpaceType.INDOOR_STUDIO,
        false,
        false,
      );

      expect(score).toBe(10.0);
    });

    it('should deduct correct penalties for OUTDOOR under heavy rain (>= 2.0 mm/h) and POP >= 70%', () => {
      const rainyMetric = createBaseMetric({
        precipitationMm: 2.5, // -6.0
        precipitationProbability: 80, // -3.0
      });

      const score = service.calculateHourlyScore(
        rainyMetric,
        HeritageSpotSpaceType.OUTDOOR,
        false,
        false,
      );

      // 10.0 - 6.0 - 3.0 = 1.0
      expect(score).toBe(1.0);
    });

    it('should deduct penalty for thunderstorm (WMO 95-99)', () => {
      const stormMetric = createBaseMetric({
        weatherCode: 96, // -7.0
      });

      const score = service.calculateHourlyScore(
        stormMetric,
        HeritageSpotSpaceType.OUTDOOR,
        false,
        false,
      );

      // 10.0 - 7.0 = 3.0
      expect(score).toBe(3.0);
    });

    it('should deduct combined heat and extreme UV penalty when apparent temp >= 34 and UV >= 8', () => {
      const hotMetric = createBaseMetric({
        apparentTemperature: 36.0,
        uvIndex: 9.0, // both true => -2.0
      });

      const score = service.calculateHourlyScore(
        hotMetric,
        HeritageSpotSpaceType.OUTDOOR,
        false,
        false,
      );

      // 10.0 - 2.0 = 8.0
      expect(score).toBe(8.0);
    });

    it('should add Golden Hour bonus (+1.0) and Blue Hour bonus (+0.5) only in clean weather', () => {
      const cleanMetric = createBaseMetric({
        precipitationMm: 0,
        weatherCode: 0,
      });

      const normalScore = service.calculateHourlyScore(
        cleanMetric,
        HeritageSpotSpaceType.OUTDOOR,
        false,
        false,
      );
      expect(normalScore).toBe(10.0);

      // Golden hour on clean day with small penalty (-1.0 for hot temp)
      const slightlyHot = createBaseMetric({ apparentTemperature: 35 }); // -1.0
      const goldenScore = service.calculateHourlyScore(
        slightlyHot,
        HeritageSpotSpaceType.OUTDOOR,
        true,
        false,
      );
      // 10.0 - 1.0 + 1.0 = 10.0
      expect(goldenScore).toBe(10.0);

      const blueScore = service.calculateHourlyScore(
        slightlyHot,
        HeritageSpotSpaceType.OUTDOOR,
        false,
        true,
      );
      // 10.0 - 1.0 + 0.5 = 9.5
      expect(blueScore).toBe(9.5);
    });

    it('should NOT add Golden Hour bonus if weather is rainy or stormy', () => {
      const badWeather = createBaseMetric({
        precipitationMm: 0.5, // -3.0
        weatherCode: 61,
      });

      const scoreWithGolden = service.calculateHourlyScore(
        badWeather,
        HeritageSpotSpaceType.OUTDOOR,
        true,
        false,
      );

      // 10.0 - 3.0 = 7.0 (no bonus added)
      expect(scoreWithGolden).toBe(7.0);
    });

    it('should clamp final score to minimum 0.0 and maximum 10.0', () => {
      const terribleWeather = createBaseMetric({
        precipitationMm: 5.0, // -6.0
        precipitationProbability: 90, // -3.0
        weatherCode: 95, // -7.0
        windSpeedKmH: 40, // -2.5
        past2hPrecipitationMm: 12.0, // -2.0
      });

      const score = service.calculateHourlyScore(
        terribleWeather,
        HeritageSpotSpaceType.OUTDOOR,
        false,
        false,
      );

      expect(score).toBe(0.0);
    });
  });

  describe('isHourRedAlert', () => {
    it('should return false for INDOOR_STUDIO even with heavy storm', () => {
      const storm = createBaseMetric({
        precipitationProbability: 90,
        precipitationMm: 10,
        weatherCode: 95,
      });
      expect(
        service.isHourRedAlert(storm, HeritageSpotSpaceType.INDOOR_STUDIO),
      ).toBe(false);
    });

    it('should return true if POP >= 70% for OUTDOOR', () => {
      const metric = createBaseMetric({ precipitationProbability: 70 });
      expect(service.isHourRedAlert(metric, HeritageSpotSpaceType.OUTDOOR)).toBe(
        true,
      );
    });

    it('should return true if precipitation >= 2.0 mm/h for OUTDOOR', () => {
      const metric = createBaseMetric({ precipitationMm: 2.0 });
      expect(service.isHourRedAlert(metric, HeritageSpotSpaceType.OUTDOOR)).toBe(
        true,
      );
    });

    it('should return true if thunderstorm code 95-99 for OUTDOOR', () => {
      const metric = createBaseMetric({ weatherCode: 95 });
      expect(service.isHourRedAlert(metric, HeritageSpotSpaceType.OUTDOOR)).toBe(
        true,
      );
    });

    it('should return false when conditions are below Red Alert thresholds', () => {
      const metric = createBaseMetric({
        precipitationProbability: 60,
        precipitationMm: 1.5,
        weatherCode: 61,
      });
      expect(service.isHourRedAlert(metric, HeritageSpotSpaceType.OUTDOOR)).toBe(
        false,
      );
    });
  });

  describe('calculateDailyScore (AD-04)', () => {
    it('TC-SCO-02: should calculate average of top 2 daytime hours (07:00-18:00)', () => {
      const hours = [
        { hour: 7, score: 8.0 },
        { hour: 8, score: 9.0 },
        { hour: 9, score: 7.0 },
        { hour: 10, score: 6.0 },
        { hour: 11, score: 8.5 },
        { hour: 12, score: 9.5 }, // top 1: 9.5
        { hour: 13, score: 6.0 },
        { hour: 14, score: 5.0 },
        { hour: 15, score: 7.0 },
        { hour: 16, score: 8.0 },
        { hour: 17, score: 9.0 }, // top 2: 9.0
        { hour: 18, score: 8.0 },
      ];

      // Top 2: 9.5 and 9.0 -> avg = 9.25, rounded to 9.3
      const dailyScore = service.calculateDailyScore(hours);
      expect(dailyScore).toBe(9.3);
    });

    it('should ignore hours outside 07:00 - 18:00', () => {
      const hours = [
        { hour: 5, score: 10.0 }, // ignored (before 7)
        { hour: 8, score: 7.0 },
        { hour: 14, score: 8.0 },
        { hour: 21, score: 10.0 }, // ignored (after 18)
      ];

      // Valid: 7.0 and 8.0 -> avg = 7.5
      const dailyScore = service.calculateDailyScore(hours);
      expect(dailyScore).toBe(7.5);
    });

    it('should return null when no daytime hours are available (DATA_UNAVAILABLE)', () => {
      const hours = [
        { hour: 3, score: 5.0 },
        { hour: 22, score: 6.0 },
      ];
      expect(service.calculateDailyScore(hours)).toBeNull();
    });

    it('should fallback to single hour score if only 1 daytime hour available', () => {
      const hours = [{ hour: 10, score: 8.4 }];
      expect(service.calculateDailyScore(hours)).toBe(8.4);
    });
  });

  describe('assessTimeSlot & Multi-hour Slot Evaluation', () => {
    it('should trigger Worst-case RED_ALERT if any intersecting hour has RED_ALERT', () => {
      const metrics = [
        createBaseMetric({
          hourTimestamp: new Date('2026-11-12T14:00:00+07:00'),
          precipitationMm: 0,
        }),
        createBaseMetric({
          hourTimestamp: new Date('2026-11-12T15:00:00+07:00'),
          precipitationMm: 3.0, // Red alert!
          precipitationProbability: 80,
          weatherCode: 95,
        }),
      ];

      const assessment = service.assessTimeSlot(
        '14:00-16:00',
        '2026-11-12',
        metrics,
        HeritageSpotSpaceType.OUTDOOR,
      );

      expect(assessment.isRedAlert).toBe(true);
      expect(assessment.canRescheduleFree).toBe(true);
      // Under worst-case decision, slotScore equals minimum of the intersecting hours
      expect(assessment.slotScore).toBeLessThan(4.0);
    });

    it('should calculate weighted average score for normal slots without RED_ALERT', () => {
      const metrics = [
        createBaseMetric({
          hourTimestamp: new Date('2026-11-12T14:00:00+07:00'),
          apparentTemperature: 35, // score 9.0
        }),
        createBaseMetric({
          hourTimestamp: new Date('2026-11-12T15:00:00+07:00'),
          apparentTemperature: 28, // score 10.0
        }),
      ];

      const assessment = service.assessTimeSlot(
        '14:00-16:00',
        '2026-11-12',
        metrics,
        HeritageSpotSpaceType.OUTDOOR,
      );

      expect(assessment.isRedAlert).toBe(false);
      // Both 14:00 and 15:00 have 60 min overlap: (9.0 * 60 + 10.0 * 60) / 120 = 9.5
      expect(assessment.slotScore).toBe(9.5);
    });

    it('should calculate SEMI_INDOOR penalties correctly', () => {
      const semiIndoorMetric = createBaseMetric({
        precipitationMm: 1.0, // -1.5
        precipitationProbability: 60, // -0.5
        windSpeedKmH: 26, // -0.5
        past2hPrecipitationMm: 12, // -1.0
      });

      const score = service.calculateHourlyScore(
        semiIndoorMetric,
        HeritageSpotSpaceType.SEMI_INDOOR,
        false,
        false,
      );

      // 10.0 - 1.5 - 0.5 - 0.5 - 1.0 = 6.5
      expect(score).toBe(6.5);
    });

    it('should handle malformed slot strings gracefully in parseTimeSlot', () => {
      const defaultSlot = service.parseTimeSlot('');
      expect(defaultSlot.startHour).toBe(9);
      expect(defaultSlot.endHour).toBe(11);

      const invalidSlot = service.parseTimeSlot('invalid-slot');
      expect(invalidSlot.totalMinutes).toBe(120);
    });

    it('should assign LOW confidence for slots further than 72 hours', () => {
      const futureDate = '2099-01-01';
      const assessment = service.assessTimeSlot(
        '10:00-12:00',
        futureDate,
        [],
        HeritageSpotSpaceType.OUTDOOR,
      );
      expect(assessment.confidence).toBe('LOW');
    });

    it('should generate appropriate advisory messages for INDOOR_STUDIO and fair/poor weather', () => {
      const indoorAssessment = service.assessTimeSlot(
        '10:00-12:00',
        '2026-11-12',
        [],
        HeritageSpotSpaceType.INDOOR_STUDIO,
      );
      expect(indoorAssessment.advisoryTitle).toContain('Phim trường');

      const poorMetric = createBaseMetric({
        apparentTemperature: 36, // -2.0
        windSpeedKmH: 36, // -2.5
        past2hPrecipitationMm: 12, // -2.0
      }); // Score ~ 3.5

      const poorAssessment = service.assessTimeSlot(
        '14:00-15:00',
        '2026-11-12',
        [poorMetric],
        HeritageSpotSpaceType.OUTDOOR,
      );
      expect(poorAssessment.advisoryTitle).toContain('Kém thuận lợi');
    });
  });
});
