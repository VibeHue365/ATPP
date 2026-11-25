/**
 * UC-C10: builds the suggested name/description again when the provider changes the
 * style or occasion chips. Mirrors build_name/build_description in
 * ai-service/vision/product_describer.py; keep both in step (tests pin the same sample).
 *
 * The fixed wording must not contain smart-tag keywords: only the chosen style and
 * occasions may reach the smart-tag rules (tests/listing-text.test.ts checks this).
 */

export interface DraftAttribute {
  group: string;
  key: string;
  label: string;
  confidence: number;
  on_cover: boolean;
}

export interface ListingSelection {
  style: string | null;
  occasions: string[];
}

export const STYLE_OPTIONS = [
  { key: 'TRUYEN_THONG', label: 'truyền thống' },
  { key: 'CACH_TAN', label: 'cách tân' },
  { key: 'PHA_CACH', label: 'phá cách' },
];

// Keys are the smart-tag occasion codes.
export const OCCASION_OPTIONS = [
  { key: 'PHU_HOP_LE_CUOI', label: 'lễ cưới' },
  { key: 'CHUP_ANH_KY_YEU', label: 'kỷ yếu' },
  { key: 'LE_HOI_TRUYEN_THONG', label: 'lễ hội' },
  { key: 'BIEU_DIEN_SU_KIEN', label: 'biểu diễn' },
];
export const MAX_OCCASIONS = 2;

const PATTERN_PHRASES: Record<string, string> = {
  PLAIN: 'thiết kế trơn tối giản, thanh lịch',
  EMBROIDERED: 'điểm xuyết họa tiết thêu hoa tinh tế',
  BROCADE: 'chất liệu gấm dệt hoa văn nổi bật',
  PRINTED: 'họa tiết in nổi bật, bắt mắt',
};
const COLOR_MOODS: Record<string, string> = {
  RED: 'Sắc đỏ rực rỡ, ấm áp và nổi bật.',
  PINK: 'Gam hồng nhẹ nhàng, tôn nét dịu dàng, nữ tính.',
  WHITE: 'Màu trắng tinh khôi, trang nhã và dễ phối phụ kiện.',
  GOLD: 'Sắc vàng sang trọng, nổi bật khi lên ảnh.',
  BLUE: 'Gam xanh dịu mát, thanh lịch.',
  GREEN: 'Sắc xanh tươi mới, gần gũi thiên nhiên.',
  BLACK: 'Màu đen sang trọng, tôn dáng và dễ phối phụ kiện.',
};
const OCCASION_PHRASES: Record<string, string> = {
  PHU_HOP_LE_CUOI: 'lễ cưới',
  CHUP_ANH_KY_YEU: 'chụp ảnh kỷ yếu',
  LE_HOI_TRUYEN_THONG: 'lễ hội',
  BIEU_DIEN_SU_KIEN: 'biểu diễn',
};
const NO_OCCASION_SENTENCE = 'Phù hợp dạo phố và chụp ảnh.';
const PLAIN_MOTIF = 'TRON';

export function selectionFrom(attributes: DraftAttribute[]): ListingSelection {
  return {
    style: attributes.find((a) => a.group === 'style')?.key ?? null,
    occasions: attributes.filter((a) => a.group === 'occasion').map((a) => a.key).slice(0, MAX_OCCASIONS),
  };
}

/** The suggestion's attributes with the provider's style/occasion choice in place of the AI's. */
export function withSelection(attributes: DraftAttribute[], selection: ListingSelection): DraftAttribute[] {
  const kept = attributes.filter((a) => a.group !== 'style' && a.group !== 'occasion');
  const style = STYLE_OPTIONS.find((o) => o.key === selection.style);
  const occasions = OCCASION_OPTIONS.filter((o) => selection.occasions.includes(o.key));
  return [
    ...kept,
    ...(style ? [{ group: 'style', key: style.key, label: style.label, confidence: 1, on_cover: true }] : []),
    ...occasions.map((o) => ({ group: 'occasion', key: o.key, label: o.label, confidence: 1, on_cover: true })),
  ];
}

export function buildListingName(attributes: DraftAttribute[]): string {
  const found = byGroup(attributes);
  const parts = ['Áo dài'];
  if (found.gender) parts.push(found.gender[0].label);
  if (found.style) parts.push(found.style[0].label);
  const material = found.material?.[0];
  const motif = found.motif?.[0]?.key === PLAIN_MOTIF ? undefined : found.motif?.[0];
  if (material || motif) {
    for (const attribute of [material, motif]) if (attribute) parts.push(attribute.label);
  } else {
    const cover = (found.color ?? []).filter((a) => a.on_cover);
    if (cover.length) parts.push(cover[0].label);
    const pattern = found.pattern?.[0];
    if (pattern && pattern.key !== 'PLAIN') parts.push(pattern.label);
  }
  return parts.length > 1 ? parts.join(' ') : '';
}

export function buildListingDescription(attributes: DraftAttribute[]): string {
  const found = byGroup(attributes);
  if (Object.keys(found).length === 0) return '';
  const cover = (found.color ?? []).filter((a) => a.on_cover);
  const variants = (found.color ?? []).filter((a) => !a.on_cover).map((a) => a.label);
  const material = found.material?.[0];
  const motif = found.motif?.[0];
  const pattern = found.pattern?.[0];
  const details: string[] = [];
  if (found.style) details.push(`phong cách ${found.style[0].label}`);
  if (material) details.push(`chất liệu ${material.label}`);
  if (cover.length) details.push(`màu ${cover.map((a) => a.label).join(' phối ')}`);
  if (motif) {
    details.push(motif.key === PLAIN_MOTIF ? PATTERN_PHRASES.PLAIN : `họa tiết ${motif.label}`);
  } else if (pattern && !(material && pattern.key === 'BROCADE') && PATTERN_PHRASES[pattern.key]) {
    details.push(PATTERN_PHRASES[pattern.key]);
  }
  let subject = 'Mẫu áo dài';
  if (found.gender) subject += ` ${found.gender[0].label}`;
  if (details.length) subject += ` ${details.join(', ')}`;
  const sentences = [`${subject}.`];
  if (cover.length && COLOR_MOODS[cover[0].key]) sentences.push(COLOR_MOODS[cover[0].key]);
  if (variants.length) sentences.push(`Có thêm các màu: ${variants.join(', ')}.`);
  const occasions = (found.occasion ?? []).map((a) => OCCASION_PHRASES[a.key]).filter(Boolean);
  sentences.push(occasions.length ? `Phù hợp ${occasions.join(' và ')}.` : NO_OCCASION_SENTENCE);
  return sentences.join(' ');
}

function byGroup(attributes: DraftAttribute[]): Record<string, DraftAttribute[]> {
  const grouped: Record<string, DraftAttribute[]> = {};
  for (const attribute of attributes) (grouped[attribute.group] ??= []).push(attribute);
  return grouped;
}
