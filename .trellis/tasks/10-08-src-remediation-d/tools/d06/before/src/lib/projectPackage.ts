import {AUDIO_TABLES} from "@/db/audioShared";
import {insertAudioPackage, snapshotAudioPackage} from "./audioProjectPackage";
import {getProjectKind, PACKAGE_FORMAT, type Id, type Project, type MediaRecord} from "@/domain/types";
import {remapReferencePackage} from "./references/package";
import JSZip from "jszip";
import {z} from "zod";
import {db} from "@/db/database";
import {collectMediaIds} from "@/db/media";
import {createId, nowIso} from "./ids";
import {asRecord, asArray, remapId, parseProjectPackageRows, remapProjectPackageRows} from "./packages/projectPackageCodec";
import {PackageError} from "./packages/packageError";
export {PackageError} from "./packages/packageError";

const manifestSchema = z.object({
    format: z.literal(PACKAGE_FORMAT),
    exportedAt: z.string().optional(),
});

function extFor(mimeType: string, filename: string): string {
    const fromName = filename.split(".").pop();
    if (fromName && fromName !== filename && fromName.length <= 5)
        return fromName;
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("quicktime")) return "mov";
    if (mimeType.startsWith("audio/")) {
        if (mimeType.includes("wav")) return "wav";
        if (mimeType.includes("mpeg")) return "mp3";
        if (mimeType.includes("ogg")) return "ogg";
        if (mimeType.includes("flac")) return "flac";
        if (mimeType.includes("aac")) return "aac";
        return "audio";
    }
    if (mimeType.startsWith("video/")) return "mp4";
    return "jpg";
}

function mimeForFilename(filename: string): string {
    const extension = filename.split(".").pop()?.toLowerCase();
    const known: Record<string, string> = {
        wav: "audio/wav",
        mp3: "audio/mpeg",
        ogg: "audio/ogg",
        opus: "audio/ogg",
        flac: "audio/flac",
        aac: "audio/aac",
        m4a: "audio/mp4",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        jfif: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
    };
    return (extension && known[extension]) || "application/octet-stream";
}

