/** Portable text-skill limits. Installation and resource authority remain host-owned. */
export const SKILL_LIMITS = Object.freeze({
    nameScalars: 64,
    descriptionScalars: 1_024,
    frontmatterBytes: 8_192,
    bodyBytes: 32_768,
    resourceBytes: 131_072,
    packageBytes: 524_288,
    fileCount: 32,
    pathDepth: 4,
    pathBytes: 512,
    pathSegmentBytes: 255,
    directoryEntries: 1_024,
    installedCount: 32,
    enabledCount: 16,
    catalogueBytes: 24_576,
    persistedValueBytes: 2_097_152,
    retainedRevisionCount: 128,
    retainedBytes: 67_108_864,
    readScalars: 8_192,
});

export interface SkillDocumentParts {
    readonly frontmatter: string;
    readonly body: string;
}

/** Descriptive data only: none of these fields enable tools or grant access. */
export interface SkillMetadata {
    readonly name: string;
    readonly description: string;
    readonly license?: string;
    readonly compatibility?: string;
    readonly metadata?: Readonly<Record<string, string>>;
    readonly allowedTools?: string;
    readonly unsupportedFields: readonly string[];
}

/** Installation generation and immutable content identity are deliberately separate. */
export interface InstalledSkillDescriptor {
    readonly skillId: string;
    readonly revision: string;
    readonly metadata: SkillMetadata;
}

export interface SkillTextRange {
    readonly text: string;
    readonly offset: number;
    readonly nextOffset: number;
    readonly end: boolean;
}

const encoder = new TextEncoder();
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const identityPattern = /^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/;
const supportedFields = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const textExtension = /\.(?:md|txt|json|yaml|yml|csv)$/i;
const windowsDevice = /^(?:con|prn|aux|nul|conin\$|conout\$|clock\$|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i;

function assertUnicodeText(value: unknown): asserts value is string {
    if (typeof value !== 'string' || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
        throw new Error('技能内容必须是有效的 Unicode 文本');
    }
}

function assertByteLimit(text: string, limit: number, label: string): void {
    if (encoder.encode(text).byteLength > limit) throw new Error(`${label}超过 ${limit} 字节限制`);
}

function plainRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function metadataText(value: unknown, field: string, limit: number): string {
    assertUnicodeText(value);
    const scalars = Array.from(value);
    const hasControl = scalars.some(char => {
        const code = char.codePointAt(0)!;
        return code < 32 && ![9, 10, 13].includes(code) || code >= 127 && code <= 159;
    });
    if (!value.trim() || scalars.length > limit || hasControl) {
        throw new Error(`技能 ${field} 必须是非空文本，且不超过 ${limit} 个字符`);
    }
    return value;
}

function unsupportedMetadataFields(decoded: Record<string, unknown>): string[] {
    const fields = Object.keys(decoded);
    if (fields.length > 32) throw new Error('技能 frontmatter 字段超过限制');
    const unsupported: string[] = [];
    for (const field of fields) {
        metadataText(field, '字段名', 64);
        if (supportedFields.has(field)) continue;
        const value = decoded[field];
        if (value !== null && typeof value !== 'string' && typeof value !== 'boolean' && !(typeof value === 'number' && Number.isFinite(value))) {
            throw new Error(`技能未支持字段 ${field} 不能包含结构化数据`);
        }
        if (typeof value === 'string') {
            assertUnicodeText(value);
            assertByteLimit(value, SKILL_LIMITS.frontmatterBytes, '技能未支持字段');
        }
        unsupported.push(field);
    }
    return unsupported;
}

function descriptiveMetadata(value: unknown): Readonly<Record<string, string>> | undefined {
    if (value === undefined) return undefined;
    if (!plainRecord(value) || Object.keys(value).length > 32) throw new Error('技能 metadata 必须是有限的文本字段对象');
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [
        metadataText(key, 'metadata 字段名', 64), metadataText(item, 'metadata 值', 1_024),
    ])));
}

