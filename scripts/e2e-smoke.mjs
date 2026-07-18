/**
 * End-to-end smoke test: loads the built widget in a happy-dom Browser the way
 * a real page would (external <script> tag, auto-init from data attributes),
 * walks through every demo state, and exercises dismissal.
 *
 * Prerequisites:  npm run build  +  npm run demo  (server on :4173)
 * Usage:          npm run e2e
 *
 * Note: happy-dom's poll-timer tracking means we avoid waitUntilComplete()
 * (the widget's own polling timer would keep it waiting) and poll the DOM
 * ourselves instead.
 */
import { Browser } from 'happy-dom';

const BASE = process.env.DEMO_URL ?? 'http://localhost:4173';
let failures = 0;

const watchdog = setTimeout(() => {
  console.error('e2e watchdog: timed out after 90s');
  process.exit(1);
}, 90_000);
watchdog.unref();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, ms = 8_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const value = fn();
    if (value) return value;
    await sleep(100);
  }
  return null;
}

function inspect(document) {
  const host = document.querySelector('[data-allquiet-status-widget]');
  if (!host || !host.shadowRoot) return null;
  const shadow = host.shadowRoot;
  const card = shadow.querySelector('.card');
  if (!card) return null;
  const text = (sel) => shadow.querySelector(sel)?.textContent ?? null;
  return {
    kind: card.className.replace('card kind-', ''),
    headline: text('.headline'),
    body: text('.body'),
    detail: text('.detail'),
    more: text('.more'),
    link: shadow.querySelector('a.main')?.getAttribute('href') ?? null,
  };
}

function check(label, condition, actual) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label} — got: ${JSON.stringify(actual)}`);
  }
}

const browser = new Browser({
  settings: {
    enableJavaScriptEvaluation: true,
    suppressInsecureJavaScriptEnvironmentWarning: true,
    fetch: { disableSameOriginPolicy: true },
  },
});

// --- Scenario 1: plain embed page, auto-init from data-status-url ------------
console.log('embed-example.html (auto-init, live-outage fixture)');
const page1 = browser.newPage();
await page1.goto(`${BASE}/demo/embed-example.html`);
const window1 = page1.mainFrame.window;

const global1 = await waitFor(() => window1.AllQuietStatusWidget);
check('exposes window.AllQuietStatusWidget', Boolean(global1), typeof global1);

const red = await waitFor(() => inspect(page1.mainFrame.document));
check('renders critical popup', red?.kind === 'critical', red);
check('headline from feed mapping', red?.headline === 'Major outage', red?.headline);
check(
  'shows incident title',
  red?.body === 'Authentication service outage — sign-ins are failing and active sessions may be logged out unexpectedly',
  red?.body,
);
check('shows +1 more', red?.more === '+1 more', red?.more);
check('links to status page', red?.link === 'https://allquiet.eu/status/pixelunion', red?.link);

if (red) {
  const shadow = page1.mainFrame.document.querySelector('[data-allquiet-status-widget]').shadowRoot;
  shadow.querySelector('.close').click();
  await sleep(200);
  const visible = shadow.querySelector('.aqsw').classList.contains('visible');
  check('dismiss hides popup', !visible, visible);
  const stored = window1.localStorage.getItem('aqsw:dismissed');
  check('dismissal persisted to localStorage', (stored ?? '').includes('5da3fc6c'), stored);
}
await page1.close();

// --- Scenario 2: demo page, button-driven states ------------------------------
console.log('demo page (button-driven states)');
const page2 = browser.newPage();
await page2.goto(`${BASE}/demo/`);
const doc2 = page2.mainFrame.document;
await waitFor(() => page2.mainFrame.window.AllQuietStatusWidget);
// Scenario 1 dismissed the fixture incidents; same-origin storage is shared.
page2.mainFrame.window.localStorage.removeItem('aqsw:dismissed');

async function drive(fixture, expectKind, expectDetail = null) {
  doc2.querySelector(`button[data-fixture="${fixture}"]`).click();
  const state = await waitFor(() => {
    const s = inspect(doc2);
    return s && s.kind === expectKind ? s : null;
  });
  check(`${fixture} → ${expectKind}`, state !== null, inspect(doc2));
  if (state && expectDetail) {
    check(`${fixture} detail "${expectDetail}"`, state.detail?.startsWith(expectDetail), state.detail);
  }
}

await drive('warning.json', 'warning');
await drive('minor.json', 'minor');
await drive('maintenance-upcoming.json', 'maintenance', 'Starts in');
await drive('maintenance-active.json', 'maintenance', 'Maintenance in progress');

doc2.querySelector('button[data-fixture="all-clear.json"]').click();
await sleep(1_500);
check('all-clear.json → no popup', inspect(doc2) === null, inspect(doc2));

// --- Scenario 3: live feed ----------------------------------------------------
console.log('live Bunny feed');
doc2.querySelector('#live').click();
await sleep(4_000);
const live = inspect(doc2);
console.log(`  live feed state: ${live ? `${live.kind} | ${live.headline} | ${live.body ?? live.detail}` : 'no popup (feed currently clear)'}`);

await browser.close();
clearTimeout(watchdog);
console.log(failures === 0 ? 'e2e smoke: all checks passed' : `e2e smoke: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
