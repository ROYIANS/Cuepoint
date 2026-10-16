import {invoke} from "@tauri-apps/api/core";
import {z} from "zod";
import type {NativeSession} from "../storage/protocol";
import type {McpHostBinding, McpHostCapabilities, McpHostConnection, McpHostServices, McpInvocationIdentity, McpInvocationOutcome, McpPreparedAuthority} from "./mcp";
import {MCP_HOST_ERROR_CODES, McpHostError} from "./mcpErrors";
import {mcpAuthoritySchema, mcpBindingSchema, mcpIdentitySchema, mcpOAuthAttemptSchema, mcpOAuthStatusSchema, mcpReferenceSchema, mcpScopeSchema, mcpTargetSchema, mcpWireBytes, mcpWireId, mcpWireRevision, mcpConnectInputSchema, mcpPrivatePrepareInputSchema, mcpPrivateConfirmInputSchema, ownMcpWireJson} from "./mcpWire";

const replySchema = z.object({version: z.literal(1), operationId: mcpWireId, status: z.enum(["prepared", "unknown", "connected", "completed", "protocolError", "notStarted", "drained", "draining", "unsupported", "canceled"]), hostSessionId: mcpWireId, result: z.unknown().optional(), error: z.object({code: z.enum(MCP_HOST_ERROR_CODES), message: z.string().max(2_000)}).strict().optional()}).strict();
type Reply = z.infer<typeof replySchema>;
type WithoutOperation<T> = Omit<T, "operationId">;
type Action = {readonly type: "capabilities" | "dispose"}
    | ({readonly type: "privatePrepare"} & WithoutOperation<Parameters<McpHostServices["preparePrivateRevision"]>[0]>)
    | {readonly type: "privateStatus"; readonly serverId: string}
    | ({readonly type: "privateConfirm"} & WithoutOperation<Parameters<McpHostServices["confirmPrivateRevision"]>[0]>)
    | ({readonly type: "privateDiscard"} & Parameters<McpHostServices["discardPrivateRevision"]>[0])
    | ({readonly type: "retire"} & Parameters<McpHostServices["retireServer"]>[0])
    | ({readonly type: "connect" | "oauthBegin"} & WithoutOperation<Parameters<McpHostServices["connect"]>[0]>)
    | {readonly type: "disconnect"; readonly binding: McpHostBinding}
    | ({readonly type: "prepare"} & Parameters<McpHostServices["prepare"]>[0])
    | {readonly type: "invoke"; readonly identity: McpInvocationIdentity; readonly arguments: unknown}
    | {readonly type: "status" | "stop"; readonly identity: McpInvocationIdentity}
    | {readonly type: "oauthStatus" | "oauthCancel"; readonly attemptId: string};
const connectedSchema = z.object({binding: mcpBindingSchema, discovery: z.object({tools: z.array(z.unknown()).max(128), resources: z.array(z.unknown()).max(128)}).strict()}).strict();
const referenceReply = z.object({reference: mcpReferenceSchema}).strict();
const confirmedReply = z.object({confirmed: z.literal(true)}).strict();
const capabilitiesSchema = z.object({host: z.literal("desktop"), stdio: z.boolean(), streamableHttp: z.boolean(), oauth: z.boolean(), rememberedCredentials: z.boolean()}).strict();

