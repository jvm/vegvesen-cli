import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse as parseGraphql } from 'graphql';
import { parse as parseYaml } from 'yaml';

const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

export function canonicalizeSource(text, kind) {
  let parsed;
  let canonical = text.replaceAll('\r\n', '\n');
  if (kind === 'html-links') {
    const links = [...text.matchAll(/(?:href|src)=["']([^"'#]+)(?:#[^"']*)?["']/gi)].map((match) => match[1].replace(/\?.*$/, '')).filter((value) => !value.startsWith('data:'));
    canonical = JSON.stringify([...new Set(links)].sort());
    return { parsed: undefined, canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
  }
  try {
    parsed = JSON.parse(text);
    canonical = JSON.stringify(sortJson(kind === 'graphql-introspection' ? parsed.data : parsed));
  } catch {
    if (kind === 'openapi' || kind === 'swagger') {
      parsed = parseYaml(text);
      canonical = JSON.stringify(sortJson(parsed));
    }
  }
  return { parsed, canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}

export function extractOperations(source, parsed, digest) {
  if (!['openapi', 'swagger'].includes(source.kind) || !parsed?.paths) return [];
  const operations = [];
  for (const [path, pathItem] of Object.entries(parsed.paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;
      const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
        .filter((parameter) => parameter && typeof parameter === 'object' && !('$ref' in parameter));
      const parameterNames = (location) => [...new Set(parameters.filter((parameter) => parameter.in === location).map((parameter) => parameter.name))].sort();
      const requiredQuery = [...new Set(parameters.filter((parameter) => parameter.in === 'query' && parameter.required === true).map((parameter) => parameter.name))].sort();
      operations.push({
        id: `${source.contract_id}:${method.toUpperCase()} ${normalizePath(path)}`,
        service: source.service,
        contract_id: source.contract_id,
        source_digest: `sha256:${digest}`,
        method: method.toUpperCase(),
        path: normalizePath(path),
        operation_id: operation.operationId ?? null,
        path_parameters: parameterNames('path'),
        query_parameters: parameterNames('query'),
        required_query_parameters: requiredQuery,
        declared_security: operation.security ?? parsed.security ?? null,
        media_types: [...new Set([...Object.keys(operation.requestBody?.content ?? {}), ...Object.values(operation.responses ?? {}).flatMap((value) => Object.keys(value?.content ?? {}))])].sort(),
      });
    }
  }
  return operations.sort((a, b) => a.id.localeCompare(b.id));
}

export function generateProtocolUnits(recipes, sources, queriesDirectory = new URL('../specs/graphql/queries/', import.meta.url)) {
  validateProtocolRecipeShape(recipes);
  const sourceByContract = new Map(sources.map((source) => [source.contract_id, source]));
  const units = [];
  const add = (service, contractId, kind, name) => {
    const source = sourceByContract.get(contractId);
    if (!source) throw new Error(`Protocol recipe references unknown contract: ${contractId}`);
    units.push({ id: `${service}:${name}`, service, contract_id: contractId, source_digest: `sha256:${source.sha256}`, kind });
  };
  for (const action of recipes.catalog.actions) add('catalog', recipes.catalog.contract_id, 'ckan-action', `CKAN ${action}`);
  for (const recipe of recipes.artifacts) for (const unit of recipe.units) add(recipe.service, recipe.contract_id, 'artifact-lifecycle', unit);
  for (const recipe of recipes.jobs) for (const unit of recipe.units) add(recipe.service, recipe.contract_id, 'job-lifecycle', unit);
  for (const recipe of recipes.websockets) for (const unit of recipe.units) add(recipe.service, recipe.contract_id, 'websocket', unit);
  for (const recipe of recipes.health_gates) for (const unit of recipe.units) add(recipe.service, recipe.contract_id, 'health-gate', unit);
  for (const family of recipes.legacy_ogc.families) {
    for (const operation of recipes.legacy_ogc.wms_operations) add(recipes.legacy_ogc.service, recipes.legacy_ogc.contract_id, 'ogc-operation', `${family} WMS ${operation}`);
    for (const operation of recipes.legacy_ogc.wfs_operations) add(recipes.legacy_ogc.service, recipes.legacy_ogc.contract_id, 'ogc-operation', `${family} WFS ${operation}`);
  }
  for (const recipe of recipes.ogc_apis) for (const link of recipe.links) add(recipe.service, recipe.contract_id, 'ogc-link-template', `OGC API ${recipe.name} ${link}`);
  for (const family of recipes.tnits.families) add(recipes.tnits.service, recipes.tnits.contract_id, 'tnits-family', `family ${family}`);
  const queryCache = new Map();
  for (const unit of recipes.graphql.units) {
    if (!queryCache.has(unit.query)) queryCache.set(unit.query, graphqlEvidence(readFileSync(new URL(unit.query, queriesDirectory), 'utf8')));
    const evidence = queryCache.get(unit.query);
    if (!evidence.paths.has(unit.field_path)) throw new Error(`GraphQL recipe field path is absent from ${unit.query}: ${unit.field_path}`);
    for (const variable of unit.required_variables ?? []) if (!evidence.variables.has(variable)) throw new Error(`GraphQL recipe variable is absent from ${unit.query}: ${variable}`);
    add(recipes.graphql.service, recipes.graphql.contract_id, 'graphql', `GraphQL ${unit.name}`);
  }
  const sorted = units.sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(sorted.map((unit) => unit.id)).size !== sorted.length) throw new Error('Protocol recipe generated duplicate unit identities');
  return sorted;
}

export function validatePublicOperations(publicOperations, derivedTargets, overlayPolicies, serviceOrigins) {
  const generatedPolicies = [...overlayPolicies.values()].filter((policy) => policy.disposition === 'generated-operation');
  if (publicOperations.length !== generatedPolicies.length) throw new Error(`Generated runtime allowlist completeness mismatch: ${publicOperations.length}/${generatedPolicies.length}`);
  const derived = new Map(derivedTargets.map((target) => [target.id, target]));
  const seenTargets = new Set();
  const seenIds = new Set();
  for (const operation of publicOperations) {
    if (seenTargets.has(operation.target_id)) throw new Error(`Duplicate generated runtime target: ${operation.target_id}`);
    if (seenIds.has(`${operation.service}:${operation.id}`)) throw new Error(`Duplicate generated runtime ID: ${operation.service}/${operation.id}`);
    seenTargets.add(operation.target_id);
    seenIds.add(`${operation.service}:${operation.id}`);
    const target = derived.get(operation.target_id);
    if (!target) throw new Error(`Generated runtime target disappeared: ${operation.target_id}`);
    const policy = overlayPolicies.get(operation.target_id);
    if (!policy || policy.disposition !== 'generated-operation' || policy.access !== 'public-anonymous') throw new Error(`Generated runtime target lacks public-anonymous generated policy: ${operation.target_id}`);
    if (operation.service !== target.service || operation.method !== target.method || operation.path !== target.path) throw new Error(`Generated runtime method/path mismatch: ${operation.target_id}`);
    if (operation.origin !== serviceOrigins.get(operation.service)) throw new Error(`Generated runtime origin mismatch: ${operation.target_id}`);
    for (const field of ['path_parameters', 'query_parameters', 'required_query_parameters']) {
      if (JSON.stringify(operation[field]) !== JSON.stringify(target[field])) throw new Error(`Generated runtime ${field} mismatch: ${operation.target_id}`);
    }
    if (operation.effect !== 'read' || operation.retry !== 'safe') throw new Error(`Generated runtime effect/retry mismatch: ${operation.target_id}`);
  }
  for (const policy of generatedPolicies) if (!seenTargets.has(policy.target_id)) throw new Error(`Generated policy missing from runtime allowlist: ${policy.target_id}`);
}

export function validateOverlayTargets(expectedTargets, policies) {
  const expected = new Map(expectedTargets.map((target) => [target.id, target]));
  if (expected.size !== expectedTargets.length) throw new Error('Duplicate expected target');
  const seen = new Set();
  for (const policy of policies) {
    if (seen.has(policy.target_id)) throw new Error(`Duplicate overlay target: ${policy.target_id}`);
    if (!expected.has(policy.target_id)) throw new Error(`Overlay target disappeared: ${policy.target_id}`);
    seen.add(policy.target_id);
  }
  for (const id of expected.keys()) if (!seen.has(id)) throw new Error(`Expected target is unclassified: ${id}`);
}

function validateProtocolRecipeShape(recipes) {
  exactSet('CKAN actions', recipes.catalog.actions, ['package_search', 'package_show', 'resource_show', 'group_list', 'group_show', 'organization_list', 'organization_show', 'tag_list', 'tag_show', 'status_show']);
  exactSet('legacy OGC families', recipes.legacy_ogc.families, ['vegvar_1_0', 'norstoy_1_0', 'nvdb_2_0', 'rapportweb_1_0', 'datex_3_1']);
  exactSet('WMS operations', recipes.legacy_ogc.wms_operations, ['GetCapabilities', 'GetMap', 'GetFeatureInfo']);
  exactSet('WFS operations', recipes.legacy_ogc.wfs_operations, ['GetCapabilities', 'DescribeFeatureType', 'GetFeature']);
  exactSet('TN-ITS families', recipes.tnits.families, ['RestrictionForVehicles', 'RoadFeature', 'RoadName', 'SpeedLimit']);
  const ogc = new Map(recipes.ogc_apis.map((recipe) => [recipe.name, recipe.links]));
  exactSet('OGC API families', [...ogc.keys()], ['features', 'maps', 'styles']);
  exactSet('OGC Features links', ogc.get('features'), ['landing', 'conformance', 'api', 'collections', 'collection', 'queryables', 'items', 'item']);
  exactSet('OGC Maps links', ogc.get('maps'), ['landing', 'conformance', 'api', 'collections', 'collection', 'styles', 'render']);
  exactSet('OGC Styles links', ogc.get('styles'), ['landing', 'conformance', 'api', 'list', 'get', 'metadata']);
  const lifecycle = new Map([...recipes.artifacts, ...recipes.jobs, ...recipes.websockets, ...recipes.health_gates].map((recipe) => [recipe.service, recipe.units]));
  exactSet('NVDB Export artifacts', lifecycle.get('nvdb-export'), ['network CSV/SOSI artifact', 'object CSV/SOSI artifact']);
  exactSet('Stedfesting job lifecycle', lifecycle.get('nvdb-georeference'), ['job start', 'job status', 'job wait', 'job result', 'job expiry/failure', 'job SIGINT', 'job SIGTERM']);
  exactSet('Reports job lifecycle', lifecycle.get('nvdb-reports'), ['job start', 'job status', 'job wait', 'job download', 'job expiry/failure', 'job SIGINT', 'job SIGTERM']);
  exactSet('Status WebSocket lifecycle', lifecycle.get('nvdb-status'), ['WebSocket handshake', 'WebSocket event frame', 'WebSocket reconnect control', 'WebSocket SIGINT', 'WebSocket SIGTERM']);
  exactSet('OGC blocked health gates', lifecycle.get('ogc-tiles-dggs'), ['Tiles discovery/retrieval', 'DGGS discovery/retrieval']);
  exactSet('GraphQL semantic units', recipes.graphql.units.map((unit) => unit.name), ['areas', 'publishedAreaTrafficVolumeIndex', 'publishedAreaTrafficVolumeIndices', 'roadCategories', 'trafficData.volume.average.daily.byYear', 'trafficData.volume.byDay', 'trafficData.volume.byHour', 'trafficData.volume.byHour.byLengthRange', 'trafficRegistrationPoints exact IDs', 'trafficRegistrationPoints search', 'TrafficVolume coverage', 'TrafficVolume quality ratios', 'trafficVolumeIndices']);
  exactSet('persisted GraphQL query mappings', recipes.graphql.units.map((unit) => unit.query), ['aadt.graphql', 'indices.graphql', 'published-index.graphql', 'published-indices.graphql', 'reference.graphql', 'stations.graphql', 'volume-day.graphql', 'volume.graphql']);
}

function exactSet(label, actual, expected) {
  if (!Array.isArray(actual) || JSON.stringify([...new Set(actual)].sort()) !== JSON.stringify([...expected].sort())) throw new Error(`${label} recipe is incomplete or contains unknown units`);
}

function graphqlEvidence(text) {
  const document = parseGraphql(text);
  const paths = new Set();
  const variables = new Set();
  const walk = (selectionSet, prefix = []) => {
    for (const selection of selectionSet?.selections ?? []) {
      if (selection.kind !== 'Field') continue;
      const next = [...prefix, selection.name.value];
      paths.add(next.join('.'));
      walk(selection.selectionSet, next);
    }
  };
  for (const definition of document.definitions) {
    for (const variable of definition.variableDefinitions ?? []) variables.add(variable.variable.name.value);
    walk(definition.selectionSet);
  }
  return { paths, variables };
}

function normalizePath(path) { const value = `/${String(path).replace(/^\/+/, '')}`; return value.length > 1 ? value.replace(/\/+$/, '') : value; }
function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
  return value;
}
