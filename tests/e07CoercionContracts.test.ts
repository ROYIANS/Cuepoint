import Dexie from "dexie";
import JSZip from "jszip";
import {describe, expect, it} from "vitest";
import {db} from "@/db/database";
import {createProject, updateWorldSetting} from "@/db/projects";
import {firstEpisode, patchStoryBeat, updateEpisodeDraft} from "@/db/episodes";
import {emptyProject} from "@/db/productionRecords";
import {emptySlot, parseGenerationSlot, parseShotPictureSlots, remapSlot, slotMediaIds} from "@/domain/slot";
import {normalizeEpisodeStory, normalizeSeriesStory, normalizeSetting, PACKAGE_FORMAT} from "@/domain/types";
import {defaultImageGeneration} from "@/domain/output";
import {exportProjectZip, importProjectZip, PackageError} from "@/lib/projectPackage";
import {parseProjectPackageRows} from "@/lib/packages/projectPackageCodec";
import {DraftConflictError} from "@/lib/draftConflict";
import {targetRevision} from "@/lib/productionRevision";

type Row = Record<string, unknown>;
type Rows = {project: Row; characters: Row[]; scenes: Row[]; props: Row[]; styles: Row[]; episodes?: Row[]; shots: Row[]};

function records(modern = true): Rows {
    return {
        project: {id: "original", name: "source", story: {logline: "series", script: "script", beats: [{id: "beat"}]}},
        characters: [{id: "character", name: "character"}], scenes: [{id: "scene", name: "scene"}],
        props: [{id: "prop", name: "prop"}], styles: [{id: "style", name: "style"}],
        ...(modern ? {episodes: [{id: "episode", story: {logline: "episode", script: "script", beats: [{id: "beat"}]}}]} : {}),
        shots: [{id: "shot", episodeId: modern ? "episode" : "ignored-old-scope", beatId: "beat"}],
    };
}

async function packageBlob(rows: Rows, media: string[] = []): Promise<Blob> {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({format: PACKAGE_FORMAT}));
    for (const [name, value] of Object.entries(rows)) if (value !== undefined) zip.file(`${name}.json`, JSON.stringify(value));
    for (const id of media) zip.file(`media/${id}.png`, new Uint8Array([1, 2, 3]));
    return zip.generateAsync({type: "blob"});
}

async function snapshot() {
    return Promise.all(db.tables.map(async table => ({name: table.name, rows: await table.toArray()})));
}

const textFields = {
    characters: ["name", "bio", "appearance", "notes", "createdAt", "updatedAt"],
    scenes: ["name", "location", "timeOfDay", "atmosphere", "notes", "createdAt", "updatedAt"],
    props: ["name", "kind", "notes", "createdAt", "updatedAt"],
    styles: ["name", "notes", "createdAt", "updatedAt"],
    episodes: ["title", "createdAt", "updatedAt"],
    shots: ["shotNumber", "category", "content", "notes", "sceneCloseup", "sound", "emotion", "cameraAngle", "cameraGear", "focalLength"],
} as const;
const scalarCases = [
    {label: "unicode", value: " 原文🌟\n", text: " 原文🌟\n"},
    {label: "empty", value: "", text: ""}, {label: "whitespace", value: " \t ", text: " \t "},
    {label: "zero", value: 0, text: "0"}, {label: "number", value: 4.5, text: "4.5"},
    {label: "false", value: false, text: "false"}, {label: "true", value: true, text: "true"},
    {label: "null", value: null, text: undefined}, {label: "missing", value: undefined, text: undefined},
];

