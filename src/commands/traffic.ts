import { readFileSync } from 'node:fs';
import { CliError, EXIT, usageError } from '../contracts/error.js';
import type { CommandResult, StreamRecord } from '../contracts/output.js';
import { requestJson } from '../core/http.js';
import { serviceSource } from '../core/metadata.js';
import { redact } from '../core/redact.js';
import type { Runtime } from '../runtime.js';
import type { QueryOptions } from './catalog.js';

const origin = 'https://trafikkdata-api.atlas.vegvesen.no';
const queryRoot = new URL('../../specs/graphql/queries/', import.meta.url);

interface GraphQlError { message: string; path?: Array<string | number>; extensions?: Record<string, unknown> }
interface GraphQlResponse<T> { data?: T | null; errors?: GraphQlError[] }

export interface TrafficOptions extends QueryOptions {
  allowPartial?: boolean | undefined;
}

export async function trafficStations(runtime: Runtime, command: 'traffic station list' | 'traffic station get', variables: Record<string, unknown>, options: TrafficOptions): Promise<CommandResult> {
  if (command.endsWith('list') && options.cursor !== undefined) throw usageError('--cursor is not supported by traffic station list', 'Remove --cursor; station discovery returns one complete upstream list', 'cursor');
  if (command.endsWith('list') && options.pageSize !== undefined) throw usageError('--page-size is not supported by traffic station list', 'Remove --page-size; use --limit to bound local output', 'page-size');
  const response = await graphql(runtime, 'stations.graphql', variables, options);
  const points = ((response.data as { trafficRegistrationPoints?: unknown[] } | undefined)?.trafficRegistrationPoints ?? []);
  if (command.endsWith('get')) {
    if (points.length === 0) throw new CliError({ code: 'TRAFFIC_STATION_NOT_FOUND', message: `Traffic station not found: ${(variables.ids as string[])[0]}`, exitCode: EXIT.notFound, retryable: false, service: 'traffic', identifier: (variables.ids as string[])[0]!, hint: "Run 'vegvesen traffic station list --query TEXT --json' to discover station IDs" });
    return graphQlResult(command, points[0], response, options);
  }
  const limit = options.all ? points.length : Number(options.limit ?? 100);
  const selected = points.slice(0, limit);
  if (options.all) return { ...graphQlResult(command, null, response, options), stream: arrayStream(selected), data: null };
  return graphQlResult(command, selected, response, options, { count: selected.length, has_more: points.length > limit, next_cursor: null, full_retrieval: points.length > limit ? 'vegvesen traffic station list --all --format ndjson' : undefined });
}

export async function trafficVolume(runtime: Runtime, command: string, period: 'hour' | 'day', stationId: string, from: string, to: string, options: TrafficOptions, projection: 'full' | 'length' | 'quality' | 'coverage' = 'full'): Promise<CommandResult> {
  requireTimestamp(from, 'from');
  requireTimestamp(to, 'to');
  if (options.all) return { command, source: serviceSource('traffic'), data: null, stream: volumeStream(runtime, period, stationId, from, to, options, projection) };
  const limit = Number(options.limit ?? 100);
  const pageSize = Math.min(Number(options.pageSize ?? Math.min(limit, 100)), 1000);
  const items: unknown[] = [];
  const seen = new Set<string>(options.cursor ? [options.cursor] : []);
  let cursor = options.cursor;
  let partial = false;
  const errors: GraphQlError[] = [];
  while (items.length < limit) {
    const response = await volumePage(runtime, period, stationId, from, to, Math.min(pageSize, limit - items.length), cursor, options);
    partial ||= response.errors.length > 0;
    errors.push(...response.errors);
    const connection = getVolumeConnection(response.data, period);
    items.push(...connection.edges.map((edge) => projectVolume(edge.node, projection)));
    if (!connection.pageInfo.hasNextPage) { cursor = undefined; break; }
    const next = connection.pageInfo.endCursor;
    if (!next || seen.has(next)) throw repeatedTrafficCursor(next);
    seen.add(next);
    cursor = next;
  }
  return graphQlResult(command, errors.length ? { items, errors } : items, { errors }, options, { count: items.length, has_more: cursor !== undefined, next_cursor: cursor ?? null, partial });
}

