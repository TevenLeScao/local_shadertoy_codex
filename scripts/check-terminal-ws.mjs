import process from 'node:process';
import { WebSocket } from 'ws';

const host = process.env.TERM_CHECK_HOST || '127.0.0.1';
const port = Number(process.env.TERM_CHECK_PORT || 5173);
const timeoutMs = Number(process.env.TERM_CHECK_TIMEOUT_MS || 8000);
const marker = `__TERM_OK_${Date.now()}__`;

const url = `ws://${host}:${port}/ws/terminal`;
const ws = new WebSocket(url);

let buffer = '';
let done = false;
let sent = false;

function finish(code, message) {
  if (done) {
    return;
  }
  done = true;
  if (message) {
    console.log(message);
  }
  ws.close();
  process.exit(code);
}

const timer = setTimeout(() => {
  finish(1, `[terminal-check] timeout waiting for marker ${marker}`);
}, timeoutMs);

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'input', data: `echo ${marker}\n` }));
  sent = true;
});

ws.on('message', (raw) => {
  try {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'data' && typeof msg.data === 'string') {
      buffer += msg.data;
      if (buffer.includes(marker)) {
        clearTimeout(timer);
        finish(0, `[terminal-check] ok (${url})`);
      }
    }
  } catch (_err) {
    // ignore malformed frames
  }
});

ws.on('close', () => {
  if (!done && sent && !buffer.includes(marker)) {
    clearTimeout(timer);
    finish(1, '[terminal-check] terminal socket closed before marker appeared');
  }
});

ws.on('error', (err) => {
  clearTimeout(timer);
  finish(1, `[terminal-check] socket error: ${String(err.message || err)}`);
});
