import React from "react";
import { Check, Flag, Star } from "lucide-react";
import { ImageWithFallback } from "../../../../shared/media/ImageWithFallback";
import type { ProductReview, ReviewSortOrder, ReviewStats, ReviewStatus } from "../types/product-review.types";

interface ProductReviewsSectionProps {
  reviews: ProductReview[];
  stats: ReviewStats;
  loading: boolean;
  reviewStatus: ReviewStatus | null;
  sortOrder: ReviewSortOrder;
  filterHasImage: boolean;
  checkingStatus: boolean;
  onWriteReview: () => void;
  onSortChange: (sortOrder: ReviewSortOrder) => void;
  onFilterImageChange: (value: boolean) => void;
  onReportReview: (reviewId: string) => void;
}

const reviewDate = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN") : "";

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  reviews,
  stats,
  loading,
  reviewStatus,
  sortOrder,
  filterHasImage,
  checkingStatus,
  onWriteReview,
  onSortChange,
  onFilterImageChange,
  onReportReview,
}) => (
  <section className="product-reviews" id="product-reviews">
    <div className="product-reviews__heading">
      <span className="vh-section-badge">Nhật ký áo dài</span>
      <h2>Khách hàng tỏa sáng trong tà áo di sản</h2>
    </div>

    <div className="product-reviews__overview">
      <div className="product-reviews__average">
        <strong>{stats.averageRating.toFixed(1)}</strong>
        <div>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={18} fill={star <= Math.round(stats.averageRating) ? "currentColor" : "none"} />)}</div>
        <span>{stats.totalReviews} đánh giá thực tế</span>
      </div>
      <div className="product-reviews__bars">
        {([5, 4, 3, 2, 1] as const).map((star) => (
          <div key={star} className="product-reviews__bar-row">
            <span>{star} sao</span>
            <div><i style={{ width: stats.breakdown[star] }} /></div>
            <b>{stats.breakdown[star]}</b>
          </div>
        ))}
      </div>
      <div className="product-reviews__write">
        {reviewStatus?.alreadyReviewed ? (
          <span className="product-reviews__already"><Check size={16} /> ĐÃ ĐÁNH GIÁ</span>
        ) : (
          <button type="button" onClick={onWriteReview} disabled={checkingStatus}>
            {checkingStatus ? "ĐANG KIỂM TRA..." : "VIẾT ĐÁNH GIÁ"}
          </button>
        )}
      </div>
    </div>

    <div className="product-reviews__filters">
      <div>
        {(["newest", "highest", "lowest"] as const).map((option) => (
          <button key={option} type="button" className={sortOrder === option ? "is-active" : ""} onClick={() => onSortChange(option)}>
            {option === "newest" ? "Mới nhất" : option === "highest" ? "Đánh giá cao nhất" : "Đánh giá thấp nhất"}
          </button>
        ))}
      </div>
      <label><input type="checkbox" checked={filterHasImage} onChange={(event) => onFilterImageChange(event.target.checked)} /> Có ảnh/video</label>
    </div>

    <div className="product-reviews__list">
      {loading ? (
        <div className="product-reviews__empty">Đang tải đánh giá...</div>
      ) : reviews.length === 0 ? (
        <div className="product-reviews__empty">{filterHasImage ? "Không tìm thấy đánh giá nào có hình ảnh thực tế." : "Chưa có đánh giá nào cho sản phẩm này."}</div>
      ) : reviews.map((review) => {
        const reviewId = review._id || review.id;
        const authorName = review.customerId?.profile?.fullName || "Khách hàng";
        const avatar = review.customerId?.profile?.avatarUrl || review.customerId?.profile?.avatar;
        const firstLetter = authorName.charAt(0).toUpperCase();
        return (
          <article key={reviewId || `${authorName}-${review.createdAt}`} className="product-review">
            <div className="product-review__header">
              <div className="product-review__author">
                <ImageWithFallback src={avatar} alt={authorName} className="product-review__avatar" fallback={<span className="product-review__avatar-fallback">{firstLetter}</span>} />
                <div>
                  <div className="product-review__name"><strong>{authorName}</strong><span><Check size={10} /> ĐÃ THUÊ</span></div>
                  <div className="product-review__stars">{Array.from({ length: Math.round(review.rating) }).map((_, index) => <Star key={index} size={11} fill="currentColor" />)}</div>
                </div>
              </div>
              <div className="product-review__meta">
                <time>{reviewDate(review.createdAt || review.date)}</time>
                {reviewId && <button type="button" onClick={() => onReportReview(reviewId)}><Flag size={10} /> Báo cáo</button>}
              </div>
            </div>

            {review.comment && <p className="product-review__comment">{review.comment}</p>}
            {review.images && review.images.length > 0 && <div className="product-review__images">{review.images.map((image, index) => <ImageWithFallback key={`${image}-${index}`} src={image} alt="Ảnh đánh giá" fallback={<span />} />)}</div>}
            {review.reply && <div className="product-review__reply"><strong>Phản hồi từ cửa hàng</strong><time>{reviewDate(review.repliedAt)}</time><p>{review.reply}</p></div>}
          </article>
        );
      })}
    </div>
  </section>
);
