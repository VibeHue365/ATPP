import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '../../../config/routes';
import { SectionHeader } from '../../../components/common/SectionHeader';
import { photographersApi } from '../../photographers/api/photographers.api';
import { FEATURED_PHOTOSHOOT_PACKAGES_FIXTURE, type PhotoshootPackageItem } from '../data/photoshoot-package.fixture';
import { PhotoshootPackageCard } from './PhotoshootPackageCard';

export const FeaturedPhotoshootSection: React.FC = () => {
  const [items, setItems] = useState<PhotoshootPackageItem[]>(FEATURED_PHOTOSHOOT_PACKAGES_FIXTURE);
  const [loading, setLoading] = useState<boolean>(false);

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
                ? rawRating.totalReviews ?? (idx * 4 + 12)
                : (idx * 4 + 12);

            return {
              id: p.id || p._id || `featured-photoshoot-${idx}`,
              name: p.name || 'Gói chụp ảnh nghệ thuật',
              photographerName: p.providerName || p.businessName || 'LUMÉ Studio',
              price: p.price || 500000,
              rating: parsedRating,
              reviewCount: parsedReviews,
              durationMinutes: p.durationMinutes || 90,
              image:
                p.coverImage ||
                (p.images && p.images[0]) ||
                FEATURED_PHOTOSHOOT_PACKAGES_FIXTURE[idx % FEATURED_PHOTOSHOOT_PACKAGES_FIXTURE.length].image,
              badge: idx === 0 ? 'BÁN CHẠY' : idx === 1 ? 'MỚI' : 'NỔI BẬT',
              category: p.categoryName || 'Chụp ảnh',
            };
          });
          setItems(mapped);
        }
      } catch (err) {
        console.warn('Dùng dữ liệu dự phòng cho FeaturedPhotoshootSection:', err);
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
        <div className="py-12 text-center text-xs font-semibold text-stone-500">
          Đang tải các gói chụp nổi bật...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item, index) => (
            <PhotoshootPackageCard key={item.id || `card-${index}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
};
