import {useNavigate} from "@tanstack/react-router";
import {useProductQuery} from "../../../platform/product/queries";
import {useState} from "react";
import type {ProductStore, StoreTable} from "../../../platform/storage/types";
import {Plus} from "../../../ui/icons";
import {CoverCard, LibraryGrid} from "./CoverCard";
import {LibraryHeader} from "./LibraryHeader";
import {PageContent, PageState} from "../../../app/layout/PageLayout";
import {Button} from "../../../ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../../../ui/alert-dialog";
import {useAssetOperations} from "./useAssetOperations";
import {firstResultId} from "../models/slot";
import {type Character, type Prop, type Scene, type VisualStyle} from "../models/assets";
import {CHARACTER_SLOTS, PROP_SLOTS, SCENE_SLOTS, STYLE_SLOTS} from "../models/slots";
import {STUDIO_LIBRARY_ID} from "../models/ownership";
import {matchesAssetSearch, type AssetKind} from "../queries/assetLibrary";
import {formatUpdatedAt} from "../../../ui/format";
import {filterAndSortLibrary, type LibrarySort} from "../services/library";

function characterCover(character: Character) {
    return firstResultId(CHARACTER_SLOTS.map((slot) => character.slots?.[slot.id]));
}

function sceneCover(scene: Scene) {
    return firstResultId(SCENE_SLOTS.map((slot) => scene.slots?.[slot.id]));
}

function propCover(prop: Prop) {
    return firstResultId(PROP_SLOTS.map((slot) => prop.slots?.[slot.id]));
}

function styleCover(style: VisualStyle) {
    return firstResultId(STYLE_SLOTS.map((slot) => style.slots?.[slot.id]));
}

type LibraryKind = AssetKind;

type LibraryAsset = Pick<Character, "id" | "name" | "projectId" | "createdAt" | "updatedAt">;
type LibraryRow = LibraryAsset & { source: object; mediaId?: string };

async function readLibraryRows<T extends LibraryAsset>(table: StoreTable<T>, cover: (asset: T) => string | undefined): Promise<LibraryRow[]> {
    const assets = await table.where("projectId").equals(STUDIO_LIBRARY_ID).toArray();
    return assets.map(asset => ({
        id: asset.id, name: asset.name, projectId: asset.projectId,
        createdAt: asset.createdAt, updatedAt: asset.updatedAt,
        // Keep authored search fields on their original object; cover IDs are not searchable.
        source: asset, mediaId: cover(asset),
    }));
}

function readStudioLibrary(kind: LibraryKind, db: ProductStore): Promise<LibraryRow[]> {
    switch (kind) {
        case "character":
            return readLibraryRows(db.characters, characterCover);
        case "scene":
            return readLibraryRows(db.scenes, sceneCover);
        case "prop":
            return readLibraryRows(db.props, propCover);
        case "style":
            return readLibraryRows(db.styles, styleCover);
    }
}

const COPY: Record<
    LibraryKind,
    { title: string; hint: string; create: string; empty: string }
> = {
    character: {
        title: "角色设定",
        hint: "工作室里的人。创建后留在这里编辑，项目再引用，不跳进某部戏。",
        create: "创建角色",
        empty: "删掉这个角色？",
    },
    scene: {
        title: "常用场景",
        hint: "工作室里的地。创建后留在这里编辑，项目再引用。",
        create: "创建场景",
        empty: "删掉这个场景？",
    },
    prop: {
        title: "道具",
        hint: "衣服、物件、关键道具。添加到项目后可关联分镜，项目中的修改不影响这里。",
        create: "创建道具",
        empty: "删掉这个道具？",
    },
    style: {
        title: "视觉风格",
        hint: "画风、光色、镜头气质。创建后留在这里，避免每部戏重新发明。",
        create: "创建风格",
        empty: "删掉这个风格？",
    },
};

export function CharacterLibraryPage() {
    return <StudioLibrary key="character" kind="character"/>;
}

export function SceneLibraryPage() {
    return <StudioLibrary key="scene" kind="scene"/>;
}

export function PropLibraryPage() {
    return <StudioLibrary key="prop" kind="prop"/>;
}

