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
      VEGVESEN_NVDB_CORE_BASE_URL: origin,
      VEGVESEN_ROUTE_BASE_URL: origin,
      VEGVESEN_TRAFFIC_BASE_URL: origin,
      VEGVESEN_OGC_BASE_URL: origin,
      VEGVESEN_TNITS_BASE_URL: origin,
      VEGVESEN_NVDB_EXPORT_BASE_URL: origin,
      VEGVESEN_FIKS_BASE_URL: origin,
      VEGVESEN_NVDB_REPORTS_BASE_URL: origin,
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
  const completion = run(['completion', 'bash', '--format', 'raw', '--no-input']);
  assert.equal(completion.status, 0, completion.stderr);
  assert.match(completion.stdout, /complete -F _vegvesen_complete vegvesen/);
});

test('rejects unknown commands, options, and trailing input before network access', () => {
  const beforeCount = requests().length;
  for (const args of [['wat', '--json'], ['catalog', 'package', 'search', '--unknown', '--json'], ['catalog', 'status', 'get', 'trailing', '--json']]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}: ${result.stderr}`);
    assert.equal(result.stdout, '');
    const error = JSON.parse(result.stderr);
    assert.equal(error.error.code, 'INVALID_USAGE');
    assert.match(error.error.hint, /--help/);
  }
  assert.equal(requests().length, beforeCount);
});

test('machine mode has clean JSON and detached stdin cannot hang', () => {
  const result = run(['version', '--json', '--no-input']);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).schema_version, 1);
  assert.doesNotMatch(result.stdout, /\x1b\[/);
});

test('doctor optionally probes anonymous service reachability', () => {
  const local = run(['doctor', '--json']);
  assert.equal(local.status, 0, local.stderr);
  assert.equal(JSON.parse(local.stdout).data.find((check) => check.name === 'catalog').status, 'not_checked');

  const live = run(['doctor', '--live', '--timeout', '1s', '--retries', '0', '--json']);
  assert.equal(live.status, 0, live.stderr);
  const payload = JSON.parse(live.stdout);
  for (const service of ['catalog', 'nvdb-catalog', 'nvdb-areas', 'parking', 'nvdb-status', 'nvdb-core', 'route', 'traffic']) {
    assert.equal(payload.data.find((check) => check.name === service).status, 'ok');
  }
  assert.equal(payload.meta.live, true);

  const down = run(['doctor', '--live', '--timeout', '50ms', '--retries', '0', '--json'], { env: { VEGVESEN_CATALOG_BASE_URL: 'http://127.0.0.1:1' } });
  assert.equal(down.status, 0, down.stderr);
  assert.equal(JSON.parse(down.stdout).data.find((check) => check.name === 'catalog').status, 'down');
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

  const redirect = run(['catalog', 'package', 'get', 'redirect-evil', '--json', '--retries', '0']);
  assert.equal(redirect.status, 3);
  assert.equal(JSON.parse(redirect.stderr).error.code, 'CROSS_ORIGIN_REDIRECT_REFUSED');
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

test('NVDB core preserves opaque cursors and streams all pages', () => {
  const bounded = run(['nvdb', 'object', 'list', '105', '--page-size', '2', '--limit', '3', '--json']);
  assert.equal(bounded.status, 0, bounded.stderr);
  const payload = JSON.parse(bounded.stdout);
  assert.deepEqual(payload.data.map((item) => item.id), [101, 102, 103]);
  assert.equal(payload.meta.has_more, false);
  assert.equal(payload.meta.total, 3);

  const stream = run(['nvdb', 'object', 'list', '105', '--page-size', '2', '--all', '--format', 'ndjson']);
  assert.equal(stream.status, 0, stream.stderr);
  const records = stream.stdout.trim().split('\n').map(JSON.parse);
  assert.deepEqual(records.filter((record) => record.type === 'item').map((record) => record.data.id), [101, 102, 103]);
  assert.equal(records.at(-1).meta.complete, true);

  const raw = run(['nvdb', 'object', 'list', '105', '--page-size', '2', '--all', '--field', 'id', '--format', 'raw']);
  assert.equal(raw.status, 0, raw.stderr);
  assert.equal(raw.stdout, '101\n102\n103\n');

  const position = run(['nvdb', 'network', 'position', 'locate', '--lat', '59.9', '--lon', '10.7', '--json']);
  assert.equal(position.status, 0, position.stderr);
  assert.equal(JSON.parse(position.stdout).data[0].kommune, 301);
});

test('every curated NVDB core command maps to an offline fixture', () => {
  const commands = [
    ['nvdb', 'object', 'get', '101'],
    ['nvdb', 'object', 'get', '101', '--type-id', '105', '--object-version', '2'],
    ['nvdb', 'object', 'versions', '105', '101'],
    ['nvdb', 'object', 'changes', '105', '--limit', '1'],
    ['nvdb', 'object', 'statistics', '105'],
    ['nvdb', 'network', 'link', 'list', '--limit', '1'],
    ['nvdb', 'network', 'link', 'get', '201'],
    ['nvdb', 'network', 'link', 'changes', '--limit', '1'],
    ['nvdb', 'network', 'segment', 'list', '--limit', '1'],
    ['nvdb', 'network', 'segment', 'get', '201'],
    ['nvdb', 'network', 'segment', 'statistics'],
    ['nvdb', 'network', 'node', 'list', '--limit', '1'],
    ['nvdb', 'network', 'node', 'get', '201'],
    ['nvdb', 'network', 'road-position', 'locate', '--road-reference', 'EV6'],
    ['nvdb', 'network', 'road-position', 'batch', '--road-references', 'EV6,RV4'],
    ['nvdb', 'network', 'route', 'calculate', '--start', '0.1@1', '--end', '0.9@1'],
    ['nvdb', 'monitor', 'change-set', 'get', 'fixture-id'],
  ];
  for (const args of commands) {
    const result = run([...args, '--json', '--no-input']);
    assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
    JSON.parse(result.stdout);
  }
  const changeRequest = requests().findLast((request) => request.url.startsWith('/vegobjekter/api/v4/vegobjekter/105/endringer'));
  assert.doesNotMatch(changeRequest.url, /inkluderAntall/);
});

test('Routing V3 validates and maps all nine profiles', () => {
  const profiles = ['best', 'tourist', 'bike', 'normal-transport', 'special-transport', 'timber-transport', 'modular-vehicle', 'bk-12-100', 'bk-12-65'];
  for (const profile of profiles) {
    const heavy = ['normal-transport', 'special-transport', 'timber-transport', 'modular-vehicle'].includes(profile) ? ['--load-class', 'Bk_10_50'] : [];
    const result = run(['route', 'calculate', '--profile', profile, ...heavy, '--stop', '10.7,59.9', '--stop', '10.8,60.0', '--json', '--no-input']);
    assert.equal(result.status, 0, `${profile}: ${result.stderr}`);
    assert.equal(JSON.parse(result.stdout).data.routes.length, 1);
  }
  const beforeCount = requests().length;
  const invalid = run(['route', 'calculate', '--profile', 'spaceship', '--stop', '10.7,59.9', '--stop', '10.8,60.0', '--json']);
  assert.equal(invalid.status, 2);
  const missingLoadClass = run(['route', 'calculate', '--profile', 'normal-transport', '--stop', '10.7,59.9', '--stop', '10.8,60.0', '--json']);
  assert.equal(missingLoadClass.status, 2);
  assert.equal(requests().length, beforeCount);
});

test('Trafikkdata supports bounded cursors, streams, and partial results', () => {
  const stations = run(['traffic', 'station', 'list', '--limit', '2', '--json']);
  assert.equal(stations.status, 0, stations.stderr);
  assert.equal(JSON.parse(stations.stdout).data.length, 2);
  assert.equal(JSON.parse(stations.stdout).meta.has_more, true);

  const bounded = run(['traffic', 'volume', 'hourly', '--station', 's1', '--from', '2025-01-01T00:00:00+01:00', '--to', '2025-01-01T03:00:00+01:00', '--page-size', '2', '--limit', '3', '--json']);
  assert.equal(bounded.status, 0, bounded.stderr);
  assert.equal(JSON.parse(bounded.stdout).data.length, 3);
  assert.equal(JSON.parse(bounded.stdout).meta.has_more, false);

  const stream = run(['traffic', 'volume', 'hourly', '--station', 's1', '--from', '2025-01-01T00:00:00+01:00', '--to', '2025-01-01T03:00:00+01:00', '--page-size', '2', '--all', '--format', 'ndjson']);
  assert.equal(stream.status, 0, stream.stderr);
  const records = stream.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(records.filter((record) => record.type === 'item').length, 3);
  assert.equal(records.at(-1).meta.complete, true);

  const partial = run(['traffic', 'station', 'get', 'partial', '--json']);
  assert.equal(partial.status, 9);
  assert.equal(partial.stderr, '');
  assert.equal(JSON.parse(partial.stdout).meta.partial, true);
  assert.equal(JSON.parse(partial.stdout).data.errors[0].message, 'fixture partial warning');
  const allowed = run(['traffic', 'station', 'get', 'partial', '--allow-partial', '--json']);
  assert.equal(allowed.status, 0, allowed.stderr);

  const failed = run(['traffic', 'station', 'get', 'error', '--json']);
  assert.equal(failed.status, 7);
  assert.equal(failed.stdout, '');
  assert.equal(JSON.parse(failed.stderr).error.code, 'GRAPHQL_REQUEST_FAILED');

  const leaked = run(['traffic', 'station', 'get', 'leak', '--json', '--verbose']);
  assert.equal(leaked.status, 7);
  assert.doesNotMatch(`${leaked.stdout}${leaked.stderr}`, /CANARY-hunter2-value/);
  assert.match(leaked.stderr, /\[REDACTED\]/);
});

test('every curated Trafikkdata command maps to a validated persisted query', () => {
  const period = ['--station', 's1', '--from', '2025-01-01T00:00:00+01:00', '--to', '2025-01-01T03:00:00+01:00', '--limit', '1'];
  const commands = [
    ['traffic', 'station', 'get', 's1'],
    ['traffic', 'volume', 'daily', ...period],
    ['traffic', 'volume', 'length-class', ...period],
    ['traffic', 'aadt', 'get', '--station', 's1', '--year', '2025'],
    ['traffic', 'index', 'station', '--station', 's1', '--year', '2025'],
    ['traffic', 'index', 'area', '--id', '1', '--year', '2025'],
    ['traffic', 'index', 'published'],
    ['traffic', 'quality', 'get', ...period],
    ['traffic', 'coverage', 'get', ...period],
    ['traffic', 'reference', 'road-category', 'list'],
    ['traffic', 'reference', 'area', 'list'],
  ];
  for (const args of commands) {
    const result = run([...args, '--json', '--no-input']);
    assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
    JSON.parse(result.stdout);
  }
});

test('Phase 5 OGC, TN-ITS, and export commands use bounded protocol mappings', () => {
  for (const args of [
    ['ogc', 'wms', 'capabilities', '--family', 'nvdb_2_0'],
    ['ogc', 'feature', 'collection', 'list'],
    ['ogc', 'feature', 'item', 'list', 'collection1', '--limit', '1'],
    ['tnits', 'type', 'list'],
    ['tnits', 'snapshot', 'list', 'SpeedLimit'],
    ['tnits', 'update', 'list', 'RoadName', '--from', '2026-01-01'],
  ]) {
    const result = run([...args, '--json', '--no-input']);
    assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
    JSON.parse(result.stdout);
  }
  const unsafeXml = run(['ogc', 'wms', 'capabilities', '--family', 'datex_3_1', '--json', '--no-input']);
  assert.equal(unsafeXml.status, 7);
  assert.equal(JSON.parse(unsafeXml.stderr).error.code, 'UNSAFE_UPSTREAM_XML');
  const featureStream = run(['ogc', 'feature', 'item', 'list', 'collection1', '--all', '--format', 'ndjson', '--no-input']);
  assert.equal(featureStream.status, 0, featureStream.stderr);
  assert.match(featureStream.stdout, /\"type\":\"summary\"/);
  const streamed = run(['tnits', 'snapshot', 'download', '/api/v1/download?path=fixture.gml', '--output', '-', '--format', 'raw', '--no-input']);
  assert.equal(streamed.status, 0, streamed.stderr);
  assert.equal(streamed.stdout, '<gml>fixture</gml>');
  const directory = mkdtempSync(join(tmpdir(), 'vegvesen-phase5-'));
  const featurePath = join(directory, 'features.geojson');
  const featureArtifact = run(['ogc', 'wfs', 'feature', '--family', 'nvdb_2_0', '--type-name', 'fixture', '--output', featurePath, '--receipt-format', 'json', '--no-input']);
  assert.equal(featureArtifact.status, 0, featureArtifact.stderr);
  assert.equal(JSON.parse(readFileSync(featurePath, 'utf8')).type, 'FeatureCollection');
  const exported = run(['nvdb', 'export', 'object', '105', '--artifact-format', 'csv', '--municipality', '0301', '--output', join(directory, 'objects.csv'), '--receipt-format', 'json', '--no-input']);
  assert.equal(exported.status, 0, exported.stderr);
  assert.match(readFileSync(join(directory, 'objects.csv'), 'utf8'), /fixture/);
});

test('Phase 6 mutations require dry-run or confirmation and jobs are resumable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vegvesen-fiks-'));
  const bodyPath = join(directory, 'issue.json');
  writeFileSync(bodyPath, JSON.stringify({ emne: 'Fixture', kategori: 'FEIL_I_KARTDATA', lokasjon: { latitude: 59.9, longitude: 10.7 }, vegsystemreferanse: 'EV6' }));
  const before = requests().length;
  const preview = run(['fiks', 'issue', 'create', '--body', `@${bodyPath}`, '--dry-run', '--json', '--no-input']);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(requests().length, before);
  const refused = run(['fiks', 'issue', 'create', '--body', `@${bodyPath}`, '--json', '--no-input']);
  assert.equal(refused.status, 5);
  assert.equal(requests().length, before);
  const created = run(['fiks', 'issue', 'create', '--body', `@${bodyPath}`, '--yes', '--json', '--no-input']);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(JSON.parse(created.stdout).data.id, 43);
  const timeoutBodyPath = join(directory, 'timeout-issue.json');
  writeFileSync(timeoutBodyPath, JSON.stringify({ emne: 'TimeoutFixture', kategori: 'FEIL_I_KARTDATA', lokasjon: { latitude: 59.9, longitude: 10.7 }, vegsystemreferanse: 'EV6' }));
  const timeoutBefore = requests().filter((request) => request.url === '/api/v1/feilmelding/anonym').length;
  const ambiguous = run(['fiks', 'issue', 'create', '--body', `@${timeoutBodyPath}`, '--yes', '--timeout', '1ms', '--retries', '5', '--json', '--no-input']);
  assert.equal(ambiguous.status, 8);
  assert.equal(JSON.parse(ambiguous.stderr).error.code, 'MUTATION_OUTCOME_UNKNOWN');
  assert.ok(requests().filter((request) => request.url === '/api/v1/feilmelding/anonym').length <= timeoutBefore + 1);
  assert.equal(run(['nvdb', 'report', 'family', 'list', '--json', '--no-input']).status, 0);
  const reportBefore = requests().length;
  const reportPreview = run(['nvdb', 'report', 'generate', '--family', 'road-list', '--param', 'class=889', '--param', 'dato=2026-07-27', '--param', 'kommune=5028', '--dry-run', '--json', '--no-input']);
  assert.equal(reportPreview.status, 0, reportPreview.stderr);
  assert.equal(requests().length, reportBefore);
  const reportRefused = run(['nvdb', 'report', 'generate', '--family', 'road-list', '--param', 'class=889', '--param', 'dato=2026-07-27', '--param', 'kommune=5028', '--json', '--no-input']);
  assert.equal(reportRefused.status, 5);
  assert.equal(requests().length, reportBefore);
  const reportCallsBefore = requests().filter((request) => request.url.startsWith('/rapporter/veglister/889')).length;
  const reportFailed = run(['nvdb', 'report', 'generate', '--family', 'road-list', '--param', 'class=889', '--param', 'dato=2026-07-27', '--param', 'kommune=5028', '--yes', '--retries', '5', '--json', '--no-input']);
  assert.equal(reportFailed.status, 6);
  assert.equal(requests().filter((request) => request.url.startsWith('/rapporter/veglister/889')).length, reportCallsBefore + 1);
  const job = run(['nvdb', 'report', 'job', 'get', 'fixture-job', '--json', '--no-input']);
  assert.equal(job.status, 0, job.stderr);
  assert.equal(JSON.parse(job.stdout).meta.normalized_state, 'succeeded');
});

test('Phase 7 generated API exposes reviewed operations only', () => {
  assert.equal(run(['api', 'service', 'list', '--json', '--no-input']).status, 0);
  const list = run(['api', 'operation', 'list', 'nvdb-core', '--json', '--no-input']);
  assert.equal(JSON.parse(list.stdout).data.length, 3);
  const called = run(['api', 'operation', 'call', 'nvdb-core', 'object-statistics-grouped', '--param', 'vegobjekttypeid=105', '--param', 'gruppering=kommune', '--json', '--no-input']);
  assert.equal(called.status, 0, called.stderr);
  assert.equal(JSON.parse(called.stdout).meta.operation_id, 'object-statistics-grouped');
  const mapped = requests().findLast((request) => request.url.startsWith('/api/v4/vegobjekter/105/statistikk/gruppert'));
  assert.equal(new URL(mapped.url, origin).searchParams.get('gruppering'), 'kommune');
  const property = run(['api', 'operation', 'call', 'nvdb-core', 'object-statistics-grouped-property', '--param', 'vegobjekttypeid=105', '--param', 'egenskapstypeId=1', '--json', '--no-input']);
  assert.equal(property.status, 0, property.stderr);
  const propertyRequest = requests().findLast((request) => request.url.startsWith('/api/v4/vegobjekter/105/statistikk/gruppert/egenskap'));
  assert.equal(new URL(propertyRequest.url, origin).searchParams.get('egenskapstypeId'), '1');
  const network = run(['api', 'operation', 'call', 'nvdb-core', 'network-statistics-grouped', '--param', 'gruppering=kommune', '--json', '--no-input']);
  assert.equal(network.status, 0, network.stderr);
  const networkRequest = requests().findLast((request) => request.url.startsWith('/api/v4/veglenkesekvenser/segmentert/statistikk/gruppert'));
  assert.equal(new URL(networkRequest.url, origin).searchParams.get('gruppering'), 'kommune');
  const before = requests().length;
  const missingRequired = run(['api', 'operation', 'call', 'nvdb-core', 'object-statistics-grouped', '--param', 'vegobjekttypeid=105', '--json', '--no-input']);
  assert.equal(missingRequired.status, 2);
  const invalid = run(['api', 'operation', 'call', 'nvdb-core', 'object-statistics-grouped', '--param', 'url=https://evil.example', '--json', '--no-input']);
  assert.equal(invalid.status, 2);
  assert.equal(requests().length, before);
});

test('existing normalized output fails before network access', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vegvesen-output-'));
  writeFileSync(join(directory, 'result.json'), 'existing');
  const beforeCount = requests().length;
  const result = run(['catalog', 'package', 'search', '--output', 'result.json', '--json'], { cwd: directory });
  assert.equal(result.status, 5);
  assert.equal(JSON.parse(result.stderr).error.code, 'OUTPUT_EXISTS');
  assert.equal(requests().length, beforeCount);
  assert.equal(readFileSync(join(directory, 'result.json'), 'utf8'), 'existing');
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

test('NDJSON summary marks locally truncated results incomplete', () => {
  const limited = run(['nvdb', 'area', 'county', 'list', '--limit', '2', '--format', 'ndjson']);
  assert.equal(limited.status, 0, limited.stderr);
  const records = limited.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(records.at(-1).type, 'summary');
  assert.equal(records.at(-1).meta.complete, false);
  assert.equal(records.at(-1).meta.has_more, true);

  const complete = run(['nvdb', 'area', 'county', 'list', '--all', '--format', 'ndjson']);
  assert.equal(complete.status, 0, complete.stderr);
  assert.equal(complete.stdout.trim().split('\n').map(JSON.parse).at(-1).meta.complete, true);
});

test('invalid combinations fail with no stdout', () => {
  for (const args of [
    ['service', 'list', '--all', '--format', 'json'],
    ['service', 'list', '--all', '--limit', '2', '--format', 'ndjson'],
    ['service', 'list', '--schema-version', '2', '--json'],
    ['service', 'list', '--limit', '1', '--limit', '2', '--json'],
    ['doctor', '--live', '--timeout', 'forever', '--json'],
    ['route', 'calculate', '--profile', 'best', '--stop', '200,95', '--stop', '10,60', '--json'],
    ['traffic', 'aadt', 'get', '--station', 's1', '--year', '2025', '--day-type', 'HOLIDAY', '--json'],
    ['parking', 'provider', 'get', '123', '--json'],
    ['parking', 'sign-plan', 'get', '42', '--output', '-', '--json'],
    ['nvdb', 'area', 'county', 'list', '--cursor', '2', '--json'],
    ['nvdb', 'area', 'county', 'list', '--page-size', '2', '--json'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stderr}`);
    assert.equal(result.stdout, '');
    JSON.parse(result.stderr);
  }
});
