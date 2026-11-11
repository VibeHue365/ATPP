import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BookingContractsSection } from '../src/components/contracts/BookingContractsSection';
import { ProfileContractsTab } from '../src/features/profile/components/tabs/ProfileContractsTab';
import { contractService } from '../src/services/contractService';
import { httpClient } from '../src/services/httpClient';

// Mock Toast
vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

// Mock feature flag to OFF
vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: false,
}));

vi.mock('../src/services/contractService', () => ({
  contractService: {
    listContractsForBooking: vi.fn(),
  },
}));

vi.mock('../src/services/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
  },
}));

describe('Phase 7B: Contract Management Feature Flag Fail-Closed Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('BookingContractsSection returns null and makes zero API calls when flag is OFF', async () => {
    const { container } = render(
      <BookingContractsSection bookingId="booking_flag_off_01" viewerRole="customer" />,
    );

    expect(container.firstChild).toBeNull();
    expect(contractService.listContractsForBooking).not.toHaveBeenCalled();
  });

  it('ProfileContractsTab renders disabled fallback notice without making contract API calls when flag is OFF', async () => {
    render(<ProfileContractsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('contracts-v2-disabled')).toBeTruthy();
    });

    expect(screen.getByText(/Tính năng Hợp đồng Điện tử đang tạm tắt/i)).toBeTruthy();
    expect(contractService.listContractsForBooking).not.toHaveBeenCalled();
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});
