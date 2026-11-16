import type { NotificationItem } from '@/types/notification';
import { formatNotification } from '@/utils/notificationFormatter';

const makeNotification = (
  overrides: Partial<NotificationItem> = {},
): NotificationItem => ({
  _id: 'notif-1',
  title: 'Cập nhật đơn hàng',
  content: 'Thông báo từ hệ thống',
  type: 'BOOKING',
  isRead: false,
  createdAt: '2026-11-15T10:00:00.000Z',
  ...overrides,
});

describe('formatNotification', () => {
  it('translates raw BE status transitions like PICKUP_PENDING to Vietnamese', () => {
    const formatted = formatNotification(
      makeNotification({
        content:
          'Đơn hàng VH-9912 của bạn đã chuyển sang trạng thái: PICKUP_PENDING',
        metadata: { bookingId: 'bk-123' },
      }),
    );

    expect(formatted.statusCode).toBe('PICKUP_PENDING');
    expect(formatted.category).toBe('HANDOVER');
    expect(formatted.title).toBe('Cổ phục đã sẵn sàng bàn giao');
    expect(formatted.content).toContain('Đơn #VH-9912');
    expect(formatted.content).not.toContain('PICKUP_PENDING');
    expect(formatted.actionRequired).toBe(true);
    expect(formatted.bookingId).toBe('bk-123');
  });

  it('translates RETURN_PENDING and COMPLETED accurately', () => {
    const incident = formatNotification(
      makeNotification({
        content: 'Đơn hàng VH-404 cập nhật trạng thái: RETURN_PENDING',
        metadata: { bookingId: 'bk-404' },
      }),
    );
    expect(incident.category).toBe('DISPUTE');
    expect(incident.title).toBe('Cần xác nhận biên bản sự cố trả đồ');
    expect(incident.actionRequired).toBe(true);

    const completed = formatNotification(
      makeNotification({
        content: 'Đơn #VH-555 chuyển trạng thái: COMPLETED',
      }),
    );
    expect(completed.category).toBe('REFUND');
    expect(completed.title).toBe('Hoàn tất đơn & Giải phóng cọc');
    expect(completed.actionRequired).toBe(false);
  });

  it('supports metadata.newStatus and contract notifications', () => {
    const byMeta = formatNotification(
      makeNotification({
        content: 'Hợp đồng cần xác nhận',
        metadata: {
          bookingId: 'bk-888',
          bookingCode: 'VH-888',
          newStatus: 'PENDING_PAYMENT',
        },
      }),
    );
    expect(byMeta.category).toBe('CONTRACT');
    expect(byMeta.content).toContain('Đơn #VH-888');
    expect(byMeta.actionRequired).toBe(true);

    const contractDoc = formatNotification(
      makeNotification({
        type: 'CONTRACT_SIGNED',
        title: 'Đã ký Hợp đồng điện tử',
        content: 'Bản PDF hợp đồng đã sẵn sàng.',
        metadata: { contractId: 'ct-1', bookingId: 'bk-888' },
      }),
    );
    expect(contractDoc.category).toBe('CONTRACT');
    expect(contractDoc.contractId).toBe('ct-1');
  });

  it('formats WEATHER notifications with dedicated category, icon and actionRequired flag', () => {
    const alert = formatNotification(
      makeNotification({
        type: 'WEATHER',
        title: 'Cảnh báo thời tiết xấu',
        content: 'Dự báo mưa lớn tại Đại Nội. Hãy chọn Plan B để đổi lịch chụp.',
        metadata: { bookingId: 'bk-weather-1' },
      }),
    );

    expect(alert.category).toBe('WEATHER');
    expect(alert.categoryLabel).toBe('THỜI TIẾT');
    expect(alert.icon).toBe('cloud-outline');
    expect(alert.actionRequired).toBe(true);
    expect(alert.bookingId).toBe('bk-weather-1');

    const info = formatNotification(
      makeNotification({
        type: 'WEATHER',
        title: 'Hoàn tất cập nhật điểm chụp',
        content: 'Lịch chụp mới đã được cập nhật thuận lợi.',
      }),
    );
    expect(info.category).toBe('WEATHER');
    expect(info.actionRequired).toBe(false);
  });
});
