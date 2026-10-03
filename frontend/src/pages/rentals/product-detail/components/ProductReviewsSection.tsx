import React from 'react';
import { Check, Flag, Star } from 'lucide-react';
import type { ReviewItem, ReviewStats, ReviewStatus } from '../types';
import { getImageUrl } from '../utils/colorUtils';

interface ProductReviewsSectionProps {
  reviews: ReviewItem[];
  loadingReviews: boolean;
  reviewStats: ReviewStats;
  reviewStatus: ReviewStatus | null;
  checkingReviewStatus: boolean;
  reviewSortOrder: 'newest' | 'highest' | 'lowest';
  onChangeSortOrder: (order: 'newest' | 'highest' | 'lowest') => void;
  reviewFilterHasImage: boolean;
  onChangeFilterHasImage: (hasImage: boolean) => void;
  onWriteReviewClick: () => void;
  onReportReview: (reviewId: string) => void;
}

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  reviews,
  loadingReviews,
  reviewStats,
  reviewStatus,
  checkingReviewStatus,
  reviewSortOrder,
  onChangeSortOrder,
  reviewFilterHasImage,
  onChangeFilterHasImage,
  onWriteReviewClick,
  onReportReview,
}) => {
  return (
    <section
      id="reviews-section"
      style={{
        marginTop: '80px',
        borderTop: '1px solid var(--color-light-border)',
        paddingTop: '60px',
      }}
    >
      <div
        style={{
          marginBottom: '40px',
          textAlign: 'left',
          maxWidth: '100%',
          alignItems: 'flex-start',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <span
          className="vh-section-badge"
          style={{ display: 'inline-block', marginBottom: '12px' }}
        >
          Nhật Ký Áo Dài
        </span>
        <h2
          style={{
            fontSize: '28px',
            fontWeight: 700,
            fontFamily: 'var(--font-header)',
            color: '#1c1917',
            marginTop: '4px',
          }}
        >
          Khách hàng tỏa sáng trong tà áo Di Sản
        </h2>
      </div>

      {/* Rating overview grid */}
      <div className="vh-pd-reviews-overview-grid">
        {/* Average rating */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            className="font-header"
            style={{
              fontSize: '56px',
              fontWeight: 800,
              color: 'var(--color-text-primary)',
            }}
          >
            {reviewStats.averageRating.toFixed(1)}
          </span>
          <div
            style={{
              display: 'flex',
              gap: '2px',
              color: 'var(--color-gold)',
            }}
          >
            {[1, 2, 3, 4, 5].map((starIdx) => (
              <Star
                key={starIdx}
                size={18}
                fill={
                  starIdx <= Math.round(reviewStats.averageRating)
                    ? 'currentColor'
                    : 'none'
                }
                color="currentColor"
              />
            ))}
          </div>
          <span
            style={{
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
            }}
          >
            {reviewStats.totalReviews} đánh giá thực tế
          </span>
        </div>

        {/* Bars summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { stars: '5 sao', percent: reviewStats.breakdown[5] },
            { stars: '4 sao', percent: reviewStats.breakdown[4] },
            { stars: '3 sao', percent: reviewStats.breakdown[3] },
            { stars: '2 sao', percent: reviewStats.breakdown[2] },
            { stars: '1 sao', percent: reviewStats.breakdown[1] },
          ].map((row, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
              }}
            >
              <span style={{ width: '40px', textAlign: 'right' }}>
                {row.stars}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '6px',
                  backgroundColor: '#F0EBE0',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: row.percent,
                    height: '100%',
                    backgroundColor: 'var(--color-gold)',
                    borderRadius: '3px',
                  }}
                />
              </div>
              <span style={{ width: '32px' }}>{row.percent}</span>
            </div>
          ))}
        </div>

        {/* Action write button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {reviewStatus?.alreadyReviewed ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#F0FDF4',
                color: '#15803D',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 700,
              }}
            >
              <Check size={16} /> ĐÃ ĐÁNH GIÁ
            </div>
          ) : (
            <button
              type="button"
              onClick={onWriteReviewClick}
              disabled={checkingReviewStatus}
              className="vh-btn vh-btn-inverted font-header"
              style={{
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {checkingReviewStatus ? 'ĐANG KIỂM TRA...' : 'VIẾT ĐÁNH GIÁ'}
            </button>
          )}
        </div>
      </div>

      {/* Rating filter tools */}
      <div className="vh-pd-reviews-filters">
        <div className="vh-pd-reviews-sort-tabs">
          <span
            onClick={() => onChangeSortOrder('newest')}
            style={{
              color:
                reviewSortOrder === 'newest'
                  ? 'var(--color-primary)'
                  : 'var(--color-text-secondary)',
              cursor: 'pointer',
              borderBottom:
                reviewSortOrder === 'newest'
                  ? '2px solid var(--color-primary)'
                  : 'none',
              paddingBottom: '4px',
              transition: 'all 0.2s',
            }}
          >
            Mới nhất
          </span>
          <span
            onClick={() => onChangeSortOrder('highest')}
            style={{
              color:
                reviewSortOrder === 'highest'
                  ? 'var(--color-primary)'
                  : 'var(--color-text-secondary)',
              cursor: 'pointer',
              borderBottom:
                reviewSortOrder === 'highest'
                  ? '2px solid var(--color-primary)'
                  : 'none',
              paddingBottom: '4px',
              transition: 'all 0.2s',
            }}
          >
            Đánh giá cao nhất
          </span>
          <span
            onClick={() => onChangeSortOrder('lowest')}
            style={{
              color:
                reviewSortOrder === 'lowest'
                  ? 'var(--color-primary)'
                  : 'var(--color-text-secondary)',
              cursor: 'pointer',
              borderBottom:
                reviewSortOrder === 'lowest'
                  ? '2px solid var(--color-primary)'
                  : 'none',
              paddingBottom: '4px',
              transition: 'all 0.2s',
            }}
          >
            Đánh giá thấp nhất
          </span>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
          }}
        >
          <input
            type="checkbox"
            checked={reviewFilterHasImage}
            onChange={(e) => onChangeFilterHasImage(e.target.checked)}
            style={{ accentColor: 'var(--color-primary)' }}
          />
          <span>Có ảnh/video</span>
        </label>
      </div>

      {/* Reviews list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {loadingReviews ? (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
              color: 'var(--color-text-secondary)',
            }}
          >
            Đang tải đánh giá...
          </div>
        ) : reviews.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--color-text-secondary)',
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid var(--color-light-border)',
            }}
          >
            {reviewFilterHasImage
              ? 'Không tìm thấy đánh giá nào có hình ảnh thực tế.'
              : 'Chưa có đánh giá nào cho sản phẩm này. Hãy là người đầu tiên thuê và đánh giá!'}
          </div>
        ) : (
          reviews.map((rev) => {
            const authorName =
              rev.customerId?.profile?.fullName || 'Khách hàng VibeHue';
            const authorAvatar =
              rev.customerId?.profile?.avatarUrl ||
              rev.customerId?.profile?.avatar;
            const formattedDate = new Date(
              rev.createdAt || rev.date || Date.now(),
            ).toLocaleDateString('vi-VN');
            const firstLetter = authorName.charAt(0).toUpperCase();

            return (
              <div
                key={rev._id || rev.id}
                style={{
                  borderBottom: '1px solid var(--color-light-border)',
                  paddingBottom: '32px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {authorAvatar ? (
                      <img
                        src={getImageUrl(authorAvatar)}
                        alt={authorName}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: '#EADFC9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          color: 'var(--color-primary-dark)',
                          fontSize: '14px',
                        }}
                      >
                        {firstLetter}
                      </div>
                    )}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <strong
                          style={{
                            fontSize: '14px',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {authorName}
                        </strong>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            backgroundColor: 'var(--color-success-bg)',
                            color: 'var(--color-success)',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                          }}
                        >
                          <Check size={10} /> ĐÃ THUÊ
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: '2px',
                          color: 'var(--color-gold)',
                          marginTop: '4px',
                        }}
                      >
                        {Array.from({ length: Math.round(rev.rating) }).map(
                          (_, sIdx) => (
                            <Star
                              key={sIdx}
                              size={11}
                              fill="currentColor"
                              color="currentColor"
                            />
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {formattedDate}
                    </span>
                    <button
                      type="button"
                      onClick={() => onReportReview(rev._id || rev.id || '')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#9CA3AF',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#DC2626';
                        e.currentTarget.style.backgroundColor = '#FEE2E2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#9CA3AF';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Báo cáo review spam/vi phạm"
                    >
                      <Flag size={10} />
                      <span>Báo cáo Spam</span>
                    </button>
                  </div>
                </div>

                <p
                  style={{
                    fontSize: '14px',
                    color: 'var(--color-text-primary)',
                    marginTop: '16px',
                    lineHeight: 1.7,
                  }}
                >
                  {rev.comment}
                </p>

                {rev.images && rev.images.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      marginTop: '16px',
                    }}
                  >
                    {rev.images.map((imgUrl: string, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          width: '80px',
                          height: '100px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid rgba(0,0,0,0.1)',
                        }}
                      >
                        <img
                          src={getImageUrl(imgUrl)}
                          alt="review media"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {rev.reply && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '16px',
                      backgroundColor: '#F5EFEB',
                      borderRadius: '12px',
                      borderLeft: '4px solid var(--color-primary)',
                      fontSize: '13px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <strong style={{ color: 'var(--color-primary-dark)' }}>
                        Phản hồi từ cửa hàng
                      </strong>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {new Date(rev.repliedAt || new Date()).toLocaleDateString(
                          'vi-VN',
                        )}
                      </span>
                    </div>
                    <p
                      style={{
                        color: 'var(--color-text-primary)',
                        margin: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      {rev.reply}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
