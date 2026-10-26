import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChatRequestDto } from '../controllers/ai.controller';
import { AiService } from './ai.service';

function createService() {
  return new AiService({
    get: jest.fn((_key: string, fallback?: string) => fallback),
  } as unknown as ConfigService);
}

function offline() {
  jest
    .spyOn(global, 'fetch')
    .mockRejectedValue(new Error('connect ECONNREFUSED'));
  return createService();
}

describe('UC-32 AI Chat Recommendation (HoangLVM)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('UT-32 UTCID02 maps the AI service answer and fills missing fields with defaults', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ answer: 'Nên chọn lụa tơ tằm', category: 'fabric' }),
    } as Response);

    await expect(createService().chat('Vải nào mát?')).resolves.toEqual({
      question: 'Vải nào mát?',
      answer: 'Nên chọn lụa tơ tằm',
      found: true,
      matched_question: 'AI Assistant Match',
      category: 'fabric',
      confidence: 0.9,
      source: 'ai-service',
      age_range_used: 'age_unspecified',
      gender_used: 'unknown',
      recommended_products: [],
    });
  });

  it('UT-32 UTCID03 falls back to offline answers when the AI service returns HTTP 500', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(createService().chat('xin chào')).resolves.toMatchObject({
      source: 'offline_fallback',
      category: 'general',
    });
  });

  it('UT-32 UTCID04 falls back to offline answers when the AI service is unreachable', async () => {
    await expect(offline().chat('xin chào')).resolves.toMatchObject({
      source: 'offline_fallback',
      confidence: 0.8,
    });
  });

  it('UT-32 UTCID05 recommends size M for 158 cm, 50 kg and a 66 cm waist', async () => {
    const result = await offline().chat(
      'Tư vấn size: chiều cao 158, cân nặng 50, vòng eo 66',
    );

    expect(result.category).toBe('size_guidance');
    expect(result.answer).toContain('Size M');
  });

  it('UT-32 UTCID06 moves up to size XL at the 168 cm and 60 kg boundaries', async () => {
    await expect(
      offline().chat('size cho chiều cao 168 cân nặng 50 eo 60'),
    ).resolves.toMatchObject({
      answer: expect.stringContaining('Size XL'),
    });
    await expect(
      offline().chat('size cho chiều cao 150 cân nặng 60 eo 60'),
    ).resolves.toMatchObject({
      answer: expect.stringContaining('Size XL'),
    });
  });

  it('UT-32 UTCID07 advises custom tailoring for measurements above the size chart', async () => {
    const result = await offline().chat('size cho chiều cao 165 cân nặng 90');

    expect(result.answer).toContain('vượt quá bảng size may sẵn');
  });

  it('UT-32 UTCID08 answers fabric questions offline', async () => {
    await expect(
      offline().chat('Chất liệu nào mặc mùa hè?'),
    ).resolves.toMatchObject({ category: 'fabric' });
  });

  it('UT-32 UTCID09 answers rental price questions offline', async () => {
    await expect(
      offline().chat('Giá thuê bao nhiêu tiền?'),
    ).resolves.toMatchObject({
      category: 'pricing',
      answer: expect.stringContaining('350.000đ'),
    });
  });

  it('UT-32 UTCID10 URL-encodes the question sent to the AI service', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({ answer: 'ok' }),
      } as Response);

    await createService().chat('Áo dài & giá?');

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://127.0.0.1:8000/chat?message=%C3%81o%20d%C3%A0i%20%26%20gi%C3%A1%3F',
    );
  });

  it('UT-32 UTCID11 rejects an empty chat message', async () => {
    const errors = await validate(
      plainToInstance(ChatRequestDto, { message: '' }),
    );

    expect(errors.map((error) => error.property)).toEqual(['message']);
  });

  // Known defect UT-DEF-32-01: the collar keyword "co" also matches words such as "combo".
  it.failing(
    'UT-32 UTCID12 answers a combo price question with pricing information',
    async () => {
      await expect(
        offline().chat('Áo dài combo giá bao nhiêu?'),
      ).resolves.toMatchObject({ category: 'pricing' });
    },
  );
});
