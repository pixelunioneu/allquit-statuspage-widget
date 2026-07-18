import { describe, expect, it } from 'vitest';
import { collectPresentIds, computeServerSkewMs, decide } from '../src/decide';
import type { DecideInput } from '../src/decide';
import type { StatusFeed } from '../src/types';
import { DEFAULT_STRINGS } from '../src/strings';
import liveOutageJson from './fixtures/live-outage.json';
import maintenanceLiveJson from './fixtures/maintenance-live.json';
import allClearJson from './fixtures/all-clear.json';

// IDs from the captured fixtures (real test incidents on the PixelUnion page).
const CRITICAL_ID = '5da3fc6c-e717-45f3-8785-fa32a4c02c81'; // "Test incident"
const WARNING_ID = 'cbe39f28-35bf-4f5b-9d7c-51344ea29a09'; // "Testing "
const MAINTENANCE_ID = '20fcf1e0-63ee-4627-b359-56b085e5ab8c'; // "It's hapnening. "
const MAINTENANCE_START = Date.parse('2026-07-18T08:43:00Z');
const MAINTENANCE_END = Date.parse('2026-07-18T12:43:00Z');
const STATUS_PAGE_URL = 'https://allquiet.eu/status/pixelunion';

const liveOutage = (): StatusFeed => structuredClone(liveOutageJson) as StatusFeed;
const maintenanceLive = (): StatusFeed => structuredClone(maintenanceLiveJson) as StatusFeed;
const allClear = (): StatusFeed => structuredClone(allClearJson) as StatusFeed;

const none: ReadonlySet<string> = new Set();

function input(overrides: Partial<DecideInput> = {}): DecideInput {
  return {
    nowMs: MAINTENANCE_START + 60_000,
    lookaheadMs: 3_600_000,
    strings: DEFAULT_STRINGS,
    ...overrides,
  };
}

describe('decide — incidents', () => {
  it('shows the worst open incident with feed-mapped headline', () => {
    const state = decide(liveOutage(), none, input());
    expect(state).not.toBeNull();
    expect(state!.kind).toBe('critical');
    expect(state!.headline).toBe('Major outage'); // feed's publicSeverityMappingCritical
    expect(state!.body).toBe('Test incident');
    expect(state!.detail).toBeNull();
    expect(state!.moreCount).toBe(1);
    expect(state!.linkUrl).toBe(STATUS_PAGE_URL);
    expect(new Set(state!.ids)).toEqual(new Set([CRITICAL_ID, WARNING_ID]));
  });

  it('uses the feed severity mapping strings, not the built-in defaults', () => {
    const feed = liveOutage();
    feed.statusPage!.publicSeverityMappingCritical = 'Totale storing';
    const state = decide(feed, none, input());
    expect(state!.headline).toBe('Totale storing');
  });

  it('falls back to default strings when the feed mapping is empty', () => {
    const feed = liveOutage();
    feed.statusPage!.publicSeverityMappingCritical = '';
    const state = decide(feed, none, input());
    expect(state!.headline).toBe(DEFAULT_STRINGS.critical);
  });

  it('honors a configured status page URL override', () => {
    const state = decide(liveOutage(), none, input({ statusPageUrl: 'https://example.com/s' }));
    expect(state!.linkUrl).toBe('https://example.com/s');
  });

  it('drops to the remaining incident when the worst one is dismissed', () => {
    const state = decide(liveOutage(), new Set([CRITICAL_ID]), input());
    expect(state!.kind).toBe('warning');
    expect(state!.headline).toBe('Partial outage'); // feed's publicSeverityMappingWarning
    expect(state!.body).toBe('Testing');
    expect(state!.moreCount).toBe(0);
    expect(state!.ids).toEqual([WARNING_ID]);
  });

  it('shows nothing when every incident is dismissed and no maintenance exists', () => {
    const state = decide(liveOutage(), new Set([CRITICAL_ID, WARNING_ID]), input());
    expect(state).toBeNull();
  });

  it('treats unknown severities as minor', () => {
    const feed = liveOutage();
    const incidents = feed.calculation!.results![0]!.result!.incidents!;
    incidents.length = 0;
    incidents.push({ id: 'x-1', title: 'Oddity', severity: 'SomethingNew', status: 'Open' });
    feed.calculation!.results!.length = 1;
    const state = decide(feed, none, input());
    expect(state!.kind).toBe('minor');
  });

  it('ignores non-Open incidents (all-clear fixture)', () => {
    expect(decide(allClear(), none, input())).toBeNull();
  });
});

