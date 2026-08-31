import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { PhotographyQuoteError } from '../types/photographer.types';
import { PhotographyMultiSessionEditor, type PhotographySessionDraft } from './PhotographyMultiSessionEditor';

interface PhotographyMultiSessionDialogProps {
  open: boolean;
  sessions: PhotographySessionDraft[];
  minDate: string;
  includedDurationMinutes: number;
  overtimeIncrementMinutes: number;
  maxOvertimeMinutes: number;
  errors: PhotographyQuoteError[];
  onAdd: () => void;
  onGenerateRange: (from: string, to: string) => void;
  onUpdate: (clientId: string, patch: Partial<Omit<PhotographySessionDraft, 'clientId'>>) => void;
  onRemove: (clientId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return year && month && day ? [day, month, year].join('/') : value;
};

export const PhotographyMultiSessionDialog: React.FC<PhotographyMultiSessionDialogProps> = ({
  open,
  sessions,
  minDate,
  includedDurationMinutes,
  overtimeIncrementMinutes,
  maxOvertimeMinutes,
  errors,
  onAdd,
  onGenerateRange,
  onUpdate,
  onRemove,
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onCancel, open]);

  if (!open || typeof document === 'undefined') return null;

  const completedSessions = sessions.filter((session) => session.date && session.startTime).length;
  const sessionDates = sessions.map((session) => session.date).filter(Boolean).sort();
  const firstDate = sessionDates[0];
  const lastDate = sessionDates[sessionDates.length - 1];
  const hasBlockingErrors = errors.length > 0;
  const canConfirm = sessions.length > 0 && completedSessions === sessions.length && !hasBlockingErrors;

  return createPortal(
    <div
      className="ppd-multi-session-dialog"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="ppd-multi-session-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="ppd-multi-session-title">
        <header className="ppd-multi-session-dialog__header">
          <div>
            <span className="ppd-eyebrow">ĐẶT LỊCH LINH HOẠT</span>
            <h2 id="ppd-multi-session-title">Lịch nhiều buổi</h2>
            <p>Thêm từng buổi chụp và kiểm tra lịch trống trước khi xác nhận.</p>
          </div>
          <button type="button" className="ppd-multi-session-dialog__close" onClick={onCancel} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="ppd-multi-session-dialog__body">
          <div className="ppd-multi-session-overview" aria-label="Tóm tắt lịch nhiều buổi">
            <div>
              <strong>{sessions.length}</strong>
              <span>buổi đã thêm</span>
            </div>
            <div>
              <strong>{completedSessions}/{sessions.length}</strong>
              <span>buổi đã đủ ngày và giờ</span>
            </div>
            <div>
              <strong>{firstDate ? (firstDate === lastDate ? formatDate(firstDate) : formatDate(firstDate) + ' – ' + formatDate(lastDate || firstDate)) : 'Chưa chọn'}</strong>
              <span>khoảng ngày dự kiến</span>
            </div>
          </div>

          <PhotographyMultiSessionEditor
            sessions={sessions}
            minDate={minDate}
            includedDurationMinutes={includedDurationMinutes}
            overtimeIncrementMinutes={overtimeIncrementMinutes}
            maxOvertimeMinutes={maxOvertimeMinutes}
            errors={errors}
            onAdd={onAdd}
            onGenerateRange={onGenerateRange}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        </div>

        <footer className="ppd-multi-session-dialog__footer">
          <div className="ppd-multi-session-dialog__status">
            {hasBlockingErrors ? <span className="is-error">Cần xử lý lỗi lịch trước khi tiếp tục.</span> : <><CheckCircle2 size={15} /> Kiểm tra lại trước khi xác nhận</>}
          </div>
          <div className="ppd-dialog-actions">
            <button type="button" className="ppd-secondary-button" onClick={onCancel}>Hủy</button>
            <button type="button" className="ppd-primary-button" disabled={!canConfirm} onClick={onConfirm}>Xác nhận lịch nhiều buổi</button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
};