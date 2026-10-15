import {describe, expect, it, vi} from "vitest";
import {listAIHubMixModels} from "@/features/video/providers/aihubmix";
import {discoverConnectorChatModels} from "@/features/settings/models/connectors";
import {requireVision, resolveVisionCapability} from "@/features/settings/models/visionCapability";
import {db} from "@/platform/product/store";
import {createProject} from "@/features/projects/commands/projects";
import {createChatThread} from "@/features/agent/commands/chat";
import {beginAgentRun} from "@/features/agent/commands/agentRuns";
import {importReferenceFile} from "@/features/references/documents/import";
import {referenceAttachment} from "@/features/references/models/references";
import {materializeChatMessages, materializeResponseItems} from "@/features/agent/providers/referenceWire";
import {toResponseInput} from "@/features/agent/providers/responsesStream";
import type {ConnectorConfig} from "@/features/settings/models/connector";

const connector: ConnectorConfig = {id: "hub", definitionId: "aihubmix", protocol: "openai-compatible", baseUrl: "https://hub.test/v1", apiKey: "fixture-key", updatedAt: "2026-10-11"};
const row = (fields: Record<string, unknown> = {}) => ({model_id: "unlisted-vision-fixture", types: "llm", output_modalities: "text", ...fields});
const catalog = (rows: unknown[]) => vi.fn<typeof fetch>(async () => Response.json({success: true, data: rows}));

describe("AIHubMix declared image input mapping", () => {
    it.each(["text,image", " TEXT , Image , image ", ["text", "IMAGE"], ["text,image", "video"]].map(input => ({input})))("maps valid provider image tokens $input through chat discovery", async ({input}) => {
        const fetchImpl = catalog([row({input_modalities: input, context_length: 200000, max_output: 8192})]);
        const result = await discoverConnectorChatModels(connector, {fetchImpl});
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("Expected valid public catalog");
        expect(result.models).toEqual(["unlisted-vision-fixture"]);
        expect(result.metadata?.["unlisted-vision-fixture"]).toEqual({source: "provider", vision: true, contextWindow: 200000, maxOutputTokens: 8192});
        expect(await resolveVisionCapability("unlisted-vision-fixture", connector.definitionId, result.metadata?.["unlisted-vision-fixture"])).toEqual({supported: true, source: "provider"});
        expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://hub.test/api/v1/models", expect.objectContaining({method: "GET", headers: {}, credentials: "omit"}));
    });

    it.each([undefined, null, "", "text", "text,video", "image-generation", ["text"], 9, {}, ["image", 9]].map(input => ({input})))("does not authorize vision from absent, non-image or invalid modalities $input", async ({input}) => {
        const result = await discoverConnectorChatModels(connector, {fetchImpl: catalog([row({input_modalities: input})])});
        if (!result.ok) throw new Error("Expected parseable directory");
        expect(result.metadata?.["unlisted-vision-fixture"]?.vision).toBeUndefined();
        const capability = await resolveVisionCapability("unlisted-vision-fixture", connector.definitionId, result.metadata?.["unlisted-vision-fixture"]);
        expect(capability).toEqual({supported: false, source: "unknown"});
        expect(() => requireVision(capability)).toThrow("尚未确认");
    });

    it.each([true, false])("preserves explicit boolean vision=%j over image modality", async vision => {
        const result = await listAIHubMixModels(connector, {fetchImpl: catalog([row({input_modalities: "text,image", capabilities: {vision}})])});
        if (!result.ok) throw new Error("Expected valid catalog");
        expect(result.models[0].metadata).toEqual({source: "provider", vision});
        expect(await resolveVisionCapability(result.models[0].id, connector.definitionId, result.models[0].metadata)).toEqual({supported: vision, source: "provider"});
    });

    it("merges duplicate provider declarations conservatively and preserves special model IDs", async () => {
        const result = await discoverConnectorChatModels(connector, {fetchImpl: catalog([
            row({input_modalities: "image", context_length: 200000}),
            row({input_modalities: "text,image", capabilities: {vision: false}, context_length: 64000}),
            row({model_id: "__proto__", input_modalities: "image"}),
        ])});
        if (!result.ok) throw new Error("Expected valid catalog");
        expect(result.metadata?.["unlisted-vision-fixture"]).toEqual({source: "provider", vision: false, contextWindow: 64000});
        expect(result.metadata?.["__proto__"]).toEqual({source: "provider", vision: true});
        expect(Object.getPrototypeOf(result.metadata)).toBeNull();
    });

    it("does not treat image output or a known media model as a compatible chat model", async () => {
        const result = await discoverConnectorChatModels(connector, {fetchImpl: catalog([row({input_modalities: "image", output_modalities: "image", types: "image_generation"})])});
        if (!result.ok) throw new Error("Expected valid catalog");
        expect(result.models).toEqual([]);
        expect(result.incompatibleModels).toEqual(["unlisted-vision-fixture"]);
    });
});

