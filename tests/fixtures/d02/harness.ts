import {db} from "@/db/database";
import {createProject, createAudioMusicProject} from "@/db/projects";
import {createChatThread} from "@/db/chat";
import {deleteProject, deleteChatThread} from "@/db/cascadeCommands";
import {releaseMaterialUse} from "@/db/assetReuse";
import {addShot, setShotSlot} from "@/db/shots";
import {putMedia} from "@/db/media";
import {createIpProfile} from "@/db/ipProfiles";
import {createFileMaterial, promoteMaterial, adoptMaterialInProject} from "@/db/materials";
import {beginAgentRun} from "@/db/agentRuns";
import {upsertConnector} from "@/db/connectors";
import type {AgentGenerationJob} from "@/domain/agentGeneration";

function check(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

// Compare every durable row, including actual Blob bytes, after a rejected command.
// Read outside the command transaction so this cannot keep its lifetime alive.
async function snapshot(): Promise<string> {
    const data: Record<string, unknown[]> = {};
    for (const table of db.tables) {
        const rows = await table.toArray();
        data[table.name] = await Promise.all(rows.map(async row => {
            if (row.blob instanceof Blob) return {...row, blob: {type: row.blob.type, bytes: [...new Uint8Array(await row.blob.arrayBuffer())]}};
            if (row.payload?.blob instanceof Blob) return {...row, payload: {...row.payload, blob: {type: row.payload.blob.type, bytes: [...new Uint8Array(await row.payload.blob.arrayBuffer())]}}};
            return row;
        }));
    }
    return JSON.stringify(data);
}

async function rejected(action: () => Promise<void>, message: string) {
    let error: unknown;
    try {await action();} catch (caught) {error = caught;}
    check(error instanceof Error && error.message.includes(message), `expected storage fault: ${message}`);
}

export async function runProjectCascadeBoundary() {
    const ip = await createIpProfile({name: "D02 retained IP"});
    const project = await createAudioMusicProject("D02 audio cascade", "audio", ip.id);
    const local = await createFileMaterial(new File(["independent library bytes"], "source.wav", {type: "audio/wav"}), {kind: "project", id: project.id});
    const shared = await promoteMaterial(local.id, {kind: "ip", id: ip.id});
    const use = await adoptMaterialInProject(shared.id, project.id);
    const before = await snapshot();
    let lateFault = false, deletedChildren = false;
    const originalDelete = db.projects.delete;
    db.projects.delete = async function (key) {
        if (key === project.id) {
            deletedChildren = await db.audioChapters.where("projectId").equals(project.id).count() === 0 && !await db.materialUses.get(use.id) && !await db.media.get(use.targetId) && (await db.libraryMaterials.get(local.id))?.archived === true;
            check(deletedChildren, "parent fault was reached before actual child/material changes");
        }
        return originalDelete.call(db.projects, key);
    };
    const fail = function () {
        lateFault = true;
        // This is the final parent delete; earlier child/material writes are real.
        throw new Error("D02 late project delete fault");
    };
    db.projects.hook("deleting", fail);
    try {await rejected(() => deleteProject(project.id), "D02 late project delete fault");}
    finally {db.projects.hook("deleting").unsubscribe(fail); db.projects.delete = originalDelete;}
    check(lateFault && deletedChildren && await snapshot() === before, "project cascade did not restore all rows and media bytes");
    await deleteProject(project.id);
    check(!await db.projects.get(project.id), "project survived successful cascade");
    check(await db.audioChapters.where("projectId").equals(project.id).count() === 0, "audio chapter survived cascade");
    check(await db.audioTracks.where("projectId").equals(project.id).count() === 0, "audio track survived cascade");
    check(!await db.projectIpLinks.get(project.id) && !await db.materialUses.get(use.id) && !await db.media.get(use.targetId), "project bindings or copied media survived cascade");
    check((await db.libraryMaterials.get(local.id))?.archived === true, "owned library snapshot was not archived");
    check((await db.libraryMaterials.get(shared.id))?.archived === false && await db.ipProfiles.get(ip.id), "shared IP/library source was changed");
    const versions = await db.materialVersions.where("materialId").equals(shared.id).toArray();
    check(versions.length === 1 && versions[0].payload.type === "file" && await versions[0].payload.blob.text() === "independent library bytes", "immutable library bytes were not retained");
    return {lateFault, deletedChildren, rollback: "all durable rows and Blob bytes equal", success: "audio children and bindings deleted; IP and immutable material retained"};
}

export async function runThreadCascadeBoundary() {
    const project = await createProject("D02 thread retention");
    const episode = await db.episodes.where("projectId").equals(project.id).first();
    check(episode, "missing episode");
    const shot = await addShot(project.id, episode.id);
    const material = await createFileMaterial(new File(["material source"], "retained.png", {type: "image/png"}), {kind: "global"});
    const use = await adoptMaterialInProject(material.id, project.id);
    const selected = `${project.id}-selected`, orphan = `${project.id}-orphan`;
    for (const id of [selected, orphan]) await putMedia({id, projectId: project.id, filename: `${id}.png`, mimeType: "image/png", blob: new Blob([id], {type: "image/png"}), createdAt: project.createdAt});
    await setShotSlot(shot.id, "firstFrame", {prompt: "selected", referenceImageIds: [], referenceVideoIds: [], result: {mediaId: selected, kind: "image"}});
    const thread = await createChatThread({projectId: project.id});
    const connector = await upsertConnector({definitionId: "aihubmix", protocol: "openai-compatible", baseUrl: "https://fixture.test/v1", apiKey: "fixture"});
    const run = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "local synthetic history"});
    // Synthetic downloaded histories avoid any provider operation. Deletion still
    // executes the public command and its actual retention/cleanup transactions.
    const job = (id: string, mediaId: string): AgentGenerationJob => ({version: 1, id, callId: `${id}-call`, runId: run.id, threadId: thread.id, projectId: project.id,
        connectorId: connector.id, provider: "aihubmix", baseUrl: connector.baseUrl, model: "fixture", kind: "image",
        target: {kind: "shot", projectId: project.id, episodeId: episode.id, entityId: shot.id, slot: "firstFrame"}, baseRevision: "fixture", sourceRevisions: [], parameters: {},
        inputs: [{role: "reference-image", mediaId: use.targetId, revision: "fixture"}], fingerprint: id, status: "downloaded", result: {mediaId, kind: "image"}, createdAt: project.createdAt, updatedAt: project.createdAt});
    await db.agentGenerationJobs.bulkAdd([job(`${thread.id}-selected`, selected), job(`${thread.id}-orphan`, orphan)]);
    const before = await snapshot();
    let lateFault = false, deletedHistories = false;
    const originalDelete = db.media.delete;
    db.media.delete = async function (key) {
        if (key === orphan) {
            deletedHistories = await db.agentGenerationJobs.where("threadId").equals(thread.id).count() === 0 && !await db.chatThreads.get(thread.id);
            check(deletedHistories, "cleanup fault was reached before actual history/chat deletion");
        }
        return originalDelete.call(db.media, key);
    };
    const fail = function (_key: unknown, row: {id: string}) {
        if (row.id !== orphan) return;
        lateFault = true;
        throw new Error("D02 orphan cleanup fault");
    };
    db.media.hook("deleting", fail);
    try {await rejected(() => deleteChatThread(thread.id), "D02 orphan cleanup fault");}
    finally {db.media.hook("deleting").unsubscribe(fail); db.media.delete = originalDelete;}
    check(lateFault && deletedHistories && await snapshot() === before, "thread cascade did not restore all history, production rows and bytes");
    await deleteChatThread(thread.id);
    check(!await db.chatThreads.get(thread.id) && await db.chatMessages.where("threadId").equals(thread.id).count() === 0 && !await db.agentRuns.get(run.id), "chat/run rows survived successful cascade");
    check(await db.agentGenerationJobs.where("threadId").equals(thread.id).count() === 0, "generation history survived successful cascade");
    check(!await db.media.get(orphan), "orphan result survived successful cascade");
    check((await db.shots.get(shot.id))?.firstFrame.result?.mediaId === selected && await db.media.get(selected), "production-selected media was deleted");
    check(await db.materialUses.get(use.id) && (await db.media.get(use.targetId))?.libraryRetained, "material-retained input was deleted");
    return {lateFault, deletedHistories, rollback: "all durable rows and Blob bytes equal", success: "thread history and orphan removed; selected result and material input retained"};
}

