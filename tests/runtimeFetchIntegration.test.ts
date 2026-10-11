import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {requestOnce} from "@/lib/ai/requestBoundary";
import {listConnectorModels, testConnectorConnection} from "@/lib/ai/connectors";
import {streamChatCompletions} from "@/lib/ai/chatStream";
import {streamResponses} from "@/lib/ai/responsesStream";
import {downloadApimartAudio} from "@/lib/ai/apimartAudio";
import {testSearchConnection} from "@/lib/ai/tavily";
import {createProject} from "@/db/projects";
import {addShot} from "@/db/shots";
import {createChatThread} from "@/db/chat";
import {beginAgentRun} from "@/db/agentRuns";
import {transitionToolCall} from "@/db/agentTools";
import {submitAgentGeneration} from "@/lib/agent/generationRuntime";
import {saveFixtureToolRound} from "./helpers/toolDispatch";
import type {GenerationSubmitArgs} from "@/lib/agent/generationProfiles";

const {nativeFetch} = vi.hoisted(() => ({nativeFetch: vi.fn()}));
vi.mock("@tauri-apps/plugin-http", () => ({fetch: nativeFetch}));

const connector = {definitionId: "openai-compatible" as const, baseUrl: "http://127.0.0.1:4321/v1", apiKey: "local-fixture-key"};
let invoke: ReturnType<typeof vi.fn>;
let webFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
    invoke = vi.fn(async (_command: string, args: {origin: string}) => ({origin: args.origin}));
    webFetch = vi.fn().mockRejectedValue(new Error("Unexpected WebView remote fetch"));
    vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke}});
    vi.stubGlobal("fetch", webFetch);
    nativeFetch.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

async function configure() {
    await db.connectors.put({...connector, id: "local", protocol: "openai-compatible", updatedAt: "now"});
}