async function imageDraft() {
    const project = await createProject("Vision mapping");
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=="), character => character.charCodeAt(0));
    const reference = await importReferenceFile(project.id, new File([png], "reference.png", {type: "image/png"}));
    const thread = await createChatThread({projectId: project.id});
    return {project, thread, attachment: referenceAttachment(reference), png};
}

describe("declared provider vision reaches durable attachment preflight", () => {
    it.each(["chat-completions", "responses"] as const)("materializes the imported image into %s only after actual discovery and run creation", async protocol => {
        // Exact relevant fields from the public supplier receipt, not a model-name rule.
        const result = await discoverConnectorChatModels(connector, {fetchImpl: catalog([row({model_id: "gpt-6-luna", input_modalities: "text,image", context_length: 1050000, max_output: 128000})])});
        if (!result.ok) throw new Error("Expected public supplier metadata");
        const {project, thread, attachment, png} = await imageDraft();
        const run = await beginAgentRun({threadId: thread.id, connector, model: "gpt-6-luna", content: "查看图片", attachments: [attachment], modelMetadata: result.metadata?.["gpt-6-luna"]});
        expect(run.visionCapability).toEqual({supported: true, source: "provider"});
        expect((await db.chatMessages.get(run.userMessageId))?.attachments).toEqual([attachment]);
        const scope = {runId: run.id, projectId: project.id, model: run.model, connectorDefinitionId: connector.definitionId, visionCapability: run.visionCapability};
        const wire = protocol === "responses" ? await materializeResponseItems(toResponseInput(run.requestMessages), scope) : await materializeChatMessages(run.requestMessages, scope);
        const serialized = JSON.stringify(wire);
        expect(serialized).toContain(protocol === "responses" ? '"input_image"' : '"image_url"');
        expect(serialized).toContain(`data:image/png;base64,${btoa(String.fromCharCode(...png))}`);
        expect(JSON.stringify([await db.agentRuns.toArray(), await db.chatMessages.toArray()])).not.toContain("data:image");
    });

    it.each([{}, {input_modalities: ["image", 2]}, {input_modalities: "text"}, {input_modalities: "text,image", capabilities: {vision: false}}])("rejects unsupported/unknown metadata %j before durable messages or runs", async fields => {
        const result = await discoverConnectorChatModels(connector, {fetchImpl: catalog([row(fields)])});
        if (!result.ok) throw new Error("Expected parseable catalog");
        const {thread, attachment} = await imageDraft();
        await expect(beginAgentRun({threadId: thread.id, connector, model: "unlisted-vision-fixture", content: "保留图片草稿", attachments: [attachment], modelMetadata: result.metadata?.["unlisted-vision-fixture"]})).rejects.toThrow(/尚未确认|不支持图片/);
        expect(await db.chatMessages.count()).toBe(0);
        expect(await db.agentRuns.count()).toBe(0);
        expect(await db.projectReferences.count()).toBe(1);
    });
});
