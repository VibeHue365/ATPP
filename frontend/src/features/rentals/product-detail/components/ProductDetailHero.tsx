import React from "react";
import { ProductBookingPanel, type ProductBookingPanelProps } from "./ProductBookingPanel";
import { ProductGallery, type ProductGalleryProps } from "./ProductGallery";
import type { ProductDetail } from "../types/product-detail.types";

export interface ProductDetailHeroProps {
  product: ProductDetail;
  gallery: Omit<ProductGalleryProps, "product">;
  booking: Omit<ProductBookingPanelProps, "product">;
}

export const ProductDetailHero: React.FC<ProductDetailHeroProps> = ({ product, gallery, booking }) => {
  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator.share({ title: product.name, url: window.location.href });
    }
  };

  return (
    <div className="figma-product-detail-hero">
      <ProductGallery product={product} {...gallery} onShare={gallery.onShare || handleShare} />
      <ProductBookingPanel
        product={product}
        booking={{
          ...booking,
          isFavorite: gallery.isFavorite,
          onToggleFavorite: gallery.onToggleFavorite,
        }}
      />
    </div>
  );
};
