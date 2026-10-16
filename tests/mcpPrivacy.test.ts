import {afterEach, describe, expect, it} from "vitest";
import JSZip from "jszip";
import {db} from "@/platform/product/store";
import {createNativeMcpServices} from "@/platform/runtime/nativeMcp";
import {clearMcpHostServices, installMcpHostServices} from "@/platform/runtime/mcpServices";
import type {McpHostServices, McpPrivateConfig} from "@/platform/runtime/mcp";
import type {NativeSession} from "@/platform/storage/protocol";
import {mcpRuntimeOwner} from "@/features/agent/mcp/runtime/owner";
import {getMcpCatalogue} from "@/features/agent/mcp/queries/catalogue";
import {createProject} from "@/features/projects/commands/projects";
import {createChatThread} from "@/features/agent/commands/chat";
import {updateGeneralAgentConfig} from "@/features/agent/commands/agentSettings";
import {readAgentContextPreview} from "@/features/agent/commands/agentContextPreview";
import {beginAgentRun} from "@/features/agent/commands/agentRuns";
import {executeChatRun} from "@/features/agent/runtime/runChat";
import {exportProjectZip} from "@/app/workflows/packages/projectPackage";
import {buildDiagnosticReport, toErrorInfo} from "@/platform/diagnostics/errorReport";
import {clearBreadcrumbs} from "@/platform/diagnostics/breadcrumbs";
import type {ConnectorConfig} from "@/features/settings/models/connector";

const secrets = ["env-private-marker", "argument-private-marker", "directory-private-marker", "executable-private-marker", "header-private-marker", "query-private-marker", "client-private-marker", "scope-private-marker", "callback-private-marker"];
const session: NativeSession = {version: 1, session: "session_privacy", workspaceId: "workspace_privacy", generation: 1};
const connector: ConnectorConfig = {id: "cx", definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl: "https://model.example/v1", apiKey: "model-key", updatedAt: "now"};
let installed: McpHostServices | undefined;
afterEach(async () => {if (installed) await clearMcpHostServices(installed); installed = undefined; clearBreadcrumbs();});

/** Actual native renderer adapter; only the finite native command is a deterministic fixture. */
function installHost() {
    const privateConfigs: McpPrivateConfig[] = [];
    const host = createNativeMcpServices(async () => session, async (command, args) => {
        expect(command).toBe("mcp_service_request");
        const request = args.request as {operationId: string; action: {type: string; serverId?: string; config?: McpPrivateConfig; configRevision?: number}};
        const action = request.action;
        const reply = (status: string, result?: unknown) => ({version: 1, hostSessionId: "host_privacy", operationId: request.operationId, status, ...(result === undefined ? {} : {result})});
        switch (action.type) {
            case "capabilities": return reply("completed", {host: "desktop", stdio: true, streamableHttp: true, oauth: true, rememberedCredentials: true});
            case "retire": case "disconnect": case "dispose": return reply("drained");
            case "privatePrepare":
                privateConfigs.push(action.config!);
                return reply("prepared", {reference: {kind: "native_vault", ownerId: "vault_privacy", revisionId: `revision_${action.serverId}`}});
            case "privateConfirm": return reply("completed", {confirmed: true});
            case "privateDiscard": return reply("completed");
            case "connect": return reply("connected", {binding: {serverId: action.serverId, configRevision: action.configRevision, manifestRevision: "raw_privacy", registrationId: "registration_privacy", hostSessionId: "host_privacy", principalRevision: "principal_privacy"},
                discovery: {tools: [{name: "inspect", description: "Inspect selected external data", inputSchema: {type: "object", properties: {}, additionalProperties: false}}], resources: []}});
            case "oauthStatus": throw new Error(`raw remote failure ${secrets.join(" ")}`);
            default: throw new Error("Unexpected finite fixture command");
        }
    });
    installed = host;
    installMcpHostServices(host);
    return {host, privateConfigs, owner: mcpRuntimeOwner()!.connections};
}

describe("MCP private configuration stays outside product projections", () => {
    it("captures actual context/model/export/diagnostic bytes after real configuration publication", async () => {
        const {host, owner, privateConfigs} = installHost();
        const configs: McpPrivateConfig[] = [
            {transport: "stdio", executable: "/executable-private-marker", args: ["argument-private-marker"], cwd: "/directory-private-marker", environment: {TOKEN: "env-private-marker"}},
            {transport: "streamable_http", endpoint: "https://remote.example/mcp?token=query-private-marker", auth: {kind: "manual", headers: {Authorization: "Bearer header-private-marker"}}},
            {transport: "streamable_http", endpoint: "https://login.example/mcp", auth: {kind: "oauth", clientId: "client-private-marker", scopes: ["scope-private-marker"]}},
        ];
        for (const [index, privateConfig] of configs.entries()) {
            expect(await owner.save({operationId: `save_${index}`, serverId: `server_${index}`, catalogueRevision: index, expectedConfigRevision: 0, label: `Service ${index}`, enabled: true, privateConfig})).toMatchObject({status: "committed", hostConfirmed: true});
        }
        expect(privateConfigs).toEqual(configs); // Markers reached the actual private boundary.
        await owner.connect({operationId: "connect_privacy", serverId: "server_1", configRevision: 1});
        await updateGeneralAgentConfig({enabledSkillIds: ["workspace", "planning"], permissionMode: "full"});
        const project = await createProject("Privacy fixture"), thread = await createChatThread({projectId: project.id});
        const preview = await readAgentContextPreview({threadId: thread.id, draft: "Inspect available tools", attachments: [], model: "fixture"});
        expect(preview.status).toBe("ready");
        const run = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "Inspect available tools"});
        expect(run.mcpSnapshot?.generations).toHaveLength(1);
        const wire: string[] = [];
        await executeChatRun(run, connector.apiKey, new AbortController(), async (_url, init) => {
            wire.push(String(init?.body));
            return Response.json({choices: [{message: {content: "Ready"}, finish_reason: "stop"}]});
        });
        expect(wire).toHaveLength(1);
        const zip = await JSZip.loadAsync(await exportProjectZip(project.id));
        const entries = await Promise.all(Object.values(zip.files).filter(entry => !entry.dir).map(async entry => ({name: entry.name, text: await entry.async("string")})));
        expect(entries.some(entry => entry.name === "project.json")).toBe(true);
        let cause: unknown;
        try {await host.oauthStatus("attempt_privacy");} catch (error) {cause = error;}
        expect(cause).toMatchObject({name: "McpHostError", code: "transport", certainty: "unknown"});
        const diagnostic = buildDiagnosticReport(toErrorInfo(cause), {version: "test", environment: "tauri", platform: "fixture", route: "/agent", time: "now"});
        const captured = JSON.stringify({preview, wire, entries, diagnostic, catalogue: await getMcpCatalogue(), deviceSettings: await db.deviceSettings.toArray()});
        for (const marker of secrets) expect(captured).not.toContain(marker);
        expect(captured).not.toContain("raw remote failure");
        expect(JSON.stringify(entries)).not.toContain("vault_privacy");
        expect(JSON.stringify(preview)).not.toMatch(/authorityId|argumentsDigest/);
    });
});
