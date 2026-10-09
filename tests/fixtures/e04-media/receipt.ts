import Dexie from "dexie";
import {db} from "@/db/database";
import {addShot} from "@/db/shots";
import {createProject} from "@/db/projects";
import {createChatThread} from "@/db/chat";
import {beginAgentRun} from "@/db/agentRuns";
import {BUILTIN_TOOLS, type AgentToolContext} from "@/lib/agent/tools";
import type {AgentToolCall} from "@/domain/agent";
import {readWriteReceipt} from "@/lib/agent/writeReceipt";
import {check, media, at, slot} from "./seeds";
import {snapshot, rejects} from "./commands";

async function toolDeletionLedgerRollback(name: "media_delete_orphan" | "shot_delete") {
    const project = await createProject("E04 orphan receipt"), id = "receipt-orphan";
    const ids = name === "shot_delete" ? [id, `${id}-2`, `${id}-3`] : [id];
    await db.media.bulkPut(ids.map(id => media(id, project.id)));
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const shot = name === "shot_delete" ? await addShot(project.id, episode.id) : undefined;
    if (shot) await db.shots.update(shot.id, {firstFrame: slot(ids)});
    const thread = await createChatThread(), connector = {id: "fixture", definitionId: "openai-compatible" as const, protocol: "openai-compatible" as const, baseUrl: "https://fixture.invalid/v1", apiKey: "not-real", updatedAt: at};
    const initial = await beginAgentRun({threadId: thread.id, connector, model: "fixture-model", content: "local media cleanup"});
    await db.agentRuns.update(initial.id, {permissionMode: "full", toolLoading: undefined});
    const definition = BUILTIN_TOOLS.find(tool => tool.name === name)!;
    const raw = {ownerId: project.id, id: shot?.id ?? id, ...(shot ? {episodeId: episode.id} : {})}, args = definition.parseArguments(raw);
    const context: AgentToolContext = {runId: initial.id, threadId: thread.id, callId: "cleanup-call", signal: new AbortController().signal};
    context.preview = await definition.prepare?.(args, context);
    const call: AgentToolCall = {id: context.callId, runId: initial.id, threadId: thread.id, providerCallId: context.callId, step: 1, order: 0, name: definition.name, title: definition.title, arguments: JSON.stringify(raw), effect: definition.effect, highRisk: definition.highRisk(args), atomic: definition.atomic, preview: context.preview, status: "running", createdAt: at, updatedAt: at};
    await db.agentToolCalls.add(call); const before = await snapshot();
    const original = db.agentToolCalls.update; let deleted = false, receiptCreated = false;
    const mutationRoots: IDBTransaction[] = [];
    const originalDelete = db.media.delete;
    db.media.delete = function(key) { if (Dexie.currentTransaction) mutationRoots.push(Dexie.currentTransaction.idbtrans); return originalDelete.call(db.media, key); };
    db.agentToolCalls.update = function(key, changes) {
        return Dexie.Promise.resolve().then(async () => {
            if (key === context.callId && typeof changes !== "function" && changes.status === "completed") {
                check(Dexie.currentTransaction && mutationRoots.every(root => root === Dexie.currentTransaction!.idbtrans), `ledger and media must share native root: ${JSON.stringify({hasLedger: !!Dexie.currentTransaction, ledgerStores: Dexie.currentTransaction?.storeNames, mutationStores: mutationRoots.map(root => Array.from(root.objectStoreNames))})}`);
                deleted = (await db.media.bulkGet(ids)).every(row => row === undefined);
                const result = typeof changes.result === "string" ? JSON.parse(changes.result) : undefined;
                receiptCreated = !!readWriteReceipt(result?.writeReceipt);
                check(deleted && result?.deletedId === raw.id && (name === "shot_delete" ? receiptCreated : !receiptCreated), "ledger fault follows actual deletion and contracted tool outcome");
                throw new Error("E04 receipt ledger fault");
            }
            return original.call(db.agentToolCalls, key, changes);
        });
    };
    try {await rejects(() => definition.execute(args, context), "E04 receipt ledger fault");}
    finally {db.agentToolCalls.update = original; db.media.delete = originalDelete;}
    const after = await snapshot();
    const beforeRows = JSON.parse(before), afterRows = JSON.parse(after);
    const differences = Object.keys(beforeRows).filter(table => JSON.stringify(beforeRows[table]) !== JSON.stringify(afterRows[table])).map(table => ({table, before: beforeRows[table], after: afterRows[table]}));
    check(deleted && after === before, `media Blob/call/receipt rollback: ${JSON.stringify(differences)}`);
    const returned = await definition.execute(args, context) as {writeReceipt?: unknown};
    check((name === "shot_delete" ? !!readWriteReceipt(returned.writeReceipt) : !readWriteReceipt(returned.writeReceipt)) && !await db.media.get(id), "retry commits deletion and contracted result/receipt");
    const replay = await definition.execute(args, context);
    check(JSON.stringify(replay) === JSON.stringify(returned), "receipt exact replay");
    return {name, mediaCount: ids.length, deleted, receiptCreatedBeforeFailure: receiptCreated, rollback: true, retry: true, replay: true};
}

export const orphanReceiptRollback = () => toolDeletionLedgerRollback("media_delete_orphan");
export const shotReceiptRollback = () => toolDeletionLedgerRollback("shot_delete");
