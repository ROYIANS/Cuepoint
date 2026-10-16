import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {UnknownCommitError} from "@/platform/storage/errors";
import type {McpHostServices, McpHostConnection} from "@/platform/runtime/mcp";
import {McpHostError} from "@/platform/runtime/mcpErrors";
import type {McpSaveIntent} from "@/features/agent/mcp/models/operations";
import {createMcpConnectionOwner} from "@/features/agent/mcp/runtime/connections";
import {getMcpCatalogue} from "@/features/agent/mcp/queries/catalogue";

const reference = (revisionId = "revision_one") => ({kind: "native_vault" as const, ownerId: "vault_one", revisionId});
const save = (overrides: Partial<McpSaveIntent> = {}): McpSaveIntent => ({operationId: "save_one", catalogueRevision: 0, expectedConfigRevision: 0, serverId: "server_one", label: "本地素材", enabled: true,
    privateConfig: {transport: "stdio", executable: "/private/mcp/server", args: ["--private"], environment: {TOKEN: "SECRET"}}, ...overrides});
const rawConnection = (serverId = "server_one", configRevision = 1): McpHostConnection => ({binding: {serverId, configRevision, manifestRevision: "host_raw_one", registrationId: `registration_${serverId}`, hostSessionId: "host_one", principalRevision: "principal_one"}, discovery: {tools: [{name: "scan", inputSchema: {type: "object", properties: {}}}], resources: []}});
function deferred<T>() {let resolve!: (value: T) => void; const promise = new Promise<T>(done => {resolve = done;}); return {promise, resolve};}
function fixture() {
    let active = true, revision = 0;
    const host: McpHostServices = {
        get active() {return active;}, capabilities: {host: "desktop", stdio: true, streamableHttp: true, oauth: true, rememberedCredentials: true},
        async initialize() {return this.capabilities;},
        preparePrivateRevision: vi.fn(async () => reference(`revision_${++revision}`)),
        privateRevisionStatus: vi.fn(async () => ({status: "prepared" as const, reference: reference(`revision_${revision}`)})),
        confirmPrivateRevision: vi.fn(async () => undefined), discardPrivateRevision: vi.fn(async () => undefined),
        retireServer: vi.fn(async () => ({status: "drained" as const})),
        connect: vi.fn(async input => rawConnection(input.serverId, input.configRevision)),
        disconnect: vi.fn(async () => ({status: "drained" as const})),
        prepare: vi.fn(async () => {throw new Error("unused");}), invoke: vi.fn(async () => {throw new Error("unused");}),
        invocationStatus: vi.fn(async () => {throw new Error("unused");}), stop: vi.fn(async () => {throw new Error("unused");}),
        oauthBegin: vi.fn(async () => ({attemptId: "login_one", redirectDisplay: "127.0.0.1"})),
        oauthStatus: vi.fn(async () => ({attemptId: "login_one", state: "authorized" as const})), oauthCancel: vi.fn(async () => undefined),
        dispose: vi.fn(() => {active = false; return Promise.resolve({status: "drained" as const});}),
    };
    return {host, owner: createMcpConnectionOwner(db, host)};
}
afterEach(() => vi.restoreAllMocks());

