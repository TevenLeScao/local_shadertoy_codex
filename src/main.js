import './style.css';

const STORAGE_KEY = 'local-shadertoy-source';
const COMPILE_DEBOUNCE_MS = 120;
const FILE_POLL_MS = 250;

const FALLBACK_SHADER = `void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

    float t = iTime * 0.7;
    float d = length(uv);
    float a = atan(uv.y, uv.x);

    float ring = smoothstep(0.25, 0.23, abs(sin(8.0 * d - 4.0 * t)));
    float pulse = 0.5 + 0.5 * cos(6.0 * a + 2.0 * t);

    vec3 base = mix(vec3(0.03, 0.08, 0.15), vec3(0.94, 0.68, 0.25), pulse);
    vec3 color = base * ring + vec3(0.05, 0.1, 0.15) * exp(-3.0 * d);

    fragColor = vec4(color, 1.0);
}`;

const VERT_SRC = `#version 300 es
layout (location = 0) in vec2 aPos;
void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const params = new URLSearchParams(window.location.search);
const shaderFileParam = params.get('shaderFile');
const isFileMode = Boolean(shaderFileParam);

function normalizeShaderPath(path) {
  if (!path) {
    return null;
  }

  const cleaned = path.trim();
  if (!/^[-_./a-zA-Z0-9]+$/.test(cleaned) || cleaned.startsWith('/') || cleaned.includes('..')) {
    return null;
  }

  return cleaned;
}

const shaderFilePath = normalizeShaderPath(shaderFileParam);
const shaderFileUrl = shaderFilePath ? `/${shaderFilePath}` : null;

const editor = document.getElementById('editor');
const canvas = document.getElementById('glCanvas');
const errors = document.getElementById('errors');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const saveBtn = document.getElementById('saveBtn');
const restoreBtn = document.getElementById('restoreBtn');
const stats = document.getElementById('stats');
const hint = document.querySelector('.hint');

const gl = canvas.getContext('webgl2', {
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
});

if (!gl) {
  throw new Error('WebGL2 not supported in this browser.');
}

let runtime = {
  program: null,
  uniforms: null,
  frame: 0,
  isPaused: false,
  prevNow: performance.now(),
  elapsedPause: 0,
  mouse: {
    x: 0,
    y: 0,
    clickX: 0,
    clickY: 0,
    down: false,
  },
  compileVersion: 0,
  lastCompileOk: false,
  lastError: null,
  lastLoadedShaderPath: shaderFilePath,
};

const fullscreenTriangle = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenTriangle);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([
    -1, -1,
    3, -1,
    -1, 3,
  ]),
  gl.STATIC_DRAW,
);

function buildFragmentSource(userSource) {
  return `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;

${userSource}

void main() {
  vec4 fragColor = vec4(0.0);
  mainImage(fragColor, gl_FragCoord.xy);
  outColor = fragColor;
}`;
}

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}

function createProgram(fragmentSource) {
  const vs = createShader(gl.VERTEX_SHADER, VERT_SRC);
  const fs = createShader(gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown program link error';
    gl.deleteProgram(program);
    throw new Error(info);
  }

  return {
    program,
    uniforms: {
      iResolution: gl.getUniformLocation(program, 'iResolution'),
      iTime: gl.getUniformLocation(program, 'iTime'),
      iTimeDelta: gl.getUniformLocation(program, 'iTimeDelta'),
      iFrame: gl.getUniformLocation(program, 'iFrame'),
      iMouse: gl.getUniformLocation(program, 'iMouse'),
    },
  };
}

function showError(err) {
  runtime.lastCompileOk = false;
  runtime.lastError = String(err.message || err);
  errors.textContent = runtime.lastError;
  errors.classList.remove('hidden');
}

function clearError() {
  runtime.lastCompileOk = true;
  runtime.lastError = null;
  errors.textContent = '';
  errors.classList.add('hidden');
}

function installProgram(source) {
  const fragmentSource = buildFragmentSource(source);
  const next = createProgram(fragmentSource);

  if (runtime.program) {
    gl.deleteProgram(runtime.program);
  }

  runtime.program = next.program;
  runtime.uniforms = next.uniforms;
  runtime.frame = 0;
  runtime.prevNow = performance.now();
  runtime.elapsedPause = 0;
  runtime.compileVersion += 1;
  clearError();
}

let compileTimer = null;
function scheduleCompile() {
  clearTimeout(compileTimer);
  compileTimer = setTimeout(() => {
    try {
      installProgram(editor.value);
    } catch (err) {
      showError(err);
    }
  }, COMPILE_DEBOUNCE_MS);
}

function resizeCanvasToDisplaySize() {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const displayWidth = Math.floor(canvas.clientWidth * dpr);
  const displayHeight = Math.floor(canvas.clientHeight * dpr);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
}

function updateStats(timeSec, deltaSec) {
  stats.textContent = `Frame ${runtime.frame} | Time ${timeSec.toFixed(2)}s | dt ${(deltaSec * 1000).toFixed(1)}ms`;
}

function renderLoop(now) {
  resizeCanvasToDisplaySize();

  if (runtime.program) {
    const deltaSec = runtime.isPaused ? 0 : (now - runtime.prevNow) * 0.001;
    if (!runtime.isPaused) {
      runtime.elapsedPause += deltaSec;
      runtime.frame += 1;
    }

    const timeSec = runtime.elapsedPause;

    gl.useProgram(runtime.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenTriangle);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.uniform3f(runtime.uniforms.iResolution, canvas.width, canvas.height, 1.0);
    gl.uniform1f(runtime.uniforms.iTime, timeSec);
    gl.uniform1f(runtime.uniforms.iTimeDelta, deltaSec);
    gl.uniform1i(runtime.uniforms.iFrame, runtime.frame);

    const m = runtime.mouse;
    const mouseY = canvas.height - m.y;
    const clickY = canvas.height - m.clickY;
    gl.uniform4f(runtime.uniforms.iMouse, m.x, mouseY, m.down ? m.clickX : -m.clickX, m.down ? clickY : -clickY);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    updateStats(timeSec, deltaSec);
  }

  runtime.prevNow = now;
  requestAnimationFrame(renderLoop);
}

function setMouseFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  runtime.mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
  runtime.mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
}

async function fetchShaderText(url) {
  const cacheBusted = `${url}?t=${Date.now()}`;
  const response = await fetch(cacheBusted, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load shader file: ${url} (${response.status})`);
  }

  return response.text();
}

