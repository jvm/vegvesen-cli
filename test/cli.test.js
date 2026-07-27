import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/vegvesen.js', import.meta.url));
const fixtureScript = fileURLToPath(new URL('../fixtures/http-server.mjs', import.meta.url));
const requestLog = join(mkdtempSync(join(tmpdir(), 'vegvesen-http-')), 'requests.ndjson');
let fixture;
let origin;

before(async () => {
  writeFileSync(requestLog, '');
  fixture = spawn(process.execPath, [fixtureScript], { env: { ...process.env, REQUEST_LOG: requestLog }, stdio: ['ignore', 'pipe', 'inherit'] });
  origin = await new Promise((resolve, reject) => {
    fixture.once('error', reject);
    fixture.stdout.once('data', (chunk) => resolve(String(chunk).trim()));
  });
  fixture.stdout.destroy();
  fixture.unref();
});

after(() => {
  fixture.kill('SIGKILL');
});

function requests() {
  return readFileSync(requestLog, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}

function run(args, extra = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    input: undefined,
    timeout: 5000,
    env: {
      ...process.env,
      NO_COLOR: '1',
      VEGVESEN_CATALOG_BASE_URL: origin,
      VEGVESEN_NVDB_CATALOG_BASE_URL: origin,
      VEGVESEN_NVDB_AREAS_BASE_URL: origin,
      VEGVESEN_PARKING_BASE_URL: origin,
      VEGVESEN_NVDB_STATUS_BASE_URL: origin,
      ...extra.env,
    },
    cwd: extra.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('prints focused help and bare version', () => {
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: vegvesen/);
  assert.match(help.stdout, /catalog/);
  assert.equal(help.stderr, '');
  assert.equal(run(['--version']).stdout, '0.1.0\n');
});

test('rejects unknown input before network access', () => {
  const beforeCount = requests().length;
  const result = run(['wat', '--json']);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  const error = JSON.parse(result.stderr);
  assert.equal(error.error.code, 'INVALID_USAGE');
  assert.match(error.error.hint, /--help/);
  assert.equal(requests().length, beforeCount);
});

test('machine mode has clean JSON and detached stdin cannot hang', () => {
  const result = run(['version', '--json', '--no-input']);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).schema_version, 1);
  assert.doesNotMatch(result.stdout, /\x1b\[/);
});

test('catalog search is bounded and reports cursor', () => {
  const result = run(['catalog', 'package', 'search', '--page-size', '1', '--limit', '2', '--json', '--no-input']);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.data.map((item) => item.id), ['a', 'b']);
  assert.equal(payload.meta.has_more, true);
  assert.equal(payload.meta.next_cursor, '2');
});

test('HTTP failures have stable branches and safe reads retry', () => {
  const forbidden = run(['catalog', 'package', 'get', 'forbidden', '--json', '--retries', '0']);
  assert.equal(forbidden.status, 3);
  assert.equal(JSON.parse(forbidden.stderr).error.code, 'ACCESS_NOT_AVAILABLE_IN_V1');

  const retried = run(['catalog', 'package', 'get', 'retry', '--json', '--retries', '1']);
  assert.equal(retried.status, 0, retried.stderr);
  assert.equal(JSON.parse(retried.stdout).data.id, 'retry');

  const timeout = run(['catalog', 'package', 'get', 'slow', '--json', '--timeout', '10ms', '--retries', '0']);
  assert.equal(timeout.status, 8);
  assert.equal(JSON.parse(timeout.stderr).error.code, 'NETWORK_TIMEOUT');

  const malformed = run(['catalog', 'package', 'get', 'malformed', '--json', '--retries', '0']);
  assert.equal(malformed.status, 7);
  assert.equal(JSON.parse(malformed.stderr).error.code, 'INVALID_UPSTREAM_JSON');
});

test('NVDB commands send X-Client and preserve bounded empty schema', () => {
  const result = run(['nvdb', 'catalog', 'version', '--json', '--no-input']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).data.versjon, 'fixture');
  const matching = requests().findLast((request) => request.url === '/datakatalog/api/v1/versjon');
  assert.match(matching.headers['x-client'], /^vegvesen-cli\//);
  assert.equal(matching.headers.authorization, undefined);
  assert.equal(matching.headers.cookie, undefined);

  const areas = run(['nvdb', 'area', 'county', 'list', '--limit', '2', '--json']);
  const payload = JSON.parse(areas.stdout);
  assert.equal(payload.data.length, 2);
  assert.equal(payload.meta.has_more, true);
  assert.match(payload.meta.full_retrieval, /--all --format ndjson/);
});

test('parking and status reads use current paths', () => {
  const parking = run(['parking', 'provider', 'active', '--json']);
  assert.equal(parking.status, 0, parking.stderr);
  assert.equal(JSON.parse(parking.stdout).data[0].organisasjonsnummer, '123456789');
  const status = run(['nvdb', 'status', 'message', 'list', '--state', 'unresolved', '--json']);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).data[0].id, 7);
});

test('native artifact writes atomically and emits JSON receipt', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vegvesen-artifact-'));
  const result = run(['parking', 'sign-plan', 'get', '42', '--output', 'plan.pdf', '--receipt-format', 'json', '--no-input'], { cwd: directory });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.data.media_type, 'application/pdf');
  assert.equal(receipt.data.size_bytes, 16);
  assert.equal(readFileSync(join(directory, 'plan.pdf'), 'utf8'), '%PDF-1.7 fixture');
  const repeated = run(['parking', 'sign-plan', 'get', '42', '--output', 'plan.pdf', '--receipt-format', 'json'], { cwd: directory });
  assert.equal(repeated.status, 5);
  assert.equal(JSON.parse(repeated.stderr).error.code, 'OUTPUT_EXISTS');
});

test('config is atomic, allowlisted, and inspectable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vegvesen-config-'));
  const env = { VEGVESEN_CONFIG: join(directory, 'config.json') };
  const set = run(['config', 'set', 'retries', '3', '--json'], { env });
  assert.equal(set.status, 0, set.stderr);
  const show = run(['config', 'show', '--json'], { env });
  assert.equal(JSON.parse(show.stdout).data.effective.retries, 3);
  const forbidden = run(['config', 'set', 'token', 'secret', '--json'], { env });
  assert.equal(forbidden.status, 2);
  assert.equal(JSON.parse(forbidden.stderr).error.code, 'INVALID_USAGE');
});

test('invalid combinations fail with no stdout', () => {
  for (const args of [
    ['service', 'list', '--all', '--format', 'json'],
    ['service', 'list', '--all', '--limit', '2', '--format', 'ndjson'],
    ['service', 'list', '--schema-version', '2', '--json'],
    ['service', 'list', '--limit', '1', '--limit', '2', '--json'],
    ['parking', 'provider', 'get', '123', '--json'],
    ['parking', 'sign-plan', 'get', '42', '--output', '-', '--json'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stderr}`);
    assert.equal(result.stdout, '');
    JSON.parse(result.stderr);
  }
});
