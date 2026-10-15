import {StorageError} from "./errors";
import type {
    CommitResult,
    NativeQuery,
    NativeSession,
    NativeStoreBridge,
    OperationOutcome,
    TransactionHandle,
    WireRowValue
} from "./protocol";
import {IPC_CHUNK_BYTES, IPC_TEXT_CHUNK_BYTES} from "./protocol";
import {TABLE_NAMES} from "./schema";
import {validateRowChange, validateSession, validateWireRow} from "./validate";
import {encodeWireKey, encodeWireText} from "./wireText";

export type NativeInvoke = (command: string, args: Record<string, unknown>) => Promise<unknown>;

function bad(): never {
    throw new StorageError("invalid", "Native storage returned an invalid response");
}

function record(raw: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad();
    const value = raw as Record<string, unknown>;
    if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) return bad();
    return value;
}

function text(raw: unknown): string {
    if (typeof raw !== "string") return bad();
    return raw;
}

function count(raw: unknown): number {
    if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) return bad();
    return raw;
}

function rows(raw: unknown): WireRowValue[] {
    if (!Array.isArray(raw)) return bad();
    return (raw as unknown[]).map(item => {
        if (!item || typeof item !== "object" || !("kind" in item)) return bad();
        if (item.kind === "inline") {
            const value = record(item, ["kind", "row"]);
            return {kind: "inline", row: validateWireRow(value.row)};
        }
        const value = record(item, ["kind", "transferId"]);
        if (value.kind !== "transfer" || !text(value.transferId)) return bad();
        return {kind: "transfer", transferId: text(value.transferId)};
    });
}

function commit(raw: unknown): CommitResult {
    const value = record(raw, ["status", "operationId", "fingerprint", "changeSequence", "tables"]);
    if (value.status !== "committed" || !Array.isArray(value.tables) || value.tables.some(name => !TABLE_NAMES.includes(name as never))) return bad();
    return {
        status: "committed",
        operationId: text(value.operationId),
        fingerprint: text(value.fingerprint),
        changeSequence: count(value.changeSequence),
        tables: value.tables as CommitResult["tables"]
    };
}

function outcome(raw: unknown): OperationOutcome {
    if (raw && typeof raw === "object" && "status" in raw && raw.status === "committed") return commit(raw);
    const value = record(raw, ["status", "operationId"]);
    if (value.status !== "rolledBack" && value.status !== "unknown" && value.status !== "pending" && value.status !== "notFound") return bad();
    return {status: value.status, operationId: text(value.operationId)};
}

/** Rejections emitted explicitly by Rust have known precommit certainty; transport faults do not. */
function transportError(raw: unknown): Error {
    if (raw instanceof Error) return raw;
    if (raw && typeof raw === "object" && "code" in raw && "message" in raw && typeof raw.code === "string" && typeof raw.message === "string") {
        const codes = ["conflict", "constraint", "invalid", "unavailable", "canceled", "closed", "scope"] as const;
        const code = codes.find(code => code === raw.code);
        if (code) return new StorageError(code, raw.message, "rollback");
        // Other Rust codes (for example "schema") are fixed literals; keep them so the report says why.
        if (/^[a-z][a-z-]{0,31}$/.test(raw.code)) return new Error(`原生存储连接失败（${raw.code}）`, {cause: raw});
    }
    return new Error("原生存储连接失败", {cause: raw});
}