function setupPointerHandlers() {
  canvas.addEventListener('pointerdown', (event) => {
    setMouseFromEvent(event);
    runtime.mouse.down = true;
    runtime.mouse.clickX = runtime.mouse.x;
    runtime.mouse.clickY = runtime.mouse.y;
  });

  canvas.addEventListener('pointermove', (event) => {
    setMouseFromEvent(event);
  });

  window.addEventListener('pointerup', () => {
    runtime.mouse.down = false;
  });
}

function setupControls() {
  editor.addEventListener('input', () => {
    if (!isFileMode) {
      scheduleCompile();
    }
  });

  saveBtn.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, editor.value);
  });

  restoreBtn.addEventListener('click', () => {
    editor.value = localStorage.getItem(STORAGE_KEY) || FALLBACK_SHADER;
    scheduleCompile();
  });

  pauseBtn.addEventListener('click', () => {
    runtime.isPaused = !runtime.isPaused;
    pauseBtn.textContent = runtime.isPaused ? 'Resume' : 'Pause';
    runtime.prevNow = performance.now();
  });

  resetBtn.addEventListener('click', () => {
    runtime.frame = 0;
    runtime.elapsedPause = 0;
    runtime.prevNow = performance.now();
  });

  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      localStorage.setItem(STORAGE_KEY, editor.value);
    }
  });
}

async function setupFileMode() {
  if (!shaderFileUrl) {
    showError('Invalid shaderFile query parameter. Use only letters, numbers, /, -, _, . and no .. segments.');
    editor.value = FALLBACK_SHADER;
    try {
      installProgram(editor.value);
    } catch (err) {
      showError(err);
    }
    return;
  }

  hint.innerHTML = `File mode active: <code>${shaderFilePath}</code> (auto-refreshing from disk)`;
  saveBtn.disabled = true;
  restoreBtn.disabled = true;
  saveBtn.title = 'Disabled in file mode';
  restoreBtn.title = 'Disabled in file mode';

  let lastSource = null;

  const refreshFromFile = async () => {
    try {
      const text = await fetchShaderText(shaderFileUrl);
      if (text !== lastSource) {
        lastSource = text;
        editor.value = text;
        installProgram(text);
      }
    } catch (err) {
      showError(err);
    }
  };

  await refreshFromFile();
  window.setInterval(() => {
    refreshFromFile();
  }, FILE_POLL_MS);
}

async function setupInlineMode() {
  const initial = localStorage.getItem(STORAGE_KEY) || FALLBACK_SHADER;
  editor.value = initial;
  try {
    installProgram(initial);
  } catch (err) {
    showError(err);
  }
}

window.__shaderRunner = {
  getState() {
    return {
      compileVersion: runtime.compileVersion,
      lastCompileOk: runtime.lastCompileOk,
      lastError: runtime.lastError,
      shaderFilePath: runtime.lastLoadedShaderPath,
      frame: runtime.frame,
      isPaused: runtime.isPaused,
    };
  },
};

setupPointerHandlers();
setupControls();

if (isFileMode) {
  setupFileMode();
} else {
  setupInlineMode();
}

requestAnimationFrame(renderLoop);
