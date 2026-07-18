/**
 * Node 22+ ships its own experimental `localStorage` global (gated behind
 * --localstorage-file), which shadows happy-dom's implementation inside the
 * vitest environment and resolves to undefined. Install a deterministic
 * in-memory Storage for tests instead.
 */

class MemoryStorage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

const storage = new MemoryStorage() as unknown as Storage;

Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
if ((globalThis as unknown) !== (window as unknown)) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
}
