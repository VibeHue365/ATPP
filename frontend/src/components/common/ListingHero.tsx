import React from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface StatItem {
  value: string | number;
  label: string;
}

interface ListingHeroProps {
  breadcrumbs: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  description: string;
  stats: StatItem[];
}

export const ListingHero: React.FC<ListingHeroProps> = ({
  breadcrumbs,
  eyebrow,
  title,
  description,
  stats,
}) => {
  return (
    <div className="unified-hero-section">
      {/* 1. Breadcrumbs */}
      <nav className="unified-hero-breadcrumb" aria-label="Breadcrumb">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <React.Fragment key={index}>
              {isLast ? (
                <span className="breadcrumb-current">{item.label}</span>
              ) : item.href ? (
                <Link to={item.href}>{item.label}</Link>
              ) : (
                <span>{item.label}</span>
              )}
              {!isLast && <span className="breadcrumb-divider">/</span>}
            </React.Fragment>
          );
        })}
      </nav>

      {/* 2. Unified Hero Card Box */}
      <div className="unified-hero-card">
        <div className="unified-hero-left">
          <span className="unified-hero-eyebrow">{eyebrow}</span>
          <h1 className="unified-hero-title">{title}</h1>
          <p className="unified-hero-desc">{description}</p>
        </div>

        {stats.length > 0 && (
          <div className="unified-hero-stats">
            {stats.slice(0, 3).map((stat, idx) => (
              <div key={idx} className="unified-hero-stat-item">
                <span className="unified-hero-stat-value">{stat.value}</span>
                <span className="unified-hero-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
