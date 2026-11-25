import { Controller, Get, Param, Query } from '@nestjs/common';
import { GetForecastDto } from '../dto/get-forecast.dto';
import { AssessSlotDto } from '../dto/assess-slot.dto';
import { OpenMeteoClientService } from '../services/open-meteo-client.service';
import { HeritageScoringService } from '../services/heritage-scoring.service';
import { AstronomicalCalculatorService } from '../services/astronomical-calculator.service';
import { HeritageSpotsService } from '../services/heritage-spots.service';
import { HeritageSpotSpaceType } from '../schemas/heritage-spot.schema';

@Controller('weather-advisor')
export class WeatherAdvisorController {
  constructor(
    private readonly openMeteoService: OpenMeteoClientService,
    private readonly scoringService: HeritageScoringService,
    private readonly astronomicalService: AstronomicalCalculatorService,
    private readonly heritageSpotsService: HeritageSpotsService,
  ) {}

  /**
   * GET /weather-advisor/forecast
   * 7-day hourly weather forecast with ShootScore and AD-04 DailyScore
   */
  @Get('forecast')
  async getForecast(@Query() query: GetForecastDto) {
    const lat = query.lat ?? 16.4637;
    const lng = query.lng ?? 107.5909;
    const spaceType = query.spaceType ?? HeritageSpotSpaceType.OUTDOOR;

    const metrics = await this.openMeteoService.getHourlyMetrics(lat, lng);

    // Group metrics by date (YYYY-MM-DD)
    const dailyMap = new Map<string, typeof metrics>();
    for (const m of metrics) {
      const d = m.hourTimestamp;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, []);
      }
      dailyMap.get(dateKey)!.push(m);
    }

    // Filter by single date if specified
    const datesToProcess = query.date
      ? [query.date].filter((d) => dailyMap.has(d))
      : Array.from(dailyMap.keys());

    const dailySummaries = datesToProcess.map((dateKey) => {
      const dayMetrics = dailyMap.get(dateKey) || [];
      const dayDate = new Date(`${dateKey}T12:00:00+07:00`);
      const sunPhases = this.astronomicalService.calculateSunPhases(
        lat,
        lng,
        dayDate,
      );

      const hourlyWithScores = dayMetrics.map((metric) => {
        const isGolden = this.astronomicalService.isGoldenHour(
          metric.hourTimestamp,
          lat,
          lng,
        );
        const isBlue = this.astronomicalService.isBlueHour(
          metric.hourTimestamp,
          lat,
          lng,
        );
        const score = this.scoringService.calculateHourlyScore(
          metric,
          spaceType,
          isGolden,
          isBlue,
        );
        const isRedAlert = this.scoringService.isHourRedAlert(
          metric,
          spaceType,
        );

        return {
          hour: metric.hourTimestamp.getHours(),
          score,
          isRedAlert,
          metric,
          isGolden,
          isBlue,
        };
      });

      // Calculate DailyScore per AD-04
      const dailyScore = this.scoringService.calculateDailyScore(
        hourlyWithScores.map((h) => ({ hour: h.hour, score: h.score })),
      );

      const hasRedAlertInDay = hourlyWithScores.some((h) => h.isRedAlert);

      return {
        date: dateKey,
        dailyScore,
        hasRedAlert: hasRedAlertInDay,
        sunPhases,
        hourly: hourlyWithScores.map((h) => ({
          timestamp: h.metric.hourTimestamp,
          hour: h.hour,
          shootScore: h.score,
          isRedAlert: h.isRedAlert,
          isGoldenHour: h.isGolden,
          isBlueHour: h.isBlue,
          precipitationMm: h.metric.precipitationMm,
          precipitationProbability: h.metric.precipitationProbability,
          weatherCode: h.metric.weatherCode,
          apparentTemperature: h.metric.apparentTemperature,
          uvIndex: h.metric.uvIndex,
          windSpeedKmH: h.metric.windSpeedKmH,
          past2hPrecipitationMm: h.metric.past2hPrecipitationMm,
        })),
      };
    });

    return {
      latitude: lat,
      longitude: lng,
      spaceType,
      provider: 'Open-Meteo',
      confidenceHorizon: '7 days',
      dailySummaries,
    };
  }

  /**
   * GET /weather-advisor/spots/:id/assessment
   * Assesses a specific photography slot at a Heritage Spot by its ID
   */
  @Get('spots/:id/assessment')
  async assessSpotSlot(@Param('id') id: string, @Query() query: AssessSlotDto) {
    const spot = await this.heritageSpotsService.findById(id);
    const lng = spot.location.coordinates[0];
    const lat = spot.location.coordinates[1];

    const metrics = await this.openMeteoService.getHourlyMetrics(lat, lng);
    const assessment = this.scoringService.assessTimeSlot(
      query.timeSlot,
      query.date,
      metrics,
      spot.spaceType,
      lat,
      lng,
    );

    return {
      spot: {
        id: spot._id,
        name: spot.name,
        slug: spot.slug,
        address: spot.address,
        spaceType: spot.spaceType,
        baseTravelFee: spot.baseTravelFee,
        location: spot.location,
      },
      assessment,
    };
  }

  /**
   * GET /weather-advisor/spots/slug/:slug/assessment
   * Assesses a specific photography slot at a Heritage Spot by its slug
   */
  @Get('spots/slug/:slug/assessment')
  async assessSpotSlotBySlug(
    @Param('slug') slug: string,
    @Query() query: AssessSlotDto,
  ) {
    const spot = await this.heritageSpotsService.findBySlug(slug);
    const lng = spot.location.coordinates[0];
    const lat = spot.location.coordinates[1];

    const metrics = await this.openMeteoService.getHourlyMetrics(lat, lng);
    const assessment = this.scoringService.assessTimeSlot(
      query.timeSlot,
      query.date,
      metrics,
      spot.spaceType,
      lat,
      lng,
    );

    return {
      spot: {
        id: spot._id,
        name: spot.name,
        slug: spot.slug,
        address: spot.address,
        spaceType: spot.spaceType,
        baseTravelFee: spot.baseTravelFee,
        location: spot.location,
      },
      assessment,
    };
  }
}
