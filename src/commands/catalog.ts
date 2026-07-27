import { CliError, EXIT } from '../contracts/error.js';
import type { CommandResult } from '../contracts/output.js';
import { requestJson } from '../core/http.js';
import { serviceSource } from '../core/metadata.js';
import type { Runtime } from '../runtime.js';

const origin = 'https://dataut.vegvesen.no';

interface CkanResponse<T> { success: boolean; result: T; error?: { message?: string; __type?: string } }
interface CkanSearch { count: number; results: unknown[] }

export interface QueryOptions { timeout?: string | undefined; retries?: string | undefined; limit?: string | undefined; pageSize?: string | undefined; cursor?: string | undefined; all?: boolean | undefined }

export async function catalogAction(runtime: Runtime, command: string, action: string, query: Record<string, string | number | boolean | undefined>, options: QueryOptions): Promise<CommandResult> {
  const { data, raw } = await requestJson<CkanResponse<unknown>>(runtime, {
    service: 'catalog', canonicalOrigin: origin, path: `api/3/action/${action}`, query,
    timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true,
  });
  if (!data.success) throw new CliError({ code: 'CATALOG_ACTION_FAILED', message: data.error?.message ?? `Catalog action failed: ${action}`, exitCode: EXIT.protocol, retryable: false, service: 'catalog', hint: 'Verify identifier and catalog service status' });
  return { command, source: serviceSource('catalog'), data: data.result, raw };
}

export async function catalogList(runtime: Runtime, command: string, action: string, options: QueryOptions): Promise<CommandResult> {
  const limit = options.all ? Number.POSITIVE_INFINITY : Number(options.limit ?? 100);
  const pageSize = Math.min(Number(options.pageSize ?? Math.min(limit, 100)), 1000);
  let offset = Number(options.cursor ?? 0);
  const results: unknown[] = [];
  let exhausted = false;
  while (results.length < limit) {
    const requestSize = Number.isFinite(limit) ? Math.min(pageSize, limit - results.length) : pageSize;
    const { data } = await requestJson<CkanResponse<unknown[]>>(runtime, {
      service: 'catalog', canonicalOrigin: origin, path: `api/3/action/${action}`,
      query: { all_fields: true, limit: requestSize, offset }, timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true,
    });
    if (!data.success) throw new CliError({ code: 'CATALOG_ACTION_FAILED', message: `Catalog action failed: ${action}`, exitCode: EXIT.protocol, retryable: false, service: 'catalog', hint: 'Check catalog service status' });
    results.push(...data.result);
    offset += data.result.length;
    if (data.result.length < requestSize) { exhausted = true; break; }
  }
  const hasMore = !exhausted;
  return { command, source: serviceSource('catalog'), data: results, meta: { count: results.length, has_more: hasMore, next_cursor: hasMore ? String(offset) : null, partial: false } };
}

export async function catalogSearch(runtime: Runtime, queryText: string | undefined, type: string | undefined, options: QueryOptions): Promise<CommandResult> {
  const limit = options.all ? Number.POSITIVE_INFINITY : Number(options.limit ?? 100);
  const pageSize = Math.min(Number(options.pageSize ?? Math.min(limit, 100)), 1000);
  let offset = Number(options.cursor ?? 0);
  const results: unknown[] = [];
  let total = 0;
  while (results.length < limit) {
    const rows = Number.isFinite(limit) ? Math.min(pageSize, limit - results.length) : pageSize;
    const { data } = await requestJson<CkanResponse<CkanSearch>>(runtime, {
      service: 'catalog', canonicalOrigin: origin, path: 'api/3/action/package_search',
      query: { q: queryText, fq: type ? `type:${type}` : undefined, rows, start: offset },
      timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true,
    });
    if (!data.success) throw new CliError({ code: 'CATALOG_ACTION_FAILED', message: 'Catalog search failed', exitCode: EXIT.protocol, retryable: false, service: 'catalog', hint: 'Narrow query or check catalog service status' });
    total = data.result.count;
    results.push(...data.result.results);
    offset += data.result.results.length;
    if (data.result.results.length === 0 || offset >= total) break;
  }
  const hasMore = offset < total;
  return {
    command: 'catalog package search', source: serviceSource('catalog'), data: results,
    meta: { count: results.length, total, has_more: hasMore, next_cursor: hasMore ? String(offset) : null, partial: false },
  };
}

export function numberOption(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}
