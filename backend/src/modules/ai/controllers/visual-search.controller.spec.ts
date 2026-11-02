import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  VisualSearchController,
  VisualSearchRequestDto,
} from './visual-search.controller';

const image = { image_base64: 'base64-image', mime_type: 'image/jpeg' };

function setup(matches: unknown, products: any[] = []) {
  const aiService = { visualMatch: jest.fn().mockResolvedValue(matches) };
  const rateLimit = {
    assertRateLimit: jest.fn().mockResolvedValue(undefined),
    ipKey: jest.fn((ip?: string) => ip || 'unknown-ip'),
  };
  const productsService = {
    getActiveProductsPage: jest.fn().mockResolvedValue({ data: products }),
  };
  const controller = new VisualSearchController(
    aiService as any,
    rateLimit as any,
    productsService as any,
  );
  return { controller, aiService, rateLimit, productsService };
}

describe('VisualSearchController (VIB-93 visual search)', () => {
  it('lets guests search and rate limits them by IP', async () => {
    const { controller, rateLimit } = setup([]);

    await controller.visualMatch(null, image, { ip: '10.0.0.7' });

    expect(rateLimit.assertRateLimit).toHaveBeenCalledWith('ai_match_10.0.0.7', 20, 60);
  });

  it('forwards only the image to the AI service', async () => {
    const { controller, aiService } = setup([]);

    await controller.visualMatch(null, { ...image, extra: 'x' } as any);

    expect(aiService.visualMatch).toHaveBeenCalledWith(image);
  });

  it('returns public products in match order with their similarity score', async () => {
    const { controller, productsService } = setup(
      [
        { productId: 'b', score: 0.91 },
        { productId: 'hidden', score: 0.8 },
        { productId: 'a', score: 0.7 },
      ],
      [
        { _id: 'a', name: 'Áo A' },
        { _id: 'b', name: 'Áo B' },
      ],
    );

    const result = await controller.visualMatch(null, image);

    expect(productsService.getActiveProductsPage).toHaveBeenCalledWith(
      { ids: ['b', 'hidden', 'a'] },
      1,
      3,
    );
    expect(result).toEqual({
      items: [
        { _id: 'b', name: 'Áo B', visualScore: 0.91 },
        { _id: 'a', name: 'Áo A', visualScore: 0.7 },
      ],
      message: null,
    });
  });

  it('explains when the photo has no matching Ao Dai', async () => {
    const { controller, productsService } = setup([]);

    await expect(controller.visualMatch(null, image)).resolves.toEqual({
      items: [],
      message: 'Không tìm thấy áo dài phù hợp trong ảnh.',
    });
    expect(productsService.getActiveProductsPage).not.toHaveBeenCalled();
  });

  it('accepts only JPEG, PNG and WebP uploads', async () => {
    const errors = await validate(
      plainToInstance(VisualSearchRequestDto, { image_base64: 'x', mime_type: 'image/gif' }),
    );

    expect(errors.map((error) => error.property)).toEqual(['mime_type']);
  });
});
