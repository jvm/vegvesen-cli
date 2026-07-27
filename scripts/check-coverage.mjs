import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../specs/manifest.json', import.meta.url)));
const coverage = JSON.parse(readFileSync(new URL('../coverage.json', import.meta.url)));
const services = new Set(manifest.services.map((service) => service.id));
const dispositions = new Set(['curated-command', 'generated-operation', 'dynamic-protocol', 'excluded-with-reviewed-reason', 'blocked-by-health-gate']);
const units = new Set();
for (const unit of coverage.units) {
  assert(services.has(unit.service), `Unknown coverage service: ${unit.service}`);
  assert(dispositions.has(unit.disposition), `Invalid disposition: ${unit.disposition}`);
  assert(unit.reason, `Missing reason: ${unit.unit}`);
  assert(!units.has(unit.unit), `Duplicate coverage unit: ${unit.unit}`);
  units.add(unit.unit);
}
for (const service of services) assert(coverage.units.some((unit) => unit.service === service), `Service lacks coverage unit: ${service}`);
console.log(`Coverage classified: ${coverage.units.length} units across ${services.size} services`);
