import { createFileRoute, redirect } from "@tanstack/react-router";
import { firstEpisode } from "@/db/repo";

export const Route = createFileRoute("/p/$projectId/report")({
  beforeLoad: async ({ params }) => {
    const episode = await firstEpisode(params.projectId);
    if (!episode) {
      throw redirect({ to: "/p/$projectId", params });
    }
    throw redirect({
      to: "/p/$projectId/e/$episodeId/produce",
      params: { projectId: params.projectId, episodeId: episode.id },
    });
  },
});
