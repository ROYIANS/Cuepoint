export type FriendlyMessage = { title: string; hint?: string };

function str(value: unknown): string {
    return typeof value === "string" ? value : "";
}

/** User-facing copy by error category. Never includes stacks or internal identifiers. */
export function friendlyMessage(cause: unknown): FriendlyMessage {
    const obj = typeof cause === "object" && cause !== null ? cause as Record<string, unknown> : {};
    const name = str(obj.name);
    const message = cause instanceof Error ? cause.message : str(cause);
    if (name === "AbortError" || /canceled|cancelled/i.test(str(obj.code)) || name === "CanceledError") {
        return {title: "操作已取消"};
    }
    if (name === "StorageError" || name === "UnknownCommitError" || obj.certainty === "unknown" || obj.certainty === "rollback") {
        return obj.certainty === "unknown"
            ? {title: "保存结果待确认", hint: "结果待确认，请先核对再重试"}
            : {title: "保存失败", hint: "未保存，已回滚"};
    }
    if (name === "TimeoutError" || /timed? ?out|超时/i.test(message) || (name === "TypeError" && /failed to fetch|network|load failed/i.test(message)) || /network|网络/i.test(name)) {
        return {title: "网络请求失败", hint: "请检查网络连接或稍后重试"};
    }
    if (name === "ZodError" || name === "ToolValidationError" || name === "ValidationError" || name === "PackageError" || name === "CheckpointValidationError") {
        return {title: "内容未通过校验", hint: "请检查输入后重试"};
    }
    return {title: "出了点问题", hint: "可以重试；如果问题持续，请查看详情并反馈"};
}
