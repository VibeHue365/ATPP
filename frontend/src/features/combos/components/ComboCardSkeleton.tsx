import React from 'react';

export const ComboCardSkeleton: React.FC = () => {
  return (
    <div
      className="lume-combo-card flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--landing-surface, #FFFFFF)',
        borderColor: 'var(--landing-border, #F0DADC)',
      }}
      aria-hidden="true"
    >
      {/* Visual container skeleton */}
      <div className="relative h-[180px] sm:h-[210px] w-full overflow-hidden bg-stone-100 flex">
        <div className="w-1/2 h-full lume-skeleton-shimmer border-r border-white/50" />
        <div className="w-1/2 h-full lume-skeleton-shimmer" />

        {/* Badges placeholder */}
        <div className="absolute top-3 left-3 w-20 h-5 rounded-md lume-skeleton-shimmer opacity-80" />
        <div className="absolute top-3 right-3 w-16 h-6 rounded-full lume-skeleton-shimmer opacity-90" />
      </div>

      {/* Content placeholder */}
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        {/* Provider line */}
        <div className="flex items-center gap-2">
          <div className="w-28 h-3 rounded-full lume-skeleton-shimmer" />
          <div className="w-4 h-4 rounded-full lume-skeleton-shimmer opacity-60" />
        </div>

        {/* Title line */}
        <div className="w-4/5 h-5 rounded-md lume-skeleton-shimmer" />

        {/* Tag pills */}
        <div className="flex items-center gap-2">
          <div className="w-20 h-4 rounded-full lume-skeleton-shimmer opacity-70" />
          <div className="w-24 h-4 rounded-full lume-skeleton-shimmer opacity-70" />
        </div>

        {/* Price & action button */}
        <div
          className="pt-3 border-t flex items-center justify-between mt-1"
          style={{ borderColor: 'var(--landing-border, #F0DADC)' }}
        >
          <div className="flex flex-col gap-1">
            <div className="w-12 h-2 rounded lume-skeleton-shimmer" />
            <div className="w-24 h-5 rounded-md lume-skeleton-shimmer" />
          </div>
          <div className="w-24 h-8 rounded-xl lume-skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
};

export default ComboCardSkeleton;
