import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { ProviderContractStatusCard } from '../src/features/provider-dashboard/service-profile/ProviderContractStatusCard';
import { contractService } from '../src/services/contractService';

// Mock contractService
vi.mock('../src/services/contractService', () => ({
  contractService: {
    getBookingReadiness: vi.fn(),
    listContractsForBooking: vi.fn(),
    getContractDetail: vi.fn(),
    submitConsent: vi.fn(),
    getProviderMechanism: vi.fn(),
    getProviderAcceptanceStatus: vi.fn(),
  },
}));

// Mock feature flag module as OFF (default production state)
vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: false,
}));

describe('Phase 7A: Electronic Contract Feature Flag OFF Baseline', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('1. ProviderContractStatusCard renders null when CONTRACTS_V2_ENABLED is OFF', () => {
    const { container } = render(<ProviderContractStatusCard />);
    expect(container.firstChild).toBeNull();
    expect(contractService.getProviderAcceptanceStatus).not.toHaveBeenCalled();
    expect(contractService.getProviderMechanism).not.toHaveBeenCalled();
  });

  it('2. Does not query contract readiness when feature flag is OFF', () => {
    expect(contractService.getBookingReadiness).not.toHaveBeenCalled();
  });
});
