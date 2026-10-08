import {AudioWorkspacePage} from "@/components/audio/AudioWorkspacePage";
import {MusicWorkspacePage} from "@/components/music/MusicWorkspacePage";
import {Navigate} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {useEffect, useState} from "react";
import {EpisodeListPage} from "@/components/workspace/EpisodeListPage";
import {Button} from "@/components/ui/button";
import {db} from "@/db/database";
import {ensureFirstEpisode} from "@/db/episodes";
import {normalizeProjectMode} from "@/domain/types";

export function ProjectHomePage({projectId}: {projectId: string}) {
    const projectResult = useLiveQuery(
        async () => ({projectId, project: (await db.projects.get(projectId)) ?? null}),
        [projectId],
    );
    const episodeResult = useLiveQuery(async () => {
        const rows = await db.episodes.where("projectId").equals(projectId).sortBy("order");
        return {projectId, episode: rows[0] ?? null};
    }, [projectId]);
    const project = projectResult?.projectId === projectId ? projectResult.project : undefined;
    const episode = episodeResult?.projectId === projectId ? episodeResult.episode : undefined;
    const [repairing, setRepairing] = useState(false);
    const [repairError, setRepairError] = useState<string>();

    useEffect(() => {
        if (
            !project ||
            episode === undefined ||
            (project.kind !== undefined && project.kind !== "video") ||
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

    if (project === undefined || episode === undefined) return <div className="text-muted-foreground p-8 text-sm">加载项目…</div>;
    if (project === null) return <div className="text-muted-foreground p-8 text-sm">找不到这个项目</div>;

    if (project?.kind === "audio") return <AudioWorkspacePage key={projectId} projectId={projectId}/>;
    if (project?.kind === "music") return <MusicWorkspacePage key={projectId} projectId={projectId}/>;
    if (project?.kind !== undefined && project.kind !== "video") return <div role="alert"
                                                                             className="p-8">不支持的项目类型</div>;

    if (project && normalizeProjectMode(project.mode) === "film") {
        if (episode) {
            return (
                <Navigate
                    to="/p/$projectId/e/$episodeId"
                    params={{projectId, episodeId: episode.id}}
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

    return <EpisodeListPage key={projectId} projectId={projectId}/>;
}
