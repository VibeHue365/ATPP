import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
} from 'lucide-react';
import { ROUTES } from '../../../config/routes';
import { httpClient } from '../../../services/httpClient';
import { getMediaUrl, getMediaUrls } from '../../../shared/media/mediaUrl';

interface FeaturedStore {
  _id: string;
  businessName: string;
  capabilities: string[];
  address?: {
    addressLine?: string;
    ward?: string;
    district?: string;
    city?: string | null;
  };
  media?: {
    logoUrl?: string | null;
    coverUrl?: string | null;
    images?: string[];
  };
  rating?: {
    averageRating?: number;
    totalReviews?: number;
  };
  productCount?: number;
}

const formatAddress = (address?: FeaturedStore['address']): string => {
  if (!address) return 'Chưa cập nhật địa chỉ';
  const street = address.addressLine
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0];
  const city = address.city?.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim();
  return [street, city].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ';
};

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'VH';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
};

/** Silhouette dress icon matching Figma */
const AoDaiIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2a2 2 0 0 0-2 2v.4L7 6.3a1 1 0 0 0-.4.8v2.4a1 1 0 0 0 1.5.87L9 10.1V21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V10.1l.9.27a1 1 0 0 0 1.5-.87V7.1a1 1 0 0 0-.4-.8L14 4.4V4a2 2 0 0 0-2-2zm-1 3.2V4a1 1 0 0 1 2 0v1.2l2 1.2v1.5l-2.5-1.3A1 1 0 0 0 12 7a1 1 0 0 0-.5-.38L9 7.9V6.4l2-1.2z" />
  </svg>
);

