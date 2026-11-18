import httpClient, { API_BASE_URL } from '@/apis/httpClient';
import type {
  BookingReadinessResponse,
  ContractConsentPayload,
  ContractConsentResponse,
  ContractDetail,
  ContractEligibilityItem,
  ContractEligibilityResponse,
  ContractEvidenceSummary,
  ContractSummary,
  CurrentPolicyResponse,
  CustomerContractItem,
  ProviderAcceptanceStatusResponse,
  ProviderContractConfig,
  ProviderContractPolicyVersion,
  ProviderMechanismResponse,
  SavePolicyPayload,
  UpdateProviderContractConfigPayload,
} from '@/types/contract';
import { translateApiMessage } from '@/utils/apiError';
import { tokenStorage } from '@/utils/storage';

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const has2 = i + 1 < bytes.length;
    const has3 = i + 2 < bytes.length;
    const b2 = has2 ? (bytes[i + 1] ?? 0) : 0;
    const b3 = has3 ? (bytes[i + 2] ?? 0) : 0;

    const triplet = (b1 << 16) | (b2 << 8) | b3;
    result += BASE64_CHARS[(triplet >> 18) & 0x3f];
    result += BASE64_CHARS[(triplet >> 12) & 0x3f];
    result += has2 ? BASE64_CHARS[(triplet >> 6) & 0x3f] : '=';
    result += has3 ? BASE64_CHARS[triplet & 0x3f] : '=';
  }
  return result;
}

function contractsPrefix() {
  const base = API_BASE_URL.replace(/\/+$/, '');
  return base.endsWith('/api') ? '/contracts' : '/api/contracts';
}

export interface DownloadedContractPdf {
  base64: string;
  filename: string;
  sha256: string | null;
  blob?: Blob;
}

export const contractApi = {
  checkEligibility: (items: ContractEligibilityItem[]) =>
    httpClient.post<never, ContractEligibilityResponse>(
      '/api/contracts/eligibility/check',
      { items },
    ),

  getBookingReadiness: (bookingId: string) =>
    httpClient.get<never, BookingReadinessResponse>(
      `/api/contracts/bookings/${encodeURIComponent(bookingId)}/readiness`,
    ),

  refreshContracts: (bookingId: string) =>
    httpClient.post<never, BookingReadinessResponse>(
      `/api/contracts/bookings/${encodeURIComponent(bookingId)}/refresh-contracts`,
      {},
    ),

  getMyContracts: () =>
    httpClient.get<never, CustomerContractItem[]>(
      '/api/contracts/customer/my-contracts',
    ),

  listForBooking: (bookingId: string) =>
    httpClient.get<never, ContractSummary[]>(
      `/api/contracts/bookings/${encodeURIComponent(bookingId)}`,
    ),

  getDetail: (contractId: string) =>
    httpClient.get<never, ContractDetail>(
      `/api/contracts/${encodeURIComponent(contractId)}`,
    ),

  getEvidence: (contractId: string, versionId?: string | null) => {
    const path = versionId
      ? `/api/contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/evidence`
      : `/api/contracts/${encodeURIComponent(contractId)}/evidence`;
    return httpClient.get<never, ContractEvidenceSummary>(path);
  },

  submitConsent: (contractId: string, payload: ContractConsentPayload) =>
    httpClient.post<never, ContractConsentResponse>(
      `/api/contracts/${encodeURIComponent(contractId)}/consents`,
      payload,
    ),

  async downloadPdf(
    contractId: string,
    versionId?: string | null,
  ): Promise<DownloadedContractPdf> {
    const token = await tokenStorage.getAccessToken();
    const base = API_BASE_URL.replace(/\/+$/, '');
    const prefix = contractsPrefix();
    const suffix = versionId
      ? `/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/pdf`
      : `/${encodeURIComponent(contractId)}/pdf`;
    const url = `${base}${prefix}${suffix}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      let msg = `Tải PDF thất bại (${response.status})`;
      try {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          msg = parsed?.message || parsed?.error || msg;
        } catch {
          if (text) msg = text;
        }
      } catch {
        // ignore read error
      }
      if (response.status === 422 || msg.includes('CONTRACT_PDF_NOT_READY')) {
        throw new Error('CONTRACT_PDF_NOT_READY');
      }
      throw new Error(translateApiMessage(msg));
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/pdf')) {
      const text = await response.text();
      let msg = 'Tài liệu PDF chưa sẵn sàng để xem.';
      try {
        const parsed = JSON.parse(text);
        if (parsed?.message) msg = parsed.message;
      } catch {
        // ignore
      }
      throw new Error(translateApiMessage(msg));
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = uint8ArrayToBase64(bytes);

    const disposition = response.headers.get('content-disposition');
    let filename = `hop-dong-${contractId}.pdf`;
    if (disposition) {
      const match = disposition.match(
        /filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i,
      );
      if (match?.[1]) {
        filename = decodeURIComponent(match[1]).replace(/[/\\]/g, '_');
      }
    }

    const sha256 =
      response.headers.get('x-contract-sha256')?.trim().toLowerCase() || null;

    let blob: Blob | undefined;
    if (typeof Blob !== 'undefined') {
      try {
        blob = new Blob([bytes], { type: 'application/pdf' });
      } catch {
        blob = undefined;
      }
    }

    return { base64, filename, sha256, blob };
  },

  getProviderCurrentPolicy: () =>
    httpClient.get<never, CurrentPolicyResponse>(
      '/api/contracts/provider/policy/current',
    ),

  getProviderPolicyVersions: () =>
    httpClient.get<never, ProviderContractPolicyVersion[]>(
      '/api/contracts/provider/policy/versions',
    ),

  saveProviderPolicyDraft: (payload: SavePolicyPayload) =>
    httpClient.post<never, ProviderContractPolicyVersion>(
      '/api/contracts/provider/policy/draft',
      payload,
    ),

  submitProviderPolicy: (payload?: SavePolicyPayload) =>
    httpClient.post<never, ProviderContractPolicyVersion>(
      '/api/contracts/provider/policy/submit',
      payload ?? {},
    ),

  getProviderMechanism: () =>
    httpClient.get<never, ProviderMechanismResponse>(
      '/api/contracts/provider/mechanism',
    ),

  getProviderAcceptance: () =>
    httpClient.get<never, ProviderAcceptanceStatusResponse>(
      '/api/contracts/provider/acceptance',
    ),

  acceptProviderMechanism: (mechanismHash: string) =>
    httpClient.post<never, { acceptanceId: string; reused: boolean }>(
      '/api/contracts/provider/acceptance',
      { mechanismHash },
    ),

  revokeProviderAcceptance: () =>
    httpClient.post<never, { revoked: boolean; alreadyRevoked: boolean }>(
      '/api/contracts/provider/acceptance/revoke',
      {},
    ),

  getProviderConfig: () =>
    httpClient.get<never, ProviderContractConfig>(
      '/api/contracts/provider/config',
    ),

  updateProviderConfig: (payload: UpdateProviderContractConfigPayload) =>
    httpClient.put<never, ProviderContractConfig>(
      '/api/contracts/provider/config',
      payload,
    ),
};
