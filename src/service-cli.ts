import { Command, Option } from 'commander';
import type { CommonOptions } from './cli.js';
import type { CommandResult } from './contracts/output.js';
import { usageError } from './contracts/error.js';
import { catalogAction, catalogList, catalogSearch, type QueryOptions } from './commands/catalog.js';
import { parkingArtifact, parkingBase, parkingOrigin, type ArtifactOptions } from './commands/parking.js';
import { restJson } from './commands/rest.js';
import { nvdbPaged, nvdbRead, type NvdbOptions } from './commands/nvdb-core.js';
import { calculateMatrix, calculateRoute, queryRoadFeatures, routeProfiles, type RouteOptions } from './commands/route.js';
import { trafficAadt, trafficAreaIndex, trafficPublishedIndices, trafficReference, trafficStationIndices, trafficStations, trafficVolume, type TrafficOptions } from './commands/traffic.js';
import { readJsonInput } from './core/input.js';
import { effectiveSettings } from './core/config-store.js';
import { packageMetadata } from './core/metadata.js';
import type { Runtime } from './runtime.js';

export type ResultSetter = (factory: () => CommandResult | Promise<CommandResult>, command: Command) => Promise<void>;

const nvdbOrigin = 'https://nvdbapiles.atlas.vegvesen.no';
const statusOrigin = 'https://nvdbstatus-api.atlas.vegvesen.no';

export function addServiceCommands(program: Command, runtime: Runtime, setResult: ResultSetter): void {
  addCatalog(program, runtime, setResult);
  addNvdb(program, runtime, setResult);
  addRoute(program, runtime, setResult);
  addTraffic(program, runtime, setResult);
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

  addNvdbCore(nvdb, runtime, setResult);

  function leaf(parent: Command, syntax: string, description: string, commandPath: string, service: string, path: string, origin = nvdbOrigin): void {
    parent.command(syntax).description(description).action((_local, command: Command) => setResult(() => nvdbJson(runtime, commandPath, service, path, {}, command, origin), command));
  }
  function exactLeaf(parent: Command, syntax: string, description: string, commandPath: string, service: string, path: (id: string) => string, origin = nvdbOrigin): void {
    parent.command(syntax).description(description).action((id: string, _local, command: Command) => setResult(() => nvdbJson(runtime, commandPath, service, path(id), {}, command, origin), command));
  }
}

