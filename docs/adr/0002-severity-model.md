# ADR-0002: Derive state from incident/maintenance objects, never the top-level status string

Date: 2026-07-18 · Status: accepted

## Context

The feed offers a pre-computed top-level `status` string. Two problems, both
observed live on 2026-07-18:

1. Its values are page-owner-configurable display strings
   (`publicSeverityMapping*`), so string-matching breaks per deployment and per
   language.
2. AllQuiet computes it with maintenance taking precedence: the feed reported
   `"Maintenance"` while a Critical incident was open. For an alerting widget that
   ordering is wrong — an outage matters more than planned work.

## Decision

The widget ignores `status` entirely and derives display state from the underlying
objects:

- Open incidents (`status === "Open"`, deduped by `id`) map Critical→red,
  Warning→orange, Minor→yellow. Unknown severities rank as Minor. The worst open
  severity wins; additional items collapse into "+N more".
- Maintenance windows show blue when upcoming within the lookahead (default 60 min)
  or currently active.
- **Incidents always outrank maintenance.**
- Popup headlines still *display* the feed's `publicSeverityMapping*` strings (the
  page owner's own naming/localization), falling back to built-in English — display
  only, never logic.

## Consequences

- Correct alerting priority even when AllQuiet's own summary downplays an outage.
- Resilient to renamed severity labels and localized pages.
- Three severity colors (not the two originally sketched) map 1:1 onto AllQuiet's
  model, keeping blue exclusively for maintenance.
