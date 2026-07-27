import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { allowedConfigKeys, configSchema, defaultConfig, type Config, type Settings } from '../contracts/config.js';
import { CliError, EXIT, usageError } from '../contracts/error.js';
import type { Runtime } from '../runtime.js';

const credentialPattern = /(auth|authorization|bearer|cookie|credential|password|secret|token|api.?key)/i;

export function configPath(runtime: Runtime): string {
  if (runtime.env.VEGVESEN_CONFIG) return runtime.env.VEGVESEN_CONFIG;
  if (runtime.platform === 'win32' && runtime.env.APPDATA) return join(runtime.env.APPDATA, 'vegvesen', 'config.json');
  const root = runtime.env.XDG_CONFIG_HOME ?? (runtime.env.HOME ? join(runtime.env.HOME, '.config') : undefined);
  if (!root) throw new CliError({ code: 'CONFIG_PATH_UNAVAILABLE', message: 'Cannot determine user config directory', exitCode: EXIT.access, retryable: false, hint: 'Set VEGVESEN_CONFIG to an absolute config file path' });
  return join(root, 'vegvesen', 'config.json');
}

export function readConfig(runtime: Runtime): Config {
  const path = configPath(runtime);
  if (!existsSync(path)) return structuredClone(defaultConfig);
  try {
    return configSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    throw new CliError({ code: 'INVALID_CONFIG', message: `Config file is invalid: ${path}`, exitCode: EXIT.access, retryable: false, hint: "Run 'vegvesen config validate' for details" }, { cause: error });
  }
}

export function effectiveSettings(runtime: Runtime, profileName?: string): { values: Settings; sources: Record<string, string> } {
  const config = readConfig(runtime);
  const selected = profileName ?? runtime.env.VEGVESEN_PROFILE;
  const profile = selected ? config.profiles[selected] : undefined;
  if (selected && !profile) throw usageError(`Unknown config profile: ${selected}`, "Run 'vegvesen config show --format json' to inspect profiles", 'config-profile');
  const values: Settings = { ...config.defaults, ...profile };
  const sources: Record<string, string> = {};
  for (const key of Object.keys(config.defaults)) sources[key] = 'user-config';
  if (profile) for (const key of Object.keys(profile)) sources[key] = `profile:${selected}`;
  const envValues: Array<[keyof Settings, string | undefined]> = [
    ['format', runtime.env.VEGVESEN_FORMAT],
    ['timeout', runtime.env.VEGVESEN_TIMEOUT],
    ['x_client', runtime.env.VEGVESEN_X_CLIENT],
  ];
  for (const [key, value] of envValues) if (value !== undefined) { (values as Record<string, unknown>)[key] = value; sources[key] = 'environment'; }
  if (runtime.env.VEGVESEN_RETRIES !== undefined) { values.retries = parseInteger(runtime.env.VEGVESEN_RETRIES, 'VEGVESEN_RETRIES'); sources.retries = 'environment'; }
  const checked = configSchema.shape.defaults.parse(values);
  return { values: checked, sources };
}

export function setConfigValue(runtime: Runtime, key: string, rawValue: string, profileName?: string): Config {
  assertAllowedKey(key);
  const config = readConfig(runtime);
  const value = parseSetting(key as keyof Settings, rawValue);
  const target = profileName ? (config.profiles[profileName] ??= {}) : config.defaults;
  (target as Record<string, unknown>)[key] = value;
  configSchema.parse(config);
  writeConfig(runtime, config);
  return config;
}

export function unsetConfigValue(runtime: Runtime, key: string, profileName?: string): Config {
  assertAllowedKey(key);
  const config = readConfig(runtime);
  const target = profileName ? config.profiles[profileName] : config.defaults;
  if (target) delete (target as Record<string, unknown>)[key];
  writeConfig(runtime, config);
  return config;
}

function assertAllowedKey(key: string): void {
  if (credentialPattern.test(key)) throw usageError(`Credential-like config key is forbidden: ${key}`, `Allowed keys: ${allowedConfigKeys.join(', ')}`, 'key');
  if (!(allowedConfigKeys as readonly string[]).includes(key)) throw usageError(`Unknown config key: ${key}`, `Allowed keys: ${allowedConfigKeys.join(', ')}`, 'key');
}

function parseSetting(key: keyof Settings, value: string): unknown {
  if (key === 'retries') return parseInteger(value, key);
  return value;
}

function parseInteger(value: string, field: string): number {
  if (!/^\d+$/.test(value)) throw usageError(`${field} must be a non-negative integer`, `Pass ${field}=0 or another integer`, field);
  return Number(value);
}

function writeConfig(runtime: Runtime, config: Config): void {
  const path = configPath(runtime);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  let fd: number | undefined;
  try {
    fd = openSync(temporary, 'wx', 0o600);
    writeFileSync(fd, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, path);
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temporary)) unlinkSync(temporary);
    throw new CliError({ code: 'CONFIG_IO_FAILED', message: `Could not write config: ${path}`, exitCode: EXIT.io, retryable: false, hint: 'Check directory permissions and available disk space' }, { cause: error });
  }
}
