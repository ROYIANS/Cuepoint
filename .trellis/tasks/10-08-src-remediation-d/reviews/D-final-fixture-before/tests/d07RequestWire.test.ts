import {describe, expect, it, vi} from "vitest";
import * as mart from "@/lib/ai/apimart";
import * as audio from "@/lib/ai/apimartAudio";
import * as hub from "@/lib/ai/aihubmix";
import * as mimo from "@/lib/ai/mimoSpeech";
import * as generic from "@/lib/ai/openaiCompatible";
import * as chat from "@/lib/ai/chatStream";
import * as responses from "@/lib/ai/responsesStream";
import * as tavily from "@/lib/ai/tavily";
import * as oldMart from "../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/apimart";
import * as oldAudio from "../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/apimartAudio";
import * as oldHub from "../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/aihubmix";
import * as oldMimo from "../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/mimoSpeech";
import * as oldGeneric from "../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/openaiCompatible";
import * as oldChat from "../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/chatStream";
import * as oldResponses from "../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/responsesStream";
import * as oldTavily from "../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/tavily";
import {saveSearchConnection, getSearchConnectionState} from "@/db/searchConnections";

// Metadata is an untouched accepted dependency, shared by both adapter runs.
vi.mock("../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/modelMetadata", async () => import("@/lib/ai/modelMetadata"));

vi.mock("../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/lib/ai/visionCapability", async () => import("@/lib/ai/visionCapability"));

