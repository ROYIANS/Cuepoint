import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { EpisodeListPage } from "@/components/workspace/EpisodeListPage";
import { Button } from "@/components/ui/button";
import { db } from "@/db/database";
import { ensureFirstEpisode } from "@/db/repo";
import { normalizeProjectMode } from "@/domain/types";

export const Route = createFileRoute("/p/$projectId/")({
  component: SeriesHomeRoute,
});

function SeriesHomeRoute() {
  const { projectId } = Route.useParams();
  const project = useLiveQuery(
    async () => (await db.projects.get(projectId)) ?? null,
    [projectId],
  );
  const episode = useLiveQuery(async () => {
    const rows = await db.episodes.where("projectId").equals(projectId).sortBy("order");
    return rows[0] ?? null;
  }, [projectId]);
  const [repairing, setRepairing] = useState(false);
  const [repairError, setRepairError] = useState<string>();

  useEffect(() => {
    if (
      !project ||
      normalizeProjectMode(project.mode) !== "film" ||
      episode !== null ||
      repairing ||
      repairError
    ) {
      return;
    }
    setRepairing(true);
    void ensureFirstEpisode(projectId)
      .catch((error) => {
        setRepairError(error instanceof Error ? error.message : "无法创建内部集");
      })
      .finally(() => setRepairing(false));
  }, [episode, project, projectId, repairError, repairing]);

  if (project && normalizeProjectMode(project.mode) === "film") {
    if (episode) {
      return (
        <Navigate
          to="/p/$projectId/e/$episodeId"
          params={{ projectId, episodeId: episode.id }}
          replace
        />
      );
    }
    if (repairError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <p className="text-sm">{repairError}</p>
          <Button variant="outline" onClick={() => setRepairError(undefined)}>
            重试
          </Button>
        </div>
      );
    }
    return <div className="text-muted-foreground p-8 text-sm">正在准备故事…</div>;
  }

  return <EpisodeListPage key={projectId} projectId={projectId} />;
}
