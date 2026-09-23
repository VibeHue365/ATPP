import {
  ONBOARDING_OCCASION_TAG_MAP,
  ONBOARDING_STYLE_TAG_MAP,
} from '../../smart-tagging/constants/smart-tag.constants';

export interface RecommendationPreferences {
  styles: string[];
  occasions: string[];
  colors: string[];
  materials: string[];
  preferredSize?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
}

export interface RankableProduct {
  tagCodes: string[];
  colors: string[];
  materials: string[];
  sizes: string[];
  basePrice: number;
  rating?: { averageRating?: number | null } | null;
}

const COLOR_TONE_MAP: Readonly<Record<string, string[]>> = {
  PASTEL: ['WHITE', 'PINK', 'GOLD'],
  RED_GOLD: ['RED', 'GOLD'],
  DARK: ['BLACK', 'GRAY', 'BROWN', 'BLUE'],
  COLORFUL: ['GOLD', 'GREEN', 'PINK', 'BLUE', 'RED'],
};

const TAG_LABELS: Readonly<Record<string, string>> = {
  TRUYEN_THONG: 'Truyền thống',
  CACH_TAN: 'Cách tân',
  PHA_CACH: 'Phá cách',
  PHU_HOP_LE_CUOI: 'Lễ cưới',
  CHUP_ANH_KY_YEU: 'Kỷ yếu',
  LE_HOI_TRUYEN_THONG: 'Lễ hội truyền thống',
  BIEU_DIEN_SU_KIEN: 'Biểu diễn/Sự kiện',
};

export function normalizePreferences(preferences: any): RecommendationPreferences {
  return {
    styles: normalizeValues(preferences?.preferredAoDaiStyles),
    occasions: normalizeValues(preferences?.preferredOccasions),
    colors: expandColorTones(normalizeValues(preferences?.favoriteColors)),
    materials: normalizeValues(preferences?.preferredMaterials),
    preferredSize: normalizeOptional(preferences?.sizeInfo?.preferredSize),
    budgetMin: finiteOrNull(preferences?.budgetRange?.min),
    budgetMax: finiteOrNull(preferences?.budgetRange?.max),
  };
}

export function scoreProduct(
  preferences: RecommendationPreferences,
  product: RankableProduct,
): { score: number; matchPercent: number; reasons: string[] } {
  const tags = new Set(normalizeValues(product.tagCodes));
  const productColors = new Set(normalizeValues(product.colors));
  const productMaterials = new Set(normalizeValues(product.materials));
  const reasons: string[] = [];
  let earned = 0;
  let possible = 10; // Rating is always available as a quality signal.

  const styleTags = preferences.styles
    .map((value) => ONBOARDING_STYLE_TAG_MAP[value])
    .filter(Boolean);
  if (styleTags.length) {
    possible += 30;
    const matched = styleTags.filter((tag) => tags.has(tag));
    if (matched.length) {
      earned += 30;
      reasons.push(`Phù hợp phong cách ${matched.map(labelTag).join(', ')}`);
    }
  }

  const occasionTags = preferences.occasions
    .map((value) => ONBOARDING_OCCASION_TAG_MAP[value])
    .filter(Boolean);
  if (occasionTags.length) {
    possible += 20;
    const matched = occasionTags.filter((tag) => tags.has(tag));
    if (matched.length) {
      earned += 20;
      reasons.push(`Phù hợp dịp ${matched.map(labelTag).join(', ')}`);
    }
  }

  if (preferences.materials.length) {
    possible += 15;
    const matched = preferences.materials.filter((value) => productMaterials.has(value));
    if (matched.length) {
      earned += 15;
      reasons.push(`Có chất liệu bạn yêu thích: ${matched.join(', ')}`);
    }
  }

  if (preferences.colors.length) {
    possible += 15;
    const matched = preferences.colors.filter((value) => productColors.has(value));
    if (matched.length) {
      earned += 15;
      reasons.push(`Có màu sắc phù hợp: ${matched.slice(0, 3).join(', ')}`);
    }
  }

  if (preferences.budgetMin != null || preferences.budgetMax != null) {
    possible += 10;
    const aboveMinimum = preferences.budgetMin == null || product.basePrice >= preferences.budgetMin;
    const belowMaximum = preferences.budgetMax == null || product.basePrice <= preferences.budgetMax;
    if (aboveMinimum && belowMaximum) {
      earned += 10;
      reasons.push('Nằm trong ngân sách của bạn');
    }
  }

  const rating = Math.max(0, Math.min(5, Number(product.rating?.averageRating) || 0));
  earned += (rating / 5) * 10;
  if (rating >= 4.5) reasons.push(`Được đánh giá cao: ${rating.toFixed(1)}★`);

  const score = possible > 0 ? earned / possible : 0;
  return {
    score: Number(score.toFixed(4)),
    matchPercent: Math.round(score * 100),
    reasons: reasons.slice(0, 4),
  };
}

export function matchesPreferredSize(
  preferredSize: string | null | undefined,
  productSizes: string[] | undefined,
): boolean {
  if (!preferredSize) return true;
  return normalizeValues(productSizes).includes(preferredSize.toUpperCase());
}

function expandColorTones(values: string[]): string[] {
  return [...new Set(values.flatMap((value) => COLOR_TONE_MAP[value] ?? [value]))];
}

function normalizeValues(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value).trim().toUpperCase()).filter(Boolean))];
}

function normalizeOptional(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || null;
}

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function labelTag(code: string): string {
  return TAG_LABELS[code] ?? code;
}
