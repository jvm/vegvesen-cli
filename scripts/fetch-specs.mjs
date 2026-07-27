import { readFileSync, writeFileSync } from 'node:fs';
import { getIntrospectionQuery } from 'graphql';
import { canonicalizeSource, extractOperations } from './spec-lib.mjs';

const write = process.argv.includes('--write');
const sources = JSON.parse(readFileSync(new URL('../specs/sources.json', import.meta.url))).sources;
const operations = [];
let changed = false;

for (const source of sources) {
  const response = await fetch(source.url, {
    method: source.kind === 'graphql-introspection' ? 'POST' : 'GET',
    headers: source.kind === 'graphql-introspection' ? { 'content-type': 'application/json' } : { accept: source.kind === 'ogc-dynamic' ? 'application/json' : 'application/json, application/yaml, text/yaml, text/html, */*' },
    ...(source.kind === 'graphql-introspection' ? { body: JSON.stringify({ query: getIntrospectionQuery({ descriptions: true, schemaDescription: true, directiveIsRepeatable: true, specifiedByUrl: true, inputValueDeprecation: true }) }) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const expectedStatus = source.expected_status ?? 200;
  if (response.status !== expectedStatus) throw new Error(`${source.contract_id}: expected HTTP ${expectedStatus}, received ${response.status}`);
  const text = await response.text();
  if (text.length < 20) throw new Error(`${source.contract_id}: unexpectedly short source`);
  const { parsed, sha256: digest } = canonicalizeSource(text, source.kind);
  const drifted = digest !== source.sha256;
  changed ||= drifted;
  console.log(`${source.contract_id}\t${drifted ? 'DRIFT' : 'unchanged'}\t${digest}`);
  operations.push(...extractOperations(source, parsed, digest));
}
operations.sort((a, b) => a.id.localeCompare(b.id));
if (write) {
  writeFileSync(new URL('../specs/derived/openapi-operations.json', import.meta.url), `${JSON.stringify({ schema_version: 1, operations }, null, 2)}\n`);
  console.log(`Wrote ${operations.length} derived OpenAPI/Swagger operation identities; no raw reference-only contract was saved.`);
} else {
  const recorded = JSON.parse(readFileSync(new URL('../specs/derived/openapi-operations.json', import.meta.url)));
  if (JSON.stringify(recorded.operations) !== JSON.stringify(operations)) {
    console.error('Derived operation inventory differs. Run npm run fetch:specs -- --write and review overlays.');
    changed = true;
  }
}
if (changed && !write) process.exitCode = 1;