export function createNativeStoreBridge(invoke: NativeInvoke): NativeStoreBridge {
    const call = async (type: string, request: unknown) => {
        try {
            return await invoke("product_store_request", {request: {type, request}});
        } catch (error) {
            throw transportError(error);
        }
    };
    const read = async (purpose: "get" | "query" | "count", handle: TransactionHandle, payload: unknown) => {
        const fields = {...sessionFields(handle), handle: handle.handle, operationId: handle.operationId};
        const request = {...fields, ...payload as object};
        if (new TextEncoder().encode(JSON.stringify({
            request: {
                type: purpose,
                request
            }
        })).length <= IPC_CHUNK_BYTES) return call(purpose, request);
        const started = record(await call("requestStart", {...fields, purpose}), ["transferId"]),
            transferId = text(started.transferId);
        const bytes = new TextEncoder().encode(JSON.stringify(payload));
        for (let offset = 0; offset < bytes.length;) {
            let end = Math.min(bytes.length, offset + IPC_TEXT_CHUNK_BYTES);
            while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
            const chunk = new TextDecoder("utf-8", {fatal: true}).decode(bytes.subarray(offset, end));
            const progress = record(await call("requestChunk", {
                ...fields,
                transferId,
                offset,
                payload: chunk
            }), ["nextOffset"]);
            if (count(progress.nextOffset) !== end) return bad();
            offset = end;
        }
        return call("requestFinish", {...fields, transferId});
    };
    const wireQuery = (query: NativeQuery) => ({
        ...query,
        selector: query.selector.kind === "all" ? query.selector : {
            ...query.selector,
            keys: query.selector.keys.map(encodeWireKey)
        }
    });
    return {
        open: async () => validateSession(await call("open", {})),
        begin: async request => {
            const value = record(await call("begin", request), ["version", "session", "workspaceId", "generation", "handle", "operationId"]);
            if (value.version !== 1 || value.session !== request.session || value.workspaceId !== request.workspaceId || value.generation !== request.generation || value.operationId !== request.operationId) return bad();
            return {...sessionFields(request), handle: text(value.handle), operationId: request.operationId};
        },
        get: async request => {
            const value = record(await read("get", request, {
                table: request.table,
                keys: request.keys.map(encodeWireText)
            }), ["rows"]);
            if (!Array.isArray(value.rows)) return bad();
            return {rows: value.rows.map(row => row === null ? null : rows([row])[0])};
        },
        query: async request => {
            const value = record(await read("query", request, {query: wireQuery(request.query)}), ["rows", "cursor", "epoch"]);
            return {
                rows: rows(value.rows),
                cursor: value.cursor === null ? null : text(value.cursor),
                epoch: count(value.epoch)
            };
        },
        count: async request => {
            const value = record(await read("count", request, {query: wireQuery(request.query)}), ["count"]);
            return {count: count(value.count)};
        },
        readTransfer: async request => {
            const value = record(await call("readTransfer", request), ["payload", "offset", "end"]);
            if (typeof value.end !== "boolean") return bad();
            return {payload: text(value.payload), offset: count(value.offset), end: value.end};
        },
        prepare: async request => {
            const value = record(await call("prepare", request), ["nextChunk"]);
            return {nextChunk: count(value.nextChunk)};
        },
        seal: async request => {
            const value = record(await call("seal", request), ["capability", "fingerprint"]);
            return {capability: text(value.capability), fingerprint: text(value.fingerprint)};
        },
        commit: async request => commit(await call("commit", request)),
        validate: async request => {
            const value = await call("validate", request);
            if (value !== null) bad();
        },
        abort: async request => {
            const value = await call("abort", request);
            if (value !== null) bad();
        },
        status: async request => outcome(await call("status", request)),
        changes: async request => {
            const value = record(await call("changes", request), ["changes", "cursor"]);
            if (!Array.isArray(value.changes)) return bad();
            return {
                changes: value.changes.map(change => {
                    if (change && typeof change === "object" && "kind" in change) {
                        const transfer = record(change, ["kind", "transferId"]);
                        if (transfer.kind !== "transfer") return bad();
                        return {kind: "transfer" as const, transferId: text(transfer.transferId)};
                    }
                    return validateRowChange(change);
                }), cursor: value.cursor === null ? null : text(value.cursor)
            };
        },
        readChangeTransfer: async request => {
            const value = record(await call("readChangeTransfer", request), ["payload", "offset", "end"]);
            if (typeof value.end !== "boolean") return bad();
            return {payload: text(value.payload), offset: count(value.offset), end: value.end};
        },
    };
}

function sessionFields(session: NativeSession): NativeSession {
    return {version: 1, session: session.session, workspaceId: session.workspaceId, generation: session.generation};
}
