import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/vegvesen.js', import.meta.url));

test('prints help', () => {
  const output = execFileSync(process.execPath, [cli, '--help'], {
    encoding: 'utf8',
  });

  assert.match(output, /Usage:/);
  assert.match(output, /--version/);
});

test('prints version', () => {
  const output = execFileSync(process.execPath, [cli, '--version'], {
    encoding: 'utf8',
  });

  assert.equal(output, '0.1.0\n');
});

test('rejects unknown arguments', () => {
  const result = spawnSync(process.execPath, [cli, '--unknown'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Unknown argument: --unknown/);
});
