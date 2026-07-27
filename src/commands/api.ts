import { readFileSync } from 'node:fs';
import { CliError, EXIT, usageError } from '../contracts/error.js';
import type { CommandResult } from '../contracts/output.js';
import { readResponseText, request } from '../core/http.js';
import { serviceSource } from '../core/metadata.js';
import type { Runtime } from '../runtime.js';
import { numberOption, type QueryOptions } from './catalog.js';

interface Operation { service: string; id: string; method: 'GET' | 'POST'; origin: string; path: string; path_parameters: string[]; query_parameters: string[]; effect: 'read'; retry: 'safe' }
const operations = (JSON.parse(readFileSync(new URL('../../specs/public-operations.json', import.meta.url), 'utf8')) as { operations: Operation[] }).operations;

export function apiServiceList(): CommandResult { return result('api service list', [...new Set(operations.map((item) => item.service))].map((service) => ({ service, operation_count: operations.filter((item) => item.service === service).length }))); }
export function apiOperationList(service: string): CommandResult { const items = operations.filter((item) => item.service === service).map(publicOperation); if (!items.length) throw usageError(`No generated operations for service: ${service}`, 'Use vegvesen api service list', 'service'); return result('api operation list', items); }
export function apiOperationDescribe(service: string, id: string): CommandResult { return result('api operation describe', publicOperation(find(service, id))); }

export async function apiOperationCall(runtime: Runtime, service: string, id: string, parameters: Record<string, string>, options: QueryOptions): Promise<CommandResult> {
  const operation = find(service, id);
  const allowed = new Set([...operation.path_parameters, ...operation.query_parameters]);
  for (const key of Object.keys(parameters)) if (!allowed.has(key)) throw usageError(`Unknown operation parameter: ${key}`, `Allowed: ${[...allowed].join(', ')}`, 'param');
  let path = operation.path;
  for (const name of operation.path_parameters) {
    const value = parameters[name];
    if (!value) throw usageError(`Missing path parameter: ${name}`, `Pass --param ${name}=VALUE`, 'param');
    path = path.replace(`{${name}}`, encodeURIComponent(value));
  }
  const query = Object.fromEntries(operation.query_parameters.flatMap((name) => parameters[name] === undefined ? [] : [[name, parameters[name]!]]));
  const upstream = await request(runtime, { service: operation.service, canonicalOrigin: operation.origin, path, query, method: operation.method, headers: operation.service.startsWith('nvdb') ? { 'X-Client': 'vegvesen-cli/generated-operation' } : undefined, timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: operation.retry === 'safe', accept: 'application/json' });
  const raw = await readResponseText(upstream.response, service);
  let data: unknown;
  try { data = JSON.parse(raw); } catch (error) { throw new CliError({ code: 'INVALID_UPSTREAM_JSON', message: 'Generated operation returned malformed JSON', exitCode: EXIT.protocol, retryable: false, service, hint: 'Check operation metadata and upstream health' }, { cause: error }); }
  return { command: 'api operation call', source: serviceSource(service), data, raw, meta: { operation_id: id } };
}
function find(service: string, id: string): Operation { const operation = operations.find((item) => item.service === service && item.id === id); if (!operation) throw usageError(`Unknown generated operation: ${service}/${id}`, 'Use vegvesen api operation list SERVICE', 'operation'); return operation; }
function publicOperation(operation: Operation): Omit<Operation, 'origin'> { return { service: operation.service, id: operation.id, method: operation.method, path: operation.path, path_parameters: operation.path_parameters, query_parameters: operation.query_parameters, effect: operation.effect, retry: operation.retry }; }
function result(command: string, data: unknown): CommandResult { return { command, source: serviceSource('api'), data }; }
