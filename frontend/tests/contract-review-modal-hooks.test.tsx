import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { ContractReviewModal } from '../src/components/contracts/ContractReviewModal';
import { contractService } from '../src/services/contractService';

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => mockToast,
}));

vi.mock('../src/services/contractService', () => ({
  contractService: {
    getBookingReadiness: vi.fn(),
    getContractDetail: vi.fn(),
    submitConsent: vi.fn(),
    refreshContracts: vi.fn(),
    downloadPdfBlob: vi.fn(),
  },
}));

vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
}));

describe('ContractReviewModal Hooks Lifecycle and Safety Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockBookingId = 'booking-test-777';

  const mockReadinessV1 = {
    requirement: 'REQUIRED' as const,
    bookingId: mockBookingId,
    providers: [
      {
        providerId: 'provider-001',
        contractId: 'contract-001',
        versionId: 'version-v1',
        version: 1,
        status: 'AWAITING_CUSTOMER' as const,
      },
    ],
    blockers: ['CONTRACT_NOT_ACCEPTED'],
    ready: false,
  };

  const mockContractDetailV1 = {
    contractId: 'contract-001',
    bookingId: mockBookingId,
    providerId: 'provider-001',
    scope: 'AUTO_ACCEPTANCE',
    legacyStatus: 'AWAITING_CUSTOMER',
    versionId: 'version-v1',
    version: 1,
    state: 'PROPOSED',
    versionState: 'PROPOSED',
    contentHash: 'hash-v1-abcdef1234567890',
    bookingFingerprint: 'fingerprint-v1-abcdef1234567890',
    renderedText: 'Điều khoản hợp đồng phiên bản 1',
  };

  const mockReadinessV2 = {
    ...mockReadinessV1,
    providers: [
      {
        ...mockReadinessV1.providers[0],
        versionId: 'version-v2',
        version: 2,
      },
    ],
  };

  const mockContractDetailV2 = {
    ...mockContractDetailV1,
    versionId: 'version-v2',
    version: 2,
    contentHash: 'hash-v2-1111222233334444',
    renderedText: 'Điều khoản hợp đồng phiên bản 2 đã cập nhật',
  };

  it('1. render modal với isOpen=false -> rerender isOpen=true không crash, gọi fetch contract 1 lần', async () => {
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue(mockReadinessV1);
    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetailV1);

    const { rerender } = render(
      <ContractReviewModal
        isOpen={false}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    // Modal is closed: should render nothing, and NOT call contractService
    expect(screen.queryByTestId('contract-review-modal')).toBeNull();
    expect(contractService.getBookingReadiness).not.toHaveBeenCalled();

    // Rerender with isOpen=true
    rerender(
      <ContractReviewModal
        isOpen={true}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    // Modal opens without hook crash
    await waitFor(() => {
      expect(screen.getByTestId('contract-review-modal')).toBeDefined();
    });

    await waitFor(() => {
      expect(contractService.getBookingReadiness).toHaveBeenCalledTimes(1);
      expect(contractService.getContractDetail).toHaveBeenCalledWith('contract-001');
    });

    expect(screen.getByText(/Điều khoản hợp đồng phiên bản 1/)).toBeDefined();
  });

  it('2. render isOpen=true -> isOpen=false -> isOpen=true không bị lỗi hooks', async () => {
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue(mockReadinessV1);
    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetailV1);

    const { rerender } = render(
      <ContractReviewModal
        isOpen={true}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('contract-review-modal')).toBeDefined();
    });

    // Close the modal
    rerender(
      <ContractReviewModal
        isOpen={false}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('contract-review-modal')).toBeNull();

    // Reopen the modal: hook order remains invariant
    rerender(
      <ContractReviewModal
        isOpen={true}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('contract-review-modal')).toBeDefined();
    });
    expect(screen.getByText(/Điều khoản hợp đồng phiên bản 1/)).toBeDefined();
  });

  it('3. đổi currentContract.versionId reset hasAgreed và refreshNotice', async () => {
    vi.mocked(contractService.getBookingReadiness)
      .mockResolvedValueOnce(mockReadinessV1)
      .mockResolvedValue(mockReadinessV2);
    vi.mocked(contractService.getContractDetail)
      .mockResolvedValueOnce(mockContractDetailV1)
      .mockResolvedValue(mockContractDetailV2);

    const TestWrapper = () => {
      const [bookingId, setBookingId] = useState('booking-1');
      return (
        <div>
          <button onClick={() => setBookingId('booking-2')}>Đổi booking</button>
          <ContractReviewModal
            isOpen={true}
            bookingId={bookingId}
            onClose={vi.fn()}
            onAllAccepted={vi.fn()}
          />
        </div>
      );
    };

    render(<TestWrapper />);

    await waitFor(() => {
      expect(screen.getByText(/Điều khoản hợp đồng phiên bản 1/)).toBeDefined();
    });

    // Check the checkbox
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    // Switch booking, triggering a new version to load
    fireEvent.click(screen.getByText('Đổi booking'));

    await waitFor(() => {
      expect(screen.getByText(/Điều khoản hợp đồng phiên bản 2 đã cập nhật/)).toBeDefined();
    });

    // Verify checkbox is reset back to false on new version
    await waitFor(() => {
      const updatedCheckbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(updatedCheckbox.checked).toBe(false);
    });
  });
});