describe('decide — maintenance', () => {
  const dismissedIncidents = new Set([CRITICAL_ID, WARNING_ID]);

  it('is outranked by open incidents', () => {
    const state = decide(maintenanceLive(), none, input());
    expect(state!.kind).toBe('critical');
  });

  it('shows an in-progress window once incidents are dismissed', () => {
    const state = decide(maintenanceLive(), dismissedIncidents, input({ nowMs: MAINTENANCE_START + 60_000 }));
    expect(state).not.toBeNull();
    expect(state!.kind).toBe('maintenance');
    expect(state!.headline).toBe(DEFAULT_STRINGS.maintenance);
    expect(state!.body).toBe("It's hapnening.");
    expect(state!.detail).toBe(DEFAULT_STRINGS.maintenanceInProgress);
    expect(state!.ids).toEqual([MAINTENANCE_ID]);
    expect(state!.linkUrl).toBe(STATUS_PAGE_URL);
  });

  it('shows an upcoming window inside the lookahead with a countdown', () => {
    const state = decide(
      maintenanceLive(),
      dismissedIncidents,
      input({ nowMs: MAINTENANCE_START - 30 * 60_000 }),
    );
    expect(state!.kind).toBe('maintenance');
    expect(state!.detail).toBe('Starts in 30 min');
  });

  it('clamps the countdown to at least 1 minute', () => {
    const state = decide(
      maintenanceLive(),
      dismissedIncidents,
      input({ nowMs: MAINTENANCE_START - 10_000 }),
    );
    expect(state!.detail).toBe('Starts in 1 min');
  });

  it('stays hidden outside the lookahead window', () => {
    const state = decide(
      maintenanceLive(),
      dismissedIncidents,
      input({ nowMs: MAINTENANCE_START - 2 * 3_600_000 }),
    );
    expect(state).toBeNull();
  });

  it('disappears after the window ends', () => {
    const state = decide(
      maintenanceLive(),
      dismissedIncidents,
      input({ nowMs: MAINTENANCE_END + 1_000 }),
    );
    expect(state).toBeNull();
  });

  it('stays hidden when the maintenance itself is dismissed', () => {
    const dismissed = new Set([CRITICAL_ID, WARNING_ID, MAINTENANCE_ID]);
    const state = decide(maintenanceLive(), dismissed, input());
    expect(state).toBeNull();
  });

  it('skips windows with unparseable dates instead of breaking', () => {
    const feed = maintenanceLive();
    feed.calculation!.maintenances![0]!.start = 'not-a-date';
    const state = decide(feed, dismissedIncidents, input());
    expect(state).toBeNull();
  });
});

describe('decide — malformed feeds never throw', () => {
  const cases: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['empty calculation', { calculation: {} }],
    ['results not an array', { calculation: { results: 42 } }],
    ['incident without id', { calculation: { results: [{ result: { incidents: [{ status: 'Open' }] } }] } }],
    ['maintenance without dates', { calculation: { maintenances: [{ id: 'm1' }] } }],
  ];

  it.each(cases)('%s → null', (_name, feed) => {
    expect(decide(feed as StatusFeed, none, input())).toBeNull();
  });
});

describe('computeServerSkewMs', () => {
  it('derives the offset from the feed utcNow', () => {
    const feed = liveOutage();
    const utcNow = feed.calculation!.results![0]!.result!.utcNow!;
    const serverMs = Date.parse(utcNow);
    expect(computeServerSkewMs(feed, serverMs - 5_000)).toBe(5_000);
    expect(computeServerSkewMs(feed, serverMs + 60_000)).toBe(-60_000);
  });

  it('returns 0 when no utcNow is present', () => {
    expect(computeServerSkewMs({} as StatusFeed, 123)).toBe(0);
    expect(computeServerSkewMs({ calculation: { results: [] } }, 123)).toBe(0);
  });
});

describe('collectPresentIds', () => {
  it('collects incident and maintenance ids', () => {
    const ids = collectPresentIds(maintenanceLive());
    expect(ids.has(CRITICAL_ID)).toBe(true);
    expect(ids.has(WARNING_ID)).toBe(true);
    expect(ids.has(MAINTENANCE_ID)).toBe(true);
  });

  it('returns an empty set for malformed feeds', () => {
    expect(collectPresentIds({} as StatusFeed).size).toBe(0);
  });
});
