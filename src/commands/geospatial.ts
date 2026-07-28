import { XMLParser } from 'fast-xml-parser';
import { CliError, EXIT, usageError } from '../contracts/error.js';
import type { CommandResult, OutputFormat } from '../contracts/output.js';
import { artifactToStream, assertArtifactResponse, saveArtifact, validateArtifactDestination } from '../core/artifact-writer.js';
import { readResponseText, request, requestJson, type QueryValue } from '../core/http.js';
import { serviceSource } from '../core/metadata.js';
import type { Runtime } from '../runtime.js';
import { numberOption, type QueryOptions } from './catalog.js';

export const ogcOrigin = 'https://ogckart-sn1.atlas.vegvesen.no';
export const tnitsOrigin = 'https://nvdb-tnits.atlas.vegvesen.no';
export const exportOrigin = 'https://nvdb-eksport-x.atlas.vegvesen.no';
export const ogcFamilies = ['vegvar_1_0', 'norstoy_1_0', 'nvdb_2_0', 'rapportweb_1_0', 'datex_3_1'] as const;
export const tnitsTypes = ['SpeedLimit', 'RoadName', 'RoadNumber', 'MaximumHeight'] as const;

interface NativeOptions extends QueryOptions { output?: string | undefined; overwrite?: boolean | undefined; allowTerminalBinary?: boolean | undefined; format?: OutputFormat | undefined }

export async function ogcXml(runtime: Runtime, command: string, family: string, protocol: 'wms' | 'wfs', query: Record<string, QueryValue>, options: QueryOptions): Promise<CommandResult> {
  familyValue(family);
  const upstream = await request(runtime, { service: 'ogc', canonicalOrigin: ogcOrigin, path: `${family}/${protocol}`, query, accept: 'application/xml,text/xml', timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true });
  const raw = await readResponseText(upstream.response, 'ogc', 8 * 1024 * 1024);
  let data: unknown;
  if (/<!DOCTYPE/i.test(raw)) throw new CliError({ code: 'UNSAFE_UPSTREAM_XML', message: 'OGC XML contained a forbidden DOCTYPE declaration', exitCode: EXIT.protocol, retryable: false, service: 'ogc', hint: 'Report the upstream XML security violation' });
  try { data = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: false, maxNestedTags: 64 }).parse(raw); }
  catch (error) { throw new CliError({ code: 'INVALID_UPSTREAM_XML', message: 'OGC returned malformed XML', exitCode: EXIT.protocol, retryable: false, service: 'ogc', hint: 'Check family, operation, and upstream health' }, { cause: error }); }
  return { command, source: serviceSource('ogc'), data, raw };
}

export async function ogcArtifact(runtime: Runtime, command: string, family: string, protocol: 'wms' | 'wfs' | 'modern', path: string, query: Record<string, QueryValue>, accept: string, options: NativeOptions): Promise<CommandResult> {
  if (family) familyValue(family);
  const destination = nativeDestination(runtime, options);
  const upstream = await request(runtime, { service: 'ogc', canonicalOrigin: ogcOrigin, path: protocol === 'modern' ? path : `${family}/${protocol}`, query, accept, timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true });
  const mediaType = upstream.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (accept.startsWith('image/') && !mediaType.startsWith('image/')) throw new CliError({ code: 'OGC_SERVICE_EXCEPTION', message: `Expected ${accept} but received ${mediaType || 'unknown content'}`, exitCode: EXIT.protocol, retryable: false, service: 'ogc', hint: 'Check layer, CRS, bbox, and supported map formats' });
  return artifactResult(runtime, command, 'ogc', upstream.response, destination, options.overwrite === true, accept.includes('json')); 
}

export async function ogcApiJson(runtime: Runtime, command: string, kind: 'feature' | 'map' | 'style', path: string, query: Record<string, QueryValue>, options: QueryOptions): Promise<CommandResult> {
  const roots = { feature: 'ogc/features/v1/', map: 'ogc/maps/v1/', style: 'ogc/styles/v1/' } as const;
  const result = await requestJson<any>(runtime, { service: 'ogc', canonicalOrigin: ogcOrigin, path: `${roots[kind]}${path}`, query, timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true, accept: 'application/json,application/geo+json' });
  return boundedResult(command, 'ogc', result.data, result.raw, options, ['collections', 'styles', 'features']);
}

export async function ogcFeatureItems(runtime: Runtime, collectionId: string, options: QueryOptions): Promise<CommandResult> {
  const path = `ogc/features/v1/collections/${encodeURIComponent(collectionId)}/items`;
  if (!options.all) return ogcApiJson(runtime, 'ogc feature item list', 'feature', `collections/${encodeURIComponent(collectionId)}/items`, { limit: Number(options.limit ?? 100) }, options);
  return { command: 'ogc feature item list', source: serviceSource('ogc'), data: null, stream: featurePages(runtime, path, options) };
}

export async function tnitsJson(runtime: Runtime, command: string, path: string, options: QueryOptions, query: Record<string, QueryValue> = {}): Promise<CommandResult> {
  const result = await requestJson<any>(runtime, { service: 'tnits', canonicalOrigin: tnitsOrigin, path: `api/v1/${path}`, query, timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true });
  for (const key of ['updates', 'snapshots']) if (Array.isArray(result.data?.[key])) result.data[key].sort((a: any, b: any) => String(a.timestamp).localeCompare(String(b.timestamp)));
  return boundedResult(command, 'tnits', result.data, result.raw, options, ['snapshots', 'updates', 'types']);
}

