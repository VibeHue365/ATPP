import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Compass,
  GraduationCap,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../config/routes';
import { SectionHeader } from '../../../components/common/SectionHeader';
import { categoryService } from '../../categories/services/categoryService';
import type { Category, ServiceCategoryType } from '../../categories/types';
import { getMediaUrl } from '../../../shared/media/mediaUrl';

const CATEGORY_TYPES: ServiceCategoryType[] = [
  'AODAI_CATEGORY',
  'PHOTOGRAPHY_CATEGORY',
  'CONCEPT',
  'STYLE',
  'EVENT',
];

type ServiceIcon = React.ComponentType<{ size?: number; className?: string }>;

const iconByCategoryType: Record<ServiceCategoryType, ServiceIcon> = {
  AODAI_CATEGORY: Scissors,
  PHOTOGRAPHY_CATEGORY: Camera,
  CONCEPT: Compass,
  STYLE: Sparkles,
  EVENT: GraduationCap,
};

const getCategoryDestination = (category: Category): string => {
  const encodedId = encodeURIComponent(category.id);

  switch (category.type) {
    case 'AODAI_CATEGORY':
      return `${ROUTES.RENTALS}?categoryId=${encodedId}`;
    case 'PHOTOGRAPHY_CATEGORY':
      return `${ROUTES.PHOTOGRAPHERS}?packageCategoryId=${encodedId}`;
    case 'CONCEPT':
      return `${ROUTES.PHOTOGRAPHERS}?conceptCategoryIds=${encodedId}`;
    case 'STYLE':
      return `${ROUTES.PHOTOGRAPHERS}?styleCategoryIds=${encodedId}`;
    case 'EVENT':
      return `${ROUTES.PHOTOGRAPHERS}?eventCategoryIds=${encodedId}`;
  }
};

const getCategoryDescription = (category: Category): string =>
  category.description ||
  [category.metadata?.occasion, category.metadata?.season].filter(Boolean).join(' · ');

export const ServiceCategorySection: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const autoScrollPausedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        setIsLoading(true);
        const responses = await categoryService.getPublic({ status: 'ACTIVE', limit: 100 });
        const uniqueCategories = new Map<string, Category>();
        responses
          .filter((category) => CATEGORY_TYPES.includes(category.type))
          .forEach((category) => uniqueCategories.set(category.id, category));

        if (active) {
          setCategories(
            [...uniqueCategories.values()].sort(
              (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'vi'),
            ),
          );
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setCategories([]);
          setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh mục dịch vụ.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadCategories();
    return () => {
      active = false;
    };
  }, []);


  useEffect(() => {
    const container = shortcutsRef.current;
    if (!container || categories.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let direction = 1;
    const intervalId = window.setInterval(() => {
      if (autoScrollPausedRef.current) return;

      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      if (maxScrollLeft <= 1) return;

      const nextScrollLeft = container.scrollLeft + direction;
      if (nextScrollLeft >= maxScrollLeft) {
        container.scrollLeft = maxScrollLeft;
        direction = -1;
      } else if (nextScrollLeft <= 0) {
        container.scrollLeft = 0;
        direction = 1;
      } else {
        container.scrollLeft = nextScrollLeft;
      }
    }, 35);

    return () => window.clearInterval(intervalId);
  }, [categories.length]);

  const pauseAutoScroll = () => {
    autoScrollPausedRef.current = true;
  };

  const resumeAutoScroll = () => {
    autoScrollPausedRef.current = false;
  };

  return (
    <section className="w-full">
      <SectionHeader
        eyebrow="DỊCH VỤ DÀNH CHO BẠN"
        title="Dịch vụ dành cho bạn"
        action={
          <Link
            to={ROUTES.RENTALS}
            className="text-xs font-bold inline-flex items-center gap-1 hover:underline text-decoration-none"
            style={{ color: 'var(--landing-primary)' }}
          >
            <span>Xem tất cả</span>
            <ArrowRight size={14} />
          </Link>
        }
      />

      {isLoading ? (
        <div className="lume-service-shortcuts" aria-label="Đang tải danh mục dịch vụ">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="lume-service-skeleton rounded-2xl" aria-hidden="true" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm" style={{ color: 'var(--landing-text-secondary)' }} role="status">
          {error}
        </p>
      ) : categories.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--landing-text-secondary)' }} role="status">
          Chưa có danh mục dịch vụ đang hoạt động.
        </p>
      ) : (
        <div
          ref={shortcutsRef}
          className="lume-service-shortcuts"
          aria-label="Danh mục dịch vụ, có thể kéo ngang"
          onPointerDown={pauseAutoScroll}
          onPointerUp={resumeAutoScroll}
          onPointerCancel={resumeAutoScroll}
          onFocusCapture={pauseAutoScroll}
          onBlurCapture={resumeAutoScroll}
          onTouchStart={pauseAutoScroll}
          onTouchEnd={resumeAutoScroll}
        >
          {categories.map((category) => {
            const IconComponent = iconByCategoryType[category.type];
            const image = getMediaUrl(category.coverImageUrl);
            const description = getCategoryDescription(category);
              return (
              <Link
                key={category.id}
                to={getCategoryDestination(category)}
                className="lume-service-shortcut group p-3 rounded-2xl flex flex-col items-center text-center justify-between gap-2 transition-all text-decoration-none border hover:shadow-sm"
                style={{
                  backgroundColor: 'var(--landing-surface)',
                  borderColor: 'var(--landing-border)',
                }}
              >
                <div className="lume-service-shortcut__image w-full aspect-[4/3] rounded-xl overflow-hidden relative bg-stone-100 mb-1">
                  {image ? (
                    <img
                      src={image}
                      alt={category.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="lume-service-shortcut__placeholder absolute inset-0 flex items-center justify-center">
                      <IconComponent size={28} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
                    <IconComponent size={14} />
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span
                    className="font-header font-bold text-xs leading-tight transition-colors group-hover:opacity-90"
                    style={{ color: 'var(--landing-text-primary)' }}
                  >
                    {category.name}
                  </span>
                  {description && (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--landing-text-muted)' }}>
                      {description}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
};
