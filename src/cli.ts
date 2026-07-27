import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';
import type { CommandResult, ErrorFormat, OutputFormat } from './contracts/output.js';
import { usageError } from './contracts/error.js';
import { effectiveSettings } from './core/config-store.js';
import { packageMetadata } from './core/metadata.js';
import {
  commandSchema,
  configPathResult,
  configSet,
  configShow,
  configUnset,
  configValidate,
  doctorResult,
  outputSchema,
  serviceGet,
  serviceList,
  versionResult,
} from './commands/foundation.js';
import type { Runtime } from './runtime.js';
import { addServiceCommands } from './service-cli.js';
import { validateOutputDestination } from './core/artifact-writer.js';
import { parseDuration } from './core/http.js';

export interface CommonOptions {
  format: OutputFormat;
  json?: boolean;
  schemaVersion: string;
  output?: string;
  receiptFormat: 'auto' | 'json' | 'text' | 'none';
  overwrite?: boolean;
  allowTerminalBinary?: boolean;
  configProfile?: string;
  timeout?: string | undefined;
  retries?: string | undefined;
  noInput?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  color: 'auto' | 'always' | 'never';
  errorFormat: ErrorFormat;
  pageSize?: string;
  limit?: string;
  cursor?: string;
  all?: boolean;
  field: string[];
}

export interface CliExecution {
  result: CommandResult | null;
  options: CommonOptions;
  helpOrVersion: boolean;
}

export async function parseCli(argv: string[], runtime: Runtime): Promise<CliExecution> {
  validateNoConflictingDuplicates(argv);
  const program = new Command();
  let commandResult: CommandResult | null = null;
  let helpOrVersion = false;

  program
    .name('vegvesen')
    .description('Anonymous CLI for Statens vegvesen public services.')
    .usage('<command> [options]')
    .version(packageMetadata.version, '-v, --version', 'Show bare CLI version')
    .showSuggestionAfterError(false)
    .showHelpAfterError(false)
    .configureHelp({ showGlobalOptions: true })
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .exitOverride()
    .configureOutput({
      writeOut: (text) => runtime.stdout.write(text),
      writeErr: () => undefined,
      outputError: () => undefined,
    });
  addCommonOptions(program);
  program.hook('preAction', (_root, actionCommand) => {
    const parsed = program.opts() as Partial<CommonOptions>;
    if (['catalog', 'nvdb', 'parking'].includes(topLevelName(actionCommand))) {
      const configured = effectiveSettings(runtime, parsed.configProfile).values;
      if (parsed.json) program.setOptionValueWithSource('format', 'json', 'implied');
      else if (program.getOptionValueSource('format') === 'default' && configured.format) program.setOptionValueWithSource('format', configured.format, 'config');
      if (parsed.timeout === undefined && configured.timeout) program.setOptionValueWithSource('timeout', configured.timeout, 'config');
      if (parsed.retries === undefined && configured.retries !== undefined) program.setOptionValueWithSource('retries', String(configured.retries), 'config');
    }
    const effective = program.opts() as Partial<CommonOptions>;
    validateCommon(effective);
    validateOutputDestination(runtime, effective.output, effective.overwrite === true);
  });

  const setResult = (factory: () => CommandResult | Promise<CommandResult>, command: Command): Promise<void> => runAction(factory, command).then((value) => { commandResult = value; });

  program.command('version').description('Show CLI, Node, schema, and manifest versions.').action((_options, command: Command) => setResult(() => versionResult(), command));
  program.command('doctor').description('Check local readiness and service health gates.')
    .option('--live', 'Probe implemented anonymous service endpoints')
    .action((local: { live?: boolean }, command: Command) => {
      const options = globals(command);
      return setResult(() => doctorResult(runtime, { live: local.live, timeout: options.timeout, retries: options.retries, configProfile: options.configProfile }), command);
    });

  const service = program.command('service').description('Discover service support and health.');
  service.command('list').description('List services.').action((_options, command: Command) => setResult(() => serviceList(), command));
  service.command('get <service>').description('Get exact service metadata.').argument('<service>', 'Exact service ID').action((id: string, _options, command: Command) => setResult(() => serviceGet(id), command));

  const schema = program.command('schema').description('Inspect machine-readable contracts.');
  schema.command('command [command-path...]').description('Describe one command path or list all commands.').action((path: string[], _options, command: Command) => setResult(() => commandSchema(path), command));
  schema.command('output [command-path...]').description('Show output envelope JSON Schema.').action((path: string[], _options, command: Command) => setResult(() => outputSchema(path), command));

  const config = program.command('config').description('Inspect or change non-sensitive user configuration.');
  config.command('path').description('Show config path.').action((_options, command: Command) => setResult(() => configPathResult(runtime), command));
  config.command('show').description('Show config, effective values, and sources.').action((_options, command: Command) => setResult(() => configShow(runtime, globals(command).configProfile), command));
  config.command('validate').description('Validate config file.').action((_options, command: Command) => setResult(() => configValidate(runtime), command));
  config.command('set <key> <value>').description('Set an allowlisted non-sensitive key.').action((key: string, value: string, _options, command: Command) => setResult(() => configSet(runtime, key, value, globals(command).configProfile), command));
  config.command('unset <key>').description('Unset an allowlisted key.').action((key: string, _options, command: Command) => setResult(() => configUnset(runtime, key, globals(command).configProfile), command));

  addServiceCommands(program, runtime, setResult);

  if (argv.length === 0) {
    program.outputHelp();
    return { result: null, options: defaultOptions(), helpOrVersion: true };
  }

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (error) {
    if (error instanceof CommanderError && (error.code === 'commander.helpDisplayed' || error.code === 'commander.version')) {
      helpOrVersion = true;
    } else {
      throw error;
    }
  }

  if (helpOrVersion) return { result: null, options: defaultOptions(), helpOrVersion: true };
  const options = normalizeOptions(program.opts() as Partial<CommonOptions>, runtime);
  validateCommon(options);
  return { result: commandResult, options, helpOrVersion: false };
}