function addNvdbCore(nvdb: Command, runtime: Runtime, setResult: ResultSetter): void {
  const object = nvdb.command('object').description('Read NVDB road objects with opaque cursor paging.');
  const objectList = addNvdbFilterOptions(object.command('list <type-id>').description('List objects for an exact object type.'));
  objectList.action((typeId: string, local: NvdbFilterOptions, command: Command) => setResult(() => nvdbPaged(runtime, 'nvdb object list', `vegobjekter/api/v4/vegobjekter/${integer(typeId, 'type-id')}`, nvdbFilterQuery(local), nvdbOptions(command)), command));
  object.command('get <object-id>').description('Get an object by globally unique ID.')
    .option('--type-id <id>', 'Optional exact object type ID')
    .action((objectId: string, local: { typeId?: string }, command: Command) => setResult(() => nvdbRead(runtime, 'nvdb object get', local.typeId ? `vegobjekter/api/v4/vegobjekter/${integer(local.typeId, 'type-id')}/${integer(objectId, 'object-id')}` : 'vegobjekter/api/v4/vegobjekt', local.typeId ? {} : { id: integer(objectId, 'object-id') }, queryOptions(command)), command));
  object.command('versions <type-id> <object-id>').description('List every version of an exact object.')
    .action((typeId: string, objectId: string, _local, command: Command) => setResult(() => nvdbRead(runtime, 'nvdb object versions', `vegobjekter/api/v4/vegobjekter/${integer(typeId, 'type-id')}/${integer(objectId, 'object-id')}/versjoner`, {}, queryOptions(command)), command));
  const changes = object.command('changes [type-id]').description('List object changes from the last 30 days.')
    .option('--ids <ids>', 'Comma-separated object IDs')
    .option('--until <timestamp>', 'Exclusive upper change timestamp');
  changes.action((typeId: string | undefined, local: { ids?: string; until?: string }, command: Command) => setResult(() => nvdbPaged(runtime, 'nvdb object changes', typeId ? `vegobjekter/api/v4/vegobjekter/${integer(typeId, 'type-id')}/endringer` : 'vegobjekter/api/v4/vegobjekter/endringer', { ider: local.ids, slutt: local.until }, nvdbOptions(command), 'changes'), command));
  const statistics = addNvdbFilterOptions(object.command('statistics [type-id]').description('Get object statistics.'));
  statistics.action((typeId: string | undefined, local: NvdbFilterOptions, command: Command) => setResult(() => nvdbRead(runtime, 'nvdb object statistics', typeId ? `vegobjekter/api/v4/vegobjekter/${integer(typeId, 'type-id')}/statistikk` : 'vegobjekter/api/v4/vegobjekter/statistikk', nvdbFilterQuery(local), queryOptions(command)), command));

  const network = nvdb.command('network').description('Read links, segments, nodes, positions, and routes.');
  const link = network.command('link').description('Read road-link sequences.');
  const linkList = addNvdbFilterOptions(link.command('list').description('List road-link sequences.'));
  linkList.action((local: NvdbFilterOptions, command: Command) => setResult(() => nvdbPaged(runtime, 'nvdb network link list', 'vegnett/api/v4/veglenkesekvenser', nvdbFilterQuery(local), nvdbOptions(command)), command));
  link.command('get <link-sequence-id>').description('Get an exact road-link sequence.')
    .action((id: string, _local, command: Command) => setResult(() => nvdbRead(runtime, 'nvdb network link get', `vegnett/api/v4/veglenkesekvenser/${integer(id, 'link-sequence-id')}`, {}, queryOptions(command)), command));
  link.command('changes').description('List road-link sequence changes from the last 30 days.')
    .option('--ids <ids>', 'Comma-separated road-link sequence IDs')
    .option('--county <ids>', 'Comma-separated county IDs')
    .option('--municipality <ids>', 'Comma-separated municipality IDs')
    .option('--until <timestamp>', 'Exclusive upper change timestamp')
    .action((local: { ids?: string; county?: string; municipality?: string; until?: string }, command: Command) => setResult(() => nvdbPaged(runtime, 'nvdb network link changes', 'vegnett/api/v4/veglenkesekvenser/endringer', { ider: local.ids, fylke: local.county, kommune: local.municipality, slutt: local.until }, nvdbOptions(command), 'changes'), command));

  const segment = network.command('segment').description('Read segmented road network.');
  const segmentList = addNvdbFilterOptions(segment.command('list').description('List segmented road links.'));
  segmentList.action((local: NvdbFilterOptions, command: Command) => setResult(() => nvdbPaged(runtime, 'nvdb network segment list', 'vegnett/api/v4/veglenkesekvenser/segmentert', nvdbFilterQuery(local), nvdbOptions(command)), command));
  segment.command('get <link-sequence-id>').description('Get segmented links for an exact sequence.')
    .action((id: string, _local, command: Command) => setResult(() => nvdbRead(runtime, 'nvdb network segment get', `vegnett/api/v4/veglenkesekvenser/segmentert/${integer(id, 'link-sequence-id')}`, {}, queryOptions(command)), command));
  segment.command('statistics').description('Get segmented-network statistics.')
    .action((_local, command: Command) => setResult(() => nvdbRead(runtime, 'nvdb network segment statistics', 'vegnett/api/v4/veglenkesekvenser/segmentert/statistikk', {}, queryOptions(command)), command));

  const node = network.command('node').description('Read road-network nodes.');
  const nodeList = addNvdbFilterOptions(node.command('list').description('List road-network nodes.'));
  nodeList.action((local: NvdbFilterOptions, command: Command) => setResult(() => nvdbPaged(runtime, 'nvdb network node list', 'vegnett/api/v4/noder', nvdbFilterQuery(local), nvdbOptions(command)), command));
  node.command('get <node-id>').description('Get an exact road-network node.')
    .action((id: string, _local, command: Command) => setResult(() => nvdbRead(runtime, 'nvdb network node get', `vegnett/api/v4/noder/${integer(id, 'node-id')}`, {}, queryOptions(command)), command));

  const position = network.command('position').description('Locate coordinates on the road network.');
  position.command('locate').description('Find nearest road-network positions.')
    .option('--lat <value>', 'Latitude in EPSG:4326')
    .option('--lon <value>', 'Longitude in EPSG:4326')
    .option('--north <value>', 'Northing')
    .option('--east <value>', 'Easting')
    .option('--max-distance <meters>', 'Maximum search distance')
    .option('--max-results <count>', 'Maximum positions')
    .action((local: CoordinateOptions, command: Command) => {
      validateCoordinates(local);
      return setResult(() => nvdbRead(runtime, 'nvdb network position locate', 'vegnett/api/v4/posisjon', { lat: local.lat, lon: local.lon, nord: local.north, ost: local.east, maks_avstand: local.maxDistance, maks_antall: local.maxResults }, queryOptions(command)), command);
    });

  const roadPosition = network.command('road-position').description('Resolve road references and link-sequence positions.');
  roadPosition.command('locate').description('Resolve one road reference or link position.')
    .option('--road-reference <value>', 'Road-system reference')
    .option('--link-position <value>', 'Relative-position@link-sequence-id')
    .action((local: { roadReference?: string; linkPosition?: string }, command: Command) => {
      if (!local.roadReference && !local.linkPosition) throw usageError('One road-position input is required', 'Pass --road-reference RV4 or --link-position 0.5@123', 'road-reference');
      return setResult(() => nvdbRead(runtime, 'nvdb network road-position locate', 'vegnett/api/v4/veg', { vegsystemreferanse: local.roadReference, veglenkesekvens: local.linkPosition }, queryOptions(command)), command);
    });
  roadPosition.command('batch').description('Resolve comma-separated road references or link positions.')
    .option('--road-references <values>', 'Comma-separated road-system references')
    .option('--link-positions <values>', 'Comma-separated relative link positions')
    .action((local: { roadReferences?: string; linkPositions?: string }, command: Command) => {
      if (!local.roadReferences && !local.linkPositions) throw usageError('Batch road-position input is required', 'Pass --road-references RV4,EV6 or --link-positions 0.5@123,0.2@456', 'road-references');
      return setResult(() => nvdbRead(runtime, 'nvdb network road-position batch', 'vegnett/api/v4/veg/batch', { vegsystemreferanser: local.roadReferences, veglenkesekvenser: local.linkPositions }, queryOptions(command)), command);
    });

  const route = network.command('route').description('Calculate a route through NVDB road network references.');
  route.command('calculate').description('Calculate route between exact NVDB positions.')
    .option('--start <position>', 'Start road reference or relative link position')
    .option('--end <position>', 'End road reference or relative link position')
    .option('--body <input>', 'Large JSON request as @PATH or -; conflicts with --start/--end')
    .option('--srid <code>', 'Output SRID')
    .option('--geometry', 'Include geometry')
    .action(async (local: { start?: string; end?: string; body?: string; srid?: string; geometry?: boolean }, command: Command) => {
      if (local.body) {
        if (local.start || local.end) throw usageError('--body conflicts with --start and --end', 'Use either --body @request.json or --start POSITION --end POSITION', 'body');
        const body = await readJsonInput(runtime, local.body);
        return setResult(() => nvdbRead(runtime, 'nvdb network route calculate', 'vegnett/api/v4/beta/vegnett/rute', {}, queryOptions(command), 'POST', body), command);
      }
      if (!local.start || !local.end) throw usageError('--start and --end are required without --body', 'Pass --start POSITION --end POSITION, or --body @request.json', 'start');
      return setResult(() => nvdbRead(runtime, 'nvdb network route calculate', 'vegnett/api/v4/beta/vegnett/rute', { start: local.start, slutt: local.end, srid: local.srid, geometri: local.geometry }, queryOptions(command)), command);
    });

  const monitor = nvdb.command('monitor').description('Read submitted change-set status.');
  monitor.command('change-set').description('Read change-set status.').command('get <change-set-id>').description('Get exact change-set status.')
    .action((id: string, _local, command: Command) => setResult(() => nvdbRead(runtime, 'nvdb monitor change-set get', `monitor/api/v1/endringssett/${encodeURIComponent(id)}/status`, {}, queryOptions(command)), command));
}

