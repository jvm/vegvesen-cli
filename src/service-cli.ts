import { Command, Option } from 'commander';
import type { CommonOptions } from './cli.js';
import type { CommandResult } from './contracts/output.js';
import { usageError } from './contracts/error.js';
import { catalogAction, catalogList, catalogSearch, type QueryOptions } from './commands/catalog.js';
import { parkingArtifact, parkingBase, parkingOrigin, type ArtifactOptions } from './commands/parking.js';
import { restJson } from './commands/rest.js';
import { effectiveSettings } from './core/config-store.js';
import { packageMetadata } from './core/metadata.js';
import type { Runtime } from './runtime.js';

export type ResultSetter = (factory: () => CommandResult | Promise<CommandResult>, command: Command) => Promise<void>;

const nvdbOrigin = 'https://nvdbapiles.atlas.vegvesen.no';
const statusOrigin = 'https://nvdbstatus-api.atlas.vegvesen.no';

export function addServiceCommands(program: Command, runtime: Runtime, setResult: ResultSetter): void {
  addCatalog(program, runtime, setResult);
  addNvdb(program, runtime, setResult);
  addParking(program, runtime, setResult);
}

function addCatalog(program: Command, runtime: Runtime, setResult: ResultSetter): void {
  const catalog = program.command('catalog').description('Read Dataportalen CKAN metadata.');
  const pkg = catalog.command('package').description('Search or read catalog packages.');
  pkg.command('search').description('Search packages with bounded deterministic paging.')
    .option('--query <text>', 'CKAN search text')
    .option('--type <type>', 'Exact dataset type, such as dataservice')
    .addHelpText('after', '\nExamples:\n  vegvesen catalog package search --query trafikk --limit 25 --format json --no-input\n  vegvesen catalog package search --all --format ndjson\n')
    .action((local: { query?: string; type?: string }, command: Command) => setResult(() => catalogSearch(runtime, local.query, local.type, queryOptions(command)), command));
  pkg.command('get <package>').description('Get package by exact ID or name.')
    .action((id: string, _local, command: Command) => setResult(() => catalogAction(runtime, 'catalog package get', 'package_show', { id }, queryOptions(command)), command));
  const resource = catalog.command('resource').description('Read exact catalog resources.');
  resource.command('get <resource>').description('Get resource by exact UUID.')
    .action((id: string, _local, command: Command) => setResult(() => catalogAction(runtime, 'catalog resource get', 'resource_show', { id }, queryOptions(command)), command));
  addCkanListGet(catalog, runtime, setResult, 'group', 'group_list', 'group_show');
  addCkanListGet(catalog, runtime, setResult, 'organization', 'organization_list', 'organization_show');
  addCkanListGet(catalog, runtime, setResult, 'tag', 'tag_list', 'tag_show');
  catalog.command('status').description('Read catalog status.').command('get').description('Get CKAN site status.')
    .action((_local, command: Command) => setResult(() => catalogAction(runtime, 'catalog status get', 'status_show', {}, queryOptions(command)), command));
}

function addCkanListGet(parent: Command, runtime: Runtime, setResult: ResultSetter, noun: string, listAction: string, getAction: string): void {
  const group = parent.command(noun).description(`Read catalog ${noun} metadata.`);
  group.command('list').description(`List catalog ${noun}s.`)
    .action((_local, command: Command) => setResult(() => catalogList(runtime, `catalog ${noun} list`, listAction, queryOptions(command)), command));
  group.command('get <id>').description(`Get exact catalog ${noun}.`)
    .action((id: string, _local, command: Command) => setResult(() => catalogAction(runtime, `catalog ${noun} get`, getAction, { id }, queryOptions(command)), command));
}

