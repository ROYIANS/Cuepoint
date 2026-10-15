import {useCallback, useRef, useState, type ReactNode} from "react";
import {useNavigate} from "@tanstack/react-router";
import {useProductQueryState} from "../../../platform/product/queries";
import {useManualDraftDeparture, type ManualDraftState} from "../../../app/drafts/useManualDraftGuard";
import {PageContent, PageHeader, PageState} from "../../../app/layout/PageLayout";
import {Button} from "../../../ui/button";
import type {AssetDetailTarget} from "../models/assetDetailTarget";
import {STUDIO_LIBRARY_ID} from "../models/ownership";
import type {Character, Scene, Prop, VisualStyle} from "../models/assets";
import {CharacterDetailFields, SceneDetailFields, PropDetailFields, StyleDetailFields, type ReportAssetDraft} from "./assetDetailFields";

export const ASSET_DETAIL_LABELS = {character: "角色", scene: "场景", prop: "道具", style: "风格"};
export const assetTargetKey = (target: AssetDetailTarget) => JSON.stringify([target.owner.kind, target.owner.kind === "project" ? target.owner.projectId : null, target.kind, target.entityId]);
type Snapshot = {kind: "character"; asset: Character} | {kind: "scene"; asset: Scene}
    | {kind: "prop"; asset: Prop} | {kind: "style"; asset: VisualStyle};
type DraftEntry = ManualDraftState & {discard?: () => void};

/** Local total state protects pane replacement; slot dialogs retain their real route guard. */
export function useAssetDetailDrafts() {
    const entries = useRef(new Map<string, DraftEntry>());
    const [state, setState] = useState<ManualDraftState>({dirty: false, pending: false});
    const readState = useCallback((): ManualDraftState => {
        const all = [...entries.current.values()];
        const inline = [...entries.current].filter(([key]) => !key.startsWith("slot:")).map(([, value]) => value);
        return {dirty: all.some(entry => entry.dirty), pending: all.some(entry => entry.pending),
            routeDirty: inline.some(entry => entry.dirty), routePending: inline.some(entry => entry.pending)};
    }, []);
    const report = useCallback<ReportAssetDraft>((key, next, discard) => {
        entries.current.set(key, {...next, discard});
        const nextState = readState();
        setState(previous => previous.dirty === nextState.dirty && previous.pending === nextState.pending &&
            previous.routeDirty === nextState.routeDirty && previous.routePending === nextState.routePending ? previous : nextState);
    }, [readState]);
    const discard = useCallback(() => {
        for (const entry of entries.current.values()) entry.discard?.();
        entries.current.clear(); setState({dirty: false, pending: false});
    }, []);
    const reset = useCallback(() => {entries.current.clear(); setState({dirty: false, pending: false});}, []);
    return {state, report, readState, discard, reset};
}

export function AssetDetailContent({target, report, readState, missingAction, embedded = false}: {
    target: AssetDetailTarget; report: ReportAssetDraft; readState: () => ManualDraftState;
    missingAction?: ReactNode; embedded?: boolean;
}) {
    const key = assetTargetKey(target);
    const [attempt, setAttempt] = useState(0);
    const query = useProductQueryState(async tx => {
        // Capture the identity inside the same selector that owns all actual reads.
        const requestedKey = assetTargetKey(target);
        const ownerId = target.owner.kind === "project" ? target.owner.projectId : STUDIO_LIBRARY_ID;
        if (target.owner.kind === "project" && !(await tx.projects.get(ownerId))) return {key: requestedKey, value: null};
        let value: Snapshot | null = null;
        switch (target.kind) {
            case "character": {
                const asset = await tx.characters.get(target.entityId);
                if (asset?.projectId === ownerId) value = {kind: "character", asset};
                break;
            }
            case "scene": {
                const asset = await tx.scenes.get(target.entityId);
                if (asset?.projectId === ownerId) value = {kind: "scene", asset};
                break;
            }
            case "prop": {
                const asset = await tx.props.get(target.entityId);
                if (asset?.projectId === ownerId) value = {kind: "prop", asset};
                break;
            }
            case "style": {
                const asset = await tx.styles.get(target.entityId);
                if (asset?.projectId === ownerId) value = {kind: "style", asset};
                break;
            }
        }
        return {key: requestedKey, value};
    }, [key, attempt]);
    const observed = !query.error && query.value?.key === key ? query.value.value : undefined;
    const ownerId = target.owner.kind === "project" ? target.owner.projectId : STUDIO_LIBRARY_ID;
    const matched = observed && (observed.asset.id !== target.entityId || observed.asset.projectId !== ownerId || observed.kind !== target.kind) ? null : observed;
    const retained = useRef<Snapshot | undefined>(undefined);
    if (matched) retained.current = matched;
    const draftState = readState();
    const snapshot = matched ?? (draftState.dirty || draftState.pending ? retained.current : undefined);
    const unavailable = !!query.error || !matched;
    const label = ASSET_DETAIL_LABELS[target.kind];
    return <div className={embedded ? "app-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-5" : ""} data-asset-detail-scroll>
        {query.error && <div role="alert" className="mb-4 space-y-2 text-sm">
            <p>{label}读取失败。已编辑的内容会保留，请重试。</p>
            <Button size="sm" variant="outline" onClick={() => setAttempt(value => value + 1)}>重试读取{label}</Button>
        </div>}
        {matched === undefined && !query.error && !snapshot && <PageState compact kind="loading" title={`正在读取${label}…`}/>}
        {matched === null && <PageState compact kind="missing" title={`找不到这个${label}`}
            description={snapshot ? "当前编辑内容已保留，目标不可用，暂时不能保存。" : "设定可能已被删除，或不属于指定的资产库。"} action={missingAction}/>}
        {snapshot && <div data-asset-editor={snapshot.asset.id}>
            {snapshot.kind === "character" && <CharacterDetailFields character={snapshot.asset} unavailable={unavailable} report={report} compact={embedded}/>}
            {snapshot.kind === "scene" && <SceneDetailFields scene={snapshot.asset} unavailable={unavailable} report={report} compact={embedded}/>}
            {snapshot.kind === "prop" && <PropDetailFields prop={snapshot.asset} unavailable={unavailable} report={report} compact={embedded}/>}
            {snapshot.kind === "style" && <StyleDetailFields style={snapshot.asset} unavailable={unavailable} report={report} compact={embedded}/>}
        </div>}
    </div>;
}

/** Existing routes and the in-workspace pane render the same queried field bodies. */
export function AssetDetailRoute({target}: {target: AssetDetailTarget}) {
    const drafts = useAssetDetailDrafts();
    const {confirmation} = useManualDraftDeparture(drafts.state.dirty, drafts.state.pending, drafts.discard, {readState: drafts.readState});
    const navigate = useNavigate();
    const label = ASSET_DETAIL_LABELS[target.kind];
    const tab = ({character: "characters", scene: "scenes", prop: "props", style: "styles"} as const)[target.kind];
    return <div className={target.owner.kind === "project" ? "app-scroll h-full min-h-0 overflow-auto" : "min-h-full"}>
        <PageContent mode="detail"><PageHeader title={label}/>
            <AssetDetailContent target={target} report={drafts.report} readState={drafts.readState} missingAction={
                <Button className="mt-3" onClick={() => {
                    if (target.owner.kind === "studio") void navigate({to: `/${tab}`});
                    else void navigate({to: "/p/$projectId/world", params: {projectId: target.owner.projectId}, search: {tab}});
                }}>{target.owner.kind === "studio" ? `返回${label}库` : "返回世界"}</Button>}/>
        </PageContent>{confirmation}
    </div>;
}
