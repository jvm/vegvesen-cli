import type { Readable, Writable } from 'node:stream';

export interface Runtime {
  fetch: typeof globalThis.fetch;
  env: NodeJS.ProcessEnv;
  stdin: Readable;
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
