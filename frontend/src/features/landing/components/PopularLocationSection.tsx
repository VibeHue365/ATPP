import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '../../../config/routes';
import { SectionHeader } from '../../../components/common/SectionHeader';
import { POPULAR_LOCATIONS_FIXTURE } from '../data/popular-locations.fixture';
import { LocationCard } from './LocationCard';

export const PopularLocationSection: React.FC = () => {
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {POPULAR_LOCATIONS_FIXTURE.map((item) => (
          <LocationCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
};
