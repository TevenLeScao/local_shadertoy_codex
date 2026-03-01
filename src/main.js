import './style.css';
import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

const STORAGE_KEY = 'local-shadertoy-source';
const COMPILE_DEBOUNCE_MS = 120;
const FILE_POLL_MS = 250;
const API_WRITE_DEBOUNCE_MS = 180;

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
const isEmbedMode = params.get('embed') === '1';
const isProdMode = params.get('role') === 'prod';
const renderScaleParam = Number(params.get('renderScale') || '1');
const renderScale = Number.isFinite(renderScaleParam) ? Math.min(Math.max(renderScaleParam, 0.5), 4.0) : 1.0;
const sessionParam = params.get('session') || 'default';
const session = /^[-_a-zA-Z0-9]+$/.test(sessionParam) ? sessionParam : 'default';
const PROD_STORAGE_KEY = `local-shadertoy-prod-source-${session}`;
const PROD_CHANNEL = `local-shadertoy-prod-channel-${session}`;
const DEV_SHADER_API = '/api/dev-shader';
const DEV_SHADER_WS = '/ws/dev-shader';
const TERMINAL_WS = '/ws/terminal';

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
const openProdBtn = document.getElementById('openProdBtn');
const pushProdBtn = document.getElementById('pushProdBtn');
const prodStatus = document.getElementById('prodStatus');
const stats = document.getElementById('stats');
const hint = document.querySelector('.hint');
const terminalPane = document.getElementById('terminalPane');
const terminalHost = document.getElementById('terminalHost');
const terminalStatus = document.getElementById('terminalStatus');

if (isEmbedMode) {
  document.body.classList.add('embed-mode');
}
if (isProdMode) {
  document.body.classList.add('prod-mode');
}

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
  session,
};