/** Split delimiters only. A host must safely decode the returned YAML as unknown. */
export function splitSkillDocument(document: string): SkillDocumentParts {
    assertUnicodeText(document);
    // Reject a large input before looking for delimiters; preserve the host's original bytes separately.
    assertByteLimit(document, SKILL_LIMITS.frontmatterBytes + SKILL_LIMITS.bodyBytes + 16, 'SKILL.md');
    const start = document.charCodeAt(0) === 0xFEFF ? 1 : 0;
    const opening = /^---\r?\n/u.exec(document.slice(start));
    if (!opening) throw new Error('SKILL.md 必须以 YAML frontmatter 开始');
    const contentStart = start + opening[0].length;
    const closing = /^---(?:\r?\n|$)/gmu;
    closing.lastIndex = contentStart;
    const match = closing.exec(document);
    if (!match) throw new Error('SKILL.md 缺少 frontmatter 结束分隔符');
    const frontmatter = document.slice(contentStart, match.index);
    const body = document.slice(match.index + match[0].length);
    assertByteLimit(frontmatter, SKILL_LIMITS.frontmatterBytes, '技能 frontmatter');
    assertByteLimit(body, SKILL_LIMITS.bodyBytes, '技能正文');
    return Object.freeze({frontmatter, body});
}

/** Validate decoded YAML without interpreting optional metadata as execution policy. */
export function validateSkillMetadata(decoded: unknown, directoryName?: string): SkillMetadata {
    if (!plainRecord(decoded)) throw new Error('技能 frontmatter 必须是对象');
    const name = metadataText(decoded.name, 'name', SKILL_LIMITS.nameScalars);
    if (!namePattern.test(name)) throw new Error('技能 name 必须是小写字母、数字和单个连字符组成的标识');
    if (directoryName !== undefined && directoryName !== name) throw new Error('技能 name 必须与所选文件夹名称一致');
    const description = metadataText(decoded.description, 'description', SKILL_LIMITS.descriptionScalars);
    const unsupportedFields = unsupportedMetadataFields(decoded);
    const license = decoded.license === undefined ? undefined : metadataText(decoded.license, 'license', 1_024);
    const compatibility = decoded.compatibility === undefined ? undefined : metadataText(decoded.compatibility, 'compatibility', 500);
    const allowedTools = decoded['allowed-tools'] === undefined ? undefined : metadataText(decoded['allowed-tools'], 'allowed-tools', 1_024);
    if (allowedTools !== undefined) unsupportedFields.push('allowed-tools');
    const metadata = descriptiveMetadata(decoded.metadata);
    return Object.freeze({name, description,
        ...(license !== undefined ? {license} : {}),
        ...(compatibility !== undefined ? {compatibility} : {}),
        ...(metadata !== undefined ? {metadata} : {}),
        ...(allowedTools !== undefined ? {allowedTools} : {}),
        unsupportedFields: Object.freeze(unsupportedFields.sort()),
    });
}

