import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '../../../config/routes';
import { SectionHeader } from '../../../components/common/SectionHeader';
import { DEFAULT_POPULAR_LOCATIONS, type PopularLocationItem } from '../constants/landing.constants';
import { landingCmsApi } from '../api/landingCmsApi';
import { LocationCard } from './LocationCard';

export const PopularLocationSection: React.FC = () => {
  const [locations, setLocations] = useState<PopularLocationItem[]>(DEFAULT_POPULAR_LOCATIONS);

  useEffect(() => {
    let active = true;
    landingCmsApi.getPublicLocations()
      .then((data) => {
        if (active && Array.isArray(data) && data.length > 0) {
          setLocations(data);
        }
      })
      .catch((err) => {
        console.warn('[PopularLocationSection] Failed to load locations from DB, using fallback:', err);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="locations" className="w-full">
      {/* Section Header Reused from Phase 2 */}
      <SectionHeader
        eyebrow="CONCEPT THEO ĐỊA ĐIỂM"
        title="Địa điểm được yêu thích"
        action={
          <Link
            to={ROUTES.PHOTOGRAPHERS}
            className="text-xs font-bold inline-flex items-center gap-1 hover:underline text-decoration-none"
            style={{ color: 'var(--landing-primary)' }}
          >
            <span>Khám phá thêm</span>
            <ArrowRight size={14} />
          </Link>
        }
      />

      {/* 3-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lume-reveal-grid">
        {locations.map((item, index) => (
          <LocationCard key={item.code || item.id || `loc-${index}`} item={item} />
        ))}
      </div>
    </section>
  );
};