interface NvdbFilterOptions {
  ids?: string;
  include?: string;
  srid?: string;
  county?: string;
  municipality?: string;
  contract?: string;
  nationalRoute?: string;
  roadAuthority?: string;
  roadReference?: string;
  bbox?: string;
  polygon?: string;
  propertyFilter?: string;
  overlap?: string;
  at?: string;
  changedAfter?: string;
}

interface CoordinateOptions { lat?: string; lon?: string; north?: string; east?: string; maxDistance?: string; maxResults?: string }

function addNvdbFilterOptions(command: Command): Command {
  return command
    .option('--ids <ids>', 'Comma-separated exact IDs')
    .option('--include <fields>', 'Comma-separated upstream fields')
    .option('--srid <code>', 'Output SRID')
    .option('--county <ids>', 'Comma-separated county IDs')
    .option('--municipality <ids>', 'Comma-separated municipality IDs')
    .option('--contract <ids>', 'Comma-separated contract-area IDs')
    .option('--national-route <ids>', 'Comma-separated national-route IDs')
    .option('--road-authority <ids>', 'Comma-separated road-authority IDs')
    .option('--road-reference <value>', 'Road-system reference filter')
    .option('--bbox <value>', 'Bounding box')
    .option('--polygon <wkt>', 'Polygon WKT')
    .option('--property-filter <expression>', 'NVDB property expression')
    .option('--overlap <expression>', 'NVDB overlap expression')
    .option('--at <timestamp>', 'Historical point in time')
    .option('--changed-after <timestamp>', 'Only objects changed after timestamp');
}

