import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Printer } from "lucide-react";
import { MediaPreview } from "@/components/media/MediaThumb";
import { Button } from "@/components/ui/button";
import { db } from "@/db/database";
import { episodeLabel } from "@/domain/types";
import { deriveEpisodeDelivery } from "@/lib/episodeDelivery";
import { formatDuration } from "@/lib/format";

export function StoryboardPrintPage({
  projectId,
  episodeId,
}: {
  projectId: string;
  episodeId: string;
}) {
  const project = useLiveQuery(
    async () => (await db.projects.get(projectId)) ?? null,
    [projectId],
  );
  const episode = useLiveQuery(
    async () => (await db.episodes.get(episodeId)) ?? null,
    [episodeId],
  );
  const shots = useLiveQuery(
    () => db.shots.where("episodeId").equals(episodeId).sortBy("order"),
    [episodeId],
  );
  const characters = useLiveQuery(
    () => db.characters.where("projectId").equals(projectId).toArray(),
    [projectId],
  );
  const scenes = useLiveQuery(
    () => db.scenes.where("projectId").equals(projectId).toArray(),
    [projectId],
  );

  if (
    project === undefined ||
    episode === undefined ||
    shots === undefined ||
    characters === undefined ||
    scenes === undefined
  ) {
    return <div className="p-8 text-sm">加载故事板…</div>;
  }
  if (project === null || episode === null || episode.projectId !== projectId) {
    return <div className="p-8 text-sm">找不到当前集故事板</div>;
  }

  const delivery = deriveEpisodeDelivery({
    project,
    episode,
    shots,
    characters,
    scenes,
  });

  return (
    <main className="storyboard-print min-h-full bg-white px-8 py-6 text-black">
      <div className="print-toolbar mx-auto mb-6 flex max-w-6xl items-center justify-between">
        <Button variant="outline" asChild>
          <Link
            to="/p/$projectId/e/$episodeId/produce"
            params={{ projectId, episodeId }}
          >
            <ArrowLeft />
            返回制作
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer />
          打印
        </Button>
      </div>

      <header className="storyboard-heading mx-auto max-w-6xl border-b border-black/20 pb-4">
        <p className="text-xs tracking-[0.18em] text-black/55">分镜故事板</p>
        <h1 className="mt-1 text-2xl font-semibold">{project.name}</h1>
        <div className="mt-2 flex gap-5 text-sm text-black/65">
          <span>{episodeLabel(episode)}</span>
          <span>{delivery.rows.length} 镜</span>
          <span>{formatDuration(delivery.totalDurationSec)}</span>
        </div>
      </header>

      {delivery.rows.length === 0 ? (
        <p className="mx-auto mt-12 max-w-6xl text-center text-sm text-black/50">
          当前集还没有镜头
        </p>
      ) : (
        <div className="storyboard-grid mx-auto mt-6 grid max-w-6xl grid-cols-2 gap-4">
          {delivery.rows.map((row) => (
            <article
              key={row.shot.id}
              className="storyboard-card grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] overflow-hidden rounded-lg border border-black/20"
            >
              <div className="aspect-video bg-neutral-100">
                <MediaPreview
                  mediaId={row.visualMediaId}
                  empty="暂无首帧"
                  className="size-full text-black/40"
                />
              </div>
              <div className="flex min-w-0 flex-col p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <strong className="text-sm">镜 {row.shotNumber || row.order}</strong>
                  <span className="text-xs text-black/55">
                    {formatDuration(row.durationSec)}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-black/50">
                  {row.beat}
                  {row.scene ? ` · ${row.scene}` : ""}
                </p>
                <p className="mt-3 line-clamp-4 text-xs leading-5">
                  {row.content || "未写内容"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
