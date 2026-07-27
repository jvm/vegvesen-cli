import { z } from 'zod';

export const settingSchema = z.object({
  format: z.enum(['auto', 'json', 'ndjson', 'table', 'csv', 'raw']).optional(),
  timeout: z.string().regex(/^\d+(?:ms|s|m)$/).optional(),
  retries: z.number().int().min(0).max(10).optional(),
  x_client: z.string().min(3).max(128).regex(/^[\p{L}\p{N} ._/@:+-]+$/u).optional(),
}).strict();

export const configSchema = z.object({
  schema_version: z.literal(1),
  defaults: settingSchema.default({}),
  profiles: z.record(z.string().min(1), settingSchema).default({}),
}).strict();

export type Settings = z.infer<typeof settingSchema>;
export type Config = z.infer<typeof configSchema>;

export const defaultConfig: Config = { schema_version: 1, defaults: {}, profiles: {} };
export const allowedConfigKeys = ['format', 'timeout', 'retries', 'x_client'] as const;
