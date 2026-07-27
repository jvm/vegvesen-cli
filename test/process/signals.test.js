import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../bin/vegvesen.js', import.meta.url));
const fixtureScript = fileURLToPath(new URL('../../fixtures/http-server.mjs', import.meta.url));
const requestLog = join(mkdtempSync(join(tmpdir(), 'vegvesen-signals-')), 'requests.ndjson');
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
after(() => fixture.kill('SIGKILL'));

async function waitUntil(predicate, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for fixture request');
}

async function interrupt(signal) {
  const child = spawn(process.execPath, [cli, 'nvdb', 'report', 'job', 'wait', 'fixture-running', '--wait-timeout', '2m', '--json', '--no-input'], {
    env: { ...process.env, NO_COLOR: '1', VEGVESEN_NVDB_REPORTS_BASE_URL: origin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  await waitUntil(() => readFileSync(requestLog, 'utf8').includes('/rapporter/poll/fixture-running'));
  const started = Date.now();
  child.kill(signal);
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, exitSignal) => resolve({ code, signal: exitSignal }));
  });
  assert.ok(Date.now() - started < 2000, 'signal shutdown should be prompt');
  return { ...result, stdout, stderr };
}

for (const [signal, expectedExit, expectedCode] of [['SIGINT', 130, 'INTERRUPTED'], ['SIGTERM', 143, 'TERMINATED']]) {
  test(`${signal} returns a numeric resumable exit without remote cancellation`, async () => {
    writeFileSync(requestLog, '');
    const result = await interrupt(signal);
    assert.deepEqual({ code: result.code, signal: result.signal }, { code: expectedExit, signal: null });
    assert.equal(result.stdout, '');
    const error = JSON.parse(result.stderr).error;
    assert.equal(error.code, expectedCode);
    assert.equal(error.identifier, 'fixture-running');
    assert.match(error.hint, /job wait fixture-running/);
    const requests = readFileSync(requestLog, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    assert.ok(requests.some((request) => request.method === 'GET' && request.url === '/rapporter/poll/fixture-running'));
    assert.ok(requests.every((request) => request.method === 'GET'));
  });
}
