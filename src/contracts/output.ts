export const SCHEMA_VERSION = 1;

export type OutputFormat = 'auto' | 'json' | 'ndjson' | 'table' | 'csv' | 'raw';
export type ErrorFormat = 'auto' | 'text' | 'json';

export interface SourceDescriptor {
  service: string;
  spec_digest: string;
}

export interface ResultMeta {
  count: number;
  has_more: boolean;
  next_cursor: string | null;
  partial: boolean;
  [key: string]: unknown;
}

export type StreamRecord =
  | { type: 'item'; data: unknown }
  | { type: 'summary'; meta: Record<string, unknown> };

export interface CommandResult<T = unknown> {
  command: string;
  source: SourceDescriptor;
  data: T;
  meta?: Partial<ResultMeta>;
  raw?: string | Uint8Array;
  outputHandled?: boolean;
  stream?: AsyncIterable<StreamRecord>;
  exitCode?: number;
}

export interface OutputEnvelope<T = unknown> {
  schema_version: 1;
  command: string;
  source: SourceDescriptor;
  data: T;
  meta: ResultMeta;
}

export function envelope<T>(result: CommandResult<T>): OutputEnvelope<T> {
  const inferredCount = Array.isArray(result.data) ? result.data.length : result.data === null ? 0 : 1;
  return {
    schema_version: SCHEMA_VERSION,
    command: result.command,
    source: result.source,
    data: result.data,
    meta: {
      count: inferredCount,
      has_more: false,
      next_cursor: null,
      partial: false,
      ...result.meta,
    },
  };
}
