import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sources = JSON.parse(readFileSync(new URL('../specs/sources.json', import.meta.url)));
let drift = false;
for (const source of sources.sources) {
  const response = await fetch(source.url, { headers: { accept: 'application/json, application/yaml, text/yaml' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${source.service}: HTTP ${response.status}`);
  const text = await response.text();
  if (text.length < 20) throw new Error(`${source.service}: unexpectedly short specification`);
  let canonical = text.replaceAll('\r\n', '\n');
  try { canonical = JSON.stringify(sortJson(JSON.parse(text))); } catch { /* YAML remains normalized text. */ }
  const digest = createHash('sha256').update(canonical).digest('hex');
  const changed = digest !== source.sha256;
  console.log(`${source.service}\t${changed ? 'DRIFT' : 'unchanged'}\t${digest}`);
  drift ||= changed;
}
function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
  return value;
}

if (drift) {
  console.error('Specification drift detected. Review upstream changes and update metadata explicitly.');
  process.exitCode = 1;
}
