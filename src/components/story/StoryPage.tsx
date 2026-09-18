import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, ArrowUp, Copy, CopyPlus, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { db } from "@/db/database";
import {
  addStoryBeat,
  deleteShots,
  deleteStoryBeat,
  duplicateBeat,
  patchStoryBeat,
  reorderBeats,
  restoreStoryBeat,
  updateEpisodeDraft,
} from "@/db/repo";
import { normalizeEpisodeStory, type Episode, type StoryBeat } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DraftStatus } from "@/components/ui/draft-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedDraft } from "@/lib/debouncedDraft";
import { useUndo } from "@/lib/undo";
import { cn } from "@/lib/utils";

function isScriptFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) return true;
  return file.type === "text/plain" || file.type === "text/markdown" || file.type === "text/x-markdown";
}

export function StoryPage({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const episode = useLiveQuery(
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
  if (episode === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载故事…</div>;
  }
  if (episode === null || episode.projectId !== projectId) {
    return <div className="text-muted-foreground p-8 text-sm">找不到这一集</div>;
  }

  return (
    <StoryEditor
      key={episode.id}
      episode={episode}
      characters={characters}
      scenes={scenes}
    />
  );
}

function StoryEditor({
  episode,
  characters,
  scenes,
}: {
  episode: Episode;
  characters: { id: string; name: string }[];
  scenes: { id: string; name: string }[];
}) {
  const initialStory = normalizeEpisodeStory(episode.story);
  const { draft, setDraft, status, error, retry, flush } = useDebouncedDraft({
    draftKey: `episode:${episode.id}:story`,
    scope: episode.projectId,
    initialValue: {
      title: episode.title,
      logline: initialStory.logline,
      script: initialStory.script,
    },
    persist: (value) => updateEpisodeDraft(episode.id, value),
  });
  const [dragging, setDragging] = useState(false);
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const { registerUndo } = useUndo();
  const beats = normalizeEpisodeStory(episode.story).beats;

  function updateBeat(id: string, change: Partial<StoryBeat>) {
    void patchStoryBeat(episode.id, id, change);
  }

  async function applyScriptFile(file: File) {
    if (!isScriptFile(file)) return;
    const text = await file.text();
    setDraft((current) => ({ ...current, script: text }));
  }

  async function addBeatFromSelection() {
    const textarea = scriptRef.current;
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const excerpt = draft.script.slice(start, end);
    if (!excerpt) return;
    await flush();
    await addStoryBeat(episode.id, { scriptRange: { start, end, excerpt } });
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
    const copy = await duplicateBeat(episode.id, beatId, { includeShots: copyShots });
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
      <div className="mx-auto grid max-w-6xl gap-8 px-8 py-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
        <section className="min-w-0">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[17px] font-semibold">本集故事</h1>
              <p className="text-muted-foreground mt-1 text-xs">
                先写这一集要讲什么。场次可以后补，分镜会从这里长出来。
              </p>
            </div>
            <DraftStatus status={status} error={error} onRetry={() => void retry()} />
          </div>
          <Label className="mt-6">集标题（可选）</Label>
          <Input
            className="mt-2"
            value={draft.title}
            placeholder="不填就显示第几集"
            onChange={(event) => {
              setDraft((current) => ({ ...current, title: event.target.value }));
            }}
          />
          <Label className="mt-6">本集一句话</Label>
          <Input
            className="mt-2"
            value={draft.logline}
            placeholder="这一集，用一句话说完"
            onChange={(event) =>
              setDraft((current) => ({ ...current, logline: event.target.value }))
            }
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
              onChange={(event) =>
                setDraft((current) => ({ ...current, script: event.target.value }))
              }
            />
          </div>
        </section>
        <aside className="min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">场次</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void addBeatFromSelection()}>
                从选中内容建场
              </Button>
              <Button size="sm" variant="outline" onClick={() => void addStoryBeat(episode.id)}>
                <Plus />
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
                    <Input
                      value={beat.title}
                      onChange={(event) => updateBeat(beat.id, { title: event.target.value })}
                      className="h-8"
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="上移场次"
                      disabled={index === 0}
                      onClick={() => void moveBeat(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="下移场次"
                      disabled={index === beats.length - 1}
                      onClick={() => void moveBeat(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="复制场次"
                      onClick={() => void copyBeat(beat.id, false)}
                    >
                      <Copy />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="复制场次及其镜头"
                      onClick={() => void copyBeat(beat.id, true)}
                    >
                      <CopyPlus />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="删除场次"
                      onClick={() => void removeBeat(beat, index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <Textarea
                    className="mt-2 min-h-20 resize-none"
                    value={beat.content}
                    placeholder="这场发生什么"
                    onChange={(event) => updateBeat(beat.id, { content: event.target.value })}
                  />
                  <Label className="mt-3 text-[11px]">出场角色</Label>
                  <div className="mt-1 max-h-28 space-y-1 overflow-auto rounded-lg border px-2 py-1.5">
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
                              updateBeat(beat.id, { characterIds: ids });
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
                          updateBeat(beat.id, { sceneId: value === "none" ? undefined : value })
                        }
                      >
                        <SelectTrigger className="mt-1 h-8 w-full">
                          <SelectValue placeholder="未选择" />
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
                      <Input
                        className="mt-1 h-8"
                        value={beat.timeOfDay}
                        placeholder="日 / 夜"
                        onChange={(event) => updateBeat(beat.id, { timeOfDay: event.target.value })}
                      />
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
