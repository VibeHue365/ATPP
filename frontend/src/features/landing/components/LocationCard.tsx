import React from 'react';
import { Link } from 'react-router-dom';
import type { PopularLocationItem } from '../data/popular-locations.fixture';

export interface LocationCardProps {
  item: PopularLocationItem;
}

export const LocationCard: React.FC<LocationCardProps> = ({ item }) => {
  return (
    <Link
      to={item.destination}
      className="group rounded-3xl overflow-hidden flex flex-col transition-all text-decoration-none border hover:shadow-sm"
      style={{
        borderColor: 'var(--landing-border)',
      }}
    >
      {/* Top Image Container */}
      <div className="w-full h-44 md:h-48 overflow-hidden relative bg-stone-100">
        <img
          src={item.image}
          alt={`Địa điểm chụp ảnh ${item.name}`}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Bottom Info Panel (Burgundy dark background matching screenshot target) */}
      <div 
        className="p-4 md:p-5 flex flex-col gap-1 text-white transition-colors"
        style={{
          backgroundColor: 'var(--landing-primary)',
        }}
      >
        <h3 className="text-lg md:text-xl font-bold font-header text-white leading-tight">
          {item.name}
        </h3>
        <p className="text-xs text-stone-200 line-clamp-1 font-medium">
          {item.description}
        </p>
      </div>
    </Link>
  );
};
