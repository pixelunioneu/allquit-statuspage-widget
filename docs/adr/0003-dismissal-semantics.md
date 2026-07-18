# ADR-0003: ID-keyed, permanent-per-item dismissal in localStorage

Date: 2026-07-18 · Status: accepted

## Context

The popup must be dismissable, the dismissal must survive reloads, but new
incidents/maintenance windows must pop up again. Open sub-questions were: what
happens when a dismissed incident escalates (Minor → Critical), how dismissal
interacts with maintenance phase changes (upcoming → in progress), and where to
store the state.

## Decision

- Dismissal stores the set of item IDs the popup represented (worst incident plus
  the "+N more" ones together) in `localStorage` under `aqsw:dismissed`.
- Keyed on **ID only**: dismissed stays dismissed for that item, through severity
  escalations and through a maintenance window moving from "upcoming" to "in
  progress". (Chosen over re-show-on-escalation for simplicity and respect for the
  user's explicit click.)
- IDs absent from the current feed are pruned on every fetch, so storage cannot
  grow unbounded (AllQuiet IDs are UUIDs and never recur).
- Where `localStorage` is unavailable (private browsing), an in-memory set gives
  per-pageview dismissal; the popup returns on the next page load, which is
  acceptable.
- Cross-tab consistency via the `storage` event: dismissing in one tab hides the
  popup in others.

## Consequences

- A visitor who dismissed a yellow blip will not be re-alerted if that same
  incident becomes a major outage — accepted trade-off; a genuinely new incident
  (new ID) always alerts.
- Dismissal scope is per browser origin: dismissing on site A does not carry to
  site B embedding the same widget (browser storage boundary; also desirable).
