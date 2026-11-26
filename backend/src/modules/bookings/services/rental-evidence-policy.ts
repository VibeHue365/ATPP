import { BadRequestException } from '@nestjs/common';

export const RENTAL_EVIDENCE_UNATTACHED_TTL_MS = 24 * 60 * 60 * 1000;
export const RENTAL_EVIDENCE_RETENTION_MS = 48 * 60 * 60 * 1000;
const PICKUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const RETURN_BEFORE_MS = 24 * 60 * 60 * 1000;
const RETURN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function assertRentalEvidenceUploadWindow(input: {
  purpose: 'PICKUP' | 'RETURN';
  dueAt: Date | null | undefined;
  now?: Date;
  isAdmin?: boolean;
}): void {
  if (input.isAdmin) return;
  if (!input.dueAt || Number.isNaN(new Date(input.dueAt).getTime())) {
    throw new BadRequestException('Đơn thuê chưa có thời điểm giao/nhận hợp lệ để tải ảnh bàn giao.');
  }
  const now = (input.now ?? new Date()).getTime();
  const dueAt = new Date(input.dueAt).getTime();
  const opensAt = dueAt - (input.purpose === 'PICKUP' ? PICKUP_WINDOW_MS : RETURN_BEFORE_MS);
  const closesAt = dueAt + (input.purpose === 'PICKUP' ? PICKUP_WINDOW_MS : RETURN_AFTER_MS);
  if (now < opensAt || now > closesAt) {
    const label = input.purpose === 'PICKUP' ? 'giao áo' : 'nhận trả áo';
    throw new BadRequestException(`Chỉ được tải ảnh ${label} trong khung thời gian bàn giao cho phép.`);
  }
}
