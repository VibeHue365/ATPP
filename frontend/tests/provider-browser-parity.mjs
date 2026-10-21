import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Browser smoke test for the current Provider Dashboard. Every API request is
// intercepted, so this suite never reads or mutates a real ATPP environment.
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'test-results/provider-browser-smoke');
await mkdir(output, { recursive: true });

const scenarios = [
  ['desktop', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }],
];

const panels = [
  'Tổng quan',
  'Đơn hàng',
  'Bộ sưu tập',
  'Mã khuyến mãi & Combo',
  'Đánh giá & Phản hồi',
  'Lịch sử quyết toán',
];

function apiResponse(path) {
  if (path === '/users/me') return {
    id: 'provider-user-test',
    email: 'daibll@example.test',
    roles: ['PROVIDER'],
    profile: { fullName: 'DaiBLL' },
    status: 'ACTIVE',
    isEmailVerified: true,
    hasCompletedOnboarding: true,
  };
  if (path === '/auth/me/permissions') return { roles: ['PROVIDER'], permissions: [] };
  if (path === '/providers/me') return {
    _id: 'provider-test',
    businessName: 'DaiBLL ATPP Studio',
    capabilities: ['AODAI_RENTAL', 'PHOTOGRAPHY'],
    contact: { phone: '0900000000' },
    address: { addressLine: 'Địa chỉ kiểm thử', city: 'Huế' },
    policies: {},
    photographySettings: {},
    rentalSettings: {},
  };
  if (path.startsWith('/providers/me/analytics')) return {
    capabilities: ['AODAI_RENTAL', 'PHOTOGRAPHY'],
    totalRevenue: 2500000,
    totalProducts: 4,
    successRate: 80,
    cancelRate: 20,
    averageRating: 4.5,
    revenueGrowth: [{ label: 'T1', value: 1000000 }, { label: 'T2', value: 1500000 }],
  };
  if (path.startsWith('/products/my-listings')) return { items: [], total: 0 };
  if (path === '/products/categories') return [];
  if (path.startsWith('/categories')) return { data: [] };
  if (path === '/inventory/summary') return [];
  if (path.startsWith('/inventory?')) return { items: [], total: 0 };
  if (path === '/reviews/stats') return { reviews: [], averageRating: 0, totalReviews: 0 };
  if (path === '/provider/settlements') return { items: [] };
  if (path === '/providers/me/wallet') return {};
  if (path === '/campaigns/mine') return null;
  return [];
}

const server = await createServer({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  server: { host: '127.0.0.1', port: 5189, strictPort: true, open: false },
});
let browser;

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  for (const [name, viewport] of scenarios) {
    const context = await browser.newContext({
      viewport,
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      reducedMotion: 'reduce',
    });
    const requests = [];
    const runtimeErrors = [];

    await context.addInitScript(() => {
      localStorage.setItem('accessToken', 'isolated-browser-fixture');
    });
    await context.routeWebSocket('**', socket => socket.close());
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (['xhr', 'fetch'].includes(request.resourceType())) {
        const path = url.pathname.replace(/^\/api(?=\/)/, '') + url.search;
        requests.push({ method: request.method(), path });
        await route.fulfill({ json: apiResponse(path) });
      } else if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
        await route.abort();
      } else {
        await route.continue();
      }
    });

    const page = await context.newPage();
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-09-29T03:00:00Z'));
    await page.goto('http://127.0.0.1:5189/provider/dashboard');
    await page.getByText('DaiBLL ATPP Studio', { exact: true }).first().waitFor();

    for (const label of panels) {
      const button = page.locator('aside').getByRole('button', { name: label, exact: true });
      assert.equal(await button.count(), 1, `${name}: missing panel ${label}`);
      await button.click();
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({
      path: resolve(output, `${name}.png`),
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
    });

    assert.deepEqual(runtimeErrors, [], `${name}: browser runtime errors`);
    assert.ok(requests.some(item => item.path === '/providers/me'), `${name}: provider profile was not requested`);
    assert.ok(requests.some(item => item.path === '/bookings/provider'), `${name}: bookings were not requested`);
    assert.ok(requests.some(item => item.path.startsWith('/products/my-listings')), `${name}: products were not requested`);
    await context.close();
    console.log(`PASS ${name}: ${panels.length} dashboard panels, ${requests.length} isolated API requests`);
  }
} finally {
  await browser?.close();
  await server.close();
}
