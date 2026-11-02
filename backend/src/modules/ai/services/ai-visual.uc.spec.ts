import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AiController,
  ChatWithImageRequestDto,
} from '../controllers/ai.controller';
import { VisualSearchController } from '../controllers/visual-search.controller';
import { AiService } from './ai.service';

function createService(url?: string) {
  return new AiService({
    get: jest.fn((_key: string, fallback?: string) => url ?? fallback),
  } as unknown as ConfigService);
}

function respond(body: unknown, status = 200) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

function offline() {
  return jest
    .spyOn(global, 'fetch')
    .mockRejectedValue(new Error('connect ECONNREFUSED'));
}

function createController(
  service = createService(),
  rateLimit = jest.fn().mockResolvedValue(undefined),
) {
  return {
    controller: new AiController(service, {
      assertRateLimit: rateLimit,
    } as any),
    service,
    rateLimit,
  };
}

function createVisualSearchController(
  service = createService(),
  rateLimit = jest.fn().mockResolvedValue(undefined),
  products: any[] = [],
) {
  return new VisualSearchController(
    service,
    { assertRateLimit: rateLimit, ipKey: (ip?: string) => ip || 'unknown-ip' } as any,
    {
      getActiveProductsPage: jest.fn().mockResolvedValue({ data: products }),
    } as any,
  );
}

const user = { sub: 'customer-1', roles: ['CUSTOMER'] } as any;
const image = { image_base64: 'base64-image', mime_type: 'image/jpeg' };

afterEach(() => jest.restoreAllMocks());

describe('UC-30 Visual Search (DatTT)', () => {
  it('UT-30 UTCID03 posts the image to the visual match endpoint and returns the matches', async () => {
    const fetchMock = respond([{ productId: 'product-1', score: 0.91 }]);

    await expect(createService().visualMatch(image)).resolves.toEqual([
      { productId: 'product-1', score: 0.91 },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/visual-search/match',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(image),
      }),
    );
  });

  it('UT-30 UTCID04 returns no matches when the AI service answers with an error status', async () => {
    respond({ detail: 'error' }, 500);

    await expect(createService().visualMatch(image)).resolves.toEqual([]);
  });

  it('UT-30 UTCID05 returns no matches when the AI service is offline', async () => {
    offline();

    await expect(createService().visualMatch(image)).resolves.toEqual([]);
  });

  it('UT-30 UTCID06 uses the configured AI service address', async () => {
    const fetchMock = respond([]);

    await createService('http://ai.internal:9000').visualMatch(image);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://ai.internal:9000/visual-search/match',
    );
  });

  it('UT-30 UTCID07 fills default values in the image chat answer', async () => {
    respond({ answer: 'Mẫu tương tự' });

    await expect(
      createService().chatWithImage(
        'Tìm áo tương tự',
        'base64-image',
        'image/png',
      ),
    ).resolves.toMatchObject({
      answer: 'Mẫu tương tự',
      found: true,
      confidence: 0.95,
      source: 'gemini_vision',
      recommended_products: [],
    });
  });

  it('UT-30 UTCID08 reports an error for the image chat when the AI service is offline', async () => {
    offline();

    await expect(
      createService().chatWithImage('Tìm áo', 'base64-image', 'image/png'),
    ).rejects.toThrow('connect ECONNREFUSED');
  });

  it('UT-30 UTCID09 requires the image data and type for the image chat', async () => {
    const errors = await validate(
      plainToInstance(ChatWithImageRequestDto, {
        message: 'Tìm áo',
        image_base64: '',
        mime_type: '',
      }),
    );

    expect(errors.map((error) => error.property).sort()).toEqual([
      'image_base64',
      'mime_type',
    ]);
  });

  it('UT-30 UTCID10 limits visual search to 20 requests per minute per user', async () => {
    const limited = jest
      .fn()
      .mockRejectedValue(new HttpException('Too many requests', 429));
    const service = createService();
    const controller = createVisualSearchController(service, limited);
    const match = jest.spyOn(service, 'visualMatch');

    await expect(controller.visualMatch(user, image)).rejects.toMatchObject({
      status: 429,
    });
    expect(limited).toHaveBeenCalledWith('ai_match_customer-1', 20, 60);
    expect(match).not.toHaveBeenCalled();
  });

  // UT-DEF-30-01 (fixed): a request without an image used to be forwarded to the AI service.
  it('UT-30 UTCID11 rejects a visual search request without an image', async () => {
    const fetchMock = respond([]);

    await expect(
      createVisualSearchController().visualMatch(user, {} as any),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('UC-31 AI Context Recommendation (DatTT)', () => {
  const payload = {
    budget: 1500000,
    location_context: 'Đại Nội Huế',
    concept: 'cổ điển',
  };

  it('UT-31 UTCID04 posts the shooting context and returns the AI recommendation', async () => {
    const fetchMock = respond({
      location_context: 'Đại Nội Huế',
      suggested_products: ['product-1'],
    });

    await expect(
      createService().contextRecommend(payload),
    ).resolves.toMatchObject({ suggested_products: ['product-1'] });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8000/visual-search/context-recommend',
    );
  });

  it('UT-31 UTCID05 falls back to a default recommendation for the requested location', async () => {
    respond({}, 503);

    await expect(createService().contextRecommend(payload)).resolves.toEqual({
      location_context: 'Đại Nội Huế',
      recommended_ao_dai_colors: ['Trắng', 'Đỏ', 'Hồng'],
      recommended_makeup_style: 'Makeup tự nhiên nhẹ nhàng',
      photographer_style_tip: 'Tận dụng ánh sáng tự nhiên outdoor',
      color_palette_hex: ['#FFFFFF', '#FF0000', '#FFC0CB'],
      suggested_products: [],
    });
  });

  it('UT-31 UTCID06 uses "Ngoại cảnh" when the location is missing and the AI service is offline', async () => {
    offline();

    await expect(
      createService().contextRecommend({ budget: 0 }),
    ).resolves.toMatchObject({ location_context: 'Ngoại cảnh' });
  });

  it('UT-31 UTCID07 returns one palette colour for each recommended Ao Dai colour in the fallback', async () => {
    offline();

    const result = await createService().contextRecommend(payload);

    expect(result.color_palette_hex).toHaveLength(
      result.recommended_ao_dai_colors.length,
    );
  });

  it('UT-31 UTCID08 limits context recommendations to 20 requests per minute per user', async () => {
    respond({ suggested_products: [] });
    const { controller, rateLimit } = createController();

    await expect(controller.contextRecommend(user, payload)).resolves.toEqual({
      suggested_products: [],
    });
    expect(rateLimit).toHaveBeenCalledWith('ai_visual_customer-1', 20, 60);
  });

  it('UT-31 UTCID09 does not call the AI service when the user is rate limited', async () => {
    const fetchMock = respond({});
    const { controller } = createController(
      createService(),
      jest.fn().mockRejectedValue(new HttpException('Too many requests', 429)),
    );

    await expect(
      controller.contextRecommend(user, payload),
    ).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