describe.each([true, false])("legacy scalar ZIP compatibility (modern=%s)", modern => {
    it.each(scalarCases)("persists every legacy prose field and repeat roundtrips $label", async ({value, text}) => {
        const rows = records(modern);
        rows.project.name = value;
        rows.project.createdAt = value;
        rows.project.updatedAt = value;
        rows.project.story = {logline: value, script: value, beats: [{id: "beat", title: value, content: value, timeOfDay: value}]};
        rows.project.setting = {worldview: value, background: value, rules: value};
        for (const [owner, fields] of Object.entries(textFields)) {
            const row = rows[owner as keyof typeof textFields]?.[0];
            if (row) for (const field of fields) row[field] = value;
        }
        if (rows.episodes) rows.episodes[0].story = rows.project.story;
        rows.shots[0].firstFrame = {prompt: value};
        const parsed = parseProjectPackageRows(rows);
        expect(parsed.project.name).toBe(text ?? "导入的项目");
        if (text !== undefined) expect(parsed.project).toMatchObject({createdAt: text, updatedAt: text});
        const imported = await importProjectZip(await packageBlob(rows));
        const again = await importProjectZip(await exportProjectZip(imported.id));
        for (const project of [imported, again]) {
            expect(project.name).toBe(text ?? "导入的项目");
            expect(project.story.logline).toBe(text ?? "");
            expect(project.setting).toEqual({worldview: text ?? "", background: text ?? "", rules: text ?? ""});
            for (const [owner, fields] of Object.entries(textFields)) {
                const [row] = await db.table<Row>(owner).where("projectId").equals(project.id).toArray();
                for (const field of fields) {
                    if (owner === "episodes" && !modern) {
                        if (field === "title") expect(row[field]).toBe("");
                        else expect(typeof row[field]).toBe("string");
                        continue;
                    }
                    if ((field === "createdAt" || field === "updatedAt") && text === undefined) expect(typeof row[field]).toBe("string");
                    else {
                        const nameDefaults: Record<string, string> = {characters: "未命名角色", scenes: "未命名场景", props: "未命名道具", styles: "未命名风格"};
                        const fallback = field === "name" ? nameDefaults[owner] : field === "shotNumber" ? "1" : "";
                        expect(row[field], `${owner}.${field}`).toBe(text ?? fallback);
                    }
                }
            }
            const [episode] = await db.episodes.where("projectId").equals(project.id).toArray();
            expect(episode.story).toMatchObject({logline: text ?? "", script: text ?? ""});
            expect(episode.story.beats[0]).toMatchObject({title: text ?? "", content: text ?? "", timeOfDay: text ?? ""});
            const [shot] = await db.shots.where("projectId").equals(project.id).toArray();
            expect(shot.episodeId).toBe(episode.id);
            expect(shot.beatId).toBe(episode.story.beats[0].id);
            expect(shot.firstFrame.prompt).toBe(text ?? "");
        }
    });
});

// Exercise real ZIP writes and path errors, including adjacent reference fields that
// map(String) previously hid from the typed diagnostic slice.
const compoundCases: {path: string; mutate: (rows: Rows, value: unknown) => void}[] = [];
for (const field of ["id", "name", "createdAt", "updatedAt", "coverMediaId"]) compoundCases.push({
    path: `project.json.${field}`, mutate: (rows, value) => { rows.project[field] = value; },
});
for (const [owner, fields] of Object.entries(textFields)) for (const field of ["id", ...fields]) compoundCases.push({
    path: `${owner}.json[0].${field}`, mutate: (rows, value) => { rows[owner as keyof typeof textFields]![0][field] = value; },
});
for (const field of ["logline", "script"]) compoundCases.push({path: `episodes.json[0].story.${field}`, mutate: (rows, value) => {rows.episodes![0].story = {[field]: value, beats: [{id: "beat"}]};}});
for (const field of ["id", "title", "content", "timeOfDay", "sceneId"]) compoundCases.push({path: `episodes.json[0].story.beats[0].${field}`, mutate: (rows, value) => {
    rows.episodes![0].story = {beats: [{id: "beat", [field]: value}]}; delete rows.shots[0].beatId;
}});
for (const field of ["worldview", "background", "rules"]) compoundCases.push({path: `project.json.setting.${field}`, mutate: (rows, value) => {rows.project.setting = {[field]: value};}});
compoundCases.push(
    {path: "shots.json[0].firstFrame.prompt", mutate: (rows, value) => {rows.shots[0].firstFrame = {prompt: value};}},
    {path: "characters.json[0].slots.front.result.mediaId", mutate: (rows, value) => {rows.characters[0].slots = {front: {result: {mediaId: value}}};}},
    {path: "scenes.json[0].images.wide", mutate: (rows, value) => {rows.scenes[0].images = {wide: value};}},
    {path: "shots.json[0].frameMediaId", mutate: (rows, value) => {rows.shots[0].frameMediaId = value;}},
    {path: "shots.json[0].referenceMediaId", mutate: (rows, value) => {rows.shots[0].referenceMediaId = value;}},
    {path: "shots.json[0].firstFrame.referenceImageIds[0]", mutate: (rows, value) => {rows.shots[0].firstFrame = {referenceImageIds: [value]};}},
    {path: "shots.json[0].firstFrame.referenceVideoIds[0]", mutate: (rows, value) => {rows.shots[0].firstFrame = {referenceVideoIds: [value]};}},
    {path: "shots.json[0].characterIds[0]", mutate: (rows, value) => {rows.shots[0].characterIds = [value];}},
    {path: "shots.json[0].sceneId", mutate: (rows, value) => {rows.shots[0].sceneId = value;}},
    {path: "episodes.json[0].story.beats[0].characterIds[0]", mutate: (rows, value) => {rows.episodes![0].story = {beats: [{id: "beat", characterIds: [value]}]};}},
    {path: "episodes.json[0].story.beats[0].scriptRange.excerpt", mutate: (rows, value) => {rows.episodes![0].story = {beats: [{id: "beat", scriptRange: {start: 0, end: 1, excerpt: value}}]};}},
);

