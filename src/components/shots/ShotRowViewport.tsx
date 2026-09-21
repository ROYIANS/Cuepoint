import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ObserveRow = (element: HTMLElement, listener: (visible: boolean) => void) => () => void;
const ViewportContext = createContext<ObserveRow | undefined>(undefined);

/** One observer per scrollport; row anchors stay mounted for sorting and deep links. */
export function ShotScrollViewport({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const manager = useMemo(() => {
    if (!root) return undefined;
    const listeners = new Map<Element, (visible: boolean) => void>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
    }, { root, rootMargin: "640px 0px" });
    const observe: ObserveRow = (element, listener) => {
      listeners.set(element, listener);
      observer.observe(element);
      return () => { listeners.delete(element); observer.unobserve(element); };
    };
    return { observe, observer };
  }, [root]);
  useEffect(() => () => manager?.observer.disconnect(), [manager]);
  return <div ref={setRoot} className="app-scroll h-full overflow-auto" data-shot-scrollport>
    <ViewportContext.Provider value={manager?.observe}>{children}</ViewportContext.Provider>
  </div>;
}

export function useShotRowViewport(initiallyVisible: boolean) {
  const observe = useContext(ViewportContext);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [nearViewport, setNearViewport] = useState(initiallyVisible);
  const rowRef = useCallback((node: HTMLElement | null) => setElement(node), []);
  useEffect(() => {
    if (element && observe) return observe(element, setNearViewport);
  }, [element, observe]);
  return { rowRef, nearViewport };
}