export async function exportProjectZip(projectId: Id): Promise<Blob> {
    // Snapshot all JSON rows and referenced Blobs under one read transaction.
    // Compression happens after the transaction closes; no external awaits hold it open.
    const {
        audioPackage,
        project,
        characters,
        scenes,
        props,
        styles,
        episodes,
        shots,
        mediaRecords,
        memories,
        memoryVersions,
        references,
        referenceChunks,
    } = await db.transaction(
        "r",
        [
            ...AUDIO_TABLES,
            db.projects,
            db.characters,
            db.scenes,
            db.props,
            db.styles,
            db.episodes,
            db.shots,
            db.media,
            db.materialUses,
            db.projectMemories,
            db.projectMemoryVersions,
            db.projectReferences,
            db.referenceChunks,
        ],
        async () => {
            const project = await db.projects.get(projectId);
            if (!project) throw new PackageError("项目不存在");
            const [
                characters,
                scenes,
                props,
                styles,
                episodes,
                shots,
                memories,
                memoryVersions,
                references,
                referenceChunks,
            ] = await Promise.all([
                db.characters.where("projectId").equals(projectId).toArray(),
                db.scenes.where("projectId").equals(projectId).toArray(),
                db.props.where("projectId").equals(projectId).toArray(),
                db.styles.where("projectId").equals(projectId).toArray(),
                db.episodes.where("projectId").equals(projectId).sortBy("order"),
                db.shots.where("projectId").equals(projectId).sortBy("order"),
                db.projectMemories.where("projectId").equals(projectId).toArray(),
                db.projectMemoryVersions.where("projectId").equals(projectId).toArray(),
                db.projectReferences.where("projectId").equals(projectId).toArray(),
                db.referenceChunks.where("projectId").equals(projectId).toArray(),
            ]);
            const mediaIds = await collectMediaIds(projectId);
            const mediaRecords = (await db.media.bulkGet([...mediaIds])).filter(
                (media): media is MediaRecord =>
                    media !== undefined && media.projectId === projectId,
            );
            if (getProjectKind(project) !== "video" && mediaRecords.length !== mediaIds.size) throw new PackageError("音频项目存在缺失或归属错误的文件，请恢复文件后再备份");
            return {
                audioPackage: await snapshotAudioPackage(projectId),
                project,
                characters,
                scenes,
                props,
                styles,
                episodes,
                shots,
                mediaRecords,
                memories,
                memoryVersions,
                references,
                referenceChunks,
            };
        },
    );
    const zip = new JSZip();
    zip.file(
        "manifest.json",
        JSON.stringify(
            {
                format: PACKAGE_FORMAT,
                exportedAt: nowIso(),
                projectName: project.name,
            },
            null,
            2,
        ),
    );
    if (getProjectKind(project) !== "video") zip.file("audioProject.json", JSON.stringify(audioPackage));
    zip.file("project.json", JSON.stringify(project, null, 2));
    zip.file("characters.json", JSON.stringify(characters, null, 2));
    zip.file("scenes.json", JSON.stringify(scenes, null, 2));
    zip.file("props.json", JSON.stringify(props, null, 2));
    zip.file("styles.json", JSON.stringify(styles, null, 2));
    zip.file("episodes.json", JSON.stringify(episodes, null, 2));
    zip.file("shots.json", JSON.stringify(shots, null, 2));
    zip.file("memories.json", JSON.stringify(memories, null, 2));
    zip.file("memoryVersions.json", JSON.stringify(memoryVersions, null, 2));
    zip.file("references.json", JSON.stringify(references));
    zip.file("referenceChunks.json", JSON.stringify(referenceChunks));
    zip.file("mediaMetadata.json", JSON.stringify(mediaRecords.map((media) => ({
        id: media.id,
        projectId: media.projectId,
        filename: media.filename,
        mimeType: media.mimeType,
        libraryRetained: media.libraryRetained,
    }))));
    for (const media of mediaRecords) {
        const filename = `media/${media.id}.${extFor(media.mimeType, media.filename)}`;
        zip.file(filename, media.blob);
    }
    return zip.generateAsync({type: "blob"});
}