const credentials = {baseUrl: " https://proxy.example/prefix/v1/// ", apiKey: " sk-secret "};
const before = {mart: oldMart, audio: oldAudio, hub: oldHub, mimo: oldMimo, generic: oldGeneric, chat: oldChat, responses: oldResponses, tavily: oldTavily};
const current = {mart, audio, hub, mimo, generic, chat, responses, tavily};
const input: chat.StreamChatInput = {...credentials, model: "gpt-test", connectorDefinitionId: "openai-compatible", messages: [{role: "user", content: "hello"}]};
const music: audio.MusicInput = {model: "flowmusic", sound_prompt: "piano", bpm: "88", length: 120, seed: "0"};
const speech: audio.SpeechInput = {model: "gpt-4o-mini-tts", input: "hello", voice: "alloy", response_format: "wav", speed: 1};
const hubTask = {id: "task_1", object: "image", model: "model", status: "pending", output: [], error: null, created_at: 1000, completed_at: null, expires_at: null};
const json = (body: unknown, status = 200) => () => Response.json(body, {status});
const blob = new Blob(["RIFF", new Uint8Array(4), "WAVEfmt ", new Uint8Array(32)], {type: "audio/wav"});
const speechResponse = async () => Response.json({choices: [{finish_reason: "stop", message: {audio: {data: btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())))}}}]});
const task: hub.AIHubMixTask = {id: "task_1", kind: "video", model: "model", status: "completed", providerStatus: "completed", outputs: [{index: 0, type: "file", contentUrl: "https://proxy.example/prefix/ai/v1/videos/task_1/content", requiresAuthentication: true}]};
type Case = {name: string; method: string; route: string; response: () => Response | Promise<Response>; invoke: (adapters: typeof current, fetchImpl: typeof fetch, signal: AbortSignal, emitted: unknown[]) => Promise<unknown>};
const cases: Case[] = [
    {name: "APIMart catalog", method: "GET", route: "/v1/models?expand=category", response: json({code: 200, data: [{id: "chat", category: "chat"}]}), invoke: (a, fetchImpl, signal) => a.mart.listApimartModels(credentials, {}, {fetchImpl, signal})},
    {name: "APIMart standard image", method: "POST", route: "/v1/images/generations", response: json({code: 200, data: [{task_id: "task-1"}]}), invoke: (a, fetchImpl, signal) => a.mart.submitApimartImageGeneration(credentials, {model: "gpt-image-2", prompt: "image", size: "1:1"}, {fetchImpl, signal, idempotencyKey: "job-1"})},
    {name: "APIMart Ext image", method: "POST", route: "/v1/images/generations", response: json({code: 202, data: {id: "ext-1"}}), invoke: (a, fetchImpl, signal) => a.mart.submitApimartImageGeneration(credentials, {model: "gpt-image-2.5-ext", prompt: "image", version: "flare"}, {fetchImpl, signal, idempotencyKey: "job-1"})},
    {name: "APIMart native video", method: "POST", route: "/v1/videos/generations", response: json({code: 200, data: [{task_id: "video-1"}]}), invoke: (a, fetchImpl, signal) => a.mart.submitApimartVideoGeneration(credentials, {model: "sora-2", aspect_ratio: "16:9", duration: 10, generate_audio: true}, {fetchImpl, signal})},
    {name: "APIMart multipart", method: "POST", route: "/v1/uploads/images", response: json({code: 200, url: "https://cdn.example/image.png"}), invoke: (a, fetchImpl, signal) => a.mart.uploadApimartImage(credentials, new File(["png"], "reference.png", {type: "image/png"}), {fetchImpl, signal})},
    {name: "APIMart task recovery", method: "GET", route: "/v1/tasks/task-1?language=zh", response: json({code: 200, data: {id: "task-1", status: "processing"}}), invoke: (a, fetchImpl, signal) => a.mart.getApimartTask(credentials, "task-1", {fetchImpl, signal})},
    {name: "APIMart speech", method: "POST", route: "/v1/audio/speech", response: () => new Response(blob), invoke: (a, fetchImpl, signal) => a.audio.generateApimartSpeech(credentials, speech, {fetchImpl, signal})},
    {name: "APIMart music", method: "POST", route: "/v1/music/generations", response: json({code: 200, data: [{task_id: "music-1"}]}), invoke: (a, fetchImpl, signal) => a.audio.submitApimartMusic(credentials, music, {fetchImpl, signal})},
    {name: "APIMart music GET", method: "GET", route: "/v1/music/tasks/music%2F1?language=zh", response: json({code: 200, data: {id: "music/1", status: "processing"}}), invoke: (a, fetchImpl, signal) => a.audio.getApimartMusicTask(credentials, "music/1", {fetchImpl, signal})},
    {name: "Public audio download", method: "GET", route: "/audio.wav", response: () => new Response(blob), invoke: (a, fetchImpl, signal) => a.audio.downloadApimartAudio("https://cdn.example/audio.wav", {fetchImpl, signal})},
    {name: "AIHubMix public catalog", method: "GET", route: "/api/v1/models", response: json({success: true, data: [{model_id: "model", types: "t2i"}]}), invoke: (a, fetchImpl, signal) => a.hub.listAIHubMixModels(credentials, {fetchImpl, signal})},
    {name: "AIHubMix public schema", method: "GET", route: "/call/schema/models/model/endpoints", response: json({modality: "image", endpoints: [{path: "/ai/v1/images/generations", method: "POST", request: {schema: {type: "object", properties: {}}}}]}), invoke: (a, fetchImpl, signal) => a.hub.getAIHubMixModelSchema(credentials, "model", "image", {fetchImpl, signal})},
    {name: "AIHubMix protected probe", method: "GET", route: "/ai/v1/images?limit=1", response: json({object: "list", data: [], has_more: false, next_after: null}), invoke: (a, fetchImpl, signal) => a.hub.testAIHubMixConnection(credentials, {fetchImpl, signal})},
    {name: "AIHubMix image", method: "POST", route: "/ai/v1/images/generations", response: json(hubTask), invoke: (a, fetchImpl, signal) => a.hub.submitAIHubMixImageGeneration(credentials, {model: "model", prompt: "image", size: "1:1"}, {fetchImpl, signal})},
    {name: "AIHubMix video", method: "POST", route: "/ai/v1/videos", response: json({...hubTask, object: "video"}), invoke: (a, fetchImpl, signal) => a.hub.submitAIHubMixVideoGeneration(credentials, {model: "veo-3.1-fast-generate-preview", prompt: "video", generate_audio: true, duration: 8}, {fetchImpl, signal})},
    {name: "AIHubMix failed task read", method: "GET", route: "/ai/v1/images/task_1", response: json({...hubTask, status: "failed", error: {code: "failed", message: "task failed"}}), invoke: (a, fetchImpl, signal) => a.hub.getAIHubMixImageTask(credentials, "task_1", {fetchImpl, signal})},
    {name: "Protected video download", method: "GET", route: "/ai/v1/videos/task_1/content", response: () => new Response("video", {headers: {"content-type": "video/mp4"}}), invoke: (a, fetchImpl, signal) => a.hub.downloadAIHubMixResult(credentials, task, task.outputs[0], {fetchImpl, signal})},
    {name: "MiMo models", method: "GET", route: "/v1/models", response: json({data: [{id: "mimo-v2.5-tts"}]}), invoke: (a, fetchImpl, signal) => a.mimo.listMimoModels(credentials, {fetchImpl, signal})},
    {name: "MiMo speech", method: "POST", route: "/v1/chat/completions", response: speechResponse, invoke: (a, fetchImpl, signal) => a.mimo.generateMimoSpeech(credentials, {text: "hello", voice: "mimo_default", mimo: {mode: "preset", instruction: "soft"}}, {fetchImpl, signal})},
    {name: "Generic models", method: "GET", route: "/v1/models", response: json({data: [{id: "gpt-test"}]}), invoke: (a, fetchImpl) => a.generic.listModels(credentials, fetchImpl)},
    {name: "Generic probe", method: "GET", route: "/v1/models", response: json({data: []}), invoke: (a, fetchImpl) => a.generic.testConnection(credentials, fetchImpl)},
    {name: "Chat same-request JSON", method: "POST", route: "/v1/chat/completions", response: json({choices: [{message: {role: "assistant", content: "answer", reasoning_content: "reason"}, finish_reason: "stop"}]}), invoke: (a, fetchImpl, signal, emitted) => a.chat.streamChatCompletions(input, {fetchImpl, signal, onDelta: text => {emitted.push(["content", text]);}, onReasoning: text => {emitted.push(["reason", text]);}})},
    {name: "Chat SSE completion", method: "POST", route: "/v1/chat/completions", response: () => new Response('data: {"choices":[{"delta":{"content":"answer"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', {headers: {"content-type": "text/event-stream"}}), invoke: (a, fetchImpl, signal, emitted) => a.chat.streamChatCompletions(input, {fetchImpl, signal, onDelta: text => {emitted.push(text);}})},
    {name: "Responses same-request JSON", method: "POST", route: "/v1/responses", response: json({id: "response-1", status: "completed", output: [{type: "message", role: "assistant", content: [{type: "output_text", text: "answer"}]}]}), invoke: (a, fetchImpl, signal, emitted) => a.responses.streamResponses(input, {fetchImpl, signal, onDelta: text => {emitted.push(text);}})},
    {name: "Tavily usage", method: "GET", route: "/usage", response: json({total_usage: 1}), invoke: (a, fetchImpl, signal) => a.tavily.testSearchConnection("tvly-key", {fetchImpl, signal})},
];

