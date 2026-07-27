import { readFileSync } from 'node:fs';
import { CliError, EXIT } from '../contracts/error.js';
import type { CommandResult } from '../contracts/output.js';
import { configPath, effectiveSettings, readConfig, setConfigValue, unsetConfigValue } from '../core/config-store.js';
import { manifest, manifestDigest, packageMetadata, serviceSource } from '../core/metadata.js';
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

export function doctorResult(runtime: Runtime): CommandResult {
  let configCheck: Record<string, unknown>;
  try {
    readConfig(runtime);
    configCheck = { name: 'config', status: 'ok', path: configPath(runtime), hint: null };
  } catch (error) {
    configCheck = { name: 'config', status: 'failed', path: configPath(runtime), hint: error instanceof CliError ? error.details.hint : 'Repair config file' };
  }
  const checks = [
    configCheck,
    { name: 'node', status: Number(process.versions.node.split('.')[0]) >= 20 ? 'ok' : 'failed', version: process.versions.node, hint: 'Install Node.js 20 or newer' },
    ...manifest.services.map((service) => ({ name: service.id, status: service.health === 'stable' ? 'not_checked' : service.health, access: service.access_tier, hint: service.health === 'stable' ? 'Use service commands to verify anonymous reachability' : service.evidence })),
  ];
  return result('doctor', 'local', checks, { ready: checks.every((check) => check.status !== 'failed') });
}

function result(command: string, service: string, data: unknown, meta?: Record<string, unknown>): CommandResult {
  return { command, source: serviceSource(service), data, ...(meta ? { meta } : {}) };
}
