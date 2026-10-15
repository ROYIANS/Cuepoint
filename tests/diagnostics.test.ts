import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {sanitizeText, sanitizePath} from "@/platform/diagnostics/sanitize";
import {addBreadcrumb, clearBreadcrumbs, getBreadcrumbs} from "@/platform/diagnostics/breadcrumbs";
import {buildDiagnosticReport, buildIssueUrl, toErrorInfo, ISSUE_URL_LIMIT, type DiagnosticContext} from "@/platform/diagnostics/errorReport";
import {friendlyMessage} from "@/platform/diagnostics/friendlyMessage";
import {getLatestError, reportError, resetReportedErrorsForTests} from "@/platform/diagnostics/reportError";
import {StorageError} from "@/platform/storage/errors";

const context: DiagnosticContext = {version: "0.1.1", environment: "browser", platform: "UA", route: "/agent/t1", time: "2026-10-13T00:00:00.000Z"};

describe("sanitizeText", () => {
    it("redacts credential shapes", () => {
        expect(sanitizeText("key sk-abcdef1234567890 end")).not.toContain("abcdef1234567890");
        expect(sanitizeText("Authorization: Basic zzz\nnext")).not.toContain("zzz");
        expect(sanitizeText("Bearer tok_123.abc")).toBe("Bearer [已隐藏]");
        expect(sanitizeText("api_key=SECRET123 x")).not.toContain("SECRET123");
        expect(sanitizeText('{"apiKey": "SECRET456"}')).not.toContain("SECRET456");
    });
    it("redacts generic token, password, cookie and JWT shapes", () => {
        const out = sanitizeText("token=T0K1 password: hunter2 secret_key=S3C access_token: AT1\nCookie: sid=COOKIE1\njwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig");
        for (const leaked of ["T0K1", "hunter2", "S3C", "AT1", "COOKIE1", "eyJzdWIi", "eyJhbGci"]) expect(out).not.toContain(leaked);
    });
    it("replaces user names that contain spaces", () => {
        expect(sanitizeText("open /Users/xiaomeng dao/Library/x.js failed")).toBe("open ~/Library/x.js failed");
    });
    it("strips URL userinfo and query", () => {
        const out = sanitizeText("fetch https://user:pw@api.example.com/v1/chat?token=abc#x failed");
        expect(out).toBe("fetch https://api.example.com/v1/chat failed");
    });
    it("replaces user names in local paths", () => {
        expect(sanitizeText("at /Users/alice/proj/a.ts:1")).toBe("at ~/proj/a.ts:1");
        expect(sanitizeText("/home/bob/x")).toBe("~/x");
        expect(sanitizeText("C:\\Users\\Carol\\AppData\\x")).toBe("~\\AppData\\x");
    });
    it("hides long opaque tokens but not short words or Chinese text", () => {
        expect(sanitizeText(`id ${"a1B2".repeat(10)}`)).toBe("id [已隐藏]");
        expect(sanitizeText("保存失败：镜头 12 的标题过长 index-abc123.js")).toBe("保存失败：镜头 12 的标题过长 index-abc123.js");
    });
    it("truncates and fails closed", () => {
        expect(sanitizeText("ab ".repeat(20), 10)).toBe("ab ab ab a…");
        const bad = {toString() { throw new Error("no"); }} as unknown as string;
        expect(sanitizeText(bad)).toBe("[已隐藏]");
    });
    it("sanitizePath drops query and hash", () => {
        expect(sanitizePath("/p/abc?x=1#y")).toBe("/p/abc");
    });
});

describe("breadcrumbs", () => {
    beforeEach(clearBreadcrumbs);
    it("keeps the latest 30 in order", () => {
        for (let i = 0; i < 35; i++) addBreadcrumb("action", `a${i}`);
        const list = getBreadcrumbs();
        expect(list).toHaveLength(30);
        expect(list[0]?.label).toBe("a5");
        expect(list[29]?.label).toBe("a34");
    });
    it("sanitizes route labels", () => {
        addBreadcrumb("route", "/x?token=1");
        expect(getBreadcrumbs()[0]?.label).toBe("/x");
    });
});

describe("report", () => {
    beforeEach(clearBreadcrumbs);
    it("normalizes certainty and omits content fields", () => {
        const cause = Object.assign(new StorageError("unavailable", "存储失败 sk-abcdef1234567890", "unknown"), {prompt: "我的秘密剧本", apiKey: "KEY-XYZ"});
        const info = toErrorInfo(cause);
        expect(info.certainty).toBe("unknown");
        expect(info.code).toBe("unavailable");
        addBreadcrumb("action", "send-message");
        const text = buildDiagnosticReport(info, context);
        expect(text).not.toContain("我的秘密剧本");
        expect(text).not.toContain("KEY-XYZ");
        expect(text).not.toContain("abcdef1234567890");
        expect(text).toContain("send-message");
        expect(text).toContain("版本: 0.1.1");
    });
    it("reads tool effect certainty", () => {
        expect(toErrorInfo({name: "ToolRecoveryError", message: "m", failure: {code: "c", effectCertainty: "unknown"}}).certainty).toBe("unknown");
    });
    it("bounds the issue url", () => {
        const url = buildIssueUrl({name: "Error", message: "界".repeat(5000), stack: "STACKLINE"}, context);
        expect(url.length).toBeLessThanOrEqual(ISSUE_URL_LIMIT);
        expect(url).toContain("/issues/new?title=");
        expect(decodeURIComponent(url)).not.toContain("STACKLINE");
    });
});

describe("friendlyMessage", () => {
    it("classifies", () => {
        expect(friendlyMessage(new StorageError("unavailable", "x", "unknown")).hint).toBe("结果待确认，请先核对再重试");
        expect(friendlyMessage(new StorageError("unavailable", "x", "rollback")).hint).toBe("未保存，已回滚");
        expect(friendlyMessage(new TypeError("Failed to fetch")).title).toBe("网络请求失败");
        expect(friendlyMessage(new DOMException("a", "AbortError")).title).toBe("操作已取消");
        expect(friendlyMessage({name: "ZodError"}).title).toBe("内容未通过校验");
        const unknown = friendlyMessage(new Error("at foo (/Users/x/a.ts)"));
        expect(unknown.title).not.toContain("/Users");
    });
});

describe("reportError", () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); resetReportedErrorsForTests(); });
    afterEach(() => vi.useRealTimers());
    it("ignores AbortError", () => {
        expect(reportError(new DOMException("a", "AbortError"), {source: "global"})).toBeNull();
        expect(reportError(Object.assign(new Error("a"), {name: "AbortError"}), {source: "global"})).toBeNull();
        // A wrapper whose cause chain holds an abort is still a normal cancellation.
        expect(reportError(new Error("wrapped", {cause: new DOMException("a", "AbortError")}), {source: "global"})).toBeNull();
        expect(reportError(new Error("outer", {cause: new Error("mid", {cause: Object.assign(new Error("a"), {name: "AbortError"})})}), {source: "global"})).toBeNull();
        // A cause chain without an abort is still reported.
        expect(reportError(new Error("wrapped real", {cause: new Error("db down")}), {source: "global"})).not.toBeNull();
        expect(getLatestError()?.info.message).toBe("wrapped real");
    });
    it("dedupes within one second only", () => {
        const make = () => new Error("same");
        const e = make();
        expect(reportError(e, {source: "boundary"})).not.toBeNull();
        expect(reportError(e, {source: "boundary"})).toBeNull();
        vi.advanceTimersByTime(1001);
        expect(reportError(e, {source: "boundary"})).not.toBeNull();
        expect(getLatestError()?.info.message).toBe("same");
    });
});
