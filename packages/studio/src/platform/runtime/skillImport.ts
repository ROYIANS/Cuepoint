import {productEffectAdmission} from "./effectAdmission";
import {invoke} from "@tauri-apps/api/core";
import {z} from "zod";
import type {NativeSession} from "../storage/protocol";

const originalSelections = new Set<Promise<SkillDirectorySnapshot>>();
let shutdownSelections: Promise<void> | undefined;

const MAX_RESPONSE_BYTES = 2_097_152;
const encoder = new TextEncoder();
const operationIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);
const pathSchema = z.string().min(1).refine(path => {
    const segments = path.split("/");
    return encoder.encode(path).byteLength <= 512 && segments.length <= 4
        && !/[\\:<>"|?*\p{Cc}\p{Cf}]/u.test(path)
        && segments.every(part => part && part !== "." && part !== ".." && !/[ .]$/u.test(part)
            && encoder.encode(part).byteLength <= 255
            && !/^(?:con|prn|aux|nul|conin\$|conout\$|clock\$|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/iu.test(part));
});
const snapshotSchema = z.discriminatedUnion("status", [
    z.object({status: z.literal("canceled"), operationId: operationIdSchema}).strict(),
    z.object({
        status: z.literal("captured"), operationId: operationIdSchema,
        directoryName: z.string().max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
        files: z.array(z.object({path: pathSchema, text: z.string().refine(text => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text) && !text.includes("\0"))}).strict()).min(1).max(32),
        exclusions: z.object({count: z.number().int().min(0).max(1_024), paths: z.array(pathSchema).max(20)}).strict(),
    }).strict(),
]);

export type SkillDirectorySnapshot =
    | {readonly status: "captured"; readonly operationId: string; readonly directoryName: string;
        readonly files: readonly {readonly path: string; readonly text: string}[];
        readonly exclusions: {readonly count: number; readonly paths: readonly string[]}}
    | {readonly status: "canceled"; readonly operationId: string};

export interface SkillDirectoryImportServices {
    pickDirectory(operationId: string): Promise<SkillDirectorySnapshot>;
}

const failureSchema = z.object({code: z.string().min(1).max(80), message: z.string().max(2_000)}).strict();
function selectionError(cause: unknown): Error {
    const failure = failureSchema.safeParse(cause);
    if (failure.success) {
        switch (failure.data.code) {
            case "platform": return new Error("选择技能文件夹需要 macOS 或 Windows 桌面版。", {cause});
            case "nativeFilesystem": case "nativeIdentity":
                return new Error("无法安全读取这个位置；Windows 请使用本地固定 NTFS 磁盘中的技能文件夹。", {cause});
            case "busy": return new Error("技能文件夹选择仍在进行，请先完成当前系统窗口。", {cause});
            case "changed": return new Error("技能文件夹在读取时发生变化，请重新选择。", {cause});
            case "containment": return new Error("技能文件夹不能包含链接、别名或跨磁盘的内容。", {cause});
            case "skillLimit": return new Error("技能目录超过文本文件数量、层级或大小限制，请精简后重新选择。", {cause});
            case "skillText": return new Error("技能内容必须是有效的 UTF-8 文本，请检查文件后重新选择。", {cause});
            case "skillRoot": return new Error("请选择根目录包含 SKILL.md 的技能文件夹。", {cause});
            case "skillPath": return new Error("技能文件名不符合可移植路径要求，请检查后重新选择。", {cause});
        }
    }
    // A picker has no installation effect. A lost reply is not proof that its
    // system window closed; the native owner still excludes another selection.
    return new Error("未能取得技能文件夹内容，请完成系统选择窗口后重新选择。", {cause});
}

function decodeSnapshot(raw: unknown, operationId: string): SkillDirectorySnapshot {
    const json = JSON.stringify(raw);
    if (json === undefined || encoder.encode(json).byteLength > MAX_RESPONSE_BYTES) throw new Error("技能目录返回内容过大");
    const result = snapshotSchema.parse(raw);
    if (result.operationId !== operationId) throw new Error("技能目录选择结果不匹配");
    if (result.status === "canceled") return Object.freeze(result);
    if (result.exclusions.count < result.exclusions.paths.length || result.files.length + result.exclusions.count > 1_024) throw new Error("技能目录排除列表无效");
    let total = 0;
    const seen = new Set<string>();
    for (const file of result.files) {
        const folded = file.path.normalize("NFC").toUpperCase().toLowerCase();
        if (seen.has(folded)) throw new Error("技能目录包含重名文件");
        seen.add(folded);
        const bytes = encoder.encode(file.text).byteLength;
        const supported = file.path === "SKILL.md" || file.path === "LICENSE" || file.path === "LICENSE.txt"
            || /^(?:references|assets)\/.+\.(?:md|txt|json|yaml|yml|csv)$/iu.test(file.path)
                && !file.path.toLowerCase().endsWith("/skill.md") && !file.path.split("/").some(part => part.startsWith("."));
        if (!supported || bytes > (file.path === "SKILL.md" ? 40_976 : 131_072)) throw new Error("技能目录返回文件无效");
        total += bytes;
    }
    if (!result.files.some(file => file.path === "SKILL.md") || total > 524_288) throw new Error("技能目录文本不完整或过大");
    return Object.freeze({...result, files: Object.freeze(result.files.map(file => Object.freeze(file))),
        exclusions: Object.freeze({...result.exclusions, paths: Object.freeze(result.exclusions.paths)})});
}

/** Installed beside the fixed native ProductStore, never as an arbitrary path reader. */
export function createSkillDirectoryImportServices(
    getSession: () => Promise<NativeSession>,
    call: (command: string, args: Record<string, unknown>) => Promise<unknown> = invoke,
): SkillDirectoryImportServices {
    let pending = false;
    return {pickDirectory(operationId) {
        if (!productEffectAdmission.open || shutdownSelections) return Promise.reject(new Error("应用正在退出，无法选择技能目录"));
        let resolve!: (value: SkillDirectorySnapshot) => void, reject!: (cause: unknown) => void;
        const done = new Promise<SkillDirectorySnapshot>((yes, no) => {resolve = yes; reject = no;});
        originalSelections.add(done);
        void select(operationId).then(value => {originalSelections.delete(done); resolve(value);}, cause => {originalSelections.delete(done); reject(cause);});
        return done;
    }};
    async function select(operationId: string): Promise<SkillDirectorySnapshot> {
        operationIdSchema.parse(operationId);
        if (pending) throw new Error("技能文件夹选择仍在进行，请先完成当前系统窗口。");
        pending = true;
        try {
            const session = await getSession();
            productEffectAdmission.assertOpen();
            const raw = await call("skill_import_directory", {request: {...session, operationId}});
            return decodeSnapshot(raw, operationId);
        } catch (cause) {
            throw selectionError(cause);
        } finally {
            pending = false;
        }
    }
}

export function shutdownSkillDirectoryImports(): Promise<void> {
    shutdownSelections ??= Promise.allSettled([...originalSelections]).then(() => undefined);
    return shutdownSelections;
}

let installed: SkillDirectoryImportServices | undefined;
export function installSkillDirectoryImportServices(services: SkillDirectoryImportServices): void {
    if (installed) throw new Error("技能目录服务已安装");
    installed = services;
}
export function skillDirectoryImportServices(): SkillDirectoryImportServices | undefined {return installed;}
