import React from 'react';

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 ${className}`}>
      <div className="flex flex-col gap-1.5">
        {eyebrow && (
          <span 
            className="text-xs font-bold uppercase tracking-wider inline-block"
            style={{ color: 'var(--landing-primary, #7D3543)' }}
          >
            {eyebrow}
          </span>
        )}
        <h2 
          className="text-2xl md:text-3xl font-extrabold font-header"
          style={{ color: 'var(--landing-text-primary, #292324)' }}
        >
          {title}
        </h2>
        {description && (
          <p 
            className="text-sm max-w-2xl"
            style={{ color: 'var(--landing-text-secondary, #6F6264)' }}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
