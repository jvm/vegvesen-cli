import { CliError, EXIT } from '../contracts/error.js';
import type { Runtime } from '../runtime.js';

export interface HttpOptions {
  service: string;
  canonicalOrigin: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined> | undefined;
  headers?: Record<string, string> | undefined;
  method?: 'GET' | 'HEAD' | 'POST' | undefined;
  body?: string | undefined;
  timeout?: string | undefined;
  retries?: number | undefined;
  safeToRetry?: boolean | undefined;
  accept?: string | undefined;
}

export interface HttpResponse {
  url: URL;
  status: number;
  headers: Headers;
  response: Response;
}

const transientStatuses = new Set([429, 502, 503, 504]);
const forbiddenHeaders = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i;

export async function request(runtime: Runtime, options: HttpOptions): Promise<HttpResponse> {
  const baseUrl = resolveBaseUrl(runtime, options.service, options.canonicalOrigin);
  const url = new URL(options.path.replace(/^\//, ''), ensureSlash(baseUrl));
  for (const [key, value] of Object.entries(options.query ?? {})) if (value !== undefined) url.searchParams.append(key, String(value));
  const headers = new Headers(options.headers);
  headers.set('Accept', options.accept ?? 'application/json');
  headers.set('User-Agent', 'vegvesen-cli');
  for (const name of headers.keys()) if (forbiddenHeaders.test(name)) throw new CliError({ code: 'CREDENTIAL_HEADER_FORBIDDEN', message: `Credential header is forbidden: ${name}`, exitCode: EXIT.access, retryable: false, field: 'header', hint: 'Version 1 supports anonymous operations only' });

  const retries = options.safeToRetry === false ? 0 : Math.min(options.retries ?? 2, 10);
  let attempt = 0;
  while (true) {
    try {
      const response = await fetchWithRedirects(runtime, url, headers, options, parseDuration(options.timeout ?? '30s'));
      if (transientStatuses.has(response.status) && attempt < retries) {
        await runtime.sleep(retryDelay(response.headers, attempt, runtime.random, runtime.now));
        attempt += 1;
        continue;
      }
      if (response.status < 200 || response.status >= 300) throw statusError(response, options.service, runtime.now);
      return response;
    } catch (error) {
      if (error instanceof CliError) throw error;
      if (attempt < retries && isTransientNetworkError(error)) {
        await runtime.sleep(backoff(attempt, runtime.random));
        attempt += 1;
        continue;
      }
      const timeout = error instanceof DOMException && error.name === 'TimeoutError';
      throw new CliError({ code: timeout ? 'NETWORK_TIMEOUT' : 'NETWORK_FAILED', message: timeout ? `Request timed out after ${options.timeout ?? '30s'}` : 'Network request failed', exitCode: EXIT.network, retryable: true, service: options.service, hint: timeout ? 'Increase --timeout or retry later' : 'Check network connectivity and service status' }, { cause: error });
    }
  }
}

export async function requestJson<T>(runtime: Runtime, options: HttpOptions): Promise<{ data: T; response: HttpResponse; raw: string }> {
  const response = await request(runtime, options);
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType && mediaType !== 'application/json' && !mediaType.endsWith('+json')) throw new CliError({ code: 'UNEXPECTED_CONTENT_TYPE', message: `Expected JSON but received ${mediaType}`, exitCode: EXIT.protocol, retryable: false, service: options.service, httpStatus: response.status, hint: 'Check service health and retry; use artifact command for native files' });
  try {
    const raw = await response.response.text();
    return { data: JSON.parse(raw) as T, response, raw };
  } catch (error) {
    throw new CliError({ code: 'INVALID_UPSTREAM_JSON', message: 'Upstream returned malformed JSON', exitCode: EXIT.protocol, retryable: false, service: options.service, httpStatus: response.status, hint: 'Check service health and retry later' }, { cause: error });
  }
}

function resolveBaseUrl(runtime: Runtime, service: string, canonicalOrigin: string): URL {
  const envName = `VEGVESEN_${service.toUpperCase().replaceAll('-', '_')}_BASE_URL`;
  const value = runtime.env[envName] ?? canonicalOrigin;
  let url: URL;
  try { url = new URL(value); } catch { throw new CliError({ code: 'INVALID_BASE_URL', message: `${envName} is not a valid URL`, exitCode: EXIT.access, retryable: false, field: envName, hint: 'Use an absolute http:// or https:// URL without credentials' }); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new CliError({ code: 'INVALID_BASE_URL', message: `${envName} must use HTTP(S) without URL credentials`, exitCode: EXIT.access, retryable: false, field: envName, hint: 'Remove URL userinfo and use an unauthenticated test endpoint' });
  return url;
}

async function fetchWithRedirects(runtime: Runtime, initial: URL, headers: Headers, options: HttpOptions, timeoutMs: number): Promise<HttpResponse> {
  let url = initial;
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    const response = await runtime.fetch(url, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body === undefined ? {} : { body: options.body }),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new CliError({ code: 'INVALID_REDIRECT', message: 'Upstream redirect omitted Location', exitCode: EXIT.protocol, retryable: false, service: options.service, hint: 'Report the upstream protocol failure' });
      const next = new URL(location, url);
      if (next.origin !== initial.origin) throw new CliError({ code: 'CROSS_ORIGIN_REDIRECT_REFUSED', message: `Refused redirect from ${initial.origin} to ${next.origin}`, exitCode: EXIT.access, retryable: false, service: options.service, hint: 'Use canonical service origin or an explicit test override' });
      url = next;
      continue;
    }
    return { url, status: response.status, headers: response.headers, response };
  }
  throw new CliError({ code: 'TOO_MANY_REDIRECTS', message: 'Upstream exceeded five redirects', exitCode: EXIT.protocol, retryable: false, service: options.service, hint: 'Check service health and canonical origin' });
}

