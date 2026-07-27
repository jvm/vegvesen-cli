import { usageError } from '../contracts/error.js';
import type { CommandResult, OutputFormat } from '../contracts/output.js';
import { artifactToStream, saveArtifact, validateArtifactDestination } from '../core/artifact-writer.js';
import { request } from '../core/http.js';
import { serviceSource } from '../core/metadata.js';
import type { Runtime } from '../runtime.js';
import { numberOption, type QueryOptions } from './catalog.js';

export const parkingOrigin = 'https://parkreg-open.atlas.vegvesen.no';
export const parkingBase = 'ws/no/vegvesen/veg/parkeringsomraade/parkeringsregisteret/v1/';

export interface ArtifactOptions extends QueryOptions {
  output?: string | undefined;
  overwrite?: boolean | undefined;
  allowTerminalBinary?: boolean | undefined;
  format?: OutputFormat | undefined;
}

export async function parkingArtifact(runtime: Runtime, command: string, path: string, options: ArtifactOptions): Promise<CommandResult> {
  if (options.format !== undefined && !['auto', 'raw'].includes(options.format)) throw usageError('Native artifact commands accept only --format auto|raw', 'Use --format raw; select native media through artifact-specific options', 'format');
  const destination = validateArtifactDestination(runtime, options.output, options.overwrite === true, options.allowTerminalBinary === true);
  const upstream = await request(runtime, {
    service: 'parking', canonicalOrigin: parkingOrigin, path: `${parkingBase}${path}`,
    timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true,
    accept: '*/*',
  });
  if (destination === '-') {
    return { command, source: serviceSource('parking'), data: null, nativeStream: artifactToStream(upstream.response), outputHandled: true, meta: { count: 1, has_more: false, next_cursor: null, partial: false } };
  }
  const descriptor = await saveArtifact(runtime, upstream.response, destination, 'parking', options.overwrite === true);
  return { command, source: serviceSource('parking'), data: descriptor, outputHandled: true };
}
