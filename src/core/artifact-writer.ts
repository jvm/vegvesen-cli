import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, resolve } from 'node:path';
import type { ArtifactDescriptor } from '../contracts/artifact.js';
import { CliError, EXIT, usageError } from '../contracts/error.js';
import type { Runtime } from '../runtime.js';

export function validateOutputDestination(runtime: Runtime, destination: string | undefined, overwrite: boolean): string | undefined {
  if (destination === undefined || destination === '-') return destination;
  const absolute = resolve(runtime.cwd, destination);
  if (runtime.fs.existsSync(absolute) && !overwrite) throw new CliError({ code: 'OUTPUT_EXISTS', message: `Output file already exists: ${absolute}`, exitCode: EXIT.conflict, retryable: false, field: 'output', hint: 'Choose another path or pass --overwrite' });
  return absolute;
}

export function validateArtifactDestination(runtime: Runtime, destination: string | undefined, overwrite: boolean, allowTerminalBinary: boolean): string {
  if (!destination) throw usageError('--output is required for native artifacts', 'Pass --output PATH, or --output - for stdout', 'output');
  if (destination === '-' && runtime.stdout.isTTY && !allowTerminalBinary) throw usageError('Refusing native binary output to terminal', 'Pass --output PATH or explicitly use --allow-terminal-binary', 'output');
  return validateOutputDestination(runtime, destination, overwrite)!;
}

export async function saveArtifact(runtime: Runtime, response: Response, path: string, source: string, overwrite: boolean, allowJson = false): Promise<ArtifactDescriptor> {
  if (!response.body) throw new CliError({ code: 'EMPTY_ARTIFACT_BODY', message: 'Upstream artifact response has no body', exitCode: EXIT.protocol, retryable: false, service: source, hint: 'Check upstream service health' });
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? 'application/octet-stream';
  if (!allowJson && (mediaType === 'application/json' || mediaType.endsWith('+json'))) throw new CliError({ code: 'UNEXPECTED_ARTIFACT_RESPONSE', message: `Expected native artifact but received ${mediaType}`, exitCode: EXIT.protocol, retryable: false, service: source, hint: 'Check request identifier and upstream service health' });
  const temporary = `${path}.tmp-${runtime.pid}-${runtime.now().getTime()}`;
  const hash = createHash('sha256');
  let size = 0;
  const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) { size += chunk.length; hash.update(chunk); callback(null, chunk); } });
  try {
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), meter, runtime.fs.createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
    const fd = runtime.fs.openSync(temporary, 'r');
    try { runtime.fs.fsyncSync(fd); } finally { runtime.fs.closeSync(fd); }
    if (overwrite) runtime.fs.renameSync(temporary, path);
    else { runtime.fs.linkSync(temporary, path); runtime.fs.unlinkSync(temporary); }
    const directoryFd = runtime.fs.openSync(dirname(path), 'r');
    try { runtime.fs.fsyncSync(directoryFd); } finally { runtime.fs.closeSync(directoryFd); }
    return { path, media_type: mediaType, size_bytes: size, sha256: hash.digest('hex'), source };
  } catch (error) {
    if (runtime.fs.existsSync(temporary)) runtime.fs.unlinkSync(temporary);
    if (error instanceof CliError) throw error;
    throw new CliError({ code: 'ARTIFACT_IO_FAILED', message: `Could not save artifact: ${path}`, exitCode: EXIT.io, retryable: false, field: 'output', hint: 'Check destination permissions, free space, and --overwrite' }, { cause: error });
  }
}

export async function saveBytes(runtime: Runtime, body: string | Uint8Array, path: string, source: string, mediaType: string, overwrite: boolean): Promise<ArtifactDescriptor> {
  const bytes = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body);
  const temporary = `${path}.tmp-${runtime.pid}-${runtime.now().getTime()}`;
  try {
    const fd = runtime.fs.openSync(temporary, 'wx', 0o600);
    try {
      runtime.fs.writeFileSync(fd, bytes);
      runtime.fs.fsyncSync(fd);
    } finally { runtime.fs.closeSync(fd); }
    if (overwrite) runtime.fs.renameSync(temporary, path);
    else { runtime.fs.linkSync(temporary, path); runtime.fs.unlinkSync(temporary); }
    const directoryFd = runtime.fs.openSync(dirname(path), 'r');
    try { runtime.fs.fsyncSync(directoryFd); } finally { runtime.fs.closeSync(directoryFd); }
    return { path, media_type: mediaType, size_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), source };
  } catch (error) {
    if (runtime.fs.existsSync(temporary)) runtime.fs.unlinkSync(temporary);
    throw new CliError({ code: 'OUTPUT_IO_FAILED', message: `Could not write output: ${path}`, exitCode: EXIT.io, retryable: false, field: 'output', hint: 'Check destination permissions, free space, and --overwrite' }, { cause: error });
  }
}

export async function* artifactToStream(response: Response): AsyncGenerator<Uint8Array> {
  if (!response.body) return;
  const reader = response.body.getReader();
  try { while (true) { const { done, value } = await reader.read(); if (done) return; yield value; } }
  finally { reader.releaseLock(); }
}
