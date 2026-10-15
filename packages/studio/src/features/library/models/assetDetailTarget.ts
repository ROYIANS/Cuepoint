/** Exact finite target; only Library translates Studio ownership to its storage sentinel. */
export type AssetDetailTarget = {
    kind: "character" | "scene" | "prop" | "style";
    owner: {kind: "studio"} | {kind: "project"; projectId: string};
    entityId: string;
};

export function assetDetailHref(target: AssetDetailTarget): string {
    const plural = {character: "characters", scene: "scenes", prop: "props", style: "styles"}[target.kind];
    const prefix = target.owner.kind === "studio" ? "" : `/p/${encodeURIComponent(target.owner.projectId)}/assets`;
    return `${prefix}/${plural}/${encodeURIComponent(target.entityId)}`;
}
