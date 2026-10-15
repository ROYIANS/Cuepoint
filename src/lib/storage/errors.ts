export type StorageErrorCode =
    "conflict"
    | "constraint"
    | "invalid"
    | "unavailable"
    | "canceled"
    | "closed"
    | "scope"
    | "unknownCommit";

/** A rejected acknowledgement is not evidence that a native COMMIT rolled back. */
export class StorageError extends Error {
    readonly name = "StorageError";

    constructor(readonly code: StorageErrorCode, message: string, readonly certainty: "rollback" | "unknown" = "rollback", options?: ErrorOptions) {
        super(message, options);
    }
}

export class UnknownCommitError extends StorageError {
    constructor(readonly operationId: string, readonly workspaceId: string, cause?: unknown) {
        super("unknownCommit", "无法确认保存结果，请重新打开工作区后核对；不要重复执行已付费或写入操作", "unknown", {cause});
    }
}

export function storageError(error: unknown): StorageError {
    if (error instanceof StorageError) return error;
    if (error instanceof Error && (error.name === "ConstraintError" || error.name === "DataError")) {
        return new StorageError(error.name === "ConstraintError" ? "constraint" : "invalid", error.message, "rollback", {cause: error});
    }
    return new StorageError("unavailable", "工作区存储操作失败", "rollback", {cause: error});
}
