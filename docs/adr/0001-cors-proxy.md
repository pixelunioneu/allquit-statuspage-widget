# ADR-0001: Consume status.json through a user-controlled CORS proxy

Date: 2026-07-18 · Status: accepted

## Context

AllQuiet's public `status.json` sends no `Access-Control-Allow-Origin` header and
answers `OPTIONS` with 405 (verified against both `allquiet.eu/status/pixelunion`
and AllQuiet's own status page). Browsers therefore block cross-origin `fetch()`
of the feed from any third-party website — which is exactly where this widget runs.
AllQuiet documents the JSON as the "build a custom frontend" option, so this looks
like an oversight; a support ticket asking for native CORS was filed on 2026-07-18.

## Decision

The widget takes the feed URL as required configuration (`data-status-url`) and
assumes it is CORS-accessible. Each adopter fronts their status.json with a proxy
they control; PixelUnion uses a bunny.net pull zone
(`https://pixelunion-status.b-cdn.net/status.json`, CORS headers enabled, verified
`access-control-allow-origin: *`). The proxy doubles as an edge cache, capping load
on AllQuiet regardless of visitor count.

## Consequences

- Adoption requires a one-time proxy setup (documented in the README) until/unless
  AllQuiet ships native CORS — at which point the origin URL can be used directly
  and this ADR is superseded.
- The widget never hardcodes a feed URL, keeping the open source build
  deployment-agnostic.
- Cache headers are under the adopter's control; the README recommends ~30 s
  edge/browser TTLs.
