import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import './asyncState.css';

type StateAction = { label: string; onClick: () => void };

interface StateProps {
  title?: string;
  message: string;
  action?: StateAction;
  className?: string;
}

export function PageLoading({ message = 'Đang tải dữ liệu…' }: Pick<StateProps, 'message'>) {
  return <SectionLoading message={message} size="page" />;
}

export function SectionLoading({ message = 'Đang tải…', size = 'section' }: Pick<StateProps, 'message'> & { size?: 'section' | 'page' }) {
  return (
    <div className={`vh-async-state vh-async-state--${size}`} role="status" aria-live="polite">
      <LoaderCircle className="vh-async-state__spinner" size={size === 'page' ? 38 : 26} />
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({ title = 'Chưa có dữ liệu', message, action, className = '' }: StateProps) {
  return (
    <div className={`vh-async-state vh-async-state--empty ${className}`}>
      <Inbox className="vh-async-state__icon" size={38} />
      <h3>{title}</h3>
      <p>{message}</p>
      {action && <button type="button" className="vh-async-state__action" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}

export function ErrorState({ title = 'Không thể tải dữ liệu', message, action, className = '' }: StateProps) {
  return (
    <div className={`vh-async-state vh-async-state--error ${className}`} role="alert">
      <AlertCircle className="vh-async-state__icon" size={38} />
      <h3>{title}</h3>
      <p>{message}</p>
      {action && <button type="button" className="vh-async-state__action" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="vh-async-skeleton-grid" aria-label="Đang tải nội dung">
      {Array.from({ length: count }, (_, index) => <div className="vh-async-skeleton-card" key={index} aria-hidden="true">
        <span className="vh-async-skeleton vh-async-skeleton--image" />
        <span className="vh-async-skeleton vh-async-skeleton--title" />
        <span className="vh-async-skeleton vh-async-skeleton--text" />
        <span className="vh-async-skeleton vh-async-skeleton--text is-short" />
      </div>)}
    </div>
  );
}
