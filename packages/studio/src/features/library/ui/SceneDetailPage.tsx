import {AssetDetailRoute, assetTargetKey} from "./AssetDetailContent";
import type {AssetDetailTarget} from "../models/assetDetailTarget";

export function SceneDetailPage({sceneId, back}: {
    sceneId: string;
    back: AssetDetailTarget["owner"];
}) {
    const target: AssetDetailTarget = {kind: "scene", owner: back, entityId: sceneId};
    return <AssetDetailRoute key={assetTargetKey(target)} target={target}/>;
}
