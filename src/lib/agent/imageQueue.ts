import { db } from '@/db/database';
import type { AgentToolCall } from '@/domain/agent';
import type { AgentReferenceInput } from '@/domain/referenceInput';
import type { AgentToolContext } from './tools';
import { requireVision, resolveVisionCapability } from '@/lib/ai/visionCapability';

const IMAGE_READ_TOOLS = new Set(['read_project_image', 'material_read_image']);
const settledImageResult = (call: AgentToolCall): AgentReferenceInput | undefined => {
  if (!IMAGE_READ_TOOLS.has(call.name) || call.status !== 'completed' || !call.result) return;
  try { return (JSON.parse(call.result) as { referenceInput?: AgentReferenceInput }).referenceInput; } catch { return; }
};
/**
 * Counts images already sent and completed image reads waiting for appendToolResults.
 * It deliberately runs before the current tool is marked completed, so `additional`
 * reserves the image that this tool is about to return.
 */
export async function assertImageQueueCapacity(context: AgentToolContext, additional = 1): Promise<void> {
  const run = await db.agentRuns.get(context.runId);
  if (!run || run.threadId !== context.threadId) throw new Error('执行不存在或归属已变化');
  requireVision(run.visionCapability ?? await resolveVisionCapability(run.model, run.connector.definitionId));
  const messages = run.continuationMessages ?? run.requestMessages;
  const appended = new Set(messages.map(message => message.sourceToolCallId).filter((id): id is string => !!id));
  let queued = messages.reduce((sum, message) => sum + (message.referenceInput?.images?.length ?? 0), 0);
  const calls = await db.agentToolCalls.where('runId').equals(run.id).toArray();
  for (const call of calls) {
    if (appended.has(call.providerCallId)) continue;
    queued += settledImageResult(call)?.images?.length ?? 0;
  }
  if (queued + additional > 10) throw new Error(`本次执行最多保留 10 张待分析图片，当前已有 ${queued} 张；请先完成当前分析或开启新对话`);
}
