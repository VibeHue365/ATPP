import React from 'react';

export const PhotoshootCardSkeleton: React.FC = () => {
  return (
    <div
      className="lume-skeleton-card lume-photoshoot-card flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--landing-surface, #FFFFFF)',
        borderColor: 'var(--landing-border, #F0DADC)',
      }}
      aria-hidden="true"
    >
      {/* Media placeholder */}
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-stone-100">
        <div className="w-full h-full lume-skeleton-shimmer" />
        {/* Badge placeholder */}
        <div className="absolute top-2 left-2 w-16 h-5 rounded-full lume-skeleton-shimmer opacity-80" />
      </div>

      {/* Content area placeholder */}
      <div className="lume-photoshoot-card__content flex flex-col flex-1 justify-between p-3 gap-2">
        <div className="flex flex-col gap-2">
          {/* Time & photographer row */}
          <div className="flex items-center justify-between">
            <div className="w-16 h-2.5 rounded-full lume-skeleton-shimmer" />
            <div className="w-20 h-2.5 rounded-full lume-skeleton-shimmer opacity-70" />
          </div>
          {/* Title line */}
          <div className="w-4/5 h-4 rounded-md lume-skeleton-shimmer" />
          {/* Rating row */}
          <div className="w-24 h-3 rounded-full lume-skeleton-shimmer opacity-70" />
        </div>

        {/* Price & Action row */}
        <div
          className="pt-3 border-t flex items-center justify-between mt-2"
          style={{ borderColor: 'var(--landing-border, #F0DADC)' }}
        >
          <div className="flex flex-col gap-1">
            <div className="w-10 h-2 rounded lume-skeleton-shimmer" />
            <div className="w-20 h-4 rounded-md lume-skeleton-shimmer" />
          </div>
          <div className="w-16 h-6 rounded-full lume-skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
};

export default PhotoshootCardSkeleton;
