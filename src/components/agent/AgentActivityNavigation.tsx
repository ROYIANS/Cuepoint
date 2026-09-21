import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type AgentActivityTarget = { runId: string; callId?: string; batchId?: string };
type ActivityRequest = AgentActivityTarget & { key: number };
const ActivityNavigation = createContext<{
  request: ActivityRequest | null;
  reveal: (target: AgentActivityTarget) => void;
}>({ request: null, reveal: () => undefined });

/** Navigation only: revealing a surface must never approve or execute work. */
export function AgentActivityNavigationProvider({ threadId, children }: { threadId?: string; children: ReactNode }) {
  const sequence = useRef(0);
  const [selection, setSelection] = useState<{ threadId?: string; request: ActivityRequest } | null>(null);
  useEffect(() => setSelection(null), [threadId]);
  const reveal = useCallback((target: AgentActivityTarget) => {
    setSelection({ threadId, request: { ...target, key: ++sequence.current } });
  }, [threadId]);
  const request = selection?.threadId === threadId ? selection?.request ?? null : null;
  const value = useMemo(() => ({ request, reveal }), [request, reveal]);
  return <ActivityNavigation.Provider value={value}>{children}</ActivityNavigation.Provider>;
}

export function useAgentActivityNavigation() { return useContext(ActivityNavigation); }
