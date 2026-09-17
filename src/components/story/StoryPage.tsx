import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { db } from "@/db/database";
import { addStoryBeat, deleteStoryBeat, updateEpisode } from "@/db/repo";
import {
  emptyEpisodeStory,
  normalizeEpisodeStory,
  type EpisodeStory,
  type StoryBeat,
} from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [title, setTitle] = useState("");
  const [story, setStory] = useState<EpisodeStory>(emptyEpisodeStory());
  const [saved, setSaved] = useState(true);
  const [dragging, setDragging] = useState(false);
  const loadedFor = useRef<string | undefined>(undefined);
  const draftRef = useRef({ title, story, saved });
  const revision = useRef(0);
  draftRef.current = { title, story, saved };

  useEffect(() => {
    if (!episode || loadedFor.current === episode.id) return;
    loadedFor.current = episode.id;
    setTitle(episode.title);
    setStory(normalizeEpisodeStory(episode.story));
    setSaved(true);
  }, [episode]);

  useEffect(() => {
    if (!episode || loadedFor.current !== episode.id || saved) return;
    const savingRevision = revision.current;
    const handle = window.setTimeout(() => {
      void updateEpisode(episodeId, { title, story }).then(() => {
        if (revision.current === savingRevision) setSaved(true);
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [episode, episodeId, saved, story, title]);

  useEffect(
    () => () => {
      const draft = draftRef.current;
      if (!draft.saved) {
        void updateEpisode(episodeId, {
          title: draft.title,
          story: draft.story,
        });
      }
    },
    [episodeId],
  );

  function patch(next: EpisodeStory) {
    setStory(next);
    revision.current += 1;
    setSaved(false);
  }

  async function addBeat() {
    const beat = await addStoryBeat(episodeId);
    revision.current += 1;
    setStory((current) => ({ ...current, beats: [...current.beats, beat] }));
  }

  function updateBeat(id: string, change: Partial<StoryBeat>) {
    setStory((current) => ({
      ...current,
      beats: current.beats.map((beat) => (beat.id === id ? { ...beat, ...change } : beat)),
    }));
    revision.current += 1;
    setSaved(false);
  }

  async function removeBeat(id: string) {
    await deleteStoryBeat(episodeId, id);
    revision.current += 1;
    setStory((current) => ({ ...current, beats: current.beats.filter((beat) => beat.id !== id) }));
  }

  async function applyScriptFile(file: File) {
    if (!isScriptFile(file)) return;
    const text = await file.text();
    patch({ ...story, script: text });
  }

  if (episode === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载故事…</div>;
  }
  if (episode === null) {
    return <div className="text-muted-foreground p-8 text-sm">找不到这一集</div>;
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
            <p className="text-muted-foreground text-[11px]">{saved ? "已保存" : "保存中…"}</p>
          </div>
          <Label className="mt-6">集标题（可选）</Label>
          <Input
            className="mt-2"
            value={title}
            placeholder="不填就显示第几集"
            onChange={(event) => {
              setTitle(event.target.value);
              revision.current += 1;
              setSaved(false);
            }}
          />
          <Label className="mt-6">本集一句话</Label>
          <Input
            className="mt-2"
            value={story.logline}
            placeholder="这一集，用一句话说完"
            onChange={(event) => patch({ ...story, logline: event.target.value })}
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
              className="min-h-[28rem] resize-y bg-card/60 text-[14px] leading-7"
              value={story.script}
              placeholder="直接贴剧本，或把 txt / md 拖进来。"
              onChange={(event) => patch({ ...story, script: event.target.value })}
            />
          </div>
        </section>
        <aside className="min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">场次</h2>
            <Button size="sm" variant="outline" onClick={() => void addBeat()}>
              <Plus />
              加一场
            </Button>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-5">
            加一场，分镜里就会出现对应的空场。出场角色和地点从本戏世界选。
          </p>
          <ul className="mt-4 space-y-3">
            {story.beats.length === 0 ? (
              <li className="text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-xs">
                还没有场次
              </li>
            ) : (
              story.beats.map((beat, index) => (
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
                      aria-label="删除场次"
                      onClick={() => void removeBeat(beat.id)}
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
