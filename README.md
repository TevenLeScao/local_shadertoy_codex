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