function addCommonOptions(program: Command): void {
  program
    .addOption(new Option('--format <format>', 'Result format').choices(['auto', 'json', 'ndjson', 'table', 'csv', 'raw']).default('auto'))
    .option('--json', 'Alias for --format json')
    .option('--schema-version <version>', 'Assert machine schema version', '1')
    .option('-o, --output <path>', 'Write payload to path or -')
    .addOption(new Option('--receipt-format <format>', 'Receipt for file output').choices(['auto', 'json', 'text', 'none']).default('auto'))
    .option('--overwrite', 'Allow replacing an existing artifact')
    .option('--allow-terminal-binary', 'Allow native binary output to TTY')
    .option('--config-profile <name>', 'Select config profile')
    .option('--timeout <duration>', 'Request timeout, such as 10s')
    .option('--retries <count>', 'Maximum safe-read retries')
    .option('--no-input', 'Disable every prompt')
    .option('--quiet', 'Suppress diagnostics, not result data')
    .option('--verbose', 'Show redacted debug diagnostics')
    .addOption(new Option('--color <mode>', 'Color policy').choices(['auto', 'always', 'never']).default('auto'))
    .addOption(new Option('--error-format <format>', 'Error format').choices(['auto', 'text', 'json']).default('auto'))
    .option('--page-size <count>', 'Upstream page size')
    .option('--limit <count>', 'Total result limit')
    .option('--cursor <value>', 'Opaque resume cursor')
    .option('--all', 'Traverse all pages; requires NDJSON or one-field raw')
    .option('--field <path>', 'Project output field; repeatable', collect, []);
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function globals(command: Command): CommonOptions {
  return command.optsWithGlobals() as CommonOptions;
}

async function runAction(factory: () => CommandResult | Promise<CommandResult>, command: Command): Promise<CommandResult> {
  validateCommon(globals(command));
  return factory();
}

function normalizeOptions(parsed: Partial<CommonOptions>, runtime: Runtime): CommonOptions {
  const profile = parsed.configProfile;
  const configured = effectiveSettings(runtime, profile).values;
  const defaults = defaultOptions();
  return {
    ...defaults,
    ...parsed,
    format: parsed.json ? 'json' : (parsed.format === 'auto' && configured.format ? configured.format : parsed.format ?? defaults.format),
    timeout: parsed.timeout ?? configured.timeout,
    retries: parsed.retries ?? (configured.retries === undefined ? undefined : String(configured.retries)),
    field: parsed.field ?? [],
  };
}

function defaultOptions(): CommonOptions {
  return { format: 'auto', schemaVersion: '1', receiptFormat: 'auto', color: 'auto', errorFormat: 'auto', field: [] };
}

function validateCommon(options: Partial<CommonOptions>): void {
  if ((options.schemaVersion ?? '1') !== '1') throw usageError(`Unsupported schema version: ${options.schemaVersion}`, 'Use --schema-version 1', 'schema-version');
  if (options.json && options.format !== undefined && options.format !== 'auto' && options.format !== 'json') throw usageError('--json conflicts with non-JSON --format', 'Remove --json or use --format json', 'format');
  if (options.timeout !== undefined) parseDuration(options.timeout);
  for (const [field, value] of [['limit', options.limit], ['page-size', options.pageSize], ['retries', options.retries]] as const) {
    if (value !== undefined && (!/^\d+$/.test(value) || Number(value) < (field === 'retries' ? 0 : 1))) throw usageError(`--${field} must be ${field === 'retries' ? 'a non-negative' : 'a positive'} integer`, `Pass --${field} ${field === 'retries' ? '0' : '1'} or greater`, field);
  }
  if (options.all && options.limit !== undefined) throw usageError('--all and --limit are mutually exclusive', 'Remove --limit or replace --all with a finite --limit', 'all');
  const selectedFormat = options.json ? 'json' : options.format;
  if (options.all && !(selectedFormat === 'ndjson' || (selectedFormat === 'raw' && options.field?.length === 1))) throw usageError('--all requires --format ndjson or one --field with --format raw', 'Use --all --format ndjson', 'format');
  if (options.receiptFormat !== undefined && options.receiptFormat !== 'auto' && (!options.output || options.output === '-')) throw usageError('--receipt-format requires --output PATH', 'Pass a file path with --output or remove --receipt-format', 'receipt-format');
}

function validateNoConflictingDuplicates(argv: string[]): void {
  const valueOptions = new Map<string, string>([['-o', '--output']]);
  const names = new Set(['--format', '--schema-version', '--output', '--receipt-format', '--config-profile', '--timeout', '--retries', '--color', '--error-format', '--page-size', '--limit', '--cursor', '--query', '--type', '--include', '--srid', '--state', '--organization-number', '--data-fields']);
  const seen = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    const [rawName, inlineValue] = token.startsWith('--') ? token.split(/=(.*)/s, 2) : [token, undefined];
    const name = valueOptions.get(rawName) ?? rawName;
    if (!names.has(name)) continue;
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
    if (value === undefined) continue;
    const previous = seen.get(name);
    if (previous !== undefined && previous !== value) throw usageError(`Conflicting duplicate option: ${name}`, `Pass ${name} exactly once`, name.slice(2));
    seen.set(name, value);
  }
}

function topLevelName(command: Command): string {
  let current = command;
  while (current.parent?.parent) current = current.parent;
  return current.name();
}

export function commanderUsageError(error: CommanderError | InvalidArgumentError): ReturnType<typeof usageError> {
  const raw = error.message.replace(/^error: /, '');
  return usageError(raw, "Run 'vegvesen --help' or 'vegvesen help <command>' for valid usage");
}
