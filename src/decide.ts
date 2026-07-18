/**
 * Pure decision logic: (feed, dismissed IDs, now) → what the popup shows.
 * No DOM, no I/O — fully unit-tested against captured fixtures.
 */

import type { FeedIncident, FeedMaintenance, StatusFeed } from './types';
import type { WidgetStrings } from './strings';
import { formatString } from './strings';

export type PopupKind = 'critical' | 'warning' | 'minor' | 'maintenance';

export interface DisplayState {
  kind: PopupKind;
  headline: string;
  body: string;
  /** Maintenance phase line ("Starts in 40 min" / "In progress"); null for incidents */
  detail: string | null;
  /** Number of additional items beyond the one shown */
  moreCount: number;
  linkUrl: string | null;
  /** Every incident/maintenance ID this popup represents — all dismissed together */
  ids: string[];
}

export interface DecideInput {
  /** Skew-corrected "now" on the server's timeline (ms since epoch) */
  nowMs: number;
  /** How far ahead an upcoming maintenance window triggers the popup */
  lookaheadMs: number;
  /** Overrides the feed's statusPage.publicUrl when set */
  statusPageUrl?: string;
  strings: WidgetStrings;
}

const SEVERITY_RANK: Record<string, number> = { Critical: 3, Warning: 2, Minor: 1 };

/**
 * Offset to add to Date.now() to land on the server's clock, derived from the
 * feed's utcNow at fetch time. Zero when the feed carries no usable utcNow.
 */
export function computeServerSkewMs(feed: StatusFeed, clientFetchMs: number): number {
  const results = feed?.calculation?.results;
  if (Array.isArray(results)) {
    for (const r of results) {
      const utcNow = r?.result?.utcNow;
      if (typeof utcNow === 'string') {
        const t = Date.parse(utcNow);
        if (!Number.isNaN(t)) return t - clientFetchMs;
      }
    }
  }
  return 0;
}

/** All IDs present anywhere in the feed — dismissals for absent IDs get pruned. */
export function collectPresentIds(feed: StatusFeed): Set<string> {
  const ids = new Set<string>();
  const results = feed?.calculation?.results;
  if (Array.isArray(results)) {
    for (const r of results) {
      const incidents = r?.result?.incidents;
      if (!Array.isArray(incidents)) continue;
      for (const inc of incidents) {
        if (inc && typeof inc.id === 'string') ids.add(inc.id);
      }
    }
  }
  const maintenances = feed?.calculation?.maintenances;
  if (Array.isArray(maintenances)) {
    for (const m of maintenances) {
      if (m && typeof m.id === 'string') ids.add(m.id);
    }
  }
  return ids;
}

interface OpenIncident extends FeedIncident {
  id: string;
}

/** Open incidents, deduped by ID (the feed repeats an incident per affected service). */
function openIncidents(feed: StatusFeed): OpenIncident[] {
  const seen = new Set<string>();
  const out: OpenIncident[] = [];
  const results = feed?.calculation?.results;
  if (!Array.isArray(results)) return out;
  for (const r of results) {
    const incidents = r?.result?.incidents;
    if (!Array.isArray(incidents)) continue;
    for (const inc of incidents) {
      if (!inc || typeof inc.id !== 'string' || seen.has(inc.id)) continue;
      seen.add(inc.id);
      if (inc.status === 'Open') out.push(inc as OpenIncident);
    }
  }
  return out;
}

interface EligibleMaintenance {
  id: string;
  displayName: string;
  startMs: number;
  active: boolean;
}

function eligibleMaintenances(
  feed: StatusFeed,
  nowMs: number,
  lookaheadMs: number,
): EligibleMaintenance[] {
  const out: EligibleMaintenance[] = [];
  const list = feed?.calculation?.maintenances;
  if (!Array.isArray(list)) return out;
  for (const m of list) {
    if (!m || typeof m.id !== 'string') continue;
    if (typeof m.start !== 'string' || typeof m.end !== 'string') continue;
    const startMs = Date.parse(m.start);
    const endMs = Date.parse(m.end);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) continue;
    const active = nowMs >= startMs && nowMs <= endMs;
    const upcoming = nowMs < startMs && startMs - nowMs <= lookaheadMs;
    if (active || upcoming) {
      out.push({
        id: m.id,
        displayName: typeof m.displayName === 'string' ? m.displayName.trim() : '',
        startMs,
        active,
      });
    }
  }
  return out;
}

function rankOf(incident: FeedIncident): number {
  return SEVERITY_RANK[incident.severity ?? ''] ?? 1;
}

export function decide(
  feed: StatusFeed | null | undefined,
  dismissed: ReadonlySet<string>,
  input: DecideInput,
): DisplayState | null {
  try {
    if (!feed || typeof feed !== 'object') return null;
    const { strings } = input;
    const linkUrl = input.statusPageUrl ?? feed.statusPage?.publicUrl ?? null;

    const incidents = openIncidents(feed).filter((i) => !dismissed.has(i.id));
    if (incidents.length > 0) {
      let worst = incidents[0]!;
      for (const inc of incidents) {
        if (rankOf(inc) > rankOf(worst)) worst = inc;
      }
      const rank = rankOf(worst);
      const kind: PopupKind = rank >= 3 ? 'critical' : rank === 2 ? 'warning' : 'minor';
      const mapping = feed.statusPage;
      const headline =
        kind === 'critical'
          ? mapping?.publicSeverityMappingCritical || strings.critical
          : kind === 'warning'
            ? mapping?.publicSeverityMappingWarning || strings.warning
            : mapping?.publicSeverityMappingMinor || strings.minor;
      return {
        kind,
        headline,
        body: typeof worst.title === 'string' ? worst.title.trim() : '',
        detail: null,
        moreCount: incidents.length - 1,
        linkUrl,
        ids: incidents.map((i) => i.id),
      };
    }

    const maintenances = eligibleMaintenances(feed, input.nowMs, input.lookaheadMs).filter(
      (m) => !dismissed.has(m.id),
    );
    if (maintenances.length > 0) {
      maintenances.sort((a, b) => a.startMs - b.startMs);
      const nearest = maintenances[0]!;
      const detail = nearest.active
        ? strings.maintenanceInProgress
        : formatString(strings.maintenanceStartsIn, {
            min: Math.max(1, Math.ceil((nearest.startMs - input.nowMs) / 60_000)),
          });
      return {
        kind: 'maintenance',
        headline: strings.maintenance,
        body: nearest.displayName,
        detail,
        moreCount: maintenances.length - 1,
        linkUrl,
        ids: maintenances.map((m) => m.id),
      };
    }

    return null;
  } catch {
    // Feed shapes we didn't foresee must never break the host page.
    return null;
  }
}
