/**
 * All user-visible copy. English defaults; every string can be overridden via
 * `AllQuietStatusWidget.init({ strings: {...} })`. Templates use `{name}`
 * placeholders so overrides stay plain JSON-compatible strings.
 */

export interface WidgetStrings {
  /** Fallback headlines when the feed's publicSeverityMapping* fields are empty */
  critical: string;
  warning: string;
  minor: string;
  maintenance: string;
  maintenanceInProgress: string;
  /** Placeholder: {min} */
  maintenanceStartsIn: string;
  /** Placeholder: {n} */
  more: string;
  viewStatusPage: string;
  dismiss: string;
}

export const DEFAULT_STRINGS: WidgetStrings = {
  critical: 'Major outage',
  warning: 'Partial outage',
  minor: 'Degraded service',
  maintenance: 'Scheduled maintenance',
  maintenanceInProgress: 'Maintenance in progress',
  maintenanceStartsIn: 'Starts in {min} min',
  more: '+{n} more',
  viewStatusPage: 'View status page',
  dismiss: 'Dismiss notification',
};

export function formatString(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
