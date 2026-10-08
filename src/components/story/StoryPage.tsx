import {useManualDraftGuard} from "@/lib/useManualDraftGuard";
import {BeatTextField} from "./BeatTextField";
import {useTextDraftRetention, type TextDraftStatusChange} from "@/lib/useTextDraftRetention";
import {changedDraftFields} from "@/lib/draftConflict";
import {useLiveQuery} from "dexie-react-hooks";
import {ArrowDown, ArrowUp, Copy, CopyPlus, Plus, Trash2} from "lucide-react";
import {useEffect, useMemo, useRef, useState} from "react";
import {db} from "@/db/database";
import {addStoryBeat, deleteStoryBeat, duplicateBeat, patchStoryBeat, reorderBeats, restoreStoryBeat, updateEpisodeDraft} from "@/db/episodes";
import {deleteShots} from "@/db/shots";
import {type Episode, normalizeEpisodeStory, type StoryBeat} from "@/domain/types";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {DraftStatus} from "@/components/ui/draft-status";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {useDebouncedDraft} from "@/lib/debouncedDraft";
import {useUndo} from "@/lib/undo";
import {cn} from "@/lib/utils";

function isScriptFile(file: File): boolean {
    const name = file.name.toLowerCase();
    if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) return true;
    return file.type === "text/plain" || file.type === "text/markdown" || file.type === "text/x-markdown";
}

export function StoryPage(props: {projectId: string; episodeId: string}) {
    return <StoryScope key={JSON.stringify([props.projectId, props.episodeId])} {...props}/>;
}

function StoryScope({projectId, episodeId}: {projectId: string; episodeId: string}) {
    const loadedProject = useLiveQuery(async () => (await db.projects.get(projectId)) ?? null, [projectId]);
    const loadedEpisode = useLiveQuery(
        async () => (await db.episodes.get(episodeId)) ?? null,
        [episodeId],
    );
    const characters =
        useLiveQuery(
            () => db.characters.where("projectId").equals(projectId).toArray(),
            [projectId],
        ) ?? [];
    const scenes =
        useLiveQuery(() => db.scenes.where("projectId").equals(projectId).toArray(), [projectId]) ?? [];
    const loadedBeats = useMemo(() => loadedEpisode?.projectId === projectId
        ? normalizeEpisodeStory(loadedEpisode.story).beats : undefined, [loadedEpisode, projectId]);
    const beatText = useTextDraftRetention(loadedBeats);
    const lastProject = useRef(loadedProject);
    const lastEpisode = useRef(loadedEpisode);
    if (loadedProject) lastProject.current = loadedProject;
    if (loadedEpisode?.projectId === projectId) lastEpisode.current = loadedEpisode;
    const project = loadedProject ?? (beatText.pending ? lastProject.current : loadedProject);
    const episode = loadedEpisode ?? (beatText.pending ? lastEpisode.current : loadedEpisode);
    const unavailable = !loadedProject || !loadedEpisode || beatText.retainedCount > 0;
    const textNavigationGuard = useManualDraftGuard(false, beatText.pending, () => undefined);
    if (episode === undefined || project === undefined) {
        return <div className="text-muted-foreground p-8 text-sm">加载故事…</div>;
    }
    if (project === null || episode === null || episode.projectId !== projectId) {
        return <div className="text-muted-foreground p-8 text-sm">找不到这一集</div>;
    }

    return (
        <>
        {textNavigationGuard}
        <StoryEditor
            key={JSON.stringify([episode.projectId, episode.id])}
            beats={beatText.rows}
            onBeatDraftStatus={beatText.onStatusChange}
            unavailable={unavailable}
            episode={episode}
            film={project.mode === "film"}
            characters={characters}
            scenes={scenes}
        />
        </>
    );
}

type ScriptImport = {request: number; name: string; text: string};
type ScriptImportSession = {scope: string; request: number; revision: number; candidate?: ScriptImport};

