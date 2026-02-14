# Local Shadertoy (Fast GLSL Iteration)

A local, real-time GLSL playground inspired by Shadertoy.

## Features

- Live shader recompilation while you type
- Continuous frame rendering (video-like)
- Core Shadertoy uniforms:
  - `iResolution` (`vec3`)
  - `iTime` (`float`)
  - `iTimeDelta` (`float`)
  - `iFrame` (`int`)
  - `iMouse` (`vec4`)
- Keeps rendering the last valid shader if the new shader fails to compile
- Local save/restore via browser storage

## Usage

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open the URL printed by Vite (typically `http://localhost:5173`).

## Shader Format

Write fragment code with this function signature:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord)
```

The app wraps your code into a WebGL2 fragment shader entry point.

## Stress Test

Run an automated headless stress test that measures frame-time stability during rapid shader recompilation:

```bash
npm run test:stress
```

If this is your first Playwright run on a machine, install Chromium once:

```bash
npx playwright install chromium
```

Optional thresholds and durations (via env vars):

- `STRESS_BASELINE_MS` (default `6000`)
- `STRESS_CHURN_MS` (default `12000`)
- `STRESS_EDIT_INTERVAL_MS` (default `140`)
- `STRESS_MIN_BASELINE_FPS` (default `45`)
- `STRESS_MIN_CHURN_FPS` (default `25`)
- `STRESS_MAX_CHURN_P95_MS` (default `55`)
- `STRESS_MAX_COMPILE_ERRORS` (default `0`)
