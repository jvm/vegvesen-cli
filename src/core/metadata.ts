import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const packageUrl = new URL('../../package.json', import.meta.url);
const manifestUrl = new URL('../../specs/manifest.json', import.meta.url);
const operationsUrl = new URL('../../specs/operations.json', import.meta.url);
const sourcesUrl = new URL('../../specs/sources.json', import.meta.url);

export interface ServiceRecord {
  id: string;
  title: string;
  origin: string;
  spec_url: string;
  kind: string;
  access_tier: string;
  health: string;
  verified_at: string;
  evidence: string;
  redistribution: string;
}

export interface Manifest {
  schema_version: number;
  generated_at: string;
  services: ServiceRecord[];
}

export const packageMetadata = JSON.parse(readFileSync(packageUrl, 'utf8')) as { version: string };
const manifestBytes = readFileSync(manifestUrl);
export const manifest = JSON.parse(manifestBytes.toString('utf8')) as Manifest;
export const manifestDigest = `sha256:${createHash('sha256').update(manifestBytes).update(readFileSync(operationsUrl)).update(readFileSync(sourcesUrl)).digest('hex')}`;

export function serviceSource(service: string): { service: string; spec_digest: string } {
  return { service, spec_digest: manifestDigest };
}
