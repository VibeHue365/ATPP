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

export interface AiImageMessage {
  message?: string;
  image_base64: string;
  mime_type: string;
}
