import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {UnknownCommitError} from "@/platform/storage/errors";
import type {McpCatalogueMutation} from "@/features/agent/mcp/models/connection";
import {mutateMcpCatalogue, reconcileMcpMutation} from "@/features/agent/mcp/commands/catalogue";
import {getMcpCatalogue} from "@/features/agent/mcp/queries/catalogue";
import {MCP_CATALOGUE_KEY, mcpEndpointDisplay} from "@/features/agent/mcp/runtime/records";
import {mcpPrivateCleanupDecision} from "@/features/agent/mcp/runtime/privateRevisions";
import {interceptStoreTable} from "./helpers/storeFaults";

const reference = (revisionId = "revision_one") => ({kind: "native_vault" as const, ownerId: "store_one", revisionId});
const save = (overrides: Partial<Extract<McpCatalogueMutation, {kind: "save"}>> = {}): Extract<McpCatalogueMutation, {kind: "save"}> => ({
    kind: "save", operationId: "save_one", catalogueRevision: 0, serverId: "server_one", expectedConfigRevision: 0,
    config: {label: "本地资源", enabled: false, transport: "stdio", auth: "none", privateRevision: reference()}, ...overrides,
});
afterEach(() => vi.restoreAllMocks());

describe("MCP strict device catalogue in actual ProductStore", () => {
    it("starts empty, saves a safe projection and never starts a transport", async () => {
        expect(await getMcpCatalogue()).toEqual({version: 1, revision: 0, entries: [], receipts: []});
        const receipt = await mutateMcpCatalogue(save());
        expect(receipt).toMatchObject({operationId: "save_one", catalogueRevision: 1, configRevision: 1});
        const catalogue = await getMcpCatalogue();
        expect(catalogue.entries[0]).toMatchObject({enabled: false, privateRevision: reference()});
        expect(Object.isFrozen(catalogue.entries[0].privateRevision)).toBe(true);
        expect(await db.deviceSettings.count()).toBe(1);
    });

    it("propagates strict read failures and corrupt/secret-bearing rows instead of empty", async () => {
        const failure = interceptStoreTable(db, "deviceSettings", "get", async () => {throw new Error("read unavailable");});
        await expect(getMcpCatalogue()).rejects.toThrow("read unavailable");
        failure.mockRestore();
        await db.deviceSettings.put({key: MCP_CATALOGUE_KEY, value: {version: 1, revision: 0, entries: [], receipts: [], headers: {Authorization: "SECRET"}}, updatedAt: "now"});
        await expect(getMcpCatalogue()).rejects.toThrow(/不支持/);
    });

    it("rejects plaintext fields and endpoint secrets before any write", async () => {
        const raw = save();
        const invalid = {...raw, config: {...raw.config, executable: "/private/server", environment: {TOKEN: "SECRET"}}};
        await expect(mutateMcpCatalogue(invalid)).rejects.toThrow(/不支持/);
        for (const address of ["https://user:token@example.com", "https://example.com/private", "https://example.com?token=secret", "http://remote.example", "https://example.com/"]) expect(() => mcpEndpointDisplay(address)).toThrow();
        expect(mcpEndpointDisplay("https://example.com")).toBe("https://example.com");
        expect(mcpEndpointDisplay("http://127.0.0.1:49152")).toBe("http://127.0.0.1:49152");
        expect(await db.deviceSettings.count()).toBe(0);
    });

    it("has per-config and catalogue CAS, retained original receipts and intent identity", async () => {
        const original = save();
        const receipt = await mutateMcpCatalogue(original);
        await mutateMcpCatalogue({kind: "set_enabled", operationId: "enable_one", catalogueRevision: 1, serverId: "server_one", expectedConfigRevision: 1, enabled: true});
        expect(await mutateMcpCatalogue(original)).toEqual(receipt);
        expect(await reconcileMcpMutation(original)).toEqual({status: "committed", receipt});
        await expect(mutateMcpCatalogue(save({config: {...original.config, label: "changed"}}))).rejects.toThrow(/标识/);
        await expect(mutateMcpCatalogue(save({operationId: "stale", catalogueRevision: 2, expectedConfigRevision: 1}))).rejects.toMatchObject({code: "conflict"});
        expect((await getMcpCatalogue()).revision).toBe(2);
    });

    it("rolls back a reached publication fault and keeps the prior private revision", async () => {
        await mutateMcpCatalogue(save());
        let reached = false;
        const failure = interceptStoreTable(db, "deviceSettings", "put", async () => {reached = true; throw new Error("publication failed");});
        const update = save({operationId: "replace", catalogueRevision: 1, expectedConfigRevision: 1, config: {...save().config, privateRevision: reference("revision_two")}});
        await expect(mutateMcpCatalogue(update)).rejects.toThrow("publication failed");
        expect(reached).toBe(true);
        failure.mockRestore();
        const current = await getMcpCatalogue();
        expect(current.entries[0].privateRevision).toEqual(reference());
        expect(mcpPrivateCleanupDecision(update, {status: "confirmed_rollback"}, current)).toEqual({status: "acknowledged", collect: [reference("revision_two")]});
    });

    it("reconciles a lost COMMIT acknowledgement by exact original receipt without another write", async () => {
        const originalTransaction = db.transaction.bind(db);
        let first = true;
        const transport = vi.spyOn(db, "transaction").mockImplementation(async (mode, scope, callback) => {
            const result = await originalTransaction(mode, scope, callback);
            if (first && mode === "rw") {first = false; throw new UnknownCommitError("native_commit", "workspace");}
            return result;
        });
        const original = save();
        await expect(mutateMcpCatalogue(original)).rejects.toMatchObject({certainty: "unknown"});
        const outcome = await reconcileMcpMutation(original);
        expect(outcome.status).toBe("committed");
        expect(transport.mock.calls.filter(([mode]) => mode === "rw")).toHaveLength(1);
        expect((await getMcpCatalogue()).entries[0].privateRevision).toEqual(reference());
        expect(mcpPrivateCleanupDecision(original, {status: "unresolved"}, await getMcpCatalogue())).toEqual({status: "quarantined"});
    });

    it("never infers rollback from absence/conflict, and collects only acknowledged unreferenced revisions", async () => {
        const original = save();
        const empty = await getMcpCatalogue();
        expect(await reconcileMcpMutation(original)).toEqual({status: "unresolved"});
        expect(mcpPrivateCleanupDecision(original, {status: "unresolved"}, empty)).toEqual({status: "quarantined"});
        await mutateMcpCatalogue(original);
        const update = save({operationId: "replace", catalogueRevision: 1, expectedConfigRevision: 1, config: {...original.config, privateRevision: reference("revision_two")}});
        const receipt = await mutateMcpCatalogue(update);
        expect(mcpPrivateCleanupDecision(update, {status: "committed", receipt}, await getMcpCatalogue())).toEqual({status: "acknowledged", collect: [reference()]});
        expect(mcpPrivateCleanupDecision(update, {status: "conflict"}, await getMcpCatalogue())).toEqual({status: "quarantined"});
        const removal = {kind: "remove" as const, operationId: "remove", catalogueRevision: 2, serverId: "server_one", expectedConfigRevision: 2};
        const removed = await mutateMcpCatalogue(removal);
        expect(removed.retiredPrivateRevision).toEqual(reference("revision_two"));
        expect((await getMcpCatalogue()).entries).toEqual([]);
    });

    it("keeps a currently referenced credential when rollback input has a different field order", async () => {
        await mutateMcpCatalogue(save());
        const sameReference = {revisionId: "revision_one", ownerId: "store_one", kind: "native_vault" as const};
        const update = save({operationId: "failed_replace", catalogueRevision: 1, expectedConfigRevision: 1,
            config: {...save().config, privateRevision: sameReference}});
        expect(mcpPrivateCleanupDecision(update, {status: "confirmed_rollback"}, await getMcpCatalogue()))
            .toEqual({status: "acknowledged", collect: []});
    });

    it("enforces maximum servers, distinct private candidates and bounded immutable public state", async () => {
        for (let index = 0; index < 16; index++) await mutateMcpCatalogue(save({operationId: `op_${index}`, serverId: `server_${index}`, catalogueRevision: index, config: {...save().config, privateRevision: reference(`revision_${index}`)}}));
        await expect(mutateMcpCatalogue(save({operationId: "overflow", serverId: "server_16", catalogueRevision: 16}))).rejects.toThrow(/上限/);
        const current = await getMcpCatalogue();
        expect(current.entries).toHaveLength(16);
        await expect(mutateMcpCatalogue(save({operationId: "share", serverId: "server_0", catalogueRevision: 16, expectedConfigRevision: 1, config: {...save().config, privateRevision: reference("revision_1")}}))).rejects.toThrow(/共享/);
        expect(JSON.stringify(current)).not.toContain("executable");
    });
});
