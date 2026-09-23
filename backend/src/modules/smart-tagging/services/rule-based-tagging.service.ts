import { Injectable } from '@nestjs/common';
import {
  SmartTagSignal,
  SmartTagSignalEvidence,
} from '../schemas/smart-tag-assignment.schema';
import { SmartTagDefinitionDocument } from '../schemas/smart-tag-definition.schema';
import { SmartTagSignalSource } from '../constants/smart-tag.constants';

export interface ProductTaggingInput {
  name: string;
  description?: string | null;
}

export interface RuleBasedTagSuggestion {
  tagCode: string;
  signal: SmartTagSignal;
}

@Injectable()
export class RuleBasedTaggingService {
  suggestForProduct(
    input: ProductTaggingInput,
    definitions: SmartTagDefinitionDocument[],
  ): RuleBasedTagSuggestion[] {
    const normalizedText = normalizeText(
      `${input.name} ${input.description || ''}`,
    );
    const suggestions = new Map<string, SmartTagSignalEvidence>();

    for (const definition of definitions) {
      const matchedKeywords: string[] = [];
      const config = definition.ruleConfig || {};

      for (const keyword of config.keywords || []) {
        if (normalizedText.includes(normalizeText(keyword))) {
          matchedKeywords.push(keyword);
        }
      }

      if (matchedKeywords.length === 0) continue;

      suggestions.set(definition.code, { matchedKeywords });
    }

    return Array.from(suggestions.entries()).map(([tagCode, evidence]) => ({
      tagCode,
      signal: {
        source: SmartTagSignalSource.Rule,
        confidence: keywordConfidence(evidence),
        evidence,
      },
    }));
  }
}

function keywordConfidence(evidence: SmartTagSignalEvidence): number {
  return (evidence.matchedKeywords?.length || 0) > 1 ? 0.85 : 0.75;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
