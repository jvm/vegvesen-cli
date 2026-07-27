import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/vegvesen.js', import.meta.url));
const examples = [
  ['version', '--json'],
  ['service', 'list', '--format', 'json', '--no-input'],
  ['catalog', 'package', 'search', '--query', 'trafikk', '--limit', '25', '--format', 'json', '--no-input', '--help'],
  ['nvdb', 'area', 'county', 'list', '--page-size', '50', '--limit', '100', '--format', 'json', '--help'],
  ['parking', 'provider', 'active', '--format', 'json', '--no-input', '--help'],
];

for (const args of examples) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    console.error(`Invalid example: vegvesen ${args.join(' ')}`);
    console.error(result.stderr);
    process.exit(1);
  }
}
console.log(`Validated ${examples.length} examples`);
