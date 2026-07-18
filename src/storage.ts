/**
 * Dismissed-ID persistence. localStorage when available (per-origin, survives
 * reloads), silently degrading to in-memory when blocked (e.g. Safari private
 * mode) — the popup then reappears next page load, which is the acceptable
 * fallback.
 */

const STORAGE_KEY = 'aqsw:dismissed';

export class DismissalStore {
  static readonly KEY = STORAGE_KEY;

  private memory = new Set<string>();
  private persistent: Storage | null = null;

  constructor() {
    try {
      const probe = 'aqsw:probe';
      const ls = window.localStorage;
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      this.persistent = ls;
      this.memory = this.read();
    } catch {
      this.persistent = null;
    }
  }

  get(): ReadonlySet<string> {
    return this.memory;
  }

  add(ids: readonly string[]): void {
    for (const id of ids) this.memory.add(id);
    this.write();
  }

  /** Drop IDs no longer present in the feed so storage can't grow unbounded. */
  prune(presentIds: ReadonlySet<string>): void {
    let changed = false;
    for (const id of Array.from(this.memory)) {
      if (!presentIds.has(id)) {
        this.memory.delete(id);
        changed = true;
      }
    }
    if (changed) this.write();
  }

  /** Re-read from localStorage — call on cross-tab `storage` events. */
  refresh(): void {
    if (this.persistent) this.memory = this.read();
  }

  private read(): Set<string> {
    if (!this.persistent) return this.memory;
    try {
      const raw = this.persistent.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const parsed: unknown = JSON.parse(raw);
      return new Set(
        Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [],
      );
    } catch {
      return new Set();
    }
  }

  private write(): void {
    if (!this.persistent) return;
    try {
      this.persistent.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.memory)));
    } catch {
      // Quota/permission errors degrade to in-memory behavior.
    }
  }
}
