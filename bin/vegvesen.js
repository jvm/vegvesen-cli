#!/usr/bin/env node

import { processSignalError } from '../dist/contracts/error.js';
import { main } from '../dist/main.js';
import { processRuntime } from '../dist/runtime.js';

const controller = new globalThis.AbortController();
let receivedSignal = false;
const handlers = Object.fromEntries(['SIGINT', 'SIGTERM'].map((signal) => [signal, () => {
  if (receivedSignal) {
    process.removeListener('SIGINT', handlers.SIGINT);
    process.removeListener('SIGTERM', handlers.SIGTERM);
    process.kill(process.pid, signal);
    return;
  }
  receivedSignal = true;
  controller.abort(processSignalError(signal));
}]));
for (const [signal, handler] of Object.entries(handlers)) process.on(signal, handler);

try {
  process.exitCode = await main(process.argv.slice(2), processRuntime(controller.signal));
} finally {
  for (const [signal, handler] of Object.entries(handlers)) process.removeListener(signal, handler);
}
