import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';

// Isolated browser contexts and intercepted API requests: no real account or
// production mutation is used. The original reference is never edited.
const root = resolve(import.meta.dirname, '..');
const baselineDir = resolve(root, '../docs/refactor-baselines/provider-dashboard-2026-09-21');
const dashboardPath = resolve(root, 'src/pages/providerdashboard/ProviderDashboard.tsx').replaceAll('\\', '/');
const original = await readFile(resolve(baselineDir, 'ProviderDashboard.tsx'), 'utf8');
const output = resolve(baselineDir, 'browser-parity');
await mkdir(output, { recursive: true });

const labels = [
  'Thống kê & Hiệu suất', 'Đơn hàng', 'Giao & nhận áo dài', 'Bộ sưu tập',
  'Thông tin dịch vụ', 'Quản lý Portfolio', 'Gói chụp ảnh', 'Lịch làm việc & Chặn',
  'Mã khuyến mãi & Combo', 'Đánh giá & Phản hồi', 'Đánh giá khách hàng',
  'Lịch sử quyết toán', 'Tất cả thông báo', 'Quản lý vai trò',
];

function apiResponse(path, capabilities) {
  if (path === '/users/me') return {
    id: 'provider-user-test', email: 'provider@example.test', roles: ['PROVIDER'],
    profile: { fullName: 'Provider kiểm thử' }, status: 'ACTIVE', isEmailVerified: true, hasCompletedOnboarding: true,
  };
  if (path === '/auth/me/permissions') return { roles: ['PROVIDER'], permissions: [] };
  if (path === '/providers/me') return {
    _id: 'provider-test', businessName: 'Provider kiểm thử', capabilities,
    contact: { phone: '0900000000' }, address: { addressLine: 'Địa chỉ kiểm thử', city: 'Huế' },
    policies: {}, photographySettings: {}, rentalSettings: {},
  };
  if (path.startsWith('/providers/me/analytics')) return {
    capabilities, totalRevenue: 2500000, totalProducts: 4, successRate: 80, cancelRate: 20,
    averageRating: 4.5, revenueGrowth: [{ label: 'T1', value: 1000000 }, { label: 'T2', value: 1500000 }],
  };
  if (path.startsWith('/products/my-listings')) return { items: [], total: 0 };
  if (path.startsWith('/categories')) return { data: [] };
  if (path.startsWith('/inventory?')) return { items: [], total: 0 };
  if (path === '/reviews/stats') return { reviews: [], averageRating: 0, totalReviews: 0 };
  if (path === '/provider/settlements') return { items: [] };
  if (path === '/providers/me/wallet') return {};
  if (path === '/campaigns/mine') return null;
  return [];
}

const servers = [];
let browser;
const results = [];

function comparePixels(before, after) {
  const a = PNG.sync.read(before);
  const b = PNG.sync.read(after);
  assert.equal(a.width, b.width, 'Screenshot width changed');
  assert.equal(a.height, b.height, 'Screenshot height changed');
  let changedPixels = 0;
  let maxChannelDelta = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let changed = false;
    for (let c = 0; c < 4; c++) {
      const delta = Math.abs(a.data[i + c] - b.data[i + c]);
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      changed ||= delta > 0;
    }
    if (changed) changedPixels++;
  }
  // Chromium can differ by 1-2 levels on a handful of antialiased edge pixels.
  // Keep this explicit and tiny; do not mask content or accept layout changes.
  return { changedPixels, maxChannelDelta, acceptable: changedPixels <= 10 && maxChannelDelta <= 2 };
}
try {
  for (const [index, mode] of ['original', 'refactored'].entries()) {
    const server = await createServer({
      root, configFile: resolve(root, 'vite.config.ts'),
      server: { host: '127.0.0.1', port: 5188 + index, strictPort: true, open: false },
      plugins: mode === 'original' ? [{
        name: 'provider-browser-original', enforce: 'pre',
        load(id) { if (id.split('?')[0] === dashboardPath) return original; },
      }] : [],
    });
    await server.listen();
    servers.push(server);
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [scenario, capabilities, viewport] of [
    ['both-desktop', ['AODAI_RENTAL', 'PHOTOGRAPHY'], { width: 1440, height: 1000 }],
    ['rental-desktop', ['AODAI_RENTAL'], { width: 1440, height: 1000 }],
    ['photo-desktop', ['PHOTOGRAPHY'], { width: 1440, height: 1000 }],
    ['both-mobile', ['AODAI_RENTAL', 'PHOTOGRAPHY'], { width: 390, height: 844 }],
  ]) {
    const versions = [];
    for (const [index, mode] of ['original', 'refactored'].entries()) {
      const context = await browser.newContext({ viewport, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', reducedMotion: 'reduce' });
      const requests = [];
      const errors = [];
      await context.addInitScript(() => localStorage.setItem('accessToken', 'isolated-browser-fixture'));
      await context.routeWebSocket('**', socket => socket.close());
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (['xhr', 'fetch'].includes(request.resourceType())) {
          const path = url.pathname.replace(/^\/api(?=\/)/, '') + url.search;
          requests.push({ method: request.method(), path, body: request.postData() });
          await route.fulfill({ json: apiResponse(path, capabilities) });
        } else if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
          await route.abort();
        } else await route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-09-21T03:00:00Z'));
      await page.goto(`http://127.0.0.1:${5188 + index}/provider/dashboard`);
      await page.getByText('Provider kiểm thử', { exact: true }).first().waitFor();
      const shots = [];
      for (const [panelIndex, label] of labels.entries()) {
        const button = page.locator('aside').getByRole('button', { name: label, exact: true });
        if (!(await button.count())) continue;
        await button.click();
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);
        const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
        const name = `${scenario}-${panelIndex}-${mode}.png`;
        await writeFile(resolve(output, name), screenshot);
        shots.push({ label, screenshot });
      }
      versions.push({ shots, errors });
      await context.close();
    }
    assert.deepEqual(versions[1].errors, versions[0].errors, scenario + ': browser errors changed');
    assert.equal(versions[0].errors.length, 0, scenario + ': baseline browser errors');
    assert.equal(versions[0].shots.length, versions[1].shots.length);
    for (let i = 0; i < versions[0].shots.length; i++) {
      const comparison = comparePixels(versions[0].shots[i].screenshot, versions[1].shots[i].screenshot);
      results.push({ scenario, panel: versions[0].shots[i].label, ...comparison });
    }
    console.log(scenario + ': ' + versions[0].shots.length + ' panels compared');
  }
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  const differences = results.filter(result => !result.acceptable);
  assert.deepEqual(differences, [], 'Screenshots differ: inspect browser-parity output');
  console.log('PASS: ' + results.length + ' screenshot comparisons (at most 10 edge pixels, 2/255 color delta); no browser errors.');
} finally {
  await browser?.close();
  await Promise.all(servers.map(server => server.close()));
}
