import type {ShotDetailTarget} from "../../features/video/models/shotDetailTarget";
import type {AssetDetailTarget} from "../../features/library/models/assetDetailTarget";
import {readShotDetailTarget} from "./shotDetailTarget";

export type BusinessDetailTarget =
    | {kind: "shot"; target: ShotDetailTarget}
    | {kind: "asset"; target: AssetDetailTarget};

function validId(id: string): boolean {
    return id.length > 0 && id.length <= 256 && id.trim() === id && id !== "." && id !== ".." &&
        !/[/\\?#]/.test(id) && ![...id].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

/** Parse only the finite canonical detail destinations; features verify actual ownership. */
export function readBusinessDetailTarget(href: string): BusinessDetailTarget | null {
    const shot = readShotDetailTarget(href);
    if (shot) return {kind: "shot", target: shot};
    if (href.length > 2048) return null;
    const path = href.startsWith("#/") ? href.slice(1) : href;
    if (!/^\/(?!\/)/.test(path) || /[?#\\]/.test(path)) return null;
    const project = /^\/p\/([^/]+)\/assets\/(characters|scenes|props|styles)\/([^/]+)$/.exec(path);
    const studio = /^\/(characters|scenes|props|styles)\/([^/]+)$/.exec(path);
    if (!project && !studio) return null;
    try {
        const plural = project?.[2] ?? studio![1];
        const kind = ({characters: "character", scenes: "scene", props: "prop", styles: "style"} as const)[plural as "characters" | "scenes" | "props" | "styles"];
        const entityId = decodeURIComponent(project?.[3] ?? studio![2]);
        if (!validId(entityId)) return null;
        if (!project) return {kind: "asset", target: {kind, owner: {kind: "studio"}, entityId}};
        const projectId = decodeURIComponent(project[1]);
        return validId(projectId) ? {kind: "asset", target: {kind, owner: {kind: "project", projectId}, entityId}} : null;
    } catch {
        return null;
    }
}

export function sameBusinessDetailTarget(a: BusinessDetailTarget, b: BusinessDetailTarget): boolean {
    if (a.kind === "shot" && b.kind === "shot") return a.target.projectId === b.target.projectId &&
        a.target.episodeId === b.target.episodeId && a.target.shotId === b.target.shotId;
    if (a.kind !== "asset" || b.kind !== "asset") return false;
    return a.target.kind === b.target.kind && a.target.entityId === b.target.entityId &&
        a.target.owner.kind === b.target.owner.kind && (a.target.owner.kind === "studio" ||
            (b.target.owner.kind === "project" && a.target.owner.projectId === b.target.owner.projectId));
}
