import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contractService } from '../src/services/contractService';
import { tokenStorage } from '../src/services/tokenStorage';

describe('Phase 7B.1: Contract PDF Download Security & Evidence Integrity Suite', () => {
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-customer-token';
  const samplePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7

  // Pre-calculated SHA-256 of samplePdfBytes
  // 255044462d312e37 -> SHA-256
  let samplePdfSha256: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Compute real SHA-256 of samplePdfBytes via Web Crypto
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', samplePdfBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    samplePdfSha256 = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Mock tokenStorage
    vi.spyOn(tokenStorage, 'getAccessToken').mockReturnValue(mockToken);

    // Mock URL object creation
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost:3000/mock-uuid');
    } else {
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:http://localhost:3000/mock-uuid');
    }

    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(vi.fn());
    }
  });

  describe('1. Bearer Token & Network Authorization', () => {
    it('sends Bearer token exclusively in Authorization header with no token in query params', async () => {
      let capturedRequest: Request | null = null;
      globalThis.fetch = vi.fn().mockImplementation((url, init) => {
        capturedRequest = new Request(url, init);
        return Promise.resolve(
          new Response(samplePdfBytes, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'inline; filename="contract-01.pdf"',
              'X-Contract-SHA256': samplePdfSha256,
            },
          }),
        );
      });

      const contractId = '64b0f0000000000000000001';
      const result = await contractService.downloadPdfBlob(contractId);

      expect(capturedRequest).not.toBeNull();
      const authHeader = (capturedRequest as Request | null)?.headers.get('authorization');
      expect(authHeader).toBe(`Bearer ${mockToken}`);

      const requestUrl = (capturedRequest as Request | null)?.url || '';
      expect(requestUrl).not.toContain('token');
      expect(requestUrl).not.toContain(mockToken);
      expect(result.verified).toBe(true);
      expect(result.sha256).toBe(samplePdfSha256);
    });

    it('handles unauthenticated call gracefully if token is null', async () => {
      vi.spyOn(tokenStorage, 'getAccessToken').mockReturnValue(null);
      let capturedRequest: Request | null = null;
      globalThis.fetch = vi.fn().mockImplementation((url, init) => {
        capturedRequest = new Request(url, init);
        return Promise.resolve(
          new Response(samplePdfBytes, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'X-Contract-SHA256': samplePdfSha256,
            },
          }),
        );
      });

      await contractService.downloadPdfBlob('contract_no_token');
      expect((capturedRequest as Request | null)?.headers.get('authorization')).toBeNull();
    });
  });

  describe('2. HTTP Status Codes & Error Handling', () => {
    it('correctly handles 401 Unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(contractService.downloadPdfBlob('contract_401')).rejects.toMatchObject({
        status: 401,
        message: expect.stringContaining('Unauthorized'),
      });
    });

    it('correctly handles 403 Forbidden (cross-provider or unauthorized customer)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'FORBIDDEN_CONTRACT_READER' }), {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(contractService.downloadPdfBlob('contract_403')).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining('FORBIDDEN_CONTRACT_READER'),
      });
    });

    it('correctly handles 404 Not Found', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'CONTRACT_NOT_FOUND' }), {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(contractService.downloadPdfBlob('contract_404')).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining('CONTRACT_NOT_FOUND'),
      });
    });

    it('correctly handles 422 CONTRACT_PDF_NOT_READY', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'CONTRACT_PDF_NOT_READY' }), {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(contractService.downloadPdfBlob('contract_422')).rejects.toMatchObject({
        status: 422,
        message: expect.stringContaining('CONTRACT_PDF_NOT_READY'),
      });
    });

    it('correctly handles 503 Service Unavailable', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Service Unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        }),
      );

      await expect(contractService.downloadPdfBlob('contract_503')).rejects.toMatchObject({
        status: 503,
        message: expect.stringMatching(/503|Service Unavailable/i),
      });
    });

    it('rejects JSON error payload even if HTTP status was 200 (never downloads JSON as .pdf)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Internal Error masked as 200' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(contractService.downloadPdfBlob('contract_fake_json')).rejects.toThrow(
        /không trả về định dạng PDF hợp lệ/i,
      );
    });
  });

  describe('3. Filename Sanitization & Directory Traversal Prevention', () => {
    it('sanitizes dangerous path traversal in Content-Disposition', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(samplePdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="../../etc/shadow"',
            'X-Contract-SHA256': samplePdfSha256,
          },
        }),
      );

      const result = await contractService.downloadPdfBlob('contract_traversal');
      expect(result.filename).not.toContain('../');
      expect(result.filename).not.toContain('..\\');
      expect(result.filename).toMatch(/^[a-zA-Z0-9._-]+\.pdf$/);
    });

    it('ensures .pdf extension is always appended if missing in header', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(samplePdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="contract_without_extension"',
            'X-Contract-SHA256': samplePdfSha256,
          },
        }),
      );

      const result = await contractService.downloadPdfBlob('contract_no_ext');
      expect(result.filename).toBe('contract_without_extension.pdf');
    });
  });

  describe('4. Client-Side Cryptographic SHA-256 Integrity Verification', () => {
    it('verifies successfully when downloaded PDF bytes match X-Contract-SHA256 header', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(samplePdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'X-Contract-SHA256': samplePdfSha256,
          },
        }),
      );

      const result = await contractService.downloadPdfBlob('contract_integrity_ok');
      expect(result.verified).toBe(true);
      expect(result.sha256).toBe(samplePdfSha256);
    });

    it('FAILS CLOSED (throws INTEGRITY_MISMATCH) when downloaded bytes do not match SHA-256 header', async () => {
      const corruptPdfSha256 = '0'.repeat(64); // Tampered/mismatched hash
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(samplePdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'X-Contract-SHA256': corruptPdfSha256,
          },
        }),
      );

      await expect(contractService.downloadPdfBlob('contract_corrupt')).rejects.toThrow(
        /INTEGRITY_MISMATCH/i,
      );
    });

    it('FAILS CLOSED (throws HASH_MISSING_OR_INVALID) when X-Contract-SHA256 header is completely missing', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(samplePdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            // No X-Contract-SHA256 header
          },
        }),
      );

      await expect(contractService.downloadPdfBlob('contract_no_hash')).rejects.toThrow(
        /HASH_MISSING_OR_INVALID/i,
      );
    });

    it('FAILS CLOSED (throws HASH_MISSING_OR_INVALID) when X-Contract-SHA256 is malformed or invalid length', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(samplePdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'X-Contract-SHA256': 'short_invalid_hash_value',
          },
        }),
      );

      await expect(contractService.downloadPdfBlob('contract_malformed_hash')).rejects.toThrow(
        /HASH_MISSING_OR_INVALID/i,
      );
    });

    it('FAILS CLOSED (throws CRYPTO_UNAVAILABLE) when Web Crypto API is unavailable', async () => {
      const originalSubtle = globalThis.crypto.subtle;
      // Temporarily mock subtle as undefined
      Object.defineProperty(globalThis.crypto, 'subtle', {
        value: undefined,
        configurable: true,
      });

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(samplePdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'X-Contract-SHA256': samplePdfSha256,
          },
        }),
      );

      try {
        await expect(contractService.downloadPdfBlob('contract_no_crypto')).rejects.toThrow(
          /CRYPTO_UNAVAILABLE/i,
        );
      } finally {
        Object.defineProperty(globalThis.crypto, 'subtle', {
          value: originalSubtle,
          configurable: true,
        });
      }
    });
  });

  describe('5. Lifecycle Cleanup & Storage Security', () => {
    it('guarantees URL.revokeObjectURL is called in triggerPdfDownload', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(samplePdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'X-Contract-SHA256': samplePdfSha256,
          },
        }),
      );

      await contractService.triggerPdfDownload('contract_cleanup_test');
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:3000/mock-uuid');
    });

    it('NEVER writes tokens, PDF bytes, or contract evidence to localStorage or sessionStorage', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(samplePdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'X-Contract-SHA256': samplePdfSha256,
          },
        }),
      );

      await contractService.downloadPdfBlob('contract_no_storage');

      expect(setItemSpy).not.toHaveBeenCalled();
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });
});
