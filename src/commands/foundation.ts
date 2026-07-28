import { readFileSync } from 'node:fs';
import { CliError, EXIT } from '../contracts/error.js';
import type { CommandResult } from '../contracts/output.js';
import { configPath, effectiveSettings, readConfig, setConfigValue, unsetConfigValue } from '../core/config-store.js';
import { manifest, manifestDigest, packageMetadata, serviceSource } from '../core/metadata.js';
import { request } from '../core/http.js';
import { commandRegistry } from '../registry.js';
import type { Runtime } from '../runtime.js';

export function versionResult(): CommandResult {
  return result('version', 'local', {
    cli_version: packageMetadata.version,
    node_version: process.versions.node,
    supported_schema_versions: [1],
    api_manifest_digest: manifestDigest,
  });
}

export function serviceList(): CommandResult {
  return result('service list', 'local', manifest.services.map(({ id, title, access_tier, health, verified_at }) => ({ id, title, access_tier, health, verified_at })));
}

export function serviceGet(id: string): CommandResult {
  const service = manifest.services.find((candidate) => candidate.id === id);
  if (!service) throw new CliError({ code: 'SERVICE_NOT_FOUND', message: `Unknown service: ${id}`, exitCode: EXIT.notFound, retryable: false, identifier: id, hint: "Run 'vegvesen service list --format json' for valid service IDs" });
  return result('service get', 'local', service);
}

export function commandSchema(path: string[]): CommandResult {
  const normalized = path.join(' ');
  const commands = normalized ? commandRegistry.filter((entry) => entry.path === normalized || entry.path.startsWith(`${normalized} `)) : commandRegistry;
  if (commands.length === 0) throw new CliError({ code: 'COMMAND_NOT_FOUND', message: `Unknown command path: ${normalized}`, exitCode: EXIT.notFound, retryable: false, identifier: normalized, hint: "Run 'vegvesen schema command --format json' to list command paths" });
  return result('schema command', 'local', commands);
}

export function completionResult(shell: string): CommandResult {
  const words = [...new Set(commandRegistry.flatMap((entry) => entry.path.split(' ')))].sort().join(' ');
  const scripts: Record<string, string> = {
    bash: `_vegvesen_complete() { COMPREPLY=( $(compgen -W '${words}' -- "\${COMP_WORDS[COMP_CWORD]}") ); }\ncomplete -F _vegvesen_complete vegvesen\n`,
    zsh: `#compdef vegvesen\n_arguments '*:command:(${words})'\n`,
    fish: `complete -c vegvesen -f -a '${words}'\n`,
  };
  const script = scripts[shell];
  if (!script) throw new CliError({ code: 'INVALID_SHELL', message: `Unsupported shell: ${shell}`, exitCode: EXIT.usage, retryable: false, field: 'shell', hint: 'Use bash, zsh, or fish' });
  return { command: 'completion', source: serviceSource('local'), data: { shell, script }, raw: script };
}

export function outputSchema(path: string[]): CommandResult {
  if (path.length > 0) commandSchema(path);
  const schema = JSON.parse(readFileSync(new URL('../../schemas/output.schema.json', import.meta.url), 'utf8')) as unknown;
  return result('schema output', 'local', schema, { command_path: path.join(' ') || null });
}

export function configPathResult(runtime: Runtime): CommandResult {
  return result('config path', 'local', { path: configPath(runtime) });
}

export function configShow(runtime: Runtime, profile?: string): CommandResult {
  const config = readConfig(runtime);
  const effective = effectiveSettings(runtime, profile);
  return result('config show', 'local', { path: configPath(runtime), selected_profile: profile ?? runtime.env.VEGVESEN_PROFILE ?? null, config, effective: effective.values, sources: effective.sources });
}

export function configValidate(runtime: Runtime): CommandResult {
  readConfig(runtime);
  return result('config validate', 'local', { valid: true, path: configPath(runtime) });
}

export function configSet(runtime: Runtime, key: string, value: string, profile?: string): CommandResult {
  setConfigValue(runtime, key, value, profile);
  return result('config set', 'local', { changed: true, key, profile: profile ?? null, path: configPath(runtime) });
}

export function configUnset(runtime: Runtime, key: string, profile?: string): CommandResult {
  unsetConfigValue(runtime, key, profile);
  return result('config unset', 'local', { changed: true, key, profile: profile ?? null, path: configPath(runtime) });
}

export interface DoctorOptions {
  live?: boolean | undefined;
  timeout?: string | undefined;
  retries?: string | undefined;
  configProfile?: string | undefined;
}

