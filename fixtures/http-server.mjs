import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';

const log = process.env.REQUEST_LOG;
const server = createServer((request, response) => {
  if (log) appendFileSync(log, `${JSON.stringify({ url: request.url, headers: request.headers })}\n`);
  const url = new URL(request.url, 'http://fixture');
  response.setHeader('content-type', 'application/json');
  if (url.pathname === '/api/3/action/package_search') {
    const start = Number(url.searchParams.get('start') ?? 0);
    const rows = Number(url.searchParams.get('rows') ?? 100);
    const all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    response.end(JSON.stringify({ success: true, result: { count: all.length, results: all.slice(start, start + rows) } }));
  } else if (url.pathname === '/api/3/action/status_show') {
    response.end(JSON.stringify({ success: true, result: { ckan_version: 'fixture' } }));
  } else if (url.pathname === '/datakatalog/api/v1/versjon') {
    response.end(JSON.stringify({ versjon: 'fixture' }));
  } else if (url.pathname === '/omrader/api/v4/fylker') {
    response.end(JSON.stringify([{ nummer: 3 }, { nummer: 11 }, { nummer: 15 }]));
  } else if (url.pathname === '/ws/no/vegvesen/veg/parkeringsomraade/parkeringsregisteret/v1/parkeringstilbyder/aktive') {
    response.end(JSON.stringify([{ organisasjonsnummer: '123456789' }]));
  } else if (url.pathname.endsWith('/parkeringsomraade/skiltplan/42')) {
    response.setHeader('content-type', 'application/pdf');
    response.end(Buffer.from('%PDF-1.7 fixture'));
  } else if (url.pathname === '/api/v1/feilmeldinger/ulost') {
    response.end(JSON.stringify([{ id: 7, status: 'AKTIV' }]));
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
