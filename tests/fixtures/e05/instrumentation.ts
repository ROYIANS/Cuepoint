// All timing/scheduling methods forward to the real browser. No fake clock.
export function instrument() {
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  const outstanding = new Set<number>();
  const requested: number[] = [];
  const ownedIds = new Set<number>();
  const executed: {id: number; timestamp: number}[] = [];
  const cancelled: {id: number; wasOutstanding: boolean}[] = [];
  let maxOutstanding = 0;
  window.requestAnimationFrame = callback => {
    // Playwright waitForFunction has its own RAF polling in this page.
    if (!new Error().stack?.includes("/src/components/ui/click-spark.tsx")) return nativeRAF(callback);
    const id = nativeRAF(timestamp => {
      outstanding.delete(id);
      executed.push({id, timestamp});
      callback(timestamp);
    });
    outstanding.add(id); requested.push(id); ownedIds.add(id);
    maxOutstanding = Math.max(maxOutstanding, outstanding.size);
    return id;
  };
  window.cancelAnimationFrame = id => {
    if (ownedIds.has(id)) cancelled.push({id, wasOutstanding: outstanding.delete(id)});
    nativeCancel(id);
  };
  const listeners = new Set<EventListenerOrEventListenerObject>();
  const mediaListeners = new Set<EventListenerOrEventListenerObject>();
  const mediaWrappers = new WeakMap<MediaQueryList, Map<EventListenerOrEventListenerObject, EventListener>>();
  const mediaEvents: {matches: boolean; before: number[]; after: number[]; cancellations: {id: number; wasOutstanding: boolean}[]}[] = [];
  const nativeAdd = document.addEventListener.bind(document);
  const nativeRemove = document.removeEventListener.bind(document);
  document.addEventListener = (type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    if (type === "visibilitychange" && callback) listeners.add(callback);
    nativeAdd(type, callback, options);
  };
  document.removeEventListener = (type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
    if (type === "visibilitychange" && callback) listeners.delete(callback);
    nativeRemove(type, callback, options);
  };
  const mediaAdd = MediaQueryList.prototype.addEventListener;
  const mediaRemove = MediaQueryList.prototype.removeEventListener;
  MediaQueryList.prototype.addEventListener = function(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
    if (type !== "change") { mediaAdd.call(this, type, callback, options); return; }
    mediaListeners.add(callback);
    const query = this;
    const wrapper: EventListener = event => {
      const before = [...outstanding]; const cancelStart = cancelled.length;
      if (typeof callback === "function") callback.call(query, event);
      else callback.handleEvent(event);
      mediaEvents.push({matches: query.matches, before, after: [...outstanding], cancellations: cancelled.slice(cancelStart)});
    };
    let wrappers = mediaWrappers.get(this);
    if (!wrappers) { wrappers = new Map(); mediaWrappers.set(this, wrappers); }
    wrappers.set(callback, wrapper);
    mediaAdd.call(this, type, wrapper, options);
  };
  MediaQueryList.prototype.removeEventListener = function(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
    if (type === "change") mediaListeners.delete(callback);
    const wrappers = mediaWrappers.get(this);
    mediaRemove.call(this, type, wrappers?.get(callback) ?? callback, options);
    wrappers?.delete(callback);
  };
  const nativeObserver = window.ResizeObserver;
  const observers = new Set<ResizeObserver>();
  let resizeCallbacks = 0;
  window.ResizeObserver = class extends nativeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => { resizeCallbacks++; callback(entries, observer); });
    }
    observe(target: Element, options?: ResizeObserverOptions) {
      observers.add(this); super.observe(target, options);
    }
    disconnect() { observers.delete(this); super.disconnect(); }
  };
  const timers = new Set<number>();
  const nativeTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  let timeoutCallbacks = 0;
  window.setTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (typeof handler !== "function" || !new Error().stack?.includes("/src/components/ui/click-spark.tsx")) return nativeTimeout(handler, timeout, ...args);
    const id = nativeTimeout(() => {
      timers.delete(id); timeoutCallbacks++; handler(...args);
    }, timeout);
    timers.add(id); return id;
  };
  window.clearTimeout = id => { if (typeof id === "number") timers.delete(id); nativeClearTimeout(id); };
  const nativeNow = performance.now.bind(performance);
  let lastNow = 0;
  const burstTimes: number[] = [];
  performance.now = () => {
    lastNow = nativeNow();
    if (new Error().stack?.split("\n")[2]?.includes("handleClick")) burstTimes.push(lastNow);
    return lastNow;
  };
  type Stroke = {from: number[]; to: number[]; color: string | CanvasGradient | CanvasPattern; width: number; now: number};
  const frames: {at: number; strokes: Stroke[]}[] = [];
  let from: number[] = [];
  let to: number[] = [];
  const context = CanvasRenderingContext2D.prototype;
  const clear = context.clearRect;
  const move = context.moveTo;
  const line = context.lineTo;
  const stroke = context.stroke;
  context.clearRect = function(x, y, width, height) {
    frames.push({at: nativeNow(), strokes: []}); clear.call(this, x, y, width, height);
  };
  context.moveTo = function(x, y) { from = [x, y]; move.call(this, x, y); };
  context.lineTo = function(x, y) { to = [x, y]; line.call(this, x, y); };
  context.stroke = function() {
    frames.at(-1)?.strokes.push({from, to, color: this.strokeStyle, width: this.lineWidth, now: lastNow});
    Reflect.apply(stroke, this, []);
  };
  return {
    read: () => ({requested: [...requested], executed: [...executed], cancelled: [...cancelled], outstanding: [...outstanding], maxOutstanding,
      visibilityListeners: listeners.size, mediaListeners: mediaListeners.size, mediaEvents: structuredClone(mediaEvents), observers: observers.size,
      timers: [...timers], timeoutCallbacks, resizeCallbacks, burstTimes: [...burstTimes], frameCount: frames.length, frames: structuredClone(frames.slice(-12))}),
    // Controlled property/event seam only: this does not simulate OS background throttling.
    visibility(hidden: boolean) {
      Object.defineProperty(document, "hidden", {configurable: true, get: () => hidden});
      Object.defineProperty(document, "visibilityState", {configurable: true, get: () => hidden ? "hidden" : "visible"});
      document.dispatchEvent(new Event("visibilitychange"));
    },
  };
}