/** Exact trusted command only; no SDK/raw error reaches diagnostic causes. */
export function createNativeMcpServices(
    getSession: () => Promise<NativeSession>,
    call: (command: string, args: Record<string, unknown>) => Promise<unknown> = invoke,
): McpHostServices {
    let closed = false, hostSessionId: string | undefined, storeSession: string | undefined;
    let originalSession: NativeSession | undefined, handshakeIssued = false;
    let capabilities: McpHostCapabilities = Object.freeze({host: "desktop" as const, stdio: false, streamableHttp: false, oauth: false, rememberedCredentials: false});
    let initialization: Promise<typeof capabilities> | undefined;
    let sequence = 0, disposal: Promise<{readonly status: "drained" | "draining"}> | undefined;
    const retirements = new Map<string, {readonly expected?: number; readonly promise: Promise<{readonly status: "drained" | "draining"}>; settled: boolean}>();
    const nextId = () => `mcp_${++sequence}_${crypto.randomUUID()}`;
    const sessionIdentity = (session: NativeSession) => JSON.stringify([session.version, session.session, session.workspaceId, session.generation]);

    async function request(operationId: string, action: Action, allowClosed = false, beforeDispatch?: () => void): Promise<Reply> {
        mcpWireId.parse(operationId);
        if (closed && !allowClosed) throw new McpHostError("closed", "not_started", operationId);
        if (action.type !== "capabilities" && !allowClosed) await initialize();
        let sent = false;
        try {
            const session = allowClosed && originalSession ? originalSession : await getSession();
            const identity = sessionIdentity(session);
            if (storeSession !== undefined && storeSession !== identity) {
                closed = true;
                throw new McpHostError("closed", "not_started", operationId);
            }
            storeSession = identity;
            originalSession ??= {...session};
            if (closed && !allowClosed) throw new McpHostError("closed", "not_started", operationId);
            beforeDispatch?.();
            sent = true;
            if (action.type === "capabilities") handshakeIssued = true;
            const raw = await call("mcp_service_request", {request: {version: 1, operationId, session, ...(hostSessionId ? {hostSessionId} : {}), action}});
            return acceptReply(raw, operationId);
        } catch (error) {
            if (error instanceof McpHostError) throw error;
            throw new McpHostError("transport", sent ? "unknown" : "not_started", operationId);
        }
    }

    function acceptReply(raw: unknown, operationId: string): Reply {
        mcpWireBytes(raw);
        const reply = replySchema.parse(raw);
        if (reply.operationId !== operationId || hostSessionId !== undefined && reply.hostSessionId !== hostSessionId) throw new McpHostError("protocol", "unknown", operationId);
        hostSessionId = reply.hostSessionId;
        return reply;
    }

    async function initialize(): Promise<typeof capabilities> {
        initialization ??= request(nextId(), {type: "capabilities"}).then(reply => {
            capabilities = Object.freeze(decoded(reply, "completed", capabilitiesSchema));
            return capabilities;
        });
        return initialization;
    }

    function expect(reply: Reply, status: Reply["status"]): unknown {
        if (reply.status !== status) throw new McpHostError(reply.error?.code ?? "protocol", reply.status === "notStarted" || reply.status === "unsupported" || reply.status === "canceled" ? "not_started" : "unknown", reply.operationId);
        return reply.result;
    }
    function decoded<T>(reply: Reply, status: Reply["status"], schema: z.ZodType<T>): T {
        try {return schema.parse(expect(reply, status));}
        catch (error) {if (error instanceof McpHostError) throw error; throw new McpHostError("protocol", "unknown", reply.operationId);}
    }
    function drain(reply: Reply): {readonly status: "drained" | "draining"} {
        if (reply.status !== "drained" && reply.status !== "draining") throw new McpHostError(reply.error?.code ?? "protocol", "unknown", reply.operationId);
        return {status: reply.status};
    }
    function outcome(reply: Reply): McpInvocationOutcome {
        switch (reply.status) {
            case "completed": return {status: "completed", operationId: reply.operationId, result: reply.result};
            case "protocolError": return {status: "protocol_error", operationId: reply.operationId, code: reply.error?.code === "unsupported" ? "unsupported" : "remote_error"};
            case "notStarted": return {status: "not_started", operationId: reply.operationId, code: reply.error?.code === "retired" ? "retired" : "denied"};
            case "canceled": return {status: "not_started", operationId: reply.operationId, code: "canceled"};
            case "unsupported": return {status: "protocol_error", operationId: reply.operationId, code: "unsupported"};
            case "unknown": {
                let code: "session_expired" | "stopped" | "reply_lost" = "reply_lost";
                if (reply.error?.code === "session_expired" || reply.error?.code === "stopped") code = reply.error.code;
                return {status: "unknown", operationId: reply.operationId, code};
            }
            case "connected": case "drained": case "draining": case "prepared": throw new McpHostError("protocol", "unknown", reply.operationId);
        }
    }
    async function invokeOnce(identity: McpInvocationIdentity, action: Action, beforeDispatch?: () => void): Promise<McpInvocationOutcome> {
        mcpIdentitySchema.parse(identity);
        try {return outcome(await request(identity.operationId, action, false, beforeDispatch));}
        catch (error) {
            if (error instanceof McpHostError && error.certainty === "unknown") return {status: "unknown", operationId: identity.operationId, code: "reply_lost"};
            throw error;
        }
    }
    function owned<T>(operationId: string, read: () => T): T {
        try {return read();} catch {throw new McpHostError("invalid", "not_started", operationId);}
    }
    const services: McpHostServices = {
        get active() {return !closed;}, get capabilities() {return capabilities;}, initialize,
        async preparePrivateRevision(input) {
            const parsed = owned(input.operationId, () => {const value = mcpPrivatePrepareInputSchema.parse(input); mcpWireBytes(value.config, 32_768); return value;});
            const {operationId, ...fields} = parsed;
            const reply = await request(operationId, {type: "privatePrepare", ...fields});
            return decoded(reply, "prepared", referenceReply).reference;
        },
        async privateRevisionStatus(input) {
            const reply = await request(input.operationId, {type: "privateStatus", serverId: mcpWireId.parse(input.serverId)});
            return reply.status === "unknown" ? {status: "unknown"} : {status: "prepared", reference: decoded(reply, "prepared", referenceReply).reference};
        },
        async confirmPrivateRevision(input) {
            const {operationId, ...fields} = owned(input.operationId, () => mcpPrivateConfirmInputSchema.parse(input));
            const reply = await request(operationId, {type: "privateConfirm", ...fields});
            decoded(reply, "completed", confirmedReply);
        },
        async discardPrivateRevision(input) {expect(await request(nextId(), {type: "privateDiscard", serverId: mcpWireId.parse(input.serverId), reference: mcpReferenceSchema.parse(input.reference)}), "completed");},
        retireServer(input) {
            const operationId = nextId(), serverId = owned(operationId, () => mcpWireId.parse(input.serverId));
            const expected = input.expectedConfigRevision;
            const existing = retirements.get(serverId);
            if (existing && !existing.settled && existing.expected === expected) return existing.promise;
            const fields = expected === undefined ? {} : {expectedConfigRevision: owned(operationId, () => mcpWireRevision.parse(expected))};
            const prior = existing && !existing.settled ? existing.promise.catch(() => undefined) : Promise.resolve();
            const entry = {expected, settled: false, promise: prior.then(() => request(operationId, {type: "retire", serverId, ...fields})).then(drain)};
            retirements.set(serverId, entry);
            void entry.promise.then(() => {entry.settled = true; if (retirements.get(serverId) === entry) retirements.delete(serverId);}, () => {entry.settled = true;});
            return entry.promise;
        },
        async connect(input, signal) {
            signal.throwIfAborted();
            const parsed = owned(input.operationId, () => mcpConnectInputSchema.parse(input));
            const abort = () => {void services.retireServer({serverId: parsed.serverId}).catch(() => undefined);};
            signal.addEventListener("abort", abort, {once: true});
            try {
                const {operationId, ...fields} = parsed;
                await retirements.get(parsed.serverId)?.promise;
                const check = () => {if (signal.aborted) throw new McpHostError("canceled", "not_started", operationId);};
                check();
                const reply = await request(operationId, {type: "connect", ...fields}, false, check);
                const connected: McpHostConnection = decoded(reply, "connected", connectedSchema);
                if (connected.binding.serverId !== parsed.serverId || connected.binding.configRevision !== parsed.configRevision || connected.binding.hostSessionId !== hostSessionId) throw new McpHostError("protocol", "unknown", input.operationId);
                if (closed || signal.aborted) {void services.disconnect(connected.binding).catch(() => undefined); throw new McpHostError("retired", "unknown", input.operationId);}
                return connected;
            } finally {signal.removeEventListener("abort", abort);}
        },
        async disconnect(input) {const operationId = nextId(); const binding = owned(operationId, () => mcpBindingSchema.parse(input)); return drain(await request(operationId, {type: "disconnect", binding}));},
        async prepare(input) {
            const operationId = nextId();
            const binding = owned(operationId, () => mcpBindingSchema.parse(input.binding));
            const scope = owned(operationId, () => mcpScopeSchema.parse(input.scope));
            const target = owned(operationId, () => mcpTargetSchema.parse(input.target));
            const args = owned(operationId, () => ownMcpWireJson(input.arguments, 16_384));
            const reply = await request(operationId, {type: "prepare", binding, scope, target, arguments: args});
            const authority: McpPreparedAuthority = decoded(reply, "prepared", mcpAuthoritySchema);
            if (JSON.stringify(authority.binding) !== JSON.stringify(binding) || JSON.stringify(authority.scope) !== JSON.stringify(scope) || JSON.stringify(authority.target) !== JSON.stringify(target)) throw new McpHostError("protocol", "unknown", operationId);
            return authority;
        },
        async invoke(input, signal) {
            signal.throwIfAborted();
            const identity = owned(input.operationId, () => mcpIdentitySchema.parse({operationId: input.operationId, authority: input.authority}));
            const args = owned(input.operationId, () => ownMcpWireJson(input.arguments, 16_384));
            const abort = () => {void services.stop(identity).catch(() => undefined);};
            signal.addEventListener("abort", abort, {once: true});
            try {return await invokeOnce(identity, {type: "invoke", identity, arguments: args}, () => {
                if (signal.aborted) throw new McpHostError("canceled", "not_started", identity.operationId);
            });}
            finally {signal.removeEventListener("abort", abort);}
        },
        async invocationStatus(input) {const identity = owned(input.operationId, () => mcpIdentitySchema.parse(input)); return invokeOnce(identity, {type: "status", identity});},
        async stop(input) {const identity = owned(input.operationId, () => mcpIdentitySchema.parse(input)); return invokeOnce(identity, {type: "stop", identity});},
        async oauthBegin(input) {const {operationId, ...fields} = owned(input.operationId, () => mcpConnectInputSchema.parse(input)); return decoded(await request(operationId, {type: "oauthBegin", ...fields}), "prepared", mcpOAuthAttemptSchema);},
        async oauthStatus(attemptId) {const status = decoded(await request(nextId(), {type: "oauthStatus", attemptId: mcpWireId.parse(attemptId)}), "prepared", mcpOAuthStatusSchema); if (status.attemptId !== attemptId) throw new McpHostError("protocol", "unknown", attemptId); return status;},
        async oauthCancel(attemptId) {expect(await request(nextId(), {type: "oauthCancel", attemptId: mcpWireId.parse(attemptId)}), "canceled");},
        dispose() {
            closed = true;
            disposal ??= (async () => {
                // A capability handshake may already have admitted a native host. Wait for
                // that original reply before disposing it; never report early drainage.
                if (initialization) {try {await initialization;} catch { /* The original host may still exist. */ }}
                if (!hostSessionId) return {status: handshakeIssued ? "draining" as const : "drained" as const};
                try {return drain(await request(nextId(), {type: "dispose"}, true));}
                catch {return {status: "draining" as const};}
            })().then(result => {
                // A draining result is progress, not a final acknowledgement. A later
                // call asks the same native owner again; concurrent callers share this one.
                if (result.status === "draining") disposal = undefined;
                return result;
            });
            return disposal;
        },
    };
    return services;
}
