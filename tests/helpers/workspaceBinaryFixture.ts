import {db} from "@/db/database";
import type {Id, MediaRecord} from "@/domain/types";
import {isStudioLibrary} from "@/domain/types";
import {parseShotPictureSlots, slotMediaIds} from "@/domain/slot";
import {BROWSER_WORKSPACE_ID, mediaWorkspaceRef, type WorkspaceId, type WorkspaceRef} from "@/lib/workspace";
import {sha256Bytes} from "@/lib/sha256";

interface BinaryOwner {
    table: "media" | "materialVersions";
    rowId: Id;
    field: string;
    projectId?: Id;
    materialId?: Id;
    revision?: number;
}

interface BinarySource {
    key: string;
    owner: BinaryOwner;
    mediaId?: Id;
    filename: string;
    mimeType: string;
    blob: Blob;
}

interface ReferenceSource {
    table: string;
    rowId: Id;
    field: string;
    targetId: Id;
    target: "media" | "audioTakes" | "musicWorks" | "materialSnapshot" | "audioTakeSnapshot";
    role: "asset" | "recording" | "output" | "history";
    projectId?: Id;
    snapshotKey?: string;
}

interface FixtureIssue {
    kind: "missing-owner" | "foreign-owner" | "missing-reference" | "empty-binary" | "read-failed";
    table: string;
    rowId: Id;
    field: string;
    targetId?: Id;
}

interface BinaryEntry extends Omit<BinarySource, "blob"> {
    byteLength: number;
    contentHash?: string;
    state: "ready" | "empty" | "read-failed";
    ref?: WorkspaceRef;
}

const fixtureTables = () => [
    db.projects, db.ipProfiles, db.media, db.libraryMaterials, db.materialVersions, db.materialUses,
    db.characters, db.scenes, db.props, db.styles, db.shots, db.projectReferences,
    db.audioTakes, db.audioExports, db.musicWorks, db.audioSpeakers, db.audioClips, db.audioSegments,
    db.audioGenerationJobs, db.audioGenerationBatchItems, db.audioArrangementProposals, db.productionProposals,
    db.agentGenerationJobs, db.agentGenerationBatches, db.agentGenerationBatchItems,
];

