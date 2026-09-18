/** Title copy for the agent ThinkingPanel (pure — safe for unit tests). */
export function formatThinkingTitle(active: boolean, durationMs?: number): string {
  if (active) return "思考中";
  if (durationMs != null && Number.isFinite(durationMs)) {
    return `已深度思考 ${(durationMs / 1000).toFixed(1)} 秒`;
  }
  return "已深度思考";
}
