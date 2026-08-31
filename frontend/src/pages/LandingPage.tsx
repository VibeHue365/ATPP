import React, { useState, useEffect } from 'react';
import { HeroSection } from '../features/landing/components/HeroSection';
import { ServiceFinderBar } from '../features/landing/components/ServiceFinderBar';
import { ServiceCategorySection } from '../features/landing/components/ServiceCategorySection';
import { PromotionalBannersSection } from '../features/landing/components/PromotionalBannersSection';
import { FeaturedAoDaiSection } from '../features/rentals/components/FeaturedAoDaiSection';
import { FeaturedPhotoshootSection } from '../features/photographers/components/FeaturedPhotoshootSection';
import { ComboDealsSection } from '../features/combos/components/ComboDealsSection';
import { PopularLocationSection } from '../features/landing/components/PopularLocationSection';
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
      {/* Target Hero 3-Column Section */}
      <HeroSection
        banners={banners}
        currentSlide={currentSlide}
        onSelectSlide={setCurrentSlide}
      />

      {/* Target Service Finder Filter Bar */}
      <ServiceFinderBar />

      {/* Target Service Categories Grid ("Dịch vụ dành cho bạn") */}
      <ServiceCategorySection />

      {/* Target Promotional Banners (Side-by-side Light & Dark Banners) */}
      <PromotionalBannersSection />

      {/* Target Featured Ao Dai Section (4-column Responsive Grid) */}
      <FeaturedAoDaiSection />

      {/* Target Featured Photoshoot Section (4-column Responsive Grid) */}
      <FeaturedPhotoshootSection />

      {/* Target Combo Deals Section (2-column Soft Blush Container) */}
      <ComboDealsSection />

      {/* Target Popular Locations Section (3-column Burgundy Bottom Cards) */}
      <PopularLocationSection />
    </div>
  );
};

export default LandingPage;