describe("existing provider default paths select shared native transport", () => {
    it("preserves explicit injected fetch precedence and original response/wire even in Tauri", async () => {
        const response = Response.json({ok: true});
        const injected = vi.fn<typeof fetch>().mockResolvedValue(response);
        expect(await requestOnce("https://unconfigured.example/submit", {method: "POST", body: "{}"}, {fetchImpl: injected, credentials: "omit", redirect: "error"})).toBe(response);
        expect(injected).toHaveBeenCalledOnce();
        expect(invoke).not.toHaveBeenCalled();
        expect(nativeFetch).not.toHaveBeenCalled();
        expect(webFetch).not.toHaveBeenCalled();
    });

    it("supports unsaved connector discovery/test through a local draft scope and does not expose a normal configured grant", async () => {
        nativeFetch.mockImplementation(async () => Response.json({data: [{id: "fixture-model"}]}));
        expect(await listConnectorModels(connector)).toMatchObject({ok: true, models: ["fixture-model"]});
        expect(await testConnectorConnection(connector)).toMatchObject({ok: true, via: "models", modelCount: 1});
        expect(nativeFetch).toHaveBeenCalledTimes(2);
        expect(invoke).toHaveBeenCalledWith("authorize_http_origin", {origin: "http://127.0.0.1:4321", allowHttp: true});
        await expect(requestOnce(`${connector.baseUrl}/models`, {}, {credentials: "omit", redirect: "error"})).rejects.toThrow("当前连接配置");
        expect(nativeFetch).toHaveBeenCalledTimes(2);
        expect(webFetch).not.toHaveBeenCalled();
    });

    it("feeds default native Chat and Responses streams into their existing shared parsers", async () => {
        await configure();
        const input = {...connector, connectorDefinitionId: connector.definitionId, model: "fixture-model", messages: [{role: "user" as const, content: "fixture"}]};
        nativeFetch.mockResolvedValueOnce(new Response([
            'data: {"choices":[{"delta":{"reasoning_content":"想"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"你 好"}}]}\n\n',
            'data: [DONE]\n\n',
        ].join(""), {headers: {"Content-Type": "text/event-stream"}}));
        const deltas: string[] = [], reasoning: string[] = [];
        expect(await streamChatCompletions(input, {onDelta: value => deltas.push(value), onReasoning: value => reasoning.push(value)})).toMatchObject({ok: true, content: "你 好", reasoning: "想"});
        expect(deltas).toEqual(["你 好"]);
        expect(reasoning).toEqual(["想"]);
        nativeFetch.mockResolvedValueOnce(Response.json({id: "response-fixture", status: "completed", output: [{id: "message-fixture", type: "message", role: "assistant", content: [{type: "output_text", text: "共享 Responses"}]}]}));
        const responsesResult = await streamResponses(input);
        expect(responsesResult, JSON.stringify(responsesResult)).toMatchObject({ok: true, content: "共享 Responses"});
        expect(nativeFetch.mock.calls.map(call => call[0])).toEqual([`${connector.baseUrl}/chat/completions`, `${connector.baseUrl}/responses`]);
        expect(webFetch).not.toHaveBeenCalled();
    });

    it("uses the result-download route for no-auth binary audio and draft search testing", async () => {
        const bytes = Uint8Array.of(0, 255, 16);
        nativeFetch.mockResolvedValueOnce(new Response(bytes, {headers: {"Content-Type": "audio/mpeg"}}));
        const result = await downloadApimartAudio("https://signed-cdn.example/audio?signature=fixture");
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("fixture download failed");
        expect([...new Uint8Array(await result.blob.arrayBuffer())]).toEqual([...bytes]);
        const init = nativeFetch.mock.calls[0][1];
        expect(init.credentials).toBe("omit");
        expect([...new Headers(init.headers)]).toEqual([]);
        nativeFetch.mockResolvedValueOnce(Response.json({usage: 0}));
        expect(await testSearchConnection("fixture-search-key")).toMatchObject({ok: true});
        expect(nativeFetch.mock.calls[1][0]).toBe("https://api.tavily.com/usage");
        expect(webFetch).not.toHaveBeenCalled();
    });

    it("uses the same generation job/tool implementation through native submit, poll and the formerly direct signed download", async () => {
        const config = {id: "apimart", definitionId: "apimart" as const, protocol: "openai-compatible" as const,
            baseUrl: connector.baseUrl, apiKey: connector.apiKey, updatedAt: "now"};
        await db.connectors.put(config);
        const project = await createProject("Native transport fixture");
        const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
        const shot = await addShot(project.id, episode.id);
        const thread = await createChatThread();
        const run = await beginAgentRun({threadId: thread.id, connector: config, model: "chat-fixture", content: "generation fixture"});
        const args: GenerationSubmitArgs = {connectorId: config.id, model: "gpt-image-2",
            target: {kind: "shot", projectId: project.id, episodeId: episode.id, entityId: shot.id, slot: "firstFrame"},
            prompt: "fixture prompt", parameters: {}, inputs: []};
        await saveFixtureToolRound(run.id, "", [{id: "fixture-submit", type: "function", function: {name: "submit_generation", arguments: JSON.stringify(args)}}],
            [{title: "submit_generation", effect: "network", highRisk: false}]);
        const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
        await transitionToolCall(run.id, call.id, ["pending"], "running");
        const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII="), char => char.charCodeAt(0));
        nativeFetch.mockImplementation(async (url: string, init: RequestInit) => {
            if (init.method === "POST") return Response.json({code: 200, data: [{task_id: "native-task", status: "submitted"}]});
            if (url.includes("/tasks/")) return Response.json({code: 200, data: {id: "native-task", status: "completed", result: {images: [{url: "https://cdn-fixture.example/result?signature=opaque"}]}}});
            expect([...new Headers(init.headers)]).toEqual([]);
            expect(init.credentials).toBe("omit");
            return new Response(png, {headers: {"Content-Type": "image/png"}});
        });
        const job = await submitAgentGeneration(args, {runId: run.id, threadId: thread.id, callId: call.id, signal: new AbortController().signal}, {pollIntervalMs: 0, maxPolls: 2});
        expect(job.status).toBe("downloaded");
        const media = await db.media.get(job.result!.mediaId);
        expect(media).toBeDefined();
        expect([...new Uint8Array(await media!.blob.arrayBuffer())]).toEqual([...png]);
        expect(nativeFetch.mock.calls.map(call => call[0])).toEqual([
            `${config.baseUrl}/images/generations`, `${config.baseUrl}/tasks/native-task?language=zh`, "https://cdn-fixture.example/result?signature=opaque",
        ]);
        expect(nativeFetch.mock.calls.filter(call => call[1].method === "POST")).toHaveLength(1);
        expect(webFetch).not.toHaveBeenCalled();
    });
});
