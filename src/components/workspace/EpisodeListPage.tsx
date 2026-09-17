import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CoverCard, CreateTile, LibraryGrid } from "@/components/studio/CoverCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/db/database";
import { addEpisode, deleteEpisode, updateProject } from "@/db/repo";
import { episodeLabel, normalizeSeriesStory, type Shot } from "@/domain/types";
import { formatUpdatedAt } from "@/lib/format";

function coverOfEpisode(shots: Shot[], episodeId: string): string | undefined {
  return shots
    .filter((shot) => shot.episodeId === episodeId)
    .sort((left, right) => left.order - right.order)
    .find((shot) => shot.firstFrame.result?.mediaId)?.firstFrame.result?.mediaId;
}

export function EpisodeListPage({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const project = useLiveQuery(
    async () => (await db.projects.get(projectId)) ?? null,
    [projectId],
  );
  const episodes =
    useLiveQuery(
      () => db.episodes.where("projectId").equals(projectId).sortBy("order"),
      [projectId],
    ) ?? [];
  const shots =
    useLiveQuery(() => db.shots.where("projectId").equals(projectId).toArray(), [projectId]) ?? [];
  const [logline, setLogline] = useState("");
  const [saved, setSaved] = useState(true);
  const loadedFor = useRef<string | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string>();

  useEffect(() => {
    if (!project || loadedFor.current === project.id) return;
    loadedFor.current = project.id;
    setLogline(normalizeSeriesStory(project.story).logline);
    setSaved(true);
  }, [project]);

  useEffect(() => {
    if (!project || loadedFor.current !== project.id || saved) return;
    const handle = window.setTimeout(() => {
      void updateProject(projectId, { story: { logline } }).then(() => setSaved(true));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [logline, project, projectId, saved]);

  if (project === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载集列表…</div>;
  }
  if (project === null) {
    return <div className="text-muted-foreground p-8 text-sm">找不到这个项目</div>;
  }

  const canDelete = episodes.length > 1;

  return (
    <div className="app-scroll h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[17px] font-semibold">集</h1>
            <p className="text-muted-foreground mt-1 text-xs">
              一部戏先分集。点进某一集再写本集故事和分镜。世界在系列层，各集共用。
            </p>
          </div>
          <p className="text-muted-foreground text-[11px]">{saved ? "已保存" : "保存中…"}</p>
        </div>

        <Label className="mt-6">整部戏一句话</Label>
        <Input
          className="mt-2"
          value={logline}
          placeholder="这部戏，用一句话说完（可选）"
          onChange={(event) => {
            setLogline(event.target.value);
            setSaved(false);
          }}
        />

        <div className="mt-8">
          <LibraryGrid>
            <CreateTile
              label={`新建第 ${episodes.length + 1} 集`}
              hint="接着往下写"
              onClick={() => {
                void addEpisode(projectId).catch((err) =>
                  toast.error(err instanceof Error ? err.message : "创建失败"),
                );
              }}
            />
            {episodes.map((episode) => (
              <CoverCard
                key={episode.id}
                title={episodeLabel(episode)}
                subtitle={`更新 ${formatUpdatedAt(episode.updatedAt)}`}
                mediaId={coverOfEpisode(shots, episode.id)}
                onOpen={() =>
                  void navigate({
                    to: "/p/$projectId/e/$episodeId",
                    params: { projectId, episodeId: episode.id },
                  })
                }
                actions={
                  canDelete
                    ? [
                        {
                          label: "删除",
                          tone: "danger",
                          onSelect: () => setDeleteId(episode.id),
                        },
                      ]
                    : undefined
                }
              />
            ))}
          </LibraryGrid>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这一集</AlertDialogTitle>
            <AlertDialogDescription>
              这一集的故事和镜头会一起删掉。不能删掉最后一集。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (!deleteId) return;
                void deleteEpisode(deleteId).catch((err) =>
                  toast.error(err instanceof Error ? err.message : "删除失败"),
                );
                setDeleteId(undefined);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
