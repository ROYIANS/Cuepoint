import { z } from "zod";

/** A durable, resumable tool is waiting for its external job, not a model turn. */
export class ToolPendingError extends Error {}

export interface ToolValidationIssue {
  path: string;
  constraint: string;
  /** Numeric values or type labels only; never strings supplied by the model. */
  received?: number | string;
}
export interface ToolValidationFailure {
  code: "INVALID_TOOL_ARGUMENTS";
  executed: false;
  error: string;
  issues: ToolValidationIssue[];
  recovery: string;
}

const RECOVERY = "本次调用未执行。若任务仍需要此操作，请修正参数并使用新的工具调用标识发起调用，不要把失败当作成功或自动重放原调用。若已有其他证据足以回答，请明确说明未执行的操作及其对结论的影响。";

export class ToolValidationError extends Error {
  readonly failure: ToolValidationFailure;
  constructor(title: string, name: string, issues: ToolValidationIssue[]) {
    const detail = issues.map((issue) => `${issue.path}：${issue.constraint}${issue.received === undefined ? "" : `（收到 ${issue.received}）`}`).join("；");
    super(`工具 ${title} 的参数无效，未执行。${detail}`.slice(0, 2_048));
    this.name = "ToolValidationError";
    this.failure = {
      code: "INVALID_TOOL_ARGUMENTS", executed: false, error: this.message, issues,
      recovery: RECOVERY + (name === "business_read_text" ? " business_read_text 的 limit 必须是 1 至 12000 的整数；按返回的 nextOffset 分页读取，直到 nextOffset 为空。" : ""),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    string: "文本", number: "数字", integer: "整数", float: "小数", boolean: "布尔值",
    object: "对象", array: "数组", null: "空值", undefined: "未提供", nan: "无效数字",
    date: "日期", bigint: "大整数", symbol: "符号", function: "函数", map: "映射", set: "集合", promise: "异步结果",
  };
  return labels[type] ?? "规定的数据类型";
}

/** Only schema-owned field names may enter diagnostics; unknown keys can contain secrets. */
function safeField(path: Array<string | number>, schema: Record<string, unknown>, raw: unknown) {
  const parts: string[] = [];
  let current: unknown = schema;
  let received = raw;
  for (const segment of path.slice(0, 8)) {
    if (!isRecord(current)) return { path: parts.join(".") || "参数", received: undefined };
    if (typeof segment === "number" && current.type === "array") {
      parts.push(`[${segment}]`);
      current = current.items;
      received = Array.isArray(received) ? received[segment] : undefined;
    } else if (typeof segment === "string" && isRecord(current.properties) && Object.hasOwn(current.properties, segment)) {
      parts.push(segment.slice(0, 64));
      current = current.properties[segment];
      received = isRecord(received) && Object.hasOwn(received, segment) ? received[segment] : undefined;
    } else return { path: parts.join(".") || "参数", received: undefined };
  }
  return { path: parts.join(".") || "参数", received };
}

export function toolArgumentError(title: string, name: string, schema: Record<string, unknown>, raw: unknown, cause: unknown): ToolValidationError {
  const issues: ToolValidationIssue[] = cause instanceof z.ZodError ? cause.issues.slice(0, 6).map((issue) => {
    const field = safeField(issue.path, schema, raw);
    let constraint = "不符合工具要求，请按参数定义修正";
    if (issue.code === "too_big") constraint = `不得${issue.inclusive ? "大于" : "大于或等于"} ${issue.maximum}${issue.type === "string" ? " 个字符" : issue.type === "array" ? " 项" : ""}`;
    else if (issue.code === "too_small") constraint = `不得${issue.inclusive ? "小于" : "小于或等于"} ${issue.minimum}${issue.type === "string" ? " 个字符" : issue.type === "array" ? " 项" : ""}`;
    else if (issue.code === "invalid_type") constraint = `必须是${typeLabel(issue.expected)}`;
    else if (issue.code === "unrecognized_keys") constraint = "包含未允许的字段，请移除定义之外的参数";
    else if (issue.code === "invalid_enum_value" || issue.code === "invalid_literal") constraint = "必须使用参数定义中允许的值";
    else if (issue.code === "custom" && issue.params?.diagnosticCode === "episode_script_path") constraint = "分集剧本必须使用 story.script 字段路径，不能使用 script";
    else if (issue.code === "custom" && issue.params?.diagnosticCode === "business_field_path") constraint = "不是允许的创作字段路径，请先用 business_detail 核对字段层级，再读取文本字段";
    const received = typeof field.received === "number" && Number.isFinite(field.received) ? field.received : typeLabel(field.received === null ? "null" : Array.isArray(field.received) ? "array" : typeof field.received);
    return { path: field.path, constraint, received };
  }) : [{ path: "参数", constraint: cause instanceof SyntaxError ? "必须是有效的 JSON 对象" : "不符合工具要求，请按参数定义修正" }];
  return new ToolValidationError(title, name, issues);
}

/** Read only the explicitly structured, bounded result; legacy generic errors need revalidation. */
export function readToolValidationFailure(result?: string): ToolValidationFailure | undefined {
  if (!result || result.length > 8_192) return;
  try {
    const value: unknown = JSON.parse(result);
    if (!isRecord(value) || value.code !== "INVALID_TOOL_ARGUMENTS" || value.executed !== false || typeof value.error !== "string" || value.error.length > 2_048 || typeof value.recovery !== "string" || value.recovery.length > 2_048 || !Array.isArray(value.issues) || value.issues.length > 6) return;
    const issues: ToolValidationIssue[] = [];
    for (const issue of value.issues) {
      if (!isRecord(issue) || typeof issue.path !== "string" || issue.path.length > 600 || typeof issue.constraint !== "string" || issue.constraint.length > 300 || issue.received !== undefined && !(typeof issue.received === "number" && Number.isFinite(issue.received)) && !(typeof issue.received === "string" && issue.received.length < 80)) return;
      issues.push({ path: issue.path, constraint: issue.constraint, ...(issue.received === undefined ? {} : { received: issue.received as number | string }) });
    }
    return { code: "INVALID_TOOL_ARGUMENTS", executed: false, error: value.error, issues, recovery: value.recovery };
  } catch { return; }
}