describe("MCP configuration and connection owner with actual ProductStore", () => {
    it("publishes only a safe projection after preparing the vault and does not launch on save", async () => {
        const {host, owner} = fixture();
        expect(await owner.save(save())).toMatchObject({status: "committed", hostConfirmed: true, cleanupPending: false});
        expect(host.connect).not.toHaveBeenCalled();
        const catalogue = await getMcpCatalogue();
        expect(JSON.stringify(catalogue)).not.toMatch(/SECRET|executable|environment|\/private/);
        expect(host.confirmPrivateRevision).toHaveBeenCalledWith({operationId: "save_one", serverId: "server_one", reference: reference("revision_1"), catalogueFingerprint: catalogue.receipts[0].fingerprint});
        const generation = await owner.connect({operationId: "connect_one", serverId: "server_one", configRevision: 1});
        expect(generation.binding.manifestRevision).toBe("host_raw_one");
        expect(generation.manifest.revision).not.toBe(generation.binding.manifestRevision);
        expect(Object.isFrozen(generation.manifest.tools)).toBe(true);
        expect(await owner.connected()).toEqual([generation]);
    });

    it("notifies pure surface readers before awaiting replacement disconnect and on final disposal", async () => {
        const {host, owner} = fixture();
        const listener = vi.fn(), unsubscribe = owner.subscribe(listener);
        await owner.save(save());
        const generation = await owner.connect({operationId: "connect_one", serverId: "server_one", configRevision: 1});
        expect(owner.capture()).toEqual([generation]);
        expect(owner.isCurrent(generation.binding)).toBe(true);
        const revision = owner.revision, held = deferred<{status: "drained"}>(), started = deferred<void>();
        vi.spyOn(host, "disconnect").mockImplementationOnce(async () => {started.resolve(); return held.promise;});
        const replacement = owner.connect({operationId: "connect_two", serverId: "server_one", configRevision: 1});
        await started.promise;
        expect(owner.revision).toBeGreaterThan(revision);
        expect(listener).toHaveBeenCalled();
        expect(owner.capture()).toEqual([]);
        expect(owner.isCurrent(generation.binding)).toBe(false);
        held.resolve({status: "drained"});
        await replacement;
        expect(owner.capture()).toHaveLength(1);
        const reads = vi.spyOn(db, "transaction");
        owner.capture(); owner.isCurrent(generation.binding);
        expect(reads).not.toHaveBeenCalled();
        const afterReplacement = owner.revision;
        await owner.dispose();
        expect(owner.revision).toBeGreaterThan(afterReplacement);
        expect(owner.capture()).toEqual([]);
        unsubscribe();
    });

    it("rejects malformed private configuration before vault creation or retirement", async () => {
        const {host, owner} = fixture();
        expect(() => owner.save(save({privateConfig: {transport: "streamable_http", endpoint: "https://user:SECRET@example.com", auth: {kind: "none"}}}))).toThrow();
        expect(host.preparePrivateRevision).not.toHaveBeenCalled();
        expect(host.retireServer).not.toHaveBeenCalled();
        expect((await getMcpCatalogue()).revision).toBe(0);
    });

    it("reconciles a lost privatePrepare reply with the original operation and no second candidate", async () => {
        const {host, owner} = fixture();
        vi.spyOn(host, "preparePrivateRevision").mockRejectedValueOnce(new McpHostError("transport", "unknown", "save_one"));
        vi.spyOn(host, "privateRevisionStatus").mockResolvedValue({status: "prepared", reference: reference()});
        expect(await owner.save(save())).toEqual({status: "unknown", operationId: "save_one"});
        expect(host.discardPrivateRevision).not.toHaveBeenCalled();
        expect(await owner.reconcile("save_one")).toMatchObject({status: "committed", hostConfirmed: true});
        expect(host.privateRevisionStatus).toHaveBeenCalledWith({operationId: "save_one", serverId: "server_one"});
        expect(host.preparePrivateRevision).toHaveBeenCalledTimes(1);
        expect((await getMcpCatalogue()).entries[0].privateRevision).toEqual(reference());
    });

    it("reconciles an unknown COMMIT through its original receipt with no repeated store write", async () => {
        const {host, owner} = fixture();
        const original = db.transaction.bind(db);
        let lost = true;
        const transactions = vi.spyOn(db, "transaction").mockImplementation(async (mode, tables, callback) => {
            const result = await original(mode, tables, callback);
            if (mode === "rw" && lost) {lost = false; throw new UnknownCommitError("commit_one", "workspace_one");}
            return result;
        });
        expect(await owner.save(save())).toMatchObject({status: "unknown"});
        expect(host.confirmPrivateRevision).not.toHaveBeenCalled();
        expect(host.discardPrivateRevision).not.toHaveBeenCalled();
        expect(await owner.reconcile("save_one")).toMatchObject({status: "committed", hostConfirmed: true});
        expect(transactions.mock.calls.filter(([mode]) => mode === "rw")).toHaveLength(1);
        expect(host.preparePrivateRevision).toHaveBeenCalledTimes(1);
    });

    it("collects only its rejected candidate after CAS conflict and retains the current credential", async () => {
        const {host, owner} = fixture();
        await owner.save(save());
        const rejected = await owner.save(save({operationId: "stale_save", label: "stale"}));
        expect(rejected).toMatchObject({status: "rejected", code: "conflict", cleanupPending: false});
        expect(host.discardPrivateRevision).toHaveBeenCalledExactlyOnceWith({serverId: "server_one", reference: reference("revision_2")});
        expect((await getMcpCatalogue()).entries[0].privateRevision).toEqual(reference("revision_1"));
    });

    it("blocks connection until native catalogue confirmation is reconciled without preparing or saving again", async () => {
        const {host, owner} = fixture();
        vi.spyOn(host, "confirmPrivateRevision").mockRejectedValueOnce(new McpHostError("reply_lost", "unknown", "save_one"));
        expect(await owner.save(save())).toMatchObject({status: "committed", hostConfirmed: false});
        await expect(owner.connect({operationId: "connect_one", serverId: "server_one", configRevision: 1})).rejects.toMatchObject({code: "retired"});
        expect(await owner.reconcile("save_one")).toMatchObject({status: "committed", hostConfirmed: true});
        expect(host.preparePrivateRevision).toHaveBeenCalledTimes(1);
        expect(host.discardPrivateRevision).not.toHaveBeenCalled();
        await owner.connect({operationId: "connect_two", serverId: "server_one", configRevision: 1});
    });

    it("settles a proven not-started retirement and reconciles a thrown retirement without querying an unissued prepare", async () => {
        const {host, owner} = fixture();
        vi.spyOn(host, "retireServer").mockRejectedValueOnce(new McpHostError("closed", "not_started", "retire_one"));
        expect(await owner.save(save())).toMatchObject({status: "rejected", cleanupPending: false});
        expect(host.preparePrivateRevision).not.toHaveBeenCalled();
        vi.spyOn(host, "retireServer").mockRejectedValueOnce(new Error("retire reply lost"));
        expect(await owner.save(save({operationId: "save_two"}))).toMatchObject({status: "unknown"});
        expect(await owner.reconcile("save_two")).toMatchObject({status: "rejected"});
        expect(host.privateRevisionStatus).not.toHaveBeenCalled();
        expect(host.preparePrivateRevision).not.toHaveBeenCalled();
        expect(await owner.save(save({operationId: "save_three"}))).toMatchObject({status: "committed"});
    });

    it("retires before editing and disconnects an exact late connect reply without resurrecting it", async () => {
        const {host, owner} = fixture();
        await owner.save(save());
        const started = deferred<void>(), held = deferred<McpHostConnection>();
        vi.spyOn(host, "connect").mockImplementationOnce(async () => {started.resolve(); return held.promise;});
        const connecting = owner.connect({operationId: "connect_one", serverId: "server_one", configRevision: 1});
        const rejection = expect(connecting).rejects.toMatchObject({code: "retired"});
        await started.promise;
        expect(await owner.mutate({kind: "set_enabled", operationId: "disable_one", serverId: "server_one", catalogueRevision: 1, expectedConfigRevision: 1, enabled: false})).toMatchObject({status: "committed"});
        const original = rawConnection();
        held.resolve(original);
        await rejection;
        expect(host.disconnect).toHaveBeenCalledWith(original.binding);
        expect(await owner.connected()).toEqual([]);
        await expect(owner.connect({operationId: "connect_disabled", serverId: "server_one", configRevision: 2})).rejects.toMatchObject({code: "retired"});
    });

    it("caps pending plus connected admission at eight and closes pending replies during teardown", async () => {
        const {host, owner} = fixture();
        for (let index = 0; index < 9; index++) await owner.save(save({operationId: `save_${index}`, serverId: `server_${index}`, catalogueRevision: index}));
        const held = deferred<McpHostConnection>();
        const started = deferred<void>();
        vi.spyOn(host, "connect").mockImplementationOnce(async () => {started.resolve(); return held.promise;});
        const late = owner.connect({operationId: "connect_0", serverId: "server_0", configRevision: 1});
        const rejection = expect(late).rejects.toMatchObject({code: "closed"});
        await started.promise;
        for (let index = 1; index < 8; index++) await owner.connect({operationId: `connect_${index}`, serverId: `server_${index}`, configRevision: 1});
        await expect(owner.connect({operationId: "connect_8", serverId: "server_8", configRevision: 1})).rejects.toMatchObject({code: "limit"});
        const disposal = owner.dispose();
        expect(await owner.connected()).toEqual([]);
        held.resolve(rawConnection("server_0"));
        await rejection;
        expect(await disposal).toEqual({status: "drained"});
        expect(host.disconnect).toHaveBeenCalledWith(rawConnection("server_0").binding);
    });

    it("cancels a late OAuth attempt after disconnect and never publishes stale login status", async () => {
        const {host, owner} = fixture();
        await owner.save(save({privateConfig: {transport: "streamable_http", endpoint: "https://example.com/mcp?key=SECRET", auth: {kind: "oauth", scopes: ["tools"]}}}));
        const held = deferred<{attemptId: string}>(), started = deferred<void>();
        vi.spyOn(host, "oauthBegin").mockImplementationOnce(async () => {started.resolve(); return held.promise;});
        const login = owner.oauthBegin({operationId: "login_one", serverId: "server_one", configRevision: 1});
        const rejected = expect(login).rejects.toMatchObject({code: "retired"});
        await started.promise;
        await owner.disconnect("server_one");
        held.resolve({attemptId: "attempt_one"});
        await rejected;
        expect(host.oauthCancel).toHaveBeenCalledWith("attempt_one");
        expect(JSON.stringify(await getMcpCatalogue())).not.toContain("SECRET");
        await expect(owner.oauthStatus("attempt_one")).rejects.toMatchObject({code: "retired"});
    });
    it("keeps a settled historical save receipt after replacement without reconfirming it", async () => {
        const {host, owner} = fixture();
        const original = await owner.save(save());
        await owner.save(save({operationId: "replace_one", catalogueRevision: 1, expectedConfigRevision: 1, label: "new"}));
        const count = vi.mocked(host.confirmPrivateRevision).mock.calls.length;
        expect(await owner.reconcile("save_one")).toEqual(original);
        expect(vi.mocked(host.confirmPrivateRevision).mock.calls).toHaveLength(count);
        expect(await owner.connect({operationId: "connect_new", serverId: "server_one", configRevision: 2})).toMatchObject({binding: {configRevision: 2}});
    });

    it("reserves OAuth begin before its first await and retains an unknown original until explicit retirement", async () => {
        const {host, owner} = fixture();
        await owner.save(save({privateConfig: {transport: "streamable_http", endpoint: "https://example.com/mcp", auth: {kind: "oauth", scopes: []}}}));
        const prior = await owner.connect({operationId: "connect_one", serverId: "server_one", configRevision: 1});
        expect(await owner.connected()).toEqual([prior]);
        const started = deferred<void>(), held = deferred<{attemptId: string}>();
        vi.spyOn(host, "oauthBegin").mockImplementationOnce(async () => {started.resolve(); return held.promise;});
        const first = owner.oauthBegin({operationId: "login_one", serverId: "server_one", configRevision: 1});
        await expect(owner.oauthBegin({operationId: "login_duplicate", serverId: "server_one", configRevision: 1})).rejects.toMatchObject({code: "conflict"});
        await started.promise;
        expect(await owner.connected()).toEqual([]);
        held.resolve({attemptId: "login_attempt"});
        await first;
        expect(host.oauthBegin).toHaveBeenCalledTimes(1);
        await owner.oauthCancel("login_attempt");
        vi.spyOn(host, "oauthBegin").mockRejectedValueOnce(new McpHostError("reply_lost", "unknown", "login_unknown"));
        await expect(owner.oauthBegin({operationId: "login_unknown", serverId: "server_one", configRevision: 1})).rejects.toMatchObject({certainty: "unknown"});
        await expect(owner.oauthBegin({operationId: "login_repeated", serverId: "server_one", configRevision: 1})).rejects.toMatchObject({code: "conflict"});
        await owner.disconnect("server_one");
        await expect(owner.oauthBegin({operationId: "login_after_retire", serverId: "server_one", configRevision: 1})).resolves.toMatchObject({attemptId: "login_one"});
    });

    it("rechecks original host drainage through the connection owner without reopening eligibility", async () => {
        const {host, owner} = fixture();
        vi.spyOn(host, "dispose").mockResolvedValueOnce({status: "draining"}).mockResolvedValueOnce({status: "drained"});
        expect(await owner.dispose()).toEqual({status: "draining"});
        expect(await owner.connected()).toEqual([]);
        await expect(owner.connect({operationId: "closed_connect", serverId: "server_one", configRevision: 1})).rejects.toMatchObject({code: "closed"});
        expect(await owner.dispose()).toEqual({status: "drained"});
        expect(await owner.dispose()).toEqual({status: "drained"});
        expect(host.dispose).toHaveBeenCalledTimes(2);
    });

});
