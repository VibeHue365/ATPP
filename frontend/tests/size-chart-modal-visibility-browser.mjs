import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const entry = resolve(root, '__vib92_modal_preview.tsx').replaceAll('\\', '/');
const source = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/index.css';
import '/src/features/provider-dashboard/collections/productWizardFigma.css';
import {SizeChartEditor} from '/src/features/provider-dashboard/size-chart/SizeChartEditor';
import {sizeChartApi} from '/src/features/provider-dashboard/size-chart/sizeChartApi';
const rows=[
  {size:'S',chest:{min:80,max:84},waist:{min:62,max:66},hip:{min:86,max:90}},
  {size:'M',chest:{min:84,max:88},waist:{min:66,max:70},hip:{min:90,max:94}},
  {size:'L',chest:{min:88,max:92},waist:{min:70,max:74},hip:{min:94,max:98}},
];
const chart={version:2,sourceRevision:1,source:'IMAGE',status:'DRAFT',measurementType:'BODY',lengthUnit:'CM',weightUnit:'KG',imageUrl:'data:image/png;base64,iVBORw0KGgo=',rows,requiredMeasurements:['chest','waist','hip']};
sizeChartApi.get=async()=>({version:2,sizeChart:chart,sizes:['S','M','L']});
createRoot(document.getElementById('root')).render(<div className="pwm-backdrop"><div className="pwm-container"><div className="pwm-header">Chỉnh sửa thông tin Áo Dài</div><div className="pwm-body"><SizeChartEditor productId="fixture" onPendingChange={()=>{}}/></div></div></div>);
`;
const server = await createServer({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  server: { host: '127.0.0.1', port: 5198, strictPort: true, open: false },
  plugins: [{
    name: 'vib92-modal-visibility-fixture',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/__vib92_modal_preview') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml(req.url, '<html lang="vi"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__vib92_modal_preview.tsx"></script></body></html>'));
      });
    },
    resolveId(id) { if (id === '/__vib92_modal_preview.tsx') return entry; },
    load(id) { if (id === entry) return source; },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1178, height: 850 } });
  await page.goto('http://127.0.0.1:5198/__vib92_modal_preview');
  await page.getByText('Đã có 3 dòng size để kiểm tra và chỉnh sửa.').waitFor();
  const result = await page.evaluate(() => {
    const list = document.querySelector('.vib92-size-review-list');
    const cards = [...document.querySelectorAll('.vib92-size-review-card')];
    const next = list?.nextElementSibling;
    return {
      list: { display: getComputedStyle(list).display, rect: list.getBoundingClientRect().toJSON() },
      cards: cards.map(card => ({ display: getComputedStyle(card).display, rect: card.getBoundingClientRect().toJSON() })),
      next: next?.getBoundingClientRect().toJSON(),
    };
  });
  console.log(JSON.stringify(result));
  assert.equal(result.cards.length, 3);
  assert(result.cards.every(card => card.display !== 'none' && card.rect.height > 0));
  assert.equal(await page.getByLabel('S Ngực từ').inputValue(), '80');
  assert.equal(await page.getByLabel('M Eo đến').inputValue(), '70');
  assert.equal(await page.getByLabel('L Mông đến').inputValue(), '98');
  await page.getByRole('button', { name: 'Xem 3 size đã đọc ↓' }).click();
  assert.equal(await page.getByRole('group', { name: 'Số đo size M' }).isVisible(), true);
  if (process.env.VIB92_MODAL_SCREENSHOT)
    await page.screenshot({ path: process.env.VIB92_MODAL_SCREENSHOT });
} finally {
  await browser?.close();
  await server.close();
}
