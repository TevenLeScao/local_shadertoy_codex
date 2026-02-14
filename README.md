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
- `STRESS_MIN_BASELINE_FPS` (default `5`)
- `STRESS_MIN_CHURN_FPS` (default `4`)
- `STRESS_MIN_CHURN_TO_BASELINE_FPS_RATIO` (default `0.4`)
- `STRESS_MAX_CHURN_P95_MULTIPLIER` (default `6.0`)
- `STRESS_MAX_CHURN_P95_SLACK_MS` (default `120`)
- `STRESS_MAX_COMPILE_ERRORS` (default `0`)

## File-Based Shader Iteration + Auto Screenshots

You can now keep shaders as files under `shaders/` and have the app auto-reload them.

### Run a shader file in the UI

```bash
npm run dev:file
```

Open:

- `http://127.0.0.1:5173/?shaderFile=shaders/default.glsl`
- `http://127.0.0.1:5173/?shaderFile=shaders/plasma.glsl`

When `shaderFile` mode is active, the app polls the file and recompiles automatically when it changes.

### Continuous screenshot capture on shader edits

In a second terminal (while dev server is running):

```bash
SHADER_FILE=shaders/default.glsl npm run watch:shader
```

On startup and after each file change, a screenshot is written to `shots/`.

Optional env vars:

- `SHADER_HOST` (default `127.0.0.1`)
- `SHADER_PORT` (default `5173`)
- `SHADER_FILE` (default `shaders/default.glsl`)
- `SHADER_SHOTS_DIR` (default `shots`)
- `SHADER_SETTLE_MS` (default `450`)
- `SHADER_VIEWPORT` (default `1920x1080`)
