import {AssetDetailRoute, assetTargetKey} from "./AssetDetailContent";
import type {AssetDetailTarget} from "../models/assetDetailTarget";

export function CharacterDetailPage({characterId, back}: {
    characterId: string;
    back: AssetDetailTarget["owner"];
}) {
    const target: AssetDetailTarget = {kind: "character", owner: back, entityId: characterId};
    return <AssetDetailRoute key={assetTargetKey(target)} target={target}/>;
}
