import { usageError } from '../contracts/error.js';
import type { CommandResult } from '../contracts/output.js';
import { requestJson, type QueryValue } from '../core/http.js';
import { serviceSource } from '../core/metadata.js';
import type { Runtime } from '../runtime.js';
import type { QueryOptions } from './catalog.js';

const origin = 'https://www.vegvesen.no';
const base = 'ws/no/vegvesen/ruteplan/routingservice_v3_0/open/routingservice/api/';

export const routeProfiles = {
  best: 'Route/best',
  tourist: 'Route/tourist',
  bike: 'Route/bike',
  'normal-transport': 'Route/bruksklasseNormalTransport',
  'special-transport': 'Route/bruksklasseSpesialTransport',
  'timber-transport': 'Route/bruksklasseTommerTransport',
  'modular-vehicle': 'Route/bruksklasseModulvognTog',
  'bk-12-100': 'Route/bruksklasse12100',
  'bk-12-65': 'Route/bruksklasse1265',
} as const;

export interface RouteOptions extends QueryOptions {
  stops: string[];
  inputSrs: 'EPSG:4326' | 'EPSG:25833';
  outputSrs: 'EPSG:4326' | 'EPSG:25833';
  language?: string | undefined;
  returnFields?: string[] | undefined;
  startTime?: string | undefined;
  length?: string | undefined;
  weight?: string | undefined;
  height?: string | undefined;
  includeObstructed?: boolean | undefined;
  allowZeroEmissionZone?: boolean | undefined;
  powerEffort?: string | undefined;
  bikePathUsage?: string | undefined;
  loadClass?: string | undefined;
  roadGroup?: string | undefined;
  includeUnclassifiedRoadGroup?: boolean | undefined;
  linkSemitrailer?: boolean | undefined;
  trackingRequired?: boolean | undefined;
}

export async function calculateRoute(runtime: Runtime, profile: keyof typeof routeProfiles, options: RouteOptions): Promise<CommandResult> {
  const heavyProfiles = new Set<keyof typeof routeProfiles>(['normal-transport', 'special-transport', 'timber-transport', 'modular-vehicle']);
  if (heavyProfiles.has(profile) && !options.loadClass) throw usageError(`--load-class is required for profile ${profile}`, 'Pass a supported class such as --load-class Bk_10_50', 'load-class');
  if ((profile === 'normal-transport' || profile === 'special-transport') && ['Bk_10_56', 'Bk_10_60'].includes(options.loadClass ?? '')) throw usageError(`Load class ${options.loadClass} is not valid for ${profile}`, 'Use Bk_6_28, Bk_8_32, Bk_T8_40, Bk_T8_50, Bk_10_42, or Bk_10_50', 'load-class');
  const query = commonRouteQuery(options);
  if (options.powerEffort !== undefined) query.PowerEffort = numeric(options.powerEffort, 'power-effort');
  if (options.bikePathUsage !== undefined) query.BikePathUsage = numeric(options.bikePathUsage, 'bike-path-usage');
  if (options.loadClass !== undefined) query.Bruksklasse = options.loadClass;
  if (options.roadGroup !== undefined) query.Veggruppe = options.roadGroup;
  if (options.includeUnclassifiedRoadGroup !== undefined) query.IncludeVeggruppeIkke = options.includeUnclassifiedRoadGroup;
  if (options.linkSemitrailer !== undefined) query.IsLinkSemitrailer = options.linkSemitrailer;
  if (options.trackingRequired !== undefined) query.MedSporingskrav = options.trackingRequired;
  return routeRequest(runtime, 'route calculate', routeProfiles[profile], query, options);
}

export async function calculateMatrix(runtime: Runtime, options: RouteOptions): Promise<CommandResult> {
  return routeRequest(runtime, 'route matrix', 'Matrix', commonRouteQuery(options), options);
}

export async function queryRoadFeatures(runtime: Runtime, body: unknown, withLoadClass: boolean, options: QueryOptions): Promise<CommandResult> {
  const path = withLoadClass ? 'RoadFeature/roadFeaturesWithBruksklasse' : 'RoadFeature/roadFeatures';
  const { data, raw } = await requestJson<unknown>(runtime, {
    service: 'route', canonicalOrigin: origin, path: `${base}${path}`, method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }, timeout: options.timeout, retries: options.retries === undefined ? undefined : Number(options.retries), safeToRetry: true,
  });
  return { command: 'route road-feature query', source: serviceSource('route'), data, raw };
}

function commonRouteQuery(options: RouteOptions): Record<string, QueryValue> {
  if (options.stops.length < 2) throw usageError('At least two --stop values are required', 'Pass --stop X,Y twice or more', 'stop');
  for (const stop of options.stops) validateStop(stop);
  const query: Record<string, QueryValue> = {
    Stops: options.stops.join(';'),
    InputSRS: options.inputSrs.replace(':', '_'),
    OutputSRS: options.outputSrs.replace(':', '_'),
    Lang: options.language,
    ReturnFields: options.returnFields,
    StartTime: options.startTime,
    Length: options.length === undefined ? undefined : numeric(options.length, 'length'),
    Weight: options.weight === undefined ? undefined : numeric(options.weight, 'weight'),
    Height: options.height === undefined ? undefined : numeric(options.height, 'height'),
    IncludeObstructedRoutes: options.includeObstructed,
    AllowTravelInZeroEmissionZone: options.allowZeroEmissionZone,
  };
  return query;
}

async function routeRequest(runtime: Runtime, command: string, path: string, query: Record<string, QueryValue>, options: QueryOptions): Promise<CommandResult> {
  const { data, raw } = await requestJson<unknown>(runtime, {
    service: 'route', canonicalOrigin: origin, path: `${base}${path}`, query,
    timeout: options.timeout, retries: options.retries === undefined ? undefined : Number(options.retries), safeToRetry: true,
  });
  return { command, source: serviceSource('route'), data, raw };
}

function validateStop(value: string): void {
  const parts = value.split(',');
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(Number(part)))) throw usageError(`Invalid stop: ${value}`, 'Use --stop X,Y with numeric coordinates', 'stop');
}

function numeric(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw usageError(`--${field} must be a non-negative number`, `Pass a numeric --${field} value`, field);
  return parsed;
}