export async function trafficAadt(runtime: Runtime, stationId: string, year: number, dayType: string | undefined, options: TrafficOptions): Promise<CommandResult> {
  const response = await graphql(runtime, 'aadt.graphql', { id: stationId, dayType }, options);
  const years = (((response.data as any)?.trafficData?.volume?.average?.daily?.byYear ?? []) as Array<{ year: number }>);
  const selected = years.find((item) => item.year === year);
  if (!selected) throw new CliError({ code: 'AADT_NOT_FOUND', message: `No AADT data for station ${stationId} in ${year}`, exitCode: EXIT.notFound, retryable: false, service: 'traffic', identifier: stationId, hint: 'Try another year or inspect station data availability' });
  return graphQlResult('traffic aadt get', selected, response, options);
}

export async function trafficReference(runtime: Runtime, kind: 'road-category' | 'area', options: TrafficOptions): Promise<CommandResult> {
  const response = await graphql(runtime, 'reference.graphql', {}, options);
  const data = response.data as { roadCategories?: unknown[]; areas?: { countryParts?: unknown[]; counties?: unknown[]; municipalities?: unknown[] } } | undefined;
  const items = kind === 'road-category'
    ? data?.roadCategories ?? []
    : Object.entries(data?.areas ?? {}).flatMap(([area_type, values]) => (values ?? []).map((area) => ({ area_type, data: area })));
  return boundedGraphQlList(`traffic reference ${kind} list`, items, response, options);
}

export async function trafficStationIndices(runtime: Runtime, stationIds: string[], year: number, month: number | undefined, options: TrafficOptions): Promise<CommandResult> {
  const response = await graphql(runtime, 'indices.graphql', { ids: stationIds, year, month }, options);
  return graphQlResult('traffic index station', (response.data as any)?.trafficVolumeIndices ?? [], response, options);
}

export async function trafficPublishedIndices(runtime: Runtime, options: TrafficOptions): Promise<CommandResult> {
  const response = await graphql(runtime, 'published-indices.graphql', {}, options);
  return boundedGraphQlList('traffic index published', (response.data as any)?.publishedAreaTrafficVolumeIndices ?? [], response, options);
}

export async function trafficAreaIndex(runtime: Runtime, id: number, year: number, month: number | undefined, options: TrafficOptions): Promise<CommandResult> {
  const response = await graphql(runtime, 'published-index.graphql', { id, year, month }, options);
  return graphQlResult('traffic index area', (response.data as any)?.publishedAreaTrafficVolumeIndex ?? [], response, options);
}

async function graphql<T = unknown>(runtime: Runtime, queryFile: string, variables: Record<string, unknown>, options: TrafficOptions): Promise<{ data: T | undefined; errors: GraphQlError[] }> {
  const query = readFileSync(new URL(queryFile, queryRoot), 'utf8');
  const { data: body } = await requestJson<GraphQlResponse<T>>(runtime, {
    service: 'traffic', canonicalOrigin: origin, path: '', method: 'POST', body: JSON.stringify({ query, variables }),
    headers: { 'Content-Type': 'application/json' }, timeout: options.timeout, retries: options.retries === undefined ? undefined : Number(options.retries), safeToRetry: true,
  });
  const errors = (body.errors ?? []).map((error) => ({ ...error, message: redact(error.message) }));
  if ((body.data === undefined || body.data === null) && errors.length) throw new CliError({ code: 'GRAPHQL_REQUEST_FAILED', message: redact(errors[0]?.message ?? 'GraphQL request failed'), exitCode: EXIT.protocol, retryable: false, service: 'traffic', hint: 'Check identifiers, time range, and current Trafikkdata schema' });
  return { data: body.data ?? undefined, errors };
}

function boundedGraphQlList(command: string, items: unknown[], response: { errors: GraphQlError[] }, options: TrafficOptions): CommandResult {
  const limit = options.all ? items.length : Number(options.limit ?? 100);
  const selected = items.slice(0, limit);
  if (options.all) return { ...graphQlResult(command, null, response, options), data: null, stream: arrayStream(selected) };
  return graphQlResult(command, selected, response, options, { count: selected.length, has_more: items.length > limit, next_cursor: null, ...(items.length > limit ? { full_retrieval: `vegvesen ${command} --all --format ndjson` } : {}) });
}

