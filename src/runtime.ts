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
}

export function processRuntime(): Runtime {
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
    sleep: (milliseconds, signal) => new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, milliseconds);
      if (signal !== undefined) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason);
        }, { once: true });
      }
    }),
    random: Math.random,
  };
}
