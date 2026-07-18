import { beforeEach, describe, expect, it } from 'vitest';
import { DismissalStore } from '../src/storage';

describe('DismissalStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists added ids to localStorage and reads them back', () => {
    const store = new DismissalStore();
    store.add(['a', 'b']);
    expect(store.get().has('a')).toBe(true);

    const reloaded = new DismissalStore();
    expect(reloaded.get().has('a')).toBe(true);
    expect(reloaded.get().has('b')).toBe(true);
    expect(reloaded.get().size).toBe(2);
  });

  it('prunes ids that are no longer present in the feed', () => {
    const store = new DismissalStore();
    store.add(['keep', 'drop']);
    store.prune(new Set(['keep', 'unrelated']));
    expect(store.get().has('keep')).toBe(true);
    expect(store.get().has('drop')).toBe(false);

    const reloaded = new DismissalStore();
    expect(reloaded.get().has('drop')).toBe(false);
  });

  it('refresh() picks up changes written by another tab', () => {
    const store = new DismissalStore();
    window.localStorage.setItem(DismissalStore.KEY, JSON.stringify(['external']));
    expect(store.get().has('external')).toBe(false);
    store.refresh();
    expect(store.get().has('external')).toBe(true);
  });

  it('survives corrupted storage contents', () => {
    window.localStorage.setItem(DismissalStore.KEY, '{not json[');
    const store = new DismissalStore();
    expect(store.get().size).toBe(0);
    window.localStorage.setItem(DismissalStore.KEY, JSON.stringify({ nope: 1 }));
    const store2 = new DismissalStore();
    expect(store2.get().size).toBe(0);
  });

  it('falls back to in-memory when localStorage is unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied');
      },
    });
    try {
      const store = new DismissalStore();
      store.add(['mem-only']);
      expect(store.get().has('mem-only')).toBe(true);
      store.prune(new Set());
      expect(store.get().size).toBe(0);
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });

  it('swallows write failures (quota) while keeping memory state', () => {
    const store = new DismissalStore();
    const ls = window.localStorage;
    const originalSetItem = ls.setItem.bind(ls);
    ls.setItem = () => {
      throw new Error('quota');
    };
    try {
      expect(() => store.add(['q'])).not.toThrow();
      expect(store.get().has('q')).toBe(true);
    } finally {
      ls.setItem = originalSetItem;
    }
  });
});