function nvdbFilterQuery(options: NvdbFilterOptions): Record<string, string | undefined> {
  return {
    ider: options.ids,
    inkluder: options.include,
    srid: options.srid,
    fylke: options.county,
    kommune: options.municipality,
    kontraktsomrade: options.contract,
    riksvegrute: options.nationalRoute,
    vegforvalter: options.roadAuthority,
    vegsystemreferanse: options.roadReference,
    kartutsnitt: options.bbox,
    polygon: options.polygon,
    egenskap: options.propertyFilter,
    overlapp: options.overlap,
    tidspunkt: options.at,
    endret_etter: options.changedAfter,
  };
}

function nvdbOptions(command: Command): NvdbOptions {
  const options = common(command);
  return { ...queryOptions(command), format: options.format, fields: options.field, configProfile: options.configProfile };
}

function validateCoordinates(options: CoordinateOptions): void {
  const geographic = options.lat !== undefined || options.lon !== undefined;
  const projected = options.north !== undefined || options.east !== undefined;
  if (geographic === projected || (geographic && (options.lat === undefined || options.lon === undefined)) || (projected && (options.north === undefined || options.east === undefined))) {
    throw usageError('Coordinates require exactly one complete pair', 'Pass --lat LAT --lon LON, or --north NORTH --east EAST', 'coordinates');
  }
  for (const [field, value] of Object.entries(options)) if (value !== undefined && !Number.isFinite(Number(value))) throw usageError(`--${field} must be numeric`, `Pass a numeric --${field} value`, field);
}

function addRoute(program: Command, runtime: Runtime, setResult: ResultSetter): void {
  const route = program.command('route').description('Plan public-road routes using Routing V3 open endpoints.');
  const calculate = addRouteOptions(route.command('calculate').description('Calculate up to three routes as GeoJSON.'));
  calculate.addOption(new Option('--profile <profile>', 'Route profile').choices(Object.keys(routeProfiles)).makeOptionMandatory());
  calculate.addHelpText('after', '\nExample:\n  vegvesen route calculate --profile best --stop 10.7522,59.9139 --stop 10.3951,63.4305 --input-srs EPSG:4326 --output-srs EPSG:4326 --format json\n');
  calculate.action((local: RouteLocalOptions, command: Command) => setResult(() => calculateRoute(runtime, local.profile as keyof typeof routeProfiles, routeOptions(local, command)), command));

  const matrix = addRouteOptions(route.command('matrix').description('Calculate a travel matrix for repeated stops.'));
  matrix.action((local: RouteLocalOptions, command: Command) => setResult(() => calculateMatrix(runtime, routeOptions(local, command)), command));

  const roadFeature = route.command('road-feature').description('Query road features along a route.');
  roadFeature.command('query').description('Run a checked read-only road-feature POST request.')
    .requiredOption('--body <input>', 'JSON request as @PATH or -')
    .option('--with-load-class', 'Use load-class road-feature operation')
    .action(async (local: { body: string; withLoadClass?: boolean }, command: Command) => {
      const body = await readJsonInput(runtime, local.body);
      return setResult(() => queryRoadFeatures(runtime, body, local.withLoadClass === true, queryOptions(command)), command);
    });
}

