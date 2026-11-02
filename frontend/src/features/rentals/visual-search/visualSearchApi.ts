import { httpClient } from '../../../services/httpClient';
import type { PricingCampaign } from '../../../shared/pricing/campaignPricing';

/** Scores from 0.80 up mean "this very design"; below that it is a look-alike. */
export const VERY_SIMILAR_SCORE = 0.8;

export interface VisualSearchProduct {
  _id: string;
  name: string;
  basePrice: number;
  images?: string[];
  activeCampaign?: (PricingCampaign & { occasion: string }) | null;
  providerId?: { businessName?: string; address?: { city?: string } } | string;
  visualScore: number;
}

export interface VisualSearchResult {
  items: VisualSearchProduct[];
  message: string | null;
}

/** Headline over the results: an exact design was found, or only look-alikes. */
export function describeResults(scores: number[]): { exactMatch: boolean; title: string; subtitle: string | null } {
  const exactMatch = scores.some((score) => score >= VERY_SIMILAR_SCORE);
  return exactMatch
    ? { exactMatch, title: 'Tìm thấy mẫu rất giống đang cho thuê', subtitle: null }
    : {
        exactMatch,
        title: 'Chưa có đúng mẫu này trên nền tảng',
        subtitle: `Dưới đây là ${scores.length} mẫu tương tự đang cho thuê.`,
      };
}

export const searchAoDaiByImage =(imageBase64: string, mimeType: string) =>
  httpClient.post<VisualSearchResult>('/ai/visual-search/match', {
    image_base64: imageBase64,
    mime_type: mimeType,
  });
