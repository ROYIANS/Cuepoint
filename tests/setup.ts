import "fake-indexeddb/auto";
import { afterEach, beforeEach,vi } from "vitest";
import { db } from "@/platform/product/store";

beforeEach(async () => {
  // Model exclusive Web Locks: ordinary requests queue; ifAvailable refuses a live owner.
  // Each test receives an independent host fixture; production still requires real Web Locks.
  const held = new Map<string, Promise<void>>();
  vi.stubGlobal('navigator', {locks: {async request<T>(name: string, optionsOrCallback: {ifAvailable?: boolean} | ((lock: unknown) => Promise<T>), suppliedCallback?: (lock: unknown) => Promise<T>): Promise<T> {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : suppliedCallback;
    if (!callback) throw new Error('Web Lock request requires a callback');
    if (typeof optionsOrCallback !== 'function' && optionsOrCallback.ifAvailable && held.has(name)) return callback(null);
    while (held.has(name)) await held.get(name);
    let release!: () => void;
    held.set(name, new Promise<void>(resolve => {release = resolve;}));
    try {return await callback({name});} finally {held.delete(name); release();}
  }}});

  await db.delete();
  await db.open();
});

afterEach(async () => {
  db.close();
});
