import { ConfigService } from '@nestjs/config';
import {
  SmartTagEntityType,
  SmartTagSourceStatus,
} from '../constants/smart-tag.constants';
import { AiTaggingClientService } from './ai-tagging-client.service';

describe('UC-27 AI Style Matching - AI tagging client (DaiBLL)', () => {
  const input = {
    entityType: SmartTagEntityType.Product,
    title: 'Ao dai',
    description: 'Thiet ke truyen thong',
    structuredAttributes: { colors: ['RED'] },
    definitions: [
      {
        code: 'TRUYEN_THONG',
        description: 'Ao dai truyen thong',
        group: 'STYLE',
      },
    ] as any,
    taxonomyVersion: 3,
  };

  function createService(values: Record<string, string> = {}) {
    return new AiTaggingClientService({
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    } as unknown as ConfigService);
  }

  function enabledService(values: Record<string, string> = {}) {
    return createService({ SMART_TAG_AI_ENABLED: 'true', ...values });
  }

  function mockAiResponse(body: unknown, ok = true, status = 200) {
    return jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok, status, json: async () => body } as Response);
  }

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('UT-27 UTCID09 accepts confidence at the 0.87 threshold and rejects values below it', async () => {
    mockAiResponse({
      status: 'SUCCESS',
      suggestions: [
        { code: 'TRUYEN_THONG', confidence: 0.87, explanation: 'threshold' },
        {
          code: 'TRUYEN_THONG',
          confidence: 0.869,
          explanation: 'below threshold',
        },
      ],
    });

    const result = await enabledService().suggest(input);

    expect(
      result.suggestions.map((suggestion) => suggestion.confidence),
    ).toEqual([0.87]);
  });

  it('UT-27 UTCID10 reports the AI source as unavailable when it returns an HTTP error', async () => {
    mockAiResponse({ status: 'SUCCESS', suggestions: [] }, false, 503);

    await expect(enabledService().suggest(input)).resolves.toEqual({
      status: SmartTagSourceStatus.Unavailable,
      suggestions: [],
    });
  });

  it('UT-27 UTCID11 ignores a malformed AI payload and non-numeric confidence values', async () => {
    mockAiResponse({
      status: 'FAILED',
      suggestions: [{ code: 'TRUYEN_THONG', confidence: 0.99 }],
    });
    await expect(enabledService().suggest(input)).resolves.toEqual({
      status: SmartTagSourceStatus.Unavailable,
      suggestions: [],
    });

    jest.restoreAllMocks();
    mockAiResponse({
      status: 'SUCCESS',
      suggestions: [{ code: 'TRUYEN_THONG', confidence: 'high' }],
    });
    await expect(enabledService().suggest(input)).resolves.toEqual({
      status: SmartTagSourceStatus.Success,
      suggestions: [],
    });
  });

  it('UT-27 UTCID12 aborts a slow AI request after the configured timeout', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () =>
            reject(
              Object.assign(new Error('The operation was aborted'), {
                name: 'AbortError',
              }),
            ),
          );
        }),
    );

    const pending = enabledService({ SMART_TAG_AI_TIMEOUT_MS: '1000' }).suggest(
      input,
    );
    await jest.advanceTimersByTimeAsync(1000);

    await expect(pending).resolves.toEqual({
      status: SmartTagSourceStatus.Unavailable,
      suggestions: [],
    });
  });

  it('UT-27 UTCID13 limits title and description length and sends only allowlisted tags', async () => {
    const fetchMock = mockAiResponse({ status: 'SUCCESS', suggestions: [] });

    await enabledService({ AI_SERVICE_URL: 'http://ai.test/' }).suggest({
      ...input,
      title: 't'.repeat(250),
      description: 'd'.repeat(2500),
    });

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init!.body));
    expect(url).toBe('http://ai.test/tagging/suggest');
    expect(body.title).toHaveLength(200);
    expect(body.description).toHaveLength(2000);
    expect(body.allowed_tags).toEqual([
      {
        code: 'TRUYEN_THONG',
        description: 'Ao dai truyen thong',
        group: 'STYLE',
      },
    ]);
    expect(body.taxonomy_version).toBe(3);
  });
});