describe.each([{label: "object", value: {bad: "field"}}, {label: "array", value: ["bad", "field"]}])("compound known fields: $label", ({value}) => {
    it.each(compoundCases)("rejects $path before any table write", async ({path, mutate}) => {
        const existing = await createProject("existing data");
        await db.media.add({id: "existing-media", projectId: existing.id, filename: "existing.png", mimeType: "image/png", blob: new Blob(["existing"])});
        const before = await snapshot();
        const rows = records();
        mutate(rows, value);
        let error: unknown;
        try { await importProjectZip(await packageBlob(rows, ["unused"])); } catch (caught) {error = caught;}
        expect(error).toBeInstanceOf(PackageError);
        expect((error as Error).message).toContain(path);
        expect(await snapshot()).toEqual(before);
    });
});

describe("original identities and independent import domains", () => {
    it.each([true, false, 0, 7, null, undefined, "", {}, []])("rejects modern original episode FK %j without repair eligibility", async value => {
        const rows = records(); rows.shots[0].episodeId = value;
        const before = await snapshot();
        await expect(importProjectZip(await packageBlob(rows))).rejects.toThrow("shots.json[0].episodeId：分镜必须引用包内有效的原始分集 ID");
        expect(await snapshot()).toEqual(before);
    });
    it.each([true, 7, {}, [], "foreign"])("rejects modern original beat FK %j", async value => {
        const rows = records(); rows.shots[0].beatId = value;
        await expect(importProjectZip(await packageBlob(rows))).rejects.toThrow("shots.json[0].beatId：分镜场次必须属于它引用的分集");
        expect(await db.projects.count()).toBe(0);
    });
    it.each([0, false, true, 7])("rejects references to repaired original episode/beat scalar identities %j", async value => {
        const episodeRows = records(); episodeRows.episodes![0].id = value; episodeRows.shots[0].episodeId = String(value);
        await expect(importProjectZip(await packageBlob(episodeRows))).rejects.toThrow("shots.json[0].episodeId：分镜必须引用包内有效的原始分集 ID");
        const beatRows = records(); beatRows.episodes![0].story = {beats: [{id: value}]}; beatRows.shots[0].beatId = String(value);
        await expect(importProjectZip(await packageBlob(beatRows))).rejects.toThrow("shots.json[0].beatId：分镜场次必须属于它引用的分集");
        expect(await db.projects.count()).toBe(0);
    });
    it.each([false, 0, null, undefined, ""])("keeps falsey beat absence %j", async value => {
        const rows = records(); rows.shots[0].beatId = value;
        const project = await importProjectZip(await packageBlob(rows));
        expect((await db.shots.where("projectId").equals(project.id).first())?.beatId).toBeUndefined();
    });
    it.each([{}, [], false, 0, "orphan"])("ignores legacy episode scope %j and synthesizes only one owner", async value => {
        const rows = records(false); rows.episodes = []; rows.shots[0].episodeId = value;
        const project = await importProjectZip(await packageBlob(rows));
        const [episode] = await db.episodes.where("projectId").equals(project.id).toArray();
        expect(await db.episodes.where("projectId").equals(project.id).count()).toBe(1);
        expect(await db.shots.where("projectId").equals(project.id).first()).toMatchObject({episodeId: episode.id, beatId: episode.story.beats[0].id});
    });
    it.each([0, false, true, 7])("remaps unique primitive IDs %j without treating them as original modern FKs", async value => {
        const rows = records(false);
        rows.characters[0].id = value; rows.scenes[0].id = value; rows.props[0].id = value; rows.styles[0].id = value; rows.shots[0].id = value;
        rows.project.defaultStyleId = String(value);
        rows.project.story = {beats: [{id: value, characterIds: [value], sceneId: value}]};
        rows.shots[0] = {...rows.shots[0], beatId: value, characterIds: [value], sceneId: value, propIds: [String(value)], styleId: String(value)};
        const project = await importProjectZip(await packageBlob(rows));
        const [character] = await db.characters.where("projectId").equals(project.id).toArray();
        const [scene] = await db.scenes.where("projectId").equals(project.id).toArray();
        const [style] = await db.styles.where("projectId").equals(project.id).toArray();
        const [prop] = await db.props.where("projectId").equals(project.id).toArray();
        const [episode] = await db.episodes.where("projectId").equals(project.id).toArray();
        const [shot] = await db.shots.where("projectId").equals(project.id).toArray();
        expect(shot).toMatchObject({characterIds: [character.id], propIds: [prop.id], styleId: style.id});
        expect(project.defaultStyleId).toBe(style.id);
        // Optional false/zero scene/beat inputs retain their historical absence rules.
        expect(shot.sceneId).toBe(value ? scene.id : undefined);
        expect(shot.beatId).toBe(value ? episode.story.beats[0].id : undefined);
        expect(new Set([character.id, scene.id, style.id, prop.id, shot.id, episode.id]).size).toBe(6);
    });
    it.each([0, false, true, 7, null, undefined])("keeps unreferenced modern primitive/nullish identities %j independent", async value => {
        const rows = records(); rows.shots = [];
        rows.episodes![0].id = value;
        rows.episodes![0].story = {beats: [{id: value}]};
        const project = await importProjectZip(await packageBlob(rows));
        const [episode] = await db.episodes.where("projectId").equals(project.id).toArray();
        expect(typeof episode.id).toBe("string");
        expect(typeof episode.story.beats[0].id).toBe("string");
        expect(episode.id).not.toBe(episode.story.beats[0].id);
    });
    it("rejects an empty beat identity before remapping its graph", async () => {
        const rows = records(); delete rows.shots[0].beatId;
        rows.episodes![0].story = {beats: [{id: ""}]};
        await expect(importProjectZip(await packageBlob(rows))).rejects.toThrow("episodes.json[0].story.beats[0].id");
        expect(await db.projects.count()).toBe(0);
    });
    it.each(["project", "characters", "scenes", "props", "styles", "episodes", "shots"] as const)("rejects explicitly empty %s identity before persistence", async owner => {
        const rows = records();
        const row = owner === "project" ? rows.project : rows[owner]![0]; row.id = "";
        const path = owner === "project" ? "project.json.id" : `${owner}.json[0].id`;
        await expect(importProjectZip(await packageBlob(rows))).rejects.toThrow(path);
        expect(await db.projects.count()).toBe(0);
    });
});

