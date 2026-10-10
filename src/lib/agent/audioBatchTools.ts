import {defineTool} from "./toolDefinition";
import * as s from "./businessSchemas";
import {db} from "@/db/database";
import {executeAtomicTool} from "@/db/agentTools";
import {prepareAudioGenerationBatch, readAudioGenerationBatch} from "@/db/audioGenerationBatches";
import {requireBoundProjectScope} from "./projectScope";
import {assertAudioProject} from "@/db/audioShared";
import {AUDIO_BATCH_LIMIT} from "@/domain/audioGenerationBatch";

const draft = s.object({projectId: s.optional(s.id), chapterId: s.id, segmentIds: s.array(s.id, AUDIO_BATCH_LIMIT, 1), connectorId: s.optional(s.id), title: s.optional(s.text(160))});
const read = s.object({projectId: s.optional(s.id), batchId: s.id});

async function audioBatchToolSummary(projectId: string, id: string) {
    const view = await readAudioGenerationBatch(projectId, id);
    return {
        batchId: id, projectId, chapterId: view.batch.chapterId, revision: view.batch.revision, status: view.batch.status,
        submitted: view.jobs.some(job => job.status !== "prepared"), confirmed: !!view.batch.confirmedAt,
        counts: view.counts, pauseReason: view.batch.pauseReason, dormant: !!view.batch.dormant,
        items: view.rows.map(row => ({itemId: row.item.id, segmentId: row.item.segmentId, included: row.item.included, textPreview: row.item.snapshot.input.text.slice(0, 120),
            voice: row.item.snapshot.input.voice, provider: row.item.snapshot.connector.provider, state: row.state, jobId: row.job?.id,
            selected: row.selected, placed: row.placed, auditionVerification: "not_checked",
            retryEligible: row.job?.status === "failed" && row.job.failureStage === "provider" && !row.job.results.length,
            error: row.job?.error?.slice(0, 1000)})),
        note: "准备草稿不等于提交或声音成果。用户须在批量配音面板确认整批付费请求；刷新不会自动发送。已保存、选用、入轨独立；此操作未核验试听，不代表用户没有听过，不能判断声音质量。"
    };
}

export const AUDIO_BATCH_TOOLS = [
    defineTool(draft, {
        name: "prepare_audio_generation_batch", title: "准备批量配音", effect: "write", atomic: true, highRisk: () => false,
        description: "为同一章节1–20个真实段落准备批量配音草稿，继承各段落已保存角色音色。只写本地草稿，不发付费请求；用户在面板核对并确认整批后才发送，模型不能代为确认。projectId 可省略使用当前项目。",
        async execute(args, context) {
            const projectId = await requireBoundProjectScope(context, args.projectId);
            await assertAudioProject(projectId, "audio");
            return executeAtomicTool(context, async () => {
                const run = await db.agentRuns.get(context.runId);
                if (!run || run.interactionMode === "conversation" || !run.enabledToolNames?.includes("prepare_audio_generation_batch")) throw new Error("当前执行未启用批量配音");
                const batch = await prepareAudioGenerationBatch({...args, projectId, owner: {kind: "agent", threadId: context.threadId, runId: context.runId, callId: context.callId, taskId: run.taskId}});
                return audioBatchToolSummary(projectId, batch.id);
            });
        }
    }),
    defineTool(read, {
        name: "audio_read_generation_batch", title: "读取批量配音进度", effect: "read", highRisk: () => false,
        description: "读取当前项目已保存批次的各项真实状态、失败和已保存/选用/入轨区别。只读本地记录，不发送、查询供应商或试听。准备完成不代表付费提交，未知项不得重发。",
        async execute(args, context) {
            const projectId = await requireBoundProjectScope(context, args.projectId);
            context.signal.throwIfAborted();
            return audioBatchToolSummary(projectId, args.batchId);
        }
    })
];
