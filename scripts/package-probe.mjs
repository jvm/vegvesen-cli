import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const packDirectory = mkdtempSync(join(tmpdir(), 'vegvesen-pack-'));
const installDirectory = mkdtempSync(join(tmpdir(), 'vegvesen-install-'));
const tarballName = execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', packDirectory], { cwd: root, encoding: 'utf8' }).trim().split('\n').at(-1);
const tarball = join(packDirectory, tarballName);
execFileSync('npm', ['init', '-y'], { cwd: installDirectory, stdio: 'ignore' });
execFileSync('npm', ['install', tarball], { cwd: installDirectory, stdio: 'ignore' });
const executable = join(installDirectory, 'node_modules', '.bin', 'vegvesen');
const version = execFileSync(executable, ['--version'], { cwd: tmpdir(), encoding: 'utf8' });
assert.equal(version, '0.1.0\n');
const structured = JSON.parse(execFileSync(executable, ['version', '--json'], { cwd: tmpdir(), encoding: 'utf8' }));
assert.equal(structured.schema_version, 1);
console.log(`Installed package works outside checkout: ${tarballName}`);