function addNvdb(program: Command, runtime: Runtime, setResult: ResultSetter): void {
  const nvdb = program.command('nvdb').description('Read anonymous NVDB services.');
  const catalog = nvdb.command('catalog').description('Read NVDB Datakatalog metadata.');
  leaf(catalog, 'version', 'Get active catalog version.', 'nvdb catalog version', 'nvdb-catalog', 'api/v1/versjon');
  const type = catalog.command('type').description('Read NVDB object types.');
  leaf(type, 'list', 'List object types.', 'nvdb catalog type list', 'nvdb-catalog', 'api/v1/vegobjekttyper');
  exactLeaf(type, 'get <type-id>', 'Get exact object type.', 'nvdb catalog type get', 'nvdb-catalog', (id) => `api/v1/vegobjekttyper/${integer(id, 'type-id')}`);
  exactLeaf(type, 'history <version>', 'Get object types at catalog version.', 'nvdb catalog type history', 'nvdb-catalog', (version) => `api/v1/vegobjekttyper/historisk/${encodeURIComponent(version)}`);
  const property = catalog.command('property').description('Read NVDB property metadata.');
  exactLeaf(property, 'get <property-id>', 'Get exact property type.', 'nvdb catalog property get', 'nvdb-catalog', (id) => `api/v1/egenskapstyper/${integer(id, 'property-id')}`);
  leaf(property, 'categories', 'List property categories.', 'nvdb catalog property categories', 'nvdb-catalog', 'api/v1/egenskapstypekategorier');
  const product = catalog.command('product-spec').description('Read product specifications.');
  exactLeaf(product, 'get <type-id>', 'Get type product specification.', 'nvdb catalog product-spec get', 'nvdb-catalog', (id) => `api/v1/vegobjekttyper/${integer(id, 'type-id')}/produktspesifikasjon`);
  const category = catalog.command('category').description('Read object categories.');
  leaf(category, 'list', 'List object categories.', 'nvdb catalog category list', 'nvdb-catalog', 'api/v1/kategorier');
  const unit = catalog.command('unit').description('Read catalog units.');
  leaf(unit, 'list', 'List units.', 'nvdb catalog unit list', 'nvdb-catalog', 'api/v1/enheter');

  const area = nvdb.command('area').description('Read NVDB area dimensions.');
  for (const [name, path] of Object.entries({ county: 'fylker', municipality: 'kommuner', 'road-authority': 'vegforvaltere', 'national-route': 'riksvegruter', contract: 'kontraktsomrader', address: 'adresser' })) {
    const group = area.command(name).description(`Read ${name} areas.`);
    group.command('list').description(`List ${name} areas.`).option('--include <fields>', 'Upstream include fields').option('--srid <code>', 'Geometry SRID')
      .action((local: { include?: string; srid?: string }, command: Command) => setResult(() => nvdbJson(runtime, `nvdb area ${name} list`, 'nvdb-areas', `api/v4/${path}`, { inkluder: local.include, srid: local.srid }, command), command));
  }

  const status = nvdb.command('status').description('Read public NVDB operational status.');
  leaf(status, 'current', 'Get current systems and status.', 'nvdb status current', 'nvdb-status', 'api/v1/systemer', statusOrigin);
  const dependency = status.command('dependency').description('Read systems and service dependencies.');
  leaf(dependency, 'list', 'List systems and dependencies.', 'nvdb status dependency list', 'nvdb-status', 'api/v1/systemer', statusOrigin);
  const message = status.command('message').description('Read incident and maintenance messages.');
  message.command('list').description('List status messages; bounded locally by --limit.')
    .addOption(new Option('--state <state>', 'Message state').choices(['active', 'planned', 'closed', 'unresolved', 'all']).default('unresolved'))
    .action((local: { state: string }, command: Command) => {
      const suffix: Record<string, string> = { active: 'aktiv', planned: 'planlagt', closed: 'avsluttet', unresolved: 'ulost', all: '' };
      return setResult(() => nvdbJson(runtime, 'nvdb status message list', 'nvdb-status', `api/v1/feilmeldinger${suffix[local.state] ? `/${suffix[local.state]}` : ''}`, {}, command, statusOrigin), command);
    });
  exactLeaf(message, 'get <message-id>', 'Get exact status message.', 'nvdb status message get', 'nvdb-status', (id) => `api/v1/feilmeldinger/${integer(id, 'message-id')}`, statusOrigin);

  function leaf(parent: Command, syntax: string, description: string, commandPath: string, service: string, path: string, origin = nvdbOrigin): void {
    parent.command(syntax).description(description).action((_local, command: Command) => setResult(() => nvdbJson(runtime, commandPath, service, path, {}, command, origin), command));
  }
  function exactLeaf(parent: Command, syntax: string, description: string, commandPath: string, service: string, path: (id: string) => string, origin = nvdbOrigin): void {
    parent.command(syntax).description(description).action((id: string, _local, command: Command) => setResult(() => nvdbJson(runtime, commandPath, service, path(id), {}, command, origin), command));
  }
}

