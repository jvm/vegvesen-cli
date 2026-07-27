import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../specs/manifest.json', import.meta.url)));
const coverage = JSON.parse(readFileSync(new URL('../coverage.json', import.meta.url)));
const operations = JSON.parse(readFileSync(new URL('../specs/operations.json', import.meta.url)));
const { commandRegistry } = await import('../dist/registry.js');
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
for (const operation of operations.operations) {
  assert(services.has(operation.service), `Unknown operation service: ${operation.service}`);
  assert(dispositions.has(operation.disposition), `Invalid operation disposition: ${operation.unit}`);
  if (operation.disposition === 'curated-command') assert(operation.command, `Curated operation lacks command: ${operation.unit}`);
  else assert(operation.reason, `Excluded operation lacks reason: ${operation.unit}`);
}
const mappedCommands = new Set(operations.operations.flatMap((operation) => (operation.command ?? '').split(';').map((command) => command.trim().split(' --')[0]).filter(Boolean)));
for (const command of commandRegistry.filter((entry) => entry.service !== 'local')) assert(mappedCommands.has(command.path), `Command lacks exact operation mapping: ${command.path}`);
console.log(`Coverage classified: ${coverage.units.length} product units and ${operations.operations.length} operation units across ${services.size} services`);
