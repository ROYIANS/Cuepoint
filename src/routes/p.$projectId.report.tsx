import {createFileRoute, redirect} from "@tanstack/react-router";
import {getVideoWorkspaceRepository} from "@/lib/videoWorkspaceRepository";

export const Route = createFileRoute("/p/$projectId/report")({
    beforeLoad: async ({params}) => {
        const episode = (await getVideoWorkspaceRepository().episodes(params.projectId))[0];
        if (!episode) {
            throw redirect({to: "/p/$projectId", params});
        }
        throw redirect({
            to: "/p/$projectId/e/$episodeId/produce",
            params: {projectId: params.projectId, episodeId: episode.id},
        });
    },
});
