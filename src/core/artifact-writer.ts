import { createHash } from 'node:crypto';
import { closeSync, createWriteStream, existsSync, fsyncSync, linkSync, openSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, resolve } from 'node:path';
import type { ArtifactDescriptor } from '../contracts/artifact.js';
import { CliError, EXIT, usageError } from '../contracts/error.js';
import type { Runtime } from '../runtime.js';

export function validateArtifactDestination(runtime: Runtime, destination: string | undefined, overwrite: boolean, allowTerminalBinary: boolean): string {
  if (!destination) throw usageError('--output is required for native artifacts', 'Pass --output PATH, or --output - for stdout', 'output');
  if (destination === '-') {
    if (runtime.stdout.isTTY && !allowTerminalBinary) throw usageError('Refusing native binary output to terminal', 'Pass --output PATH or explicitly use --allow-terminal-binary', 'output');
    return destination;
  }
  const absolute = resolve(runtime.cwd, destination);
  if (existsSync(absolute) && !overwrite) throw new CliError({ code: 'OUTPUT_EXISTS', message: `Output file already exists: ${absolute}`, exitCode: EXIT.conflict, retryable: false, field: 'output', hint: 'Choose another path or pass --overwrite' });
  return absolute;
}

export async function saveArtifact(response: Response, path: string, source: string, overwrite: boolean): Promise<ArtifactDescriptor> {
  if (!response.body) throw new CliError({ code: 'EMPTY_ARTIFACT_BODY', message: 'Upstream artifact response has no body', exitCode: EXIT.protocol, retryable: false, service: source, hint: 'Check upstream service health' });
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? 'application/octet-stream';
  if (mediaType === 'application/json' || mediaType.endsWith('+json')) throw new CliError({ code: 'UNEXPECTED_ARTIFACT_RESPONSE', message: `Expected native artifact but received ${mediaType}`, exitCode: EXIT.protocol, retryable: false, service: source, hint: 'Check request identifier and upstream service health' });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  const hash = createHash('sha256');
  let size = 0;
  const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) { size += chunk.length; hash.update(chunk); callback(null, chunk); } });
  try {
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), meter, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
    const fd = openSync(temporary, 'r');
    try { fsyncSync(fd); } finally { closeSync(fd); }
    if (overwrite) renameSync(temporary, path);
    else { linkSync(temporary, path); unlinkSync(temporary); }
    const directoryFd = openSync(dirname(path), 'r');
    try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
    return { path, media_type: mediaType, size_bytes: size, sha256: hash.digest('hex'), source };
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    if (error instanceof CliError) throw error;
    throw new CliError({ code: 'ARTIFACT_IO_FAILED', message: `Could not save artifact: ${path}`, exitCode: EXIT.io, retryable: false, field: 'output', hint: 'Check destination permissions, free space, and --overwrite' }, { cause: error });
  }
}

export async function saveBytes(body: string | Uint8Array, path: string, source: string, mediaType: string, overwrite: boolean): Promise<ArtifactDescriptor> {
  const bytes = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body);
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    const fd = openSync(temporary, 'wx', 0o600);
    try {
      writeFileSync(fd, bytes);
      fsyncSync(fd);
    } finally { closeSync(fd); }
    if (overwrite) renameSync(temporary, path);
    else { linkSync(temporary, path); unlinkSync(temporary); }
    const directoryFd = openSync(dirname(path), 'r');
    try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
    return { path, media_type: mediaType, size_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), source };
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    throw new CliError({ code: 'OUTPUT_IO_FAILED', message: `Could not write output: ${path}`, exitCode: EXIT.io, retryable: false, field: 'output', hint: 'Check destination permissions, free space, and --overwrite' }, { cause: error });
  }
}

export async function artifactToStdout(response: Response): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  return new Uint8Array(await response.arrayBuffer());
}
