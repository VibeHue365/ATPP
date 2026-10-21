import { fireEvent, render } from '@testing-library/react-native';
import { AppButton } from '@/components/ui/AppButton';
import { ListPagination } from '@/components/ui/ListPagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { StatusBadge } from '@/components/ui/StatusBadge';

describe('mobile UI primitives', () => {
  it('renders and presses an enabled application button', async () => {
    const onPress = jest.fn();
    const view = await render(<AppButton title="Đặt lịch" onPress={onPress} />);
    await fireEvent.press(view.getByRole('button', { name: 'Đặt lịch' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('marks a loading button busy and unavailable', async () => {
    const onPress = jest.fn();
    const view = await render(<AppButton title="Thanh toán" loading onPress={onPress} />);
    const button = view.getByRole('button', { name: 'Thanh toán' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders status text for the selected tone', async () => {
    const view = await render(<StatusBadge label="Đã xác nhận" tone="success" />);
    expect(view.getByText('Đã xác nhận')).toBeTruthy();
  });

  it('hides pagination when only one page exists', async () => {
    const view = await render(<ListPagination page={1} totalPages={1} onChange={jest.fn()} />);
    expect(view.toJSON()).toBeNull();
  });

  it('moves between pages and respects boundary buttons', async () => {
    const onChange = jest.fn();
    const view = await render(<ListPagination page={2} totalPages={3} onChange={onChange} />);
    await fireEvent.press(view.getByText('‹ Trước'));
    await fireEvent.press(view.getByText('Sau ›'));
    expect(onChange).toHaveBeenNthCalledWith(1, 1);
    expect(onChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('renders a loading state with supplied copy', async () => {
    const loading = await render(<LoadingState label="Đang tải booking..." />);
    expect(loading.getByText('Đang tải booking...')).toBeTruthy();
  });

  it('renders an empty state with supplied copy', async () => {
    const empty = await render(<EmptyState title="Chưa có booking" message="Hãy đặt dịch vụ đầu tiên." />);
    expect(empty.getByText('Chưa có booking')).toBeTruthy();
    expect(empty.getByText('Hãy đặt dịch vụ đầu tiên.')).toBeTruthy();
  });

  it('invokes retry from an error state', async () => {
    const retry = jest.fn();
    const view = await render(<ErrorState message="Mất kết nối" onRetry={retry} />);
    expect(view.getByText('Mất kết nối')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
