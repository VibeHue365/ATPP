import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ProfileContractsTab } from '../src/features/profile/components/tabs/ProfileContractsTab';
import { contractService } from '../src/services/contractService';
import type { CustomerContractItem } from '../src/services/contractService';

// Mock SweetAlert2
vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn().mockResolvedValue({ isConfirmed: true }),
  },
}));

// Mock ContractDetailViewerModal
vi.mock('../src/components/contracts/ContractDetailViewerModal', () => ({
  ContractDetailViewerModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="mock-contract-detail-modal">
        <span>Modal Hợp đồng</span>
        <button type="button" onClick={onClose} data-testid="close-detail-modal-btn">
          Đóng
        </button>
      </div>
    ) : null,
}));

// Mock contractService
vi.mock('../src/services/contractService', () => ({
  contractService: {
    getMyContracts: vi.fn(),
    triggerPdfDownload: vi.fn(),
  },
}));

// Mock feature flag
vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
}));

describe('ProfileContractsTab - Customer Contract History & Cancelled Booking UX (TC-01 -> TC-09, TC-14)', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const sampleConfirmedContract: CustomerContractItem = {
    contractId: 'contract-confirmed-001',
    contractCode: 'V2-B001-P001',
    bookingId: 'booking-001',
    bookingCode: 'B3523589235',
    bookingStatus: 'CONFIRMED',
    bookingCreatedAt: '2026-11-10T10:00:00Z',
    providerId: 'provider-001',
    providerName: 'Áo Dài Huế Xưa',
    scope: 'AO_DAI_RENTAL',
    legacyStatus: 'ACCEPTED',
    versionId: 'version-001',
    version: 1,
    state: 'ACCEPTED',
    contentHash: 'hash001',
    bookingFingerprint: 'bfp001',
    presentationMode: 'QUICK',
    isSigned: true,
    hasPdf: true,
  };

  const sampleCancelledSignedContract: CustomerContractItem = {
    contractId: 'contract-cancelled-signed-002',
    contractCode: 'V2-B002-P001',
    bookingId: 'booking-002',
    bookingCode: 'B3245746123',
    bookingStatus: 'CANCELLED',
    bookingCreatedAt: '2026-11-09T08:00:00Z',
    providerId: 'provider-001',
    providerName: 'Áo Dài Huế Xưa',
    scope: 'AO_DAI_RENTAL',
    legacyStatus: 'ACCEPTED',
    versionId: 'version-002',
    version: 1,
    state: 'ACCEPTED',
    contentHash: 'hash002',
    bookingFingerprint: 'bfp002',
    presentationMode: 'DETAILED',
    isSigned: true,
    hasPdf: true,
  };

  const sampleReturnedContract: CustomerContractItem = {
    contractId: 'contract-returned-003',
    contractCode: 'V2-B003-P001',
    bookingId: 'booking-003',
    bookingCode: 'B1193706613',
    bookingStatus: 'RETURNED',
    bookingCreatedAt: '2026-11-05T09:00:00Z',
    providerId: 'provider-001',
    providerName: 'Áo Dài Huế Xưa',
    scope: 'AO_DAI_RENTAL',
    legacyStatus: 'ACCEPTED',
    versionId: 'version-003',
    version: 1,
    state: 'ACCEPTED',
    contentHash: 'hash003',
    bookingFingerprint: 'bfp003',
    presentationMode: 'DETAILED',
    isSigned: true,
    hasPdf: true,
  };

  // TC-06: CONFIRMED + ACCEPTED → hiển thị bình thường trong tab "Hợp đồng hiện hành"
  it('TC-06: Displays active CONFIRMED contract under "Hợp đồng hiện hành"', async () => {
    vi.mocked(contractService.getMyContracts).mockResolvedValue([sampleConfirmedContract]);

    render(<ProfileContractsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-contracts-tab')).toBeDefined();
    });

    // Check count in active subtab badge
    await waitFor(() => {
      expect(screen.getByTestId('active-contracts-count').textContent).toBe('1');
      expect(screen.getByTestId('history-contracts-count').textContent).toBe('0');
    });

    // Contract card is displayed
    expect(screen.getByTestId('contract-item-card-contract-confirmed-001')).toBeDefined();
    expect(screen.getByText('Đơn hàng #B3523589235')).toBeDefined();
    expect(screen.getByTestId('booking-status-badge-contract-confirmed-001').textContent).toBe('ĐÃ XÁC NHẬN');
    expect(screen.getByTestId('contract-status-badge-contract-confirmed-001').textContent).toContain('Đã ghi nhận chấp thuận');
    expect(screen.getByText('Áo Dài Huế Xưa')).toBeDefined();
    expect(screen.getByTestId('view-contract-btn-contract-confirmed-001')).toBeDefined();
    expect(screen.getByTestId('download-pdf-btn-contract-confirmed-001')).toBeDefined();
  });

  // TC-01 & TC-02: CANCELLED + unaccepted (DRAFT or OFFERED) are filtered out from default active list
  it('TC-01 & TC-02: CANCELLED booking without signed contract is not present in active or history tab', async () => {
    // If backend returns contracts, only signed ones are included; but even if an unsigned cancelled one leaked,
    // frontend filters it out:
    const leakedCancelledUnsigned: CustomerContractItem = {
      contractId: 'contract-leaked-004',
      contractCode: 'V2-B004-P001',
      bookingId: 'booking-004',
      bookingCode: 'B3512099321',
      bookingStatus: 'CANCELLED',
      providerId: 'provider-001',
      scope: 'AO_DAI_RENTAL',
      legacyStatus: 'DRAFT',
      versionId: 'version-004',
      version: 1,
      state: 'OFFERED',
      contentHash: 'hash004',
      bookingFingerprint: 'bfp004',
      isSigned: false, // Never signed!
    };

    vi.mocked(contractService.getMyContracts).mockResolvedValue([leakedCancelledUnsigned]);

    render(<ProfileContractsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-contracts-tab')).toBeDefined();
    });

    // Neither active nor history should show this unaccepted cancelled contract
    expect(screen.getByTestId('active-contracts-count').textContent).toBe('0');
    expect(screen.getByTestId('history-contracts-count').textContent).toBe('0');
    expect(screen.queryByTestId('contract-item-card-contract-leaked-004')).toBeNull();
    expect(screen.getByTestId('no-contracts-message')).toBeDefined();
  });

  // TC-03: CANCELLED + ACCEPTED → hiện trong lịch sử, PDF tải được
  it('TC-03: CANCELLED + ACCEPTED contract appears in "Lịch sử / Đơn đã hủy" with distinct cancelled tag and PDF download button', async () => {
    vi.mocked(contractService.getMyContracts).mockResolvedValue([
      sampleConfirmedContract,
      sampleCancelledSignedContract,
    ]);

    render(<ProfileContractsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('active-contracts-count').textContent).toBe('1');
      expect(screen.getByTestId('history-contracts-count').textContent).toBe('1');
    });

    // Switch to "Lịch sử / Đơn đã hủy" tab
    fireEvent.click(screen.getByTestId('subtab-history'));

    await waitFor(() => {
      expect(screen.getByTestId('contract-item-card-contract-cancelled-signed-002')).toBeDefined();
    });

    expect(screen.getByText('Đơn hàng #B3245746123')).toBeDefined();
    expect(screen.getByTestId('booking-status-badge-contract-cancelled-signed-002').textContent).toBe('ĐƠN ĐÃ HỦY');
    expect(screen.getByTestId('contract-status-badge-contract-cancelled-signed-002').textContent).toContain('Đã ký trước khi đơn bị hủy');
    expect(screen.getByTestId('download-pdf-btn-contract-cancelled-signed-002')).toBeDefined();
  });

  // TC-04 & TC-05: CANCELLED + EFFECTIVE / TERMINATED appear in history
  it('TC-04 & TC-05: Retains historical contracts with EFFECTIVE or TERMINATED states under history', async () => {
    const terminatedContract: CustomerContractItem = {
      ...sampleCancelledSignedContract,
      contractId: 'contract-term-005',
      state: 'TERMINATED',
      isSigned: true,
    };

    vi.mocked(contractService.getMyContracts).mockResolvedValue([terminatedContract]);

    render(<ProfileContractsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('history-contracts-count').textContent).toBe('1');
    });

    fireEvent.click(screen.getByTestId('subtab-history'));

    await waitFor(() => {
      expect(screen.getByTestId('contract-item-card-contract-term-005')).toBeDefined();
    });
  });

  // TC-07: RETURNED/COMPLETED + hợp đồng hợp lệ → hiển thị theo đúng nhóm lịch sử
  it('TC-07: RETURNED completed booking contract appears under "Lịch sử / Đơn đã hủy"', async () => {
    vi.mocked(contractService.getMyContracts).mockResolvedValue([sampleReturnedContract]);

    render(<ProfileContractsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('active-contracts-count').textContent).toBe('0');
      expect(screen.getByTestId('history-contracts-count').textContent).toBe('1');
    });

    fireEvent.click(screen.getByTestId('subtab-history'));

    await waitFor(() => {
      expect(screen.getByTestId('contract-item-card-contract-returned-003')).toBeDefined();
    });

    expect(screen.getByTestId('booking-status-badge-contract-returned-003').textContent).toBe('ĐÃ HOÀN TẤT');
  });

  // TC-08: Booking không yêu cầu hợp đồng → danh sách rỗng, render empty state duy nhất
  it('TC-08: When customer has no contracts, shows clean single empty state and explore button', async () => {
    vi.mocked(contractService.getMyContracts).mockResolvedValue([]);
    const onNavigateRental = vi.fn();

    render(<ProfileContractsTab onNavigateRental={onNavigateRental} />);

    await waitFor(() => {
      expect(screen.getByTestId('no-contracts-message')).toBeDefined();
    });

    expect(screen.getByText('Chưa có hợp đồng nào đang có hiệu lực')).toBeDefined();
    const exploreBtn = screen.getByTestId('explore-rental-btn');
    fireEvent.click(exploreBtn);
    expect(onNavigateRental).toHaveBeenCalledTimes(1);
  });

  // TC-09: API lỗi → hiển thị thông báo lỗi, không giả vờ không có hợp đồng
  it('TC-09: When API fails, shows error message with retry button and does not swallow error', async () => {
    vi.mocked(contractService.getMyContracts).mockRejectedValue(new Error('DATABASE_CONNECTION_ERROR'));

    render(<ProfileContractsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('contracts-error-alert')).toBeDefined();
    });

    expect(screen.getByText('DATABASE_CONNECTION_ERROR')).toBeDefined();
    expect(screen.queryByTestId('no-contracts-message')).toBeNull();
  });

  // TC-14: Switching tabs does not leak invalid cards or alter state improperly
  it('TC-14: Switching between "Hiện hành" and "Lịch sử" renders exact partitioned subsets without flash or leaks', async () => {
    vi.mocked(contractService.getMyContracts).mockResolvedValue([
      sampleConfirmedContract,
      sampleCancelledSignedContract,
      sampleReturnedContract,
    ]);

    render(<ProfileContractsTab />);

    // Initially on "Hiện hành"
    await waitFor(() => {
      expect(screen.getByTestId('contract-item-card-contract-confirmed-001')).toBeDefined();
    });
    expect(screen.queryByTestId('contract-item-card-contract-cancelled-signed-002')).toBeNull();
    expect(screen.queryByTestId('contract-item-card-contract-returned-003')).toBeNull();

    // Click "Lịch sử / Đơn đã hủy"
    fireEvent.click(screen.getByTestId('subtab-history'));

    await waitFor(() => {
      expect(screen.getByTestId('contract-item-card-contract-cancelled-signed-002')).toBeDefined();
      expect(screen.getByTestId('contract-item-card-contract-returned-003')).toBeDefined();
    });
    expect(screen.queryByTestId('contract-item-card-contract-confirmed-001')).toBeNull();

    // Click back to "Hiện hành"
    fireEvent.click(screen.getByTestId('subtab-active'));

    await waitFor(() => {
      expect(screen.getByTestId('contract-item-card-contract-confirmed-001')).toBeDefined();
    });
    expect(screen.queryByTestId('contract-item-card-contract-cancelled-signed-002')).toBeNull();
  });
});
