import type { AgentRun, AgentToolCall } from "@/domain/agent";

export interface RunExecutionSummary {
  kind: string;
  label: string;
  detail: string;
  /** Counts describe available owned ledger rows, not an inferred legacy total. */
  counts: { total: number; completed: number; failed: number; rejected: number; waiting: number; unknown: number };
  modelSteps?: number;
  offeredTools?: number;
  protocol?: string;
}

/** Presentation uses structured execution records, never model prose or error keywords. */
export function describeRunExecution(run: AgentRun, calls: readonly AgentToolCall[]): RunExecutionSummary {
  const owned = calls.filter(call => call.runId === run.id && call.threadId === run.threadId);
  const count = (status: AgentToolCall["status"]) => owned.filter(call => call.status === status).length;
  const counts = { total: owned.length, completed: count("completed"), failed: count("failed"), rejected: count("rejected"), waiting: count("awaiting_approval"), unknown: count("unknown") };
  const modelSteps = typeof run.modelStep === "number" && Number.isFinite(run.modelStep) && run.modelStep >= 0 ? run.modelStep : undefined;
  const offer = modelSteps === undefined ? undefined : run.offeredTools?.slice().reverse().find(item => item.step === modelSteps);
  const diagnostics = {
    ...(modelSteps !== undefined ? { modelSteps } : {}),
    ...(offer ? { offeredTools: new Set(offer.names).size } : {}),
    ...(run.protocol === "chat-completions" || run.protocol === "responses" ? { protocol: run.protocol } : {}),
  };
  const unfinishedPlan = run.plan?.filter(item => item.status !== "completed").length ?? 0;
  const planNote = unfinishedPlan ? `计划仍有 ${unfinishedPlan} 项未标记完成；计划状态不代表实际执行结果。` : "";
  const failures = [counts.failed ? `${counts.failed} 项调用失败` : "", counts.rejected ? `${counts.rejected} 项调用被拒绝` : ""].filter(Boolean).join("，");
  function result(kind: string, label: string, detail: string): RunExecutionSummary {
    return { kind, label, detail: [detail, failures ? `${failures}。` : "", planNote].filter(Boolean).join(""), counts, ...diagnostics };
  }

  if (counts.unknown) return result("unknown", "工具结果待核实", `${counts.unknown} 项工具的执行结果不确定，不能据此确认修改或生成结果，也不能自动重试。`);
  // Decisions can remain actionable after interruption/failure; cancellation ends that work.
  if ((counts.waiting || run.status === "waiting_approval") && run.status !== "cancelled" && run.status !== "running") {
    const stopped = run.status === "failed" ? "本次执行曾失败；" : run.status === "interrupted" ? "本次执行已中断；" : "";
    return result("approval", "等待确认", `${stopped}${counts.waiting ? `${counts.waiting} 项调用等待确认，` : "执行处于等待确认状态，"}确认前不会执行这些调用。`);
  }
  if (run.status === "running") {
    const active = count("running"), pending = count("pending") + count("approved");
    return result("running", active ? "正在调用工具" : "正在执行", active ? `${active} 项工具正在执行，结果尚未确定。` : pending ? `${pending} 项工具等待执行。` : counts.waiting ? `${counts.waiting} 项调用等待确认，正在保存执行状态。` : "正在处理当前请求，尚无最终执行结果。");
  }
  if (run.status === "interrupted" && run.pauseReason === "model_step_limit") return result("budget", "已暂停，等待继续", "已达到本段模型请求上限；已保存当前进度，后续操作尚未执行。");
  if (run.status === "failed") return result("failed", "执行失败", "本次执行未正常结束；已完成的调用仍保留，不能据此认定整个目标已完成。");
  if (run.status === "interrupted") return result("interrupted", "执行已中断", "本次执行已停止，保留已有记录；未执行部分不会自动继续。");
  if (run.status === "cancelled") return result("cancelled", "执行已取消", "本次执行已结束，取消不会撤销此前已执行的操作，也不代表远端任务已取消。");

  if (!owned.length && run.hasToolCalls) return result("incomplete", "执行记录不完整", "执行标记包含工具调用，但当前缺少对应记录，无法确认调用数量或执行结果。");
  if (count("running") || count("pending") || count("approved")) return result("pending", "仍有未结束的工具调用", "回复已经结束，但仍有工具记录未结束；不能据此确认这些操作已执行。");
  if (counts.failed || counts.rejected) return result("failed", "工具调用存在失败或拒绝", "回复已结束；成功调用的记录仍保留，未完成的调用不能计为已完成工作。");
  if (!owned.length) return run.interactionMode === "conversation"
    ? result("conversation", "回复已结束", "本轮为对话模式。")
    : result("reply", "仅回复，未调用工具", "本轮没有工具调用记录；文字回复本身不代表已读取或修改项目。");
  if (owned.some(call => call.effect === "write" || call.effect === "network")) return result("tools", "工具调用已结束", `${counts.completed} 项工具调用已结束。调用完成不代表整个目标完成，也不代表生成结果已保存，请以具体调用结果和项目内容为准。`);
  if (owned.some(call => call.effect === "read")) return result("read", "已读取，未执行修改", "本轮完成了读取及可能的准备操作，没有业务写入或网络执行记录。");
  return result("preparation", "仅准备，未执行业务", "本轮仅执行计划、能力加载等准备操作，未读取或修改业务内容。");
}
