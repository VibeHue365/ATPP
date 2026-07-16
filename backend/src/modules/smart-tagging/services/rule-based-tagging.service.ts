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
  colors: string[];
  materials: string[];
  style?: string | null;
  occasions: string[];
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
      const matchedFields: string[] = [];
      const matchedKeywords: string[] = [];
      const config = definition.ruleConfig || {};

      if (matchesValue(input.style, config.styles)) matchedFields.push('style');
      if (matchesAny(input.occasions, config.occasions)) {
        matchedFields.push('occasions');
      }
      if (matchesAny(input.materials, config.materials)) {
        matchedFields.push('materials');
      }
      if (matchesAny(input.colors, config.colors)) matchedFields.push('colors');

      for (const keyword of config.keywords || []) {
        if (normalizedText.includes(normalizeText(keyword))) {
          matchedKeywords.push(keyword);
        }
      }

      if (matchedFields.length === 0 && matchedKeywords.length === 0) continue;

      suggestions.set(definition.code, { matchedFields, matchedKeywords });
    }

    return Array.from(suggestions.entries()).map(([tagCode, evidence]) => ({
      tagCode,
      signal: {
        source: SmartTagSignalSource.Rule,
        confidence: evidence.matchedFields?.length
          ? 1
          : keywordConfidence(evidence),
        evidence,
      },
    }));
  }
}

function matchesValue(value: string | null | undefined, allowed?: string[]) {
  if (!value || !allowed?.length) return false;
  return allowed.some((item) => item.toLowerCase() === value.toLowerCase());
}

function matchesAny(values: string[] | undefined, allowed?: string[]) {
  if (!values?.length || !allowed?.length) return false;
  return values.some((value) => matchesValue(value, allowed));
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
