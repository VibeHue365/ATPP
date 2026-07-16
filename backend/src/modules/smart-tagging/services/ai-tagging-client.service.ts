import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SmartTagEntityType,
  SmartTagSignalSource,
  SmartTagSourceStatus,
} from '../constants/smart-tag.constants';
import { SmartTagDefinitionDocument } from '../schemas/smart-tag-definition.schema';

const DEFAULT_TIMEOUT_MS = 8_000;
const MIN_AI_CONFIDENCE = 0.65;

export interface AiTagSuggestion {
  tagCode: string;
  confidence: number;
  explanation: string;
  source: SmartTagSignalSource.AiText;
  modelMetadata: {
    provider: string;
    model: string;
    promptVersion: string;
    latencyMs: number;
  };
}

export interface AiTaggingResult {
  status: SmartTagSourceStatus;
  suggestions: AiTagSuggestion[];
}

export interface AiTaggingInput {
  entityType: SmartTagEntityType;
  title: string;
  description?: string | null;
  structuredAttributes: Record<string, unknown>;
  definitions: SmartTagDefinitionDocument[];
  taxonomyVersion: number;
}

@Injectable()
export class AiTaggingClientService {
  private readonly logger = new Logger(AiTaggingClientService.name);
  private readonly serviceUrl: string;
  private readonly enabled: boolean;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.serviceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://127.0.0.1:8000',
    );
    this.enabled =
      this.configService
        .get<string>('SMART_TAG_AI_ENABLED', 'false')
        .toLowerCase() === 'true';
    this.timeoutMs = this.getTimeoutMs();
  }

  async suggest(input: AiTaggingInput): Promise<AiTaggingResult> {
    if (!this.enabled) {
      return { status: SmartTagSourceStatus.Skipped, suggestions: [] };
    }

    const allowedCodes = new Set(input.definitions.map((definition) => definition.code));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(
        `${this.serviceUrl.replace(/\/$/, '')}/tagging/suggest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            entity_type: input.entityType,
            title: input.title.slice(0, 200),
            description: (input.description || '').slice(0, 2000),
            structured_attributes: input.structuredAttributes,
            allowed_tags: input.definitions.map((definition) => ({
              code: definition.code,
              description: definition.description,
            })),
            taxonomy_version: input.taxonomyVersion,
          }),
        },
      );
      if (!response.ok) {
        this.logger.warn(`Smart tag AI returned HTTP ${response.status}`);
        return { status: SmartTagSourceStatus.Unavailable, suggestions: [] };
      }

      const payload = (await response.json()) as AiTaggingApiResponse;
      if (payload.status !== 'SUCCESS' || !Array.isArray(payload.suggestions)) {
        return { status: SmartTagSourceStatus.Unavailable, suggestions: [] };
      }

      return {
        status: SmartTagSourceStatus.Success,
        suggestions: payload.suggestions.flatMap((suggestion) => {
          if (
            typeof suggestion.code !== 'string' ||
            !allowedCodes.has(suggestion.code)
          ) {
            return [];
          }
          const confidence = Number(suggestion.confidence);
          if (!Number.isFinite(confidence)) return [];
          const normalizedConfidence = Math.max(0, Math.min(1, confidence));
          if (normalizedConfidence < MIN_AI_CONFIDENCE) return [];
          return [
            {
              tagCode: suggestion.code,
              confidence: normalizedConfidence,
              explanation: String(suggestion.explanation || '').slice(0, 500),
              source: SmartTagSignalSource.AiText,
              modelMetadata: {
                provider: 'gemini',
                model: String(payload.model || 'unknown').slice(0, 100),
                promptVersion: String(payload.prompt_version || 'unknown').slice(
                  0,
                  100,
                ),
                latencyMs: Math.max(0, Number(payload.latency_ms) || 0),
              },
            },
          ];
        }),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown error';
      this.logger.warn(`Smart tag AI is unavailable: ${reason}`);
      return { status: SmartTagSourceStatus.Unavailable, suggestions: [] };
    } finally {
      clearTimeout(timeout);
    }
  }

  private getTimeoutMs(): number {
    const configured = Number(
      this.configService.get<string>('SMART_TAG_AI_TIMEOUT_MS', String(DEFAULT_TIMEOUT_MS)),
    );
    return Number.isFinite(configured) && configured >= 1_000 && configured <= 30_000
      ? configured
      : DEFAULT_TIMEOUT_MS;
  }
}

interface AiTaggingApiResponse {
  status?: string;
  suggestions?: Array<{
    code?: string;
    confidence?: number;
    explanation?: string;
  }>;
  model?: string;
  prompt_version?: string;
  latency_ms?: number;
}
