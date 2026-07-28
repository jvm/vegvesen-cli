import { usageError } from '../contracts/error.js';
import type { CommandResult } from '../contracts/output.js';
import { requestJson, type HttpOptions } from '../core/http.js';
import { serviceSource } from '../core/metadata.js';
import type { Runtime } from '../runtime.js';
import { numberOption, type QueryOptions } from './catalog.js';

export async function restJson(runtime: Runtime, command: string, service: string, canonicalOrigin: string, path: string, query: Record<string, string | number | boolean | undefined>, options: QueryOptions, headers?: Record<string, string>): Promise<CommandResult> {
  if (options.cursor !== undefined) throw usageError(`--cursor is not supported by ${command}`, 'Remove --cursor; use --all --format ndjson for the complete response', 'cursor');
  if (options.pageSize !== undefined) throw usageError(`--page-size is not supported by ${command}`, 'Remove --page-size; use --limit to bound local output', 'page-size');
  const requestOptions: HttpOptions = {
    service, canonicalOrigin, path, query, headers,
    timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true,
  };
  const { data, raw } = await requestJson<unknown>(runtime, requestOptions);
  const limited = limitData(data, options);
  return {
    command,
    source: serviceSource(service),
    data: limited.data,
    raw,
    meta: { count: limited.count, has_more: limited.hasMore, next_cursor: null, partial: false, resume_supported: false, ...(limited.hasMore ? { truncation: 'local_limit', full_retrieval: `vegvesen ${command} --all --format ndjson` } : {}) },
  };
}

function limitData(data: unknown, options: QueryOptions): { data: unknown; count: number; hasMore: boolean } {
  if (!Array.isArray(data)) return { data, count: data === null ? 0 : 1, hasMore: false };
  const limit = options.all ? data.length : Number(options.limit ?? 100);
  return { data: data.slice(0, limit), count: Math.min(data.length, limit), hasMore: data.length > limit };
}
