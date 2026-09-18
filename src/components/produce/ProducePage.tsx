import { useShotMedia } from "@/lib/useShotMedia";
import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, CheckCircle2, Download, Printer } from "lucide-react";
import { normalizeProjectMode } from "@/domain/types";
import { db } from "@/db/database";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import {
  deriveEpisodeDelivery,
  downloadEpisodeDeliveryCsv,
} from "@/lib/episodeDelivery";

const MISSING_LABELS = {
  content: "内容",
  duration: "时长",
  scene: "场景",
  firstFrame: "首帧",
  clip: "成片",
} as const;

export function ProducePage({
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

  const relationAssets = useLiveQuery(async () => ({
    projectId,
    props: await db.props.where("projectId").equals(projectId).toArray(),
    styles: await db.styles.where("projectId").equals(projectId).toArray(),
  }), [projectId]);
  const props = relationAssets?.projectId === projectId ? relationAssets.props : undefined;
  const styles = relationAssets?.projectId === projectId ? relationAssets.styles : undefined;

  const media = useShotMedia(shots);

  if (
    media === undefined ||
    project === undefined ||
    episode === undefined ||
    shots === undefined ||
    characters === undefined ||
    props === undefined ||
    styles === undefined ||
    scenes === undefined
  ) {
    return <div className="text-muted-foreground p-8 text-sm">加载制作信息…</div>;
  }
  if (project === null) {
    return <div className="text-muted-foreground p-8 text-sm">找不到这个项目</div>;
  }
  if (episode === null || episode.projectId !== projectId) {
    return <div className="text-muted-foreground p-8 text-sm">找不到当前故事</div>;
  }

  const delivery = deriveEpisodeDelivery({
    project,
    episode,
    shots,
    characters,
    scenes,
    props,
    styles,
    media,
  });
  const scopeLabel = normalizeProjectMode(project.mode) === "film" ? "当前项目" : "当前集";
  const incompleteRows = delivery.rows.filter((row) => row.missing.length > 0);
  const missingCount = delivery.rows.reduce((sum, row) => sum + row.missing.length, 0);

  return (
    <div className="app-scroll h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[17px] font-semibold">制作与交付</h1>
            <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-5">
              检查{scopeLabel}的分镜完整性，并导出按当前顺序整理的交付物。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => downloadEpisodeDeliveryCsv(delivery)}>
              <Download />
              导出 CSV
            </Button>
            <Button variant="outline" asChild>
              <Link
                to="/p/$projectId/e/$episodeId/storyboard"
                params={{ projectId, episodeId }}
                target="_blank"
              >
                <Printer />
                打印故事板
              </Link>
            </Button>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="镜头" value={String(delivery.rows.length)} />
          <Stat label="场次" value={String(delivery.beatCount)} />
          <Stat label="缺失项" value={String(missingCount)} />
          <Stat label="总时长" value={formatDuration(delivery.totalDurationSec)} />
        </dl>

        <div className="mt-8 flex items-center gap-3 rounded-2xl border p-5">
          {incompleteRows.length === 0 ? (
            <CheckCircle2 className="text-brand size-5" />
          ) : (
            <AlertTriangle className="text-amber-400 size-5" />
          )}
          <div>
            <p className="text-sm font-medium">
              {delivery.rows.length === 0
                ? `${scopeLabel}还没有镜头`
                : incompleteRows.length === 0
                  ? `${scopeLabel}检查通过`
                  : `${incompleteRows.length} 个镜头需要补充`}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              检查内容、时长、场景和有效素材；成片必须是视频，图片占位仍需补充视频。镜头状态由你手动确认。
            </p>
          </div>
        </div>

        {incompleteRows.length > 0 ? (
          <div className="mt-8 overflow-hidden rounded-2xl border">
            <div className="bg-muted/60 grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:grid-cols-[80px_1fr_1fr_auto] gap-3 px-4 py-3 text-xs">
              <span>镜号</span>
              <span>场次 / 内容</span>
              <span>缺失</span>
              <span>操作</span>
            </div>
            <ul className="divide-y">
              {incompleteRows.map((row) => (
                <li
                  key={row.shot.id}
                  className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:grid-cols-[80px_1fr_1fr_auto] items-center gap-3 px-4 py-3 text-sm"
                >
                  <span className="text-muted-foreground">{row.shotNumber || "—"}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs">{row.beat}</span>
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                      {row.content || "未写内容"}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {row.missing.map((item) => MISSING_LABELS[item]).join("、")}
                  </span>
                  <Link
                    to="/p/$projectId/e/$episodeId/shots"
                    params={{ projectId, episodeId }}
                    search={{ shot: row.shot.id }}
                    className="text-brand text-xs hover:underline"
                  >
                    定位镜头
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-muted-foreground mt-8 rounded-2xl border border-dashed px-5 py-8 text-center text-sm">
            {delivery.rows.length === 0 ? (
              <Link
                to="/p/$projectId/e/$episodeId/shots"
                params={{ projectId, episodeId }}
                search={{ shot: undefined }}
                className="text-brand hover:underline"
              >
                去分镜创建第一条镜头
              </Link>
            ) : (
              "没有发现缺失项，可以导出交付物。"
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl border px-4 py-4">
      <dt className="text-muted-foreground text-[11px]">{label}</dt>
      <dd className="mt-1 text-xl font-medium tracking-tight">{value}</dd>
    </div>
  );
}
