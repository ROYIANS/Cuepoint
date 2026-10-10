import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {createChatThread} from "@/db/chat";
import {beginAgentRun, checkpointAgentRun, finishAgentRun, interruptThreadRuns} from "@/db/agentRuns";
import {beginAgentFinalReview, finishAgentFinalReview} from "@/db/agentFinalReview";
import {executeChatRun} from "@/lib/agent/runChat";
import {reviewFinalReply} from "@/lib/agent/runFinalReview";
import {finalReviewMessages, parseFinalReview} from "@/lib/agent/finalReview";
import {collectFinalReviewSnapshot, finalReviewTables} from "@/lib/agent/finalReviewEvidence";
import {createAudioMusicProject} from "@/db/projects";
import {addMusicWork} from "@/db/music";
import {defaultMusicSettings} from "@/domain/music";
import {targetRevision} from "@/lib/productionRevision";
import type {AgentResponseItem, AgentRun, AgentToolCall, AgentWireToolCall} from "@/domain/agent";
import type {FinalReviewSnapshot} from "@/domain/agentFinalReview";
import type {AudioGenerationJob} from "@/domain/audioGeneration";

const connector = {id: "review-test", definitionId: "openai-compatible" as const, baseUrl: "https://fixture.invalid/v1", apiKey: "fixture-secret", updatedAt: "2026-10-10"};
const candidate = {content: "这是建议，暂不写入。", reasoning: "公开思考", reasoningDurationMs: 5};
const envelope = (content: string, reasoning = ""): AgentResponseItem[] => [
    ...(reasoning ? [{type: "reasoning", id: "reasoning", summary: [{type: "summary_text", text: reasoning}], encrypted_content: "opaque-private-reasoning"}] : []),
    {type: "message", role: "assistant", id: "final", status: "completed", content: [{type: "output_text", text: content, annotations: []}]}
];
function reply(protocol: AgentRun["protocol"], content: string, calls: AgentWireToolCall[] = [], reasoning = "") {
    const usage = {input_tokens: 10, output_tokens: 3, total_tokens: 13};
    return protocol === "responses" ? Response.json({id: "fixture", status: "completed", usage, output: [
        ...envelope(content, reasoning), ...calls.map(call => ({type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments, status: "completed"}))
    ]}) : Response.json({usage: {prompt_tokens: 10, completion_tokens: 3, total_tokens: 13}, choices: [{message: {content, reasoning_content: reasoning,
        ...(calls.length ? {tool_calls: calls} : {})}, finish_reason: calls.length ? "tool_calls" : "stop"}]});
}
async function begin(protocol: AgentRun["protocol"] = "chat-completions", patch: Partial<AgentRun> = {}) {
    const thread = await createChatThread();
    const initial = await beginAgentRun({threadId: thread.id, connector, model: protocol === "responses" ? "gpt-5.6-luna" : "fixture", content: "给我建议"});
    const run: AgentRun = {...initial, permissionMode: "full", enabledToolNames: ["workspace_overview", "project_create"], toolLoading: undefined, ...patch};
    await db.agentRuns.put(run);
    return run;
}
async function pending() {
    const run = await begin("chat-completions", {modelStep: 2});
    await checkpointAgentRun(run.id, 1, candidate);
    return (await beginAgentFinalReview(run.id, 2, candidate, new AbortController().signal))!;
}
afterEach(() => {vi.restoreAllMocks(); vi.useRealTimers();});