interface RouteLocalOptions {
  profile: string;
  stop: string[];
  inputSrs: 'EPSG:4326' | 'EPSG:25833';
  outputSrs: 'EPSG:4326' | 'EPSG:25833';
  language?: string;
  returnField?: string[];
  startTime?: string;
  length?: string;
  weight?: string;
  height?: string;
  includeObstructed?: boolean;
  allowZeroEmissionZone?: boolean;
  powerEffort?: string;
  bikePathUsage?: string;
  loadClass?: string;
  roadGroup?: string;
  includeUnclassifiedRoadGroup?: boolean;
  linkSemitrailer?: boolean;
  trackingRequired?: boolean;
}

function addRouteOptions(command: Command): Command {
  return command
    .option('--stop <coordinate>', 'Stop as X,Y; repeat at least twice', collectValues, [])
    .addOption(new Option('--input-srs <srs>', 'Stop coordinate system').choices(['EPSG:4326', 'EPSG:25833']).default('EPSG:4326'))
    .addOption(new Option('--output-srs <srs>', 'Geometry coordinate system').choices(['EPSG:4326', 'EPSG:25833']).default('EPSG:4326'))
    .addOption(new Option('--language <language>', 'Direction language').choices(['English', 'Norwegian', 'Swedish', 'Deutch', 'Finnish']).default('Norwegian'))
    .option('--return-field <field>', 'Additional response field; repeatable', collectValues, [])
    .option('--start-time <timestamp>', 'Route start time')
    .option('--length <meters>', 'Vehicle length')
    .option('--weight <tonnes>', 'Vehicle weight')
    .option('--height <meters>', 'Vehicle height')
    .option('--include-obstructed', 'Include obstructed routes')
    .option('--allow-zero-emission-zone', 'Allow travel in zero-emission zones')
    .option('--power-effort <value>', 'Bike power effort')
    .option('--bike-path-usage <value>', 'Bike-path preference')
    .addOption(new Option('--load-class <value>', 'Required heavy-transport load class').choices(['Bk_6_28', 'Bk_8_32', 'Bk_T8_40', 'Bk_T8_50', 'Bk_10_42', 'Bk_10_50', 'Bk_10_56', 'Bk_10_60']))
    .option('--road-group <value>', 'Special-transport road group')
    .option('--include-unclassified-road-group', 'Include unclassified road group')
    .option('--link-semitrailer', 'Modular vehicle uses link semitrailer')
    .option('--tracking-required', 'Modular vehicle has tracking requirement');
}

function routeOptions(local: RouteLocalOptions, command: Command): RouteOptions {
  return {
    ...queryOptions(command), stops: local.stop, inputSrs: local.inputSrs, outputSrs: local.outputSrs,
    language: local.language, returnFields: local.returnField, startTime: local.startTime,
    length: local.length, weight: local.weight, height: local.height,
    includeObstructed: local.includeObstructed, allowZeroEmissionZone: local.allowZeroEmissionZone,
    powerEffort: local.powerEffort, bikePathUsage: local.bikePathUsage, loadClass: local.loadClass,
    roadGroup: local.roadGroup, includeUnclassifiedRoadGroup: local.includeUnclassifiedRoadGroup,
    linkSemitrailer: local.linkSemitrailer, trackingRequired: local.trackingRequired,
  };
}