function StoryEditor({
                         episode,
                         beats,
                         onBeatDraftStatus,
                         unavailable,
                         film,
                         characters,
                         scenes,
                     }: {
    episode: Episode;
    beats: StoryBeat[];
    onBeatDraftStatus: TextDraftStatusChange;
    unavailable: boolean;
    film: boolean;
    characters: { id: string; name: string }[];
    scenes: { id: string; name: string }[];
}) {
    const initialStory = normalizeEpisodeStory(episode.story);
    const {draft, setDraft, status, error, retry, useLatest: adoptLatestDraft, flush} = useDebouncedDraft({
        draftKey: `episode:${episode.id}:story`,
        scope: episode.projectId,
        initialValue: {
            title: episode.title,
            logline: initialStory.logline,
            script: initialStory.script,
        },
        persist: (value, baseline) => updateEpisodeDraft(episode.id, changedDraftFields(value, baseline), baseline),
    });
    const [dragging, setDragging] = useState(false);
    const scriptRef = useRef<HTMLTextAreaElement>(null);
    const {registerUndo} = useUndo();

    function updateBeat(id: string, change: Partial<StoryBeat>) {
        void patchStoryBeat(episode.id, id, change);
    }

    const mounted = useRef(true);
    const importSession = useRef<ScriptImportSession>({scope: `${episode.projectId}:${episode.id}`, request: 0, revision: 0});
    if (importSession.current.scope !== `${episode.projectId}:${episode.id}`) {
        importSession.current = {scope: `${episode.projectId}:${episode.id}`, request: 0, revision: 0};
    }
    const session = importSession.current;
    const [importCandidate, setImportCandidate] = useState<ScriptImport>();
    const [importError, setImportError] = useState<string>();
    const candidate = importCandidate === session.candidate ? importCandidate : undefined;

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            session.request += 1;
            session.candidate = undefined;
        };
    }, [session]);

    function currentSession() {
        return mounted.current && importSession.current === session;
    }

    function useLatestStory() {
        if (!currentSession()) return;
        session.revision += 1;
        session.request += 1;
        session.candidate = undefined;
        setImportCandidate(undefined);
        setImportError(undefined);
        adoptLatestDraft();
    }

    function changeScript(value: string) {
        if (!currentSession()) return;
        // Count every edit, including edit-then-revert, rather than comparing
        // text at completion. A conflict candidate remains an explicit choice.
        session.revision += 1;
        setDraft((current) => ({...current, script: value}));
    }

    function decideImport(adopt: boolean) {
        if (!currentSession() || !candidate || session.candidate !== candidate) return;
        session.request += 1;
        session.candidate = undefined;
        setImportCandidate(undefined);
        if (adopt) changeScript(candidate.text);
    }

    async function applyScriptFile(file: File) {
        if (!currentSession() || !isScriptFile(file)) return;
        const request = ++session.request;
        const revision = session.revision;
        session.candidate = undefined;
        setImportCandidate(undefined);
        setImportError(undefined);
        try {
            const text = await file.text();
            if (!currentSession() || request !== session.request) return;
            if (revision !== session.revision) {
                const next = {request, name: file.name, text};
                session.candidate = next;
                setImportCandidate(next);
            } else {
                changeScript(text);
            }
        } catch {
            if (currentSession() && request === session.request) setImportError("读取剧本失败，请重新拖入文件重试。");
        }
    }

    async function addBeatFromSelection() {
        const textarea = scriptRef.current;
        if (!textarea || textarea.selectionStart === textarea.selectionEnd) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const excerpt = draft.script.slice(start, end);
        if (!excerpt) return;
        await flush();
        await addStoryBeat(episode.id, {scriptRange: {start, end, excerpt}});
    }

    async function moveBeat(index: number, offset: -1 | 1) {
        const target = index + offset;
        if (target < 0 || target >= beats.length) return;
        const previous = beats.map((beat) => beat.id);
        const next = [...previous];
        [next[index], next[target]] = [next[target]!, next[index]!];
        await reorderBeats(episode.id, next);
        registerUndo({
            label: "已调整场次顺序",
            restore: () => reorderBeats(episode.id, previous),
        });
    }

    async function removeBeat(beat: StoryBeat, index: number) {
        const shotIds = (await db.shots.where("episodeId").equals(episode.id).toArray())
            .filter((shot) => shot.beatId === beat.id)
            .map((shot) => shot.id);
        await deleteStoryBeat(episode.id, beat.id);
        registerUndo({
            label: "已删除场次",
            restore: () => restoreStoryBeat(episode.id, beat, index, shotIds),
        });
    }

    async function copyBeat(beatId: string, copyShots: boolean) {
        const copy = await duplicateBeat(episode.id, beatId, {includeShots: copyShots});
        registerUndo({
            label: copyShots ? "已复制场次及镜头" : "已复制场次",
            restore: async () => {
                await deleteShots(copy.shots.map((shot) => shot.id));
                await deleteStoryBeat(episode.id, copy.beat.id);
            },
        });
    }

    return (
        <div className="app-scroll h-full overflow-auto">
            {unavailable && <p role="alert" className="p-4">当前项目、故事或场次已不可用，未完成的文字仍保留。</p>}
            <div
                className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
                <section className="min-w-0">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <h1 className="text-[17px] font-semibold">{film ? "故事" : "本集故事"}</h1>
                            <p className="text-muted-foreground mt-1 text-xs">
                                {film ? "先写这部作品要讲什么。" : "先写这一集要讲什么。"}场次可以后补，分镜会从这里长出来。
                            </p>
                        </div>
                        <DraftStatus status={status} error={error} onRetry={() => void retry()}
                                     onUseLatest={useLatestStory}/>
                    </div>
                    <Label className="mt-6">{film ? "故事标题（可选）" : "集标题（可选）"}</Label>
                    <Input
                        className="mt-2"
                        value={draft.title}
                        placeholder={film ? "可填写这一稿的标题" : "不填就显示第几集"}
                        onChange={(event) => {
                            const value = event.target.value;
                            setDraft((current) => ({...current, title: value}));
                        }}
                    />
                    <Label className="mt-6">{film ? "一句话故事" : "本集一句话"}</Label>
                    <Input
                        className="mt-2"
                        value={draft.logline}
                        placeholder={film ? "这个故事，用一句话说完" : "这一集，用一句话说完"}
                        onChange={(event) => {
                            const value = event.target.value;
                            setDraft((current) => ({...current, logline: value}));
                        }}
                    />
                    <Label className="mt-6">剧本</Label>
                    <p className="text-muted-foreground mt-1 text-[11px]">可拖入 .txt / .md，写入正文，不会自动拆场。</p>
                    <div
                        className={cn("mt-2 rounded-xl", dragging && "ring-brand ring-2")}
                        onDragEnter={(event) => {
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                            event.preventDefault();
                            if (!currentSession()) return;
                            setDragging(false);
                            const file = event.dataTransfer.files[0];
                            if (file) void applyScriptFile(file);
                        }}
                    >
                        <Textarea
                            ref={scriptRef}
                            className="min-h-[28rem] resize-y bg-card/60 text-[14px] leading-7"
                            value={draft.script}
                            placeholder="直接贴剧本，或把 txt / md 拖进来。"
                            onChange={(event) => changeScript(event.target.value)}
                        />
                    </div>
                    {importError ? <p role="alert" className="text-destructive mt-2 text-xs">{importError}</p> : null}
                    {candidate ? (
                        <div className="bg-muted/40 mt-3 rounded-lg border p-3">
                            <p className="text-sm">读取 {candidate.name} 期间正文已修改，当前正文已保留。</p>
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{candidate.text}</pre>
                            <div className="mt-3 flex gap-2">
                                <Button size="sm" onClick={() => decideImport(true)}>采用导入正文</Button>
                                <Button size="sm" variant="outline" onClick={() => decideImport(false)}>放弃导入</Button>
                            </div>
                        </div>
                    ) : null}
                </section>
                <aside className="min-w-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-medium">场次</h2>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => void addBeatFromSelection()}>
                                从选中内容建场
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void addStoryBeat(episode.id)}>
                                <Plus/>
                                加一场
                            </Button>
                        </div>
                    </div>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-5">
                        加一场，分镜里就会出现对应的空场。出场角色和地点从本戏世界选。
                    </p>
                    <ul className="mt-4 space-y-3">
                        {beats.length === 0 ? (
                            <li className="text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-xs">
                                还没有场次
                            </li>
                        ) : (
                            beats.map((beat, index) => (
                                <li key={beat.id} className="bg-card rounded-2xl border p-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground w-6 text-xs">{index + 1}</span>
                                        <BeatTextField projectId={episode.projectId} episodeId={episode.id} beat={beat} field="title"
                                                       onDraftStatus={onBeatDraftStatus} unavailable={unavailable} ariaLabel="场次标题" className="h-8"/>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label="上移场次"
                                            disabled={index === 0}
                                            onClick={() => void moveBeat(index, -1)}
                                        >
                                            <ArrowUp/>
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label="下移场次"
                                            disabled={index === beats.length - 1}
                                            onClick={() => void moveBeat(index, 1)}
                                        >
                                            <ArrowDown/>
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label="复制场次"
                                            onClick={() => void copyBeat(beat.id, false)}
                                        >
                                            <Copy/>
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label="复制场次及其镜头"
                                            onClick={() => void copyBeat(beat.id, true)}
                                        >
                                            <CopyPlus/>
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label="删除场次"
                                            onClick={() => void removeBeat(beat, index)}
                                        >
                                            <Trash2/>
                                        </Button>
                                    </div>
                                    <BeatTextField projectId={episode.projectId} episodeId={episode.id} beat={beat} field="content"
                                                   onDraftStatus={onBeatDraftStatus} unavailable={unavailable} multiline
                                                   containerClassName="mt-2" className="min-h-20 resize-none"
                                                   placeholder="这场发生什么" ariaLabel="场次内容"/>
                                    <Label className="mt-3 text-[11px]">出场角色</Label>
                                    <div
                                        className="mt-1 max-h-28 space-y-1 overflow-auto rounded-lg border px-2 py-1.5">
                                        {characters.length === 0 ? (
                                            <p className="text-muted-foreground text-[11px]">世界里还没有角色</p>
                                        ) : (
                                            characters.map((character) => (
                                                <label key={character.id} className="flex items-center gap-2 text-xs">
                                                    <Checkbox
                                                        checked={beat.characterIds.includes(character.id)}
                                                        onCheckedChange={(checked) => {
                                                            const ids = checked
                                                                ? [...beat.characterIds, character.id]
                                                                : beat.characterIds.filter((item) => item !== character.id);
                                                            updateBeat(beat.id, {characterIds: ids});
                                                        }}
                                                    />
                                                    {character.name}
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-[11px]">地点</Label>
                                            <Select
                                                value={beat.sceneId ?? "none"}
                                                onValueChange={(value) =>
                                                    updateBeat(beat.id, {sceneId: value === "none" ? undefined : value})
                                                }
                                            >
                                                <SelectTrigger className="mt-1 h-8 w-full">
                                                    <SelectValue placeholder="未选择"/>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">未选择</SelectItem>
                                                    {scenes.map((scene) => (
                                                        <SelectItem key={scene.id} value={scene.id}>
                                                            {scene.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="text-[11px]">时段</Label>
                                            <BeatTextField projectId={episode.projectId} episodeId={episode.id} beat={beat} field="timeOfDay"
                                                           onDraftStatus={onBeatDraftStatus} unavailable={unavailable} className="h-8" containerClassName="mt-1"
                                                           placeholder="日 / 夜" ariaLabel="时段"/>
                                        </div>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </aside>
            </div>
        </div>
    );
}
