import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';

const log = process.env.REQUEST_LOG;
let retryAttempts = 0;
let roadFeatureAttempts = 0;
const server = createServer(async (request, response) => {
  if (log) appendFileSync(log, `${JSON.stringify({ method: request.method, url: request.url, headers: request.headers })}\n`);
  const url = new URL(request.url, 'http://fixture');
  response.setHeader('content-type', 'application/json');
  if (request.method === 'GET' && url.pathname === '/') {
    response.setHeader('content-type', 'text/html'); response.end('<html>fixture</html>');
  } else if (request.method === 'POST' && url.pathname === '/') {
    const body = JSON.parse(await readBody(request));
    response.end(JSON.stringify(graphQlFixture(body.query, body.variables ?? {})));
  } else if (/\/open\/routingservice\/api\/roadfeature\/roadfeatures$/i.test(url.pathname)) {
    await readBody(request);
    if (request.method !== 'POST') { response.statusCode = 405; response.end('{}'); }
    else if (roadFeatureAttempts++ === 0) { response.statusCode = 503; response.end('{}'); }
    else response.end(JSON.stringify({ roadFeatures: [{ id: 'rf1' }] }));
  } else if (url.pathname.toLowerCase().startsWith('/ws/no/vegvesen/ruteplan/routingservice_v3_0/open/routingservice/')) {
    response.end(JSON.stringify({ routes: [{ type: 'FeatureCollection', features: [], profile: url.pathname.split('/').at(-1), stops: url.searchParams.get('Stops') }], externalApiStatus: null }));
  } else if (/^\/vegobjekter\/api\/v4\/vegobjekter\/\d+\/statistikk$/.test(url.pathname)) {
    response.end(JSON.stringify({ antall: 3 }));
  } else if (url.pathname === '/vegobjekter/api/v4/vegobjekter/901') {
    const href = `${url.origin}${url.pathname}?start=stuck`;
    response.end(JSON.stringify({ objekter: [{ id: 9010 }], metadata: { antall: 99, returnert: 1, sidestørrelse: 1, neste: { start: 'stuck', href } } }));
  } else if (url.pathname === '/vegobjekter/api/v4/vegobjekter/902') {
    const all = [9021, 9022, 9023, 9024, 9025].map((id) => ({ id }));
    const offset = Number(url.searchParams.get('start') ?? 0);
    const objects = all.slice(offset, offset + 2);
    const nextOffset = offset + objects.length;
    const next = nextOffset < all.length ? { start: String(nextOffset), href: `${url.origin}${url.pathname}?start=${nextOffset}` } : null;
    response.end(JSON.stringify({ objekter: objects, metadata: { antall: all.length, returnert: objects.length, sidestørrelse: 2, neste: next } }));
  } else if (url.pathname === '/vegobjekter/api/v4/vegobjekter/903') {
    if (url.searchParams.get('start') === 'page2') { response.statusCode = 500; response.end('{}'); }
    else response.end(JSON.stringify({ objekter: [{ id: 9031 }, { id: 9032 }], metadata: { antall: 4, returnert: 2, sidestørrelse: 2, neste: { start: 'page2', href: `${url.origin}${url.pathname}?start=page2` } } }));
  } else if (/^\/vegobjekter\/api\/v4\/vegobjekter\/\d+$/.test(url.pathname)) {
    const all = [{ id: 101 }, { id: 102 }, { id: 103 }];
    const offset = url.searchParams.get('start') === 'opaque-2' ? 2 : 0;
    const size = Number(url.searchParams.get('antall') ?? 2);
    const objects = all.slice(offset, offset + size);
    const next = offset + objects.length < all.length ? { start: 'opaque-2', href: `${url.origin}${url.pathname}?start=opaque-2` } : null;
    response.end(JSON.stringify({ objekter: objects, metadata: { antall: all.length, returnert: objects.length, sidestørrelse: size, neste: next } }));
  } else if (url.pathname === '/vegobjekter/api/v4/vegobjekt' || /^\/vegobjekter\/api\/v4\/vegobjekter\/\d+\/\d+(?:\/\d+)?$/.test(url.pathname)) {
    response.end(JSON.stringify({ id: Number(url.searchParams.get('id') ?? url.pathname.split('/').at(-1)), type: 105 }));
  } else if (/^\/vegobjekter\/api\/v4\/vegobjekter\/\d+\/\d+\/versjoner$/.test(url.pathname)) {
    response.end(JSON.stringify([{ id: 101, versjon: 1 }, { id: 101, versjon: 2 }]));
  } else if (/^\/vegobjekter\/api\/v4\/vegobjekter(?:\/\d+)?\/endringer$/.test(url.pathname)) {
    response.end(JSON.stringify({ vegobjektVersjonerOpprettet: [{ id: 101 }], metadata: { returnert: 1, sidestørrelse: 100, neste: null } }));
  } else if (url.pathname === '/vegobjekter/api/v4/vegobjekter/statistikk') {
    response.end(JSON.stringify([{ typeId: 105, antall: 3 }]));
  } else if (url.pathname === '/vegnett/api/v4/posisjon') {
    response.end(JSON.stringify([{ avstand: 2.5, kommune: 301, veglenkesekvens: { kortform: '0.5@123' } }]));
  } else if (url.pathname === '/vegnett/api/v4/veglenkesekvenser' || url.pathname === '/vegnett/api/v4/veglenkesekvenser/segmentert' || url.pathname === '/vegnett/api/v4/noder') {
    response.end(JSON.stringify({ objekter: [{ id: 201 }], metadata: { antall: 1, returnert: 1, sidestørrelse: 100, neste: null } }));
  } else if (/^\/vegnett\/api\/v4\/(veglenkesekvenser(?:\/segmentert)?|noder)\/\d+$/.test(url.pathname)) {
    response.end(JSON.stringify({ id: Number(url.pathname.split('/').at(-1)) }));
  } else if (url.pathname === '/vegnett/api/v4/veglenkesekvenser/endringer') {
    response.end(JSON.stringify({ veglenkesekvenserSegmentert: [{ id: 201 }], veglenkesekvenserFjernet: [], metadata: { returnert: 1, sidestørrelse: 100, neste: null } }));
  } else if (url.pathname === '/vegnett/api/v4/veglenkesekvenser/segmentert/statistikk') {
    response.end(JSON.stringify({ antall: 1 }));
  } else if (url.pathname === '/vegnett/api/v4/veg' || url.pathname === '/vegnett/api/v4/veg/batch') {
    response.end(JSON.stringify([{ veglenkesekvens: { kortform: '0.5@123' } }]));
  } else if (url.pathname === '/vegnett/api/v4/beta/vegnett/rute') {
    response.end(JSON.stringify({ veglenker: [201], lengde: 100 }));
  } else if (/^\/monitor\/api\/v1\/endringssett\/[^/]+\/status$/.test(url.pathname)) {
    response.end(JSON.stringify({ status: 'FERDIG' }));
  } else if (url.pathname === '/api/3/action/package_search') {
    const start = Number(url.searchParams.get('start') ?? 0);
    const rows = Number(url.searchParams.get('rows') ?? 100);
    const all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    response.end(JSON.stringify({ success: true, result: { count: all.length, results: all.slice(start, start + rows) } }));
  } else if (url.pathname === '/api/3/action/package_show') {
    const id = url.searchParams.get('id');
    if (id === 'forbidden') { response.statusCode = 403; response.end('{}'); }
    else if (id === 'retry' && retryAttempts++ === 0) { response.statusCode = 503; response.end('{}'); }
    else if (id === 'slow') { setTimeout(() => response.end(JSON.stringify({ success: true, result: { id } })), 200); }
    else if (id === 'malformed') response.end('{broken');
    else if (id === 'redirect-evil') { response.statusCode = 302; response.setHeader('location', 'https://evil.example/collect'); response.end(); }
    else response.end(JSON.stringify({ success: true, result: { id } }));
  } else if (url.pathname === '/api/3/action/status_show') {
    response.end(JSON.stringify({ success: true, result: { ckan_version: 'fixture' } }));
  } else if (url.pathname === '/datakatalog/api/v1/versjon') {
    response.end(JSON.stringify({ versjon: 'fixture' }));
  } else if (url.pathname === '/omrader/api/v4/fylker') {
    response.end(JSON.stringify([{ nummer: 3 }, { nummer: 11 }, { nummer: 15 }]));
  } else if (url.pathname === '/ws/no/vegvesen/veg/parkeringsomraade/parkeringsregisteret/v1/parkeringstilbyder/aktive') {
    response.end(JSON.stringify([{ organisasjonsnummer: '123456789' }]));
  } else if (/\/parkeringsomraade\/skiltplan\/\d+$/.test(url.pathname)) {
    response.setHeader('content-type', 'application/pdf');
    response.end(Buffer.from('%PDF-1.7 fixture'));
  } else if (url.pathname === '/api/v1/feilmeldinger/ulost') {
    response.end(JSON.stringify([{ id: 7, status: 'AKTIV' }]));
  } else if (/^\/api\/v1\/systemer\/\d+$/.test(url.pathname)) {
    response.end(JSON.stringify({ id: Number(url.pathname.split('/').at(-1)), navn: 'fixture' }));
  } else if (/^\/api\/v1\/systemer\/\d+\/status$/.test(url.pathname)) {
    response.end(JSON.stringify({ id: Number(url.pathname.split('/').at(-2)), status: 'OPPE' }));
  } else if (url.pathname === '/api/v1/statistikk' || url.pathname === '/api/v1/statistikk/nokkeldata') {
    response.end(JSON.stringify({ scope: url.pathname.endsWith('nokkeldata') ? 'key-data' : 'full', antall: 1 }));
  } else if (/^\/api\/v1\/feilmeldinger\/(\d+(\/(aktive|planlagt))?|aktiv|planlagt|avsluttet|siste|mellom)$/.test(url.pathname)) {
    response.end(JSON.stringify([{ id: 7, scope: url.pathname.replace('/api/v1/feilmeldinger/', ''), from: url.searchParams.get('fra') }]));
  } else if (url.pathname === '/rapporter/bruksklasser' || url.pathname === '/rapporter/kontraktsomraader' || url.pathname === '/rapporter/omraader' || url.pathname === '/rapporter/kostrarapporttyper' || url.pathname === '/rapporter/driftskontraktrapporttyper') {
    response.end(JSON.stringify([{ id: 1, kind: url.pathname.split('/').at(-1) }]));
  } else if (/^\/rapporter\/driftskontraktvegobjekttyper\/(default|tilvalg)\/\d+$/.test(url.pathname)) {
    response.end(JSON.stringify([{ id: 105, set: url.pathname.split('/').at(-2) }]));
  } else if (url.pathname === '/rapporter/egendefinert' || url.pathname === '/rapporter/egendefinert/aggregate' || /^\/rapporter\/egendefinert\/\d+$/.test(url.pathname)) {
    response.end(JSON.stringify({ scope: url.pathname.replace('/rapporter/egendefinert', '') || '/list' }));
  } else if (url.pathname === '/rapporter/kontraktZip') {
    response.setHeader('content-type', 'application/zip');
    response.end(Buffer.from('PK\u0003\u0004 fixture'));
  } else if (url.pathname === '/api/v1/feilmelding/detaljert') {
    response.end(JSON.stringify([{ id: 42, detaljert: true }]));
  } else if (/^\/datakatalog\/api\/v1\/vegobjekttyper\/\d+\/\d+$/.test(url.pathname)) {
    response.end(JSON.stringify({ id: Number(url.pathname.split('/').at(-1)) }));
  } else if (url.pathname === '/api/v1/systemer') {
    response.end(JSON.stringify([{ id: 1, navn: 'fixture' }]));
  } else if (url.pathname === '/ws/docs/openapi') {
    response.setHeader('content-type', 'text/yaml');
    response.end('openapi: 3.0.3\ninfo:\n  title: fixture\n');
  } else if (/^\/(vegvar_1_0|norstoy_1_0|nvdb_2_0|rapportweb_1_0|datex_3_1)\/(wms|wfs)$/.test(url.pathname) && /GetCapabilities|DescribeFeatureType/i.test(url.searchParams.get('request') ?? '')) {
    response.setHeader('content-type', 'application/xml');
    response.end(url.pathname.startsWith('/datex_3_1/') ? '<!DOCTYPE x [<!ENTITY canary "expanded">]><Capabilities>&canary;</Capabilities>' : '<?xml version="1.0"?><Capabilities><Layer><Name>fixture</Name></Layer></Capabilities>');
  } else if (/^\/(vegvar_1_0|norstoy_1_0|nvdb_2_0|rapportweb_1_0|datex_3_1)\/(wms|wfs)$/.test(url.pathname)) {
    response.setHeader('content-type', url.pathname.endsWith('/wms') ? 'image/png' : 'application/geo+json');
    response.end(url.pathname.endsWith('/wms') ? Buffer.from('native-ogc-fixture') : JSON.stringify({ type: 'FeatureCollection', features: [] }));
  } else if (url.pathname === '/ogc/features/v1/collections/loop/items') {
    response.end(JSON.stringify({ type: 'FeatureCollection', features: [{ id: 'f1' }], links: [{ rel: 'next', href: '/ogc/features/v1/collections/loop/items?page=2' }] }));
  } else if (/^\/ogc\/(features|maps|styles)\/v1\//.test(url.pathname)) {
    response.end(JSON.stringify(url.pathname.includes('/items') ? { type: 'FeatureCollection', features: [{ id: 'f1' }], links: [] } : url.pathname.includes('/styles') ? { styles: [{ id: 'style1' }] } : { collections: [{ id: 'collection1' }], links: [] }));
  } else if (url.pathname === '/api-docs' || url.pathname === '/swagger.json') {
    response.end(JSON.stringify({ openapi: '3.0.0', paths: {} }));
  } else if (url.pathname === '/api/v1/tnits/types') {
    response.end(JSON.stringify(['SpeedLimit', 'RoadName', 'RoadNumber', 'MaximumHeight']));
  } else if (/^\/api\/v1\/tnits\/[^/]+\/(snapshots|updates)$/.test(url.pathname)) {
    const key = url.pathname.endsWith('updates') ? 'updates' : 'snapshots';
    response.end(JSON.stringify({ [key]: [{ href: '/api/v1/download?path=fixture.gml', timestamp: '2026-07-27T00:00:00Z', size: 12 }] }));
  } else if (url.pathname === '/api/v1/download') {
    response.setHeader('content-type', 'application/gml+xml');
    if (url.searchParams.get('path') === 'endless.gml') {
      // Never completes: proves interrupted large artifact writes clean up their temp file.
      response.write('<gml>');
      const pump = () => { if (response.destroyed) return; response.write('x'.repeat(64 * 1024)); setTimeout(pump, 10); };
      pump();
    } else response.end('<gml>fixture</gml>');
  } else if (/^\/(vegobjekter\/\d+\.(csv|sosi)|vegnett\/veglenkesekvenser\/segmentert\.csv)$/.test(url.pathname)) {
    response.setHeader('content-type', 'text/csv');
    response.end('id,name\n1,fixture\n');
  } else if (url.pathname === '/api/v1/feilmelding' && request.method === 'GET') {
    response.end(JSON.stringify([{ id: 42 }]));
  } else if (url.pathname === '/api/v1/feilmelding/42') {
    response.end(JSON.stringify({ id: 42, status: 'MOTTATT' }));
  } else if (url.pathname === '/api/v1/feilmelding/anonym' && request.method === 'POST') {
    const body = await readBody(request);
    if (body.includes('TimeoutFixture')) setTimeout(() => { if (!response.destroyed) { response.statusCode = 201; response.end(JSON.stringify({ id: 43 })); } }, 100);
    else { response.statusCode = 201; response.end(JSON.stringify({ id: 43 })); }
  } else if (/^\/api\/v1\/feilmelding\/\d+\/vedlegg$/.test(url.pathname) && request.method === 'POST') {
    await readBody(request); response.end(JSON.stringify({ success: true }));
  } else if (/^\/api\/v1\/feilmelding\/\d+\/vedlegg\/[^/]+$/.test(url.pathname)) {
    response.setHeader('content-type', 'application/octet-stream'); response.end('attachment');
  } else if (url.pathname === '/rapporter/veglister/889') {
    response.statusCode = 503; response.end('{}');
  } else if (url.pathname === '/rapporter/rapporttyper') {
    response.end(JSON.stringify([{ id: 1, navn: 'fixture' }]));
  } else if (url.pathname === '/rapporter/poll/fixture-running') {
    response.end(JSON.stringify({ id: 'fixture-running', status: 'RUNNING' }));
  } else if (url.pathname.startsWith('/rapporter/poll/')) {
    response.end(JSON.stringify({ id: url.pathname.split('/').at(-1), status: 'SUCCESS', rapport: { nedlastLink: 'fixture.xlsx' } }));
  } else if (url.pathname.startsWith('/rapporter/nedlasting/')) {
    response.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response.end('xlsx-fixture');
  } else if (/\/statistikk\/gruppert/.test(url.pathname)) {
    response.end(JSON.stringify([{ group: 'fixture', count: 1 }]));
  } else {
    response.statusCode = 404;
    response.end('{}');
  }
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  process.stdout.write(`http://127.0.0.1:${address.port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function graphQlFixture(query, variables) {
  if (query.includes('query Stations')) {
    if (variables.ids?.includes('error')) return { data: null, errors: [{ message: 'fixture request error' }] };
    if (variables.ids?.includes('leak')) return { data: null, errors: [{ message: 'Authorization: Custom CANARY-hunter2-value' }] };
    const points = variables.ids ? variables.ids.map((id) => ({ id, name: `Station ${id}`, trafficRegistrationType: 'VEHICLE', operationalStatus: 'OPERATIONAL', registrationFrequency: 'CONTINUOUS', location: { coordinates: { latLon: { lat: 59.9, lon: 10.7 } }, county: { number: 3, name: 'Oslo' }, municipality: { number: 301, name: 'Oslo' }, roadReference: { shortForm: 'EV6', roadCategory: { id: 'E', name: 'Europaveg' } } }, direction: { fromAccordingToRoadLink: 'A', toAccordingToRoadLink: 'B' }, dataTimeSpan: { firstData: null, firstDataWithQualityMetrics: null, latestData: {} } })) : [{ id: 's1', name: 'One' }, { id: 's2', name: 'Two' }, { id: 's3', name: 'Three' }];
    return { data: { trafficRegistrationPoints: points }, ...(variables.ids?.includes('partial') ? { errors: [{ message: 'fixture partial warning', path: ['trafficRegistrationPoints'] }] } : {}) };
  }
  if (query.includes('query Volume')) {
    const all = [0, 1, 2].map((index) => ({ cursor: `c${index + 1}`, node: { from: `2025-01-01T0${index}:00:00+01:00`, to: `2025-01-01T0${index + 1}:00:00+01:00`, total: { volumeNumbers: { volume: index + 10, validSpeed: null, validLength: null }, coverage: { percentage: 100, unit: 'HOUR', included: { percentage: 100, numerator: 1, denominator: 1 }, uncertain: { percentage: 0, numerator: 0, denominator: 1 }, unavailable: { percentage: 0, numerator: 0, denominator: 1 } } }, byLengthRange: [] } }));
    const offset = variables.after ? Number(String(variables.after).slice(1)) : 0;
    const edges = all.slice(offset, offset + Number(variables.first ?? 100));
    const hasNextPage = offset + edges.length < all.length;
    const field = query.includes('byDay(') ? 'byDay' : 'byHour';
    return { data: { trafficData: { trafficRegistrationPoint: { id: variables.id, name: 'Fixture' }, volume: { [field]: { edges, pageInfo: { endCursor: edges.at(-1)?.cursor ?? null, hasNextPage } } } } } };
  }
  if (query.includes('query Aadt')) return { data: { trafficData: { volume: { average: { daily: { byYear: [{ year: 2025, total: { volume: { average: 123 }, coverage: { percentage: 100 } }, byLengthRange: [] }] } } } } } };
  if (query.includes('query References')) return { data: { roadCategories: [{ id: 'E', name: 'Europaveg' }], areas: { countryParts: [], counties: [], municipalities: [] } } };
  if (query.includes('query StationIndices')) return { data: { trafficVolumeIndices: [] } };
  if (query.includes('query PublishedIndices')) return { data: { publishedAreaTrafficVolumeIndices: [{ id: 1, name: 'Fixture', months: [{ year: 2025, month: 1 }] }] } };
  if (query.includes('query PublishedIndex')) return { data: { publishedAreaTrafficVolumeIndex: [{ id: variables.id, name: 'Fixture' }] } };
  return { data: { __typename: 'Query' } };
}
