import { RotateCcw } from 'lucide-react';
import './adminReloadButton.css';

export function AdminReloadButton({
  onClick,
  isLoading = false,
  label = 'Tải lại',
  className = '',
}: {
  onClick: () => void | Promise<void>;
  isLoading?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`admin-reload-btn ${className}`}
      onClick={() => void onClick()}
      disabled={isLoading}
      title={label}
    >
      <RotateCcw size={14} className={isLoading ? 'admin-reload-btn__spin' : ''} />
      <span>{label}</span>
    </button>
  );
}
