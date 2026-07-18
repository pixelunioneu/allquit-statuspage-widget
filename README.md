# allquiet-status-widget

A self-contained status popup for websites whose status page runs on
[AllQuiet](https://allquiet.app). One script tag, zero dependencies, ~5 KB gzipped.

When your AllQuiet status page reports an open incident or an imminent maintenance
window, visitors see a small dismissable popup in the corner of your site linking to
the status page:

- **Red** — major outage (Critical)
- **Orange** — partial outage (Warning)
- **Yellow** — degraded service (Minor)
- **Blue** — maintenance starting within the next hour, or in progress

> **Note:** This is a community project by [PixelUnion](https://pixelunion.eu). It is
> not affiliated with or endorsed by AllQuiet.

## Quick start

```html
<script
  src="https://YOUR-CDN.example/allquiet-status-widget.js"
  data-status-url="https://YOUR-PROXY.example/status.json"
  defer
></script>
```

That's it. `data-status-url` must point at your AllQuiet `status.json` **via a
CORS-enabled proxy** (see below). Everything else — the status page link, severity
names — is read from the feed itself.

### Why a proxy?

AllQuiet's `status.json` (e.g. `https://allquiet.eu/status/<page>/status.json`) does
not send `Access-Control-Allow-Origin` headers, so browsers refuse cross-origin
`fetch()` of it. Any CORS-enabling proxy works. With [bunny.net](https://bunny.net):

1. Create a **Pull Zone** with origin `https://allquiet.eu/status/<your-page>`.
2. Enable CORS headers on the zone (Headers → enable CORS, add `json` to the file
   extension list if needed).
3. Recommended: set a small cache TTL (edge ~30 s, browser ~30 s) so polling stays
   cheap and page-to-page navigation reuses the response.
4. Your widget URL is `https://<zone>.b-cdn.net/status.json`.

If AllQuiet ever ships CORS headers natively, point `data-status-url` straight at
them and delete the proxy.

## Configuration

All attributes except `data-status-url` are optional:

| Attribute | Default | Meaning |
|---|---|---|
| `data-status-url` | — (required) | CORS-accessible AllQuiet `status.json` URL |
| `data-status-page-url` | `statusPage.publicUrl` from the feed | Link target of the popup |
| `data-poll-interval` | `300` | Seconds between refetches (min 30). Polling pauses while the tab is hidden and refreshes immediately when it becomes visible |
| `data-position` | `bottom-right` | `bottom-right` or `bottom-left` |
| `data-maintenance-lookahead` | `60` | Minutes ahead an upcoming maintenance window triggers the popup |
| `data-z-index` | `2147483000` | Stacking order of the popup |
| `data-manual` | — | Present: skip auto-init; call `AllQuietStatusWidget.init()` yourself |

### JS API

```js
window.AllQuietStatusWidget.init({
  statusUrl: 'https://your-proxy.example/status.json',
  statusPageUrl: 'https://allquiet.eu/status/your-page', // optional
  pollIntervalSeconds: 300,
  position: 'bottom-right',
  maintenanceLookaheadMinutes: 60,
  zIndex: 2147483000,
  strings: {
    // English defaults — override any of them (e.g. for localization)
    critical: 'Major outage',
    warning: 'Partial outage',
    minor: 'Degraded service',
    maintenance: 'Scheduled maintenance',
    maintenanceInProgress: 'Maintenance in progress',
    maintenanceStartsIn: 'Starts in {min} min',
    more: '+{n} more',
    viewStatusPage: 'View status page',
    dismiss: 'Dismiss notification',
  },
});

window.AllQuietStatusWidget.destroy(); // remove popup + stop polling (SPAs)
```

The incident headline prefers your status page's own severity naming
(`publicSeverityMapping*` in the feed, configurable in AllQuiet), so localized
severity names come for free; the `strings` above are fallbacks and widget chrome.

## Behavior details

- **One popup at a time.** With several open incidents, the worst severity wins and
  the popup shows "+N more". The whole card links to the status page (new tab).
- **Dismissal** stores the dismissed incident/maintenance IDs in `localStorage`
  (`aqsw:dismissed`), so it survives reloads but is forgotten automatically once
  those IDs leave the feed. New incidents (new IDs) always pop up again. A dismissed
  incident stays dismissed even if it escalates. Where `localStorage` is blocked
  (e.g. private browsing), dismissal lasts for the page's lifetime only.
- **Never breaks your page.** All widget code is wrapped; a malformed feed, a failed
  fetch, or an unexpected schema renders nothing rather than throwing. Styles live in
  a Shadow DOM and can't collide with yours.
- **Accessible.** `role="status"` + `aria-live="polite"`, keyboard-dismissable
  (Esc or the ✕ button), honors `prefers-reduced-motion`, WCAG AA text contrast on
  all four colors.

## Content-Security-Policy

If your site sets a CSP, allow the widget script and its feed:

```
script-src  https://YOUR-CDN.example;
connect-src https://YOUR-PROXY.example;
```

## Development

```sh
npm install
npm run typecheck
npm test          # vitest against captured real-feed fixtures
npm run build     # dist/allquiet-status-widget.js (esbuild, minified IIFE)
npm run size      # enforce the 6 KB gzip budget
npm run demo      # http://localhost:4173/demo/ — all states, incl. the live feed
```

Domain background lives in [CONTEXT.md](CONTEXT.md); design decisions in
[docs/adr/](docs/adr/).

## Distribution & releases

Releasing is automatic: **every push to `main` creates a patch release** with the
built `dist/allquiet-status-widget.js` (+ sourcemap) attached. The version is derived
from git tags — no version-bump commits. Steer it via the commit message:

- `[skip release]` — no release for this push
- `[release minor]` / `[release major]` — bump that part instead of patch

Dependency updates come in weekly via Dependabot (npm dev-deps grouped by
minor/patch, plus GitHub Actions). Non-major updates auto-merge once CI passes and
then release automatically. One-time repo setup for this to work:

1. Settings → General → enable **Allow auto-merge**
2. Branch protection on `main` requiring the **ci** check
3. Add a fine-grained PAT as the `AUTOMERGE_TOKEN` secret — merges made with the
   default `GITHUB_TOKEN` don't trigger the release workflow (GitHub's recursion
   guard); without the secret, trigger a release manually via *Actions → CI → Run
   workflow* after a Dependabot merge

Host the released file on any CDN you control. This package is intentionally not
published to npm.

## License

[MIT](LICENSE)
