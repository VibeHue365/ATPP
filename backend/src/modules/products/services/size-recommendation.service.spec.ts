import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { SizeRecommendationDto } from '../dto/size-recommendation.dto';
import { ChartSource, MeasurementType } from '../dto/size-chart.dto';
import { SizeRecommendationService } from './size-recommendation.service';

function setup() {
  const products = {
    findPublicById: jest.fn().mockResolvedValue({
      sizes: ['M'],
      sizeChart: {
        source: ChartSource.Manual,
        measurementType: MeasurementType.Body,
        lengthUnit: 'CM',
        weightUnit: 'KG',
        status: 'CONFIRMED',
        version: 2,
        sourceRevision: 1,
        requiredMeasurements: ['chest'],
        fitRules: [],
        rows: [{ size: 'M', chest: { min: 86, max: 89 } }],
      },
    }),
  };
  const users = {
    findUserById: jest
      .fn()
      .mockResolvedValue({ preferences: { sizeInfo: { chest: 87 } } }),
  };
  return {
    products,
    users,
    service: new SizeRecommendationService(products as any, users as any),
  };
}
const id = new Types.ObjectId().toString();
describe('size recommendation API service', () => {
  it('uses only the authenticated user profile and never calls Gemini', async () => {
    const { users, service } = setup();
    const fetchMock = jest.spyOn(global, 'fetch');
    try {
      expect(await service.recommend(id, {}, id)).toMatchObject({
        status: 'MATCH',
        recommendedSize: 'M',
      });
      expect(users.findUserById).toHaveBeenCalledWith(new Types.ObjectId(id));
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });
  it('accepts explicit guest inputs without accessing another user profile', async () => {
    const { users, service } = setup();
    expect(await service.recommend(id, { chest: 87 })).toMatchObject({
      status: 'MATCH',
    });
    expect(users.findUserById).not.toHaveBeenCalled();
  });
  it('explicit null clears an old profile value for this request', async () => {
    const { service } = setup();
    expect(await service.recommend(id, { chest: null }, id)).toMatchObject({
      status: 'INSUFFICIENT_DATA',
    });
  });
  it('returns unavailability for a draft rather than falling back to a common size table', async () => {
    const { products, service } = setup();
    const value = await products.findPublicById();
    products.findPublicById.mockResolvedValue({
      ...value,
      sizeChart: { ...value.sizeChart, status: 'DRAFT' },
    });
    expect(await service.recommend(id, { chest: 87 })).toMatchObject({
      status: 'UNAVAILABLE',
      candidates: [],
    });
  });
  it('does not expose unpublished or invalid product ids', async () => {
    const { products, service } = setup();
    await expect(service.recommend('not-an-id', {})).rejects.toThrow(
      NotFoundException,
    );
    products.findPublicById.mockResolvedValue(null as any);
    await expect(service.recommend(id, {})).rejects.toThrow(NotFoundException);
  });
  it('validates body numbers and forbids client supplied chart/user identities', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    for (const body of [
      { chest: 0 },
      { chest: '87' },
      { hip: -1 },
      { userId: id },
      { chart: {} },
      { fitPreference: 'AUTO' },
    ]) {
      await expect(
        pipe.transform(body, { type: 'body', metatype: SizeRecommendationDto }),
      ).rejects.toThrow(BadRequestException);
    }
  });
});
