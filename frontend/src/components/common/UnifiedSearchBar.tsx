import React from 'react';
import { Search } from 'lucide-react';

export interface SearchFieldConfig {
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface UnifiedSearchBarProps {
  fields: SearchFieldConfig[];
  buttonText: string;
  onSubmit: (e: React.FormEvent) => void;
}

export const UnifiedSearchBar: React.FC<UnifiedSearchBarProps> = ({
  fields,
  buttonText,
  onSubmit,
}) => {
  return (
    <form className="unified-search-card" onSubmit={onSubmit}>
      {fields.map((field, idx) => (
        <div key={idx} className="unified-search-field">
          <label className="unified-search-label">
            <span className="unified-search-label-icon">{field.icon}</span>
            <span>{field.label}</span>
          </label>
          <div className="unified-search-control">
            {field.content}
          </div>
        </div>
      ))}
      <div className="unified-search-btn-wrapper">
        <button type="submit" className="unified-search-btn">
          <Search size={16} />
          <span>{buttonText}</span>
        </button>
      </div>
    </form>
  );
};
