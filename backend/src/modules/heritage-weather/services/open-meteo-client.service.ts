import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../common/redis/redis.service';

export interface OpenMeteoHourlyData {
  time: string[];
  precipitation: number[];
  precipitation_probability: number[];
  weather_code: number[];
  apparent_temperature: number[];
  temperature_2m: number[];
  uv_index: number[];
  wind_speed_10m: number[];
}

export interface OpenMeteoForecastResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly: OpenMeteoHourlyData;
}

export interface HourlyWeatherMetric {
  hourTimestamp: Date;
  precipitationMm: number;
  precipitationProbability: number;
  weatherCode: number;
  apparentTemperature: number;
  temperature2m: number;
  uvIndex: number;
  windSpeedKmH: number;
  past2hPrecipitationMm: number;
}

interface InMemoryCacheEntry {
  data: OpenMeteoHourlyData;
  expiresAt: number;
}

@Injectable()
export class OpenMeteoClientService {
  private readonly logger = new Logger(OpenMeteoClientService.name);
  private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast';
  private readonly cacheTtlSeconds = 1800; // 30 mins
  private readonly memoryCache = new Map<string, InMemoryCacheEntry>();

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Fetches raw hourly forecast from Open-Meteo with Redis L2 and In-Memory L1 caching.
   */
  async getHourlyForecast(lat: number, lng: number): Promise<OpenMeteoHourlyData> {
    const roundedLat = lat.toFixed(2);
    const roundedLng = lng.toFixed(2);
    const cacheKey = `weather:forecast:${roundedLat}:${roundedLng}`;

    // 1. Check Redis L2 Cache
    try {
      const cached = await this.redisService.get<OpenMeteoHourlyData>(cacheKey);
      if (cached && cached.time && cached.time.length > 0) {
        return cached;
      }
    } catch (err: any) {
      this.logger.warn(`Redis L2 cache lookup failed: ${err?.message}`);
    }

    // 2. Check In-Memory L1 Cache
    const memEntry = this.memoryCache.get(cacheKey);
    const now = Date.now();
    if (memEntry && memEntry.expiresAt > now) {
      return memEntry.data;
    }

    // 3. Fetch from Open-Meteo API with 6-second timeout
    const params = new URLSearchParams({
      latitude: roundedLat,
      longitude: roundedLng,
      hourly: [
        'precipitation',
        'precipitation_probability',
        'weather_code',
        'apparent_temperature',
        'temperature_2m',
        'uv_index',
        'wind_speed_10m',
      ].join(','),
      timezone: 'Asia/Ho_Chi_Minh',
      forecast_days: '7',
    });

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        throw new Error(`Open-Meteo responded with status ${response.status}`);
      }

      const json: OpenMeteoForecastResponse = await response.json();
      const hourlyData: OpenMeteoHourlyData = json.hourly;

      // Update In-Memory L1 Cache
      this.memoryCache.set(cacheKey, {
        data: hourlyData,
        expiresAt: now + this.cacheTtlSeconds * 1000,
      });

      // Update Redis L2 Cache
      try {
        await this.redisService.set(cacheKey, hourlyData, this.cacheTtlSeconds);
      } catch (err: any) {
        this.logger.warn(`Failed to store weather in Redis L2: ${err?.message}`);
      }

      return hourlyData;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch weather from Open-Meteo for ${lat},${lng}: ${error?.message}`,
      );

      // Graceful degraded fallback: if stale memory entry exists, return it
      if (memEntry) {
        this.logger.warn(
          `Serving stale in-memory weather data for ${lat},${lng}`,
        );
        return memEntry.data;
      }

      throw error;
    }
  }

  /**
   * Fetches weather and transforms it into an array of structured HourlyWeatherMetric
   * with rolling 2-hour precipitation accumulation computed.
   */
  async getHourlyMetrics(lat: number, lng: number): Promise<HourlyWeatherMetric[]> {
    const raw = await this.getHourlyForecast(lat, lng);
    const metrics: HourlyWeatherMetric[] = [];

    const totalHours = raw.time.length;
    for (let i = 0; i < totalHours; i++) {
      const p1 = i >= 1 ? Number(raw.precipitation[i - 1] ?? 0) : 0;
      const p2 = i >= 2 ? Number(raw.precipitation[i - 2] ?? 0) : 0;
      const past2h = Math.round((p1 + p2) * 10) / 10;

      metrics.push({
        hourTimestamp: new Date(raw.time[i]),
        precipitationMm: Number(raw.precipitation[i] ?? 0),
        precipitationProbability: Number(raw.precipitation_probability[i] ?? 0),
        weatherCode: Number(raw.weather_code[i] ?? 0),
        apparentTemperature: Number(raw.apparent_temperature[i] ?? 0),
        temperature2m: Number(raw.temperature_2m[i] ?? 0),
        uvIndex: Number(raw.uv_index[i] ?? 0),
        windSpeedKmH: Number(raw.wind_speed_10m[i] ?? 0),
        past2hPrecipitationMm: past2h,
      });
    }

    return metrics;
  }
}
