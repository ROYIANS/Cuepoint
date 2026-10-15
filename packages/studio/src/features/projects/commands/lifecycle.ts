import type {ProductStore} from "../../../platform/storage/types";
import {type Id, createId, nowIso} from "../../../platform/identity";
import {db as productDb} from "../../../platform/product/store";
import {AUDIO_TABLES} from "../../../platform/product/scopes";

/** Archiving hides a project and its owned library snapshots without altering shared sources. */
export async function setProjectArchived(id: Id, archived: boolean, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", [db.projects, db.libraryMaterials, db.materialEvents], async (db) => {
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

export async function deleteProject(id: Id, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
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
            db.agentJobs, db.agentJobResultChunks,
        ],
        async (db) => {
            for (const job of await db.agentJobs.where("projectId").equals(id).toArray()) await db.agentJobResultChunks.where("jobId").equals(job.id).delete();
            await db.agentJobs.where("projectId").equals(id).delete();
            for (const table of AUDIO_TABLES) await db.table(table.name).where("projectId").equals(id).delete();
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
