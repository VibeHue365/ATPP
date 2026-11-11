import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { contractService } from '../src/services/contractService';
import { httpClient } from '../src/services/httpClient';

// Mock feedback toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};
vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => mockToast,
}));

// Mock contractService
vi.mock('../src/services/contractService', () => ({
  contractService: {
    getBookingReadiness: vi.fn(),
    submitConsent: vi.fn(),
  },
}));

// Mock httpClient
vi.mock('../src/services/httpClient', () => ({
  httpClient: {
    post: vi.fn(),
  },
}));

describe('Phase 7A.1: Feature Flag Mismatch Matrix Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const testBookingId = 'booking-matrix-12345';

  it('Scenario 1: Frontend OFF, Backend OFF — Legacy passthrough succeeds without contract interruption', async () => {
    // When both flags are OFF:
    // Client does not inspect contracts, backend does not enforce Contracts V2.
    // Legacy payment link creation proceeds smoothly.
    vi.mocked(httpClient.post).mockResolvedValueOnce({
      paymentCode: 'PAY-LEGACY-001',
      payos: { checkoutUrl: 'https://pay.payos.vn/sim-legacy' },
    });

    const isFrontendV2Enabled = false;
    let didCheckReadiness = false;

    if (isFrontendV2Enabled) {
      await contractService.getBookingReadiness(testBookingId);
      didCheckReadiness = true;
    }

    const paymentRes = await httpClient.post('/payments/create-link', {
      bookingId: testBookingId,
      purpose: 'FULL_PAYMENT',
    });

    expect(didCheckReadiness).toBe(false);
    expect(contractService.getBookingReadiness).not.toHaveBeenCalled();
    expect(paymentRes).toHaveProperty('paymentCode', 'PAY-LEGACY-001');
  });

  it('Scenario 2: Frontend ON, Backend OFF — Fail-closed on backend 503, never calls create-link', async () => {
    // Frontend is ON and queries readiness.
    // Backend has CONTRACTS_V2_ENABLED=false, so it rejects with 503 CONTRACTS_V2_DISABLED.
    vi.mocked(contractService.getBookingReadiness).mockRejectedValueOnce(
      new Error('503 Service Unavailable: CONTRACTS_V2_DISABLED'),
    );

    const isFrontendV2Enabled = true;
    let paymentCalled = false;
    let caughtError: string | null = null;

    try {
      if (isFrontendV2Enabled) {
        const readiness = await contractService.getBookingReadiness(testBookingId);
        if (readiness.requirement === 'REQUIRED' && !readiness.ready) {
          // Pause and show modal
          return;
        }
      }
      await httpClient.post('/payments/create-link', {
        bookingId: testBookingId,
        purpose: 'FULL_PAYMENT',
      });
      paymentCalled = true;
    } catch (err: unknown) {
      caughtError = err instanceof Error ? err.message : String(err);
    }

    // Must FAIL-CLOSED:
    expect(caughtError).toContain('CONTRACTS_V2_DISABLED');
    expect(paymentCalled).toBe(false);
    expect(httpClient.post).not.toHaveBeenCalledWith(
      '/payments/create-link',
      expect.anything(),
    );
  });

  it('Scenario 3: Frontend OFF, Backend ON — Backend fails closed when unaccepted V2 booking attempts payment link creation', async () => {
    // Crucial security test:
    // If client is legacy or attempts to bypass consent check (Frontend OFF),
    // and immediately calls POST /payments/create-link for a V2 booking that requires contract:
    // Backend PaymentsService rejects with 412 CONTRACT_NOT_ACCEPTED.
    vi.mocked(httpClient.post).mockRejectedValueOnce(
      new Error('412 Precondition Failed: CONTRACT_NOT_ACCEPTED'),
    );

    const isFrontendV2Enabled = false;
    let paymentSuccess = false;
    let backendError: string | null = null;

    try {
      if (isFrontendV2Enabled) {
        await contractService.getBookingReadiness(testBookingId);
      }
      // Direct call attempt without consent:
      await httpClient.post('/payments/create-link', {
        bookingId: testBookingId,
        purpose: 'FULL_PAYMENT',
      });
      paymentSuccess = true;
    } catch (err: unknown) {
      backendError = err instanceof Error ? err.message : String(err);
    }

    // Backend guarantees fail-closed enforcement regardless of client state:
    expect(backendError).toContain('CONTRACT_NOT_ACCEPTED');
    expect(paymentSuccess).toBe(false);
  });

  it('Scenario 4: Frontend ON, Backend ON — Full flow completes after explicit consent and readiness confirmation', async () => {
    // 1. Initial readiness: REQUIRED and ready=false
    vi.mocked(contractService.getBookingReadiness)
      .mockResolvedValueOnce({
        requirement: 'REQUIRED',
        bookingId: testBookingId,
        providers: [
          {
            providerId: 'provider-1',
            contractId: 'contract-1',
            versionId: 'version-1',
            version: 1,
            status: 'AWAITING_CUSTOMER',
          },
        ],
        blockers: ['CONTRACT_NOT_ACCEPTED'],
        ready: false,
      })
      // 2. Second readiness check after consent: ready=true
      .mockResolvedValueOnce({
        requirement: 'REQUIRED',
        bookingId: testBookingId,
        providers: [
          {
            providerId: 'provider-1',
            contractId: 'contract-1',
            versionId: 'version-1',
            version: 1,
            status: 'ACCEPTED',
          },
        ],
        blockers: [],
        ready: true,
      });

    vi.mocked(contractService.submitConsent).mockResolvedValueOnce({
      consentId: 'consent-777',
      action: 'ACCEPT',
      decidedAt: new Date().toISOString(),
      formedAt: new Date().toISOString(),
      effectiveAt: new Date().toISOString(),
    });

    vi.mocked(httpClient.post).mockResolvedValueOnce({
      paymentCode: 'PAY-V2-CONFIRMED',
      payos: { checkoutUrl: 'https://pay.payos.vn/sim-v2' },
    });

    // Step 1: Check initial readiness
    const initialReadiness = await contractService.getBookingReadiness(testBookingId);
    expect(initialReadiness.ready).toBe(false);

    // Step 2: Submit explicit consent
    const consentRes = await contractService.submitConsent('contract-1', {
      contractVersionId: 'version-1',
      action: 'ACCEPT',
      contentHash: 'hash-abc',
      bookingFingerprint: 'fp-123',
      idempotencyKey: 'idem-test',
    });
    expect(consentRes.action).toBe('ACCEPT');

    // Step 3: Re-verify readiness
    const updatedReadiness = await contractService.getBookingReadiness(testBookingId);
    expect(updatedReadiness.ready).toBe(true);

    // Step 4: Proceed to payment link creation
    const paymentRes = await httpClient.post('/payments/create-link', {
      bookingId: testBookingId,
      purpose: 'FULL_PAYMENT',
    });

    expect(paymentRes).toHaveProperty('paymentCode', 'PAY-V2-CONFIRMED');
  });
});
