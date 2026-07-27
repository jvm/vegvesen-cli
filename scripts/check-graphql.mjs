import { readFileSync, readdirSync } from 'node:fs';
import { buildClientSchema, parse, validate } from 'graphql';

const introspection = JSON.parse(readFileSync(new URL('../specs/graphql/traffic-introspection.json', import.meta.url)));
const schema = buildClientSchema(introspection);
const directory = new URL('../specs/graphql/queries/', import.meta.url);
let failures = 0;
for (const file of readdirSync(directory).filter((name) => name.endsWith('.graphql')).sort()) {
  const errors = validate(schema, parse(readFileSync(new URL(file, directory), 'utf8')));
  for (const error of errors) console.error(`${file}: ${error.message}`);
  failures += errors.length;
}
if (failures) process.exitCode = 1;
else console.log(`Validated ${readdirSync(directory).filter((name) => name.endsWith('.graphql')).length} persisted Trafikkdata queries`);
