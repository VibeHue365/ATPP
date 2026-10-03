import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ROUTES } from '../../../config/routes';
import type { Banner } from '../constants/landing.constants';
import { photographersApi } from '../../photographers/api/photographers.api';
import { httpClient } from '../../../services/httpClient';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
import type { ComboDeal } from '../../combos/types/combo.types';

export interface HeroSectionProps {
  banners: Banner[];
  currentSlide: number;
  onSelectSlide: (index: number) => void;
}

interface TopPhotoshootData {
  id: string;
  providerId: string;
  name: string;
  providerName: string;
  price: number;
  image: string;
  rating?: number;
}

interface TopComboData {
  id: string;
  name: string;
  providerName: string;
  discountPercent: number;
  price?: number;
  image: string;
}

interface TopProductData {
  id: string;
  name: string;
  providerName: string;
  price?: number;
  image: string;
}

const DEFAULT_PHOTO_IMG = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2';
const DEFAULT_COMBO_IMG = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';

const DEFAULT_FALLBACK_PACKAGE: TopPhotoshootData = {
  id: 'pkg-default-1',
  providerId: '',
  name: 'Gói Chụp Ảnh Nghệ Thuật',
  providerName: 'LUMÉ Heritage Photography',
  price: 1500000,
  image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop',
  rating: 4.9,
};

