import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canonicalizeSource, extractOperations, generateProtocolUnits, validateOverlayTargets, validatePublicOperations } from '../scripts/spec-lib.mjs';
import { overlaySchema, sourcesSchema } from '../scripts/spec-schema.mjs';

const fixture = JSON.stringify({
  openapi: '3.1.0',
  security: [{ bearerAuth: [] }],
  paths: {
    '/items/{id}/': {
      get: { operationId: 'getItem', responses: { 200: { content: { 'application/json': {} } } } },
      post: { operationId: 'readOnlyPost', security: [], requestBody: { content: { 'application/json': {} } }, responses: { 200: { content: { 'application/geo+json': {} } } } },
    },
  },
});

test('contract extraction is deterministic and preserves security/media evidence', () => {
  const source = { contract_id: 'fixture', service: 'fixture', kind: 'openapi' };
  const first = canonicalizeSource(fixture, 'openapi');
  const second = canonicalizeSource(`${fixture}\r\n`, 'openapi');
  assert.equal(first.sha256, second.sha256);
  const operations = extractOperations(source, first.parsed, first.sha256);
  assert.deepEqual(operations.map((operation) => operation.id), ['fixture:GET /items/{id}', 'fixture:POST /items/{id}']);
  assert.deepEqual(operations[0].declared_security, [{ bearerAuth: [] }]);
  assert.deepEqual(operations[1].declared_security, []);
  assert.deepEqual(operations[1].media_types, ['application/geo+json', 'application/json']);
  assert.deepEqual(operations[0].path_parameters, []);
  assert.deepEqual(operations[0].required_query_parameters, []);
  assert.equal(canonicalizeSource('<a href="/b?nonce=1"><a href="/a">', 'html-links').sha256, canonicalizeSource('<a href="/a"><a href="/b?nonce=2">', 'html-links').sha256);
});

test('overlay schema rejects incomplete policy and target validation rejects drift', () => {
  assert.throws(() => overlaySchema.parse({ schema_version: 1, contract_id: 'fixture', source_digest: `sha256:${'0'.repeat(64)}`, reviewed_at: '2026-07-27', owner: 'owner', operations: [{ target_id: 'a' }] }));
  const expected = [{ id: 'a' }, { id: 'b' }];
  assert.doesNotThrow(() => validateOverlayTargets(expected, [{ target_id: 'a' }, { target_id: 'b' }]));
  assert.throws(() => validateOverlayTargets(expected, [{ target_id: 'a' }]), /unclassified/);
  assert.throws(() => validateOverlayTargets(expected, [{ target_id: 'a' }, { target_id: 'a' }]), /Duplicate/);
  assert.throws(() => validateOverlayTargets(expected, [{ target_id: 'a' }, { target_id: 'gone' }]), /disappeared/);
});

test('reviewed protocol recipes deterministically generate the checked-in inventory', () => {
  const recipes = JSON.parse(readFileSync(new URL('../specs/protocol-recipes.json', import.meta.url)));
  const sources = JSON.parse(readFileSync(new URL('../specs/sources.json', import.meta.url)));
  const recorded = JSON.parse(readFileSync(new URL('../specs/derived/protocol-units.json', import.meta.url)));
  assert.deepEqual(generateProtocolUnits(recipes, sources.sources), recorded.units);
  const omitted = globalThis.structuredClone(recipes);
  omitted.catalog.actions.pop();
  assert.throws(() => generateProtocolUnits(omitted, sources.sources), /CKAN actions recipe is incomplete/);
  const invalidSources = globalThis.structuredClone(sources);
  delete invalidSources.sources[0].license;
  assert.throws(() => sourcesSchema.parse(invalidSources));
});

test('generated runtime allowlist rejects protected injection and metadata mismatch', () => {
  const target = { id: 'fixture:GET /items', service: 'fixture', method: 'GET', path: '/items', path_parameters: [], query_parameters: ['group'], required_query_parameters: ['group'] };
  const operation = { target_id: target.id, service: 'fixture', id: 'items', method: 'GET', origin: 'https://fixture.test', path: '/items', path_parameters: [], query_parameters: ['group'], required_query_parameters: ['group'], effect: 'read', retry: 'safe' };
  const origins = new Map([['fixture', 'https://fixture.test']]);
  assert.doesNotThrow(() => validatePublicOperations([operation], [target], new Map([[target.id, { target_id: target.id, access: 'public-anonymous', disposition: 'generated-operation' }]]), origins));
  assert.throws(() => validatePublicOperations([operation], [target], new Map([[target.id, { target_id: target.id, access: 'admin', disposition: 'generated-operation' }]]), origins), /lacks public-anonymous/);
  assert.throws(() => validatePublicOperations([{ ...operation, query_parameters: [] }], [target], new Map([[target.id, { target_id: target.id, access: 'public-anonymous', disposition: 'generated-operation' }]]), origins), /query_parameters mismatch/);
});

test('checked-in coverage regenerates offline and exact gate passes', () => {
  for (const [script, expected] of [['scripts/generate-protocol-units.mjs', /Protocol generation is clean/], ['scripts/generate-coverage.mjs', /Coverage generation is clean/], ['scripts/check-coverage.mjs', /exact units/]]) {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, expected);
  }
  const packedSources = JSON.parse(readFileSync(new URL('../specs/sources.json', import.meta.url)));
  assert.ok(packedSources.sources.every((source) => source.redistribution === 'reference-only' || source.redistribution === 'snapshot-approved'));
});
