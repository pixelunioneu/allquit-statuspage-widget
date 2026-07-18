# CONTEXT

Single-context domain doc for `allquiet-status-widget`. Decisions with a "why" live
in `docs/adr/`; this file holds the shared vocabulary and the facts about the
upstream system that the code relies on.

## What this is

An embeddable popup widget that surfaces AllQuiet status-page state (incidents,
maintenance windows) on any website that includes the script. Built by PixelUnion,
open source (MIT), distributed as a single IIFE file via CDN — deliberately no npm
package and no runtime dependencies.

## Domain language

- **Feed** — AllQuiet's public `status.json` for one status page. Third-party data;
  treated as untrusted input everywhere.
- **Incident** — feed object with `id`, `title`, `severity` (`Minor` | `Warning` |
  `Critical`), `status`. **Active** means `status === "Open"`; any other value (or a
  missing one) is inactive. Incidents are listed once per affected service and must
  be deduped by `id`.
- **Severity mapping** — the feed's `publicSeverityMapping{Minor,Warning,Critical}`
  strings, configured per status page by its owner. Used as popup headlines; the
  built-in English strings are only fallbacks.
- **Maintenance window** — entry of `calculation.maintenances[]`: `id`,
  `displayName`, `start`/`end` (UTC ISO). *Upcoming* = starts within the lookahead
  (default 60 min); *active* = now within [start, end]. Both show the blue popup.
- **Display state** — output of the pure `decide()` function: what the popup shows,
  or `null` for no popup. One popup at a time; worst severity wins; incidents always
  outrank maintenance.
- **Dismissal** — user closing the popup. Keyed on item IDs only (see ADR-0003):
  dismissed stays dismissed for as long as the ID exists in the feed.

## Upstream facts (verified 2026-07-18, fixtures in test/fixtures/)

- Origin `https://allquiet.eu/status/<page>/status.json` sends **no CORS headers**
  (OPTIONS → 405). Consumption requires a CORS proxy — for PixelUnion:
  `https://pixelunion-status.b-cdn.net/status.json` (ADR-0001).
- The top-level `status` string is unreliable for alerting: it reported
  `"Maintenance"` while a Critical incident was open, and its values are
  page-owner-configurable. The widget derives everything from incident/maintenance
  objects instead (ADR-0002).
- `calculation.results[].result.utcNow` carries server time; the widget computes a
  clock-skew offset from it so maintenance countdowns don't trust the client clock.
- Feed is ~43 KB raw / ~13 KB gzipped; origin sends no cache headers. AllQuiet
  support ticket asking for native CORS is open (2026-07-18); if granted, proxies
  become optional.

## Invariants

1. The widget must never throw into the host page — every entry point is wrapped,
   and unparseable feed shapes degrade to "no popup" (or "no blue popup" when only
   the maintenance schema drifts).
2. `decide()` stays pure (no DOM, no I/O, no Date.now()) — all inputs are passed in,
   so the whole decision table is unit-testable against fixtures.
3. A dismissed ID never re-triggers a popup while it remains in the feed; a new ID
   always does.
4. The bundle stays a single dependency-free file within the 6 KB gzip budget.

## Related

- Issue tracker: Notion (see `docs/agents/issue-tracker.md` convention in the
  parent workspace).
- Fixtures were captured from the live PixelUnion feed during real test
  incidents/maintenance; `all-clear.json` is synthesized until a real quiet-state
  capture replaces it.
