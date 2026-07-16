import { ConfigService } from '@nestjs/config';
import {
  SmartTagEntityType,
  SmartTagSourceStatus,
} from '../constants/smart-tag.constants';
import { AiTaggingClientService } from './ai-tagging-client.service';

describe('AiTaggingClientService', () => {
  const definition = {
    code: 'TRUYEN_THONG',
    description: 'Ao dai truyen thong',
  };

  function createService(values: Record<string, string> = {}) {
    return new AiTaggingClientService({
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    } as unknown as ConfigService);
  }

  const input = {
    entityType: SmartTagEntityType.Product,
    title: 'Ao dai',
    description: 'Thiet ke truyen thong',
    structuredAttributes: {},
    definitions: [definition] as any,
    taxonomyVersion: 1,
  };

  afterEach(() => jest.restoreAllMocks());

  it('does not call the AI service when the feature is disabled', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const result = await createService().suggest(input);

    expect(result).toEqual({
      status: SmartTagSourceStatus.Skipped,
      suggestions: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps only allowlisted suggestions with sufficient confidence', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'SUCCESS',
        model: 'gemini-test',
        prompt_version: 'v1',
        latency_ms: 12,
        suggestions: [
          { code: 'TRUYEN_THONG', confidence: 1.2, explanation: 'matched' },
          { code: 'UNKNOWN', confidence: 0.99, explanation: 'invalid' },
          { code: 'TRUYEN_THONG', confidence: 0.5, explanation: 'too low' },
        ],
      }),
    } as Response);

    const result = await createService({ SMART_TAG_AI_ENABLED: 'true' }).suggest(
      input,
    );

    expect(result.status).toBe(SmartTagSourceStatus.Success);
    expect(result.suggestions).toEqual([
      expect.objectContaining({ tagCode: 'TRUYEN_THONG', confidence: 1 }),
    ]);
  });

  it('falls back cleanly when the AI service cannot be reached', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connection refused'));

    const result = await createService({ SMART_TAG_AI_ENABLED: 'true' }).suggest(
      input,
    );

    expect(result).toEqual({
      status: SmartTagSourceStatus.Unavailable,
      suggestions: [],
    });
  });
});
