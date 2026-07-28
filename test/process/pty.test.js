import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../bin/vegvesen.js', import.meta.url));
const fixtureScript = fileURLToPath(new URL('../../fixtures/http-server.mjs', import.meta.url));
const helper = fileURLToPath(new URL('../helpers/pty-runner.py', import.meta.url));
const requestLog = join(mkdtempSync(join(tmpdir(), 'vegvesen-pty-')), 'requests.ndjson');
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

function runPty(mode, args, overrides = {}) {
  const result = spawnSync('python3', [helper, '--mode', mode, '--', process.execPath, cli, ...args], {
    encoding: 'utf8',
    timeout: 8000,
    env: {
      ...process.env,
      VEGVESEN_PARKING_BASE_URL: origin,
      VEGVESEN_FIKS_BASE_URL: origin,
      NO_COLOR: '',
      ...overrides,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.timed_out, false);
  const decode = (field) => Buffer.from(report[field], 'base64').toString('utf8').replaceAll('\r\n', '\n');
  return { code: report.returncode, pty: decode('pty'), stdout: decode('stdout'), stderr: decode('stderr') };
}

function assertMachineJson(text) {
  assert.doesNotMatch(text, /\x1b\[/);
  return JSON.parse(text.trim());
}

test('full PTY preserves human and machine contracts without prompting', () => {
  const human = runPty('full', ['version']);
  assert.equal(human.code, 0);
  assert.match(human.pty, /supported_schema_versions:/);

  const machine = runPty('full', ['version', '--json', '--no-input', '--color', 'always']);
  assert.equal(machine.code, 0);
  assert.equal(assertMachineJson(machine.pty).schema_version, 1);

  const error = runPty('full', ['wat', '--json', '--no-input']);
  assert.equal(error.code, 2);
  assert.equal(assertMachineJson(error.pty).error.code, 'INVALID_USAGE');
  assert.doesNotMatch(error.pty, /prompt|press enter/i);
});

test('mixed PTY descriptors preserve channels and never read terminal input in machine mode', () => {
  const stdinTty = runPty('stdin-tty', ['fiks', 'issue', 'create', '--json']);
  assert.equal(stdinTty.code, 2);
  assert.equal(stdinTty.stdout, '');
  assert.equal(assertMachineJson(stdinTty.stderr).error.code, 'INVALID_USAGE');

  const stdoutTty = runPty('stdout-tty', ['version', '--json', '--no-input']);
  assert.equal(stdoutTty.code, 0);
  assert.equal(stdoutTty.stderr, '');
  assert.equal(assertMachineJson(stdoutTty.pty).schema_version, 1);

  const stderrTty = runPty('stderr-tty', ['wat', '--json', '--no-input']);
  assert.equal(stderrTty.code, 2);
  assert.equal(stderrTty.stdout, '');
  assert.equal(assertMachineJson(stderrTty.pty).error.code, 'INVALID_USAGE');
});

test('TTY stdout enforces native binary guard before network effects', () => {
  const guarded = runPty('stdout-tty', ['parking', 'sign-plan', 'get', '42', '--output', '-', '--format', 'raw', '--no-input']);
  assert.equal(guarded.code, 2);
  assert.equal(guarded.pty, '');
  assert.match(guarded.stderr, /Refusing native binary output to terminal/);
});

test('NO_COLOR and TERM dumb retain intentionally unstyled output', () => {
  for (const env of [{ NO_COLOR: '1' }, { TERM: 'dumb' }]) {
    const result = runPty('full', ['service', 'list'], env);
    assert.equal(result.code, 0);
    assert.doesNotMatch(result.pty, /\x1b\[/);
  }
});
