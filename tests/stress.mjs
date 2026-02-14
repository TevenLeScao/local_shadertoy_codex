import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:4173';
const BASELINE_DURATION_MS = Number(process.env.STRESS_BASELINE_MS || 6000);
const CHURN_DURATION_MS = Number(process.env.STRESS_CHURN_MS || 12000);
const EDIT_INTERVAL_MS = Number(process.env.STRESS_EDIT_INTERVAL_MS || 140);

const THRESHOLDS = {
  baselineFpsMin: Number(process.env.STRESS_MIN_BASELINE_FPS || 45),
  churnFpsMin: Number(process.env.STRESS_MIN_CHURN_FPS || 25),
  churnP95MsMax: Number(process.env.STRESS_MAX_CHURN_P95_MS || 55),
  errorsMax: Number(process.env.STRESS_MAX_COMPILE_ERRORS || 0),
};

function summarize(metric) {
  const sorted = [...metric.frameTimesMs].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  const avg = metric.frameTimesMs.reduce((a, b) => a + b, 0) / Math.max(1, metric.frameTimesMs.length);

  return {
    fps: metric.frameCount > 0 ? (metric.frameCount * 1000) / metric.durationMs : 0,
    avgMs: avg,
    p95Ms: at(0.95),
    p99Ms: at(0.99),
    frameCount: metric.frameCount,
    compileErrors: metric.compileErrors,
  };
}

function printBlock(title, data) {
  console.log(`\n${title}`);
  console.log(`  fps: ${data.fps.toFixed(2)}`);
  console.log(`  avg frame ms: ${data.avgMs.toFixed(2)}`);
  console.log(`  p95 frame ms: ${data.p95Ms.toFixed(2)}`);
  console.log(`  p99 frame ms: ${data.p99Ms.toFixed(2)}`);
  console.log(`  frames sampled: ${data.frameCount}`);
  console.log(`  compile errors observed: ${data.compileErrors}`);
}

function assertThresholds(baseline, churn) {
  const failures = [];

  if (baseline.fps < THRESHOLDS.baselineFpsMin) {
    failures.push(`Baseline FPS ${baseline.fps.toFixed(2)} below ${THRESHOLDS.baselineFpsMin}`);
  }
  if (churn.fps < THRESHOLDS.churnFpsMin) {
    failures.push(`Churn FPS ${churn.fps.toFixed(2)} below ${THRESHOLDS.churnFpsMin}`);
  }
  if (churn.p95Ms > THRESHOLDS.churnP95MsMax) {
    failures.push(`Churn p95 frame time ${churn.p95Ms.toFixed(2)}ms above ${THRESHOLDS.churnP95MsMax}ms`);
  }
  if (churn.compileErrors > THRESHOLDS.errorsMax) {
    failures.push(`Compile errors ${churn.compileErrors} above ${THRESHOLDS.errorsMax}`);
  }

  return failures;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#editor');
    await page.waitForSelector('#glCanvas');

    const baselineRaw = await page.evaluate(async ({ durationMs }) => {
      const frameTimesMs = [];
      let frameCount = 0;
      let compileErrors = 0;
      const errors = document.getElementById('errors');
      const start = performance.now();
      let last = start;

      await new Promise((resolve) => {
        function tick(now) {
          frameTimesMs.push(now - last);
          last = now;
          frameCount += 1;

          if (errors && !errors.classList.contains('hidden')) {
            compileErrors += 1;
          }

          if (now - start >= durationMs) {
            resolve();
            return;
          }

          requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      });

      return {
        durationMs,
        frameTimesMs,
        frameCount,
        compileErrors,
      };
    }, { durationMs: BASELINE_DURATION_MS });

    const churnRaw = await page.evaluate(async ({ durationMs, editIntervalMs }) => {
      const editor = document.getElementById('editor');
      const errors = document.getElementById('errors');
      const frameTimesMs = [];
      let frameCount = 0;
      let compileErrors = 0;
      const start = performance.now();
      let last = start;
      let nextEdit = start;
      let idx = 0;

      const shaders = [
`void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float t = iTime;
  vec3 col = 0.5 + 0.5*cos(t + uv.xyx + vec3(0.0,2.0,4.0));
  fragColor = vec4(col,1.0);
}`,
`void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5*iResolution.xy) / iResolution.y;
  float t = iTime*0.8;
  float v = 0.0;
  for (int i = 0; i < 24; i++) {
    float fi = float(i);
    v += sin(8.0*length(uv) - t*3.0 + fi*0.2) * 0.02;
  }
  vec3 col = vec3(0.1,0.2,0.4) + vec3(0.9,0.5,0.2)*abs(v*4.0);
  fragColor = vec4(col,1.0);
}`,
`void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float t = iTime;
  float wave = sin(14.0*r - 4.0*t + 6.0*a);
  vec3 col = mix(vec3(0.01,0.03,0.07), vec3(0.8,0.9,0.4), 0.5 + 0.5*wave);
  fragColor = vec4(col * exp(-1.8*r), 1.0);
}`,
      ];

      await new Promise((resolve) => {
        function tick(now) {
          frameTimesMs.push(now - last);
          last = now;
          frameCount += 1;

          if (errors && !errors.classList.contains('hidden')) {
            compileErrors += 1;
          }

          if (now >= nextEdit) {
            editor.value = shaders[idx % shaders.length];
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            idx += 1;
            nextEdit += editIntervalMs;
          }

          if (now - start >= durationMs) {
            resolve();
            return;
          }

          requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      });

      return {
        durationMs,
        frameTimesMs,
        frameCount,
        compileErrors,
      };
    }, { durationMs: CHURN_DURATION_MS, editIntervalMs: EDIT_INTERVAL_MS });

    const baseline = summarize(baselineRaw);
    const churn = summarize(churnRaw);
    printBlock('Baseline Render', baseline);
    printBlock('Shader Churn Stress', churn);

    const failures = assertThresholds(baseline, churn);
    if (failures.length > 0) {
      console.error('\nStress test failed:');
      for (const fail of failures) {
        console.error(`  - ${fail}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log('\nStress test passed.');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Stress test execution failed:', err);
  process.exit(1);
});
