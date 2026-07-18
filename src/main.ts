/**
 * Entry point. Auto-initializes from the embedding <script> tag's data-*
 * attributes (unless data-manual is present) and exposes
 * window.AllQuietStatusWidget = { init, destroy, version }.
 *
 * Every top-level path is wrapped so the widget can never throw into the
 * host page.
 */

import type { WidgetOptions, WidgetConfig } from './config';
import { normalizeOptions, optionsFromScript } from './config';
import type { StatusFeed } from './types';
import type { DisplayState } from './decide';
import { decide, computeServerSkewMs, collectPresentIds } from './decide';
import { DismissalStore } from './storage';
import { startPoller } from './fetch';
import { WidgetUI } from './ui';

/** Re-runs decide() between polls so maintenance countdowns tick and phase flips happen. */
const RERENDER_INTERVAL_MS = 30_000;

interface Controller {
  stop: () => void;
}

function createController(cfg: WidgetConfig): Controller {
  const store = new DismissalStore();
  let feed: StatusFeed | null = null;
  let skewMs = 0;
  let currentState: DisplayState | null = null;

  const ui = new WidgetUI(cfg, () => {
    if (currentState) {
      store.add(currentState.ids);
      rerender();
    }
  });

  function rerender(): void {
    currentState =
      feed === null
        ? null
        : decide(feed, store.get(), {
            nowMs: Date.now() + skewMs,
            lookaheadMs: cfg.lookaheadMs,
            statusPageUrl: cfg.statusPageUrl,
            strings: cfg.strings,
          });
    ui.render(currentState);
  }

  const stopPoller = startPoller(cfg.statusUrl, cfg.pollIntervalMs, (nextFeed, fetchedAtMs) => {
    feed = nextFeed;
    skewMs = computeServerSkewMs(nextFeed, fetchedAtMs);
    store.prune(collectPresentIds(nextFeed));
    rerender();
  });

  const ticker = setInterval(rerender, RERENDER_INTERVAL_MS);

  const onStorage = (event: StorageEvent): void => {
    if (event.key === DismissalStore.KEY || event.key === null) {
      store.refresh();
      rerender();
    }
  };
  window.addEventListener('storage', onStorage);

  return {
    stop: () => {
      stopPoller();
      clearInterval(ticker);
      window.removeEventListener('storage', onStorage);
      ui.destroy();
    },
  };
}

let active: Controller | null = null;

function init(options: WidgetOptions): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const cfg = normalizeOptions(options);
    if (!cfg) {
      console.warn('[allquiet-status-widget] statusUrl (data-status-url) is required');
      return;
    }
    if (active) {
      active.stop();
      active = null;
    }
    const start = (): void => {
      try {
        active = createController(cfg);
      } catch {
        // Never break the host page.
      }
    };
    if (document.body) {
      start();
    } else {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    }
  } catch {
    // Never break the host page.
  }
}

function destroy(): void {
  try {
    if (active) {
      active.stop();
      active = null;
    }
  } catch {
    // Never break the host page.
  }
}

(function bootstrap(): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const w = window as typeof window & {
      AllQuietStatusWidget?: { init: typeof init; destroy: typeof destroy; version: string };
    };
    if (w.AllQuietStatusWidget) return; // Script included twice — first one wins.
    w.AllQuietStatusWidget = { init, destroy, version: __VERSION__ };

    const script = document.currentScript;
    if (script instanceof HTMLScriptElement && script.dataset.manual === undefined) {
      init(optionsFromScript(script));
    }
  } catch {
    // Never break the host page.
  }
})();