describe("bounded final reply requests", () => {
    it.each(["chat-completions", "responses"] as const)("keeps advice original and performs only one finishing + one zero-tool %s review", async protocol => {
        const run = await begin(protocol), original = structuredClone(run.requestMessages);
        const requests: Record<string, unknown>[] = [];
        const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
            const body = JSON.parse(String(init?.body)); requests.push(body);
            if (requests.length < 3) return reply(protocol, candidate.content, [], candidate.reasoning);
            expect(body.tools).toBeUndefined();
            expect(body.model).toBe(run.model);
            expect(String(init?.body)).not.toContain("opaque-private-reasoning");
            expect(String(init?.body)).not.toContain(connector.apiKey);
            return reply(protocol, '{"claims":[]}');
        });
        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
        const saved = (await db.agentRuns.get(run.id))!;
        expect(saved.status, saved.error).toBe("completed");
        expect(saved).toMatchObject({modelStep: 3, finishingCheck: {step: 1, reason: "terminal_reply"}, finalReview: {status: "checked", step: 3, claims: []}});
        expect(saved.requestMessages).toEqual(original);
        expect(saved.modelMetrics?.map(item => item.purpose)).toEqual([undefined, undefined, "final_review"]);
        expect(saved.usage?.totalTokens).toBe(39);
        expect((await db.chatMessages.get(run.assistantMessageId))?.content).toBe(candidate.content);
        expect(saved.activitySteps).toHaveLength(1);
        expect(await db.agentToolCalls.count()).toBe(0);
        expect(fetcher).toHaveBeenCalledTimes(3);
        if (protocol === "responses") {
            expect(saved.responseItems?.slice(-2)).toEqual(envelope(candidate.content, candidate.reasoning));
            expect(JSON.stringify(saved.activitySteps)).not.toContain("opaque-private-reasoning");
        }
    });

    it.each(["chat-completions", "responses"] as const)("continues a no-plan promise to a real saved action with %s", async protocol => {
        const run = await begin(protocol);
        const calls: AgentWireToolCall[] = [{id: "project", type: "function", function: {name: "project_create", arguments: JSON.stringify({name: "真实项目", continueInProject: false})}}];
        let round = 0;
        const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
            round++;
            if (round === 1) return reply(protocol, "我会创建项目。");
            if (round === 2) {expect(String(init?.body)).toContain("本轮结束前检查"); return reply(protocol, "开始创建", calls);}
            if (round === 3) return reply(protocol, "已保存项目。其他内容未完成。");
            const body = JSON.parse(String(init?.body));
            expect(body.tools).toBeUndefined();
            expect(JSON.stringify(body)).toContain('write');
            return reply(protocol, '{"claims":[]}');
        });
        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
        expect(await db.projects.count()).toBe(1);
        expect(await db.agentToolCalls.count()).toBe(1);
        expect((await db.agentRuns.get(run.id))?.finalReview?.status).toBe("checked");
        expect(fetcher).toHaveBeenCalledTimes(4);
    });

    it.each(["请暂停，这轮不操作。", "请先补充缺少的名称。"])("allows a genuine pause/input reply after the once-only check: %s", async content => {
        const run = await begin(); let round = 0;
        const fetcher = vi.fn<typeof fetch>(async () => reply(run.protocol, ++round < 3 ? content : '{"claims":[]}'));
        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
        expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
        expect(await db.projects.count()).toBe(0); expect(await db.agentToolCalls.count()).toBe(0);
        expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it.each(["conversation", "no tools", "budget"])("records an unverified skipped outcome for %s", async kind => {
        const run = await begin("chat-completions", {modelStep: kind === "budget" ? 31 : 0,
            ...(kind === "conversation" ? {interactionMode: "conversation"} : kind === "no tools" ? {enabledToolNames: []} : {})});
        const fetcher = vi.fn<typeof fetch>(async () => reply(run.protocol, candidate.content));
        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
        const saved = (await db.agentRuns.get(run.id))!;
        expect(saved.status).toBe("completed");
        expect(saved.finalReview).toMatchObject({status: "unverified", reason: kind === "budget" ? "budget" : "ineligible"});
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it("Stop interrupts the checker without changing the public reply or issuing further calls", async () => {
        const run = await begin(), controller = new AbortController(); let round = 0;
        const fetcher = vi.fn<typeof fetch>(async () => {
            if (++round < 3) return reply(run.protocol, candidate.content);
            controller.abort(); return new Promise<Response>(() => undefined);
        });
        await executeChatRun(run, connector.apiKey, controller, fetcher);
        const saved = (await db.agentRuns.get(run.id))!;
        expect(saved.status).toBe("cancelled"); expect(saved.finalReview).toMatchObject({status: "unverified", reason: "stopped"});
        expect((await db.chatMessages.get(run.assistantMessageId))?.content).toBe(candidate.content);
        expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it("a timeout stays unverified even when a mock transport ignores abort", async () => {
        const run = await begin("chat-completions", {modelStep: 2});
        await checkpointAgentRun(run.id, 1, candidate);
        const real = globalThis.setTimeout;
        vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, delay, ...args) => real(fn, delay === 30_000 ? 5 : delay, ...args));
        const fetcher = vi.fn<typeof fetch>(async () => new Promise<Response>(() => undefined));
        await reviewFinalReply(run.id, 2, candidate, connector.apiKey, new AbortController().signal, fetcher);
        expect((await db.agentRuns.get(run.id))?.finalReview).toMatchObject({status: "unverified", reason: "timeout"});
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it.each(["invalid", "tool"])("keeps %s checker output unverified without executing it", async kind => {
        const run = await begin("chat-completions", {modelStep: 2}); await checkpointAgentRun(run.id, 1, candidate);
        const call: AgentWireToolCall = {id: "bad", type: "function", function: {name: "project_create", arguments: '{}'}};
        await reviewFinalReply(run.id, 2, candidate, connector.apiKey, new AbortController().signal,
            async () => reply(run.protocol, kind === "invalid" ? 'not json' : '', kind === "tool" ? [call] : []));
        expect((await db.agentRuns.get(run.id))?.finalReview?.status).toBe("unverified");
        expect(await db.projects.count()).toBe(0); expect(await db.agentToolCalls.count()).toBe(0);
    });
});

describe("durable checker ownership", () => {
    it("preserves a later final Responses envelope after interruption without repeating the review", async () => {
        const run = await begin("responses", {modelStep: 2});
        await checkpointAgentRun(run.id, 1, candidate);
        const first = await beginAgentFinalReview(run.id, 2, candidate, new AbortController().signal, envelope(candidate.content, candidate.reasoning));
        expect(first?.finalReview?.status).toBe("pending");
        await finishAgentRun(run.id, "interrupted", candidate);
        await db.agentRuns.update(run.id, {status: "running", modelStep: 4});
        const next = {content: "继续后保存的新回复。", reasoning: "新公开思考", reasoningDurationMs: 2};
        await checkpointAgentRun(run.id, 2, next);
        const fetcher = vi.fn<typeof fetch>();
        await reviewFinalReply(run.id, 4, next, connector.apiKey, new AbortController().signal, fetcher, envelope(next.content, next.reasoning));
        await reviewFinalReply(run.id, 4, next, connector.apiKey, new AbortController().signal, fetcher, envelope(next.content, next.reasoning));
        const saved = (await db.agentRuns.get(run.id))!;
        expect(fetcher).not.toHaveBeenCalled();
        expect(saved.finalReview).toMatchObject({status: "unverified", candidateStep: 2});
        expect(saved.responseItems?.slice(-2)).toEqual(envelope(next.content, next.reasoning));
        expect(saved.responseItems?.filter(item => item.type === "message" && JSON.stringify(item.content).includes(next.content))).toHaveLength(1);
        expect(saved.finalResponseStep).toBe(4);
    });
    it("claims only once, survives reload, and never resubmits a pending record", async () => {
        const run = await begin("chat-completions", {modelStep: 2}); await checkpointAgentRun(run.id, 1, candidate);
        const claimed = await Promise.all([beginAgentFinalReview(run.id, 2, candidate, new AbortController().signal), beginAgentFinalReview(run.id, 2, candidate, new AbortController().signal)]);
        expect(claimed.filter(Boolean)).toHaveLength(1);
        db.close(); await db.open();
        const fetcher = vi.fn<typeof fetch>();
        await reviewFinalReply(run.id, 2, candidate, connector.apiKey, new AbortController().signal, fetcher);
        expect(fetcher).not.toHaveBeenCalled();
        await interruptThreadRuns(run.threadId);
        expect((await db.agentRuns.get(run.id))?.finalReview).toMatchObject({status: "unverified", reason: "interrupted"});
    });

    it.each(["content", "thread", "new user", "ledger"])("marks a completed check stale after %s changes", async kind => {
        const run = await pending(), review = run.finalReview!;
        if (kind === "content") await db.chatMessages.update(run.assistantMessageId, {content: "changed"});
        if (kind === "thread") await db.chatThreads.update(run.threadId, {projectId: "foreign"});
        if (kind === "new user") await db.chatMessages.add({id: "later", threadId: run.threadId, role: "user", content: "later", createdAt: "2099-01-01"});
        if (kind === "ledger") await db.agentToolCalls.add({id: "foreign-ledger", runId: run.id, threadId: run.threadId, providerCallId: "later", step: 1, order: 0, name: "workspace_overview", title: "read", effect: "read", status: "completed", highRisk: false, arguments: '{}', result: '{}', createdAt: run.createdAt, updatedAt: run.createdAt});
        await finishAgentFinalReview(run.id, review.candidateFingerprint, []);
        expect((await db.agentRuns.get(run.id))?.finalReview).toMatchObject({status: "unverified", reason: "stale"});
    });

    it("does not resurrect a deleted run", async () => {
        const run = await pending(); await db.agentRuns.delete(run.id);
        await finishAgentFinalReview(run.id, run.finalReview!.candidateFingerprint, []);
        expect(await db.agentRuns.get(run.id)).toBeUndefined();
    });

    it.each(["context", "content"])("does not reserve a request when the %s limit skips review", async kind => {
        const run = await begin("chat-completions", {modelStep: 2});
        const output = kind === "content" ? {...candidate, content: "超出长度".repeat(9000)} : candidate;
        if (kind === "context") await db.agentRuns.update(run.id, {context: {...run.context!, capacity: 256}});
        await checkpointAgentRun(run.id, 1, output);
        const fetcher = vi.fn<typeof fetch>();
        await reviewFinalReply(run.id, 2, output, connector.apiKey, new AbortController().signal, fetcher);
        expect(fetcher).not.toHaveBeenCalled();
        expect((await db.agentRuns.get(run.id))?.modelStep).toBe(2);
        expect((await db.agentRuns.get(run.id))?.finalReview?.reason).toBe(kind === "context" ? "context_limit" : "content_limit");
    });

    it("preserves pending approvals and unknown effects without making checker requests", async () => {
        const run = await begin("chat-completions", {modelStep: 2}); await checkpointAgentRun(run.id, 1, candidate);
        const call: AgentToolCall = {id: "waiting", runId: run.id, threadId: run.threadId, providerCallId: "waiting", step: 1, order: 0, name: "project_create", title: "write", effect: "write", status: "awaiting_approval", highRisk: true, arguments: '{}', createdAt: run.createdAt, updatedAt: run.createdAt};
        await db.agentToolCalls.add(call);
        const fetcher = vi.fn<typeof fetch>();
        await reviewFinalReply(run.id, 2, candidate, connector.apiKey, new AbortController().signal, fetcher);
        expect(fetcher).not.toHaveBeenCalled(); expect(await db.agentToolCalls.get(call.id)).toEqual(call);
        expect((await db.agentRuns.get(run.id))?.finalReview?.reason).toBe("ineligible");
    });
});

describe("claim schema and structural predicate limits", () => {
    const snapshot: FinalReviewSnapshot = {fingerprint: "fixture", evidence: [
        {ref: "w0", kind: "write", callId: "call", entityKind: "project", operation: "created", id: "p1", ownerId: "p1", revision: 1},
        {ref: "o1", kind: "output", callId: "sound", jobId: "j1", resultKey: "partial", available: true, selected: false, placed: false, fingerprint: "current"}
    ], omitted: 2, uncoveredWriteCalls: 1, unresolvedCalls: 0};
    const content = "项目p1已创建。整批音乐完成且已试听。";
    const claim = {start: 0, end: 8, text: content.slice(0, 8), assessment: "consistent", refs: ["w0"],
        predicate: {type: "historical_write", ref: "w0", entityKind: "project", operation: "created", id: "p1", revision: 1}};
    it("code verifies only exact historical predicate; remaining mixed prose is model-assessed/unknown", () => {
        const result = parseFinalReview(JSON.stringify({claims: [claim, {start: 8, end: content.length, text: content.slice(8), assessment: "consistent", refs: []}]}), content, snapshot);
        expect(result[0]).toMatchObject({assessment: "consistent", predicateResult: "verified"});
        expect(result[1]).toMatchObject({assessment: "unknown"}); expect(result[1].predicateResult).toBeUndefined();
        expect(parseFinalReview(JSON.stringify({claims: [{...claim, predicate: {...claim.predicate, id: "wrong"}}]}), content, snapshot)[0].predicateResult).toBe("contradicted");
    });
    it.each(["source", "span", "text", "extra", "generic supported", "unlisted predicate source"])("rejects invalid %s without accepting model certification", kind => {
        const invalid = {...claim, ...(kind === "source" ? {refs: ["invented"]} : kind === "span" ? {end: 9} : kind === "text" ? {text: "rewritten"}
            : kind === "extra" ? {secret: "hidden"} : kind === "generic supported" ? {supported: true} : {predicate: {...claim.predicate, ref: "o1"}})};
        expect(() => parseFinalReview(JSON.stringify({claims: [invalid]}), content, snapshot)).toThrow();
    });
    it("cannot promote a partial output observation to batch or audition certification", () => {
        const value = {start: 8, end: content.length, text: content.slice(8), assessment: "unknown", refs: ["o1"],
            predicate: {type: "output_selected", ref: "o1", value: true}};
        expect(parseFinalReview(JSON.stringify({claims: [value]}), content, snapshot)[0]).toMatchObject({assessment: "unknown", predicateResult: "contradicted"});
        expect(finalReviewMessages(content, snapshot)[0].content).toContain("不能证明试听");
    });
});

describe("safe current output observations", () => {
    it("retains original submission provenance and individual partial output, invalidating on current media deletion", async () => {
        const project = await createAudioMusicProject("private-title", "music");
        const thread = await createChatThread({projectId: project.id});
        const run = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "生成"});
        const provenance = {provider: "apimart" as const, model: "fixture", jobId: "job", taskId: "task"};
        const media = {id: "media", projectId: project.id, filename: "private-filename", mimeType: "audio/wav", blob: new Blob(["decoded audio"])};
        const work = await addMusicWork(project.id, {mediaId: media.id, title: "private-song", lyrics: "private-lyrics", notes: "private-note", favorite: false,
            durationSec: 3, sampleRate: 24000, channels: 1, provenance}, media);
        const job: AudioGenerationJob = {id: "job", projectId: project.id, revision: 1, intentId: "submission", input: {kind: "music", settings: defaultMusicSettings()},
            connector: {id: "sound", provider: "apimart", baseUrl: "https://private-connector.invalid"}, source: {kind: "agent", runId: run.id, callId: "submission"}, status: "running", taskIds: ["task"],
            results: [{key: "good", provenance, title: "private-result", mediaId: media.id, workId: work.id}, {key: "pending", provenance, title: "pending"}], createdAt: run.createdAt, updatedAt: run.createdAt};
        await db.audioGenerationJobs.add(job);
        await db.agentToolCalls.add({id: "submission", runId: run.id, threadId: run.threadId, providerCallId: "wire", step: 1, order: 0, name: "music_generate", title: "private-tool",
            arguments: JSON.stringify({projectId: project.id, privateText: "private-arguments"}), effect: "network", highRisk: false, status: "completed", decision: "approve", requiresConfirmation: true,
            result: JSON.stringify({id: job.id, privatePayload: "private-result-json"}), createdAt: run.createdAt, updatedAt: run.createdAt});
        const snapshot = await db.transaction("r", finalReviewTables(), () => collectFinalReviewSnapshot(run));
        expect(snapshot.evidence).toContainEqual(expect.objectContaining({kind: "output", resultKey: "good", available: true, selected: false, placed: false, callId: "submission"}));
        expect(snapshot.evidence).toContainEqual(expect.objectContaining({resultKey: "pending", available: false}));
        expect(JSON.stringify(snapshot)).not.toContain("private-");
        await db.media.delete(media.id);
        const changed = await db.transaction("r", finalReviewTables(), () => collectFinalReviewSnapshot(run));
        expect(changed.fingerprint).not.toBe(snapshot.fingerprint);
        expect(changed.evidence).toContainEqual(expect.objectContaining({resultKey: "good", available: false}));
        await db.audioGenerationJobs.update(job.id, {source: {kind: "agent", runId: "old-run", callId: "submission"}});
        expect((await db.transaction("r", finalReviewTables(), () => collectFinalReviewSnapshot(run))).evidence).toEqual([]);
        expect(targetRevision(snapshot)).not.toBe(targetRevision(changed));
    });
});
