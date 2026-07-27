import { basename, resolve } from 'node:path';
import { CliError, EXIT, usageError } from '../contracts/error.js';
import type { CommandResult, OutputFormat } from '../contracts/output.js';
import { artifactToStream, assertArtifactResponse, saveArtifact, validateArtifactDestination } from '../core/artifact-writer.js';
import { request, requestJson, parseDuration, type QueryValue } from '../core/http.js';
import { serviceSource } from '../core/metadata.js';
import type { Runtime } from '../runtime.js';
import { numberOption, type QueryOptions } from './catalog.js';

export const fiksOrigin = 'https://fiksvegdata-api.atlas.vegvesen.no';
export const reportsOrigin = 'https://nvdbrapportapi.atlas.vegvesen.no';
export const reportFamilies = [
  { id: 'road-list', path: 'rapporter/veglister', required: 'class', asynchronous: true },
  { id: 'contract', path: 'rapporter/driftskontrakt', required: 'report-type', asynchronous: true },
  { id: 'kostra', path: 'rapporter/kostra', required: 'report-type', asynchronous: true },
  { id: 'geopackage', path: 'rapporter/geopackage', required: null, asynchronous: true },
  { id: 'expert', path: 'rapporter/ekspertrapport', required: 'report-type', asynchronous: false },
] as const;

interface MutationOptions extends QueryOptions { dryRun?: boolean | undefined; yes?: boolean | undefined }
interface ArtifactOptions extends QueryOptions { output?: string | undefined; overwrite?: boolean | undefined; allowTerminalBinary?: boolean | undefined; format?: OutputFormat | undefined }

export async function fiksRead(runtime: Runtime, command: string, path: string, query: Record<string, QueryValue>, options: QueryOptions): Promise<CommandResult> {
  const result = await requestJson<unknown>(runtime, { service: 'fiks', canonicalOrigin: fiksOrigin, path: `api/v1/${path}`, query, timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true });
  const items = Array.isArray(result.data) ? result.data : Array.isArray((result.data as any)?.feilmeldinger) ? (result.data as any).feilmeldinger : undefined;
  if (items) {
    const limit = options.all ? items.length : Number(options.limit ?? 100);
    const selected = items.slice(0, limit);
    if (options.all) return { command, source: serviceSource('fiks'), data: null, stream: arrayStream(selected) };
    const data = Array.isArray(result.data) ? selected : { ...(result.data as any), feilmeldinger: selected };
    return { command, source: serviceSource('fiks'), data, raw: result.raw, meta: { count: selected.length, has_more: items.length > limit, next_cursor: null } };
  }
  return { command, source: serviceSource('fiks'), data: result.data, raw: result.raw };
}

export async function fiksCreate(runtime: Runtime, body: unknown, options: MutationOptions): Promise<CommandResult> {
  validateIssue(body);
  if (options.dryRun) { const value = body as Record<string, unknown>; return { command: 'fiks issue create', source: serviceSource('fiks'), data: { dry_run: true, method: 'POST', path: '/api/v1/feilmelding/anonym', body_fields: Object.keys(value).sort(), category: value.kategori, has_location: value.lokasjon !== undefined, has_email: value.email !== undefined } }; }
  if (!options.yes) throw new CliError({ code: 'CONFIRMATION_REQUIRED', message: 'Anonymous issue creation requires --yes', exitCode: EXIT.conflict, retryable: false, field: 'yes', hint: 'Review with --dry-run, then repeat with --yes' });
  try {
    const result = await requestJson<unknown>(runtime, { service: 'fiks', canonicalOrigin: fiksOrigin, path: 'api/v1/feilmelding/anonym', method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, timeout: options.timeout, retries: 0, safeToRetry: false });
    return { command: 'fiks issue create', source: serviceSource('fiks'), data: result.data, raw: result.raw };
  } catch (error) { throw ambiguousMutation(error, 'Check the issue list before deciding whether to submit again'); }
}

