from pathlib import Path
p=Path('src/lib/agent/businessStore.ts');s=p.read_text();s=s.replace('    type MediaRecord,','    type MediaRecord,\n    type Project, type Episode, type Shot, type StoryBeat,\n    type Character, type Scene, type Prop, type VisualStyle,')
pos=s.index('export const BUSINESS_LABELS');s=s[:pos]+'''type RowByKind = {
    project: Project; episode: Episode; shot: Shot;
    beat: StoryBeat & {projectId: string; episodeId: string; order?: number};
    character: Character; scene: Scene; prop: Prop; style: VisualStyle;
    media: ReturnType<typeof metadata>;
};
export type OwnedBusinessRecord = {[K in BusinessKind]: {kind: K; row: RowByKind[K]}}[BusinessKind];

'''+s[pos:];start=s.index('export async function getRow(');end=s.index('\nconst visibleFields:',start)
s=s[:start]+'''/** Owned typed records are used by commands; dynamic views remain presentation only. */
export async function readBusinessRecord(kind: BusinessKind, id: string, ownerId?: string, episodeId?: string): Promise<OwnedBusinessRecord> {
    if (kind === "project") {
        if (id === STUDIO_LIBRARY_ID) throw new Error("工作室不是项目");
        const project = await db.projects.get(id);
        if (!project) throw new Error("项目不存在");
        if (ownerId !== undefined && ownerId !== id) throw new Error("项目归属不匹配");
        return {kind, row: {...project}};
    }
    if (!ownerId) throw new Error("必须明确提供 ownerId；工作室资产使用 studio");
    await requireOwner(ownerId, !["episode", "shot", "beat"].includes(kind));
    if (kind === "beat") {
        if (!episodeId) throw new Error("场次需要分集标识");
        const episode = await requireEpisode(ownerId, episodeId);
        const beat = normalizeEpisodeStory(episode.story).beats.find(item => item.id === id);
        if (!beat) throw new Error("场次不存在或不属于当前分集");
        return {kind, row: {...beat, projectId: ownerId, episodeId}};
    }
    const owned = <T extends {projectId: string}>(row: T | undefined): T => {
        if (!row || row.projectId !== ownerId) throw new Error(`${BUSINESS_LABELS[kind]}不存在或归属不匹配`);
        return row;
    };
    switch (kind) {
        case "episode": return {kind, row: owned(await db.episodes.get(id))};
        case "character": return {kind, row: owned(await db.characters.get(id))};
        case "scene": return {kind, row: owned(await db.scenes.get(id))};
        case "prop": return {kind, row: owned(await db.props.get(id))};
        case "style": return {kind, row: owned(await db.styles.get(id))};
        case "media": return {kind, row: metadata(owned(await db.media.get(id)))};
        case "shot": {
            const row = owned(await db.shots.get(id));
            if (typeof row.episodeId !== "string") throw new Error("镜头缺少有效分集");
            await requireEpisode(ownerId, row.episodeId);
            if (episodeId !== undefined && row.episodeId !== episodeId) throw new Error("镜头不属于当前分集");
            return {kind, row};
        }
    }
}

export async function listBusinessRecords(kind: BusinessKind, ownerId?: string, episodeId?: string): Promise<OwnedBusinessRecord[]> {
    if (kind === "project") return (await db.projects.toArray()).filter(row => row.id !== STUDIO_LIBRARY_ID).map(row => ({kind, row: {...row}}));
    if (!ownerId) throw new Error("必须明确提供 ownerId");
    await requireOwner(ownerId, !["episode", "shot", "beat"].includes(kind));
    if (kind === "beat") {
        if (!episodeId) throw new Error("场次需要分集标识");
        const episode = await requireEpisode(ownerId, episodeId);
        return normalizeEpisodeStory(episode.story).beats.map((beat, order) => ({kind, row: {...beat, projectId: ownerId, episodeId, order}}));
    }
    if (episodeId) await requireEpisode(ownerId, episodeId);
    switch (kind) {
        case "episode": return (await db.episodes.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row}));
        case "character": return (await db.characters.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row}));
        case "scene": return (await db.scenes.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row}));
        case "prop": return (await db.props.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row}));
        case "style": return (await db.styles.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row}));
        case "media": return (await db.media.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row: metadata(row)}));
        case "shot": return (await db.shots.where("projectId").equals(ownerId).toArray()).filter(row => !episodeId || row.episodeId === episodeId).map(row => ({kind, row}));
    }
}

/** Compatibility projections preserve original row envelopes and hashes. */
export async function getRow(kind: BusinessKind, id: string, ownerId?: string, episodeId?: string): Promise<BusinessRow> {
    return {...(await readBusinessRecord(kind, id, ownerId, episodeId)).row};
}
export async function listRows(kind: BusinessKind, ownerId?: string, episodeId?: string): Promise<BusinessRow[]> {
    return (await listBusinessRecords(kind, ownerId, episodeId)).map(record => ({...record.row}));
}
''' +s[end:];p.write_text(s)
# Slot membership establishes both record-kind and slot enum at execution time.
p=Path('src/lib/agent/businessTools.ts');s=p.read_text().replace('  getRow,','  getRow,\n  readBusinessRecord,\n  listBusinessRecords,');pos=s.index('const slotSpec =');s=s[:pos]+'''function catalogSlot<Slot extends string>(catalog: readonly {id: Slot}[], value: string): value is Slot {
    return catalog.some(slot => slot.id === value);
}
export function isCharacterSlot(value: string): value is CharacterImageSlot {return catalogSlot(CHARACTER_SLOTS, value);}
export function isSceneSlot(value: string): value is SceneImageSlot {return catalogSlot(SCENE_SLOTS, value);}
export function isPropSlot(value: string): value is PropImageSlot {return catalogSlot(PROP_SLOTS, value);}
export function isStyleSlot(value: string): value is StyleImageSlot {return catalogSlot(STYLE_SLOTS, value);}
export function isShotSlot(value: string): value is ShotPictureField {return value === "firstFrame" || value === "lastFrame" || value === "clip";}

'''+s[pos:]
start=s.index('        const row = await getRow(args.kind',s.index('const mediaTools'));start=s.index('        const row = await getRow(args.kind',start+1);end=s.index('\n        return {',start)
s=s[:start]+'''        const record = await readBusinessRecord(args.kind, args.id, args.ownerId, args.episodeId);
        const {result, ...patch} = args.patch;
        if (result?.mediaId && (await db.agentGenerationJobs.where("projectId").equals(args.ownerId).toArray()).some(job => job.batchId && job.result?.mediaId === result.mediaId)) throw new Error("批量候选必须由用户在批量面板选择并写入");
        const merge = (previous: unknown) => ({...emptySlot(), ...parseGenerationSlot(previous), ...patch, ...(Object.hasOwn(args.patch, "result") ? {result: result ?? undefined} : {})});
        const invalid = () => {throw new Error("素材槽位不属于此实体类型");};
        let slot;
        switch (record.kind) {
            case "character":
                if (!isCharacterSlot(args.slot)) return invalid();
                slot = merge(record.row.slots?.[args.slot]); await setCharacterSlot(args.id, args.slot, slot); break;
            case "scene":
                if (!isSceneSlot(args.slot)) return invalid();
                slot = merge(record.row.slots?.[args.slot]); await setSceneSlot(args.id, args.slot, slot); break;
            case "prop":
                if (!isPropSlot(args.slot)) return invalid();
                slot = merge(record.row.slots?.[args.slot]); await setPropSlot(args.id, args.slot, slot); break;
            case "style":
                if (!isStyleSlot(args.slot)) return invalid();
                slot = merge(record.row.slots?.[args.slot]); await setStyleSlot(args.id, args.slot, slot); break;
            case "shot":
                if (!isShotSlot(args.slot)) return invalid();
                slot = merge(record.row[args.slot]); await setShotSlot(args.id, args.slot, slot); break;
            default: return invalid();
        }''' +s[end:]
# Linked shot projection uses owned typed rows rather than assertions from the generic view.
s=s.replace('const shots = await listRows("shot", args.ownerId);','const shots = (await listBusinessRecords("shot", args.ownerId)).flatMap(record => record.kind === "shot" ? [record.row] : []);').replace('(shot.characterIds as string[])','shot.characterIds').replace('(shot.propIds as string[] | undefined)','shot.propIds')
p.write_text(s)