describe("extension, style and media ownership", () => {
    it("preserves structured extras and future profiles across restore/export while remapping only owned relationships", async () => {
        const rows = records();
        const extra = {sourceAssetId: "original-library-id", nested: {retained: true}, array: [{future: [1, false]}]};
        const generationDefaults = {image: {...defaultImageGeneration(), model: "future-model", profileVersion: "future", size: "future-size", extra: {nativeParams: {future: [1, false]}}}};
        rows.project.generationDefaults = generationDefaults;
        rows.project.future = extra;
        rows.characters[0].extra = extra;
        // A legacy slot named "id" is not the row identity; its empty media stays empty.
        rows.characters[0].images = {id: ""};
        rows.project.defaultStyleId = "style";
        rows.shots.push({id: "null-style", episodeId: "episode", styleId: null}, {id: "missing-style", episodeId: "episode", styleId: "foreign"});
        rows.shots[0].firstFrame = {prompt: "authored", referenceImageIds: ["reference"], result: {mediaId: "current", kind: "image"}};
        rows.shots[0].clip = {prompt: "video authored", referenceVideoIds: ["reference"], result: {mediaId: "video", kind: "video"}};
        const project = await importProjectZip(await packageBlob(rows, ["current", "reference", "video"]));
        for (const imported of [project, await importProjectZip(await exportProjectZip(project.id))]) {
            expect(imported.extra?.future).toEqual(extra);
            expect(imported.generationDefaults).toMatchObject(generationDefaults);
            expect((await db.characters.where("projectId").equals(imported.id).first())?.extra).toEqual(extra);
            expect((await db.characters.where("projectId").equals(imported.id).first())?.slots).toHaveProperty("id", emptySlot());
            const shots = await db.shots.where("projectId").equals(imported.id).sortBy("order");
            expect(shots.map(shot => shot.styleId)).toEqual([undefined, null, null]);
            expect(imported.defaultStyleId).toBe((await db.styles.where("projectId").equals(imported.id).first())?.id);
            expect(shots[0].firstFrame.prompt).toBe("authored"); expect(shots[0].clip.prompt).toBe("video authored");
            expect(shots[0].clip.result?.kind).toBe("video");
            for (const id of [...slotMediaIds(shots[0].firstFrame), ...slotMediaIds(shots[0].clip)]) {
                expect((await db.media.get(id))?.projectId).toBe(imported.id);
            }
            expect(shots[1].firstFrame).toEqual(emptySlot()); expect(shots[1].clip).toEqual(emptySlot());
        }
    });
    it.each([0, false, " ", " current "])("keeps cover scalar lookup separate from its whitespace existence probe: %j", async value => {
        const rows = records(false); rows.project.coverMediaId = value;
        const imported = await importProjectZip(await packageBlob(rows, [String(value)]));
        if (value === " ") expect(imported.coverMediaId).toBeUndefined();
        else expect((await db.media.get(imported.coverMediaId!))?.projectId).toBe(imported.id);
    });
});

