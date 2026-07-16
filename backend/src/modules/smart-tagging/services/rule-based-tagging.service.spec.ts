import {
  SmartTagDefinitionStatus,
  SmartTagEntityType,
  SmartTagSignalSource,
} from '../constants/smart-tag.constants';
import { RuleBasedTaggingService } from './rule-based-tagging.service';

describe('RuleBasedTaggingService', () => {
  const service = new RuleBasedTaggingService();
  const definitions = [
    {
      code: 'TRUYEN_THONG',
      ruleConfig: { styles: ['traditional'], keywords: ['cung dinh'] },
      status: SmartTagDefinitionStatus.Active,
      entityTypes: [SmartTagEntityType.Product],
    },
    {
      code: 'CHAT_LIEU_LUA',
      ruleConfig: { materials: ['SILK'] },
      status: SmartTagDefinitionStatus.Active,
      entityTypes: [SmartTagEntityType.Product],
    },
    {
      code: 'PHONG_CACH_HUE',
      ruleConfig: { keywords: ['Huế', 'cố đô'] },
      status: SmartTagDefinitionStatus.Active,
      entityTypes: [SmartTagEntityType.Product],
    },
  ] as any;

  it('matches structured data with full confidence', () => {
    const suggestions = service.suggestForProduct(
      {
        name: 'Áo dài truyền thống',
        description: '',
        colors: [],
        materials: ['silk'],
        style: 'TRADITIONAL',
        occasions: [],
      },
      definitions,
    );

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tagCode: 'TRUYEN_THONG',
          signal: expect.objectContaining({ confidence: 1 }),
        }),
        expect.objectContaining({
          tagCode: 'CHAT_LIEU_LUA',
          signal: expect.objectContaining({ confidence: 1 }),
        }),
      ]),
    );
  });

  it('matches Vietnamese keywords with and without accents', () => {
    const suggestions = service.suggestForProduct(
      {
        name: 'Ao dai co do Hue',
        description: 'Trang phuc cung dinh',
        colors: [],
        materials: [],
        style: null,
        occasions: [],
      },
      definitions,
    );

    const hue = suggestions.find((item) => item.tagCode === 'PHONG_CACH_HUE');
    expect(hue?.signal).toEqual(
      expect.objectContaining({
        source: SmartTagSignalSource.Rule,
        confidence: 0.85,
        evidence: expect.objectContaining({
          matchedKeywords: expect.arrayContaining(['Huế', 'cố đô']),
        }),
      }),
    );
  });
});
