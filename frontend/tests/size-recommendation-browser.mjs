import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const output = process.env.VIB92_SCREENSHOT_DIR;
if (!output)
  throw new Error("Set VIB92_SCREENSHOT_DIR to a writable artifact directory");
await mkdir(output, { recursive: true });
const entry = resolve(root, "__vib92_preview.tsx").replaceAll("\\", "/");
const source = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/index.css';
import {SizeChartEditor} from '/src/features/provider-dashboard/size-chart/SizeChartEditor';
import {ProductAiSizeModal} from '/src/pages/rentals/product-detail/components/ProductAiSizeModal';
import {ProductSizeChartSection} from '/src/pages/rentals/product-detail/components/ProductSizeChartSection';
import {sizeChartApi} from '/src/features/provider-dashboard/size-chart/sizeChartApi';
import {sizeRecommendationApi} from '/src/features/rentals/services/sizeRecommendationApi';
const chart={version:1,sourceRevision:1,source:'MANUAL',status:'CONFIRMED',measurementType:'BODY',lengthUnit:'CM',weightUnit:'KG',requiredMeasurements:['chest','waist','hip'],rows:[{size:'M',chest:{min:86,max:89},waist:{min:68,max:71},hip:{min:92,max:95},length:{min:140,max:140}}],fitRules:[]};
sizeChartApi.get=async()=>({version:chart.version,sizeChart:chart,sizes:['M']});
sizeChartApi.save=async(_id,_v,data)=>{Object.assign(chart,data,{version:chart.version+1,status:'DRAFT'});return{version:chart.version,sizeChart:chart}};
sizeChartApi.confirm=async()=>{Object.assign(chart,{version:chart.version+1,status:'CONFIRMED'});return{version:chart.version,sizeChart:chart}};
sizeChartApi.upload=async()=>{Object.assign(chart,{source:'IMAGE',imageUrl:'https://example.com/size-chart.png',status:'DRAFT',version:chart.version+1,rows:[{size:'M',chest:{min:84,max:88},waist:{min:66,max:70},hip:{min:90,max:94},length:{min:140,max:140}}]});return{version:chart.version,sizeChart:chart,sizes:['M'],warnings:[],extractionFailed:false}};
sizeRecommendationApi.chart=async()=>({status:'READY',sizeChart:chart});
sizeRecommendationApi.recommend=async()=>({status:'MATCH',chartVersion:chart.version,candidates:['M'],recommendedSize:'M',evaluations:[{size:'M',outcome:'MATCH',reasons:['Vòng ngực 87 cm nằm trong khoảng 86..89 cm của size M.','Vòng eo 70 cm nằm trong khoảng 68..71 cm của size M.','Vòng mông 94 cm nằm trong khoảng 92..95 cm của size M.'],missing:[]}],warnings:['Kết quả độ vừa không xác nhận tồn kho hoặc lịch thuê.']});
const mode=new URLSearchParams(location.search).get('mode');
createRoot(document.getElementById('root')).render(mode==='provider'?<main style={{padding:20,maxWidth:1100,margin:'auto'}}><SizeChartEditor productId="fixture" onPendingChange={()=>{}}/></main>:mode==='detail'?<main style={{padding:20,maxWidth:1100,margin:'auto'}}><ProductSizeChartSection productId="fixture" selectedSize="M"/></main>:<ProductAiSizeModal isOpen onClose={()=>{}} productId="fixture" productName="Áo dài kiểm thử" isAuthenticated={false} onApplySize={size=>{window.appliedSize=size}}/>);
`;
const server = await createServer({
  root,
  configFile: resolve(root, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 5197, strictPort: true, open: false },
  plugins: [
    {
      name: "vib92-browser-fixture",
      enforce: "pre",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.split("?")[0] !== "/__vib92_preview") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              req.url,
              '<html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__vib92_preview.tsx"></script></body></html>',
            ),
          );
        });
      },
      resolveId(id) {
        if (id === "/__vib92_preview.tsx") return entry;
      },
      load(id) {
        if (id === entry) return source;
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5197/__vib92_preview?mode=provider");
  await page.getByLabel("M Ngực từ").fill("87");
  await page.getByLabel("M Ngực đến").fill("90");
  assert.equal(await page.getByLabel("M Dài áo").inputValue(), "140");
  assert.equal(await page.evaluate(() => {
    const list = document.querySelector(".vib92-size-review-list");
    return list.scrollWidth <= list.clientWidth;
  }), true);
  assert.equal(await page.evaluate(() => {
    const fields = [...document.querySelectorAll(".vib92-size-review-card > .size-chart-measurement-grid .size-chart-metric")];
    return fields.length === 6 && fields[0].getBoundingClientRect().top === fields[5].getBoundingClientRect().top;
  }), true);
  await page.getByRole("button", { name: "Lưu bảng nháp" }).click();
  await page
    .getByRole("button", { name: "Tôi đã kiểm tra — xác nhận bảng size" })
    .click();
  await page.getByRole("status").filter({ hasText: "Đã xác nhận" }).waitFor();
  await page.screenshot({
    path: resolve(output, "vib92-provider-desktop.png"),
    fullPage: true,
  });
  await page.getByLabel("Nguồn bảng").selectOption("IMAGE");
  assert.equal(await page.evaluate(() => {
    const list = document.querySelector(".vib92-size-review-list");
    return list.scrollWidth <= list.clientWidth;
  }), true);
  await page.getByRole("button", { name: "Chọn ảnh bảng size" }).waitFor();
  await page.screenshot({
    path: resolve(output, "vib92-provider-image-upload-desktop.png"),
    fullPage: true,
  });
  const scrollBeforeUpload = await page.evaluate(() => window.scrollY);
  await page.getByLabel("Tải ảnh bảng size (JPG, PNG, WebP; tối đa 8 MB)")
    .setInputFiles({
      name: "size-chart.png",
      mimeType: "image/png",
      // The upload API is mocked in this browser fixture; no binary asset is needed.
      buffer: Buffer.from("synthetic-size-chart-test-image"),
    });
  await page.getByLabel("M Ngực từ").waitFor();
  await page.waitForFunction(() =>
    document.querySelector('input[aria-label="M Ngực từ"]')?.value === "84"
  );
  await page.getByRole("button", { name: "Xem 1 size đã đọc ↓" }).waitFor();
  await page.waitForFunction((previous) => {
    const review = document.querySelector(".size-chart-data-heading");
    return review && window.scrollY > previous && review.getBoundingClientRect().top < window.innerHeight;
  }, scrollBeforeUpload);
  assert.equal(await page.getByLabel("M Dài áo").inputValue(), "140");
  await page.getByRole("status").filter({ hasText: "Chưa xác nhận" }).waitFor();
  await page.getByRole("button", { name: "Tôi đã kiểm tra — xác nhận bảng size" }).click();
  await page.getByRole("status").filter({ hasText: "Đã xác nhận" }).waitFor();
  await page.screenshot({
    path: resolve(output, "vib92-provider-ocr-confirmed-desktop.png"),
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:5197/__vib92_preview");
  await page.getByLabel("Vòng ngực (cm)").fill("87");
  await page.getByLabel("Vòng eo (cm)").fill("70");
  await page.getByLabel("Vòng mông (cm)").fill("94");
  await page
    .getByRole("button", { name: "Gợi ý size theo bảng của mẫu áo" })
    .click();
  await page.getByRole("button", { name: "Chọn size M" }).waitFor();
  assert.equal(await page.evaluate(() => window.appliedSize), undefined);
  await page.screenshot({
    path: resolve(output, "vib92-customer-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Chọn size M" }).click();
  await page.waitForFunction(() => window.appliedSize === "M");
  await page.goto("http://127.0.0.1:5197/__vib92_preview?mode=detail");
  await page.getByRole("heading", { name: "Bảng size của mẫu áo" }).waitFor();
  await page.getByText("140", { exact: true }).waitFor();
  await page.screenshot({
    path: resolve(output, "vib92-detail-size-chart-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(output, "vib92-detail-size-chart-mobile.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  await page.goto("http://127.0.0.1:5197/__vib92_preview");
  await page.screenshot({
    path: resolve(output, "vib92-customer-mobile.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.goto("http://127.0.0.1:5197/__vib92_preview?mode=provider");
  await page.getByLabel("M Ngực từ").waitFor();
  await page.getByLabel("Nguồn bảng").selectOption("IMAGE");
  assert.equal(await page.evaluate(() => {
    const list = document.querySelector(".vib92-size-review-list");
    return list.scrollWidth <= list.clientWidth;
  }), true);
  await page.screenshot({
    path: resolve(output, "vib92-provider-image-upload-mobile.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: provider draft/confirm and image upload rendering, customer explicit apply, public detail chart, desktop/mobile layout; fixture APIs only.",
  );
} finally {
  await browser?.close();
  await server.close();
}
