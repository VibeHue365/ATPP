import { useEffect, useState } from "react";
import { httpClient } from "../../../../services/httpClient";
import type { PhotographerRecommendation } from "../types/photographer-recommendation.types";

interface PhotographerApiRecord {
  _id?: string;
  businessName?: string;
  name?: string;
  bio?: string;
  description?: string;
  introduction?: string;
  address?: { city?: string | null };
  portfolio?: string[];
  profileImage?: string | null;
  avatar?: string | null;
  rating?: { averageRating?: number; totalReviews?: number };
  packages?: Array<{ price?: number }>;
}

const normalize = (value: string) => value
  .toLocaleLowerCase("vi-VN")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim();

const toRecommendations = (records: PhotographerApiRecord[], city?: string | null) => {
  const cityKey = city ? normalize(city) : "";
  const sameCity = cityKey
    ? records.filter((record) => {
        const photographerCity = normalize(record.address?.city || "");
        return photographerCity && (photographerCity.includes(cityKey) || cityKey.includes(photographerCity));
      })
    : records;
  const source = sameCity.length > 0 ? sameCity : records;

  return source
    .filter((record) => Boolean(record._id && (record.businessName || record.name)))
    .slice(0, 3)
    .map((record): PhotographerRecommendation => {
      const prices = (record.packages || [])
        .map((item) => item.price)
        .filter((price): price is number => typeof price === "number" && price > 0);
      return {
        id: record._id!,
        name: record.businessName || record.name || "",
        rating: typeof record.rating?.averageRating === "number" ? record.rating.averageRating : null,
        reviewCount: typeof record.rating?.totalReviews === "number" ? record.rating.totalReviews : null,
        description: record.description || record.bio || record.introduction,
        startingPrice: prices.length > 0 ? Math.min(...prices) : null,
        image: record.portfolio?.find(Boolean) || record.profileImage || record.avatar,
      };
    });
};

export const useProductRecommendations = (city?: string | null) => {
  const [photographers, setPhotographers] = useState<PhotographerRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadRecommendations = async () => {
      setLoading(true);
      try {
        const response = await httpClient.get<PhotographerApiRecord[] | { data?: PhotographerApiRecord[] }>("/api/photographers");
        const records = Array.isArray(response) ? response : response.data || [];
        if (active) setPhotographers(toRecommendations(records, city));
      } catch (error) {
        console.error("Không thể tải photographer đề xuất:", error);
        if (active) setPhotographers([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadRecommendations();
    return () => { active = false; };
  }, [city]);

  return { photographers, loading };
};
