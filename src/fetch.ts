import type { StatusFeed } from './types';

export type FeedHandler = (feed: StatusFeed, fetchedAtMs: number) => void;

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Polls the status URL. Visibility-aware: polling pauses while the tab is
 * hidden and refetches immediately when it becomes visible again. Fetch
 * failures are silent (the last known state stays on screen) and polling
 * simply continues.
 *
 * Returns a stop function.
 */
export function startPoller(
  statusUrl: string,
  intervalMs: number,
  onFeed: FeedHandler,
): () => void {
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function tick(): Promise<void> {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = controller
        ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
        : null;
      try {
        const response = await fetch(statusUrl, {
          credentials: 'omit',
          signal: controller ? controller.signal : null,
        });
        if (response.ok) {
          const feed = (await response.json()) as StatusFeed;
          if (!stopped) onFeed(feed, Date.now());
        }
      } finally {
        if (timeout !== null) clearTimeout(timeout);
      }
    } catch {
      // Network blip or malformed body — keep last state, retry next cycle.
    }
    inFlight = false;
    schedule();
  }

  function schedule(): void {
    if (stopped || document.visibilityState === 'hidden') return;
    timer = setTimeout(() => {
      timer = null;
      void tick();
    }, intervalMs);
  }

  function onVisibilityChange(): void {
    if (stopped) return;
    if (document.visibilityState === 'hidden') {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    } else if (timer === null && !inFlight) {
      void tick();
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  void tick();

  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
