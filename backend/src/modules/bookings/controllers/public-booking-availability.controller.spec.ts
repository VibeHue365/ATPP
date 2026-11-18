import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PublicBookingAvailabilityController } from './public-booking-availability.controller';
import { BookingsService } from '../services/bookings.service';
import { HttpExceptionFilter } from '../../../common/filters/http-exception.filter';

describe('PublicBookingAvailabilityController (e2e / integration)', () => {
  let app: INestApplication<App>;
  const mockBookingsService = {
    getBusySchedulesForProduct: jest.fn().mockResolvedValue({
      bookedDates: ['2026-11-20'],
      bookedSlots: [],
      variantBookedDates: {},
      variantBookedSlots: {},
    }),
    getBusySchedulesForProvider: jest.fn().mockResolvedValue({
      bookedDates: ['2026-11-21'],
      bookedSlots: [],
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PublicBookingAvailabilityController],
      providers: [
        {
          provide: BookingsService,
          useValue: mockBookingsService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /bookings/busy-dates/product/:productId and /api/bookings/busy-dates/product/:productId', () => {
    it('returns 400 Bad Request when productId is not a valid ObjectId on /bookings prefix', async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings/busy-dates/product/not-an-object-id')
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        message: 'ID sản phẩm không hợp lệ',
      });
      expect(mockBookingsService.getBusySchedulesForProduct).not.toHaveBeenCalled();
    });

    it('returns 400 Bad Request when productId is not a valid ObjectId on /api/bookings prefix', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/bookings/busy-dates/product/not-an-object-id')
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        message: 'ID sản phẩm không hợp lệ',
      });
      expect(mockBookingsService.getBusySchedulesForProduct).not.toHaveBeenCalled();
    });

    it('returns 200 OK with schedules when productId is a valid ObjectId on /bookings prefix', async () => {
      const validProductId = '507f1f77bcf86cd799439011';
      const res = await request(app.getHttpServer())
        .get(`/bookings/busy-dates/product/${validProductId}`)
        .expect(200);

      expect(res.body).toEqual({
        bookedDates: ['2026-11-20'],
        bookedSlots: [],
        variantBookedDates: {},
        variantBookedSlots: {},
      });
      expect(mockBookingsService.getBusySchedulesForProduct).toHaveBeenCalledWith(validProductId);
    });

    it('returns 200 OK with schedules when productId is a valid ObjectId on /api/bookings prefix', async () => {
      const validProductId = '507f1f77bcf86cd799439011';
      const res = await request(app.getHttpServer())
        .get(`/api/bookings/busy-dates/product/${validProductId}`)
        .expect(200);

      expect(res.body).toEqual({
        bookedDates: ['2026-11-20'],
        bookedSlots: [],
        variantBookedDates: {},
        variantBookedSlots: {},
      });
      expect(mockBookingsService.getBusySchedulesForProduct).toHaveBeenCalledWith(validProductId);
    });
  });

  describe('GET /bookings/busy-dates/provider/:providerId and /api/bookings/busy-dates/provider/:providerId', () => {
    it('returns 400 Bad Request when providerId is not a valid ObjectId', async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings/busy-dates/provider/not-an-object-id')
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        message: 'ID nhà cung cấp không hợp lệ',
      });
      expect(mockBookingsService.getBusySchedulesForProvider).not.toHaveBeenCalled();
    });

    it('returns 400 Bad Request when providerId is invalid on /api/bookings prefix', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/bookings/busy-dates/provider/invalid-provider-123')
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        message: 'ID nhà cung cấp không hợp lệ',
      });
    });

    it('returns 200 OK when providerId is a valid ObjectId', async () => {
      const validProviderId = '507f1f77bcf86cd799439012';
      const res = await request(app.getHttpServer())
        .get(`/bookings/busy-dates/provider/${validProviderId}`)
        .expect(200);

      expect(res.body).toEqual({
        bookedDates: ['2026-11-21'],
        bookedSlots: [],
      });
      expect(mockBookingsService.getBusySchedulesForProvider).toHaveBeenCalledWith(validProviderId);
    });
  });
});
