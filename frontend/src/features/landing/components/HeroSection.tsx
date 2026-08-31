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

const DEFAULT_PHOTO_IMG = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2';
const DEFAULT_COMBO_IMG = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';

export const HeroSection: React.FC<HeroSectionProps> = ({
  banners,
  currentSlide,
  onSelectSlide,
}) => {
  const navigate = useNavigate();
  const activeBanner = banners[currentSlide] || banners[0];

  const [topPackages, setTopPackages] = useState<TopPhotoshootData[]>([]);
  const [topCombos, setTopCombos] = useState<TopComboData[]>([]);
  const [packageIndex, setPackageIndex] = useState(0);
  const [comboIndex, setComboIndex] = useState(0);
  const topPackage = topPackages[packageIndex % Math.max(topPackages.length, 1)];
  const topCombo = topCombos[comboIndex % Math.max(topCombos.length, 1)];

  useEffect(() => {
    let active = true;

    photographersApi
      .getAll({ sort: 'rating_desc', limit: 5 })
      .then((res: any) => {
        if (!active || !Array.isArray(res?.data)) return;
        const packages = res.data.slice(0, 5).map((item: any) => {
          const pkg = item.defaultPackage || item.packages?.[0];
          const rawImg = item.coverImage || pkg?.images?.[0] || item.media?.coverUrl || item.media?.images?.[0] || DEFAULT_PHOTO_IMG;
          return {
            id: pkg?._id || item._id,
            providerId: item._id || item.providerId,
            name: pkg?.name || item.businessName || 'Gói chụp nghệ thuật',
            providerName: item.businessName || item.providerName || 'LUMÉ Studio',
            price: pkg?.price || 500000,
            image: getMediaUrl(rawImg) || rawImg,
            rating: item.rating?.averageRating || 4.9,
          };
        });
        setTopPackages(packages);
      })
      .catch((err) => console.warn('Lỗi tải gói chụp nổi bật cho Hero:', err));

    httpClient
      .get<ComboDeal[]>('/combo-promotions/public')
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        const sorted = data
          .filter((combo) => combo && (combo.productId || combo.photographyPackageId))
          .sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
        setTopCombos(sorted.slice(0, 5).map((combo) => {
          const rawImg = combo.image || combo.productId?.images?.[0] || combo.photographyPackageId?.images?.[0] || DEFAULT_COMBO_IMG;
          return {
            id: combo._id,
            name: combo.name || 'Áo dài + Studio',
            providerName: combo.providerId?.businessName || 'Trang phục & Chụp ảnh',
            discountPercent: combo.discountPercent || 20,
            price: combo.comboPrice,
            image: getMediaUrl(rawImg) || rawImg,
          };
        }));
      })
      .catch((err) => console.warn('Lỗi tải combo nổi bật cho Hero:', err));

    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (topPackages.length > 1) setPackageIndex((index) => (index + 1) % topPackages.length);
      if (topCombos.length > 1) setComboIndex((index) => (index + 1) % topCombos.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [topPackages.length, topCombos.length]);
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="lume-hero w-full">
      <div
        className="lume-hero-grid grid items-stretch"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: '14px',
        }}
      >
        {/* LEFT COLUMN: Text Content & CTAs & Qualitative Benefits (~34%) */}
        <div
          className="lg:col-span-4 rounded-2xl p-6 md:p-7 flex flex-col justify-between gap-6 h-[460px] lg:h-[500px]"
          style={{
            backgroundColor: 'var(--landing-surface)',
            border: '1px solid var(--landing-border)',
            boxShadow: 'var(--landing-shadow-sm)',
          }}
        >
          <div className="flex flex-col gap-3.5">
            {/* Eyebrow */}
            <span
              className="text-[10px] md:text-xs font-bold uppercase tracking-wider inline-block"
              style={{ color: 'var(--landing-primary)' }}
            >
              THUÊ ÁO DÀI & CHỤP ẢNH TRONG MỘN NƠI
            </span>

            {/* Headline H1 */}
            <h1
              className="text-2xl md:text-3xl lg:text-4xl font-extrabold font-header tracking-tight leading-tight"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              Chọn áo dài.
              <br />
              Đặt lịch chụp.
              <br />
              <span
                className="font-serif italic font-normal"
                style={{ color: 'var(--landing-primary)' }}
              >
                Tỏa sáng.
              </span>
            </h1>

            {/* Supporting Description */}
            <p
              className="text-xs md:text-sm leading-relaxed mt-0.5 line-clamp-3"
              style={{ color: 'var(--landing-text-secondary)' }}
            >
              Tìm mẫu áo dài, photographer và concept phù hợp chỉ trong vài bước.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <button
                type="button"
                onClick={() => scrollToSection('rentals')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-2xs hover:opacity-95 flex items-center gap-2 border-none"
                style={{ backgroundColor: 'var(--landing-primary)' }}
              >
                <span>Khám phá ngay</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('combos')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border hover:bg-stone-50 bg-white"
                style={{
                  color: 'var(--landing-text-primary)',
                  borderColor: 'var(--landing-border)',
                }}
              >
                Xem combo
              </button>
            </div>
          </div>

          {/* Qualitative Benefits Row */}
          <div
            className="pt-4 border-t grid grid-cols-3 gap-2 text-center"
            style={{ borderColor: 'var(--landing-border)' }}
          >
            <div className="flex flex-col gap-0.5">
              <span
                className="text-xs font-bold font-header"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                Đa dạng
              </span>
              <span
                className="text-[10px] font-medium"
                style={{ color: 'var(--landing-text-muted)' }}
              >
                Mẫu áo dài
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className="text-xs font-bold font-header"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                Trọn gói
              </span>
              <span
                className="text-[10px] font-medium"
                style={{ color: 'var(--landing-text-muted)' }}
              >
                Nhiếp ảnh
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className="text-xs font-bold font-header"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                Uy tín
              </span>
              <span
                className="text-[10px] font-medium"
                style={{ color: 'var(--landing-text-muted)' }}
              >
                Chất lượng
              </span>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Single Visual Container with Overlay On Top Of Image (~41%) */}
        <div
          className="lg:col-span-5 rounded-2xl relative overflow-hidden h-[460px] lg:h-[500px] border shadow-2xs group"
          style={{
            borderColor: 'var(--landing-border)',
          }}
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
            <div className="absolute left-5 top-5 z-20 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => onSelectSlide((currentSlide - 1 + banners.length) % banners.length)} aria-label="Previous image" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur-md hover:bg-black/45"><ArrowLeft size={16} /></button>
              <button type="button" onClick={() => onSelectSlide((currentSlide + 1) % banners.length)} aria-label="Next image" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur-md hover:bg-black/45"><ArrowRight size={16} /></button>
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
                      className={`w-2 h-2 rounded-full transition-all border-none cursor-pointer ${
                        currentSlide === idx ? 'w-4 bg-white' : 'bg-white/50 hover:bg-white/80'
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
        <div className={`lg:col-span-3 flex flex-col gap-4 justify-between h-[460px] lg:h-[500px] ${topCombos.length === 0 ? 'lume-promos-single' : ''}`}>
          {/* Promo Card 1: Gói chụp phổ biến (Dynamic from Live DB) */}
          <div
            key={`package-${packageIndex}`} className="lume-promo-swap flex-1 rounded-2xl p-4 md:p-5 flex items-center justify-between gap-3 transition-all border group cursor-pointer"
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
            <div className="flex flex-col justify-between flex-1 py-0.5 min-w-0">
              <div>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider block"
                  style={{ color: 'var(--landing-primary)' }}
                >
                  GÓI PHỔ BIẾN
                </span>
                <h4
                  className="text-base font-bold font-header mt-0.5 line-clamp-1 group-hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--landing-text-primary)' }}
                  title={topPackage ? topPackage.name : 'Chụp kỷ yếu'}
                >
                  {topPackage ? topPackage.name : 'Chụp kỷ yếu'}
                </h4>
                <p
                  className="text-xs font-medium mt-1 line-clamp-1"
                  style={{ color: 'var(--landing-text-secondary)' }}
                >
                  {topPackage ? topPackage.providerName : 'Nhiếp ảnh nghệ thuật'}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <span
                  className="text-xs font-bold inline-flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--landing-primary)' }}
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
          {topCombos.length > 0 && (
<div
            key={`combo-${comboIndex}`} className="lume-promo-swap flex-1 rounded-2xl p-4 md:p-5 flex items-center justify-between gap-3 transition-all border group cursor-pointer"
            style={{
              backgroundColor: 'var(--landing-surface-soft)',
              borderColor: 'var(--landing-border)',
            }}
            onClick={() =>
              topCombo ? navigate(`/combos/${topCombo.id}`) : navigate(ROUTES.COMBOS)
            }
          >
            <div className="flex flex-col justify-between flex-1 py-0.5 min-w-0">
              <div>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider block"
                  style={{ color: 'var(--landing-primary)' }}
                >
                  COMBO TIẾT KIỆM {topCombo?.discountPercent ? `-${topCombo.discountPercent}%` : ''}
                </span>
                <h4
                  className="text-base font-bold font-header mt-0.5 line-clamp-1 group-hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--landing-text-primary)' }}
                  title={topCombo ? topCombo.name : 'Áo dài + Studio'}
                >
                  {topCombo ? topCombo.name : 'Áo dài + Studio'}
                </h4>
                <p
                  className="text-xs font-medium mt-1 line-clamp-1"
                  style={{ color: 'var(--landing-text-secondary)' }}
                >
                  {topCombo ? topCombo.providerName : 'Trang phục & Chụp ảnh'}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <span
                  className="text-xs font-bold inline-flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--landing-primary)' }}
                >
                  <span>Xem combo</span>
                  <ArrowRight size={14} />
                </span>
                {topCombo?.price ? (
                  <span className="text-[11px] font-bold text-stone-600">
                    • {topCombo.price.toLocaleString('vi-VN')}đ
                  </span>
                ) : null}
              </div>
            </div>

            {/* Thumbnail Box */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-stone-200 border border-stone-200/80 shadow-2xs">
              <img
                src={topCombo?.image || DEFAULT_COMBO_IMG}
                alt={topCombo ? topCombo.name : 'Áo dài + Studio'}
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
