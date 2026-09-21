import type { AgentActivityStep, AgentRun, AgentRunOutput, AgentToolCall } from "@/domain/agent";

export type RunActivityItem =
  | { kind: "text"; id: string; content: string }
  | { kind: "reasoning"; id: string; content: string; durationMs?: number }
  | { kind: "tools"; id: string; calls: AgentToolCall[] };

function ownedCalls(run: AgentRun, calls: readonly AgentToolCall[]) {
  return calls.filter((call) => call.runId === run.id && call.threadId === run.threadId)
    .sort((a, b) => a.step - b.step || a.order - b.order);
}

function currentContinuation(run: AgentRun) {
  // Context compaction may replace the base envelope, but always retains this suffix.
  const base = run.context?.baseMessages ?? run.requestMessages;
  return (run.continuationMessages ?? []).slice(base.length);
}

function publicSteps(run: AgentRun, calls: readonly AgentToolCall[]): Map<number, AgentActivityStep> {
  const steps = new Map<number, AgentActivityStep>();
  const byProviderId = new Map(calls.map((call) => [call.providerCallId, call]));
  // Request history and opaque Responses items are deliberately never display sources.
  for (const message of currentContinuation(run)) {
    if (message.role !== "assistant" || !message.tool_calls?.length) continue;
    const matched = message.tool_calls.map((wire) => {
      const call = byProviderId.get(wire.id);
      return call?.name === wire.function.name && call.arguments === wire.function.arguments ? call : undefined;
    });
    if (matched.some((call) => !call) || matched.some((call) => call!.step !== matched[0]!.step)) continue;
    const step = matched[0]!.step;
    steps.set(step, { step, content: message.content });
  }
  for (const step of run.activitySteps ?? []) steps.set(step.step, step);
  return steps;
}

/** A stable chronological view of public output and this run's tool ledger. */
export function buildRunActivity(run: AgentRun, calls: readonly AgentToolCall[]): RunActivityItem[] {
  const scopedCalls = ownedCalls(run, calls);
  const steps = publicSteps(run, scopedCalls);
  const callsByStep = new Map<number, AgentToolCall[]>();
  for (const call of scopedCalls) {
    const group = callsByStep.get(call.step) ?? [];
    group.push(call);
    callsByStep.set(call.step, group);
  }
  const result: RunActivityItem[] = [];
  const stepNumbers = [...new Set([...steps.keys(), ...callsByStep.keys()])].sort((a, b) => a - b);
  for (const number of stepNumbers) {
    const step = steps.get(number);
    const prefix = `${run.id}-step-${number}`;
    if (step?.reasoning?.trim()) result.push({ kind: "reasoning", id: `${prefix}-reasoning`, content: step.reasoning, durationMs: step.reasoningDurationMs });
    if (step?.content.trim()) result.push({ kind: "text", id: `${prefix}-text`, content: step.content });
    const group = callsByStep.get(number);
    if (!group?.length) continue;
    const previous = result.at(-1);
    if (previous?.kind === "tools") previous.calls.push(...group);
    else result.push({ kind: "tools", id: `${prefix}-tools`, calls: [...group] });
  }
  return result;
}

/** The message keeps the last tool round until the next model delta arrives. */
export function isPersistedToolRound(run: AgentRun, output: Pick<AgentRunOutput, "content" | "reasoning">, calls?: readonly AgentToolCall[]): boolean {
  // A successfully completed model response is final, even if it repeats earlier text.
  if (run.status === "completed" || !run.hasToolCalls) return false;
  const savedSteps = calls ? [...publicSteps(run, ownedCalls(run, calls)).values()] : run.activitySteps ?? [];
  const latest = savedSteps.reduce<AgentActivityStep | undefined>((found, step) => !found || step.step >= found.step ? step : found, undefined);
  if (latest) return latest.content === output.content && (latest.reasoning === undefined || latest.reasoning === (output.reasoning ?? ""));
  if (calls) return false;
  // Legacy caller without the ledger: only rounds appended after this run's base.
  const rounds = currentContinuation(run).filter((message) => message.role === "assistant" && message.tool_calls?.length);
  return rounds.length > 0 && rounds.at(-1)!.content === output.content;
}

/** Natural elapsed time includes waits; paused/terminal records freeze at their timestamp. */
export function getRunElapsedMs(run: AgentRun, now = Date.now()): number {
  const start = Date.parse(run.createdAt);
  const end = run.status === "running" ? now : Date.parse(run.endedAt ?? run.updatedAt);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
}

export function formatRunElapsed(ms: number): string {
  const seconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1_000)) : 0;
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分 ${seconds % 60} 秒`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分 ${seconds % 60} 秒`;
}
