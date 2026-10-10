import {db} from "@/db/database";
import {applyAudioArrangementProposal, previewAudioArrangement, previewAudioSelection, readAudioArrangementProposal, revertAudioArrangementProposal, saveAudioArrangementProposal} from "@/db/audioArrangement";
import {assertAudioClipDocument} from "@/db/audio";
import type {AudioArrangementProposal, AudioArrangementReceipt} from "@/domain/audioArrangement";
import {audioMusicRevision, audioMusicTarget, assertAudioMusicToolScope, resolveAudioMusicArgs} from "./audioTools";
import * as s from "./businessSchemas";
import {libraryReadTool, libraryWriteTool} from "./libraryToolHelpers";
import type {AgentToolContext} from "./tools";
import {createWriteReceipt, type WriteReceiptEntry} from "./writeReceipt";
import {targetRevision} from "@/lib/productionRevision";

const base = {projectId: s.optional(s.id), chapterId: s.id};
const selectionSpec = s.object({...base, choices: s.array(s.object({segmentId: s.id, segmentRevision: audioMusicRevision, takeId: s.id, takeRevision: audioMusicRevision}), 20, 1)});
const arrangementSpec = s.object({...base, segmentIds: s.array(s.id,20,1), trackId: s.id, gapSec: s.optional(s.number(0,300)), startSec: s.optional(s.number(0,86400)), trims: s.optional(s.array(s.object({segmentId: s.id, startSec: s.number(0,86400), endSec: s.number(0,86400)}),20))});
const owner = (context: AgentToolContext) => ({type: "agent" as const, threadId: context.threadId, runId: context.runId, callId: context.callId});
const proposalId = (context: AgentToolContext) => `aap_${targetRevision([context.threadId,context.runId,context.callId]).slice(10)}`;
const scope = async (args: {projectId: string}, context: AgentToolContext) => {await assertAudioMusicToolScope(args.projectId,context,"audio");};

function preview(proposal: AudioArrangementProposal) {
    return {state: {fingerprint: proposal.fingerprint, kind: proposal.kind, choices: proposal.choices, request: proposal.request}, target: audioMusicTarget(proposal.projectId), changes: proposal.kind === "selection" ? proposal.selections.map(item => `${item.segment.text.slice(0,80)}：选用 ${item.take.name.slice(0,300)}（${item.take.id}），${item.take.durationSec.toFixed(3)} 秒${item.textMismatch ? "；来源文字与当前脚本不同" : ""}。只选用，不放入时间线。`) : proposal.items.map(item => {
        if (item.clip) return `${item.text.slice(0,80)}：新增 ${item.takeName}，音轨 ${item.clip.trackId}，位置 ${item.clip.startSec.toFixed(3)} 秒，源裁剪 ${item.clip.trimStartSec.toFixed(3)}–${item.clip.trimEndSec.toFixed(3)} 秒。`;
        const clips = proposal.before.filter(clip=>item.preservedClipIds.includes(clip.id));
        return `${item.text.slice(0,80)}：${item.status === "manual_conflict" ? "保留手动或其他版本剪辑" : "已放置，保留"}，不重复新增。${clips.slice(0,3).map(clip=>`片段 ${clip.id}，音轨 ${clip.trackId}，位置 ${clip.startSec.toFixed(3)} 秒，裁剪 ${clip.trimStartSec.toFixed(3)}–${clip.trimEndSec.toFixed(3)} 秒，音量 ${clip.gain}，淡入/出 ${clip.fadeInSec}/${clip.fadeOutSec} 秒。`).join(" ")}${clips.length>3 ? `另有 ${clips.length-3} 个片段保持原样，可在时间线查看。` : ""}`;
    })};
}
function result(receipt: AudioArrangementReceipt) {
    const entries: WriteReceiptEntry[] = [
        ...receipt.selected.map(row => ({kind: "audio_segment" as const, operation: "updated" as const, id: row.id, ownerId: row.projectId, revision: row.revision, label: row.text.slice(0,160)})),
        ...receipt.added.map(row => ({kind: "audio_clip" as const, operation: "created" as const, id: row.id, ownerId: row.projectId, revision: row.revision, label: "已排列声音"})),
    ];
    return {proposalId: receipt.proposalId, revision: 2, projectId: receipt.projectId, selected: receipt.selected.map(row => ({id: row.id, revision: row.revision, selectedTakeId: row.selectedTakeId})), added: receipt.added.map(row => ({id: row.id, revision: row.revision, takeId: row.takeId, trackId: row.trackId, startSec: row.startSec, trimStartSec: row.trimStartSec, trimEndSec: row.trimEndSec})), preserved: receipt.preserved, conflicts: receipt.conflicts, ...(entries.length ? {writeReceipt: createWriteReceipt(entries)} : {}), note: "选用与放置分别记录；此操作未核验试听效果。"};
}

