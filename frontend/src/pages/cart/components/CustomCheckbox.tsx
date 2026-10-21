import React from 'react';

interface CustomCheckboxProps {
  checked: boolean;
  onChange: () => void;
  className?: string;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ checked, onChange, className = '' }) => {
  return (
    <div
      onClick={onChange}
      className={`vh-custom-checkbox ${className}`.trim()}
      style={{
        border: checked ? 'none' : '2px solid #D5C2AD',
        backgroundColor: checked ? '#8B1E22' : '#FFFFFF',
      }}
    >
      {checked && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M10 3L4.5 8.5L2 6"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
};

export default CustomCheckbox;
