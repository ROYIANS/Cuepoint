import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { formatDuration } from "@/lib/format";
import { slotHasBody } from "@/domain/slot";

export function ProducePage({
  projectId,
  episodeId,
}: {
  projectId: string;
  episodeId: string;
}) {
  const shots =
    useLiveQuery(
      () => db.shots.where("episodeId").equals(episodeId).sortBy("order"),
      [episodeId],
    ) ?? [];
  const characters =
    useLiveQuery(() => db.characters.where("projectId").equals(projectId).toArray(), [projectId]) ??
    [];
  const scenes =
    useLiveQuery(() => db.scenes.where("projectId").equals(projectId).toArray(), [projectId]) ?? [];

  const missingClip = shots.filter((shot) => !shot.clip.result?.mediaId);
  const drafted = shots.filter(
    (shot) =>
      slotHasBody(shot.firstFrame) || slotHasBody(shot.lastFrame) || slotHasBody(shot.clip),
  );
  const totalDuration = shots.reduce((sum, shot) => sum + (Number(shot.durationSec) || 0), 0);

  return (
    <div className="app-scroll h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <h1 className="text-[17px] font-semibold">制作</h1>
        <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-5">
          这一集的制作还是占位。先看覆盖：哪些镜头还没有成片，世界里有没有人。
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="镜头" value={String(shots.length)} />
          <Stat label="已写提示" value={String(drafted.length)} />
          <Stat label="还缺成片" value={String(missingClip.length)} />
          <Stat label="总时长" value={formatDuration(totalDuration)} />
        </dl>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="bg-card rounded-2xl border p-5">
            <p className="text-sm font-medium">世界</p>
            <p className="text-muted-foreground mt-2 text-sm">
              角色 {characters.length} · 场景 {scenes.length}。设定在系列层的世界页里，各集共用。
            </p>
            <Link
              to="/p/$projectId/world"
              params={{ projectId }}
              className="text-brand mt-4 inline-flex text-sm hover:underline"
            >
              去世界
            </Link>
          </div>
          <div className="bg-card rounded-2xl border p-5">
            <p className="text-sm font-medium">本集分镜</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {missingClip.length === 0
                ? "成片槽都有结果，或还没有镜头。"
                : `${missingClip.length} 个镜头还没有成片。`}
            </p>
            <Link
              to="/p/$projectId/e/$episodeId/shots"
              params={{ projectId, episodeId }}
              className="text-brand mt-4 inline-flex text-sm hover:underline"
            >
              去分镜
            </Link>
          </div>
        </div>

        {missingClip.length > 0 ? (
          <ul className="mt-8 divide-y rounded-2xl border">
            {missingClip.slice(0, 12).map((shot) => (
              <li key={shot.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground w-16">镜 {shot.shotNumber || "—"}</span>
                <span className="min-w-0 flex-1 truncate">{shot.content || "未写内容"}</span>
              </li>
            ))}
          </ul>
        ) : null}
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
