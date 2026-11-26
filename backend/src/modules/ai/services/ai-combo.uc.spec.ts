import {
  ArgumentMetadata,
  BadRequestException,
  HttpException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiController } from '../controllers/ai.controller';
import { ComboSuggestionRequestDto } from '../dto/combo-suggestion.dto';
import { AiService } from './ai.service';

function createService() {
  return new AiService({
    get: jest.fn((_key: string, fallback?: string) => fallback),
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

const request = (
  overrides: Partial<ComboSuggestionRequestDto> = {},
): ComboSuggestionRequestDto => ({
  product: { name: 'Áo dài lụa', description: 'Lụa tơ tằm', basePrice: 500000 },
  photography_package: {
    name: 'Gói chụp ngoại cảnh',
    description: 'Chụp 2 giờ',
    price: 1500000,
    maxPeople: 2,
  },
  ...overrides,
});

const provider = { sub: 'provider-1', roles: ['PROVIDER'] } as any;

afterEach(() => jest.restoreAllMocks());

describe('UC-27 Smart Combo Recommendation (DaiBLL)', () => {
  it('UT-27 UTCID19 sends the outfit and package to the AI service and returns its suggestion', async () => {
    const suggestion = {
      name: 'Combo Cố Đô',
      suggested_price: 1700000,
      source: 'gemini',
    };
    const fetchMock = respond(suggestion);

    await expect(createService().suggestCombo(request())).resolves.toEqual(
      suggestion,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/combos/suggest',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(request()),
      }),
    );
  });

  it('UT-27 UTCID20 falls back to a 15% discounted combo rounded to 10,000 VND when the AI service fails', async () => {
    respond({}, 503);

    await expect(
      createService().suggestCombo(request()),
    ).resolves.toMatchObject({
      suggested_discount_percent: 15,
      suggested_price: 1700000,
      suggested_shoot_people_count: 2,
      suggested_aodai_quantity: 1,
      source: 'backend_intelligent_fallback',
    });
  });

  it('UT-27 UTCID21 keeps 85% of a small combo price instead of rounding it to zero', async () => {
    offline();

    const result = await createService().suggestCombo(
      request({
        product: { name: 'Áo dài', basePrice: 3000 },
        photography_package: { name: 'Gói chụp', price: 2000 },
      }),
    );

    expect(result.suggested_price).toBe(4250);
  });

  it('UT-27 UTCID22 picks the Tet theme from the outfit, package or vibe keywords', async () => {
    offline();

    const result = await createService().suggestCombo(
      request({ vibe: 'Du xuân ngày Tết' }),
    );

    expect(result).toMatchObject({
      concept_theme: 'Sắc Xuân Hoan Hỉ - Tết Cổ Truyền',
    });
    expect(result.name).toBe(
      'Combo Đón Tết An Khang - Áo dài lụa & Gói chụp ngoại cảnh',
    );
  });

  it('UT-27 UTCID23 picks the imperial theme for Dai Noi and brocade outfits', async () => {
    offline();

    const result = await createService().suggestCombo(
      request({
        product: { name: 'Áo dài gấm', basePrice: 500000 },
      }),
    );

    expect(result.concept_theme).toBe('Dấu Ấn Hoàng Cung - Cổ Điển Quý Phái');
    expect(result.ideal_locations).toContain('Đại Nội Huế / Hoàng Thành');
  });

  it('UT-27 UTCID24 uses the default theme, default names and one person when nothing matches', async () => {
    offline();

    const result = await createService().suggestCombo({
      product: {} as any,
      photography_package: {} as any,
    });

    expect(result).toMatchObject({
      concept_theme: 'Nàng Thơ Dạo Phố - Thanh Lịch Hiện Đại',
      name: 'Combo Nàng Thơ Trọn Gói - Áo dài truyền thống & Gói chụp ảnh nghệ thuật',
      suggested_price: 0,
      suggested_shoot_people_count: 1,
    });
  });

  it('UT-27 UTCID25 keeps the suggested name within 100 and the description within 280 characters', async () => {
    offline();
    const long = 'A'.repeat(150);

    const result = await createService().suggestCombo(
      request({
        product: { name: long, basePrice: 1 },
        photography_package: { name: long, price: 1 },
      }),
    );

    expect(result.name.length).toBeLessThanOrEqual(100);
    expect(result.description.length).toBeLessThanOrEqual(280);
    expect(result.description.endsWith('...')).toBe(true);
  });

  it('UT-27 UTCID26 limits combo suggestions to 20 requests per minute per provider', async () => {
    const service = createService();
    const limited = jest
      .fn()
      .mockRejectedValue(new HttpException('Too many requests', 429));
    const suggest = jest.spyOn(service, 'suggestCombo');
    const controller = new AiController(service, {
      assertRateLimit: limited,
    } as any);

    await expect(
      controller.suggestCombo(provider, request()),
    ).rejects.toMatchObject({ status: 429 });
    expect(limited).toHaveBeenCalledWith('ai_combo_provider-1', 20, 60);
    expect(suggest).not.toHaveBeenCalled();
  });

  it(
    'UT-27 UTCID27 accepts the combo suggestion request sent by the provider combo form',
    async () => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: ComboSuggestionRequestDto,
      };

      await expect(
        pipe.transform({ ...request(), vibe: 'Cổ điển' }, metadata),
      ).resolves.toMatchObject({
        product: { name: 'Áo dài lụa' },
      });
    },
  );

  it('UT-27 UTCID28 rejects an unknown request field', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        { vibe: 'Cổ điển', discount: 90 },
        { type: 'body', metatype: ComboSuggestionRequestDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
