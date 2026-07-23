import React, { useState } from 'react';
import { ArrowLeft, CalendarPlus, CircleAlert, Clock3, Plus, Trash2 } from 'lucide-react';
import type { PhotographerPackage, PhotographyQuoteError } from '../types/photographer.types';

export interface PhotographySessionDraft {
  clientId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
}

interface PhotographyMultiSessionEditorProps {
  sessions: PhotographySessionDraft[];
  pricingUnit: NonNullable<PhotographerPackage['pricingUnit']>;
  minDate: string;
  includedDurationMinutes: number;
  minimumSessionMinutes: number;
  overtimeIncrementMinutes: number;
  maxOvertimeMinutes: number;
  errors: PhotographyQuoteError[];
  onAdd: () => void;
  onGenerateRange: (from: string, to: string) => void;
  onUpdate: (clientId: string, patch: Partial<Omit<PhotographySessionDraft, 'clientId'>>) => void;
  onRemove: (clientId: string) => void;
  onBackToSingle: () => void;
}

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ''}`;

const getPolicyText = (
  pricingUnit: NonNullable<PhotographerPackage['pricingUnit']>,
  includedDurationMinutes: number,
) => {
  const duration = formatDuration(includedDurationMinutes);
  if (pricingUnit === 'PER_DAY') return `Thời lượng ${duration} được dùng chung cho tất cả buổi trong cùng một ngày.`;
  if (pricingUnit === 'PER_BOOKING') return `Thời lượng ${duration} được dùng chung cho toàn bộ booking.`;
  return `Mỗi buổi bao gồm ${duration}; giá gói được tính riêng cho từng buổi.`;
};

export const PhotographyMultiSessionEditor: React.FC<PhotographyMultiSessionEditorProps> = ({
  sessions,
  pricingUnit,
  minDate,
  includedDurationMinutes,
  minimumSessionMinutes,
  overtimeIncrementMinutes,
  maxOvertimeMinutes,
  errors,
  onAdd,
  onGenerateRange,
  onUpdate,
  onRemove,
  onBackToSingle,
}) => {
  const [rangeFrom, setRangeFrom] = useState(minDate);
  const [rangeTo, setRangeTo] = useState(minDate);
  const maxDuration = includedDurationMinutes + maxOvertimeMinutes;
  const errorsBySession = new Map(errors.map((error) => [error.clientId, error.message]));

  return (
    <section className="pd-multi-session-section">
      <div className="pd-multi-session-heading">
        <h2 className="pd-section-title"><span className="pd-section-title-num">2</span><span>Lịch chụp</span></h2>
        <button type="button" onClick={onBackToSingle}><ArrowLeft size={15} /> Chỉ đặt một buổi</button>
      </div>
      <p className="pd-multi-session-intro">Tạo lịch theo khoảng ngày hoặc thêm từng buổi. Mỗi dòng được kiểm tra lịch thật trước khi thanh toán.</p>
      <p className="pd-multi-session-policy">{getPolicyText(pricingUnit, includedDurationMinutes)}</p>

      <div className="pd-multi-session-range">
        <label>Từ ngày<input type="date" min={minDate} value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} /></label>
        <label>Đến ngày<input type="date" min={rangeFrom || minDate} value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} /></label>
        <button type="button" onClick={() => onGenerateRange(rangeFrom, rangeTo)} disabled={!rangeFrom || !rangeTo || rangeTo < rangeFrom}><CalendarPlus size={16} /> Tạo lịch theo ngày</button>
      </div>

      <div className="pd-multi-session-list">
        {sessions.map((session, index) => {
          const error = errorsBySession.get(session.clientId);
          const endTime = session.startTime ? toTime(toMinutes(session.startTime) + session.durationMinutes) : '';
          return (
            <article key={session.clientId} className={`pd-multi-session-row ${error ? 'pd-multi-session-row--invalid' : ''}`}>
              <div className="pd-multi-session-row__title">Buổi {index + 1}</div>
              <label>Ngày chụp<input type="date" min={minDate} value={session.date} onChange={(event) => onUpdate(session.clientId, { date: event.target.value })} /></label>
              <label>Giờ bắt đầu<input type="time" step={overtimeIncrementMinutes * 60} value={session.startTime} onChange={(event) => onUpdate(session.clientId, { startTime: event.target.value })} /></label>
              <div className="pd-multi-session-row__duration">
                <span>Thời lượng</span>
                <div>
                  <button type="button" onClick={() => onUpdate(session.clientId, { durationMinutes: Math.max(minimumSessionMinutes, session.durationMinutes - overtimeIncrementMinutes) })} disabled={session.durationMinutes <= minimumSessionMinutes}>−</button>
                  <strong>{formatDuration(session.durationMinutes)}</strong>
                  <button type="button" onClick={() => onUpdate(session.clientId, { durationMinutes: Math.min(maxDuration, session.durationMinutes + overtimeIncrementMinutes) })} disabled={session.durationMinutes >= maxDuration}>+</button>
                </div>
                <small><Clock3 size={12} /> Kết thúc {endTime || '—'}</small>
              </div>
              <button type="button" className="pd-multi-session-row__remove" onClick={() => onRemove(session.clientId)} disabled={sessions.length === 1} aria-label={`Xóa buổi ${index + 1}`}><Trash2 size={17} /></button>
              {error && <p className="pd-multi-session-row__error"><CircleAlert size={14} /> {error}</p>}
            </article>
          );
        })}
      </div>
      <button type="button" className="pd-multi-session-add" onClick={onAdd}><Plus size={16} /> Thêm một buổi</button>
    </section>
  );
};