export async function fiksAddAttachment(runtime: Runtime, issueId: string, paths: string[], options: MutationOptions): Promise<CommandResult> {
  if (paths.length === 0) throw usageError('At least one --file is required', 'Pass --file PATH', 'file');
  if (paths.length > 10) throw usageError('At most 10 attachments are allowed per request', 'Split files across separately confirmed requests', 'file');
  const resolvedPaths = paths.map((path) => resolve(runtime.cwd, path));
  let totalSize = 0;
  for (const path of resolvedPaths) {
    if (!runtime.fs.existsSync(path)) throw usageError(`Attachment does not exist: ${path}`, 'Pass an existing local file', 'file');
    const stat = runtime.fs.statSync(path);
    if (!stat.isFile()) throw usageError(`Attachment must be a regular file: ${path}`, 'Pass a regular local file', 'file');
    if (stat.size > 10 * 1024 * 1024) throw usageError(`Attachment exceeds 10 MiB: ${basename(path)}`, 'Reduce the file size', 'file');
    totalSize += stat.size;
  }
  if (totalSize > 25 * 1024 * 1024) throw usageError('Combined attachments exceed 25 MiB', 'Split files across separately confirmed requests', 'file');
  const plan = { dry_run: options.dryRun === true, method: 'POST', path: `/api/v1/feilmelding/${issueId}/vedlegg`, files: resolvedPaths.map((path) => basename(path)), total_size_bytes: totalSize };
  if (options.dryRun) return { command: 'fiks attachment add', source: serviceSource('fiks'), data: plan };
  if (!options.yes) throw new CliError({ code: 'CONFIRMATION_REQUIRED', message: 'Attachment upload requires --yes', exitCode: EXIT.conflict, retryable: false, field: 'yes', hint: 'Review with --dry-run, then repeat with --yes' });
  const form = new FormData();
  for (const path of resolvedPaths) form.append('file', new Blob([runtime.fs.readFileSync(path)]), basename(path));
  try {
    const result = await requestJson<unknown>(runtime, { service: 'fiks', canonicalOrigin: fiksOrigin, path: `api/v1/feilmelding/${issueId}/vedlegg`, method: 'POST', body: form, timeout: options.timeout, retries: 0, safeToRetry: false });
    return { command: 'fiks attachment add', source: serviceSource('fiks'), data: result.data, raw: result.raw };
  } catch (error) { throw ambiguousMutation(error, `Inspect issue ${issueId} before deciding whether to upload again`); }
}

export async function nativeRead(runtime: Runtime, command: string, service: 'fiks' | 'nvdb-reports', origin: string, path: string, query: Record<string, QueryValue>, options: ArtifactOptions): Promise<CommandResult> {
  if (options.format !== undefined && !['auto', 'raw'].includes(options.format)) throw usageError('Native artifact commands accept only --format auto|raw', 'Use --format raw', 'format');
  const destination = validateArtifactDestination(runtime, options.output, options.overwrite === true, options.allowTerminalBinary === true);
  const upstream = await request(runtime, { service, canonicalOrigin: origin, path, query, accept: '*/*', timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true });
  if (destination === '-') { assertArtifactResponse(upstream.response, service); return { command, source: serviceSource(service), data: null, nativeStream: artifactToStream(upstream.response), outputHandled: true }; }
  return { command, source: serviceSource(service), data: await saveArtifact(runtime, upstream.response, destination, service, options.overwrite === true), outputHandled: true };
}

export function reportFamilyList(): CommandResult { return { command: 'nvdb report family list', source: serviceSource('nvdb-reports'), data: reportFamilies }; }

export async function reportGenerate(runtime: Runtime, familyId: string, parameters: Record<string, string>, options: QueryOptions & { dryRun?: boolean | undefined; yes?: boolean | undefined }): Promise<CommandResult> {
  const family = reportFamilies.find((item) => item.id === familyId);
  if (!family) throw usageError(`Unknown report family: ${familyId}`, `Use ${reportFamilies.map((item) => item.id).join(', ')}`, 'family');
  const required = family.required && parameters[family.required];
  if (family.required && !required) throw usageError(`Report ${familyId} requires --param ${family.required}=VALUE`, 'Inspect nvdb report family list and add the required parameter', 'param');
  if (family.id === 'road-list' && !parameters.dato) throw usageError('Road-list reports require --param dato=YYYY-MM-DD', 'Pass an explicit report date', 'param');
  if (family.id === 'road-list' && !parameters.kommune && !parameters.fylke) throw usageError('Road-list reports require kommune or fylke', 'Pass --param kommune=NUMBER or --param fylke=NUMBER', 'param');
  let path: string = family.path;
  if (family.id === 'road-list') path += `/${encodeURIComponent(required!)}`;
  if (family.id === 'kostra') path += `/${encodeURIComponent(required!)}`;
  const query = { ...parameters };
  delete query.class;
  if (family.id === 'kostra') delete query['report-type'];
  if (family.id === 'contract' || family.id === 'expert') { query.rapporttype = required!; delete query['report-type']; }
  if (options.dryRun) return { command: 'nvdb report generate', source: serviceSource('nvdb-reports'), data: { dry_run: true, family: familyId, method: 'GET', path: `/${path}`, parameters: query } };
  if (!options.yes) throw new CliError({ code: 'CONFIRMATION_REQUIRED', message: 'Report generation may consume significant upstream resources and requires --yes', exitCode: EXIT.conflict, retryable: false, field: 'yes', hint: 'Review with --dry-run, then repeat with --yes' });
  try {
    const result = await requestJson<any>(runtime, { service: 'nvdb-reports', canonicalOrigin: reportsOrigin, path, query, timeout: options.timeout, retries: 0, safeToRetry: false });
    return { command: 'nvdb report generate', source: serviceSource('nvdb-reports'), data: { ...result.data, family: familyId, resumable_command: result.data?.id ? `vegvesen nvdb report job get ${result.data.id} --format json` : undefined }, raw: result.raw };
  } catch (error) {
    if (error instanceof CliError && ['NETWORK_TIMEOUT', 'NETWORK_FAILED'].includes(error.details.code)) throw new CliError({ code: 'JOB_START_OUTCOME_UNKNOWN', message: 'Connection failed after report submission; remote job outcome is unknown', exitCode: EXIT.network, retryable: false, service: 'nvdb-reports', hint: 'Do not submit an expensive report again until checking service activity' }, { cause: error });
    throw error;
  }
}

