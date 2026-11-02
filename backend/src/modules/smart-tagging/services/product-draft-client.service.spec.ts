import { BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProviderProductDraftController } from '../controllers/provider-product-draft.controller';
import { ProductDraftRequestDto } from '../dto/product-draft.dto';
import { ProductDraftClientService } from './product-draft-client.service';

const PHOTO = 'https://res.cloudinary.com/vibehue/image/upload/v1/products/red.jpg';

function createClient(config: Record<string, string> = { CLOUDINARY_CLOUD_NAME: 'vibehue' }) {
  return new ProductDraftClientService({
    get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback),
  } as unknown as ConfigService);
}

function respond(body: unknown, status = 200) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => jest.restoreAllMocks());

describe('ProductDraftClientService (UC-C10 name/description from photos)', () => {
  it('sends the uploaded photos to the AI service and returns its suggestion', async () => {
    const fetchMock = respond({
      status: 'SUCCESS',
      attributes: [{ group: 'color', key: 'RED', label: 'đỏ', confidence: 0.9, on_cover: true }],
      name: 'Áo dài đỏ',
      description: 'Mẫu áo dài màu đỏ.',
      colors: ['RED'],
    });

    await expect(createClient().draftFromPhotos([PHOTO])).resolves.toMatchObject({
      status: 'SUCCESS',
      name: 'Áo dài đỏ',
      colors: ['RED'],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/vision/describe-product',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ image_urls: [PHOTO] }) }),
    );
  });

  it.each([
    ['another site', 'https://example.com/a.jpg'],
    ['plain http', 'http://res.cloudinary.com/vibehue/image/upload/a.jpg'],
    ['another Cloudinary account', 'https://res.cloudinary.com/someone-else/image/upload/a.jpg'],
    ['not a URL', 'not-a-url'],
  ])('rejects photos from %s without calling the AI service', async (_case, url) => {
    const fetchMock = respond({});

    await expect(createClient().draftFromPhotos([PHOTO, url])).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the suggestion as unavailable when the AI service fails or is offline', async () => {
    respond({ detail: 'error' }, 500);
    await expect(createClient().draftFromPhotos([PHOTO])).resolves.toMatchObject({ status: 'UNAVAILABLE', name: '' });

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));
    await expect(createClient().draftFromPhotos([PHOTO])).resolves.toMatchObject({ status: 'UNAVAILABLE' });
  });

  it('caps the suggested text to the wizard field limits', async () => {
    respond({ status: 'SUCCESS', name: 'x'.repeat(300), description: 'y'.repeat(1500) });

    const draft = await createClient().draftFromPhotos([PHOTO]);

    expect(draft.name).toHaveLength(200);
    expect(draft.description).toHaveLength(1000);
  });
});

describe('ProviderProductDraftController (UC-C10)', () => {
  it('rate limits each provider to 10 suggestions per minute before calling the AI', async () => {
    const limited = jest.fn().mockRejectedValue(new HttpException('Too many requests', 429));
    const client = { draftFromPhotos: jest.fn() };
    const controller = new ProviderProductDraftController(client as any, { assertRateLimit: limited } as any);

    await expect(
      controller.draft({ sub: 'provider-1' } as any, { imageUrls: [PHOTO] }),
    ).rejects.toMatchObject({ status: 429 });
    expect(limited).toHaveBeenCalledWith('product-draft:user:provider-1', 10, 60);
    expect(client.draftFromPhotos).not.toHaveBeenCalled();
  });

  it('accepts one to three photos', async () => {
    const errorsFor = async (imageUrls: unknown) =>
      (await validate(plainToInstance(ProductDraftRequestDto, { imageUrls }))).length;

    expect(await errorsFor([PHOTO])).toBe(0);
    expect(await errorsFor([PHOTO, PHOTO, PHOTO])).toBe(0);
    expect(await errorsFor([])).toBeGreaterThan(0);
    expect(await errorsFor([PHOTO, PHOTO, PHOTO, PHOTO])).toBeGreaterThan(0);
  });
});
