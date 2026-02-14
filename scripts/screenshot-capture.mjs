#!/usr/bin/env node
import { chromium } from 'playwright';

const url = 'http://localhost:3000/capture';
const outputPath = 'capture-screenshot.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000); // Let any animations settle
await page.screenshot({ path: outputPath, fullPage: true });
await browser.close();
console.log(`Screenshot saved to ${outputPath}`);
