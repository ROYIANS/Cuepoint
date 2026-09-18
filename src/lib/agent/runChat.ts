import { checkpointAgentRun, finishAgentRun } from "@/db/agentRuns";
import type { AgentRun, AgentRunOutput } from "@/domain/agent";
import { accumulateStreamDelta, createReasoningAccum, finalizeReasoningAccum, streamChatCompletions, type StreamDelta } from "@/lib/ai/chatStream";

/** Coalesce bursts and serialize writes. A failed write stops further streaming. */
export function createRunWriter(persist: (sequence: number, output: AgentRunOutput) => Promise<void>, onFailure: () => void) {
  let sequence = 0;
  let pending: { sequence: number; output: AgentRunOutput } | undefined;
  let draining: Promise<void> | undefined;
  let failure: unknown;
  function drain() {
    if (draining || !pending || failure) return;
    draining = (async () => {
      while (pending) {
        const next = pending;
        pending = undefined;
        await persist(next.sequence, next.output);
      }
    })().catch((error: unknown) => { failure = error; pending = undefined; onFailure(); }).finally(() => { draining = undefined; if (pending) drain(); });
  }
  function push(output: AgentRunOutput) {
    if (failure) return;
    pending = { sequence: ++sequence, output: { ...output } };
    drain();
  }
  return { push, async flush() { while (draining) await draining; if (failure) throw failure; } };
}

/** Must execute while owning withThreadRunLock for the whole request and final write. */
export async function executeChatRun(run: AgentRun, apiKey: string, controller: AbortController, fetchImpl?: typeof fetch): Promise<void> {
  let accum = createReasoningAccum();
  const output = (): AgentRunOutput => ({ content: accum.content, reasoning: accum.reasoning, reasoningDurationMs: accum.reasoningDurationMs });
  const writer = createRunWriter((sequence, next) => checkpointAgentRun(run.id, sequence, next), () => controller.abort());
  try {
    const onDelta = (delta: StreamDelta) => {
      if (controller.signal.aborted) return;
      accum = accumulateStreamDelta(accum, delta, Date.now());
      writer.push(output());
    };
    const result = await streamChatCompletions({ baseUrl: run.connector.baseUrl, apiKey, model: run.model, messages: run.requestMessages }, {
      signal: controller.signal, fetchImpl,
      onDelta: (content) => onDelta({ content }),
      onReasoning: (reasoning) => onDelta({ reasoning }),
    });
    accum = finalizeReasoningAccum(accum, Date.now());
    await writer.flush();
    if (controller.signal.aborted || (!result.ok && result.aborted)) {
      await finishAgentRun(run.id, "cancelled", output(), "已停止，已收到的内容保留。重新生成会创建一次新的请求。");
    } else if (result.ok) {
      await finishAgentRun(run.id, "completed", output(), undefined, result.finishReason);
    } else {
      await finishAgentRun(run.id, "failed", output(), result.message, result.finishReason);
    }
  } catch {
    controller.abort();
    // Drain before terminal transition even when a callback/transport throws.
    await writer.flush().catch(() => undefined);
    await finishAgentRun(run.id, "failed", output(), "执行或本地保存失败，请检查浏览器存储后重新生成。");
    throw new Error("执行或本地保存失败，最后一段内容可能尚未保存");
  }
}
