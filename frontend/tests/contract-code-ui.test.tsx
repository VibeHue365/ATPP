import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  ContractCodeDisplay,
  truncateContractCode,
} from '../src/components/contracts/ContractCodeDisplay';
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

describe('Contract Code Display & UI/UX Truncation Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('1. truncateContractCode helper unit tests', () => {
    it('truncates standard long V2 contract code to exact head(9)...tail(5) format', () => {
      const longCode = 'V2-6AF36204733255BA51765303-6A5DD0CF48A10617899BF1D6';
      const result = truncateContractCode(longCode, 9, 5);
      expect(result).toBe('V2-6AF362...BF1D6');
    });

    it('preserves short contract codes without truncation', () => {
      expect(truncateContractCode('HD-123456')).toBe('HD-123456');
      expect(truncateContractCode('V2-SHORT-01')).toBe('V2-SHORT-01');
      expect(truncateContractCode('1234567890123456')).toBe('1234567890123456');
    });

    it('returns fallback "---" when code is null, undefined, or empty', () => {
      expect(truncateContractCode(null)).toBe('---');
      expect(truncateContractCode(undefined)).toBe('---');
      expect(truncateContractCode('')).toBe('---');
      expect(truncateContractCode('   ')).toBe('---');
    });

    it('respects custom headLength and tailLength thresholds', () => {
      const code = 'ABCDEF123456789XYZ';
      const result = truncateContractCode(code, 4, 3);
      expect(result).toBe('ABCD...XYZ');
    });
  });

  describe('2. ContractCodeDisplay component tests', () => {
    it('renders label, truncated text, and copy button for long code', () => {
      const longCode = 'V2-6AF36204733255BA51765303-6A5DD0CF48A10617899BF1D6';

      render(<ContractCodeDisplay code={longCode} testId="test-contract" />);

      // Label is rendered
      expect(screen.getByText('Mã hợp đồng:')).toBeDefined();

      // Truncated code is rendered
      const codeEl = screen.getByTestId('test-contract-code');
      expect(codeEl.textContent).toBe('V2-6AF362...BF1D6');
      expect(codeEl.getAttribute('title')).toBe(`Mã đầy đủ: ${longCode}`);

      // Copy button is rendered
      const copyBtn = screen.getByTestId('test-contract-copy-btn');
      expect(copyBtn).toBeDefined();
    });

    it('copies exact full code to clipboard and shows temporary confirmation feedback', async () => {
      const longCode = 'V2-6AF36204733255BA51765303-6A5DD0CF48A10617899BF1D6';
      const writeTextMock = vi.fn().mockResolvedValue(undefined);

      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(<ContractCodeDisplay code={longCode} testId="copy-test" />);

      const copyBtn = screen.getByTestId('copy-test-copy-btn');
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith(longCode);
      });

      // Shows 'Đã chép' feedback
      expect(screen.getByText('Đã chép')).toBeDefined();
    });

    it('renders graceful fallback when code is missing and hides copy button', () => {
      render(<ContractCodeDisplay code={null} testId="null-test" />);

      const codeEl = screen.getByTestId('null-test-code');
      expect(codeEl.textContent).toBe('---');
      expect(screen.queryByTestId('null-test-copy-btn')).toBeNull();
    });
  });

  describe('3. ProfileContractsTab Card decoupling and presentation', () => {
    const longCodeSample: CustomerContractItem = {
      contractId: 'contract-long-001',
      contractCode: 'V2-6AF36204733255BA51765303-6A5DD0CF48A10617899BF1D6',
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

    const detailedSample: CustomerContractItem = {
      contractId: 'contract-detailed-002',
      contractCode: 'V2-6AF357AF32464A1A5E9DA486-6A5DD0CF48A10617899BF1D6',
      bookingId: 'booking-002',
      bookingCode: 'B3245746123',
      bookingStatus: 'CANCELLED',
      bookingCreatedAt: '2026-11-09T08:00:00Z',
      providerId: 'provider-001',
      providerName: 'Tiệm Cổ Phục Lạc',
      scope: 'AO_DAI_RENTAL',
      legacyStatus: 'ACCEPTED',
      versionId: 'version-002',
      version: 2,
      state: 'ACCEPTED',
      contentHash: 'hash002',
      bookingFingerprint: 'bfp002',
      presentationMode: 'DETAILED',
      isSigned: true,
      hasPdf: true,
    };

    it('decouples contract title from code and shows clean readable structure for QUICK contract', async () => {
      vi.mocked(contractService.getMyContracts).mockResolvedValue([longCodeSample]);

      render(<ProfileContractsTab />);

      await waitFor(() => {
        expect(screen.getByTestId('active-contracts-count').textContent).toBe('1');
      });

      // Title is decoupled and clean (NO UUID in title)
      const titleEl = screen.getByTestId('contract-title-contract-long-001');
      expect(titleEl.textContent).toBe('Thỏa thuận thuê nhanh');
      expect(titleEl.textContent).not.toContain('6AF36204733255BA51765303');

      // Tag QUICK is next to title
      expect(screen.getByText('QUICK')).toBeDefined();

      // Contract code is on its own row, truncated cleanly with copy button
      const codeEl = screen.getByTestId('contract-code-contract-long-001-code');
      expect(codeEl.textContent).toBe('V2-6AF362...BF1D6');
      expect(screen.getByTestId('contract-code-contract-long-001-copy-btn')).toBeDefined();

      // Partner and version on dedicated metadata row
      expect(screen.getByText('Áo Dài Huế Xưa')).toBeDefined();
      expect(screen.getByText(/Phiên bản/)).toBeDefined();
    });

    it('decouples contract title from code for A4 DETAILED contract in history tab', async () => {
      vi.mocked(contractService.getMyContracts).mockResolvedValue([detailedSample]);

      render(<ProfileContractsTab />);

      await waitFor(() => {
        expect(screen.getByTestId('history-contracts-count').textContent).toBe('1');
      });

      // Switch to history tab
      fireEvent.click(screen.getByTestId('subtab-history'));

      await waitFor(() => {
        expect(screen.getByTestId('contract-title-contract-detailed-002')).toBeDefined();
      });

      // Title is 'Hợp đồng điện tử' without UUID
      const titleEl = screen.getByTestId('contract-title-contract-detailed-002');
      expect(titleEl.textContent).toBe('Hợp đồng điện tử');
      expect(titleEl.textContent).not.toContain('6AF357AF32464A1A5E9DA486');

      // Tag A4 CHI TIẾT
      expect(screen.getByText('A4 CHI TIẾT')).toBeDefined();

      // Code truncated
      const codeEl = screen.getByTestId('contract-code-contract-detailed-002-code');
      expect(codeEl.textContent).toBe('V2-6AF357...BF1D6');
      expect(screen.getByTestId('contract-code-contract-detailed-002-copy-btn')).toBeDefined();
    });
  });
});
