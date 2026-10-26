import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { Types, model } from 'mongoose';
import {
  ChartSource,
  MeasurementType,
  SaveSizeChartDto,
  FitPreference,
  ChartVersionDto,
} from '../dto/size-chart.dto';
import { ProductSchema } from '../schemas/product.schema';
import { UpdateProductDto } from '../dto/update-product.dto';
import { SizeChart } from '../schemas/size-chart.schema';
import { SizeChartService } from './size-chart.service';
import { isSizeChartReady, validateSizeChart } from './size-chart.rules';

function draft(): SaveSizeChartDto {
  return {
    expectedVersion: 0,
    source: ChartSource.Manual,
    measurementType: MeasurementType.Body,
    lengthUnit: 'CM',
    weightUnit: 'KG',
    requiredMeasurements: ['chest', 'waist'],
    rows: [
      { size: 'M', chest: { min: 86, max: 89 }, waist: { min: 68, max: 71 } },
    ],
  };
}
function confirmed(): SizeChart {
  const { expectedVersion, ...content } = draft();
  return {
    ...content,
    fitRules: [],
    version: 1,
    sourceRevision: 1,
    status: 'CONFIRMED',
  };
}
const userId = new Types.ObjectId().toString();
const providerId = new Types.ObjectId();
const productId = new Types.ObjectId();

function setup(chart: SizeChart | null = null, version = 0) {
  const product = {
    _id: productId,
    providerId,
    sizes: ['M'],
    sizeChart: chart,
    sizeChartVersion: version,
  };
  const products = {
    findById: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(product) }),
    findOneAndUpdate: jest.fn().mockImplementation((_filter, update) => ({
      exec: jest.fn().mockResolvedValue({
        ...product,
        sizeChart: update.$set.sizeChart,
        sizeChartVersion: version + 1,
      }),
    })),
  };
  const users = {
    findUserById: jest.fn().mockResolvedValue({ provider: { providerId } }),
  };
  const repository = { findPublicById: jest.fn().mockResolvedValue(product) };
  const service = new SizeChartService(
    products as any,
    users as any,
    repository as any,
  );
  return { product, products, users, repository, service };
}