export async function importProjectZip(file: Blob): Promise<Project> {
    const zip = await JSZip.loadAsync(file).catch(() => {
        throw new PackageError("无法读取 zip 文件");
    });
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) throw new PackageError("缺少 manifest.json");
    const manifestJson = JSON.parse(
        await manifestFile.async("string"),
    ) as unknown;
    const manifest = manifestSchema.safeParse(manifestJson);
    if (!manifest.success) {
        throw new PackageError("不是小光点项目包（manifest.format 不匹配）");
    }

    const readJson = async (name: string, required = false) => {
        const entry = zip.file(name);
        if (!entry) {
            if (required) throw new PackageError(`缺少 ${name}`);
            return undefined;
        }
        try {
            return JSON.parse(await entry.async("string")) as unknown;
        } catch {
            throw new PackageError(`${name} 不是合法 JSON`);
        }
    };

    const parsed = parseProjectPackageRows({
        project: await readJson("project.json", true), characters: await readJson("characters.json"),
        scenes: await readJson("scenes.json"), props: await readJson("props.json"), styles: await readJson("styles.json"),
        episodes: await readJson("episodes.json"), shots: await readJson("shots.json"), memories: await readJson("memories.json"),
        memoryVersions: await readJson("memoryVersions.json"), references: await readJson("references.json"),
        referenceChunks: await readJson("referenceChunks.json"), audioPackage: await readJson("audioProject.json"),
    });
    const {projectRaw, referencePackage} = parsed;
    const mediaMetadataRaw = await readJson("mediaMetadata.json");
    const mediaMetadata = new Map<string, { filename: string; mimeType: string; libraryRetained?: boolean }>();
    if (mediaMetadataRaw !== undefined) {
        for (const raw of asArray(mediaMetadataRaw, "mediaMetadata.json")) {
            const row = asRecord(raw, "mediaMetadata.json");
            if (typeof row.id !== "string" || !row.id || /[/\\]/.test(row.id) || mediaMetadata.has(row.id)
                || row.projectId !== projectRaw.id || typeof row.filename !== "string" || !row.filename
                || typeof row.mimeType !== "string" || !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+(?:;[a-zA-Z0-9=._ ,"+-]+)*$/.test(row.mimeType)) {
                throw new PackageError("媒体元数据无效、重复或不属于当前项目");
            }
            if (row.libraryRetained !== undefined && typeof row.libraryRetained !== "boolean") throw new PackageError("素材保留标记无效");
            mediaMetadata.set(row.id, {
                filename: row.filename,
                mimeType: row.mimeType,
                libraryRetained: row.libraryRetained
            });
        }
    }
    const projectId = createId("prj");
    const at = nowIso();
    const mediaMap = new Map<string, string>();
    const mediaRecords: MediaRecord[] = [];
    const mediaFiles = zip.file(/^media\//);
    for (const entry of mediaFiles) {
        if (entry.dir) continue;
        const base = entry.name.split("/").pop() ?? entry.name;
        const oldId = base.replace(/\.[^.]+$/, "");
        if (mediaMap.has(oldId)) throw new PackageError("项目包中存在重复媒体 ID");
        const metadata = mediaMetadata.get(oldId);
        if (mediaMetadataRaw !== undefined && !metadata) throw new PackageError("媒体缺少元数据");
        const newId = remapId(mediaMap, oldId, "med")!;
        const blob = await entry.async("blob");
        const mimeType = metadata?.mimeType ?? (blob.type || mimeForFilename(base));
        mediaRecords.push({
            id: newId,
            projectId,
            mimeType,
            filename: metadata?.filename ?? base,
            libraryRetained: metadata?.libraryRetained,
            blob: new Blob([blob], {type: mimeType}),
        });
    }

    if ([...mediaMetadata.keys()].some((id) => !mediaMap.has(id))) throw new PackageError("媒体元数据对应的文件缺失");

    const {
        references,
        chunks: referenceChunks
    } = await remapReferencePackage(referencePackage, projectId, mediaMap, mediaRecords);

    const {project, characters, scenes, props, styles, episodes, shots, memories, memoryVersions, remappedAudioPackage} =
        remapProjectPackageRows(parsed, {projectId, at, mediaMap});

    try {
        await db.transaction(
            "rw",
            [
                ...AUDIO_TABLES,
                db.projects,
                db.characters,
                db.scenes,
                db.props,
                db.styles,
                db.episodes,
                db.shots,
                db.media,
                db.projectMemories,
                db.projectMemoryVersions,
                db.projectReferences,
                db.referenceChunks,
            ],
            async () => {
                await db.projects.add(project);
                if (characters.length) await db.characters.bulkAdd(characters);
                if (scenes.length) await db.scenes.bulkAdd(scenes);
                if (props.length) await db.props.bulkAdd(props);
                if (styles.length) await db.styles.bulkAdd(styles);
                if (episodes.length) await db.episodes.bulkAdd(episodes);
                if (shots.length) await db.shots.bulkAdd(shots);
                if (mediaRecords.length) await db.media.bulkAdd(mediaRecords);
                await insertAudioPackage(remappedAudioPackage);
                if (references.length) await db.projectReferences.bulkAdd(references);
                if (referenceChunks.length) await db.referenceChunks.bulkAdd(referenceChunks);
                if (memories.length) await db.projectMemories.bulkAdd(memories);
                if (memoryVersions.length)
                    await db.projectMemoryVersions.bulkAdd(memoryVersions);
            },
        );
    } catch (error) {
        throw new PackageError(
            error instanceof Error ? `导入失败：${error.message}` : "导入失败",
        );
    }

    return project;
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}