export function StyleLibraryPage() {
    return <StudioLibrary key="style" kind="style"/>;
}

function StudioLibrary({kind}: { kind: LibraryKind }) {
    const navigate = useNavigate();
    const operations = useAssetOperations({kind, ownerId: STUDIO_LIBRARY_ID, openAsset: id => navigateToItem(id)});
    const copy = COPY[kind];
    const view = useProductQuery(async (db) => {
        try {
            return {kind, rows: await readStudioLibrary(kind, db)};
        } catch (cause) {
            return {kind, error: cause instanceof Error ? cause.message : "读取失败，请刷新后重试。"};
        }
    }, [kind]);
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<LibrarySort>("updated");

    const raw = view?.kind === kind ? view.rows ?? [] : [];
    const items = filterAndSortLibrary(raw.filter((item) => matchesAssetSearch(item.source, query)), "", sort);

    function navigateToItem(id: string) {
        if (kind === "character") {
            return navigate({to: "/characters/$characterId", params: {characterId: id}});
        }
        if (kind === "scene") {
            return navigate({to: "/scenes/$sceneId", params: {sceneId: id}});
        }
        if (kind === "prop") {
            return navigate({to: "/props/$propId", params: {propId: id}});
        }
        return navigate({to: "/styles/$styleId", params: {styleId: id}});
    }

    return (
        <PageContent mode="collection">
            <LibraryHeader title={copy.title} description={copy.hint} query={query} onQuery={setQuery} sort={sort}
                           onSort={setSort}
                           extra={<Button disabled={operations.busy || operations.createIssue?.kind === "unknown"} onClick={() => void operations.create()}><Plus
                               aria-hidden/>{operations.creating ? "创建中…" : operations.createIssue?.kind === "open" ? "打开已创建的设定" : copy.create}</Button>}/>
            {operations.createIssue && <p role="alert" className="text-destructive text-sm">{operations.createIssue.message}</p>}
            <div>
                {(!view || view.kind !== kind) && <PageState kind="loading" title="正在读取设定…"/>}
                {view?.kind === kind && view.error &&
                    <PageState kind="error" title="暂时无法读取设定" description={view.error}/>}
                {view?.kind === kind && !view.error && !items.length &&
                    <PageState title={query.trim() ? "没有匹配的设定" : `暂无${copy.title}`}
                               description={query.trim() ? "试试其他关键词。" : "创建后可在工作室编辑，添加到项目时使用独立副本。"}/>}
                {view?.kind === kind && !view.error && items.length > 0 && <LibraryGrid>
                    {items.map((item) => (
                        <CoverCard
                            key={item.id}
                            title={item.name}
                            subtitle={`工作室 · ${formatUpdatedAt(item.updatedAt)}`}
                            mediaId={item.mediaId}
                            onOpen={() => void navigateToItem(item.id)}
                            actions={[
                                {
                                    label: "删除",
                                    tone: "danger",
                                    onSelect: () => {
                                        operations.selectDelete({id: item.id, name: item.name});
                                    },
                                },
                            ]}
                        />
                    ))}
                </LibraryGrid>}
            </div>

            <AlertDialog
                open={Boolean(operations.target)}
                onOpenChange={(open) => {if (!open) operations.closeDelete();}}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{copy.empty}</AlertDialogTitle>
                        <AlertDialogDescription>确定删除「{operations.target?.name}」？</AlertDialogDescription>
                    </AlertDialogHeader>
                    {operations.deleteIssue && <p role="alert" className="text-destructive text-sm">{operations.deleteIssue.message}</p>}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={operations.busy}>取消</AlertDialogCancel>
                        {operations.deleteIssue?.unknown ? (
                            <Button disabled={operations.busy} onClick={() => void operations.inspectDelete()}>
                                {operations.checking ? "核对中…" : "核对结果"}
                            </Button>
                        ) : (
                            <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                disabled={operations.busy}
                                onClick={(event) => {
                                    event.preventDefault();
                                    void operations.remove();
                                }}
                            >
                                {operations.deleting ? "删除中…" : "删除"}
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContent>
    );
}