describe('size chart validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const parse = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: SaveSizeChartDto });

  it('accepts normalized size labels and supported units', async () => {
    const result = await parse({
      ...draft(),
      rows: [{ ...draft().rows[0], size: ' m ' }],
      lengthUnit: 'IN',
      weightUnit: 'LB',
    });
    expect(result.rows[0].size).toBe('M');
  });
  it.each([
    'status',
    'confirmedBy',
    'confirmedAt',
    'version',
    'sourceRevision',
    'sizeChartPolicyVersion',
  ])('rejects client-owned system field %s', async (key) => {
    await expect(parse({ ...draft(), [key]: 'CONFIRMED' })).rejects.toThrow(
      BadRequestException,
    );
  });
  it.each([
    { lengthUnit: 'MM' },
    { weightUnit: 'G' },
    { expectedVersion: -1 },
    { expectedVersion: 0.5 },
    { rows: [{ size: 'M', chest: { min: -1, max: 89 } }] },
    { rows: [{ size: 'M', chest: { min: 86 } }] },
    { rows: [{ size: 'M', chest: { min: '86', max: 89 } }] },
    { requiredMeasurements: ['length'] },
    { rows: [{ size: 'M' }, { size: 'M' }] },
    { imageUrl: 'http://example.com/size.png' },
  ])('rejects malformed DTO %j', async (change) => {
    await expect(parse({ ...draft(), ...change })).rejects.toThrow(
      BadRequestException,
    );
  });
  it('confirm body accepts only a version, not a replacement chart', async () => {
    await expect(
      pipe.transform(
        { expectedVersion: 1, status: 'CONFIRMED' },
        { type: 'body', metatype: ChartVersionDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it('the ordinary product update API rejects chart and policy bypass fields', async () => {
    for (const field of [
      'sizeChart',
      'sizeChartVersion',
      'sizeChartPolicyVersion',
    ]) {
      await expect(
        pipe.transform(
          { [field]: field === 'sizeChart' ? confirmed() : 1 },
          { type: 'body', metatype: UpdateProductDto },
        ),
      ).rejects.toThrow(BadRequestException);
    }
  });
  it('rejects reversed ranges', () => {
    const chart = draft();
    chart.rows[0].chest = { min: 90, max: 86 };
    expect(() => validateSizeChart(chart, ['M'])).toThrow(BadRequestException);
  });
  it('rejects a single-value measurement or ease rule', () => {
    const chart = draft();
    chart.rows[0].chest = { min: 86, max: 86 };
    expect(() => validateSizeChart(chart, ['M'])).toThrow(BadRequestException);
    const garment = draft();
    garment.measurementType = MeasurementType.Garment;
    garment.fitRules = [{ preference: FitPreference.Regular, chest: { min: 2, max: 2 } }];
    expect(() => validateSizeChart(garment, ['M'])).toThrow(BadRequestException);
  });
  it('allows an exact garment length without treating other body measurements as exact', () => {
    const chart = draft();
    chart.rows[0].length = { min: 138, max: 138 };
    expect(() => validateSizeChart(chart, ['M'], true)).not.toThrow();
    chart.rows[0].height = { min: 160, max: 160 };
    expect(() => validateSizeChart(chart, ['M'], true)).toThrow(BadRequestException);
  });
  it('allows an incomplete image draft but never confirms it', () => {
    const chart = {
      ...draft(),
      source: ChartSource.Image,
      imageUrl: 'https://example.com/chart.png',
      rows: [],
    };
    expect(() => validateSizeChart(chart, ['M'])).not.toThrow();
    expect(() => validateSizeChart(chart, ['M'], true)).toThrow(
      BadRequestException,
    );
  });
  it('requires an image for image source', () => {
    expect(() =>
      validateSizeChart({ ...draft(), source: ChartSource.Image }, ['M']),
    ).toThrow(BadRequestException);
  });
  it('requires all declared sizes and measurements at confirmation', () => {
    expect(() => validateSizeChart(draft(), ['M', 'L'], true)).toThrow(
      BadRequestException,
    );
    const chart = draft();
    delete chart.rows[0].waist;
    expect(() => validateSizeChart(chart, ['M'], true)).toThrow(
      BadRequestException,
    );
  });
  it('permits height/weight-only body charts, but not height alone', () => {
    const chart = {
      ...draft(),
      requiredMeasurements: [
        'height',
        'weight',
      ] as SaveSizeChartDto['requiredMeasurements'],
      rows: [
        {
          size: 'M',
          height: { min: 160, max: 170 },
          weight: { min: 50, max: 60 },
        },
      ],
    };
    expect(() => validateSizeChart(chart, ['M'], true)).not.toThrow();
    expect(() =>
      validateSizeChart(
        { ...chart, requiredMeasurements: ['height'] },
        ['M'],
        true,
      ),
    ).toThrow(BadRequestException);
  });
  it('requires explicit garment rules and stretch for negative ease', () => {
    const chart = { ...draft(), measurementType: MeasurementType.Garment };
    expect(() => validateSizeChart(chart, ['M'], true)).toThrow(
      BadRequestException,
    );
    const withRules = {
      ...chart,
      fitRules: [
        {
          preference: FitPreference.Slim,
          chest: { min: -2, max: 1 },
          waist: { min: 0, max: 2 },
        },
      ],
    };
    expect(() => validateSizeChart(withRules, ['M'], true)).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateSizeChart(
        { ...withRules, stretchAllowanceCm: { chest: 2 } },
        ['M'],
        true,
      ),
    ).not.toThrow();
    expect(() =>
      validateSizeChart(
        { ...withRules, stretchAllowanceCm: { chest: 1 } },
        ['M'],
        true,
      ),
    ).toThrow(BadRequestException);
  });
  it('does not apply garment ease rules to body charts', () => {
    expect(() =>
      validateSizeChart(
        { ...draft(), fitRules: [{ preference: FitPreference.Regular }] },
        ['M'],
      ),
    ).toThrow(BadRequestException);
  });
  it('rejects readiness when draft, missing, or product sizes change', () => {
    expect(isSizeChartReady(null, ['M'])).toBe(false);
    expect(isSizeChartReady({ ...confirmed(), status: 'DRAFT' }, ['M'])).toBe(
      false,
    );
    expect(isSizeChartReady(confirmed(), ['M', 'L'])).toBe(false);
    expect(isSizeChartReady(confirmed(), ['M'])).toBe(true);
  });
});

describe('size chart ownership, revisions and confirmation', () => {
  it('reads an empty chart without modifying legacy products', async () => {
    const { service, products } = setup();
    expect(await service.getOwned(userId, productId.toString())).toEqual({
      version: 0,
      sizeChart: null,
      sizes: ['M'],
      ready: false,
    });
    expect(products.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('marks a previously confirmed chart unavailable after product sizes change', async () => {
    const { service, product } = setup(confirmed(), 1);
    product.sizes.push('L');
    expect(await service.getOwned(userId, productId.toString())).toMatchObject({
      version: 1,
      sizeChart: { status: 'CONFIRMED' },
      sizes: ['M', 'L'],
      ready: false,
    });
  });
  it('denies writes and confirmation by another provider', async () => {
    const { service, users, products } = setup(confirmed(), 1);
    users.findUserById.mockResolvedValue({
      provider: { providerId: new Types.ObjectId() },
    });
    await expect(
      service.saveDraft(userId, productId.toString(), draft()),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.confirm(userId, productId.toString(), 1),
    ).rejects.toThrow(ForbiddenException);
    expect(products.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('saves a draft using atomic version and size snapshot checks', async () => {
    const { service, products } = setup();
    const result = await service.saveDraft(
      userId,
      productId.toString(),
      draft(),
    );
    expect(result.sizeChart?.status).toBe('DRAFT');
    expect(result.version).toBe(1);
    const [filter, update] = products.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({
      _id: productId,
      providerId,
      sizes: ['M'],
      $or: [{ sizeChartVersion: 0 }, { sizeChartVersion: { $exists: false } }],
    });
    expect(update.$inc).toEqual({ sizeChartVersion: 1 });
  });
  it('requires confirmation again after editing a confirmed chart', async () => {
    const { service } = setup(
      {
        ...confirmed(),
        confirmedBy: new Types.ObjectId(userId),
        confirmedAt: new Date(),
      },
      1,
    );
    const result = await service.saveDraft(userId, productId.toString(), {
      ...draft(),
      expectedVersion: 1,
    });
    expect(result.sizeChart?.status).toBe('DRAFT');
    expect(result.sizeChart?.confirmedAt).toBeUndefined();
    expect(result.sizeChart?.confirmedBy).toBeUndefined();
  });
  it('rejects a client replacement image without changing the saved chart', async () => {
    const chart = {
      ...confirmed(),
      source: ChartSource.Image,
      imageUrl: 'https://example.com/old.png',
    };
    const { service, products } = setup(chart, 1);
    await expect(service.saveDraft(userId, productId.toString(), {
      ...draft(),
      expectedVersion: 1,
      source: ChartSource.Image,
      imageUrl: 'https://example.com/new.png',
    })).rejects.toThrow(ConflictException);
    expect(products.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects a client-supplied image URL on an empty chart', async () => {
    const { service, products } = setup();
    await expect(service.saveDraft(userId, productId.toString(), {
      ...draft(),
      source: ChartSource.Image,
      imageUrl: 'https://example.com/other-provider.png',
    })).rejects.toThrow(ConflictException);
    expect(products.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('allows editing rows on the current server-uploaded image but requires reconfirmation', async () => {
    const imageUrl = 'https://example.com/old.png';
    const { service } = setup({
      ...confirmed(), source: ChartSource.Image, imageUrl,
    }, 1);
    const result = await service.saveDraft(userId, productId.toString(), {
      ...draft(), expectedVersion: 1, source: ChartSource.Image, imageUrl,
    });
    expect(result.sizeChart).toMatchObject({ status: 'DRAFT', rows: draft().rows, sourceRevision: 1 });
  });
  it('lets only the server OCR path replace an image and its verified rows together', async () => {
    const chart = {
      ...confirmed(),
      source: ChartSource.Image,
      imageUrl: 'https://example.com/old.png',
    };
    const { service } = setup(chart, 1);
    const result = await service.saveDraft(userId, productId.toString(), {
      ...draft(),
      expectedVersion: 1,
      source: ChartSource.Image,
      imageUrl: 'https://example.com/new.png',
    }, true);
    expect(result.sizeChart).toMatchObject({
      rows: draft().rows,
      sourceRevision: 2,
      status: 'DRAFT',
    });
  });
  it('confirmation records the authenticated owner and exact current version', async () => {
    const { service, products } = setup({ ...confirmed(), status: 'DRAFT' }, 1);
    const result = await service.confirm(userId, productId.toString(), 1);
    expect(result.sizeChart).toMatchObject({
      status: 'CONFIRMED',
      version: 2,
      confirmedBy: new Types.ObjectId(userId),
      confirmedAt: expect.any(Date),
    });
    expect(products.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      sizeChartVersion: 1,
    });
  });
  it('rejects a stale save and a stale confirmation before writing', async () => {
    const { service, products } = setup(confirmed(), 1);
    await expect(
      service.saveDraft(userId, productId.toString(), draft()),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.confirm(userId, productId.toString(), 0),
    ).rejects.toThrow(ConflictException);
    expect(products.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('does not confirm a missing chart', async () => {
    const { service, products } = setup();
    await expect(
      service.confirm(userId, productId.toString(), 0),
    ).rejects.toThrow(ConflictException);
    expect(products.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('returns conflict when another writer wins the atomic update', async () => {
    const { service, products } = setup();
    products.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.saveDraft(userId, productId.toString(), draft()),
    ).rejects.toThrow(ConflictException);
  });
  it('does not expose unconfirmed data in the public chart API', async () => {
    const { service } = setup({ ...confirmed(), status: 'DRAFT' }, 1);
    expect(await service.getPublic(productId.toString())).toEqual({
      status: 'UNAVAILABLE',
      reason: 'NO_CONFIRMED_SIZE_CHART',
      sizeChart: null,
    });
  });
  it('public confirmed projection excludes confirmation identity', async () => {
    const { service } = setup(confirmed(), 1);
    const response = await service.getPublic(productId.toString());
    expect(response.status).toBe('READY');
    expect(response.sizeChart).not.toHaveProperty('confirmedBy');
  });
});

describe('size chart Mongoose persistence schema (no database connection)', () => {
  const ProductModel = model('Vib92SchemaTestProduct', ProductSchema);
  it('does not assign a new policy marker to legacy documents', () => {
    const product = ProductModel.hydrate({ _id: productId, sizes: ['M'] });
    expect(product.sizeChartPolicyVersion).toBeUndefined();
    expect(product.sizeChartVersion).toBe(0);
    expect(product.sizeChart).toBeNull();
  });
  it('round-trips chart data and confirmation metadata in Mongoose documents', () => {
    const product = ProductModel.hydrate({
      _id: productId,
      sizes: ['M'],
      sizeChartPolicyVersion: 1,
      sizeChartVersion: 1,
      sizeChart: confirmed(),
    });
    expect(product.toObject().sizeChart).toMatchObject({
      status: 'CONFIRMED',
      rows: [{ size: 'M', chest: { min: 86, max: 89 } }],
    });
    expect(isSizeChartReady(product.sizeChart, product.sizes)).toBe(true);
  });
});
