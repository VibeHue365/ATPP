import React from 'react';
import { Clock3, Minus, Plus } from 'lucide-react';

interface PhotographyDurationControlProps {
  includedDurationMinutes: number;
  durationMinutes: number;
  overtimeIncrementMinutes: number;
  maxOvertimeMinutes: number;
  endTime: string;
  canIncrease: boolean;
  isCheckingIncrease: boolean;
  unavailableReason?: string;
  onDecrease: () => void;
  onIncrease: () => void;
}

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} phút`;
  return remainder ? `${hours} giờ ${remainder} phút` : `${hours} giờ`;
};

export const PhotographyDurationControl: React.FC<PhotographyDurationControlProps> = ({
  includedDurationMinutes,
  durationMinutes,
  overtimeIncrementMinutes,
  maxOvertimeMinutes,
  endTime,
  canIncrease,
  isCheckingIncrease,
  unavailableReason,
  onDecrease,
  onIncrease,
}) => {
  const overtimeMinutes = Math.max(0, durationMinutes - includedDurationMinutes);
  const canDecrease = durationMinutes > includedDurationMinutes;

  return (
    <div className="pd-duration-control" aria-live="polite">
      <div className="pd-duration-control__heading">
        <div>
          <span className="pd-duration-control__eyebrow"><Clock3 size={14} /> Thời lượng buổi chụp</span>
          <strong>{formatDuration(durationMinutes)}</strong>
        </div>
        {endTime && <span className="pd-duration-control__end">Kết thúc lúc {endTime}</span>}
      </div>

      <div className="pd-duration-control__actions">
        <button type="button" onClick={onDecrease} disabled={!canDecrease} aria-label="Giảm thời lượng">
          <Minus size={16} />
        </button>
        <span>{overtimeMinutes ? `Tăng giờ: ${formatDuration(overtimeMinutes)}` : 'Trong thời lượng gói'}</span>
        <button
          type="button"
          onClick={onIncrease}
          disabled={!canIncrease || isCheckingIncrease}
          aria-label="Tăng thời lượng"
          title={unavailableReason || undefined}
        >
          <Plus size={16} />
        </button>
      </div>

      <p>
        Gói bao gồm {formatDuration(includedDurationMinutes)}. Mỗi lần tăng thêm {formatDuration(overtimeIncrementMinutes)}
        {maxOvertimeMinutes > 0 ? `, tối đa ${formatDuration(maxOvertimeMinutes)}.` : '.'}
      </p>
      {!canIncrease && unavailableReason && <small>{unavailableReason}</small>}
    </div>
  );
};
