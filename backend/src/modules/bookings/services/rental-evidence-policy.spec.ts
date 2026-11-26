import { BadRequestException } from '@nestjs/common';
import {
  assertRentalEvidenceUploadWindow,
  RENTAL_EVIDENCE_RETENTION_MS,
} from './rental-evidence-policy';

describe('rental evidence upload window', () => {
  const dueAt = new Date('2026-11-25T10:00:00.000Z');

  it('retains submitted handover evidence for exactly 48 hours', () => {
    expect(RENTAL_EVIDENCE_RETENTION_MS).toBe(48 * 60 * 60 * 1000);
  });

  it('accepts pickup evidence only within 24 hours around pickup', () => {
    expect(() => assertRentalEvidenceUploadWindow({ purpose: 'PICKUP', dueAt, now: new Date('2026-11-24T10:00:00.000Z') })).not.toThrow();
    expect(() => assertRentalEvidenceUploadWindow({ purpose: 'PICKUP', dueAt, now: new Date('2026-11-26T10:00:01.000Z') })).toThrow(BadRequestException);
  });

  it('accepts late return evidence up to seven days and lets admins recover exceptions', () => {
    expect(() => assertRentalEvidenceUploadWindow({ purpose: 'RETURN', dueAt, now: new Date('2026-12-02T10:00:00.000Z') })).not.toThrow();
    expect(() => assertRentalEvidenceUploadWindow({ purpose: 'RETURN', dueAt, now: new Date('2026-12-03T10:00:00.000Z') })).toThrow(BadRequestException);
    expect(() => assertRentalEvidenceUploadWindow({ purpose: 'RETURN', dueAt, now: new Date('2027-01-01T00:00:00.000Z'), isAdmin: true })).not.toThrow();
  });
});
