import { createHmac } from 'node:crypto';
import { ContractTemplate } from '../../contract-template';
import { AutoAcceptanceMechanism } from '../../contract-mechanism.service';

/**
 * Synthetic Test-Only Template.
 * Confined strictly to test database and memory; NEVER claims legal approval for production.
 */
export const SYNTHETIC_APPROVED_TEMPLATE: ContractTemplate = Object.freeze({
  version: 'synthetic-rental-approved-v1',
  status: 'APPROVED',
  approvedAt: '2026-10-28T00:00:00.000Z',
  title: 'Hợp đồng kiểm thử tự động (Synthetic Test Only)',
  sections: Object.freeze([
    { id: 'parties', heading: 'Các bên', source: 'snapshot.customer/provider' },
    { id: 'items', heading: 'Áo dài thuê', source: 'snapshot.providerItems' },
    { id: 'schedule', heading: 'Thời gian giao trả', source: 'snapshot.providerItems' },
    { id: 'pricing', heading: 'Giá và tiền cọc', source: 'snapshot.pricing' },
    { id: 'policies', heading: 'Chính sách áp dụng', source: 'snapshot.policies' },
    { id: 'consent', heading: 'Xác nhận của các bên', source: 'contract consent records' },
  ]),
});

/**
 * Synthetic Test-Only Provider Mechanism.
 * Confined strictly to test database and memory.
 */
export const SYNTHETIC_APPROVED_MECHANISM: AutoAcceptanceMechanism = Object.freeze({
  version: 'synthetic-auto-acceptance-v1',
  status: 'APPROVED',
  approvedAt: '2026-10-28T00:00:00.000Z',
  scope: 'AO_DAI_RENTAL',
  description: 'Cơ chế chấp thuận kiểm thử tổng hợp (Synthetic Test Only)',
});

/**
 * PayOS Webhook Signer utility for test harness.
 * Sorts data keys alphabetically and generates HMAC-SHA256 signature matching PayOS SDK.
 */
export function signPayOSWebhook(
  data: Record<string, unknown>,
  checksumKey: string,
): string {
  const sortedKeys = Object.keys(data).sort();
  const signDataString = sortedKeys
    .map((key) => `${key}=${String(data[key])}`)
    .join('&');
  return createHmac('sha256', checksumKey).update(signDataString).digest('hex');
}

/**
 * Installs a strict outbound network circuit breaker into the test process.
 * Verifiably rejects any attempt to contact production domains (payos.vn, mongodb.net).
 */
export function installNetworkGuard(): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = String(input);
    if (
      urlStr.includes('payos.vn') ||
      urlStr.includes('mongodb.net') ||
      urlStr.includes('cluster0')
    ) {
      throw new Error(
        `BLOCKED_OUTBOUND_NETWORK_ATTEMPT: Request to ${urlStr} is prohibited in synthetic E2E tests.`,
      );
    }
    return originalFetch(input, init);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}
