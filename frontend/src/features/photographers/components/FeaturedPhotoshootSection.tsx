import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '../../../config/routes';
import { SectionHeader } from '../../../components/common/SectionHeader';
import { photographersApi } from '../../photographers/api/photographers.api';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
import type { PhotoshootPackageItem } from '../types/photographer.types';
import { PhotoshootPackageCard } from './PhotoshootPackageCard';
import { PhotoshootCardSkeleton } from './PhotoshootCardSkeleton';

export const FeaturedPhotoshootSection: React.FC = () => {
  const [items, setItems] = useState<PhotoshootPackageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const fetchLivePackages = async () => {
      try {
        setLoading(true);
        const response = await photographersApi.getAll({ limit: 4 });
        if (active && response?.data && response.data.length > 0) {
          const mapped: PhotoshootPackageItem[] = response.data.slice(0, 4).map((p: any, idx: number) => {
            const rawRating = p.rating;
            const parsedRating =
              typeof rawRating === 'number'
                ? rawRating
                : typeof rawRating === 'object' && rawRating !== null
                ? rawRating.averageRating ?? 4.9
                : 4.9;

            const parsedReviews =
              typeof p.reviewCount === 'number'
                ? p.reviewCount
                : typeof rawRating === 'object' && rawRating !== null
                ? rawRating.totalReviews ?? 0
                : 0;

            const pkg = p.defaultPackage || (p.packages && p.packages[0]);
            const pkgImg =
              getMediaUrl(p.coverImage) ||
              getMediaUrl(pkg?.images?.[0]) ||
              getMediaUrl(p.media?.coverUrl) ||
              '';

            return {
              id: pkg?._id || p._id || p.id || `featured-photoshoot-${idx}`,
              name: pkg?.name || p.name || 'Gói chụp ảnh',
              photographerName: p.businessName || p.providerName || 'Nhiếp ảnh gia',
              price: pkg?.price ?? p.price ?? 0,
              rating: parsedRating,
              reviewCount: parsedReviews,
              durationMinutes: pkg?.includedDurationMinutes ?? p.durationMinutes ?? 60,
              image: pkgImg,
              badge: p.badge,
              category: p.categoryName || 'Chụp ảnh',
            };
          });
          setItems(mapped);
        }
      } catch (err) {
        console.error('Lỗi khi tải gói chụp ảnh nổi bật:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchLivePackages();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="photographers" className="w-full">
      {/* Section Header */}
      <SectionHeader
        eyebrow="GÓI CHỤP ẢNH"
        title="Gói chụp ảnh nổi bật"
        action={
          <Link
            to={ROUTES.PHOTOGRAPHERS}
            className="text-xs font-bold inline-flex items-center gap-1 hover:underline text-decoration-none"
            style={{ color: 'var(--landing-primary)' }}
          >
            <span>Xem tất cả</span>
            <ArrowRight size={14} />
          </Link>
        }
      />

      {/* Product Grid */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <PhotoshootCardSkeleton key={`photo-skel-${idx}`} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 lume-reveal-grid">
          {items.map((item, index) => (
            <PhotoshootPackageCard key={item.id || `card-${index}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
};