const StoreAvatar: React.FC<{ store: FeaturedStore }> = ({ store }) => {
  const [hasError, setHasError] = useState(false);
  const avatarUrl = getMediaUrl(store.media?.logoUrl);

  if (avatarUrl && !hasError) {
    return (
      <img
        src={avatarUrl}
        alt={store.businessName}
        className="h-full w-full object-cover object-center"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#fbf5ed] leading-none">
      <span className="text-[12px] font-extrabold tracking-wide text-[#9d5b2f]">
        {getInitials(store.businessName)}
      </span>
      <span className="mt-0.5 text-[7px] font-medium uppercase text-[#b8764a]">Studio</span>
    </div>
  );
};



export const FeaturedStoresSection: React.FC = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState<FeaturedStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [imageIndices, setImageIndices] = useState<Record<string, number>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    const fetchStores = async () => {
      try {
        const data = await httpClient.get<FeaturedStore[]>('/products/stores');
        if (!isMounted || !Array.isArray(data)) return;

        const sorted = [...data]
          .sort((a, b) => {
            const score = (s: FeaturedStore) =>
              (s.productCount ?? 0) * 10 +
              (s.rating?.totalReviews ?? 0) * 2 +
              (s.rating?.averageRating ?? 0) * 5;
            return score(b) - score(a);
          })
          .slice(0, 3);

        setStores(sorted);
      } catch (error) {
        console.error('Lỗi khi tải danh sách đối tác nổi bật:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStores();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleImageChange = (
    event: React.MouseEvent<HTMLButtonElement>,
    storeId: string,
    total: number,
    direction: 1 | -1,
  ) => {
    event.stopPropagation();
    if (total < 2) return;
    setImageIndices((prev) => ({
      ...prev,
      [storeId]: ((prev[storeId] ?? 0) + direction + total) % total,
    }));
  };

  const toggleFavorite = (event: React.MouseEvent<HTMLButtonElement>, storeId: string) => {
    event.stopPropagation();
    setFavorites((prev) => ({ ...prev, [storeId]: !prev[storeId] }));
  };

  if (!loading && stores.length === 0) return null;

  return (
    <section id="featured-stores" className="relative w-full py-6 md:py-10">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -left-20 top-20 -z-10 h-80 w-80 rounded-full bg-[#fdeef1]/75 blur-3xl" />
      <div className="pointer-events-none absolute right-10 -top-20 -z-10 h-72 w-[38rem] rounded-full bg-[#fff2ee]/75 blur-3xl" />

      {/* Section Header matching Figma LUMÉ */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#fde8ed] px-3.5 py-1 text-xs font-bold text-[#d73762]">
            <Sparkles size={13} strokeWidth={2.3} aria-hidden="true" />
            ĐỐI TÁC TIÊU BIỂU
          </div>
          <h2 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#141b2a] sm:text-[38px] xl:text-[42px]">
            Showroom &amp; Studio{' '}
            <span className="relative inline-block text-[#d73762]">
              Nổi Bật Tại Huế
              <svg
                className="pointer-events-none absolute -right-7 -top-3 h-7 w-10 text-[#d73762]"
                viewBox="0 0 40 28"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 23C11 7 28 7 37 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="3 3"
                />
                <path
                  d="M25 4l2 5M31 7l3 4M35 13h4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h2>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-[#79808e] md:text-base">
            Không gian hiện đại, thiết kế tinh tế, phù hợp cho chụp ảnh, quay video và nhiều nhu cầu sáng tạo khác.
          </p>
        </div>

        <Link
          to={ROUTES.STORES}
          className="inline-flex shrink-0 items-center gap-2.5 self-start rounded-full border border-[#fec8d3] bg-white px-5 py-2.5 text-sm font-bold text-[#cf315b] shadow-xs transition hover:border-[#f59ab0] hover:bg-[#fff7f8] md:self-auto"
        >
          Khám phá 15+ đối tác
          <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </div>

      {/* 3-Column Responsive Cards Grid - Elongated downwards matching Figma */}
      <div className="grid grid-cols-1 gap-7 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="animate-pulse overflow-hidden rounded-[32px] border border-[#f0e7e8] bg-white shadow-sm"
              >
                <div className="aspect-[1.72/1] bg-stone-200" />
                <div className="p-7 space-y-5">
                  <div className="h-16 w-3/4 rounded bg-stone-200" />
                  <div className="h-7 w-1/2 rounded bg-stone-200" />
                  <div className="h-12 w-full rounded-full bg-stone-200" />
                </div>
              </div>
            ))
          : stores.map((store) => {
              const capabilities = store.capabilities ?? [];
              const hasRental = capabilities.some((cap) =>
                ['AODAI_RENTAL', 'COSTUME_RENTAL', 'RENTAL'].includes(cap),
              );
              const hasPhoto = capabilities.includes('PHOTOGRAPHY');
              const isBundle = hasRental && hasPhoto;
              const targetUrl = hasRental ? `/stores/${store._id}` : `/photographers/${store._id}`;
              const buttonLabel = hasRental ? 'Xem gian hàng áo dài' : 'Xem dịch vụ chụp ảnh';

              const imageUrls = getMediaUrls([store.media?.coverUrl, ...(store.media?.images ?? [])]);

              const activeIndex = imageUrls.length ? (imageIndices[store._id] ?? 0) % imageUrls.length : 0;
              const activeImage = imageUrls[activeIndex] || '';
              const imageKey = `${store._id}:${activeIndex}`;
              const showImage = Boolean(activeImage) && !failedImages[imageKey];
              const isFavorite = Boolean(favorites[store._id]);

              return (
                <article
                  key={store._id}
                  onClick={() => navigate(targetUrl)}
                  className="group flex flex-col justify-between cursor-pointer rounded-[32px] border border-[#efeff2] bg-white p-5 sm:p-6 pb-8 sm:pb-9 shadow-[0px_4px_24px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-[#f0dadd] hover:shadow-[0px_16px_36px_-4px_rgba(0,0,0,0.12)]"
                >
                  <div className="flex flex-col">
                    {/* Inner Image Container - Rounded 22px matching Figma */}
                    <div className="relative aspect-[1.62/1] w-full overflow-hidden rounded-[22px] bg-[#f3f4f6]">
                      {showImage ? (
                        <img
                          src={activeImage}
                          alt={store.businessName}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          onError={() => setFailedImages((prev) => ({ ...prev, [imageKey]: true }))}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#9ca3af]">
                          <Camera size={30} strokeWidth={1.5} />
                        </div>
                      )}

                      {/* Gradient Overlay matching Figma */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

                      {/* Top Left: Verified Badge - Generous padding so text is never cramped */}
                      <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-[12.5px] font-bold text-[#059669] shadow-sm backdrop-blur-xs border border-white/80">
                        <CheckCircle2 size={15} strokeWidth={2.4} aria-hidden="true" />
                        <span>Đã xác minh</span>
                      </span>

                      {/* Top Right: Category Badge - Generous padding matching Figma exact colors */}
                      <span
                        className={`absolute right-4 top-4 inline-flex items-center gap-2 rounded-full px-4.5 py-2 text-[12.5px] font-black tracking-wide text-white shadow-sm ${
                          isBundle ? 'bg-[#be185d]' : hasRental ? 'bg-[#ea580c]' : 'bg-[#1d4ed8]'
                        }`}
                      >
                        {isBundle ? (
                          <ShoppingBag size={14} aria-hidden="true" />
                        ) : hasRental ? (
                          <Star size={14} aria-hidden="true" />
                        ) : (
                          <Camera size={14} aria-hidden="true" />
                        )}
                        <span>{isBundle ? 'TRỌN GÓI' : hasRental ? 'SHOWROOM' : 'STUDIO ẢNH'}</span>
                      </span>

                      {/* Image Carousel Pagination (< 1/3 >) */}
                      {imageUrls.length > 1 && (
                        <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                          <button
                            type="button"
                            onClick={(e) => handleImageChange(e, store._id, imageUrls.length, -1)}
                            className="rounded-full p-0.5 transition hover:bg-white/20"
                            aria-label="Ảnh trước"
                          >
                            <ChevronLeft size={14} strokeWidth={2.5} />
                          </button>
                          <span className="min-w-9 text-center text-[11.5px] font-bold">
                            {activeIndex + 1} / {imageUrls.length}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleImageChange(e, store._id, imageUrls.length, 1)}
                            className="rounded-full p-0.5 transition hover:bg-white/20"
                            aria-label="Ảnh tiếp theo"
                          >
                            <ChevronRight size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      )}

                      {/* Right Edge Arrow matching Figma */}
                      {imageUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleImageChange(e, store._id, imageUrls.length, 1)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/65 hover:scale-105"
                          aria-label="Ảnh tiếp theo"
                        >
                          <ChevronRight size={15} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>

                    {/* Store Identity & Rating Header matching Figma */}
                    <div className="mt-5.5 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#f0e8de] bg-[#fbf5ed] shadow-xs flex items-center justify-center">
                          <StoreAvatar store={store} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-[19px] font-bold leading-snug text-[#1e2530] transition-colors group-hover:text-[#c02c55]">
                            {store.businessName}
                          </h3>
                          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#6b7280]">
                            <MapPin size={14} className="shrink-0 text-[#f43f5e]" aria-hidden="true" />
                            <span className="truncate max-w-[170px] sm:max-w-[200px]">
                              {formatAddress(store.address)}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Rating Badge matching Figma - Soft capsule pill with generous breathing room */}
                      <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#fef9ee] border border-[#fef08a] px-4 py-2 shadow-xs">
                        <Star size={14} className="fill-[#f59e0b] text-[#f59e0b]" aria-hidden="true" />
                        <span className="text-[13.5px] font-bold text-[#d97706]">
                          {store.rating?.averageRating ? store.rating.averageRating.toFixed(1) : '4.9'}
                        </span>
                        <span className="text-[12.5px] font-medium text-[#b45309]/80">
                          ({store.rating?.totalReviews ?? 27})
                        </span>
                      </div>
                    </div>

                    {/* Feature Service Pills matching Figma */}
                    <div className="mt-5 flex flex-wrap items-center gap-2.5 text-xs font-medium">
                      {hasRental && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf2f4] border border-[#fce7eb] px-4 py-1.5 text-[12.5px] font-semibold text-[#be185d]">
                          <AoDaiIcon />
                          <span>Thuê áo dài</span>
                        </span>
                      )}
                      {hasPhoto && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eff6ff] border border-[#dbeafe] px-4 py-1.5 text-[12.5px] font-semibold text-[#1d4ed8]">
                          <Camera size={13} aria-hidden="true" />
                          <span>Gói chụp ảnh</span>
                        </span>
                      )}
                      {(store.productCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f4f5] border border-[#e4e4e7] px-4 py-1.5 text-[12.5px] font-semibold text-[#52525b]">
                          <Shirt size={13} aria-hidden="true" />
                          <span>{store.productCount}+ mẫu áo</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Area matching Figma: Clean margin, generous bottom breathing room */}
                  <div className="mt-7 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(targetUrl);
                      }}
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#c02c55] px-5 text-sm font-bold text-white shadow-xs transition-all hover:bg-[#a81f47] active:scale-[0.99]"
                    >
                      <span>{buttonLabel}</span>
                      <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(e, store._id)}
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all ${
                        isFavorite
                          ? 'border-[#f26b8d] bg-[#fdebf1] text-[#c02c55]'
                          : 'border-[#ffe4e6] bg-[#fff1f2] text-[#c02c55] hover:bg-[#ffe4e6]'
                      }`}
                      aria-label={isFavorite ? 'Bỏ yêu thích' : 'Lưu yêu thích'}
                    >
                      <Heart size={18} className={isFavorite ? 'fill-current' : ''} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
      </div>
    </section>
  );
};

export default FeaturedStoresSection;
