/** Exact ownership for inspecting one shot without entering the episode workbench. */
export type ShotDetailTarget = {projectId: string; episodeId: string; shotId: string};

export function shotDetailHref(target: ShotDetailTarget): string {
    return `/p/${encodeURIComponent(target.projectId)}/e/${encodeURIComponent(target.episodeId)}/shots?shot=${encodeURIComponent(target.shotId)}`;
}
