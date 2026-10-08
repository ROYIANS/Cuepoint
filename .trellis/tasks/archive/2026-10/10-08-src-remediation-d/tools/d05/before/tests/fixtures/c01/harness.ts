import {db} from "@/db/database";
import {emptySlot} from "@/domain/slot";
import {createProject} from "@/db/projects";
import {addCharacter, setCharacterSlot} from "@/db/assets";
import {putMedia} from "@/db/media";
import {createAgentTask} from "@/db/agentTasks";
import {beginAgentRun, finishAgentRun} from "@/db/agentRuns";
import {getTaskWrapupState, startTaskWrapup, publishTaskWrapup, cancelTaskWrapup} from "@/db/agentTaskWrapups";
import type {AgentGenerationJob} from "@/domain/agentGeneration";
import type {AgentToolCall} from "@/domain/agent";

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function run() {
    const project = await createProject("C01 native fixture");
    const task = await createAgentTask({projectId: project.id, title: "Native evidence", goal: "Inspect current outputs", acceptanceCriteria: [], plan: []});
    const execution = await beginAgentRun({threadId: task.threadId, model: "fixture", content: "inspect", connector: {id: "fixture", name: "fixture", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture", updatedAt: project.createdAt}});
    const character = await addCharacter(project.id);
    await putMedia({id: "current-media", projectId: project.id, filename: "fixture.png", mimeType: "image/png", blob: new Blob(["nonempty fixture"], {type: "image/png"}), createdAt: project.createdAt});
    await setCharacterSlot(character.id, "front", {...emptySlot(), result: {mediaId: "current-media", kind: "image"}});
    const calls: AgentToolCall[] = [], jobs: AgentGenerationJob[] = [];
    for (let index = 0; index < 160; index++) {
        const jobId = `job-${index}`, callId = `origin-${index}`;
        calls.push({id: callId, runId: execution.id, threadId: task.threadId, providerCallId: callId, step: index + 1, order: 0, name: "submit_generation", title: "fixture generation", arguments: "{}", effect: "network", highRisk: true, status: "completed", result: JSON.stringify({jobId, status: "downloaded", result: {kind: "image", mediaId: "current-media"}}), createdAt: project.createdAt, updatedAt: project.createdAt});
        jobs.push({version: 1, id: jobId, callId, runId: execution.id, threadId: task.threadId, projectId: project.id, connectorId: "fixture", provider: "apimart", baseUrl: "https://example.test/v1", model: "fixture", kind: "image", target: {kind: "character", projectId: project.id, entityId: index % 2 ? "missing-target" : character.id, slot: "front"}, baseRevision: "fixture", sourceRevisions: [], parameters: {}, inputs: [], fingerprint: "fixture", status: "downloaded", result: {kind: "image", mediaId: "current-media"}, createdAt: project.createdAt, updatedAt: project.createdAt});
    }
    const rejected: AgentToolCall = {...calls[0], id: "rejected-query", providerCallId: "rejected-query", name: "check_generation", status: "rejected", arguments: JSON.stringify({jobId: "job-0"}), result: undefined};
    calls.push(rejected);
    await db.transaction("rw", db.agentToolCalls, db.agentGenerationJobs, async () => {
        await db.agentToolCalls.bulkAdd(calls);
        await db.agentGenerationJobs.bulkAdd(jobs);
    });
    await finishAgentRun(execution.id, "completed", {content: "fixture complete"});
    const view = await getTaskWrapupState(task.id);
    check(view.currentEvidence.filter(item => item.kind === "generation").length === 160, "native transaction lost generation evidence");
    check(view.currentEvidence.find(item => item.id === "generation:job-0")?.supportsResult, "valid current generation unavailable");
    check(!view.currentEvidence.find(item => item.id === "tool:rejected-query")?.supportsResult, "rejected query became result source");
    const draft = await startTaskWrapup(task.id, "ai");
    const sourceIds = ["tool:rejected-query"];
    let refused = false;
    try {await publishTaskWrapup(draft.id, {...draft.content, overview: "fixture", results: [{text: "invalid provenance", sourceIds}]}, new AbortController().signal);}
    catch {refused = true;}
    check(refused, "native publish accepted rejected provenance");
    check((await db.agentToolCalls.get(rejected.id))?.status === "rejected", "historical ledger changed");
    await cancelTaskWrapup(task.id, draft.id);
    await db.media.delete("current-media");
    const after = await getTaskWrapupState(task.id);
    check(after.currentEvidence.filter(item => item.kind === "generation").every(item => !item.supportsResult), "deleted media still supports result");
    return {checks: 6, generations: 160, calls: 161, nativeIndexedDB: true, provenanceRefused: refused};
}
declare global {interface Window {c01: {run: typeof run}}}
window.c01 = {run};
