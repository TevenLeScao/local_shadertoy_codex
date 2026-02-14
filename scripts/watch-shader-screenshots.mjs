import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const host = process.env.SHADER_HOST || '127.0.0.1';
const port = Number(process.env.SHADER_PORT || 5173);
const shaderFile = process.env.SHADER_FILE || 'shaders/default.glsl';
const outDir = process.env.SHADER_SHOTS_DIR || 'shots';
const settleMs = Number(process.env.SHADER_SETTLE_MS || 450);
const sequenceFrames = Number(process.env.SHADER_SEQUENCE_FRAMES || 6);
const sequenceSpanMs = Number(process.env.SHADER_SEQUENCE_SPAN_MS || 900);
const size = process.env.SHADER_VIEWPORT || '1920x1080';
const [width, height] = size.split('x').map((v) => Number(v));

if (!Number.isFinite(width) || !Number.isFinite(height)) {
  console.error(`Invalid SHADER_VIEWPORT: ${size}. Expected format WIDTHxHEIGHT, e.g. 1920x1080.`);
  process.exit(1);
}

const absShader = path.resolve(shaderFile);
if (!fs.existsSync(absShader)) {
  console.error(`Shader file does not exist: ${absShader}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const relShaderPath = shaderFile.split(path.sep).join('/');
const appUrl = `http://${host}:${port}/?shaderFile=${encodeURIComponent(relShaderPath)}`;

function ts() {
  const now = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`;
}

function log(msg) {
  console.log(`[shader-watch] ${msg}`);
}

async function waitForCompile(page, previousVersion, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => window.__shaderRunner?.getState?.() ?? null);
    if (state && state.compileVersion > previousVersion) {
      return state;
    }

    await new Promise((r) => setTimeout(r, 80));
  }

  return null;
}

async function run() {
  log(`Watching shader: ${absShader}`);
  log(`Target app URL: ${appUrl}`);
  log(`Screenshot directory: ${path.resolve(outDir)}`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--use-gl=angle',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => Boolean(window.__shaderRunner?.getState));

  let lastVersion = (await page.evaluate(() => window.__shaderRunner.getState().compileVersion)) || 0;
  let pendingTimer = null;
  let isCapturing = false;

  const capture = async (reason) => {
    if (isCapturing) {
      return;
    }
    isCapturing = true;

    try {
      const compileState = await waitForCompile(page, lastVersion, 5000);
      if (compileState) {
        lastVersion = compileState.compileVersion;
      }

      await new Promise((r) => setTimeout(r, settleMs));
      const state = await page.evaluate(() => window.__shaderRunner.getState());

      const frames = Math.max(1, sequenceFrames);
      const intervalMs = frames > 1 ? Math.max(1, Math.floor(sequenceSpanMs / (frames - 1))) : 0;
      const stamp = ts();
      const base = path.basename(shaderFile, path.extname(shaderFile));

      for (let i = 0; i < frames; i++) {
        const suffix = String(i + 1).padStart(2, '0');
        const file = `${base}-${stamp}-${reason}-${suffix}.png`;
        const target = path.join(outDir, file);
        await page.screenshot({ path: target });
        if (i < frames - 1) {
          await page.waitForTimeout(intervalMs);
        }
      }

      if (state.lastCompileOk) {
        log(`Captured ${frames} frame(s) (${reason})`);
      } else {
        log(`Captured ${frames} frame(s) with compile error (${reason})`);
        log(`Compile error: ${state.lastError}`);
      }
    } finally {
      isCapturing = false;
    }
  };

  await capture('initial');

  const watcher = fs.watch(absShader, { persistent: true }, () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
    }
    pendingTimer = setTimeout(() => {
      capture('file-change').catch((err) => {
        console.error('[shader-watch] capture failed:', err);
      });
    }, 120);
  });

  const shutdown = async () => {
    log('Stopping watcher...');
    watcher.close();
    await browser.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

run().catch((err) => {
  console.error('[shader-watch] fatal:', err);
  process.exit(1);
});
