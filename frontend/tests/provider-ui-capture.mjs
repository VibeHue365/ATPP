import { chromium } from '../node_modules/@playwright/test/index.mjs';
import { createServer } from '../node_modules/vite/dist/node/index.js';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const evidenceDir = 'C:/Users/ASUS/.gemini/antigravity/brain/68c59b7c-6838-4146-a6a9-3a382205b094/browser-evidence';
await mkdir(evidenceDir, { recursive: true });

console.log('=== VIBEHUE P1A: CAPTURING PROVIDER SELF-ACCEPTANCE UI SCREENSHOTS ===');

const root = resolve('frontend');
const server = await createServer({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  server: { host: '127.0.0.1', port: 5199, strictPort: true, open: false },
  define: {
    'import.meta.env.VITE_CONTRACTS_V2_ENABLED': JSON.stringify('true'),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:5199'),
  },
});
await server.listen();
console.log('Vite test server listening on http://127.0.0.1:5199');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

// Mock mechanism responses
const draftMechanism = {
  version: 'auto-acceptance-v1',
  status: 'DRAFT',
  approvedAt: null,
  regulationCode: 'QC-VIBEHUE-2026-V1',
  hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  description: 'Quy chế DRAFT chưa có phê duyệt chính thức.',
};

const approvedMechanism = {
  version: 'auto-acceptance-v1',
  status: 'APPROVED',
  approvedAt: '2026-10-31T00:00:00.000Z',
  regulationCode: 'QC-VIBEHUE-2026-V1',
  hash: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
  description: 'Quy chế hoạt động sàn giao dịch VibeHue đã được phê duyệt.',
};

const notAcceptedStatus = {
  providerId: 'provider_123',
  scope: 'AO_DAI_RENTAL',
  status: 'NOT_ACCEPTED',
  active: null,
};

const activeStatus = {
  providerId: 'provider_123',
  scope: 'AO_DAI_RENTAL',
  status: 'ACTIVE',
  active: {
    id: 'acceptance_abc',
    mechanismVersion: 'auto-acceptance-v1',
    templateVersion: 'ao-dai-rental-v2',
    acceptedAt: '2026-11-01T10:00:00.000Z',
    policyFingerprint: 'fingerprint_hash_123',
  },
};

let currentMechanism = draftMechanism;
let currentStatus = notAcceptedStatus;

// Intercept backend API routes
await page.route('**/api/contracts/provider/mechanism', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(currentMechanism),
  });
});

await page.route('**/api/contracts/provider/acceptance', async (route) => {
  if (route.request().method() === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentStatus),
    });
  } else if (route.request().method() === 'POST') {
    if (currentMechanism.status === 'DRAFT') {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'CONTRACT_MECHANISM_NOT_APPROVED' }),
      });
    } else {
      currentStatus = activeStatus;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ acceptanceId: 'acc_new_123', reused: false }),
      });
    }
  }
});

// Navigate to preview page
console.log('Navigating to provider-preview.html...');
await page.goto('http://127.0.0.1:5199/provider-preview.html', { waitUntil: 'networkidle' });

// SCENARIO 1: DRAFT Mechanism State
console.log('Capturing 1: Provider Card with DRAFT Mechanism...');
const card = page.locator('[data-testid="provider-contract-status-card"]');
await card.waitFor({ state: 'visible', timeout: 10000 });
await card.screenshot({ path: `${evidenceDir}/p1a_provider_card_draft.png` });
console.log(`Saved: ${evidenceDir}/p1a_provider_card_draft.png`);

// SCENARIO 2: Open Modal with DRAFT Mechanism
console.log('Capturing 2: Modal with DRAFT Mechanism (Locked)...');
await page.locator('[data-testid="open-mechanism-modal-btn"]').click();
const modal = page.locator('[data-testid="mechanism-view-modal"]');
await modal.waitFor({ state: 'visible', timeout: 5000 });
await page.screenshot({ path: `${evidenceDir}/p1a_modal_draft_locked.png` });
console.log(`Saved: ${evidenceDir}/p1a_modal_draft_locked.png`);

// Close modal
await page.locator('[data-testid="close-mechanism-modal-btn"]').click();
await modal.waitFor({ state: 'hidden' });

// SCENARIO 3: Switch to Approved Synthetic Mechanism & Active Status
console.log('Capturing 3: Provider Card with ACTIVE Acceptance...');
currentMechanism = approvedMechanism;
currentStatus = activeStatus;
await page.reload({ waitUntil: 'networkidle' });
await card.waitFor({ state: 'visible' });
await card.screenshot({ path: `${evidenceDir}/p1a_provider_card_active.png` });
console.log(`Saved: ${evidenceDir}/p1a_provider_card_active.png`);

// SCENARIO 4: Open Modal with APPROVED Mechanism
console.log('Capturing 4: Modal with APPROVED Mechanism...');
await page.locator('[data-testid="open-mechanism-modal-btn"]').click();
await modal.waitFor({ state: 'visible' });
await page.screenshot({ path: `${evidenceDir}/p1a_modal_approved.png` });
console.log(`Saved: ${evidenceDir}/p1a_modal_approved.png`);

// Close modal
await page.locator('[data-testid="close-mechanism-modal-btn"]').click();
await modal.waitFor({ state: 'hidden' });

// SCENARIO 5: Open Revoke Confirmation Dialog
console.log('Capturing 5: Revoke Confirmation Dialog...');
await page.locator('[data-testid="open-revoke-modal-btn"]').click();
const revokeModal = page.locator('[data-testid="revoke-confirm-modal"]');
await revokeModal.waitFor({ state: 'visible' });
await page.screenshot({ path: `${evidenceDir}/p1a_modal_revoke_confirm.png` });
console.log(`Saved: ${evidenceDir}/p1a_modal_revoke_confirm.png`);

await browser.close();
await server.close();
console.log('=== ALL SCREENSHOTS CAPTURED SUCCESSFULLY ===');