describe("persisted slot recovery and story evidence", () => {
    it("keeps current result ownership, primitive distinctions, legacy references and remapped media roles", () => {
        const slot = parseGenerationSlot({prompt: false, referenceImageIds: [0, false, null, "", {}, ["other"]], referenceVideoIds: [true], result: {mediaId: "current", kind: "video"}}, "legacy");
        expect(slot).toEqual({prompt: "false", referenceImageIds: ["0", "false", "null", ""], referenceVideoIds: ["true"], result: {mediaId: "current", kind: "video"}});
        const pictures = parseShotPictureSlots({frame: {prompt: "", result: {mediaId: "current", kind: "image"}}, reference: {prompt: "legacy prompt", referenceImageIds: ["reference"], result: {mediaId: "reference", kind: "image"}}});
        expect(pictures.firstFrame).toEqual({prompt: "legacy prompt", referenceImageIds: ["reference"], referenceVideoIds: [], result: {mediaId: "current", kind: "image"}});
        expect(pictures.lastFrame).toEqual(emptySlot()); expect(pictures.clip).toEqual(emptySlot());
        expect(remapSlot(pictures.firstFrame, id => id ? `new-${id}` : undefined)).toMatchObject({result: {mediaId: "new-current"}, referenceImageIds: ["new-reference"]});
    });
    it.each([0, false, null, "", {}, []])("recovers unusable current media %j through a valid legacy association", value => {
        expect(parseGenerationSlot({prompt: {bad: true}, result: {mediaId: value, kind: "video"}}, "legacy")).toEqual({...emptySlot(), result: {mediaId: "legacy", kind: "image"}});
        expect(parseGenerationSlot(undefined, value).result).toBeUndefined();
    });
    it.each([true, 7])("retains truthy scalar current/legacy media spelling %j and exact video kind", value => {
        expect(parseGenerationSlot({result: {mediaId: value, kind: "VIDEO"}}, "legacy").result).toEqual({mediaId: String(value), kind: "image"});
        expect(parseGenerationSlot(undefined, value).result).toEqual({mediaId: String(value), kind: "image"});
    });
    it.each([{}, []])("drops malformed local script offset %j while preserving the beat", value => {
        const story = normalizeEpisodeStory({script: "x", beats: [{id: "beat", content: "retain", scriptRange: {start: value, end: 1, excerpt: "x"}}]});
        expect(story.beats[0]).toMatchObject({id: "beat", content: "retain"});
        expect(story.beats[0].scriptRange).toBeUndefined();
    });
    it("recovers local prose and malformed relations without inventing script evidence or merging beat identities", () => {
        const raw = {logline: {}, script: "🌟0", beats: [
            {id: {}, title: [], content: 0, timeOfDay: false, characterIds: ["real", {}, ["real"]], sceneId: {}, scriptRange: {start: 0, end: 2, excerpt: "🌟"}},
            {id: "beat_0", title: "explicit", scriptRange: {start: 0, end: 2, excerpt: []}},
            {id: "numeric-excerpt", scriptRange: {start: 2, end: 3, excerpt: 0}},
        ]};
        const before = structuredClone(raw);
        const story = normalizeEpisodeStory(raw);
        expect(raw).toEqual(before);
        expect(story.logline).toBe("");
        expect(story.beats[0]).toMatchObject({title: "", content: "0", timeOfDay: "false", characterIds: ["real"], sceneId: undefined, scriptRange: {start: 0, end: 2, excerpt: "🌟"}});
        expect(new Set(story.beats.map(beat => beat.id)).size).toBe(3);
        expect(normalizeEpisodeStory(raw)).toEqual(story);
        expect(story.beats[1].scriptRange).toBeUndefined(); expect(story.beats[2].scriptRange).toBeUndefined();
        expect(normalizeEpisodeStory({...raw, script: "changed"}).beats[0].scriptRange).toBeUndefined();
        expect(normalizeSeriesStory({logline: 0})).toEqual({logline: "0"});
        expect(normalizeSetting({worldview: false, background: [], rules: null})).toEqual({worldview: "false", background: "", rules: ""});
    });
    it("merges normalized episode/beat edits, rejects competing edits and retains raw world-setting CAS", async () => {
        const project = await createProject("CAS"); const episode = (await firstEpisode(project.id))!;
        await db.table<Row>("episodes").update(episode.id, {story: {logline: {}, script: false, beats: [{id: "beat", content: [], title: "opening"}]}});
        const rawEpisode = (await db.episodes.get(episode.id))!;
        const editor = normalizeEpisodeStory(rawEpisode.story);
        const revision = targetRevision(rawEpisode);
        expect(targetRevision({...rawEpisode, story: editor})).not.toBe(revision);
        await db.episodes.update(episode.id, {title: "other tab"});
        await updateEpisodeDraft(episode.id, {script: "mine"}, {script: editor.script});
        await patchStoryBeat(episode.id, "beat", {content: "mine", timeOfDay: "night"}, {content: editor.beats[0].content, timeOfDay: ""});
        expect((await db.episodes.get(episode.id))?.title).toBe("other tab");
        const before = await snapshot();
        await expect(updateEpisodeDraft(episode.id, {script: "stale"}, {script: editor.script})).rejects.toBeInstanceOf(DraftConflictError);
        await expect(patchStoryBeat(episode.id, "beat", {content: "stale"}, {content: editor.beats[0].content})).rejects.toBeInstanceOf(DraftConflictError);
        expect(await snapshot()).toEqual(before);
        await db.table<Row>("projects").update(project.id, {setting: {worldview: {}, background: "old", rules: ""}});
        const rawProject = (await db.projects.get(project.id))!;
        const setting = normalizeSetting(rawProject.setting);
        // This owner uses raw CAS. Recovery is read-only: never conceal a raw competing value.
        await expect(updateWorldSetting(project.id, {worldview: "replacement"}, {worldview: setting.worldview})).rejects.toBeInstanceOf(DraftConflictError);
        expect((await db.projects.get(project.id))?.setting).toEqual(rawProject.setting);
        await updateWorldSetting(project.id, {background: "mine"}, {background: "old"});
        await expect(updateWorldSetting(project.id, {background: "stale"}, {background: "old"})).rejects.toBeInstanceOf(DraftConflictError);
    });
});

