export interface PhotographerRecommendation {
  id: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  description?: string;
  startingPrice: number | null;
  image?: string | null;
}
