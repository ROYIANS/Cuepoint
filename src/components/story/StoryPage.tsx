import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { db } from "@/db/database";
import { addStoryBeat, deleteStoryBeat, updateProject } from "@/db/repo";
import { emptyStory, normalizeStory, type ProjectStory, type StoryBeat } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function StoryPage({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const [story, setStory] = useState<ProjectStory>(emptyStory());
  const [saved, setSaved] = useState(true);
  const loadedFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!project || loadedFor.current === project.id) return;
    loadedFor.current = project.id;
    setStory(normalizeStory(project.story));
    setSaved(true);
  }, [project]);

  useEffect(() => {
    if (!project || loadedFor.current !== project.id || saved) return;
    const handle = window.setTimeout(() => {
      void updateProject(projectId, { story }).then(() => setSaved(true));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [project, projectId, saved, story]);

  function patch(next: ProjectStory) {
    setStory(next);
    setSaved(false);
  }

  async function addBeat() {
    const beat = await addStoryBeat(projectId);
    setStory((current) => ({ ...current, beats: [...current.beats, beat] }));
  }

  function updateBeat(id: string, change: Partial<StoryBeat>) {
    patch({
      ...story,
      beats: story.beats.map((beat) => (beat.id === id ? { ...beat, ...change } : beat)),
    });
  }

  async function removeBeat(id: string) {
    await deleteStoryBeat(projectId, id);
    setStory((current) => ({ ...current, beats: current.beats.filter((beat) => beat.id !== id) }));
  }

  if (!project) {
    return <div className="text-muted-foreground p-8 text-sm">加载故事…</div>;
  }

  return (
    <div className="app-scroll h-full overflow-auto">
      <div className="mx-auto grid max-w-6xl gap-8 px-8 py-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
        <section className="min-w-0">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[17px] font-semibold">故事</h1>
              <p className="text-muted-foreground mt-1 text-xs">先写清楚这部戏要讲什么。场次可以后补，分镜会从这里长出来。</p>
            </div>
            <p className="text-muted-foreground text-[11px]">{saved ? "已保存" : "保存中…"}</p>
          </div>
          <Label className="mt-6">一句话</Label>
          <Input
            className="mt-2"
            value={story.logline}
            placeholder="这部戏，用一句话说完"
            onChange={(event) => patch({ ...story, logline: event.target.value })}
          />
          <Label className="mt-6">剧本</Label>
          <Textarea
            className="mt-2 min-h-[28rem] resize-y bg-card/60 text-[14px] leading-7"
            value={story.script}
            placeholder="直接贴剧本，或按场写下发生了什么、谁在场、对白。"
            onChange={(event) => patch({ ...story, script: event.target.value })}
          />
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
            场次是故事和分镜之间的桥。细节后面再定，现在先用来拆块。
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
                    className="mt-2 min-h-24 resize-none"
                    value={beat.content}
                    placeholder="这场发生什么"
                    onChange={(event) => updateBeat(beat.id, { content: event.target.value })}
                  />
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
