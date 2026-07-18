/**
 * Minimal typing of the AllQuiet status.json feed — only the fields the widget
 * reads. Everything is optional: the feed is third-party data and parsing must
 * survive any shape (see decide.ts).
 *
 * Schema verified against live captures on 2026-07-18
 * (test/fixtures/live-outage.json, test/fixtures/maintenance-live.json).
 */

export interface FeedIncident {
  id?: string;
  title?: string;
  /** "Minor" | "Warning" | "Critical" */
  severity?: string;
  /** "Open" while active; anything else counts as inactive */
  status?: string;
}

export interface FeedMaintenance {
  id?: string;
  displayName?: string;
  /** UTC ISO timestamp */
  start?: string;
  /** UTC ISO timestamp */
  end?: string;
}

export interface FeedServiceResult {
  result?: {
    /** Server-side "now" — used to correct client clock skew */
    utcNow?: string;
    incidents?: FeedIncident[];
  };
}

export interface StatusFeed {
  /**
   * Pre-computed display string. Deliberately unused: the strings are
   * per-page configurable, and AllQuiet lets an active maintenance mask an
   * open Critical incident here.
   */
  status?: string;
  statusPage?: {
    publicUrl?: string;
    publicSeverityMappingMinor?: string;
    publicSeverityMappingWarning?: string;
    publicSeverityMappingCritical?: string;
  };
  calculation?: {
    maintenances?: FeedMaintenance[];
    results?: FeedServiceResult[];
  };
}
