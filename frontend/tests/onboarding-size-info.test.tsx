import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OnboardingPage } from '../src/pages/onboarding/OnboardingPage';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), navigate: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../src/services/httpClient', () => ({ httpClient: { get: mocks.get } }));
vi.mock('../src/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ updatePreferences: mocks.update }) }));
vi.mock('../src/components/feedback/Toast', () => ({ useToast: () => mocks.toast }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.update.mockResolvedValue(undefined); mocks.get.mockResolvedValue({ preferences: {
  preferredAoDaiStyles: ['TRADITIONAL'], preferredOccasions: ['WEDDING'],
  sizeInfo: { preferredSize: 'M', height: 165, weight: 55, chest: 90, waist: 72, hip: 96, fitPreference: 'REGULAR' },
} }); });

it('loads existing measurements, edits them and persists only explicit circumference values', async () => {
  render(<OnboardingPage />);
  await waitFor(() => expect((screen.getByRole('button', { name: /Tiếp tục/ }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: /Tiếp tục/ }));
  const chest = await screen.findByDisplayValue('90');
  fireEvent.change(chest, { target: { value: '91.5' } });
  fireEvent.change(screen.getByLabelText('Sở thích mặc'), { target: { value: 'COMFORT' } });
  fireEvent.click(screen.getByRole('button', { name: /Tiếp tục/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Hoàn tất/ }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ preferences: expect.objectContaining({ sizeInfo: {
    preferredSize: 'M', height: 165, weight: 55, chest: 91.5, waist: 72, hip: 96, shoulder: null, bicep: null, fitPreference: 'COMFORT',
  } }) })));
});

it('does not infer missing circumferences from legacy height and weight', async () => {
  mocks.get.mockResolvedValue({ preferences: { preferredAoDaiStyles: ['TRADITIONAL'], sizeInfo: { height: 165, weight: 55, preferredSize: 'M' } } });
  render(<OnboardingPage />);
  await waitFor(() => expect((screen.getByRole('button', { name: /Tiếp tục/ }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: /Tiếp tục/ }));
  await screen.findByDisplayValue('165');
  const fields = screen.getAllByRole('spinbutton') as HTMLInputElement[];
  expect(fields.map(field => field.value)).toEqual(['165', '55', '', '', '', '', '']);
  expect(screen.queryByText(/Kích thước và size đã chọn phù hợp/)).toBeNull();
});
