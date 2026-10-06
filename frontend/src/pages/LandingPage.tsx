import React, { useState, useEffect } from 'react';
import { HeroSection } from '../features/landing/components/HeroSection';
import { ServiceFinderBar } from '../features/landing/components/ServiceFinderBar';
import { ServiceCategorySection } from '../features/landing/components/ServiceCategorySection';
import { PromotionalBannersSection } from '../features/landing/components/PromotionalBannersSection';
import { FeaturedAoDaiSection } from '../features/rentals/components/FeaturedAoDaiSection';
import { FeaturedPhotoshootSection } from '../features/photographers/components/FeaturedPhotoshootSection';
import { ComboDealsSection } from '../features/combos/components/ComboDealsSection';
import { PopularLocationSection } from '../features/landing/components/PopularLocationSection';
import { ScrollReveal } from '../features/landing/components/ScrollReveal';
import { DEFAULT_BANNERS, CAROUSEL_AUTOPLAY_INTERVAL_MS, type Banner } from '../features/landing/constants/landing.constants';
import './LandingPage.css';

export const LandingPage: React.FC = () => {
  const [banners] = useState<Banner[]>(DEFAULT_BANNERS);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, CAROUSEL_AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [banners]);

  return (
    <div className="lume-landing w-full max-w-[1440px] mx-auto px-4 md:px-8 xl:px-[52px] space-y-[26px] pb-10 md:pb-14">
      {/* Target Hero 3-Column Section (Above the fold) */}
      <HeroSection
        banners={banners}
        currentSlide={currentSlide}
        onSelectSlide={setCurrentSlide}
      />

      {/* Target Service Finder Filter Bar */}
      <ScrollReveal threshold={0.05}>
        <ServiceFinderBar />
      </ScrollReveal>

      {/* Target Service Categories Grid ("Dịch vụ dành cho bạn") */}
      <ScrollReveal threshold={0.05}>
        <ServiceCategorySection />
      </ScrollReveal>

      {/* Target Promotional Banners (Side-by-side Light & Dark Banners) */}
      <ScrollReveal threshold={0.05}>
        <PromotionalBannersSection />
      </ScrollReveal>

      {/* Target Featured Ao Dai Section (4-column Responsive Grid) */}
      <ScrollReveal threshold={0.05}>
        <FeaturedAoDaiSection />
      </ScrollReveal>

      {/* Target Featured Photoshoot Section (4-column Responsive Grid) */}
      <ScrollReveal threshold={0.05}>
        <FeaturedPhotoshootSection />
      </ScrollReveal>

      {/* Target Combo Deals Section (2-column Soft Blush Container) */}
      <ScrollReveal threshold={0.05}>
        <ComboDealsSection />
      </ScrollReveal>

      {/* Target Popular Locations Section (3-column Burgundy Bottom Cards) */}
      <ScrollReveal threshold={0.05}>
        <PopularLocationSection />
      </ScrollReveal>
    </div>
  );
};

export default LandingPage;
