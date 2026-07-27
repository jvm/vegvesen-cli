import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/vegvesen.js', import.meta.url));
const fixtureScript = fileURLToPath(new URL('../fixtures/http-server.mjs', import.meta.url));
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const examples = extractVegvesenExamples(readme);
const directory = mkdtempSync(join(tmpdir(), 'vegvesen-examples-'));
const fixture = spawn(process.execPath, [fixtureScript], { stdio: ['ignore', 'pipe', 'inherit'] });
const origin = await new Promise((resolve, reject) => {
  fixture.once('error', reject);
  fixture.stdout.once('data', (chunk) => resolve(String(chunk).trim()));
});
fixture.stdout.destroy();
fixture.unref();

const environment = {
  ...process.env,
  NO_COLOR: '1',
  VEGVESEN_CONFIG: join(directory, 'config.json'),
  VEGVESEN_CATALOG_BASE_URL: origin,
  VEGVESEN_NVDB_CATALOG_BASE_URL: origin,
  VEGVESEN_NVDB_AREAS_BASE_URL: origin,
  VEGVESEN_PARKING_BASE_URL: origin,
  VEGVESEN_NVDB_STATUS_BASE_URL: origin,
};

try {
  for (const example of examples) {
    const args = tokenize(example).slice(1);
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: directory,
      env: environment,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      console.error(`Invalid README example: ${example}`);
      console.error(result.stderr);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  fixture.kill('SIGKILL');
}

if (!process.exitCode) console.log(`Executed ${examples.length} README examples against fixture services`);

function extractVegvesenExamples(markdown) {
  const commands = [];
  for (const match of markdown.matchAll(/```sh\n([\s\S]*?)```/g)) {
    const joined = match[1].replace(/\\\n\s*/g, ' ');
    for (const line of joined.split('\n').map((value) => value.trim())) {
      if (line.startsWith('vegvesen ')) commands.push(line);
    }
  }
  if (commands.length === 0) throw new Error('README contains no vegvesen examples');
  return commands;
}

function tokenize(command) {
  const tokens = [];
  for (const match of command.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) tokens.push(match[1] ?? match[2] ?? match[3]);
  return tokens;
}