export const AUDIO_ARRANGEMENT_TOOLS = [
    libraryReadTool({
        name: "audio_read_arrangement", title: "读取选用与排列记录", description: "读取当前项目的真实预览/历史和最新 revision、当前仍存在的新增片段。历史 applied 不代表当前仍放置；导入记录是休眠历史。", spec: s.object({projectId: s.optional(s.id), proposalId: s.id}),
        async execute(args,context) {
            const projectId = await assertAudioMusicToolScope(args.projectId,context,"audio");
            const row = await readAudioArrangementProposal(projectId,args.proposalId);
            const clips = await db.audioClips.bulkGet(row.receipt?.added.map(clip => clip.id) ?? []);
            const segments = await db.audioSegments.bulkGet(row.receipt?.selected.map(segment => segment.id) ?? []);
            const currentSelections = (row.receipt?.selected ?? []).map((historical,index) => ({segmentId:historical.id,takeId:historical.selectedTakeId,selected:segments[index]?.projectId === projectId && segments[index]?.selectedTakeId === historical.selectedTakeId}));
            return {projectId, id: row.id, revision: row.revision, kind: row.kind, state: row.state, dormant: Boolean(row.dormant), reverted: Boolean(row.reverted), currentAddedIds: clips.filter(clip => clip?.projectId === projectId && clip.chapterId === row.chapterId).map(clip => clip!.id), currentSelections, historicalSelectedCount: row.receipt?.selected.length ?? 0, historicalAddedCount: row.receipt?.added.length ?? 0, preserved: row.receipt?.preserved ?? 0, conflicts: row.receipt?.conflicts ?? 0, items: row.items.map(item => ({segmentId: item.segmentId,takeId:item.takeId,status:item.status,durationSec:item.durationSec,clip:item.clip ? {id:item.clip.id,startSec:item.clip.startSec,trimStartSec:item.clip.trimStartSec,trimEndSec:item.clip.trimEndSec} : undefined})), note: "历史效果与当前选用、仍存在的片段分别报告；此操作未核验试听效果。"};
        }
    }),
    libraryWriteTool({
        name: "audio_select_takes", title: "批量选用配音版本", description: "按真实读取到的 segment/take ID 与 revision 选用 1–20 段声音；必须逐项明确版本。整组预览确认后原子保存，不放入时间线，不生成或听取声音。",
        spec: selectionSpec, scope, resolve: (args,context) => resolveAudioMusicArgs(args,context,"audio"), owners: args => [args.projectId], requiresConfirmation: true,
        prepare: async (args,context) => preview(await previewAudioSelection(args.projectId,args.chapterId,args.choices,owner(context),proposalId(context))),
        async execute(args,context) {
            const proposal = await previewAudioSelection(args.projectId,args.chapterId,args.choices,owner(context),proposalId(context));
            await saveAudioArrangementProposal(proposal);
            return result(await applyAudioArrangementProposal(args.projectId,proposal.id,proposal.revision,owner(context),context.signal));
        }
    }),
    libraryWriteTool({
        name: "audio_arrange_selected", title: "排列已选声音", description: "预览并确认后，按稿件顺序和真实裁剪时长，将 1–20 段已选声音追加到明确的人声音轨。已有任意版本剪辑均保留并跳过；不移动手动剪辑，不改变选用，不生成或听取声音。可用 proposalId 明确撤销本次新增。",
        spec: arrangementSpec, scope, resolve: (args,context) => resolveAudioMusicArgs(args,context,"audio"), owners: args => [args.projectId], requiresConfirmation: true,
        prepare: async (args,context) => preview(await previewAudioArrangement(args.projectId,args.chapterId,args,owner(context),proposalId(context))),
        async execute(args,context) {
            const proposal = await previewAudioArrangement(args.projectId,args.chapterId,args,owner(context),proposalId(context));
            await saveAudioArrangementProposal(proposal);
            return result(await applyAudioArrangementProposal(args.projectId,proposal.id,proposal.revision,owner(context),context.signal));
        }
    }),
    libraryWriteTool({
        name: "audio_revert_arrangement", title: "撤销一次声音排列", description: "明确撤销该 proposalId 的新增片段，保留选用、源音频及所有原有手动剪辑。时间线任何后续改动都会拒绝撤销，需先重新检查。导入历史不能应用或撤销。",
        spec: s.object({projectId: s.optional(s.id), proposalId: s.id, revision: audioMusicRevision}), scope, resolve: (args,context) => resolveAudioMusicArgs(args,context,"audio"), owners: args => [args.projectId], requiresConfirmation: true,
        async prepare(args) {
            const proposal = await readAudioArrangementProposal(args.projectId,args.proposalId);
            if (proposal.kind !== "arrangement" || !proposal.receipt || proposal.dormant || proposal.reverted || proposal.revision !== args.revision) throw new Error("此排列不能撤销，请先读取最新内容");
            await assertAudioClipDocument(args.projectId,proposal.chapterId,proposal.receipt.after);
            return {state: proposal, target: audioMusicTarget(args.projectId), changes: [`移除本次新增的 ${proposal.receipt.added.length} 个片段；保留原有剪辑、声音版本和选用。`, ...proposal.receipt.added.map(row => `${row.id}：位置 ${row.startSec.toFixed(3)} 秒，来源 ${row.takeId}`)]};
        },
        async execute(args,context) {
            const removed = await revertAudioArrangementProposal(args.projectId,args.proposalId,args.revision,context.signal);
            return {proposalId: args.proposalId, projectId: args.projectId, removedClipIds: removed, ...(removed.length ? {writeReceipt: createWriteReceipt(removed.map(id => ({kind: "audio_clip", operation: "deleted", id, ownerId: args.projectId, label: "撤销本次排列"})))} : {}), note: "声音版本与选用保持不变。"};
        }
    }),
];
