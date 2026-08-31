import React from "react";
import { Star } from "lucide-react";
import { ImageWithFallback } from "../../../../shared/media/ImageWithFallback";
import type { PhotographerRecommendation } from "../types/photographer-recommendation.types";

interface PhotographerRecommendationsProps {
  photographers: PhotographerRecommendation[];
  loading: boolean;
  onOpenPhotographer: (id: string) => void;
}

const formatPrice = (price: number | null) => price === null ? "Liên hệ" : `${price.toLocaleString("vi-VN")}đ`;

export const PhotographerRecommendations: React.FC<PhotographerRecommendationsProps> = ({ photographers, loading, onOpenPhotographer }) => {
  if (!loading && photographers.length === 0) return null;

  return (
    <section className="photographer-recommendations">
      <div className="photographer-recommendations__heading">
        <span className="vh-section-badge">Nhiếp ảnh gia gợi ý</span>
        <h2>Hoàn thiện trải nghiệm với các gói chụp ảnh chuyên nghiệp</h2>
      </div>

      {loading ? (
        <div className="photographer-recommendations__loading">Đang tải các photographer phù hợp...</div>
      ) : (
        <div className="photographer-recommendations__grid">
          {photographers.map((photographer) => (
            <article key={photographer.id} className="photographer-recommendation-card">
              <div className="photographer-recommendation-card__image">
                <ImageWithFallback
                  src={photographer.image}
                  alt={photographer.name}
                  className="photographer-recommendation-card__image-media"
                  fallback={<div className="photographer-recommendation-card__image-empty">Chưa có ảnh portfolio</div>}
                />
                {photographer.rating !== null && (
                  <span className="photographer-recommendation-card__rating"><Star size={11} fill="currentColor" /> {photographer.rating.toFixed(1)}{photographer.reviewCount !== null && <small>({photographer.reviewCount})</small>}</span>
                )}
              </div>
              <div className="photographer-recommendation-card__body">
                <h3>{photographer.name}</h3>
                {photographer.description && <p>{photographer.description}</p>}
                <div className="photographer-recommendation-card__footer">
                  <div><span>Gói chụp từ</span><strong>{formatPrice(photographer.startingPrice)}</strong></div>
                  <button type="button" onClick={() => onOpenPhotographer(photographer.id)}>Đặt ngay</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
