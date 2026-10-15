import {AssetDetailRoute, assetTargetKey} from "./AssetDetailContent";
import type {AssetDetailTarget} from "../models/assetDetailTarget";

export function PropDetailPage({propId, back = {kind: "studio"}}: {
    propId: string;
    back?: AssetDetailTarget["owner"];
}) {
    const target: AssetDetailTarget = {kind: "prop", owner: back, entityId: propId};
    return <AssetDetailRoute key={assetTargetKey(target)} target={target}/>;
}