export async function runMaterialReleaseBoundary() {
    const project = await createProject("D02 release rollback");
    const material = await createFileMaterial(new File(["source bytes"], "source.png", {type: "image/png"}), {kind: "global"});
    const use = await adoptMaterialInProject(material.id, project.id);
    const before = await snapshot();
    let lateFault = false, deletedCopy = false;
    const originalAdd = db.materialEvents.add;
    db.materialEvents.add = async function (row, key) {
        if (row.action === "release") {
            deletedCopy = !await db.materialUses.get(use.id) && !await db.media.get(use.targetId);
            check(deletedCopy, "release fault was reached before actual binding/media deletion");
        }
        return originalAdd.call(db.materialEvents, row, key);
    };
    const fail = function (_key: unknown, row: {action: string}) {
        if (row.action !== "release") return;
        lateFault = true;
        throw new Error("D02 release event fault");
    };
    db.materialEvents.hook("creating", fail);
    try {await rejected(() => releaseMaterialUse(use.id), "D02 release event fault");}
    finally {db.materialEvents.hook("creating").unsubscribe(fail); db.materialEvents.add = originalAdd;}
    check(lateFault && deletedCopy && await snapshot() === before, "release did not restore binding, retained flag, deleted media and events");
    await releaseMaterialUse(use.id);
    check(!await db.materialUses.get(use.id) && !await db.media.get(use.targetId), "unused material copy survived release");
    check(await db.libraryMaterials.get(material.id) && await db.materialVersions.where("materialId").equals(material.id).count() === 1, "material source snapshot was deleted");
    return {lateFault, deletedCopy, rollback: "all durable rows and Blob bytes equal", success: "unused copy released; immutable source retained"};
}
