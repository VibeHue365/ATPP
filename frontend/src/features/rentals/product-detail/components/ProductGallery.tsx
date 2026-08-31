import React, { useState } from "react";
import { Heart, Images, Maximize2, Share2 } from "lucide-react";
import { ImageWithFallback } from "../../../../shared/media/ImageWithFallback";
import type { ProductDetail } from "../types/product-detail.types";

export interface ProductGalleryProps {
  product: ProductDetail;
  images: string[];
  activeImage: string;
  isFavorite: boolean;
  onSelectImage: (image: string) => void;
  onToggleFavorite: () => void;
  onShare?: () => void;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  product,
  images,
  activeImage,
  isFavorite,
  onSelectImage,
  onToggleFavorite,
  onShare,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const uniqueImages = Array.from(new Set(images.filter(Boolean)));
  const thumbnails = uniqueImages.slice(0, 4);
  const remainingImageCount = Math.max(uniqueImages.length - thumbnails.length, 0);

  const emptyState = (
    <div className="figma-product-gallery__empty" role="img" aria-label="Sản phẩm chưa có ảnh">
      <Images size={32} strokeWidth={1.5} />
      <span>Ảnh sản phẩm đang được cập nhật</span>
    </div>
  );

  return (
    <section className="figma-product-gallery" aria-label="Thư viện ảnh sản phẩm">
      <div
        className={`figma-product-gallery__main${isZoomed ? " is-zoomed" : ""}`}
        onDoubleClick={() => setIsZoomed((value) => !value)}
      >
        {activeImage ? (
          <ImageWithFallback
            src={activeImage}
            alt={product.name}
            className="figma-product-gallery__main-image"
            fallback={emptyState}
          />
        ) : emptyState}

        <div className="figma-product-gallery__badges">
          {(product.badges ?? []).slice(0, 2).map((badge) => (
            <span key={badge.code ?? badge.label} className="figma-product-gallery__badge">
              {badge.label}
            </span>
          ))}
        </div>

        <div className="figma-product-gallery__actions">
          <button type="button" onClick={onShare} aria-label="Chia sẻ sản phẩm">
            <Share2 size={18} />
          </button>
          <button
            type="button"
            className={isFavorite ? "is-active" : ""}
            onClick={onToggleFavorite}
            aria-label={isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        <span className="figma-product-gallery__zoom-hint">
          <Maximize2 size={14} /> Nhấn đúp để phóng to
        </span>
      </div>

      {thumbnails.length > 0 && (
        <div className="figma-product-gallery__thumbs" aria-label="Ảnh thu nhỏ">
          {thumbnails.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              className={`figma-product-gallery__thumb${activeImage === image ? " is-active" : ""}`}
              onClick={() => onSelectImage(image)}
              aria-label={`Xem ảnh ${index + 1}`}
            >
              <ImageWithFallback
                src={image}
                alt=""
                className="figma-product-gallery__thumb-image"
                fallback={<span className="figma-product-gallery__thumb-fallback" />}
              />
              {index === thumbnails.length - 1 && remainingImageCount > 0 && (
                <span className="figma-product-gallery__more">+{remainingImageCount} ảnh</span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
