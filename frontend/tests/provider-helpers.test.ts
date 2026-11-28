import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPhotoScheduleStartsAt, formatPhotoStartTime, getOrderGroup } from '../src/features/provider-dashboard/orders/orderHelpers';
import { buildRentalOrderTabs, getRentalOrderMatchLabel, getRentalOrderTabId, orderMatchesRentalFilter, parseRentalOrderTab } from '../src/features/provider-dashboard/orders/rentalOrderFilters';
import { normalizeVariants, normalizeCategoryIds } from '../src/features/provider-dashboard/collections/productHelpers';
import { normalizeCancellationRefundRules, buildCancellationPolicySummary } from '../src/features/provider-dashboard/service-profile/policyHelpers';
import { variantKeyOf, variantLabelOf } from '../src/features/provider-dashboard/inventory/inventoryHelpers';
import { getComboDisplayStatus } from '../src/features/provider-dashboard/combos/comboStatus';

it('preserves the immutable provider refactor baseline and equivalent stylesheet content', () => {
  const baseline = resolve(process.cwd(), '../docs/refactor-baselines/provider-dashboard-2026-09-21');
  const checksums = JSON.parse(readFileSync(resolve(baseline, 'checksums.json'), 'utf8')) as { File: string; SHA256: string }[];
  for (const entry of checksums) {
    const hash = createHash('sha256').update(readFileSync(resolve(baseline, entry.File))).digest('hex').toUpperCase();
    expect(hash).toBe(entry.SHA256);
  }
  const normalizeLineEndings = (content: Buffer) => content.toString('utf8').replace(/\r\n/g, '\n');
  expect(normalizeLineEndings(readFileSync(resolve(process.cwd(), 'src/pages/providerdashboard/providerServiceProfile.css'))))
    .toEqual(normalizeLineEndings(readFileSync(resolve(baseline, 'providerServiceProfile.css'))));
});

