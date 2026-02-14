import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import http from 'node:http';
import { spawn } from 'node:child_process';

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 5173);
const cwd = process.cwd();
const shaderPath = path.resolve(process.env.DEV_SHADER_FILE || 'shaders/dev_live.glsl');

function ensureShaderFile() {
  if (fs.existsSync(shaderPath)) {
    return;
  }

  const fallback = path.resolve('shaders/default.glsl');
  const seed = fs.existsSync(fallback)
    ? fs.readFileSync(fallback, 'utf8')
    : `void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); }`;

  fs.mkdirSync(path.dirname(shaderPath), { recursive: true });
  fs.writeFileSync(shaderPath, seed, 'utf8');
}

ensureShaderFile();

const app = express();
app.use(express.text({ type: '*/*', limit: '4mb' }));

app.get('/api/dev-shader', (_req, res) => {
  try {
    const source = fs.readFileSync(shaderPath, 'utf8');
    res.type('text/plain').send(source);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

const shaderClients = new Set();

function broadcastShader(source) {
  const payload = JSON.stringify({ type: 'source', source });
  for (const client of shaderClients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

app.put('/api/dev-shader', (req, res) => {
  try {
    const source = typeof req.body === 'string' ? req.body : '';
    fs.writeFileSync(shaderPath, source, 'utf8');
    broadcastShader(source);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
});

app.use(vite.middlewares);

const server = http.createServer(app);

const shaderWss = new WebSocketServer({ noServer: true });
const terminalWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/dev-shader') {
    shaderWss.handleUpgrade(request, socket, head, (ws) => {
      shaderWss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/ws/terminal') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit('connection', ws, request);
    });
    return;
  }

  socket.destroy();
});

shaderWss.on('connection', (ws) => {
  shaderClients.add(ws);

  try {
    ws.send(JSON.stringify({ type: 'source', source: fs.readFileSync(shaderPath, 'utf8') }));
  } catch (_err) {
    // ignore failed initial send
  }

  ws.on('close', () => {
    shaderClients.delete(ws);
  });
});

terminalWss.on('connection', (ws) => {
  const candidates = [
    process.env.SHELL,
    '/bin/zsh',
    '/bin/bash',
    'bash',
    'sh',
  ].filter(Boolean);

  let term = null;
  let spawnError = null;
  for (const shell of candidates) {
    try {
      term = pty.spawn(shell, ['-l'], {
        name: 'xterm-color',
        cols: 110,
        rows: 28,
        cwd,
        env: process.env,
      });
      break;
    } catch (err) {
      spawnError = err;
    }
  }

  if (!term) {
    const shell = candidates[0] || 'sh';
    const child = spawn(shell, ['-l'], {
      cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    ws.send(JSON.stringify({ type: 'data', data: `\\r\\n[terminal] PTY unavailable, using pipe shell (${shell}).\\r\\n` }));
    if (spawnError) {
      ws.send(JSON.stringify({ type: 'data', data: `[terminal] PTY error: ${String(spawnError.message || spawnError)}\\r\\n` }));
    }

    child.stdout.on('data', (chunk) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'data', data: chunk.toString('utf8') }));
      }
    });
    child.stderr.on('data', (chunk) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'data', data: chunk.toString('utf8') }));
      }
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'input' && typeof msg.data === 'string') {
          child.stdin.write(msg.data);
        }
      } catch (_err) {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      child.kill('SIGTERM');
    });
    return;
  }

  term.onData((data) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'data', data }));
    }
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'input' && typeof msg.data === 'string') {
        term.write(msg.data);
      }
      if (msg.type === 'resize') {
        const cols = Number(msg.cols);
        const rows = Number(msg.rows);
        if (Number.isFinite(cols) && Number.isFinite(rows)) {
          term.resize(Math.max(20, cols), Math.max(8, rows));
        }
      }
    } catch (_err) {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    term.kill();
  });
});

let fileWatchTimeout = null;
fs.watch(shaderPath, () => {
  clearTimeout(fileWatchTimeout);
  fileWatchTimeout = setTimeout(() => {
    try {
      const source = fs.readFileSync(shaderPath, 'utf8');
      broadcastShader(source);
    } catch (_err) {
      // ignore transient watcher errors
    }
  }, 80);
});

server.listen(port, host, () => {
  console.log(`Studio dev server running on http://${host}:${port}`);
  console.log(`Linked dev shader file: ${path.relative(cwd, shaderPath)}`);
});