/** Disposable read-only proof, not a checkpoint codec or a production migration. */
export async function enumerateWorkspaceBinaryFixture(workspaceId: WorkspaceId = BROWSER_WORKSPACE_ID) {
    const snapshot = await db.transaction("r", fixtureTables(), async () => {
        const [projects, ips, media, materials, versions, uses, characters, scenes, props, styles, shots,
            references, takes, exports, works, speakers, clips, segments, audioJobs, audioItems,
            arrangements, proposals, imageJobs, imageBatches, imageItems] = await Promise.all([
            db.projects.toArray(), db.ipProfiles.toArray(), db.media.toArray(), db.libraryMaterials.toArray(),
            db.materialVersions.toArray(), db.materialUses.toArray(), db.characters.toArray(), db.scenes.toArray(),
            db.props.toArray(), db.styles.toArray(), db.shots.toArray(), db.projectReferences.toArray(),
            db.audioTakes.toArray(), db.audioExports.toArray(), db.musicWorks.toArray(), db.audioSpeakers.toArray(),
            db.audioClips.toArray(), db.audioSegments.toArray(), db.audioGenerationJobs.toArray(),
            db.audioGenerationBatchItems.toArray(), db.audioArrangementProposals.toArray(), db.productionProposals.toArray(), db.agentGenerationJobs.toArray(),
            db.agentGenerationBatches.toArray(), db.agentGenerationBatchItems.toArray(),
        ]);
        const binaries: BinarySource[] = [];
        const links: ReferenceSource[] = [];
        const issues: FixtureIssue[] = [];
        const projectIds = new Set(projects.map(row => row.id));
        const ipIds = new Set(ips.map(row => row.id));
        const materialMap = new Map(materials.map(row => [row.id, row]));
        const mediaMap = new Map(media.map(row => [row.id, row]));
        const takeMap = new Map(takes.map(row => [row.id, row]));
        const workMap = new Map(works.map(row => [row.id, row]));
        const snapshotMedia = new Map<string, MediaRecord>();
        const snapshotTakes = new Map<string, {projectId: Id}>();
        const ownedProject = (id: Id) => isStudioLibrary(id) || projectIds.has(id);

        function mediaLink(table: string, rowId: Id, projectId: Id, field: string, targetId: Id, role: ReferenceSource["role"] = "asset") {
            links.push({table, rowId, projectId, field, targetId, target: "media", role});
        }
        function slotLinks(table: string, rowId: Id, projectId: Id, field: string, slot: Parameters<typeof slotMediaIds>[0]) {
            for (const id of slotMediaIds(slot)) mediaLink(table, rowId, projectId, field, id);
        }
        for (const record of media) {
            binaries.push({key: `media:${record.id}`, owner: {table: "media", rowId: record.id, field: "blob", projectId: record.projectId},
                mediaId: record.id, filename: record.filename, mimeType: record.mimeType, blob: record.blob});
            if (!ownedProject(record.projectId)) issues.push({kind: "missing-owner", table: "media", rowId: record.id, field: "projectId", targetId: record.projectId});
        }
        for (const version of versions) {
            const owner: BinaryOwner = {table: "materialVersions", rowId: version.id, field: "payload.blob", materialId: version.materialId, revision: version.revision};
            const material = materialMap.get(version.materialId);
            if (!material) issues.push({kind: "missing-owner", table: "materialVersions", rowId: version.id, field: "materialId", targetId: version.materialId});
            else if (material.scope.kind === "project" && !projectIds.has(material.scope.id) || material.scope.kind === "ip" && !ipIds.has(material.scope.id)) {
                issues.push({kind: "missing-owner", table: "libraryMaterials", rowId: material.id, field: "scope", targetId: material.scope.id});
            }
            if (version.payload.type === "file") {
                binaries.push({key: `materialVersions:${version.id}:file`, owner, filename: version.payload.filename,
                    mimeType: version.payload.mimeType, blob: version.payload.blob});
                continue;
            }
            const payload = version.payload;
            for (const record of payload.media) {
                const key = `materialVersions:${version.id}:media:${record.id}`;
                snapshotMedia.set(key, record);
                binaries.push({key, owner: {...owner, field: `payload.media.${record.id}.blob`, projectId: record.projectId},
                    mediaId: record.id, filename: record.filename, mimeType: record.mimeType, blob: record.blob});
                if (record.projectId !== payload.entity.projectId) issues.push({kind: "foreign-owner", table: "materialVersions", rowId: version.id, field: "payload.media", targetId: record.id});
            }
            for (const [field, slot] of Object.entries(payload.entity.slots)) for (const id of slotMediaIds(slot)) {
                links.push({table: "materialVersions", rowId: version.id, field: `payload.entity.slots.${field}`,
                    projectId: payload.entity.projectId, targetId: id, target: "materialSnapshot", role: "history",
                    snapshotKey: `materialVersions:${version.id}:media:${id}`});
            }
        }
        for (const project of projects) if (project.coverMediaId) mediaLink("projects", project.id, project.id, "coverMediaId", project.coverMediaId);
        for (const [table, rows] of [["characters", characters], ["scenes", scenes], ["props", props], ["styles", styles]] as const) {
            for (const row of rows) for (const [field, slot] of Object.entries(row.slots)) slotLinks(table, row.id, row.projectId, `slots.${field}`, slot);
        }
        for (const shot of shots) for (const [field, slot] of Object.entries(parseShotPictureSlots(shot as unknown as Record<string, unknown>))) {
            slotLinks("shots", shot.id, shot.projectId, field, slot);
        }
        for (const ref of references) mediaLink("projectReferences", ref.id, ref.projectId, "mediaId", ref.mediaId);
        for (const use of uses) for (const id of use.mediaIds) mediaLink("materialUses", use.id, use.projectId, "mediaIds", id, "history");
        for (const take of takes) mediaLink("audioTakes", take.id, take.projectId, "mediaId", take.mediaId, take.source === "recording" ? "recording" : "asset");
        for (const row of exports) mediaLink("audioExports", row.id, row.projectId, "mediaId", row.mediaId, "output");
        for (const row of works) mediaLink("musicWorks", row.id, row.projectId, "mediaId", row.mediaId, "output");
        for (const row of speakers) if (row.mimo?.referenceMediaId) mediaLink("audioSpeakers", row.id, row.projectId, "mimo.referenceMediaId", row.mimo.referenceMediaId);
        for (const row of clips) links.push({table: "audioClips", rowId: row.id, projectId: row.projectId, field: "takeId", targetId: row.takeId, target: "audioTakes", role: "asset"});
        for (const row of segments) if (row.selectedTakeId) links.push({table: "audioSegments", rowId: row.id, projectId: row.projectId, field: "selectedTakeId", targetId: row.selectedTakeId, target: "audioTakes", role: "asset"});
        for (const job of audioJobs) {
            if (job.input.kind === "speech" && job.input.mimo?.referenceMediaId) mediaLink("audioGenerationJobs", job.id, job.projectId, "input.mimo.referenceMediaId", job.input.mimo.referenceMediaId, "history");
            for (const result of job.results) {
                if (result.mediaId) mediaLink("audioGenerationJobs", job.id, job.projectId, `results.${result.key}.mediaId`, result.mediaId, "output");
                for (const [target, id] of [["audioTakes", result.takeId], ["musicWorks", result.workId]] as const) if (id) {
                    links.push({table: "audioGenerationJobs", rowId: job.id, projectId: job.projectId, field: `results.${result.key}.${target}`, targetId: id, target, role: "history"});
                }
            }
        }
        for (const item of audioItems) if (item.snapshot.input.mimo?.referenceMediaId) mediaLink("audioGenerationBatchItems", item.id, item.projectId, "snapshot.input.mimo.referenceMediaId", item.snapshot.input.mimo.referenceMediaId, "history");
        for (const proposal of arrangements) {
            const table = "audioArrangementProposals";
            const rowId = proposal.id;
            const projectId = proposal.projectId;
            if (!ownedProject(projectId)) issues.push({kind: "missing-owner", table, rowId, field: "projectId", targetId: projectId});
            function checkOwner(field: string, actualProjectId: Id) {
                if (actualProjectId !== projectId) issues.push({kind: "foreign-owner", table, rowId, field, targetId: actualProjectId});
            }
            function takeLink(field: string, targetId: Id) {
                links.push({table, rowId, projectId, field, targetId, target: "audioTakes", role: "history"});
            }
            function clipLinks(field: string, rows: typeof proposal.before) {
                for (const [index, clip] of rows.entries()) {
                    checkOwner(`${field}.${index}.projectId`, clip.projectId);
                    takeLink(`${field}.${index}.takeId`, clip.takeId);
                }
            }
            for (const [index, choice] of proposal.choices.entries()) takeLink(`choices.${index}.takeId`, choice.takeId);
            for (const [index, selection] of proposal.selections.entries()) {
                const field = `selections.${index}`;
                const snapshotKey = `${table}:${rowId}:${field}.take`;
                // A selection owns an embedded take snapshot, independently of
                // the current take table. Its media still belongs to this project.
                snapshotTakes.set(snapshotKey, {projectId: selection.take.projectId});
                links.push({table, rowId, projectId, field: `${field}.take.id`, targetId: selection.take.id,
                    target: "audioTakeSnapshot", role: "history", snapshotKey});
                checkOwner(`${field}.take.projectId`, selection.take.projectId);
                checkOwner(`${field}.segment.projectId`, selection.segment.projectId);
                mediaLink(table, rowId, projectId, `${field}.take.mediaId`, selection.take.mediaId, "history");
                if (selection.segment.selectedTakeId) takeLink(`${field}.segment.selectedTakeId`, selection.segment.selectedTakeId);
            }
            for (const [index, item] of proposal.items.entries()) {
                takeLink(`items.${index}.takeId`, item.takeId);
                if (item.clip) {
                    checkOwner(`items.${index}.clip.projectId`, item.clip.projectId);
                    takeLink(`items.${index}.clip.takeId`, item.clip.takeId);
                }
            }
            clipLinks("before", proposal.before);
            if (proposal.receipt) {
                checkOwner("receipt.projectId", proposal.receipt.projectId);
                for (const [index, segment] of proposal.receipt.selected.entries()) {
                    checkOwner(`receipt.selected.${index}.projectId`, segment.projectId);
                    if (segment.selectedTakeId) takeLink(`receipt.selected.${index}.selectedTakeId`, segment.selectedTakeId);
                }
                clipLinks("receipt.added", proposal.receipt.added);
                clipLinks("receipt.before", proposal.receipt.before);
                clipLinks("receipt.after", proposal.receipt.after);
            }
        }
        for (const proposal of proposals) {
            if (proposal.before.result) mediaLink("productionProposals", proposal.id, proposal.projectId, "before.result", proposal.before.result.mediaId, "history");
            if (proposal.change.kind === "slot-result") mediaLink("productionProposals", proposal.id, proposal.projectId, "change.result", proposal.change.result.mediaId, "history");
        }
        for (const job of imageJobs) {
            for (const input of job.inputs) mediaLink("agentGenerationJobs", job.id, job.projectId, "inputs", input.mediaId, "history");
            if (job.result) mediaLink("agentGenerationJobs", job.id, job.projectId, "result", job.result.mediaId, "output");
        }
        for (const batch of imageBatches) for (const application of batch.applications) {
            if (application.before) mediaLink("agentGenerationBatches", batch.id, batch.projectId, "applications.before", application.before.mediaId, "history");
            mediaLink("agentGenerationBatches", batch.id, batch.projectId, "applications.result", application.result.mediaId, "history");
        }
        for (const item of imageItems) for (const input of item.draft.inputs) mediaLink("agentGenerationBatchItems", item.id, item.projectId, "draft.inputs", input.mediaId, "history");

        const resolved = links.map(link => {
            const record = link.target === "materialSnapshot" ? snapshotMedia.get(link.snapshotKey!)
                : link.target === "audioTakeSnapshot" ? snapshotTakes.get(link.snapshotKey!)
                    : link.target === "media" ? mediaMap.get(link.targetId)
                    : link.target === "audioTakes" ? takeMap.get(link.targetId) : workMap.get(link.targetId);
            const status = !record ? "missing-reference" : record.projectId !== link.projectId ? "foreign-owner" : "resolved";
            if (status !== "resolved") issues.push({kind: status, table: link.table, rowId: link.rowId, field: link.field, targetId: link.targetId});
            return {...link, status};
        });
        // Return only selected binary metadata/references. Never carry raw jobs,
        // connectors, approval envelopes or runtime claims out of the snapshot.
        return {binaries, references: resolved, issues};
    });
    const binaries: BinaryEntry[] = [];
    for (const source of snapshot.binaries) {
        const {blob, ...metadata} = source;
        const entry: BinaryEntry = {...metadata, byteLength: blob instanceof Blob ? blob.size : 0, state: "read-failed"};
        if (source.owner.table === "media" && source.owner.projectId && source.mediaId) entry.ref = mediaWorkspaceRef(workspaceId, source.owner.projectId, source.mediaId);
        if (blob instanceof Blob && blob.size === 0) {
            entry.state = "empty";
            snapshot.issues.push({kind: "empty-binary", ...source.owner});
        } else {
            try {
                const bytes = await blob.arrayBuffer();
                if (bytes.byteLength !== blob.size) throw new Error("Fixture binary is incomplete");
                entry.contentHash = sha256Bytes(new Uint8Array(bytes));
                entry.state = "ready";
            } catch {
                snapshot.issues.push({kind: "read-failed", ...source.owner});
            }
        }
        binaries.push(entry);
    }
    return {workspaceId, binaries, references: snapshot.references, issues: snapshot.issues};
}
