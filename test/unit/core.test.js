import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDuration } from '../../dist/core/http.js';
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
