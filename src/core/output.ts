import type { Writable } from 'node:stream';
import { envelope, type CommandResult, type ErrorFormat, type OutputFormat } from '../contracts/output.js';
import type { ErrorDetails } from '../contracts/error.js';

export interface RenderOptions {
  format: OutputFormat;
  fields: string[];
  stdoutIsTTY: boolean;
}

export function resolveFormat(format: OutputFormat, stdoutIsTTY: boolean): Exclude<OutputFormat, 'auto'> {
  return format === 'auto' ? (stdoutIsTTY ? 'table' : 'json') : format;
}

export function renderResult(result: CommandResult, options: RenderOptions): Uint8Array | string {
  const format = resolveFormat(options.format, options.stdoutIsTTY);
  const projected = project(result.data, options.fields);
  const renderedResult: CommandResult = { ...result, data: projected };
  if (format === 'json') return `${JSON.stringify(envelope(renderedResult))}\n`;
  if (format === 'ndjson') return renderNdjson(renderedResult);
  if (format === 'raw') {
    if (result.raw !== undefined && options.fields.length === 0) return result.raw;
    return renderRaw(projected);
  }
  if (format === 'csv') return renderCsv(projected);
  return renderTable(projected);
}

export function writeError(stream: Writable, details: ErrorDetails, format: ErrorFormat, machineMode: boolean, verboseCause?: unknown): void {
  const resolved = format === 'auto' ? (machineMode ? 'json' : 'text') : format;
  if (resolved === 'json') {
    stream.write(`${JSON.stringify({
      schema_version: 1,
      error: {
        code: details.code,
        message: details.message,
        retryable: details.retryable ?? false,
        ...(details.field ? { field: details.field } : {}),
        ...(details.identifier ? { identifier: details.identifier } : {}),
        ...(details.service ? { service: details.service } : {}),
        ...(details.httpStatus ? { http_status: details.httpStatus } : {}),
        ...(details.requestId ? { request_id: details.requestId } : {}),
        ...(details.retryAfterSeconds !== undefined ? { retry_after_seconds: details.retryAfterSeconds } : {}),
        ...(details.outcomeUnknown ? { outcome_unknown: true } : {}),
        ...(details.hint ? { hint: details.hint } : {}),
      },
    })}\n`);
    return;
  }
  stream.write(`Error: ${details.message}\n`);
  if (details.hint) stream.write(`Hint: ${details.hint}\n`);
  if (verboseCause) stream.write(`Cause: ${String(verboseCause)}\n`);
}

function project(data: unknown, fields: string[]): unknown {
  if (fields.length === 0) return data;
  const one = (item: unknown): unknown => {
    if (fields.length === 1) return getPath(item, fields[0]!);
    return Object.fromEntries(fields.map((field) => [field, getPath(item, field)]));
  };
  return Array.isArray(data) ? data.map(one) : one(data);
}

function getPath(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object' || !(part in current)) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function renderNdjson(result: CommandResult): string {
  const items = Array.isArray(result.data) ? result.data : [result.data];
  const lines = items.map((data) => JSON.stringify({ type: 'item', data }));
  const hasMore = result.meta?.has_more ?? false;
  const partial = result.meta?.partial ?? false;
  lines.push(JSON.stringify({ type: 'summary', meta: { count: items.length, complete: !hasMore && !partial, has_more: hasMore, next_cursor: result.meta?.next_cursor ?? null } }));
  return `${lines.join('\n')}\n`;
}

function renderRaw(data: unknown): string {
  if (typeof data === 'string') return data.endsWith('\n') ? data : `${data}\n`;
  if (data instanceof Uint8Array) return Buffer.from(data).toString('utf8');
  if (Array.isArray(data)) return `${data.map(rawScalar).join('\n')}\n`;
  return `${rawScalar(data)}\n`;
}

function rawScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function renderCsv(data: unknown): string {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return '\n';
  if (!rows.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))) return `${rows.map(csvCell).join('\n')}\n`;
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row as object)))];
  return `${[keys.map(csvCell).join(','), ...rows.map((row) => keys.map((key) => csvCell((row as Record<string, unknown>)[key])).join(','))].join('\n')}\n`;
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function renderTable(data: unknown): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return 'No results.\n';
    if (data.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))) {
      const keys = [...new Set(data.flatMap((row) => Object.keys(row as object)))];
      const lines = [keys.join('\t'), ...data.map((row) => keys.map((key) => compact((row as Record<string, unknown>)[key])).join('\t'))];
      return `${lines.join('\n')}\n`;
    }
    return `${data.map(compact).join('\n')}\n`;
  }
  if (data !== null && typeof data === 'object') return `${Object.entries(data).map(([key, value]) => `${key}: ${compact(value)}`).join('\n')}\n`;
  return `${compact(data)}\n`;
}

function compact(value: unknown): string {
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}