export async function reportJob(runtime: Runtime, id: string, wait: boolean, options: QueryOptions & { waitTimeout?: string }): Promise<CommandResult> {
  const deadline = runtime.now().getTime() + parseDuration(options.waitTimeout ?? '2m');
  while (true) {
    const result = await requestJson<any>(runtime, { service: 'nvdb-reports', canonicalOrigin: reportsOrigin, path: `rapporter/poll/${encodeURIComponent(id)}`, timeout: options.timeout, retries: numberOption(options.retries), safeToRetry: true });
    const status = String(result.data?.status ?? 'UNKNOWN').toUpperCase();
    if (!wait || ['SUCCESS', 'FAILED', 'UNKNOWN', 'EXPIRED'].includes(status)) return { command: wait ? 'nvdb report job wait' : 'nvdb report job get', source: serviceSource('nvdb-reports'), data: result.data, raw: result.raw, meta: { normalized_state: normalizeJob(status) } };
    if (runtime.now().getTime() >= deadline) throw new CliError({ code: 'JOB_WAIT_TIMEOUT', message: `Report job ${id} did not finish before timeout`, exitCode: EXIT.network, retryable: true, service: 'nvdb-reports', hint: `Resume with vegvesen nvdb report job wait ${id}` });
    await runtime.sleep(1000);
  }
}

function validateIssue(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw usageError('Issue body must be a JSON object', 'Pass --body @issue.json', 'body');
  const body = value as Record<string, unknown>;
  for (const field of ['emne', 'kategori', 'lokasjon', 'vegsystemreferanse']) if (body[field] === undefined) throw usageError(`Issue body requires ${field}`, `Add JSON field ${field}`, field);
  const categories = ['BRUKERSTØTTE', 'FEIL_I_FAGDATA', 'FEIL_I_KARTDATA', 'FEIL_I_RUTEPLANTJENESTEN', 'FEIL_I_VEGNETTSDATA', 'SYKKEL_OG_SYKKELRUTE', 'FEIL_I_FARTSGRENSEDATA', 'FYSISKE_FEIL_PÅ_VEI'];
  if (!categories.includes(String(body.kategori))) throw usageError(`Unknown Fiks category: ${body.kategori}`, `Use ${categories.join(', ')}`, 'kategori');
  if (typeof body.emne !== 'string' || !body.emne.trim()) throw usageError('Issue emne must be non-empty text', 'Add a concise emne', 'emne');
  if (!body.lokasjon || typeof body.lokasjon !== 'object' || Array.isArray(body.lokasjon)) throw usageError('Issue lokasjon must be an object', 'Add the documented location object', 'lokasjon');
}
function normalizeJob(status: string): string { return ({ PENDING: 'queued', STARTED: 'running', RUNNING: 'running', SUCCESS: 'succeeded', FAILED: 'failed', UNKNOWN: 'expired', EXPIRED: 'expired' } as Record<string, string>)[status] ?? 'running'; }
function ambiguousMutation(error: unknown, hint: string): unknown { if (error instanceof CliError && ['NETWORK_TIMEOUT', 'NETWORK_FAILED'].includes(error.details.code)) return new CliError({ code: 'MUTATION_OUTCOME_UNKNOWN', message: 'Connection failed after mutation submission; remote outcome is unknown', exitCode: EXIT.network, retryable: false, service: 'fiks', hint }, { cause: error }); return error; }
async function* arrayStream(items: unknown[]): AsyncGenerator<{ type: 'item'; data: unknown } | { type: 'summary'; meta: Record<string, unknown> }> { let count = 0; for (const data of items) { count += 1; yield { type: 'item', data }; } yield { type: 'summary', meta: { count, complete: true, has_more: false } }; }
