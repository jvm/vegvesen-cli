import { CliError, EXIT } from '../contracts/error.js';
import type { CommandResult, OutputFormat, StreamRecord } from '../contracts/output.js';
import { effectiveSettings } from '../core/config-store.js';
import { requestJson } from '../core/http.js';
import { packageMetadata, serviceSource } from '../core/metadata.js';
import type { Runtime } from '../runtime.js';
import type { QueryOptions } from './catalog.js';

const origin = 'https://nvdbapiles.atlas.vegvesen.no';

interface PageMetadata {
  antall?: number;
  returnert: number;
  sidestørrelse: number;
  neste?: { start: string; href: string } | null;
}

interface NvdbPage {
  objekter?: unknown[];
  metadata: PageMetadata;
  [key: string]: unknown;
}

export interface NvdbOptions extends QueryOptions {
  format: OutputFormat;
  fields: string[];
  configProfile?: string | undefined;
}

export async function nvdbPaged(runtime: Runtime, command: string, path: string, query: Record<string, string | number | boolean | undefined>, options: NvdbOptions, mode: 'objects' | 'changes' = 'objects'): Promise<CommandResult> {
  if (options.all) {
    return {
      command,
      source: serviceSource('nvdb-core'),
      data: null,
      stream: nvdbPageStream(runtime, path, query, options, mode),
      meta: { count: 0, has_more: true, next_cursor: options.cursor ?? null, partial: false },
    };
  }
  const limit = Number(options.limit ?? 100);
  const pageSize = Math.min(Number(options.pageSize ?? Math.min(limit, 100)), 1000);
  const items: unknown[] = [];
  const seen = new Set<string>(options.cursor ? [options.cursor] : []);
  let cursor = options.cursor;
  let total: number | undefined;
  while (items.length < limit) {
    const page = await fetchPage(runtime, path, { ...query, antall: Math.min(pageSize, limit - items.length), start: cursor, ...(mode === 'objects' ? { inkluderAntall: true } : {}) }, options);
    total ??= page.metadata.antall;
    items.push(...extractItems(page, mode).slice(0, limit - items.length));
    const next = page.metadata.neste?.start;
    if (!next) { cursor = undefined; break; }
    assertFreshCursor(next, seen);
    seen.add(next);
    cursor = next;
  }
  return {
    command,
    source: serviceSource('nvdb-core'),
    data: items,
    meta: {
      count: items.length,
      has_more: cursor !== undefined,
      next_cursor: cursor ?? null,
      partial: false,
      ...(total === undefined ? {} : { total }),
    },
  };
}

export async function nvdbRead(runtime: Runtime, command: string, path: string, query: Record<string, string | number | boolean | undefined>, options: QueryOptions, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<CommandResult> {
  const settings = requestSettings(runtime, options);
  const { data, raw } = await requestJson<unknown>(runtime, {
    service: 'nvdb-core',
    canonicalOrigin: origin,
    path,
    query,
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'X-Client': settings.xClient, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    timeout: settings.timeout,
    retries: settings.retries,
    safeToRetry: true,
  });
  return { command, source: serviceSource('nvdb-core'), data, raw };
}

async function* nvdbPageStream(runtime: Runtime, path: string, query: Record<string, string | number | boolean | undefined>, options: NvdbOptions, mode: 'objects' | 'changes'): AsyncGenerator<StreamRecord> {
  const pageSize = Math.min(Number(options.pageSize ?? 100), 1000);
  const seen = new Set<string>(options.cursor ? [options.cursor] : []);
  let cursor = options.cursor;
  let count = 0;
  try {
    while (true) {
      const page = await fetchPage(runtime, path, { ...query, antall: pageSize, start: cursor }, options);
      for (const item of extractItems(page, mode)) {
        count += 1;
        yield { type: 'item', data: item };
      }
      const next = page.metadata.neste?.start;
      if (!next) break;
      assertFreshCursor(next, seen);
      seen.add(next);
      cursor = next;
    }
    yield { type: 'summary', meta: { count, complete: true, has_more: false, next_cursor: null } };
  } catch (error) {
    yield { type: 'summary', meta: { count, complete: false, has_more: true, next_cursor: cursor ?? null } };
    throw error;
  }
}

async function fetchPage(runtime: Runtime, path: string, query: Record<string, string | number | boolean | undefined>, options: QueryOptions): Promise<NvdbPage> {
  const settings = requestSettings(runtime, options);
  const { data } = await requestJson<NvdbPage>(runtime, {
    service: 'nvdb-core', canonicalOrigin: origin, path, query,
    headers: { 'X-Client': settings.xClient }, timeout: settings.timeout, retries: settings.retries, safeToRetry: true,
  });
  if (!data || typeof data !== 'object' || !data.metadata) throw new CliError({ code: 'INVALID_NVDB_PAGE', message: 'NVDB response omitted paging metadata', exitCode: EXIT.protocol, retryable: false, service: 'nvdb-core', hint: 'Check NVDB service health and pinned specification' });
  return data;
}

function extractItems(page: NvdbPage, mode: 'objects' | 'changes'): unknown[] {
  if (mode === 'objects') return Array.isArray(page.objekter) ? page.objekter : [];
  return Object.entries(page)
    .filter(([key, value]) => key !== 'metadata' && Array.isArray(value))
    .flatMap(([change_type, values]) => (values as unknown[]).map((data) => ({ change_type, data })));
}

function assertFreshCursor(cursor: string, seen: Set<string>): void {
  if (seen.has(cursor)) throw new CliError({ code: 'REPEATED_CURSOR', message: `NVDB repeated paging cursor: ${cursor}`, exitCode: EXIT.protocol, retryable: false, service: 'nvdb-core', hint: 'Stop traversal and retry later; report persistent cursor loops' });
}

function requestSettings(runtime: Runtime, options: QueryOptions): { timeout?: string | undefined; retries?: number | undefined; xClient: string } {
  const configured = effectiveSettings(runtime, (options as NvdbOptions).configProfile).values;
  return {
    timeout: options.timeout ?? configured.timeout,
    retries: options.retries === undefined ? configured.retries : Number(options.retries),
    xClient: configured.x_client ?? `vegvesen-cli/${packageMetadata.version}`,
  };
}
