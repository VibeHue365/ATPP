import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './CustomSelect.css';

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
}

export interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  dropdownClassName?: string;
  id?: string;
  ariaLabel?: string;
  size?: 'default' | 'sm';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  className = '',
  dropdownClassName = '',
  id,
  ariaLabel,
  size = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalId = useId();
  const selectId = id || internalId;

  // Selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        onChange(options[nextIndex].value);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        onChange(options[prevIndex].value);
      }
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select-wrapper ${isOpen ? 'is-open' : ''} ${size === 'sm' ? 'custom-select--sm' : ''} ${className}`}
    >
      <button
        type="button"
        id={selectId}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || selectedOption?.label || placeholder}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className="custom-select-trigger"
      >
        <span className="custom-select-value truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`custom-select-arrow ${isOpen ? 'custom-select-arrow--open' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          aria-labelledby={selectId}
          className={`custom-select-dropdown ${dropdownClassName}`}
        >
          <div className="custom-select-options-scroll">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={`custom-select-option ${isSelected ? 'is-selected' : ''}`}
                >
                  <div className="custom-select-option-content">
                    {opt.icon && <span className="custom-select-option-icon">{opt.icon}</span>}
                    <span className="custom-select-option-label">{opt.label}</span>
                    {opt.hint && <span className="custom-select-option-hint">{opt.hint}</span>}
                  </div>
                  {isSelected && (
                    <Check size={14} className="custom-select-option-check" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