/** Logical captured-manifest name only; this is never an OS containment check. */
export function validateSkillResourcePath(path: string): string {
    assertUnicodeText(path);
    assertByteLimit(path, SKILL_LIMITS.pathBytes, '技能资源路径');
    const parts = path.split('/');
    if (!path || parts.length > SKILL_LIMITS.pathDepth || /[\\:<>"|?*\p{Cc}\p{Cf}]/u.test(path)
        || parts.some(part => !part || part.startsWith('.') || /[. ]$/u.test(part) || windowsDevice.test(part)
            || encoder.encode(part).byteLength > SKILL_LIMITS.pathSegmentBytes)) {
        throw new Error('技能资源必须使用安全的相对逻辑路径');
    }
    if (path === 'LICENSE' || path === 'LICENSE.txt') return path;
    if (parts.length < 2 || !['references', 'assets'].includes(parts[0]) || !textExtension.test(parts[parts.length - 1])
        || parts.some(part => part.toLowerCase() === 'skill.md')) {
        throw new Error('技能资源仅支持 references/、assets/ 下的文本和根目录 LICENSE');
    }
    return path;
}

/** Reject ambiguous component identities as well as duplicate complete file names. */
export function validateSkillResourcePaths(paths: readonly string[]): readonly string[] {
    if (paths.length >= SKILL_LIMITS.fileCount) throw new Error('技能文本文件数量超过限制');
    const spellings = new Map<string, string>();
    const leaves = new Set<string>();
    for (const raw of paths) {
        const path = validateSkillResourcePath(raw);
        const parts = path.split('/');
        for (let index = 1; index <= parts.length; index++) {
            const prefix = parts.slice(0, index).join('/');
            const key = prefix.normalize('NFC').toUpperCase().toLowerCase();
            const existing = spellings.get(key);
            if (existing !== undefined && existing !== prefix || index < parts.length && leaves.has(key)) {
                throw new Error('技能资源路径存在大小写、Unicode 或文件夹身份冲突');
            }
            spellings.set(key, prefix);
            if (index === parts.length) {
                if (leaves.has(key) || [...spellings.keys()].some(other => other.startsWith(`${key}/`))) {
                    throw new Error('技能资源路径重复或与文件夹冲突');
                }
                leaves.add(key);
            }
        }
    }
    return Object.freeze([...paths].sort());
}

/** Only metadata is rendered. JSON escaping prevents content from ending host delimiters. */
export function formatSkillCatalogue(entries: readonly InstalledSkillDescriptor[]): string {
    if (entries.length > SKILL_LIMITS.enabledCount) throw new Error('同时启用的安装技能超过限制');
    if (!entries.length) return '';
    const identities = new Set<string>();
    const names = new Set<string>();
    const skills = entries.map(entry => {
        for (const identity of [entry.skillId, entry.revision]) {
            if (typeof identity !== 'string' || identity.length > 128 || !identityPattern.test(identity)) throw new Error('技能安装或内容标识无效');
        }
        const name = metadataText(entry.metadata.name, 'name', SKILL_LIMITS.nameScalars);
        const description = metadataText(entry.metadata.description, 'description', SKILL_LIMITS.descriptionScalars);
        if (!namePattern.test(name)) throw new Error('技能 name 标识无效');
        if (identities.has(entry.skillId) || names.has(name)) throw new Error('技能目录存在重复安装或名称');
        identities.add(entry.skillId); names.add(name);
        return {skillId: entry.skillId, revision: entry.revision, name, description};
    });
    skills.sort((left, right) => {
        if (left.name < right.name) return -1;
        return left.name > right.name ? 1 : 0;
    });
    const result = JSON.stringify({version: 1, skills}).replace(/[<>&\u007F-\u009F\u2028\u2029]/gu,
        value => `\\u${value.charCodeAt(0).toString(16).padStart(4, '0')}`);
    assertByteLimit(result, SKILL_LIMITS.catalogueBytes, '技能目录');
    return result;
}

/** Unicode scalar offsets are independent of UTF-8 bytes and UTF-16 code units. */
export function readSkillTextRange(text: string, offset: number = 0, limit: number = SKILL_LIMITS.readScalars): SkillTextRange {
    assertUnicodeText(text);
    assertByteLimit(text, SKILL_LIMITS.resourceBytes, '技能资源');
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > SKILL_LIMITS.readScalars) {
        throw new Error('技能资源读取范围无效');
    }
    const scalars = Array.from(text);
    if (offset > scalars.length) throw new Error('技能资源读取起点超过文本长度');
    const nextOffset = Math.min(scalars.length, offset + limit);
    return Object.freeze({text: scalars.slice(offset, nextOffset).join(''), offset, nextOffset, end: nextOffset === scalars.length});
}