describe("actual v1/v2 persisted upgrade", () => {
    it.each([1, 2])("migrates v%s orphan scopes and malformed prose while retaining genuine media", async version => {
        const project = emptyProject("legacy");
        await db.delete();
        const legacy = new Dexie(db.name);
        const schema = {projects: "id, updatedAt", characters: "id, projectId, updatedAt", scenes: "id, projectId, updatedAt", shots: "id, projectId, order", media: "id, projectId"};
        legacy.version(version).stores(version === 2 ? {...schema, props: "id, projectId, updatedAt", styles: "id, projectId, updatedAt"} : schema);
        await legacy.open();
        await legacy.table<Row>("projects").add({...project, createdAt: false, story: {logline: 0, script: false, beats: []}});
        const owners = [undefined, "orphan", "", 0, false, {}, []];
        for (const [index, episodeId] of owners.entries()) await legacy.table<Row>("shots").add({id: `shot-${index}`, projectId: project.id, order: index, episodeId,
            frameMediaId: "frame", referenceMediaId: "reference", firstFrame: {prompt: {bad: true}, referenceImageIds: [{bad: true}]} });
        for (const id of ["frame", "reference"]) await legacy.table<Row>("media").add({id, projectId: project.id, filename: `${id}.png`, mimeType: "image/png", blob: new Blob([id])});
        legacy.close();
        await db.open();
        const [episode] = await db.episodes.where("projectId").equals(project.id).toArray();
        expect(episode).toMatchObject({createdAt: "false", story: {logline: "0", script: "false"}});
        const shots = await db.shots.where("projectId").equals(project.id).toArray();
        expect(shots).toHaveLength(owners.length);
        for (const shot of shots) {
            expect(shot.episodeId).toBe(episode.id);
            expect(shot.firstFrame).toEqual({prompt: "", referenceImageIds: ["reference"], referenceVideoIds: [], result: {mediaId: "frame", kind: "image"}});
            expect(shot).not.toHaveProperty("frameMediaId");
        }
        expect(await db.media.count()).toBe(2);
        expect((await db.projects.get(project.id))?.story.logline).toBe("0");
    });
    it.each([7, [7]])("aborts invalid legacy project identity %j atomically instead of rekeying ownership", async invalidId => {
        await db.delete(); const legacy = new Dexie(db.name);
        legacy.version(1).stores({projects: "id, updatedAt", characters: "id, projectId, updatedAt", scenes: "id, projectId, updatedAt", shots: "id, projectId, order", media: "id, projectId"});
        await legacy.open();
        await legacy.table<Row>("projects").bulkAdd([{id: "valid", name: "valid"}, {id: invalidId, name: "invalid"}]);
        await legacy.table<Row>("shots").add({id: "shot", projectId: "valid", frameMediaId: "original"});
        legacy.close();
        await expect(db.open()).rejects.toThrow("旧项目 ID 无效");
        const original = new Dexie(db.name); original.version(1).stores({projects: "id, updatedAt", characters: "id, projectId, updatedAt", scenes: "id, projectId, updatedAt", shots: "id, projectId, order", media: "id, projectId"});
        await original.open();
        expect(await original.table<Row>("projects").toArray()).toEqual(expect.arrayContaining([{id: invalidId, name: "invalid"}, {id: "valid", name: "valid"}]));
        expect(await original.table("projects").count()).toBe(2);
        expect(await original.table<Row>("shots").toArray()).toEqual([{id: "shot", projectId: "valid", frameMediaId: "original"}]);
        expect(original.tables.some(table => table.name === "episodes")).toBe(false);
        original.close();
    });
});
