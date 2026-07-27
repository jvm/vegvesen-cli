import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { parseDuration, readResponseText } from '../../dist/core/http.js';
import { readJsonInput } from '../../dist/core/input.js';
import { redact } from '../../dist/core/redact.js';
import { saveBytes } from '../../dist/core/artifact-writer.js';
import { assertPromptAllowed } from '../../dist/core/prompt.js';
import { processRuntime } from '../../dist/runtime.js';
import { envelope } from '../../dist/contracts/output.js';
import { renderResult } from '../../dist/core/output.js';

test('duration parser accepts bounded explicit units', () => {
  assert.equal(parseDuration('500ms'), 500);
  assert.equal(parseDuration('10s'), 10000);
  assert.equal(parseDuration('2m'), 120000);
  assert.throws(() => parseDuration('10'));
  assert.throws(() => parseDuration('11m'));
});

test('empty result envelope remains explicit', () => {
  const value = envelope({ command: 'x list', source: { service: 'x', spec_digest: `sha256:${'0'.repeat(64)}` }, data: [] });
  assert.deepEqual(value.meta, { count: 0, has_more: false, next_cursor: null, partial: false });
});

test('NDJSON records and summary are tagged', () => {
  const output = renderResult({ command: 'x list', source: { service: 'x', spec_digest: `sha256:${'0'.repeat(64)}` }, data: [{ id: 1 }] }, { format: 'ndjson', fields: [], stdoutIsTTY: false });
  const lines = String(output).trim().split('\n').map(JSON.parse);
  assert.deepEqual(lines.map((line) => line.type), ['item', 'summary']);
});

test('artifact writer uses injected runtime and cleans failed promotion temp file', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vegvesen-unit-artifact-'));
  const path = join(directory, 'result.json');
  const runtime = { ...processRuntime(), pid: 99, now: () => new Date(1234) };
  const descriptor = await saveBytes(runtime, '{"ok":true}\n', path, 'unit', 'application/json', false);
  assert.equal(descriptor.size_bytes, 12);
  assert.equal(readFileSync(path, 'utf8'), '{"ok":true}\n');
  await assert.rejects(saveBytes(runtime, 'replacement', path, 'unit', 'text/plain', false), (error) => error.details.code === 'OUTPUT_IO_FAILED');
  assert.deepEqual(readdirSync(directory), ['result.json']);
});

test('redaction removes complete sensitive values from common encodings', () => {
  const canary = 'CANARY-hunter2-value';
  const samples = [
    `token=${canary}`,
    `Cookie: session=${canary}; Path=/`,
    `Authorization: Custom ${canary}`,
    `https://user:${canary}@example.test/path?api_key=${canary}`,
    JSON.stringify({ password: canary, nested: { ok: true } }),
    { credential: canary, safe: 'visible' },
  ];
  for (const sample of samples) {
    const output = redact(sample);
    assert.doesNotMatch(output, new RegExp(canary));
    assert.match(output, /\[REDACTED\]/);
  }
});

test('structured inputs and upstream bodies enforce byte ceilings', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vegvesen-limits-'));
  const path = join(directory, 'large.json');
  writeFileSync(path, JSON.stringify({ value: 'x'.repeat(1024 * 1024) }));
  await assert.rejects(readJsonInput({ ...processRuntime(), cwd: directory }, '@large.json'), (error) => error.details.code === 'INPUT_TOO_LARGE');
  const response = new Response('x'.repeat(32), { headers: { 'content-type': 'application/json' } });
  await assert.rejects(readResponseText(response, 'fixture', 16), (error) => error.details.code === 'UPSTREAM_BODY_TOO_LARGE');
});

test('prompt policy rejects machine and detached-stdin input paths', () => {
  const stdin = Object.assign(new PassThrough(), { isTTY: false });
  const runtime = { ...processRuntime(), stdin };
  assert.throws(
    () => assertPromptAllowed(runtime, { format: 'json', json: true, noInput: true }, 'body', 'Pass --body @PATH'),
    (error) => error.details.code === 'MISSING_INPUT' && error.details.exitCode === 2,
  );
});
