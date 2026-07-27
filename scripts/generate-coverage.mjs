import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { generateProtocolUnits } from './spec-lib.mjs';

const write = process.argv.includes('--write');
const openapi = JSON.parse(readFileSync(new URL('../specs/derived/openapi-operations.json', import.meta.url))).operations;
const sources = JSON.parse(readFileSync(new URL('../specs/sources.json', import.meta.url))).sources;
const recipes = JSON.parse(readFileSync(new URL('../specs/protocol-recipes.json', import.meta.url)));
const protocol = generateProtocolUnits(recipes, sources);
const recordedProtocol = JSON.parse(readFileSync(new URL('../specs/derived/protocol-units.json', import.meta.url))).units;
if (JSON.stringify(recordedProtocol) !== JSON.stringify(protocol)) throw new Error('Derived protocol units are stale or tampered; run npm run generate:protocol-units');
const expected = [...openapi, ...protocol];
const overlaysDirectory = new URL('../specs/overlays/', import.meta.url);
const overlays = readdirSync(overlaysDirectory).filter((name) => name.endsWith('.json') && name !== 'schema.json').flatMap((name) => {
  const overlay = JSON.parse(readFileSync(new URL(name, overlaysDirectory)));
  return overlay.operations.map((operation) => ({ ...operation, contract_id: overlay.contract_id, source_digest: overlay.source_digest, owner: overlay.owner, reviewed_at: overlay.reviewed_at }));
});
const byTarget = new Map(overlays.map((item) => [item.target_id, item]));
const units = expected.map((target) => {
  const policy = byTarget.get(target.id);
  if (!policy) throw new Error(`Missing overlay target: ${target.id}`);
  return {
    unit: target.id,
    service: target.service,
    contract_id: target.contract_id,
    source_digest: target.source_digest,
    disposition: policy.disposition,
    reason: policy.reason ?? `${policy.disposition} approved by ${policy.owner} on ${policy.reviewed_at}`,
    evidence: policy.evidence,
    ...(policy.command ? { command: policy.command } : {}),
  };
}).sort((a, b) => a.unit.localeCompare(b.unit));
const output = { schema_version: 1, reviewed_at: '2026-07-27', owner: 'Jose Mocito', units };
if (write) {
  writeFileSync(new URL('../coverage.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Generated ${units.length} exact protocol/operation coverage units.`);
} else {
  const recorded = JSON.parse(readFileSync(new URL('../coverage.json', import.meta.url)));
  if (JSON.stringify(recorded) !== JSON.stringify(output)) {
    console.error('coverage.json differs from deterministic generation. Run npm run generate:coverage.');
    process.exitCode = 1;
  } else console.log(`Coverage generation is clean: ${units.length} exact units.`);
}