export async function doctorResult(runtime: Runtime, options: DoctorOptions = {}): Promise<CommandResult> {
  let configCheck: Record<string, unknown>;
  let configured: ReturnType<typeof effectiveSettings> | undefined;
  try {
    readConfig(runtime);
    configured = effectiveSettings(runtime, options.configProfile);
    configCheck = { name: 'config', status: 'ok', path: configPath(runtime), hint: null };
  } catch (error) {
    configCheck = { name: 'config', status: 'failed', path: configPath(runtime), hint: error instanceof CliError ? error.details.hint : 'Repair config file' };
  }
  const liveChecks = options.live && configured ? new Map((await probeAnonymousServices(runtime, {
    timeout: options.timeout ?? configured.values.timeout,
    retries: options.retries ?? (configured.values.retries === undefined ? undefined : String(configured.values.retries)),
    xClient: configured.values.x_client ?? `vegvesen-cli/${packageMetadata.version}`,
  })).map((check) => [check.name, check])) : new Map<string, Record<string, unknown>>();
  const checks = [
    configCheck,
    { name: 'node', status: Number(process.versions.node.split('.')[0]) >= 20 ? 'ok' : 'failed', version: process.versions.node, hint: 'Install Node.js 20 or newer' },
    ...manifest.services.map((service) => liveChecks.get(service.id) ?? ({ name: service.id, status: service.health.startsWith('stable') ? 'not_checked' : service.health, access: service.access_tier, hint: service.health.startsWith('stable') ? "Pass --live to verify anonymous reachability" : service.evidence })),
  ];
  return result('doctor', 'local', checks, { ready: checks.every((check) => !['failed', 'down', 'registration_required'].includes(String(check.status))), live: options.live === true });
}

async function probeAnonymousServices(runtime: Runtime, options: { timeout?: string | undefined; retries?: string | undefined; xClient: string }): Promise<Array<Record<string, unknown>>> {
  const probes = [
    { name: 'catalog', origin: 'https://dataut.vegvesen.no', path: 'api/3/action/status_show' },
    { name: 'nvdb-catalog', origin: 'https://nvdbapiles.atlas.vegvesen.no', path: 'datakatalog/api/v1/versjon', headers: { 'X-Client': options.xClient } },
    { name: 'nvdb-areas', origin: 'https://nvdbapiles.atlas.vegvesen.no', path: 'omrader/api/v4/fylker', headers: { 'X-Client': options.xClient } },
    { name: 'parking', origin: 'https://parkreg-open.atlas.vegvesen.no', path: 'ws/docs/openapi', accept: 'application/yaml, text/yaml' },
    { name: 'nvdb-status', origin: 'https://nvdbstatus-api.atlas.vegvesen.no', path: 'api/v1/systemer' },
    { name: 'nvdb-core', origin: 'https://nvdbapiles.atlas.vegvesen.no', path: 'vegobjekter/api/v4/vegobjekter/105/statistikk', headers: { 'X-Client': options.xClient } },
    { name: 'route', origin: 'https://www.vegvesen.no', path: 'ws/no/vegvesen/ruteplan/routingservice_v3_0/open/routingService/swagger/v1/swagger.json' },
    { name: 'traffic', origin: 'https://trafikkdata-api.atlas.vegvesen.no', path: '', method: 'POST' as const, body: JSON.stringify({ query: 'query { __typename }' }), headers: { 'Content-Type': 'application/json' } },
    { name: 'tnits', origin: 'https://nvdb-tnits.atlas.vegvesen.no', path: 'api/v1/tnits/types' },
    { name: 'ogc', origin: 'https://ogckart-sn1.atlas.vegvesen.no', path: 'ogc/features/v1/', accept: 'application/json' },
    { name: 'nvdb-export', origin: 'https://nvdb-eksport-x.atlas.vegvesen.no', path: '', accept: 'text/html' },
    { name: 'nvdb-reports', origin: 'https://nvdbrapportapi.atlas.vegvesen.no', path: 'swagger.json' },
    { name: 'fiks', origin: 'https://fiksvegdata-api.atlas.vegvesen.no', path: 'api-docs' },
  ];
  return Promise.all(probes.map(async (probe) => {
    try {
      const response = await request(runtime, {
        service: probe.name,
        canonicalOrigin: probe.origin,
        path: probe.path,
        method: probe.method,
        body: probe.body,
        headers: probe.headers,
        accept: probe.accept,
        timeout: options.timeout,
        retries: options.retries === undefined ? undefined : Number(options.retries),
        safeToRetry: true,
      });
      await response.response.body?.cancel();
      return { name: probe.name, status: 'ok', access: 'public-anonymous', http_status: response.status, hint: null };
    } catch (error) {
      const details = error instanceof CliError ? error.details : undefined;
      return {
        name: probe.name,
        status: details?.code === 'ACCESS_NOT_AVAILABLE_IN_V1' ? 'registration_required' : 'down',
        access: 'public-anonymous',
        code: details?.code ?? 'UNKNOWN_PROBE_FAILURE',
        retryable: details?.retryable ?? false,
        hint: details?.hint ?? 'Retry doctor --live with --verbose',
      };
    }
  }));
}

function result(command: string, service: string, data: unknown, meta?: Record<string, unknown>): CommandResult {
  return { command, source: serviceSource(service), data, ...(meta ? { meta } : {}) };
}