function addTraffic(program: Command, runtime: Runtime, setResult: ResultSetter): void {
  const traffic = program.command('traffic').description('Read Trafikkdata GraphQL traffic counts and reference data.');
  const station = traffic.command('station').description('Discover traffic registration points.');
  station.command('list').description('List stations with local bounding and filters.')
    .option('--query <text>', 'Name or road-reference search')
    .option('--road-category <ids>', 'Comma-separated road categories: E,R,F,K,P')
    .option('--county <numbers>', 'Comma-separated county numbers')
    .option('--operational', 'Only currently operational stations')
    .option('--traffic-type <type>', 'Traffic registration type')
    .option('--registration-frequency <frequency>', 'CONTINUOUS or PERIODIC')
    .action((local: TrafficStationFilters, command: Command) => setResult(() => trafficStations(runtime, 'traffic station list', { search: stationSearch(local) }, trafficOptions(command)), command));
  station.command('get <station-id>').description('Get an exact station.')
    .action((id: string, _local, command: Command) => setResult(() => trafficStations(runtime, 'traffic station get', { ids: [id] }, trafficOptions(command)), command));

  const volume = traffic.command('volume').description('Read bounded hourly/daily traffic volume.');
  addVolumeCommand(volume, 'hourly', 'hour', 'full', 'Read hourly volume.');
  addVolumeCommand(volume, 'daily', 'day', 'full', 'Read daily volume.');
  addVolumeCommand(volume, 'length-class', 'hour', 'length', 'Read hourly volume by vehicle length class.');

  const aadt = traffic.command('aadt').description('Read annual average daily traffic.');
  aadt.command('get').description('Get AADT for station and year.')
    .requiredOption('--station <id>', 'Traffic station ID')
    .requiredOption('--year <year>', 'Four-digit year')
    .option('--day-type <type>', 'ALL, WORKING_DAY, or NON_WORKING_DAY')
    .action((local: { station: string; year: string; dayType?: string }, command: Command) => setResult(() => trafficAadt(runtime, local.station, positiveInteger(local.year, 'year'), local.dayType, trafficOptions(command)), command));

  const index = traffic.command('index').description('Read station and published area indices.');
  index.command('station').description('Get point traffic-volume indices.')
    .requiredOption('--station <id>', 'Station ID; repeatable', collectValues, [])
    .requiredOption('--year <year>', 'Four-digit year')
    .option('--month <month>', 'Month 1-12')
    .action((local: { station: string[]; year: string; month?: string }, command: Command) => setResult(() => trafficStationIndices(runtime, local.station, positiveInteger(local.year, 'year'), optionalMonth(local.month), trafficOptions(command)), command));
  index.command('area').description('Get an exact published area index.')
    .requiredOption('--id <id>', 'Published index ID')
    .requiredOption('--year <year>', 'Four-digit year')
    .option('--month <month>', 'Month 1-12')
    .action((local: { id: string; year: string; month?: string }, command: Command) => setResult(() => trafficAreaIndex(runtime, positiveInteger(local.id, 'id'), positiveInteger(local.year, 'year'), optionalMonth(local.month), trafficOptions(command)), command));
  index.command('published').description('List available published area indices.')
    .action((_local, command: Command) => setResult(() => trafficPublishedIndices(runtime, trafficOptions(command)), command));

  const quality = traffic.command('quality').description('Read speed/length quality ratios.');
  addVolumeCommand(quality, 'get', 'hour', 'quality', 'Get hourly quality metrics.');
  const coverage = traffic.command('coverage').description('Read traffic-data coverage.');
  addVolumeCommand(coverage, 'get', 'hour', 'coverage', 'Get hourly coverage metrics.');

  const reference = traffic.command('reference').description('Read Trafikkdata reference dimensions.');
  for (const kind of ['road-category', 'area'] as const) reference.command(kind).description(`Read ${kind} references.`).command('list').description(`List ${kind} references.`)
    .action((_local, command: Command) => setResult(() => trafficReference(runtime, kind, trafficOptions(command)), command));

  function addVolumeCommand(parent: Command, name: string, period: 'hour' | 'day', projection: 'full' | 'length' | 'quality' | 'coverage', description: string): void {
    parent.command(name).description(description)
      .requiredOption('--station <id>', 'Traffic station ID')
      .requiredOption('--from <timestamp>', 'Inclusive ISO 8601 start')
      .requiredOption('--to <timestamp>', 'Exclusive ISO 8601 end')
      .action((local: { station: string; from: string; to: string }, command: Command) => setResult(() => trafficVolume(runtime, `traffic ${parent.name()} ${name}`, period, local.station, local.from, local.to, trafficOptions(command), projection), command));
  }
}

interface TrafficStationFilters { query?: string; roadCategory?: string; county?: string; operational?: boolean; trafficType?: string; registrationFrequency?: string }

function stationSearch(local: TrafficStationFilters): Record<string, unknown> {
  return {
    query: local.query,
    roadCategoryIds: local.roadCategory?.split(',').filter(Boolean),
    countyNumbers: local.county?.split(',').filter(Boolean).map((value) => positiveInteger(value, 'county')),
    isOperational: local.operational,
    trafficType: local.trafficType,
    registrationFrequency: local.registrationFrequency,
  };
}

function trafficOptions(command: Command): TrafficOptions {
  const options = common(command) as CommonOptions & { allowPartial?: boolean };
  return { ...queryOptions(command), allowPartial: options.allowPartial };
}

function collectValues(value: string, previous: string[]): string[] { return [...previous, value]; }

function positiveInteger(value: string, field: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1) throw usageError(`--${field} must be a positive integer`, `Pass a positive --${field} value`, field);
  return Number(value);
}

function optionalMonth(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const month = positiveInteger(value, 'month');
  if (month > 12) throw usageError('--month must be between 1 and 12', 'Pass --month 1 through --month 12', 'month');
  return month;
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
