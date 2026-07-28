import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { coverageSchema, manifestSchema, overlaySchema, sourcesSchema } from './spec-schema.mjs';
import { assertExclusionRules, assertRegistryBinding, generateProtocolUnits, validatePublicOperations } from './spec-lib.mjs';

const root = new URL('../', import.meta.url);
const manifest = manifestSchema.parse(json('specs/manifest.json'));
const sources = sourcesSchema.parse(json('specs/sources.json'));
const coverage = coverageSchema.parse(json('coverage.json'));
const openapi = json('specs/derived/openapi-operations.json').operations;
const recipes = json('specs/protocol-recipes.json');
const protocol = generateProtocolUnits(recipes, sources.sources);
assert.deepEqual(json('specs/derived/protocol-units.json').units, protocol, 'Derived protocol inventory differs from reviewed recipes/persisted queries');
const publicOperations = json('specs/public-operations.json').operations;
const { commandRegistry } = await import('../dist/registry.js');
const dispositions = new Set(['curated-command', 'generated-operation', 'dynamic-protocol', 'excluded-permanent']);
const publicDispositions = new Set(['curated-command', 'generated-operation', 'dynamic-protocol']);
const services = new Set(manifest.services.map((service) => service.id));
const registryPaths = new Set(commandRegistry.map((command) => command.path));

// Commands that answer from checked-in metadata or local state and issue no upstream request.
// Declared explicitly so a genuinely unmapped command cannot pass the binding check by absence.
const localOnlyCommands = new Set([
  ...commandRegistry.filter((command) => command.service === 'local').map((command) => command.path),
  'api service list', 'api operation list', 'api operation describe',
]);

assert.equal(manifest.schema_version, 1);
assert.equal(sources.schema_version, 1);
assert.equal(coverage.schema_version, 1);
const contracts = new Map();
for (const source of sources.sources) {
  assert(services.has(source.service), `Unknown source service: ${source.service}`);
  assert(source.contract_id && !contracts.has(source.contract_id), `Duplicate/missing contract_id: ${source.contract_id}`);
  assert.match(source.sha256, /^[a-f0-9]{64}$/);
  assert(['reference-only', 'snapshot-approved'].includes(source.redistribution));
  assert(source.license && source.redistribution_evidence, `Source lacks license/redistribution decision citation: ${source.contract_id}`);
  contracts.set(source.contract_id, source);
}
for (const service of manifest.services) {
  const owned = sources.sources.filter((source) => source.service === service.id);
  assert(owned.length > 0, `Manifest service has no pinned source: ${service.id}`);
  assert.deepEqual(new Set(service.contracts), new Set(owned.map((source) => source.contract_id)), `Manifest contract links differ: ${service.id}`);
  assert.equal(service.overlays.length, owned.length, `Manifest overlay links differ: ${service.id}`);
  assert(owned.every((source) => source.redistribution === service.redistribution), `Manifest/source redistribution decision differs: ${service.id}`);
  assert(service.anonymous_evidence && service.provenance && service.health_evidence, `Incomplete manifest evidence: ${service.id}`);
}

const expected = new Map([...openapi, ...protocol].map((target) => [target.id, target]));
assert.equal(expected.size, openapi.length + protocol.length, 'Duplicate derived target identity');
const overlays = new Map();
const overlayFiles = readdirSync(new URL('specs/overlays/', root)).filter((name) => name.endsWith('.json') && name !== 'schema.json');
for (const file of overlayFiles) {
  const overlay = overlaySchema.parse(json(`specs/overlays/${file}`));
  assert.equal(overlay.schema_version, 1);
  assert(contracts.has(overlay.contract_id), `Overlay references unknown contract: ${overlay.contract_id}`);
  assert.equal(overlay.source_digest, `sha256:${contracts.get(overlay.contract_id).sha256}`, `Overlay digest mismatch: ${overlay.contract_id}`);
  assert(overlay.owner && overlay.reviewed_at, `Overlay lacks owner review: ${overlay.contract_id}`);
  for (const policy of overlay.operations) {
    assert(!overlays.has(policy.target_id), `Duplicate overlay target: ${policy.target_id}`);
    const target = expected.get(policy.target_id);
    assert(target, `Overlay target disappeared: ${policy.target_id}`);
    assert.equal(target.contract_id, overlay.contract_id, `Overlay contract mismatch: ${policy.target_id}`);
    assert(dispositions.has(policy.disposition), `Invalid disposition: ${policy.target_id}`);
    assert(policy.evidence, `Missing evidence: ${policy.target_id}`);
    if (publicDispositions.has(policy.disposition)) {
      assert.equal(policy.access, 'public-anonymous', `Non-public access entered supported surface: ${policy.target_id}`);
      assert(Array.isArray(policy.command) && policy.command.length > 0, `Supported target lacks command: ${policy.target_id}`);
      for (const command of policy.command) {
        assert(registryPaths.has(command), `Overlay references unknown command: ${policy.target_id} -> ${command}`);
        assert(!/[;]| --/.test(command), `Command must be an exact registry path, not free text: ${policy.target_id} -> ${command}`);
      }
    } else {
      assert(policy.reason, `Exclusion lacks rationale: ${policy.target_id}`);
      assert(!policy.command, `Excluded target must not name a command: ${policy.target_id}`);
    }
    overlays.set(policy.target_id, policy);
  }
}
assert.equal(overlays.size, expected.size, `Overlay completeness mismatch: ${overlays.size}/${expected.size}`);
for (const id of expected.keys()) assert(overlays.has(id), `Expected target is unclassified: ${id}`);
validatePublicOperations(publicOperations, openapi, overlays, new Map(manifest.services.map((service) => [service.id, service.origin])));

const coverageUnits = new Map();
for (const unit of coverage.units) {
  assert(expected.has(unit.unit), `Coverage contains unknown target: ${unit.unit}`);
  assert(!coverageUnits.has(unit.unit), `Duplicate coverage target: ${unit.unit}`);
  assert.equal(unit.disposition, overlays.get(unit.unit).disposition, `Coverage/overlay disposition mismatch: ${unit.unit}`);
  assert.equal(unit.source_digest, expected.get(unit.unit).source_digest, `Coverage source digest mismatch: ${unit.unit}`);
  assert(unit.reason && unit.evidence, `Coverage evidence missing: ${unit.unit}`);
  coverageUnits.set(unit.unit, unit);
}
assert.equal(coverageUnits.size, expected.size, `Coverage completeness mismatch: ${coverageUnits.size}/${expected.size}`);

assertRegistryBinding(coverage.units, commandRegistry, localOnlyCommands, assert);
assertExclusionRules(coverage.units, assert);
console.log(`Coverage classified: ${coverage.units.length} exact units (${openapi.length} contract operations, ${protocol.length} protocol units) across ${services.size} services`);

function json(path) { return JSON.parse(readFileSync(new URL(path, root))); }
