import { render } from '@testing-library/react-native';
import { BookingFlowStepper } from '@/components/booking/BookingFlowStepper';

describe('BookingFlowStepper', () => {
  it('renders 6 steps and shows Bước 1/6 on PENDING_PAYMENT rental booking (no Bước 0/5 bug)', async () => {
    const view = await render(
      <BookingFlowStepper
        bookingType="AODAI_RENTAL"
        status="PENDING_PAYMENT"
        variant="customer"
      />,
    );

    expect(view.getByText('Bước 1/6')).toBeTruthy();
    expect(view.getByText('Ký HĐ & TT')).toBeTruthy();
    expect(
      view.getByText(/Hợp đồng điện tử.*thanh toán PayOS/i),
    ).toBeTruthy();
  });

  it('shows warning guidance note for RETURN_PENDING incident state', async () => {
    const view = await render(
      <BookingFlowStepper
        bookingType="AODAI_RENTAL"
        status="RETURN_PENDING"
        variant="customer"
      />,
    );

    expect(view.getByText('Bước 4/6')).toBeTruthy();
    expect(view.getByText(/báo cáo sự cố lúc trả đồ/i)).toBeTruthy();
  });

  it('shows cancellation banner for CANCELLED booking', async () => {
    const view = await render(
      <BookingFlowStepper
        bookingType="AODAI_RENTAL"
        status="CANCELLED"
        variant="provider"
      />,
    );

    expect(view.getByText('Đơn hàng đã hủy')).toBeTruthy();
  });
});