function addParking(program: Command, runtime: Runtime, setResult: ResultSetter): void {
  const parking = program.command('parking').description('Read Parking Register data and attachments.');
  const provider = parking.command('provider').description('Read parking providers.');
  provider.command('list').description('List all providers.').action((_local, command: Command) => setResult(() => parkingJson(runtime, 'parking provider list', 'parkeringstilbyder', {}, command), command));
  provider.command('active').description('List active providers.').action((_local, command: Command) => setResult(() => parkingJson(runtime, 'parking provider active', 'parkeringstilbyder/aktive', {}, command), command));
  provider.command('get <organization-number>').description('Get provider by nine-digit organization number.')
    .action((id: string, _local, command: Command) => setResult(() => parkingJson(runtime, 'parking provider get', `parkeringstilbyder/${organizationNumber(id)}`, {}, command), command));
  const area = parking.command('area').description('Read parking areas.');
  area.command('list').description('List parking areas.')
    .option('--organization-number <number>', 'Filter by nine-digit provider number')
    .addOption(new Option('--data-fields <mode>', 'Response field set').choices(['alle', 'kart']))
    .action((local: { organizationNumber?: string; dataFields?: string }, command: Command) => setResult(() => parkingJson(runtime, 'parking area list', 'parkeringsomraade', { orgnr: local.organizationNumber ? organizationNumber(local.organizationNumber) : undefined, datafelter: local.dataFields }, command), command));
  area.command('get <area-id>').description('Get exact parking area.').action((id: string, _local, command: Command) => setResult(() => parkingJson(runtime, 'parking area get', `parkeringsomraade/${integer(id, 'area-id')}`, {}, command), command));
  area.command('version <area-id> <version>').description('Get exact parking area version.').action((id: string, version: string, _local, command: Command) => setResult(() => parkingJson(runtime, 'parking area version', `parkeringsomraade/${integer(id, 'area-id')}/versjon/${integer(version, 'version')}`, {}, command), command));
  const signPlan = parking.command('sign-plan').description('Download native sign-plan attachment.');
  signPlan.command('get <sign-plan-id>').description('Download exact sign plan; --output is required.')
    .action((id: string, _local, command: Command) => setResult(() => parkingArtifact(runtime, 'parking sign-plan get', `parkeringsomraade/skiltplan/${integer(id, 'sign-plan-id')}`, artifactOptions(command)), command));
  const assessment = parking.command('assessment').description('Download native assessment attachment.');
  assessment.command('get <assessment-id>').description('Download exact assessment; --output is required.')
    .action((id: string, _local, command: Command) => setResult(() => parkingArtifact(runtime, 'parking assessment get', `parkeringsomraade/vurdering/${integer(id, 'assessment-id')}`, artifactOptions(command)), command));
}

function nvdbJson(runtime: Runtime, commandPath: string, service: string, path: string, query: Record<string, string | number | boolean | undefined>, command: Command, origin = nvdbOrigin): Promise<CommandResult> {
  const servicePrefix: Record<string, string> = { 'nvdb-catalog': 'datakatalog/', 'nvdb-areas': 'omrader/' };
  const resolvedPath = `${servicePrefix[service] ?? ''}${path}`;
  const global = common(command);
  const configured = effectiveSettings(runtime, global.configProfile).values;
  const xClient = configured.x_client ?? `vegvesen-cli/${packageMetadata.version}`;
  return restJson(runtime, commandPath, service, origin, resolvedPath, query, global, { 'X-Client': xClient });
}

function parkingJson(runtime: Runtime, commandPath: string, path: string, query: Record<string, string | number | boolean | undefined>, command: Command): Promise<CommandResult> {
  return restJson(runtime, commandPath, 'parking', parkingOrigin, `${parkingBase}${path}`, query, queryOptions(command));
}

function common(command: Command): CommonOptions {
  return command.optsWithGlobals() as CommonOptions;
}

function queryOptions(command: Command): QueryOptions {
  const options = common(command);
  return { timeout: options.timeout, retries: options.retries, limit: options.limit, pageSize: options.pageSize, cursor: options.cursor, all: options.all };
}

function artifactOptions(command: Command): ArtifactOptions {
  const options = common(command);
  return { ...queryOptions(command), output: options.output, overwrite: options.overwrite, allowTerminalBinary: options.allowTerminalBinary, format: options.format };
}

function integer(value: string, field: string): string {
  if (!/^\d+$/.test(value)) throw usageError(`${field} must be an integer`, `Pass a numeric ${field}`, field);
  return value;
}

function organizationNumber(value: string): string {
  if (!/^\d{9}$/.test(value)) throw usageError('organization-number must contain exactly nine digits', 'Pass --organization-number 123456789', 'organization-number');
  return value;
}
