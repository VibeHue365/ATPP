import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenMeteoClientService, OpenMeteoHourlyData } from './open-meteo-client.service';
import { RedisService } from '../../../common/redis/redis.service';

describe('OpenMeteoClientService', () => {
  let service: OpenMeteoClientService;
  let redisService: RedisService;

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockHourlyData: OpenMeteoHourlyData = {
    time: [
      '2026-11-12T10:00:00+07:00',
      '2026-11-12T11:00:00+07:00',
      '2026-11-12T12:00:00+07:00',
    ],
    precipitation: [0.0, 1.2, 0.4],
    precipitation_probability: [10, 40, 20],
    weather_code: [1, 2, 0],
    apparent_temperature: [28.5, 29.0, 27.5],
    temperature_2m: [27.0, 27.5, 26.5],
    uv_index: [5.0, 6.5, 4.0],
    wind_speed_10m: [12.0, 15.0, 10.0],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenMeteoClientService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OpenMeteoClientService>(OpenMeteoClientService);
    redisService = module.get<RedisService>(RedisService);
  });

  describe('getHourlyForecast', () => {
    it('should return cached data from Redis L2 when available', async () => {
      mockRedisService.get.mockResolvedValueOnce(mockHourlyData);

      const result = await service.getHourlyForecast(16.4637, 107.5909);

      expect(mockRedisService.get).toHaveBeenCalledWith('weather:forecast:16.46:107.59');
      expect(result).toEqual(mockHourlyData);
    });

    it('should fetch from Open-Meteo API on cache miss and save to Redis', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);

      const globalFetchMock = jest.spyOn(global, 'fetch').mockImplementationOnce(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ hourly: mockHourlyData }),
          } as any),
      );

      const result = await service.getHourlyForecast(16.4637, 107.5909);

      expect(globalFetchMock).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'weather:forecast:16.46:107.59',
        mockHourlyData,
        1800,
      );
      expect(result).toEqual(mockHourlyData);

      globalFetchMock.mockRestore();
    });

    it('should throw error when API call fails and no cached data is available', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);

      const globalFetchMock = jest.spyOn(global, 'fetch').mockImplementationOnce(
        async () =>
          ({
            ok: false,
            status: 500,
          } as any),
      );

      await expect(service.getHourlyForecast(16.4637, 107.5909)).rejects.toThrow(
        'Open-Meteo responded with status 500',
      );

      globalFetchMock.mockRestore();
    });

    it('should serve from L1 in-memory cache when Redis miss but memory cache has valid entry', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const globalFetchMock = jest.spyOn(global, 'fetch').mockImplementationOnce(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ hourly: mockHourlyData }),
          } as any),
      );

      // First call populates in-memory cache
      await service.getHourlyForecast(16.4637, 107.5909);
      expect(globalFetchMock).toHaveBeenCalledTimes(1);

      // Second call should hit in-memory cache without calling fetch again
      const memoryResult = await service.getHourlyForecast(16.4637, 107.5909);
      expect(memoryResult).toEqual(mockHourlyData);
      expect(globalFetchMock).toHaveBeenCalledTimes(1);

      globalFetchMock.mockRestore();
    });

    it('should serve stale in-memory cache if subsequent API call fails', async () => {
      mockRedisService.get.mockResolvedValue(null);

      // Populate memory cache
      (service as any).memoryCache.set('weather:forecast:16.46:107.59', {
        data: mockHourlyData,
        expiresAt: Date.now() - 1000, // expired
      });

      const globalFetchMock = jest.spyOn(global, 'fetch').mockImplementationOnce(
        async () =>
          ({
            ok: false,
            status: 503,
          } as any),
      );

      const staleResult = await service.getHourlyForecast(16.4637, 107.5909);
      expect(staleResult).toEqual(mockHourlyData);

      globalFetchMock.mockRestore();
    });
  });

  describe('getHourlyMetrics', () => {
    it('should transform raw hourly data and compute rolling 2-hour precipitation', async () => {
      mockRedisService.get.mockResolvedValueOnce(mockHourlyData);

      const metrics = await service.getHourlyMetrics(16.4637, 107.5909);

      expect(metrics).toHaveLength(3);

      // Hour 0: no prior hours -> past2h = 0
      expect(metrics[0].precipitationMm).toBe(0.0);
      expect(metrics[0].past2hPrecipitationMm).toBe(0.0);

      // Hour 1: prior hour has 0.0 -> past2h = 0.0
      expect(metrics[1].precipitationMm).toBe(1.2);
      expect(metrics[1].past2hPrecipitationMm).toBe(0.0);

      // Hour 2: prior 2 hours had 0.0 and 1.2 -> past2h = 1.2
      expect(metrics[2].precipitationMm).toBe(0.4);
      expect(metrics[2].past2hPrecipitationMm).toBe(1.2);
    });
  });
});