function statusError(response: HttpResponse, service: string, now: () => Date): CliError {
  const requestId = response.headers.get('x-request-id') ?? response.headers.get('traceparent') ?? undefined;
  const common = { service, httpStatus: response.status, ...(requestId ? { requestId } : {}) };
  if (response.status === 401 || response.status === 403) return new CliError({ code: 'ACCESS_NOT_AVAILABLE_IN_V1', message: `Anonymous access unavailable for ${service}`, exitCode: EXIT.access, retryable: false, ...common, hint: 'Check service metadata; version 1 provides no credential workaround' });
  if (response.status === 404) return new CliError({ code: 'RESOURCE_NOT_FOUND', message: 'Upstream resource not found', exitCode: EXIT.notFound, retryable: false, ...common, hint: 'Verify exact identifier with the related list command' });
  if (response.status === 409 || response.status === 412) return new CliError({ code: 'UPSTREAM_CONFLICT', message: 'Upstream refused request due to conflict or precondition', exitCode: EXIT.conflict, retryable: false, ...common, hint: 'Refresh resource state before retrying' });
  if (transientStatuses.has(response.status)) {
    const retryAfterSeconds = retryAfter(response.headers, now);
    return new CliError({ code: response.status === 429 ? 'UPSTREAM_RATE_LIMITED' : 'UPSTREAM_UNAVAILABLE', message: response.status === 429 ? 'Upstream rate limit reached' : 'Upstream service temporarily unavailable', exitCode: EXIT.transient, retryable: true, ...common, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }), hint: retryAfterSeconds === undefined ? 'Retry with bounded backoff' : `Retry after ${retryAfterSeconds} seconds` });
  }
  return new CliError({ code: 'UPSTREAM_HTTP_ERROR', message: `Upstream returned HTTP ${response.status}`, exitCode: EXIT.protocol, retryable: false, ...common, hint: 'Check service health and request parameters' });
}

export function parseDuration(value: string): number {
  const match = /^(\d+)(ms|s|m)$/.exec(value);
  if (!match) throw new CliError({ code: 'INVALID_DURATION', message: `Invalid duration: ${value}`, exitCode: EXIT.usage, retryable: false, field: 'timeout', hint: 'Use milliseconds, seconds, or minutes, such as 500ms, 10s, or 2m' });
  const amount = Number(match[1]);
  const multiplier = match[2] === 'ms' ? 1 : match[2] === 's' ? 1000 : 60000;
  if (amount * multiplier < 1 || amount * multiplier > 600000) throw new CliError({ code: 'INVALID_DURATION', message: 'Timeout must be between 1ms and 10m', exitCode: EXIT.usage, retryable: false, field: 'timeout', hint: 'Pass --timeout 30s' });
  return amount * multiplier;
}

function retryAfter(headers: Headers, now: () => Date): number | undefined {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, Math.ceil((timestamp - now().getTime()) / 1000));
}

function retryDelay(headers: Headers, attempt: number, random: () => number, now: () => Date): number {
  const seconds = retryAfter(headers, now);
  return seconds === undefined ? backoff(attempt, random) : Math.min(seconds * 1000, 60000);
}

function backoff(attempt: number, random: () => number): number {
  return Math.min(250 * 2 ** attempt + Math.floor(random() * 100), 5000);
}

function isTransientNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError');
}

function ensureSlash(url: URL): URL {
  const copy = new URL(url);
  if (!copy.pathname.endsWith('/')) copy.pathname += '/';
  return copy;
}
