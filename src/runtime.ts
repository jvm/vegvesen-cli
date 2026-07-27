import * as nodeFs from 'node:fs';
import type { Readable, Writable } from 'node:stream';

export interface RuntimeFileSystem {
  closeSync: typeof nodeFs.closeSync;
  createWriteStream: typeof nodeFs.createWriteStream;
  existsSync: typeof nodeFs.existsSync;
  fsyncSync: typeof nodeFs.fsyncSync;
  linkSync: typeof nodeFs.linkSync;
  mkdirSync: typeof nodeFs.mkdirSync;
  openSync: typeof nodeFs.openSync;
  readFileSync: typeof nodeFs.readFileSync;
  renameSync: typeof nodeFs.renameSync;
  statSync: typeof nodeFs.statSync;
  unlinkSync: typeof nodeFs.unlinkSync;
  writeFileSync: typeof nodeFs.writeFileSync;
}

export interface Runtime {
  fetch: typeof globalThis.fetch;
  env: NodeJS.ProcessEnv;
  fs: RuntimeFileSystem;
  pid: number;
  stdin: Readable & { isTTY?: boolean };
  stdout: Writable & { isTTY?: boolean };
  stderr: Writable & { isTTY?: boolean };
  cwd: string;
  platform: NodeJS.Platform;
  now: () => Date;
  sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  random: () => number;
  signal: AbortSignal;
}

export function processRuntime(signal: AbortSignal = new AbortController().signal): Runtime {
  return {
    fetch: globalThis.fetch,
    env: process.env,
    fs: nodeFs,
    pid: process.pid,
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    cwd: process.cwd(),
    platform: process.platform,
    now: () => new Date(),
    sleep: (milliseconds, sleepSignal) => new Promise((resolve, reject) => {
      if (sleepSignal?.aborted) { reject(sleepSignal.reason); return; }
      const onAbort = () => {
        clearTimeout(timer);
        reject(sleepSignal?.reason);
      };
      const timer = setTimeout(() => {
        sleepSignal?.removeEventListener('abort', onAbort);
        resolve();
      }, milliseconds);
      sleepSignal?.addEventListener('abort', onAbort, { once: true });
    }),
    random: Math.random,
    signal,
  };
}
