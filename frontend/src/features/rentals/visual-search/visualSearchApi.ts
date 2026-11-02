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

export const searchAoDaiByImage = (imageBase64: string, mimeType: string) =>
  httpClient.post<VisualSearchResult>('/ai/visual-search/match', {
    image_base64: imageBase64,
    mime_type: mimeType,
  });
