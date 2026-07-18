/**
 * Tiny demo server. Serves the demo page, the built widget, and fixture feeds.
 * Fixture routes under /demo/fixtures/ are transformed on the fly from the
 * captured real feeds so maintenance windows are always relative to "now".
 *
 *   npm run build && npm run demo   →  http://localhost:4173
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

async function loadFixture(name) {
  const raw = await readFile(join(ROOT, 'test', 'fixtures', name), 'utf8');
  return JSON.parse(raw);
}

function setUtcNow(feed, nowIso) {
  for (const r of feed.calculation?.results ?? []) {
    if (r.result) r.result.utcNow = nowIso;
  }
}

function resolveIncidents(feed, predicate = () => true) {
  for (const r of feed.calculation?.results ?? []) {
    for (const inc of r.result?.incidents ?? []) {
      if (predicate(inc)) inc.status = 'Resolved';
    }
  }
}

function setMaintenanceWindow(feed, startMs, endMs) {
  for (const m of feed.calculation?.maintenances ?? []) {
    m.start = new Date(startMs).toISOString();
    m.end = new Date(endMs).toISOString();
  }
}

/** Dynamic demo states derived from the captured real feeds. */
const DYNAMIC_FIXTURES = {
  'maintenance-upcoming.json': async () => {
    const feed = await loadFixture('maintenance-live.json');
    const now = Date.now();
    resolveIncidents(feed);
    setMaintenanceWindow(feed, now + 30 * 60_000, now + 90 * 60_000);
    setUtcNow(feed, new Date(now).toISOString());
    return feed;
  },
  'maintenance-active.json': async () => {
    const feed = await loadFixture('maintenance-live.json');
    const now = Date.now();
    resolveIncidents(feed);
    setMaintenanceWindow(feed, now - 30 * 60_000, now + 30 * 60_000);
    setUtcNow(feed, new Date(now).toISOString());
    return feed;
  },
  'warning.json': async () => {
    const feed = await loadFixture('live-outage.json');
    resolveIncidents(feed, (inc) => inc.severity === 'Critical');
    return feed;
  },
  'minor.json': async () => {
    const feed = await loadFixture('live-outage.json');
    resolveIncidents(feed, (inc) => inc.severity === 'Critical');
    for (const r of feed.calculation?.results ?? []) {
      for (const inc of r.result?.incidents ?? []) {
        if (inc.status === 'Open') inc.severity = 'Minor';
      }
    }
    return feed;
  },
  'live-outage.json': () => loadFixture('live-outage.json'),
  'all-clear.json': () => loadFixture('all-clear.json'),
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };

  try {
    if (url.pathname === '/' || url.pathname === '/demo') {
      res.writeHead(302, { ...headers, Location: '/demo/' });
      return res.end();
    }

    const dynamicName = url.pathname.startsWith('/demo/fixtures/')
      ? url.pathname.slice('/demo/fixtures/'.length)
      : null;
    if (dynamicName && dynamicName in DYNAMIC_FIXTURES) {
      const feed = await DYNAMIC_FIXTURES[dynamicName]();
      res.writeHead(200, { ...headers, 'Content-Type': MIME['.json'] });
      return res.end(JSON.stringify(feed));
    }

    const pathname = url.pathname === '/demo/' ? '/demo/index.html' : url.pathname;
    const filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, headers);
      return res.end('forbidden');
    }
    const body = await readFile(filePath);
    res.writeHead(200, {
      ...headers,
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
    });
    return res.end(body);
  } catch {
    res.writeHead(404, headers);
    return res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`demo running at http://localhost:${PORT}/demo/`);
  console.log('(build first: npm run build)');
});
