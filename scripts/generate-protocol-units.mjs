import { readFileSync, writeFileSync } from 'node:fs';
import { generateProtocolUnits } from './spec-lib.mjs';

const write = process.argv.includes('--write');
const recipes = JSON.parse(readFileSync(new URL('../specs/protocol-recipes.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('../specs/sources.json', import.meta.url))).sources;
const output = { schema_version: 1, units: generateProtocolUnits(recipes, sources) };
const destination = new URL('../specs/derived/protocol-units.json', import.meta.url);
if (write) {
  writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Generated ${output.units.length} protocol units from reviewed recipes and persisted queries.`);
} else {
  const recorded = JSON.parse(readFileSync(destination));
  if (JSON.stringify(recorded) !== JSON.stringify(output)) {
    console.error('specs/derived/protocol-units.json differs from deterministic recipe generation. Run npm run generate:protocol-units.');
    process.exitCode = 1;
  } else {
    console.log(`Protocol generation is clean: ${output.units.length} units.`);
  }
}
