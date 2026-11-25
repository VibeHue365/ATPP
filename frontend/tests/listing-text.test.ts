import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildListingDescription,
  buildListingName,
  OCCASION_OPTIONS,
  selectionFrom,
  STYLE_OPTIONS,
  withSelection,
  type DraftAttribute,
} from '../src/features/provider-dashboard/collections/listingText';

const attr = (group: string, key: string, label: string, on_cover = true): DraftAttribute => ({
  group, key, label, confidence: 0.9, on_cover,
});

// Same sample as ai-service/vision/test_product_draft.py, so web and AI service build the same text.
const GEMINI_SAMPLE = [
  attr('color', 'PINK', 'hồng'),
  attr('pattern', 'PRINTED', 'in họa tiết'),
  attr('style', 'CACH_TAN', 'cách tân'),
  attr('material', 'LUA', 'lụa'),
  attr('motif', 'HOA_SEN', 'hoa sen'),
  attr('occasion', 'PHU_HOP_LE_CUOI', 'lễ cưới'),
  attr('occasion', 'CHUP_ANH_KY_YEU', 'kỷ yếu'),
];

describe('UC-C10 listing text (mirror of the AI service)', () => {
  it('builds the Gemini name without the colour and the description with the occasions', () => {
    expect(buildListingName(GEMINI_SAMPLE)).toBe('Áo dài cách tân lụa hoa sen');
    expect(buildListingDescription(GEMINI_SAMPLE)).toBe(
      'Mẫu áo dài phong cách cách tân, chất liệu lụa, màu hồng, họa tiết hoa sen. '
      + 'Gam hồng nhẹ nhàng, tôn nét dịu dàng, nữ tính. Phù hợp lễ cưới và chụp ảnh kỷ yếu.',
    );
  });

  it('keeps the CLIP-only wording when no fabric or motif is known', () => {
    const clip = [attr('color', 'RED', 'đỏ'), attr('color', 'GOLD', 'vàng'), attr('color', 'BLUE', 'xanh dương', false), attr('pattern', 'BROCADE', 'gấm hoa văn')];
    expect(buildListingName(clip)).toBe('Áo dài đỏ gấm hoa văn');
    expect(buildListingDescription(clip)).toContain('Mẫu áo dài màu đỏ phối vàng, chất liệu gấm dệt hoa văn nổi bật.');
    expect(buildListingDescription(clip)).toContain('Có thêm các màu: xanh dương.');
    expect(buildListingDescription(clip).endsWith('Phù hợp dạo phố và chụp ảnh.')).toBe(true);
  });

  it('replaces the AI style and occasions with what the provider chose', () => {
    const chosen = withSelection(GEMINI_SAMPLE, { style: 'TRUYEN_THONG', occasions: ['LE_HOI_TRUYEN_THONG'] });
    expect(selectionFrom(chosen)).toEqual({ style: 'TRUYEN_THONG', occasions: ['LE_HOI_TRUYEN_THONG'] });
    expect(buildListingName(chosen)).toBe('Áo dài truyền thống lụa hoa sen');
    expect(buildListingDescription(chosen).endsWith('Phù hợp lễ hội.')).toBe(true);
  });
});

// The smart-tag rules match these keywords anywhere in the name + description.
const TAXONOMY = resolve(__dirname, '../../backend/scripts/data/smart-tag-taxonomy.default.json');
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();

describe.runIf(existsSync(TAXONOMY))('UC-C10 listing text vs smart-tag keywords', () => {
  const data = JSON.parse(readFileSync(TAXONOMY, 'utf8'));
  const definitions: Array<{ code: string; ruleConfig?: { keywords?: string[] } }> = Array.isArray(data)
    ? data
    : (Object.values(data).find(Array.isArray) as never);
  const tagsIn = (text: string) =>
    new Set(definitions.filter((d) => (d.ruleConfig?.keywords ?? []).some((k) => normalize(text).includes(normalize(k)))).map((d) => d.code));

  it('only suggests the style and occasions that were chosen', () => {
    const colours = [['RED', 'đỏ'], ['PINK', 'hồng'], ['WHITE', 'trắng'], ['GOLD', 'vàng'], ['BLUE', 'xanh dương'], ['GREEN', 'xanh lá'], ['BLACK', 'đen']];
    const patterns = [null, ['PLAIN', 'trơn'], ['EMBROIDERED', 'thêu hoa'], ['BROCADE', 'gấm hoa văn'], ['PRINTED', 'in họa tiết']];
    for (const [key, label] of colours) {
      for (const pattern of patterns) {
        for (const style of [null, ...STYLE_OPTIONS.map((o) => o.key)]) {
          for (const occasion of [null, ...OCCASION_OPTIONS.map((o) => o.key)]) {
            const base = [attr('color', key, label), ...(pattern ? [attr('pattern', pattern[0], pattern[1])] : [])];
            const chosen = withSelection(base, { style, occasions: occasion ? [occasion] : [] });
            const text = `${buildListingName(chosen)} ${buildListingDescription(chosen)}`;
            const expected = new Set([style, occasion].filter(Boolean));
            expect([...tagsIn(text)].sort(), text).toEqual([...expected].sort());
          }
        }
      }
    }
  });
});
