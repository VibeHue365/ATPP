import type { Product } from '@/types/product';

export interface AiRecommendedProduct {
  _id: string;
  name: string;
  basePrice?: number;
  images?: string[];
  materials?: string[];
}

export interface AiChatResponse {
  question: string;
  answer: string;
  found: boolean;
  matched_question?: string;
  category?: string;
  confidence?: number;
  source?: string;
  recommended_products?: AiRecommendedProduct[];
}

/** VIB-93: a public product returned by the visual search, with its similarity (0–1). */
export type VisualSearchItem = Product & { visualScore: number };

export interface VisualSearchResult {
  items: VisualSearchItem[];
  message: string | null;
}

export interface AiImageMessage {
  message?: string;
  image_base64: string;
  mime_type: string;
}