async function stable(value: unknown): Promise<unknown> {
    if (value instanceof Blob) return {type: value.type, bytes: [...new Uint8Array(await value.arrayBuffer())]};
    if (Array.isArray(value)) return Promise.all(value.map(stable));
    if (value && typeof value === "object") {
        const entries = await Promise.all(Object.entries(value).filter(([key]) => !["metrics", "retrievedAt"].includes(key)).map(async ([key, child]) => [key, await stable(child)]));
        return Object.fromEntries(entries);
    }
    return value;
}
async function requestWire(url: string | URL | Request, init?: RequestInit) {
    let body: unknown = init?.body;
    if (body instanceof FormData) body = await Promise.all([...body.entries()].map(async ([key, value]) => [key, value instanceof File ? {name: value.name, ...await stable(value) as object} : value]));
    return {url: String(url), method: init?.method ?? "GET", headers: [...new Headers(init?.headers).entries()], body,
        credentials: init?.credentials ?? "same-origin", redirect: init?.redirect ?? "follow", signalAborted: init?.signal?.aborted ?? false};
}

describe("D07 original adapter request/result/read controls", () => {
    it.each(cases)("retains exact effective request and original decoding: $name", async test => {
        const runs = [];
        for (const adapters of [before, current]) {
            const emitted: unknown[] = [];
            const signal = new AbortController().signal;
            const response = await test.response();
            const jsonRead = vi.spyOn(response, "json");
            const textRead = vi.spyOn(response, "text");
            const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
            const result = await test.invoke(adapters, fetchImpl, signal, emitted);
            expect(fetchImpl).toHaveBeenCalledOnce();
            const [url, init] = fetchImpl.mock.calls[0];
            expect(String(url)).toContain(test.route);
            expect(init?.method ?? "GET").toBe(test.method);
            if (!test.name.startsWith("Generic")) expect(init?.signal).toBeDefined();
            if (["AIHubMix public catalog", "AIHubMix public schema", "Public audio download"].includes(test.name)) expect(new Headers(init?.headers).has("Authorization")).toBe(false);
            if (test.name === "APIMart multipart") expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
            if (test.name === "APIMart Ext image") expect(init?.headers).toMatchObject({"X-APIMart-Response-Version": "2026-07-27", "Idempotency-Key": "job-1"});
            if (test.name === "APIMart standard image") expect(new Headers(init?.headers).has("Idempotency-Key")).toBe(false);
            expect(result).toMatchObject({ok: true});
            runs.push({wire: await requestWire(url, init), result: await stable(result), emitted, jsonReads: jsonRead.mock.calls.length, textReads: textRead.mock.calls.length});
        }
        expect(runs[1]).toEqual(runs[0]);
    });
    it.each(["search", "read"] as const)("retains actual Tavily %s wire, body budgets, result and redaction", async kind => {
        await saveSearchConnection({apiKey: "tvly-key", enabled: true});
        const revision = (await getSearchConnectionState()).revision;
        const runs = [];
        for (const adapters of [before, current]) {
            const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({request_id: "id", results: [{url: "https://example.com/page", title: "tvly-key", content: "snippet", raw_content: "full text"}]}));
            const result = await adapters.tavily.executeWebRequest(kind, kind === "search" ? {query: "topic", maxResults: 2, timeRange: "week"} : {url: "https://example.com/page"}, revision, {fetchImpl});
            expect(result).toMatchObject({ok: true});
            expect(fetchImpl).toHaveBeenCalledOnce();
            expect(fetchImpl.mock.calls[0][1]?.method).toBe("POST");
            expect(String(fetchImpl.mock.calls[0][0])).toBe(`https://api.tavily.com/${kind === "search" ? "search" : "extract"}`);
            runs.push({wire: await requestWire(...fetchImpl.mock.calls[0]), result: await stable(result)});
        }
        expect(runs[1]).toEqual(runs[0]);
    });
});