function graphQlResult(command: string, data: unknown, response: { errors: GraphQlError[] }, options: TrafficOptions, meta: Record<string, unknown> = {}): CommandResult {
  const partial = response.errors.length > 0;
  return {
    command,
    source: serviceSource('traffic'),
    data: partial && !(data && typeof data === 'object' && 'errors' in data) ? { result: data, errors: response.errors } : data,
    meta: { partial, ...meta },
    ...(partial && !options.allowPartial ? { exitCode: EXIT.partial } : {}),
  };
}

async function volumePage(runtime: Runtime, period: 'hour' | 'day', stationId: string, from: string, to: string, first: number, after: string | undefined, options: TrafficOptions) {
  return graphql<any>(runtime, period === 'hour' ? 'volume.graphql' : 'volume-day.graphql', { id: stationId, from, to, first, after }, options);
}

function getVolumeConnection(data: any, period: 'hour' | 'day'): { edges: Array<{ cursor: string; node: any }>; pageInfo: { endCursor?: string; hasNextPage: boolean } } {
  const connection = data?.trafficData?.volume?.[period === 'hour' ? 'byHour' : 'byDay'];
  if (!connection?.edges || !connection.pageInfo) throw new CliError({ code: 'INVALID_GRAPHQL_PAGE', message: 'Trafikkdata response omitted connection paging fields', exitCode: EXIT.protocol, retryable: false, service: 'traffic', hint: 'Check pinned schema and service health' });
  return connection;
}

async function* volumeStream(runtime: Runtime, period: 'hour' | 'day', stationId: string, from: string, to: string, options: TrafficOptions, projection: 'full' | 'length' | 'quality' | 'coverage'): AsyncGenerator<StreamRecord> {
  const pageSize = Math.min(Number(options.pageSize ?? 100), 1000);
  const seen = new Set<string>(options.cursor ? [options.cursor] : []);
  let cursor = options.cursor;
  let count = 0;
  try {
    while (true) {
      const response = await volumePage(runtime, period, stationId, from, to, pageSize, cursor, options);
      if (response.errors.length && !options.allowPartial) throw new CliError({ code: 'GRAPHQL_PARTIAL_RESULT', message: redact(response.errors[0]?.message ?? 'GraphQL partial result'), exitCode: EXIT.partial, retryable: false, service: 'traffic', hint: 'Retry with --allow-partial to retain available records' });
      const connection = getVolumeConnection(response.data, period);
      for (const edge of connection.edges) { count += 1; yield { type: 'item', data: projectVolume(edge.node, projection) }; }
      if (!connection.pageInfo.hasNextPage) break;
      const next = connection.pageInfo.endCursor;
      if (!next || seen.has(next)) throw repeatedTrafficCursor(next);
      seen.add(next);
      cursor = next;
    }
    yield { type: 'summary', meta: { count, complete: true, has_more: false, next_cursor: null } };
  } catch (error) {
    yield { type: 'summary', meta: { count, complete: false, has_more: true, next_cursor: cursor ?? null } };
    throw error;
  }
}

function projectVolume(node: any, projection: 'full' | 'length' | 'quality' | 'coverage'): unknown {
  if (projection === 'length') return { from: node.from, to: node.to, byLengthRange: node.byLengthRange };
  if (projection === 'quality') return { from: node.from, to: node.to, validSpeed: node.total?.volumeNumbers?.validSpeed ?? null, validLength: node.total?.volumeNumbers?.validLength ?? null, coverage: node.total?.coverage ?? null };
  if (projection === 'coverage') return { from: node.from, to: node.to, coverage: node.total?.coverage ?? null };
  return node;
}

async function* arrayStream(items: unknown[]): AsyncGenerator<StreamRecord> {
  for (const data of items) yield { type: 'item', data };
  yield { type: 'summary', meta: { count: items.length, complete: true, has_more: false, next_cursor: null } };
}

function repeatedTrafficCursor(cursor: string | undefined): CliError {
  return new CliError({ code: 'REPEATED_CURSOR', message: `Trafikkdata repeated paging cursor: ${cursor ?? '<missing>'}`, exitCode: EXIT.protocol, retryable: false, service: 'traffic', hint: 'Stop traversal and retry later; report persistent cursor loops' });
}

function requireTimestamp(value: string, field: string): void {
  if (Number.isNaN(Date.parse(value))) throw usageError(`--${field} must be an ISO 8601 timestamp`, `Pass --${field} 2026-01-01T00:00:00+01:00`, field);
}