export async function tnitsDownload(runtime: Runtime, command: string, href: string, options: NativeOptions): Promise<CommandResult> {
  const destination = nativeDestination(runtime, options);
  let url: URL;
  try { url = new URL(href, `${tnitsOrigin}/`); } catch { throw usageError('Invalid TN-ITS download href', 'Use an href returned by snapshot/update list', 'href'); }
  if (url.origin !== tnitsOrigin) throw usageError('TN-ITS download href must use the canonical origin', 'Use an href returned by this service', 'href');
  const upstream = await request(runtime, { service: 'tnits', canonicalOrigin: tnitsOrigin, path: url.pathname, query: Object.fromEntries(url.searchParams), accept: 'application/gml+xml,application/xml,application/octet-stream', timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true });
  return artifactResult(runtime, command, 'tnits', upstream.response, destination, options.overwrite === true);
}

export async function nvdbExport(runtime: Runtime, command: string, path: string, query: Record<string, QueryValue>, options: NativeOptions): Promise<CommandResult> {
  const destination = nativeDestination(runtime, options);
  const upstream = await request(runtime, { service: 'nvdb-export', canonicalOrigin: exportOrigin, path, query, accept: '*/*', timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true });
  return artifactResult(runtime, command, 'nvdb-export', upstream.response, destination, options.overwrite === true);
}

async function* featurePages(runtime: Runtime, initialPath: string, options: QueryOptions): AsyncGenerator<{ type: 'item'; data: unknown } | { type: 'summary'; meta: Record<string, unknown> }> {
  const seen = new Set<string>();
  let path = initialPath;
  let query: Record<string, QueryValue> = { limit: Number(options.pageSize ?? 100) };
  let count = 0;
  try {
    while (true) {
      const result = await requestJson<any>(runtime, { service: 'ogc', canonicalOrigin: ogcOrigin, path, query, timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true, accept: 'application/geo+json,application/json' });
      for (const data of result.data?.features ?? []) { count += 1; yield { type: 'item', data }; }
      const href = result.data?.links?.find((link: any) => link.rel === 'next')?.href;
      if (!href) break;
      const next = new URL(href, `${ogcOrigin}/`);
      if (next.origin !== ogcOrigin || !next.pathname.startsWith('/ogc/features/v1/')) throw new CliError({ code: 'INVALID_NEXT_LINK', message: 'OGC next link left the approved feature origin/path', exitCode: EXIT.access, retryable: false, service: 'ogc', hint: 'Report the upstream link-policy violation' });
      const key = next.toString();
      if (seen.has(key)) throw new CliError({ code: 'REPEATED_CURSOR', message: 'OGC repeated a next link', exitCode: EXIT.protocol, retryable: false, service: 'ogc', hint: 'Resume later after upstream paging is repaired' });
      seen.add(key); path = next.pathname; query = Object.fromEntries(next.searchParams);
    }
  } catch (error) {
    yield { type: 'summary', meta: { count, complete: false, has_more: true } };
    throw error;
  }
  yield { type: 'summary', meta: { count, complete: true, has_more: false } };
}

function familyValue(value: string): void { if (!ogcFamilies.includes(value as any)) throw usageError(`Unknown OGC family: ${value}`, `Use ${ogcFamilies.join(', ')}`, 'family'); }
function nativeDestination(runtime: Runtime, options: NativeOptions): string {
  if (options.format !== undefined && !['auto', 'raw'].includes(options.format)) throw usageError('Native artifact commands accept only --format auto|raw', 'Use --format raw and an artifact-specific media option', 'format');
  return validateArtifactDestination(runtime, options.output, options.overwrite === true, options.allowTerminalBinary === true);
}
async function artifactResult(runtime: Runtime, command: string, service: string, response: Response, destination: string, overwrite: boolean, allowJson = false): Promise<CommandResult> {
  if (destination === '-') { assertArtifactResponse(response, service, allowJson); return { command, source: serviceSource(service), data: null, nativeStream: artifactToStream(response), outputHandled: true }; }
  return { command, source: serviceSource(service), data: await saveArtifact(runtime, response, destination, service, overwrite, allowJson), outputHandled: true };
}
function boundedResult(command: string, service: string, data: any, raw: string, options: QueryOptions, keys: string[]): CommandResult {
  const key = keys.find((candidate) => Array.isArray(data?.[candidate]));
  const items: unknown[] | undefined = Array.isArray(data) ? data : key ? data[key] : undefined;
  if (!items) return { command, source: serviceSource(service), data, raw };
  if (options.all) return { command, source: serviceSource(service), data: null, stream: arrayStream(items) };
  const limit = Number(options.limit ?? 100);
  const selected = items.slice(0, limit);
  const bounded = Array.isArray(data) ? selected : { ...data, [key!]: selected };
  return { command, source: serviceSource(service), data: bounded, raw, meta: { count: selected.length, has_more: items.length > limit, next_cursor: null, partial: false, ...(items.length > limit ? { full_retrieval: `vegvesen ${command} --all --format ndjson` } : {}) } };
}
async function* arrayStream(items: unknown[]): AsyncGenerator<{ type: 'item'; data: unknown } | { type: 'summary'; meta: Record<string, unknown> }> { let count = 0; for (const data of items) { count += 1; yield { type: 'item', data }; } yield { type: 'summary', meta: { count, complete: true, has_more: false } }; }