const prodChannel = !isFileMode && ('BroadcastChannel' in window) ? new BroadcastChannel(PROD_CHANNEL) : null;
const studioSync = {
  enabled: false,
  applyingRemote: false,
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

function setProdStatus(message) {
  if (prodStatus) {
    prodStatus.textContent = message;
  }
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
let apiWriteTimer = null;
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

function scheduleApiWrite(source) {
  if (!studioSync.enabled || isProdMode || isFileMode) {
    return;
  }

  clearTimeout(apiWriteTimer);
  apiWriteTimer = setTimeout(async () => {
    try {
      await fetch(DEV_SHADER_API, {
        method: 'PUT',
        headers: {
          'content-type': 'text/plain; charset=utf-8',
        },
        body: source,
      });
    } catch (_err) {
      // best-effort write path
    }
  }, API_WRITE_DEBOUNCE_MS);
}

function resizeCanvasToDisplaySize() {
  const dpr = Math.max(1, Math.min((window.devicePixelRatio || 1) * renderScale, 4));
  const displayWidth = Math.floor(canvas.clientWidth * dpr);
  const displayHeight = Math.floor(canvas.clientHeight * dpr);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
}

function updateStats(timeSec, deltaSec) {
  if (isEmbedMode) {
    return;
  }
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
  if (isProdMode) {
    return;
  }

  editor.addEventListener('input', () => {
    if (!isFileMode) {
      scheduleCompile();
      if (!studioSync.applyingRemote) {
        scheduleApiWrite(editor.value);
      }
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

function openProdWindow() {
  const url = new URL(window.location.href);
  url.searchParams.delete('shaderFile');
  url.searchParams.delete('embed');
  url.searchParams.set('role', 'prod');
  url.searchParams.set('session', session);
  if (!url.searchParams.has('renderScale')) {
    url.searchParams.set('renderScale', String(renderScale));
  }
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function pushToProd() {
  if (isProdMode || isFileMode) {
    return;
  }

  if (!runtime.lastCompileOk) {
    setProdStatus('Cannot push: fix shader errors first.');
    return;
  }

  const payload = {
    type: 'deploy',
    source: editor.value,
    sentAt: Date.now(),
    session,
  };

  localStorage.setItem(PROD_STORAGE_KEY, payload.source);
  prodChannel?.postMessage(payload);
  setProdStatus(`Pushed to prod session "${session}" at ${new Date(payload.sentAt).toLocaleTimeString()}.`);
}

function setupProdDeploymentControls() {
  if (isProdMode || isFileMode) {
    if (openProdBtn) openProdBtn.disabled = true;
    if (pushProdBtn) pushProdBtn.disabled = true;
    setProdStatus(isProdMode ? `Prod mode (session "${session}")` : '');
    return;
  }

  if (openProdBtn) {
    openProdBtn.addEventListener('click', openProdWindow);
  }
  if (pushProdBtn) {
    pushProdBtn.addEventListener('click', pushToProd);
  }

  setProdStatus(`Dev mode on session "${session}". Prod updates only when you click Push To Prod.`);
}

function applyProdSource(source) {
  try {
    editor.value = source;
    installProgram(source);
  } catch (err) {
    showError(err);
  }
}

function setupProdMode() {
  hint.innerHTML = `Prod display session: <code>${session}</code> (updates only from dev push).`;
  const initial = localStorage.getItem(PROD_STORAGE_KEY) || FALLBACK_SHADER;
  applyProdSource(initial);

  if (prodChannel) {
    prodChannel.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.type !== 'deploy' || typeof data.source !== 'string') {
        return;
      }
      applyProdSource(data.source);
    });
  }

  if (!prodChannel) {
    window.addEventListener('storage', (event) => {
      if (event.key === PROD_STORAGE_KEY && typeof event.newValue === 'string') {
        applyProdSource(event.newValue);
      }
    });
  }
}

function studioSocketURL(pathname) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${pathname}`;
}

async function setupStudioShaderSync() {
  if (isProdMode || isFileMode) {
    return false;
  }

  try {
    const response = await fetch(DEV_SHADER_API, { cache: 'no-store' });
    if (!response.ok) {
      return false;
    }

    const source = await response.text();
    if (source && source !== editor.value) {
      editor.value = source;
      installProgram(source);
    }
    studioSync.enabled = true;

    const ws = new WebSocket(studioSocketURL(DEV_SHADER_WS));
    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data || data.type !== 'source' || typeof data.source !== 'string') {
          return;
        }
        if (data.source === editor.value) {
          return;
        }
        studioSync.applyingRemote = true;
        editor.value = data.source;
        installProgram(data.source);
      } catch (_err) {
        // ignore malformed update packets
      } finally {
        studioSync.applyingRemote = false;
      }
    });
    return true;
  } catch (_err) {
    return false;
  }
}

function setupTerminal() {
  if (isProdMode || isFileMode || !terminalPane || !terminalHost || !terminalStatus) {
    if (terminalPane) {
      terminalPane.style.display = 'none';
    }
    return;
  }

  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: 'JetBrains Mono, Menlo, monospace',
    fontSize: 12,
    theme: {
      background: '#091624',
      foreground: '#dcefff',
      cursor: '#e7f4ff',
      selectionBackground: '#2f4f70',
    },
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(terminalHost);
  fit.fit();

  const ws = new WebSocket(studioSocketURL(TERMINAL_WS));
  ws.addEventListener('open', () => {
    terminalStatus.textContent = 'Connected';
    ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
  });
  ws.addEventListener('close', () => {
    terminalStatus.textContent = 'Disconnected';
  });
  ws.addEventListener('error', () => {
    terminalStatus.textContent = 'Terminal unavailable';
  });
  ws.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'data' && typeof payload.data === 'string') {
        terminal.write(payload.data);
      }
    } catch (_err) {
      // ignore malformed frames
    }
  });

  terminal.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
  });

  const resize = () => {
    fit.fit();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
    }
  };

  window.addEventListener('resize', resize);
  setTimeout(resize, 40);
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
  const fromStudio = await setupStudioShaderSync();
  if (fromStudio) {
    hint.innerHTML = `Studio mode active: <code>shaders/dev_live.glsl</code> is synced with editor + terminal.`;
    return;
  }

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
setupProdDeploymentControls();
setupTerminal();

if (isProdMode) {
  setupProdMode();
} else if (isFileMode) {
  setupFileMode();
} else {
  setupInlineMode();
}

requestAnimationFrame(renderLoop);
