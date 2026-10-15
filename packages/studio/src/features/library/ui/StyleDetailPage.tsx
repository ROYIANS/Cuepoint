import {AssetDetailRoute, assetTargetKey} from "./AssetDetailContent";
import type {AssetDetailTarget} from "../models/assetDetailTarget";

export function StyleDetailPage({styleId, back = {kind: "studio"}}: {
    styleId: string;
    back?: AssetDetailTarget["owner"];
}) {
    const target: AssetDetailTarget = {kind: "style", owner: back, entityId: styleId};
    return <AssetDetailRoute key={assetTargetKey(target)} target={target}/>;
}