describe('Provider business helpers', () => {
  it('uses moderation status as the source of truth for combo visibility', () => {
    const now = new Date('2026-09-23T03:00:00Z').getTime();
    const dates = { validFrom: '2026-07-01T00:00:00Z', validTo: '2026-12-31T00:00:00Z' };

    expect(getComboDisplayStatus({ ...dates, status: 'ACTIVE' }, now)).toMatchObject({
      kind: 'active', isPubliclyVisible: true,
    });
    expect(getComboDisplayStatus({ ...dates, status: 'PENDING_REVIEW' }, now)).toMatchObject({
      kind: 'pending', isPubliclyVisible: false,
    });
    expect(getComboDisplayStatus({ ...dates, status: 'CHANGES_REQUESTED' }, now)).toMatchObject({
      kind: 'changes', isPubliclyVisible: false,
    });
    expect(getComboDisplayStatus({ ...dates, status: 'REJECTED' }, now)).toMatchObject({
      kind: 'rejected', isPubliclyVisible: false,
    });
  });

  it('does not expose active combos outside their validity window', () => {
    const now = new Date('2026-09-23T03:00:00Z').getTime();
    expect(getComboDisplayStatus({ status: 'ACTIVE', validFrom: '2026-10-01', validTo: '2026-12-31' }, now).kind).toBe('scheduled');
    expect(getComboDisplayStatus({ status: 'ACTIVE', validFrom: '2026-01-01', validTo: '2026-09-01' }, now).kind).toBe('expired');
  });

  it('uses explicit schedule timestamps before legacy date/time fields', () => {
    expect(getPhotoScheduleStartsAt({ startsAt: '2026-09-21T03:00:00Z', providerLocalDate: '2026-09-22', timeSlot: '15:00' })?.toISOString()).toBe('2026-09-21T03:00:00.000Z');
  });
  it('interprets legacy times in Vietnam including single-digit hours', () => {
    expect(getPhotoScheduleStartsAt({ providerLocalDate: '2026-09-21', timeSlot: '8:30 - 10:30' })?.toISOString()).toBe('2026-09-21T01:30:00.000Z');
    expect(getPhotoScheduleStartsAt({ scheduledDate: '2026-09-20T18:00:00Z', timeSlot: '8:30' })?.toISOString()).toBe('2026-09-21T01:30:00.000Z');
    expect(getPhotoScheduleStartsAt({ startsAt: 'invalid' })).toBeNull();
  });
  it('formats photography start times in Vietnam', () => {
    expect(formatPhotoStartTime(new Date('2026-09-21T03:00:00Z'))).toContain('10:00');
    expect(formatPhotoStartTime(new Date('2026-09-21T03:00:00Z'))).toContain('21/09/2026');
  });
  it('merges equivalent variants without dropping material or condition semantics', () => {
    expect(normalizeVariants([
      { size: ' m ', color: 'red', material: ' silk ', quantity: 2, condition: 'NEW' },
      { size: 'M', color: 'RED', material: 'SILK', quantity: 3, condition: 'GOOD' },
      { size: '', color: 'RED', material: 'SILK', quantity: 5, condition: 'GOOD' },
      { size: 'L', color: 'BLUE', material: '', quantity: 0, condition: '' },
    ])).toEqual([
      { size: 'M', color: 'RED', material: 'silk', quantity: 5, conditionStatus: 'NEW' },
      { size: 'L', color: 'BLUE', material: '', quantity: 1, conditionStatus: 'GOOD' },
    ]);
  });
  it('normalizes mixed populated category IDs', () => {
    expect(normalizeCategoryIds(['one', { _id: 'two' }, { id: 'three' }, {}])).toEqual(['one', 'two', 'three']);
    expect(normalizeCategoryIds()).toEqual([]);
  });
  it('clamps and sorts cancellation rules, filtering non-finite values', () => {
    expect(normalizeCancellationRefundRules([
      { noticeDays: -1, refundPercent: -10 }, { noticeDays: 400, refundPercent: 120 },
      { noticeDays: Number.NaN, refundPercent: 50 },
    ])).toEqual([{ noticeDays: 365, refundPercent: 100 }, { noticeDays: 0, refundPercent: 0 }]);
  });
  it('preserves cancellation summary boundaries and notes', () => {
    expect(buildCancellationPolicySummary([{ noticeDays: 7, refundPercent: 100 }, { noticeDays: 0, refundPercent: 0 }], '  Ghi chú  '))
      .toBe('Hủy trước ít nhất 7 ngày: hoàn 100% tiền cọc. Hủy dưới 7 ngày: hoàn 0% tiền cọc. Ghi chú');
  });
  it('preserves inventory request keys and display labels', () => {
    const row = { productId: 'p1', size: 'M', color: 'RED', material: 'SILK' };
    expect(variantKeyOf(row)).toEqual(row);
    expect(variantKeyOf({ ...row, material: '' })).toEqual({ productId: 'p1', size: 'M', color: 'RED' });
    expect(variantLabelOf(row)).toBe('M / Đỏ / Lụa');
    expect(getOrderGroup('unknown-status')).toBeTypeOf('string');
  });

  it('builds rental status tabs from individual áo dài items and filters their orders', () => {
    const today = new Date();
    today.setHours(23, 59, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + 2);
    const overdue = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orders = [
      {
        _id: 'booking-1',
        status: 'Đã xác nhận',
        rawStatus: 'CONFIRMED',
        items: [
          { rentalFulfillment: { status: 'PENDING' } },
          { rentalFulfillment: { status: 'PENDING' } },
          { rentalFulfillment: { status: 'READY_FOR_PICKUP' } },
          { rentalFulfillment: { status: 'READY_FOR_PICKUP', pickupEvidence: { files: ['handover.jpg'] } } },
          { rentalFulfillment: { status: 'PICKED_UP', returnDueAt: today.toISOString() } },
          { rentalFulfillment: { status: 'PICKED_UP', returnDueAt: future.toISOString() } },
          { rentalFulfillment: { status: 'PICKED_UP', returnDueAt: overdue.toISOString() } },
        ],
      },
      {
        _id: 'cancelled-booking',
        status: 'Đã hủy',
        rawStatus: 'CANCELLED',
        items: [
          { rentalFulfillment: { status: 'PENDING' } },
          { rentalFulfillment: { status: 'COMPLETED' } },
        ],
      },
    ] as any;

    expect(buildRentalOrderTabs(orders).map(({ label, count }) => ({ label, count }))).toEqual([
      { label: 'Cần soạn áo', count: 1 },
      { label: 'Chờ gửi bàn giao', count: 1 },
      { label: 'Chờ khách xác nhận', count: 1 },
      { label: 'Đang thuê', count: 1 },
      { label: 'Cần nhận hôm nay', count: 1 },
      { label: 'Quá hạn', count: 1 },
    ]);
    expect(parseRentalOrderTab(getRentalOrderTabId('RETURN_DUE_TODAY'))).toBe('RETURN_DUE_TODAY');
    expect(orderMatchesRentalFilter(orders[0], 'RETURN_DUE_TODAY')).toBe(true);
    expect(getRentalOrderMatchLabel(orders[0], 'PREPARE')).toBe('2/7 áo cần soạn');
    expect(orderMatchesRentalFilter(orders[1], 'PREPARE')).toBe(false);
    expect(orderMatchesRentalFilter(orders[1], 'OVERDUE')).toBe(false);
  });

  it('matches legacy and booking-level overdue rentals while excluding returned items', () => {
    const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const legacyOverdueOrder = {
      _id: 'legacy-overdue',
      bookingType: 'AODAI_RENTAL',
      status: 'Đang thuê',
      rawStatus: 'PICKED_UP',
      items: [
        { itemType: 'PRODUCT', rentalTo: pastDate },
      ],
    } as any;
    const statusOverdueOrder = {
      _id: 'status-overdue',
      bookingType: 'COMBO',
      status: 'Quá hạn trả',
      rawStatus: 'OVERDUE',
      items: [
        { itemType: 'PRODUCT', rentalTo: pastDate, rentalFulfillment: { status: 'PENDING' } },
      ],
    } as any;
    const returnedItemOrder = {
      _id: 'returned-item-overdue-booking',
      bookingType: 'AODAI_RENTAL',
      status: 'Đang thuê',
      rawStatus: 'PICKED_UP',
      items: [
        { itemType: 'PRODUCT', rentalTo: pastDate, rentalFulfillment: { status: 'RETURNED' } },
      ],
    } as any;

    expect(orderMatchesRentalFilter(legacyOverdueOrder, 'OVERDUE')).toBe(true);
    expect(orderMatchesRentalFilter(statusOverdueOrder, 'OVERDUE')).toBe(true);
    expect(orderMatchesRentalFilter(returnedItemOrder, 'OVERDUE')).toBe(false);
    expect(getRentalOrderMatchLabel(legacyOverdueOrder, 'OVERDUE')).toBe('1/1 áo quá hạn');

    const tabs = buildRentalOrderTabs([legacyOverdueOrder, statusOverdueOrder, returnedItemOrder]);
    expect(tabs.find((t) => t.label === 'Quá hạn')?.count).toBe(2);
  });
});
