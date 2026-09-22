import type { AudioGenerationJob, AudioGenerationStatus } from "@/domain/audioGeneration";

const phases: Record<AudioGenerationStatus, string> = {
  prepared: "已准备，尚未提交", submitting: "正在提交", uncertain: "提交结果待确认",
  submitted: "已提交，待查询", running: "已提交，待核实进度", "remote-completed": "远端已完成，等待保存",
  downloading: "保存音频中", saved: "已保存到项目", failed: "生成未完成", "target-conflict": "结果已保留，请检查目标",
};

/** Provider observations and local saving are separate facts; old running rows are unverified. */
export function describeAudioGeneration(job: AudioGenerationJob) {
  const observations = (job.taskObservations ?? []).filter((item) => job.taskIds.includes(item.taskId));
  const counts = { pending: 0, processing: 0, completed: 0, failed: 0, unknown: 0, queryFailed: 0, unobserved: 0 };
  const seen = new Set<string>();
  let checkedAt: string | undefined;
  for (const observation of observations) {
    if (seen.has(observation.taskId)) continue;
    seen.add(observation.taskId);
    if (observation.status === "query-failed") counts.queryFailed++;
    else counts[observation.status]++;
    if (!checkedAt || observation.checkedAt > checkedAt) checkedAt = observation.checkedAt;
  }
  counts.unobserved = new Set(job.taskIds).size - seen.size;
  let label = phases[job.status];
  if (["submitted", "running"].includes(job.status)) {
    if (counts.queryFailed) label = "查询失败，进度待核实";
    else if (counts.unknown) label = "服务商状态未知";
    else if (counts.unobserved) label = "已提交，部分进度未查询";
    // A partial refresh can retain an older sibling observation. Only runtime's
    // current-pass running state confirms that processing was seen this pass.
    else if (counts.processing) label = job.status === "running" ? "最近查询：生成中" : "部分进度待核实";
    else if (counts.pending) label = "最近查询：排队中";
    else if (counts.failed) label = "最近查询：含失败任务";
    else if (counts.completed) label = "远端已完成，等待保存";
    if (!observations.length) label = phases[job.status];
  }
  if (job.status === "saved" && job.results.length && job.results.every((result) => result.deleted)) label = "生成记录已保存，作品已移除";
  const detail = [
    counts.pending && `排队 ${counts.pending}`,
    counts.processing && `处理中 ${counts.processing}`,
    counts.completed && `远端完成 ${counts.completed}`,
    counts.failed && `远端失败 ${counts.failed}`,
    counts.unknown && `状态未知 ${counts.unknown}`,
    counts.queryFailed && `查询失败 ${counts.queryFailed}`,
    counts.unobserved && `未查询 ${counts.unobserved}`,
  ].filter(Boolean).join(" · ");
  return { label, detail: detail ? `各任务最近记录：${detail}` : "", checkedAt, counts };
}
