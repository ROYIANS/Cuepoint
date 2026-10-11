import {createFileRoute, redirect} from "@tanstack/react-router";
import {getVideoWorkspaceRepository} from "@/lib/videoWorkspaceRepository";

export const Route = createFileRoute("/p/$projectId/shots")({
    beforeLoad: async ({params}) => {
        const episode = (await getVideoWorkspaceRepository().episodes(params.projectId))[0];
        if (!episode) {
            throw redirect({to: "/p/$projectId", params});
        }
        throw redirect({
            to: "/p/$projectId/e/$episodeId/shots",
            params: {projectId: params.projectId, episodeId: episode.id},
            search: {shot: undefined},
        });
    },
});
