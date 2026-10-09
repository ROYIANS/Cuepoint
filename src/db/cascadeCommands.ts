import {type Id} from "@/domain/types";
import {db} from "./database";
import {nowIso, createId} from "@/lib/ids";
import {AUDIO_TABLES} from "./audioShared";
import {PRODUCTION_TABLES} from "./productionShared";
import {deleteMediaIfOrphans} from "./media";

/** Archiving hides a project and its owned library snapshots without altering shared sources. */
export async function setProjectArchived(id: Id, archived: boolean): Promise<void> {
    await db.transaction("rw", [db.projects, db.libraryMaterials, db.materialEvents], async () => {
        const project = await db.projects.get(id);
        if (!project) throw new Error("项目不存在");
        await db.projects.update(id, {archivedAt: archived ? nowIso() : undefined, updatedAt: nowIso()});
        // Restoring a project leaves individually archived materials for explicit review.
        if (archived) {
            const rows = await db.libraryMaterials.toArray();
            for (const row of rows) if (row.scope.kind === "project" && row.scope.id === id && !row.archived) {
                await db.libraryMaterials.update(row.id, {archived: true, updatedAt: nowIso()});
                await db.materialEvents.add({
                    id: createId("mev"),
                    materialId: row.id,
                    action: "archive",
                    detail: "随项目归档",
                    createdAt: nowIso()
                });
            }
        }
    });
}

export async function deleteProject(id: Id): Promise<void> {
    await db.transaction(
        "rw",
        [
            db.projects,
            ...AUDIO_TABLES,
            db.projectIpLinks, db.materialUses, db.libraryMaterials, db.materialEvents,
            db.projectReferences,
            db.referenceChunks,
            db.projectMemories,
            db.projectMemoryVersions,
            db.characters,
            db.scenes,
            db.props,
            db.styles,
            db.episodes,
            db.shots,
            db.media,
            db.productionProposals,
            db.agentGenerationJobs, db.agentGenerationBatches, db.agentGenerationBatchItems,
        ],
        async () => {
            for (const table of AUDIO_TABLES) await table.where("projectId").equals(id).delete();
            await db.projectIpLinks.delete(id);
            await db.materialUses.where("projectId").equals(id).delete();
            for (const row of await db.libraryMaterials.toArray()) {
                if (row.scope.kind === "project" && row.scope.id === id) {
                    await db.libraryMaterials.update(row.id, {archived: true, updatedAt: nowIso()});
                    await db.materialEvents.add({
                        id: createId("mev"),
                        materialId: row.id,
                        action: "archive",
                        detail: "来源项目已删除，保留素材快照",
                        createdAt: nowIso()
                    });
                }
            }
            await db.projectReferences.where("projectId").equals(id).delete();
            await db.referenceChunks.where("projectId").equals(id).delete();
            await db.projectMemories.where("projectId").equals(id).delete();
            await db.projectMemoryVersions.where("projectId").equals(id).delete();
            await db.agentGenerationBatches.where("projectId").equals(id).delete();
            await db.agentGenerationBatchItems.where("projectId").equals(id).delete();
            await db.agentGenerationJobs.where("projectId").equals(id).delete();
            await db.productionProposals.where("projectId").equals(id).delete();
            await db.characters.where("projectId").equals(id).delete();
            await db.scenes.where("projectId").equals(id).delete();
            await db.props.where("projectId").equals(id).delete();
            await db.styles.where("projectId").equals(id).delete();
            await db.episodes.where("projectId").equals(id).delete();
            await db.shots.where("projectId").equals(id).delete();
            await db.media.where("projectId").equals(id).delete();
            await db.projects.delete(id);
        },
    );
}

export async function deleteChatThread(id: Id): Promise<void> {
    await db.transaction("rw", [...PRODUCTION_TABLES, db.chatThreads, db.chatMessages, db.agentRuns, db.agentToolCalls, db.agentTasks, db.contextCompactions, db.agentTaskRecords, db.agentTaskRecordVersions, db.agentTaskWrapups, db.agentTaskWrapupVersions], async () => {
        const jobs = await db.agentGenerationJobs.where("threadId").equals(id).toArray();
        const batches = await db.agentGenerationBatches.where("threadId").equals(id).toArray();
        const items = await db.agentGenerationBatchItems.where("threadId").equals(id).toArray();
        const jobMedia = new Set([...jobs.flatMap(job => [...job.inputs.map(input => input.mediaId), ...(job.result ? [job.result.mediaId] : [])]), ...items.flatMap(item => item.draft.inputs.map(input => input.mediaId)), ...batches.flatMap(batch => batch.applications.flatMap(a => [a.result.mediaId, ...(a.before ? [a.before.mediaId] : [])]))]);
        await db.agentGenerationBatches.where("threadId").equals(id).delete();
        await db.agentGenerationBatchItems.where("threadId").equals(id).delete();
        await db.agentGenerationJobs.where("threadId").equals(id).delete();
        await db.contextCompactions.where("threadId").equals(id).delete();
        for (const task of await db.agentTasks.where("threadId").equals(id).toArray()) {
            await db.agentTaskWrapups.where("taskId").equals(task.id).delete();
            await db.agentTaskWrapupVersions.where("taskId").equals(task.id).delete();
            await db.agentTaskRecords.where("taskId").equals(task.id).delete();
            await db.agentTaskRecordVersions.where("taskId").equals(task.id).delete();
        }
        await db.agentTasks.where("threadId").equals(id).delete();
        await db.agentToolCalls.where("threadId").equals(id).delete();
        await db.agentRuns.where("threadId").equals(id).delete();
        await db.chatMessages.where("threadId").equals(id).delete();
        await db.chatThreads.delete(id);
        await deleteMediaIfOrphans([...jobMedia]);
    });
}
