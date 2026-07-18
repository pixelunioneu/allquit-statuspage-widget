import { describe, expect, it } from 'vitest';
import { MIN_POLL_INTERVAL_MS, normalizeOptions, optionsFromScript } from '../src/config';
import { DEFAULT_STRINGS } from '../src/strings';

describe('normalizeOptions', () => {
  it('requires statusUrl', () => {
    expect(normalizeOptions({})).toBeNull();
    expect(normalizeOptions({ statusUrl: '   ' })).toBeNull();
  });

  it('applies documented defaults', () => {
    const cfg = normalizeOptions({ statusUrl: 'https://x/status.json' })!;
    expect(cfg.statusUrl).toBe('https://x/status.json');
    expect(cfg.statusPageUrl).toBeUndefined();
    expect(cfg.pollIntervalMs).toBe(300_000);
    expect(cfg.position).toBe('bottom-right');
    expect(cfg.lookaheadMs).toBe(3_600_000);
    expect(cfg.zIndex).toBe(2_147_483_000);
    expect(cfg.strings).toEqual(DEFAULT_STRINGS);
  });

  it('clamps the poll interval to the minimum', () => {
    const cfg = normalizeOptions({ statusUrl: 'https://x', pollIntervalSeconds: 1 })!;
    expect(cfg.pollIntervalMs).toBe(MIN_POLL_INTERVAL_MS);
  });

  it('validates position and falls back to bottom-right', () => {
    expect(normalizeOptions({ statusUrl: 'https://x', position: 'bottom-left' })!.position).toBe(
      'bottom-left',
    );
    expect(normalizeOptions({ statusUrl: 'https://x', position: 'top-center' })!.position).toBe(
      'bottom-right',
    );
  });

  it('merges string overrides over the defaults', () => {
    const cfg = normalizeOptions({
      statusUrl: 'https://x',
      strings: { maintenance: 'Gepland onderhoud' },
    })!;
    expect(cfg.strings.maintenance).toBe('Gepland onderhoud');
    expect(cfg.strings.critical).toBe(DEFAULT_STRINGS.critical);
  });
});

describe('optionsFromScript', () => {
  it('reads data-* attributes', () => {
    const script = document.createElement('script');
    script.setAttribute('data-status-url', 'https://cdn.example/status.json');
    script.setAttribute('data-status-page-url', 'https://status.example');
    script.setAttribute('data-poll-interval', '120');
    script.setAttribute('data-position', 'bottom-left');
    script.setAttribute('data-maintenance-lookahead', '30');
    script.setAttribute('data-z-index', '9999');

    const opts = optionsFromScript(script);
    expect(opts.statusUrl).toBe('https://cdn.example/status.json');
    expect(opts.statusPageUrl).toBe('https://status.example');
    expect(opts.pollIntervalSeconds).toBe(120);
    expect(opts.position).toBe('bottom-left');
    expect(opts.maintenanceLookaheadMinutes).toBe(30);
    expect(opts.zIndex).toBe(9999);
  });

  it('leaves absent and unparseable attributes undefined', () => {
    const script = document.createElement('script');
    script.setAttribute('data-status-url', 'https://cdn.example/status.json');
    script.setAttribute('data-poll-interval', 'soon');

    const opts = optionsFromScript(script);
    expect(opts.pollIntervalSeconds).toBeUndefined();
    expect(opts.statusPageUrl).toBeUndefined();
    expect(opts.zIndex).toBeUndefined();
  });
});
