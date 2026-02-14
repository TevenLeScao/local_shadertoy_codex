import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const host = process.env.CAPTURE_HOST || '127.0.0.1';
const port = Number(process.env.CAPTURE_PORT || 5173);
const shaderFile = process.env.CAPTURE_SHADER || 'shaders/beautiful.glsl';
const out = process.env.CAPTURE_OUT || 'shots/canvas.png';
const waitMs = Number(process.env.CAPTURE_WAIT_MS || 1200);
const viewport = process.env.CAPTURE_VIEWPORT || '1920x1080';
const [width, height] = viewport.split('x').map((n) => Number(n));

if (!Number.isFinite(width) || !Number.isFinite(height)) {
  console.error(`Invalid CAPTURE_VIEWPORT ${viewport}`);
  process.exit(1);
}

const urlPath = shaderFile.split(path.sep).join('/');
const url = `http://${host}:${port}/?shaderFile=${encodeURIComponent(urlPath)}`;

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
});

try {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#glCanvas');
  await page.waitForFunction(() => Boolean(window.__shaderRunner?.getState));
  await page.waitForTimeout(waitMs);

  const state = await page.evaluate(() => window.__shaderRunner.getState());
  if (!state.lastCompileOk) {
    throw new Error(`Shader compile failed: ${state.lastError || 'unknown error'}`);
  }

  const canvas = page.locator('#glCanvas');
  await canvas.screenshot({ path: out });
  console.log(out);
} finally {
  await browser.close();
}
