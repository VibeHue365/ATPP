import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ProviderContractStatusCard } from '../src/features/provider-dashboard/service-profile/ProviderContractStatusCard';
import { contractService } from '../src/services/contractService';

// Mock contractService
vi.mock('../src/services/contractService', () => ({
  contractService: {
    getProviderMechanism: vi.fn(),
    getProviderAcceptanceStatus: vi.fn(),
    acceptProviderMechanism: vi.fn(),
    revokeProviderAcceptance: vi.fn(),
  },
}));

// Mock feature flag module
vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
}));

describe('Provider Self-Acceptance UI Suite (P1A)', () => {
  const draftMechanism = {
    version: 'auto-acceptance-v1',
    status: 'DRAFT' as const,
    approvedAt: null,
    regulationCode: 'QC-VIBEHUE-2026-V1',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    description: 'Quy chế DRAFT chưa được phê duyệt.',
  };

  const approvedMechanism = {
    version: 'auto-acceptance-v1',
    status: 'APPROVED' as const,
    approvedAt: '2026-10-31T00:00:00.000Z',
    regulationCode: 'QC-VIBEHUE-2026-V1',
    hash: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
    description: 'Quy chế hoạt động sàn giao dịch VibeHue đã được phê duyệt.',
  };

  const notAcceptedStatus = {
    providerId: 'provider_123',
    scope: 'AO_DAI_RENTAL',
    status: 'NOT_ACCEPTED' as const,
    active: null,
  };

  const activeStatus = {
    providerId: 'provider_123',
    scope: 'AO_DAI_RENTAL',
    status: 'ACTIVE' as const,
    active: {
      id: 'acceptance_abc',
      mechanismVersion: 'auto-acceptance-v1',
      templateVersion: 'ao-dai-rental-v2',
      acceptedAt: '2026-11-01T10:00:00.000Z',
      policyFingerprint: 'fingerprint_hash_123',
    },
  };

  const staleStatus = {
    providerId: 'provider_123',
    scope: 'AO_DAI_RENTAL',
    status: 'STALE' as const,
    isStale: true,
    staleReason: 'POLICY_CHANGED',
    active: {
      id: 'acceptance_abc',
      mechanismVersion: 'auto-acceptance-v1',
      templateVersion: 'ao-dai-rental-v2',
      acceptedAt: '2026-11-01T10:00:00.000Z',
      policyFingerprint: 'fingerprint_hash_old',
    },
  };

  const revokedStatus = {
    providerId: 'provider_123',
    scope: 'AO_DAI_RENTAL',
    status: 'REVOKED' as const,
    active: null,
    revoked: {
      id: 'acceptance_abc',
      revokedAt: '2026-11-02T15:00:00.000Z',
    },
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('1. Provider opens Dashboard with mechanism DRAFT: displays draft notice and badge', async () => {
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue(draftMechanism);
    vi.mocked(contractService.getProviderAcceptanceStatus).mockResolvedValue(notAcceptedStatus);

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId('mechanism-draft-badge')).toBeTruthy();
      expect(screen.getByTestId('draft-mechanism-notice')).toBeTruthy();
      expect(screen.getByTestId('status-not-accepted-badge')).toBeTruthy();
    });
  });

  it('2. In DRAFT mechanism: modal opens, regulation is displayed, checkbox and accept button are locked/disabled', async () => {
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue(draftMechanism);
    vi.mocked(contractService.getProviderAcceptanceStatus).mockResolvedValue(notAcceptedStatus);

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId('open-mechanism-modal-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('open-mechanism-modal-btn'));

    expect(screen.getByTestId('mechanism-view-modal')).toBeTruthy();
    expect(screen.getByTestId('modal-mechanism-status').textContent).toContain('DRAFT');

    const checkbox = screen.getByTestId('provider-accept-checkbox') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(false);

    const submitBtn = screen.getByTestId('modal-submit-accept-btn') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    // Clicking does not call accept
    fireEvent.click(submitBtn);
    expect(contractService.acceptProviderMechanism).not.toHaveBeenCalled();
  });

  it('3. With APPROVED mechanism: modal displays regulation, checkbox initially UNCHECKED, button disabled until checked', async () => {
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue(approvedMechanism);
    vi.mocked(contractService.getProviderAcceptanceStatus).mockResolvedValue(notAcceptedStatus);

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId('open-mechanism-modal-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('open-mechanism-modal-btn'));

    expect(screen.getByTestId('mechanism-view-modal')).toBeTruthy();
    expect(screen.getByTestId('modal-mechanism-status').textContent).toContain('APPROVED');

    const checkbox = screen.getByTestId('provider-accept-checkbox') as HTMLInputElement;
    expect(checkbox.disabled).toBe(false);
    expect(checkbox.checked).toBe(false);

    const submitBtn = screen.getByTestId('modal-submit-accept-btn') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('4. Provider checks checkbox: button enables; unchecks: button disables', async () => {
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue(approvedMechanism);
    vi.mocked(contractService.getProviderAcceptanceStatus).mockResolvedValue(notAcceptedStatus);

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId('open-mechanism-modal-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('open-mechanism-modal-btn'));

    const checkbox = screen.getByTestId('provider-accept-checkbox') as HTMLInputElement;
    const submitBtn = screen.getByTestId('modal-submit-accept-btn') as HTMLButtonElement;

    // Check
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(submitBtn.disabled).toBe(false);

    // Uncheck
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(submitBtn.disabled).toBe(true);
  });

  it('5. Provider accepts mechanism: sends mechanismHash of the displayed version and updates status to ACTIVE', async () => {
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue(approvedMechanism);
    vi.mocked(contractService.getProviderAcceptanceStatus)
      .mockResolvedValueOnce(notAcceptedStatus)
      .mockResolvedValueOnce(activeStatus);
    vi.mocked(contractService.acceptProviderMechanism).mockResolvedValue({
      acceptanceId: 'acceptance_new_123',
      reused: false,
    });

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId('open-mechanism-modal-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('open-mechanism-modal-btn'));

    const checkbox = screen.getByTestId('provider-accept-checkbox');
    fireEvent.click(checkbox);

    const submitBtn = screen.getByTestId('modal-submit-accept-btn');
    fireEvent.click(submitBtn);

    expect(contractService.acceptProviderMechanism).toHaveBeenCalledWith(approvedMechanism.hash);

    await waitFor(() => {
      expect(screen.queryByTestId('mechanism-view-modal')).toBeNull();
      expect(screen.getByTestId('status-active-badge')).toBeTruthy();
      expect(screen.getByTestId('active-acceptance-notice')).toBeTruthy();
    });
  });

  it('6. Double-click protection: button disables while in-flight', async () => {
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue(approvedMechanism);
    vi.mocked(contractService.getProviderAcceptanceStatus).mockResolvedValue(notAcceptedStatus);
    
    let resolveAccept: (value: any) => void;
    vi.mocked(contractService.acceptProviderMechanism).mockImplementation(
      () => new Promise((resolve) => { resolveAccept = resolve; })
    );

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId('open-mechanism-modal-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('open-mechanism-modal-btn'));
    fireEvent.click(screen.getByTestId('provider-accept-checkbox'));

    const submitBtn = screen.getByTestId('modal-submit-accept-btn') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    // Button should be disabled during flight
    expect(submitBtn.disabled).toBe(true);
    expect(contractService.acceptProviderMechanism).toHaveBeenCalledTimes(1);

    // Second click ignored
    fireEvent.click(submitBtn);
    expect(contractService.acceptProviderMechanism).toHaveBeenCalledTimes(1);

    resolveAccept!({ acceptanceId: 'acc_1', reused: false });
  });

  it('7. Handles accept API error gracefully without crashing', async () => {
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue(approvedMechanism);
    vi.mocked(contractService.getProviderAcceptanceStatus).mockResolvedValue(notAcceptedStatus);
    vi.mocked(contractService.acceptProviderMechanism).mockRejectedValue(
      new Error('CONTRACT_MECHANISM_NOT_APPROVED')
    );

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId('open-mechanism-modal-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('open-mechanism-modal-btn'));
    fireEvent.click(screen.getByTestId('provider-accept-checkbox'));

    const submitBtn = screen.getByTestId('modal-submit-accept-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Quy chế hoạt động sàn giao dịch hiện đang ở trạng thái bản thảo (DRAFT), chưa có hiệu lực pháp lý để ký kết.',
        ),
      ).toBeTruthy();
    });
  });

  it('8. Status ACTIVE: card displays active badge, acceptedAt, and revoke button', async () => {
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue(approvedMechanism);
    vi.mocked(contractService.getProviderAcceptanceStatus).mockResolvedValue(activeStatus);

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId('status-active-badge')).toBeTruthy();
      expect(screen.getByTestId('active-acceptance-notice')).toBeTruthy();
      expect(screen.getByTestId('open-revoke-modal-btn')).toBeTruthy();
    });
  });

  it('9. Provider revokes acceptance: confirmation dialog prevents accidental revoke, confirms and updates to REVOKED', async () => {
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue(approvedMechanism);
    vi.mocked(contractService.getProviderAcceptanceStatus)
      .mockResolvedValueOnce(activeStatus)
      .mockResolvedValueOnce(revokedStatus);
    vi.mocked(contractService.revokeProviderAcceptance).mockResolvedValue({
      revoked: true,
      alreadyRevoked: false,
    });

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId('open-revoke-modal-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('open-revoke-modal-btn'));

    expect(screen.getByTestId('revoke-confirm-modal')).toBeTruthy();

    // Cancel first
    fireEvent.click(screen.getByTestId('cancel-revoke-btn'));
    expect(screen.queryByTestId('revoke-confirm-modal')).toBeNull();
    expect(contractService.revokeProviderAcceptance).not.toHaveBeenCalled();

    // Open and confirm
    fireEvent.click(screen.getByTestId('open-revoke-modal-btn'));
    fireEvent.click(screen.getByTestId('confirm-revoke-btn'));

    expect(contractService.revokeProviderAcceptance).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.queryByTestId('revoke-confirm-modal')).toBeNull();
      expect(screen.getByTestId('status-revoked-badge')).toBeTruthy();
      expect(screen.getByTestId('revoked-acceptance-notice')).toBeTruthy();
    });
  });

  it('10. Status STALE: card displays stale badge, warning notice, and re-acceptance button', async () => {
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue(approvedMechanism);
    vi.mocked(contractService.getProviderAcceptanceStatus).mockResolvedValue(staleStatus);

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId('status-stale-badge')).toBeTruthy();
      expect(screen.getByTestId('stale-acceptance-notice')).toBeTruthy();
      expect(screen.getByTestId('open-mechanism-modal-btn').textContent).toContain('Xem & Ký chấp thuận cập nhật');
    });
  });
});