export const HeroSection: React.FC<HeroSectionProps> = ({
  banners,
  currentSlide,
  onSelectSlide,
}) => {
  const navigate = useNavigate();
  const activeBanner = banners[currentSlide] || banners[0];

  const [topPackages, setTopPackages] = useState<TopPhotoshootData[]>([DEFAULT_FALLBACK_PACKAGE]);
  const [topCombos, setTopCombos] = useState<TopComboData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductData[]>([]);
  const [packageIndex, setPackageIndex] = useState(0);
  const [secondaryIndex, setSecondaryIndex] = useState(0);

  const topPackage = (topPackages.length > 0 ? topPackages : [DEFAULT_FALLBACK_PACKAGE])[packageIndex % Math.max(topPackages.length || 1, 1)];

  // Card 2: If live combos exist, show topCombo; otherwise show live topProduct (or second package)
  const hasCombos = topCombos.length > 0;
  const topCombo = hasCombos ? topCombos[secondaryIndex % topCombos.length] : null;
  const topProduct = topProducts.length > 0 ? topProducts[secondaryIndex % topProducts.length] : null;
  const secondPackage = topPackages.length > 1 ? topPackages[(packageIndex + 1) % topPackages.length] : null;

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 40) {
      onSelectSlide((currentSlide + 1) % banners.length);
    } else if (distance < -40) {
      onSelectSlide((currentSlide - 1 + banners.length) % banners.length);
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  useEffect(() => {
    let active = true;

    photographersApi
      .getAll({ sort: 'rating_desc', limit: 5 })
      .then((res: any) => {
        if (!active || !Array.isArray(res?.data) || res.data.length === 0) return;
        const packages = res.data.slice(0, 5).map((item: any) => {
          const pkg = item.defaultPackage || item.packages?.[0];
          const rawImg = item.coverImage || pkg?.images?.[0] || item.media?.coverUrl || item.media?.images?.[0] || DEFAULT_PHOTO_IMG;
          return {
            id: pkg?._id || item._id,
            providerId: item._id || item.providerId,
            name: pkg?.name || item.businessName || 'Gói chụp nghệ thuật',
            providerName: item.businessName || item.providerName || 'LUMÉ Studio',
            price: pkg?.price || 1500000,
            image: getMediaUrl(rawImg) || rawImg,
            rating: item.rating?.averageRating || 4.9,
          };
        });
        if (packages.length > 0) {
          setTopPackages(packages);
        }
      })
      .catch((err) => console.warn('Lỗi tải gói chụp nổi bật cho Hero:', err));

    httpClient
      .get<ComboDeal[]>('/combo-promotions/public')
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        const sorted = data
          .filter((combo) => combo && (combo.productId || combo.photographyPackageId))
          .sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
        if (sorted.length > 0) {
          setTopCombos(sorted.slice(0, 5).map((combo) => {
            const rawImg = combo.image || combo.productId?.images?.[0] || combo.photographyPackageId?.images?.[0] || DEFAULT_COMBO_IMG;
            return {
              id: combo._id,
              name: combo.name || 'Combo Áo Dài + Studio',
              providerName: combo.providerId?.businessName || 'Trang phục & Chụp ảnh',
              discountPercent: combo.discountPercent || 20,
              price: combo.comboPrice || 850000,
              image: getMediaUrl(rawImg) || rawImg,
            };
          }));
        } else {
          setTopCombos([]);
        }
      })
      .catch((err) => console.warn('Lỗi tải combo nổi bật cho Hero:', err));

    httpClient
      .get<any>('/products?limit=5&sort=newest')
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (list.length > 0) {
          setTopProducts(list.slice(0, 5).map((p: any) => {
            const rawImg = p.images?.[0] || p.coverImage || DEFAULT_PHOTO_IMG;
            return {
              id: p._id || p.id,
              name: p.name || 'Áo dài truyền thống',
              providerName: p.providerId?.businessName || 'Nhà may áo dài',
              price: p.basePrice || p.price || 0,
              image: getMediaUrl(rawImg) || rawImg,
            };
          }));
        }
      })
      .catch((err) => console.warn('Lỗi tải sản phẩm nổi bật cho Hero:', err));

    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (topPackages.length > 1) setPackageIndex((index) => (index + 1) % topPackages.length);
      const secondaryCount = topCombos.length || topProducts.length || (topPackages.length > 1 ? topPackages.length : 1);
      if (secondaryCount > 1) setSecondaryIndex((index) => (index + 1) % secondaryCount);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [topPackages.length, topCombos.length, topProducts.length]);
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="lume-hero w-full">
      <div className="lume-hero-grid grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* LEFT COLUMN: Text Content & CTAs & Qualitative Benefits (~34%) */}
        <div
          className="lg:col-span-4 rounded-2xl p-6 md:p-8 flex flex-col justify-between h-[460px] lg:h-[500px]"
          style={{
            backgroundColor: 'var(--landing-surface)',
            border: '1px solid var(--landing-border)',
            boxShadow: 'var(--landing-shadow-sm)',
          }}
        >
          <div className="flex flex-col gap-4">
            {/* Eyebrow */}
            <span
              className="text-xs font-bold uppercase tracking-wider inline-block"
              style={{ color: '#B52B47' }}
            >
              THUÊ ÁO DÀI & CHỤP ẢNH TRỌN GÓI
            </span>

            {/* Headline H1 */}
            <h1
              className="text-3xl sm:text-4xl lg:text-[42px] font-black font-header tracking-tight leading-[1.14]"
              style={{ color: '#292324' }}
            >
              Chọn áo dài.
              <br />
              Đặt lịch chụp.
              <br />
              <span
                className="font-serif italic font-normal"
                style={{ color: '#B52B47' }}
              >
                Tỏa sáng.
              </span>
            </h1>

            {/* Supporting Description */}
            <p
              className="text-sm md:text-[15px] leading-relaxed mt-1 text-[#5C4F52]"
              style={{ maxWidth: '360px' }}
            >
              Nền tảng kết nối người yêu nét đẹp truyền thống với các nhà may áo dài tinh tế và nhiếp ảnh gia tài năng.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3.5 mt-2 flex-wrap">
              <button
                type="button"
                onClick={() => scrollToSection('rentals')}
                className="rounded-xl text-sm font-bold text-white transition-all cursor-pointer hover:opacity-95 flex items-center gap-2 border-none shrink-0"
                style={{
                  backgroundColor: '#B52B47',
                  color: '#FFFFFF',
                  padding: '12px 24px',
                  boxShadow: '0 4px 14px rgba(181, 43, 71, 0.28)',
                }}
              >
                <span style={{ color: '#FFFFFF' }}>Khám phá ngay</span>
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('combos')}
                className="rounded-xl text-sm font-semibold transition-all cursor-pointer border hover:bg-[#FFF5F7] hover:border-[#B52B47] hover:text-[#B52B47] bg-white shrink-0"
                style={{
                  color: '#292324',
                  borderColor: '#E2CED1',
                  padding: '12px 22px',
                }}
              >
                <span>Xem combo</span>
              </button>
            </div>
          </div>

          {/* Qualitative Benefits Row */}
          <div
            className="pt-5 border-t grid grid-cols-3 gap-3 text-center"
            style={{ borderColor: 'var(--landing-border)' }}
          >
            <div className="flex flex-col gap-1 text-left">
              <span
                className="text-base md:text-lg font-black font-header leading-tight"
                style={{ color: '#B52B47' }}
              >
                500+
              </span>
              <span
                className="text-xs font-semibold leading-tight"
                style={{ color: '#746568' }}
              >
                Mẫu áo dài
              </span>
            </div>
            <div className="flex flex-col gap-1 text-left">
              <span
                className="text-base md:text-lg font-black font-header leading-tight"
                style={{ color: '#B52B47' }}
              >
                100+
              </span>
              <span
                className="text-xs font-semibold leading-tight"
                style={{ color: '#746568' }}
              >
                Nhiếp ảnh gia
              </span>
            </div>
            <div className="flex flex-col gap-1 text-left">
              <span
                className="text-base md:text-lg font-black font-header leading-tight"
                style={{ color: '#B52B47' }}
              >
                100%
              </span>
              <span
                className="text-xs font-semibold leading-tight"
                style={{ color: '#746568' }}
              >
                Cam kết uy tín
              </span>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Single Visual Container with Overlay On Top Of Image (~41%) */}
        <div
          className="lg:col-span-5 rounded-2xl relative overflow-hidden h-[300px] sm:h-[380px] lg:h-[500px] border shadow-2xs group"
          style={{
            borderColor: 'var(--landing-border)',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Moving image banner */}
          <div
            className="lume-hero-slides absolute inset-0 flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {banners.map((banner, index) => (
              <div key={`${banner.imageUrl}-${index}`} className="lume-hero-slide relative h-full w-full shrink-0">
                <img src={banner.imageUrl} alt={banner.title || 'LUMÉ Hero Banner'} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/35" />
              </div>
            ))}
          </div>

          {banners.length > 1 && (
            <div className="absolute left-5 top-5 z-20 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button type="button" onClick={() => onSelectSlide((currentSlide - 1 + banners.length) % banners.length)} aria-label="Previous image" className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur-md hover:bg-black/45"><ArrowLeft size={16} /></button>
              <button type="button" onClick={() => onSelectSlide((currentSlide + 1) % banners.length)} aria-label="Next image" className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur-md hover:bg-black/45"><ArrowRight size={16} /></button>
            </div>
          )}

          {/* Bottom Gradient Overlay */}
          <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white flex flex-col justify-end gap-1.5 z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-200">
                NỔI BẬT TUẦN NÀY
              </span>

              {/* Slide Dots Indicator */}
              {banners.length > 1 && (
                <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectSlide(idx)}
                      aria-label={`Slide ${idx + 1}`}
                      className={`w-2 h-2 rounded-full transition-all border-none cursor-pointer ${currentSlide === idx ? 'w-4 bg-white' : 'bg-white/50 hover:bg-white/80'
                        }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <h3 className="text-base md:text-lg font-bold font-header text-white line-clamp-1">
              {activeBanner.title || 'Bộ Sưu Tập Gấm Mới'}
            </h3>
            <p className="text-xs text-stone-200 line-clamp-1">
              {activeBanner.subtitle || 'Khám phá các mẫu áo dài truyền thống & nghệ thuật'}
            </p>
            {banners.length > 1 && (
              <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/25">
                <div key={currentSlide} className="lume-hero-progress h-full rounded-full bg-white" style={{ animationDuration: '5000ms' }} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Dynamic Promotional Concept Cards (~25%) */}
        <div className="lg:col-span-3 flex flex-col gap-3.5 justify-between h-[460px] lg:h-[500px]">
          {/* Promo Card 1: Gói chụp phổ biến (Dynamic from Live DB) */}
          <div
            key={`package-${packageIndex}`}
            className="lume-promo-swap flex-1 rounded-2xl p-4 md:p-5 flex items-center justify-between gap-3 transition-all border group cursor-pointer"
            style={{
              backgroundColor: 'var(--landing-surface-soft)',
              borderColor: 'var(--landing-border)',
            }}
            onClick={() =>
              topPackage
                ? navigate(`/photographers/${topPackage.providerId || topPackage.id}`)
                : navigate(ROUTES.PHOTOGRAPHERS)
            }
          >
            <div className="flex flex-col justify-between flex-1 py-1 min-w-0">
              <div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider block"
                  style={{ color: '#B52B47' }}
                >
                  GÓI PHỔ BIẾN
                </span>
                <h4
                  className="text-base font-bold font-header mt-1 line-clamp-1 group-hover:opacity-80 transition-opacity"
                  style={{ color: '#292324' }}
                  title={topPackage ? topPackage.name : 'Chụp kỷ yếu'}
                >
                  {topPackage ? topPackage.name : 'Chụp kỷ yếu'}
                </h4>
                <p
                  className="text-xs font-medium mt-1 line-clamp-1 text-[#746568]"
                >
                  {topPackage ? topPackage.providerName : 'Nhiếp ảnh nghệ thuật'}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <span
                  className="text-xs font-bold inline-flex items-center gap-1 hover:underline"
                  style={{ color: '#B52B47' }}
                >
                  <span>Xem gói</span>
                  <ArrowRight size={14} />
                </span>
                {topPackage?.price ? (
                  <span className="text-[11px] font-bold text-stone-600">
                    • {topPackage.price.toLocaleString('vi-VN')}đ
                  </span>
                ) : null}
              </div>
            </div>

            {/* Thumbnail Box */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-stone-200 border border-stone-200/80 shadow-2xs">
              <img
                src={topPackage?.image || DEFAULT_PHOTO_IMG}
                alt={topPackage ? topPackage.name : 'Chụp kỷ yếu'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>

          {/* Promo Card 2: Combo tiết kiệm hoặc Áo dài nổi bật từ DB thật */}
          {hasCombos && topCombo ? (
            <div
              key={`combo-${secondaryIndex}`}
              className="lume-promo-swap flex-1 rounded-2xl p-4 md:p-5 flex items-center justify-between gap-3 transition-all border group cursor-pointer"
              style={{
                backgroundColor: 'var(--landing-surface-soft)',
                borderColor: 'var(--landing-border)',
              }}
              onClick={() => navigate(`/combos/${topCombo.id}`)}
            >
              <div className="flex flex-col justify-between flex-1 py-1 min-w-0">
                <div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider block"
                    style={{ color: '#B52B47' }}
                  >
                    COMBO TIẾT KIỆM {topCombo.discountPercent ? `-${topCombo.discountPercent}%` : ''}
                  </span>
                  <h4
                    className="text-base font-bold font-header mt-1 line-clamp-1 group-hover:opacity-80 transition-opacity"
                    style={{ color: '#292324' }}
                    title={topCombo.name}
                  >
                    {topCombo.name}
                  </h4>
                  <p
                    className="text-xs font-medium mt-1 line-clamp-1 text-[#746568]"
                  >
                    {topCombo.providerName}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <span
                    className="text-xs font-bold inline-flex items-center gap-1 hover:underline"
                    style={{ color: '#B52B47' }}
                  >
                    <span>Xem combo</span>
                    <ArrowRight size={14} />
                  </span>
                  {topCombo.price ? (
                    <span className="text-[11px] font-bold text-stone-600">
                      • {topCombo.price.toLocaleString('vi-VN')}đ
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Thumbnail Box */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-stone-200 border border-stone-200/80 shadow-2xs">
                <img
                  src={topCombo.image || DEFAULT_COMBO_IMG}
                  alt={topCombo.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
          ) : (
            <div
              key={`product-${secondaryIndex}`}
              className="lume-promo-swap flex-1 rounded-2xl p-4 md:p-5 flex items-center justify-between gap-3 transition-all border group cursor-pointer"
              style={{
                backgroundColor: 'var(--landing-surface-soft)',
                borderColor: 'var(--landing-border)',
              }}
              onClick={() => {
                if (topProduct) {
                  navigate(`/rentals/${topProduct.id}`);
                } else if (secondPackage) {
                  navigate(`/photographers/${secondPackage.providerId || secondPackage.id}`);
                } else {
                  navigate(ROUTES.RENTALS);
                }
              }}
            >
              <div className="flex flex-col justify-between flex-1 py-1 min-w-0">
                <div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider block"
                    style={{ color: '#B52B47' }}
                  >
                    {topProduct ? 'ÁO DÀI NỔI BẬT' : 'GÓI CHỤP ĐỀ XUẤT'}
                  </span>
                  <h4
                    className="text-base font-bold font-header mt-1 line-clamp-1 group-hover:opacity-80 transition-opacity"
                    style={{ color: '#292324' }}
                    title={topProduct?.name || secondPackage?.name || 'Áo dài truyền thống'}
                  >
                    {topProduct?.name || secondPackage?.name || 'Áo dài truyền thống'}
                  </h4>
                  <p
                    className="text-xs font-medium mt-1 line-clamp-1 text-[#746568]"
                  >
                    {topProduct?.providerName || secondPackage?.providerName || 'Nhà may áo dài'}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <span
                    className="text-xs font-bold inline-flex items-center gap-1 hover:underline"
                    style={{ color: '#B52B47' }}
                  >
                    <span>{topProduct ? 'Thuê ngay' : 'Xem gói'}</span>
                    <ArrowRight size={14} />
                  </span>
                  {(topProduct?.price ?? secondPackage?.price) ? (
                    <span className="text-[11px] font-bold text-stone-600">
                      • {(topProduct?.price ?? secondPackage?.price)?.toLocaleString('vi-VN')}đ{topProduct ? '/ngày' : ''}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Thumbnail Box */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-stone-200 border border-stone-200/80 shadow-2xs">
                <img
                  src={topProduct?.image || secondPackage?.image || DEFAULT_PHOTO_IMG}
                  alt={topProduct?.name || secondPackage?.name || 'Áo dài'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
